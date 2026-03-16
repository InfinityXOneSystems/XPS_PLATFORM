"""
runtime/runtime_controller.py
==============================
Central runtime controller for the XPS Intelligence Platform.

Responsibilities:
  - Receive commands from the frontend LLM command interface
  - Route commands through the command router
  - Manage agent lifecycle (start, stop, health, register)
  - Dispatch tasks via the TaskDispatcher to the worker pool
  - Emit observability events

Public API::

    controller = RuntimeController()
    result = await controller.handle_command(command, context=None)
    controller.get_health()
    controller.get_metrics()
    controller.register_agent(name, agent_class)
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from typing import Any

from agent_core.command_router import route
from runtime.observability import get_metrics, record_command, record_error, record_latency
from runtime.task_dispatcher import TaskDispatcher
from runtime.fault_tolerance import CircuitBreaker

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Agent registry
# ---------------------------------------------------------------------------

_AGENT_REGISTRY: dict[str, type] = {}
_AGENT_INSTANCES: dict[str, Any] = {}


def register_agent(name: str, agent_class: type) -> None:
    """Register an agent class under *name*."""
    _AGENT_REGISTRY[name] = agent_class
    logger.info("[RuntimeController] Registered agent: %s", name)


def get_registered_agents() -> list[str]:
    """Return a list of all registered agent names."""
    return list(_AGENT_REGISTRY.keys())


# ---------------------------------------------------------------------------
# RuntimeController
# ---------------------------------------------------------------------------


class RuntimeController:
    """
    Central orchestration controller.

    Connects the frontend LLM command interface to the agent worker pool
    via the command router and task dispatcher.

    Usage::

        controller = RuntimeController()
        result = await controller.handle_command("scrape epoxy contractors ohio")
    """

    def __init__(self) -> None:
        self._dispatcher = TaskDispatcher()
        self._circuit_breaker = CircuitBreaker(
            name="runtime_controller",
            failure_threshold=5,
            recovery_timeout=30,
        )
        self._start_time = time.time()
        self._commands_processed = 0
        self._commands_failed = 0
        self._agent_lock = asyncio.Lock()
        logger.info("[RuntimeController] Initialised")

    # ------------------------------------------------------------------
    # Command handling  (frontend LLM → pipeline)
    # ------------------------------------------------------------------

    async def handle_command(
        self,
        command: str,
        context: dict[str, Any] | None = None,
        run_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Route *command* from the frontend LLM through the pipeline.

        Steps:
          1. Parse/route the command via command_router
          2. Apply circuit-breaker protection
          3. Dispatch via TaskDispatcher to the worker pool
          4. Return the result

        :param command: Natural language command string.
        :param context: Optional extra context dict.
        :param run_id: Optional caller-supplied run identifier.
        :returns: Result dict with ``success``, ``run_id``, and payload.
        """
        run_id = run_id or str(uuid.uuid4())
        start_ts = time.time()
        logger.info(
            "[RuntimeController] handle_command run_id=%s command=%r",
            run_id,
            command,
        )

        # 1. Route the command
        routing = route(command)
        agent_type = routing.get("agent", "planner")
        task_type = routing.get("type", "plan")
        params = routing.get("params", {})

        record_command(agent_type, task_type)

        # 2. Circuit breaker check
        if not self._circuit_breaker.allow_request():
            self._commands_failed += 1
            record_error("circuit_open", agent_type)
            return {
                "success": False,
                "run_id": run_id,
                "error": "Circuit breaker open – service temporarily unavailable",
                "agent": agent_type,
            }

        # 3. Build dispatch payload
        payload = {
            "command": command,
            "type": task_type,
            "agent": agent_type,
            "run_id": run_id,
            "context": context or {},
            **params,
        }

        # 4. Dispatch
        try:
            result = await self._dispatcher.dispatch(payload, run_id=run_id)
            self._commands_processed += 1
            self._circuit_breaker.record_success()
            latency = time.time() - start_ts
            record_latency(agent_type, latency)
            result["run_id"] = run_id
            result["routing"] = routing
            return result
        except Exception as exc:
            self._commands_failed += 1
            self._circuit_breaker.record_failure()
            record_error(str(exc), agent_type)
            logger.error("[RuntimeController] Command failed: %s", exc)
            return {
                "success": False,
                "run_id": run_id,
                "error": str(exc),
                "agent": agent_type,
            }

    # ------------------------------------------------------------------
    # Agent lifecycle management
    # ------------------------------------------------------------------

    async def start_agent(self, name: str, **kwargs: Any) -> dict[str, Any]:
        """Instantiate and register a running agent instance."""
        async with self._agent_lock:
            if name in _AGENT_INSTANCES:
                return {"success": True, "status": "already_running", "agent": name}
            agent_class = _AGENT_REGISTRY.get(name)
            if not agent_class:
                return {"success": False, "error": f"Unknown agent: {name}"}
            instance = agent_class(**kwargs)
            _AGENT_INSTANCES[name] = instance
            logger.info("[RuntimeController] Started agent: %s", name)
            return {"success": True, "status": "started", "agent": name}

    async def stop_agent(self, name: str) -> dict[str, Any]:
        """Stop and remove a running agent instance."""
        async with self._agent_lock:
            instance = _AGENT_INSTANCES.pop(name, None)
            if instance is None:
                return {"success": False, "error": f"Agent not running: {name}"}
            if hasattr(instance, "shutdown"):
                try:
                    await instance.shutdown()
                except Exception as exc:
                    logger.warning("[RuntimeController] Agent %s shutdown error: %s", name, exc)
            logger.info("[RuntimeController] Stopped agent: %s", name)
            return {"success": True, "status": "stopped", "agent": name}

    def get_running_agents(self) -> list[str]:
        """Return names of currently running agent instances."""
        return list(_AGENT_INSTANCES.keys())

    # ------------------------------------------------------------------
    # Health & metrics
    # ------------------------------------------------------------------

    def get_health(self) -> dict[str, Any]:
        """Return system health status."""
        dispatcher_health = self._dispatcher.health()
        circuit_status = self._circuit_breaker.status()
        return {
            "status": "ok" if circuit_status["state"] != "open" else "degraded",
            "uptime_seconds": round(time.time() - self._start_time, 1),
            "commands_processed": self._commands_processed,
            "commands_failed": self._commands_failed,
            "circuit_breaker": circuit_status,
            "dispatcher": dispatcher_health,
            "registered_agents": get_registered_agents(),
            "running_agents": self.get_running_agents(),
        }

    def get_metrics(self) -> dict[str, Any]:
        """Return observability metrics."""
        return get_metrics()
