"""
runtime_controller/runtime_controller.py
==========================================
Central Runtime Controller for the XPS Intelligence Platform.

The RuntimeController is the single entry point for all agent execution.
Every command — whether from the dashboard chat, the API gateway, or a
scheduled GitHub Actions job — passes through here.

Responsibilities:
  1. Receive ExecutionRequest (command + metadata)
  2. Run sandbox checks via agent_core.executor._sandbox_check
  3. Route to TaskDispatcher
  4. Submit to WorkerPool (async, non-blocking)
  5. Record observability metrics + spans
  6. Apply fault-tolerance (circuit-breaker, retry, bulkhead)
  7. Return ExecutionResponse

Architecture::

    caller
      │
      ▼
    RuntimeController.execute(request)
      │  ├─ sandbox_check()
      │  ├─ start_span()
      │  ├─ bulkhead.acquire()
      │  └─ TaskDispatcher.dispatch(payload)
      │         └─ handler(payload)
      │                └─ BaseAgent.run(command)
      ▼
    ExecutionResponse

Usage::

    from runtime_controller import get_controller, ExecutionRequest

    controller = get_controller()
    response = await controller.execute(
        ExecutionRequest(command="scrape epoxy contractors ohio")
    )
    print(response.result)
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from observability import get_observability, record_metric, start_span
from fault_tolerance import CircuitBreaker, Bulkhead, BulkheadFullError, fault_tolerant
from task_dispatcher import get_dispatcher, DispatchResult
from kernel import get_kernel

logger = logging.getLogger("runtime_controller")

# ---------------------------------------------------------------------------
# Sandbox enforcement
# ---------------------------------------------------------------------------

_SANDBOX_BLOCKED_PATTERNS = [
    "rm -", "rmdir", "shutil.rmtree", "os.remove", "os.unlink",
    "subprocess", "os.system", "shell=True", "os.environ",
    "exec(", "eval(", "__import__",
]


def _sandbox_check(command: str) -> None:
    """Block commands containing dangerous patterns."""
    lower = command.lower()
    for pattern in _SANDBOX_BLOCKED_PATTERNS:
        if pattern in lower:
            raise PermissionError(
                f"Sandbox violation: command contains blocked pattern '{pattern}'"
            )


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


@dataclass
class ExecutionRequest:
    """Describes a task to be executed by the RuntimeController."""

    command: str
    task_type: Optional[str] = None       # if None, auto-detected by command_router
    priority: int = 5                     # 1 (urgent) … 10 (background)
    timeout: float = 120.0
    correlation_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_payload(self) -> Dict[str, Any]:
        return {
            "command": self.command,
            "type": self.task_type or self._auto_detect_type(),
            "priority": self.priority,
            "timeout": self.timeout,
            "correlation_id": self.correlation_id,
            **self.metadata,
        }

    def _auto_detect_type(self) -> str:
        try:
            from agent_core.command_router import route
            return route(self.command).get("type", "plan")
        except Exception:
            return "plan"


@dataclass
class ExecutionResponse:
    """Result of a RuntimeController.execute() call."""

    success: bool
    correlation_id: str
    result: Any = None
    error: Optional[str] = None
    task_type: str = "unknown"
    duration_ms: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "correlation_id": self.correlation_id,
            "result": self.result,
            "error": self.error,
            "task_type": self.task_type,
            "duration_ms": self.duration_ms,
            "metadata": self.metadata,
        }


# ---------------------------------------------------------------------------
# RuntimeController
# ---------------------------------------------------------------------------


class RuntimeController:
    """Central controller — all agent execution passes through here."""

    def __init__(
        self,
        circuit_failure_threshold: int = 10,
        circuit_recovery_timeout: float = 30.0,
        bulkhead_max_concurrent: int = 50,
        sandbox_enabled: bool = True,
    ) -> None:
        self._sandbox_enabled = sandbox_enabled
        self._dispatcher = get_dispatcher()
        self._kernel = get_kernel()
        self._obs = get_observability()

        # Per-type circuit breakers (created on demand)
        self._circuits: Dict[str, CircuitBreaker] = {}
        self._circuit_cfg = {
            "failure_threshold": circuit_failure_threshold,
            "recovery_timeout": circuit_recovery_timeout,
        }

        # Global concurrency bulkhead
        self._bulkhead = Bulkhead("runtime_controller", max_concurrent=bulkhead_max_concurrent)

        logger.info(
            "RuntimeController initialised (sandbox=%s, bulkhead=%d)",
            sandbox_enabled,
            bulkhead_max_concurrent,
        )
        record_metric("runtime_controller.init")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def execute(self, request: ExecutionRequest) -> ExecutionResponse:
        """Execute *request* with full sandbox, circuit-breaker and observability."""
        start = time.monotonic()
        cid = request.correlation_id

        with start_span(
            "runtime_controller.execute",
            tags={"correlation_id": cid, "command": request.command[:60]},
        ) as span:
            # 1. Sandbox check
            if self._sandbox_enabled:
                try:
                    _sandbox_check(request.command)
                except PermissionError as exc:
                    record_metric("runtime_controller.sandbox_blocked")
                    return ExecutionResponse(
                        success=False,
                        correlation_id=cid,
                        error=str(exc),
                        task_type="sandbox_blocked",
                        duration_ms=(time.monotonic() - start) * 1000,
                    )

            # 2. Auto-detect task type
            payload = request.to_payload()
            task_type = payload.get("type", "plan")
            span.set_tag("task_type", task_type)

            # 3. Circuit-breaker
            circuit = self._get_circuit(task_type)
            if not circuit.allow_request():
                record_metric("runtime_controller.circuit_open", tags={"type": task_type})
                return ExecutionResponse(
                    success=False,
                    correlation_id=cid,
                    error=f"Circuit breaker OPEN for task type '{task_type}'",
                    task_type=task_type,
                    duration_ms=(time.monotonic() - start) * 1000,
                )

            # 4. Bulkhead
            try:
                async with self._bulkhead:
                    dispatch_result = await self._dispatcher.dispatch(payload)
            except BulkheadFullError as exc:
                # Capacity rejection — don't count against circuit breaker
                record_metric("runtime_controller.bulkhead_rejected", tags={"type": task_type})
                return ExecutionResponse(
                    success=False,
                    correlation_id=cid,
                    error=str(exc),
                    task_type=task_type,
                    duration_ms=(time.monotonic() - start) * 1000,
                )
            except Exception as exc:
                circuit.record_failure()
                return ExecutionResponse(
                    success=False,
                    correlation_id=cid,
                    error=str(exc),
                    task_type=task_type,
                    duration_ms=(time.monotonic() - start) * 1000,
                )

            # 5. Record circuit outcome
            if dispatch_result.success:
                circuit.record_success()
            else:
                circuit.record_failure()

            duration = (time.monotonic() - start) * 1000
            record_metric(
                "runtime_controller.execute",
                tags={
                    "type": task_type,
                    "success": str(dispatch_result.success).lower(),
                },
            )
            span.set_tag("success", dispatch_result.success)

            return ExecutionResponse(
                success=dispatch_result.success,
                correlation_id=cid,
                result=dispatch_result.result,
                error=dispatch_result.error,
                task_type=task_type,
                duration_ms=duration,
            )

    def execute_sync(self, request: ExecutionRequest) -> ExecutionResponse:
        """Synchronous wrapper — always runs execute() in a new thread to avoid event loop conflicts."""
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            return pool.submit(asyncio.run, self.execute(request)).result(
                timeout=request.timeout + 10
            )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _get_circuit(self, task_type: str) -> CircuitBreaker:
        if task_type not in self._circuits:
            self._circuits[task_type] = CircuitBreaker(
                f"rc_{task_type}",
                **self._circuit_cfg,
            )
        return self._circuits[task_type]

    def status(self) -> Dict[str, Any]:
        """Return current controller status."""
        return {
            "sandbox_enabled": self._sandbox_enabled,
            "circuits": {
                name: cb.status() for name, cb in self._circuits.items()
            },
            "kernel": self._kernel.status_summary(),
            "metrics": self._obs.snapshot(),
        }


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_controller: Optional[RuntimeController] = None


def get_controller(
    sandbox_enabled: bool = True,
    bulkhead_max_concurrent: int = 50,
) -> RuntimeController:
    global _controller
    if _controller is None:
        _controller = RuntimeController(
            sandbox_enabled=sandbox_enabled,
            bulkhead_max_concurrent=bulkhead_max_concurrent,
        )
    return _controller
