"""
runtime/task_dispatcher.py
===========================
Task dispatcher – bridge between the RuntimeController and the
WorkerPool / TaskQueue.

The dispatcher:
  1. Accepts a task payload from the RuntimeController
  2. Decides whether to execute inline (fast path) or enqueue (async path)
  3. Integrates circuit-breaker protection per agent type
  4. Returns either the immediate result or a tracking handle

Usage::

    dispatcher = TaskDispatcher()
    result = await dispatcher.dispatch({"command": "...", "type": "scrape"})
    health  = dispatcher.health()
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid
from typing import Any

from task_queue.redis_queue import TaskQueue
from runtime.fault_tolerance import CircuitBreaker, RetryPolicy
from runtime.observability import record_command, record_error, record_latency, record_agent_health

logger = logging.getLogger(__name__)

# Fast-path agent types (executed inline without queueing)
INLINE_TYPES = frozenset({"seo", "social", "browser", "scrape", "automation"})
# Slow/background task types (always queued)
QUEUED_TYPES = frozenset({"batch_scrape", "outreach", "export", "pipeline"})

INLINE_TIMEOUT = int(os.getenv("DISPATCHER_INLINE_TIMEOUT", "60"))


class TaskDispatcher:
    """
    Dispatch tasks to either inline execution or the async queue.

    A per-agent circuit breaker protects downstream agents from
    cascading failures.
    """

    def __init__(self) -> None:
        self._queue = TaskQueue()
        self._circuit_breakers: dict[str, CircuitBreaker] = {}
        logger.info("[TaskDispatcher] Initialised")

    # ------------------------------------------------------------------

    def _get_circuit_breaker(self, agent: str) -> CircuitBreaker:
        if agent not in self._circuit_breakers:
            self._circuit_breakers[agent] = CircuitBreaker(
                name=agent,
                failure_threshold=5,
                recovery_timeout=30,
            )
        return self._circuit_breakers[agent]

    # ------------------------------------------------------------------

    async def dispatch(
        self,
        payload: dict[str, Any],
        run_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Dispatch *payload* to the appropriate execution path.

        :param payload: Task payload dict (must contain ``type`` and ``command``).
        :param run_id: Optional run identifier.
        :returns: Result dict.
        """
        run_id = run_id or str(uuid.uuid4())
        task_type = payload.get("type", "plan")
        agent = payload.get("agent", "planner")

        cb = self._get_circuit_breaker(agent)
        if not cb.allow_request():
            record_error("circuit_open", agent)
            return {
                "success": False,
                "run_id": run_id,
                "error": f"Circuit breaker open for agent '{agent}'",
            }

        # Always-queued types: enqueue and return immediately
        if task_type in QUEUED_TYPES:
            task_id = self._queue.enqueue(payload)
            return {
                "success": True,
                "run_id": run_id,
                "queued": True,
                "task_id": task_id,
                "message": f"Task queued (type={task_type})",
            }

        # Inline execution for interactive/fast tasks
        start = time.time()
        try:
            result = await asyncio.wait_for(
                self._execute_inline(payload, run_id),
                timeout=INLINE_TIMEOUT,
            )
            cb.record_success()
            record_latency(agent, time.time() - start)
            record_agent_health(agent, status="ok")
            return result
        except asyncio.TimeoutError:
            cb.record_failure()
            record_error("timeout", agent)
            # Fall back to queueing on timeout
            task_id = self._queue.enqueue(payload)
            logger.warning(
                "[TaskDispatcher] Inline timeout for %s – queued as %s", agent, task_id
            )
            return {
                "success": False,
                "run_id": run_id,
                "error": "Inline execution timed out – task queued for background processing",
                "task_id": task_id,
                "queued": True,
            }
        except Exception as exc:
            cb.record_failure()
            record_error(str(exc), agent)
            record_agent_health(agent, status="error", error=str(exc))
            logger.error("[TaskDispatcher] Dispatch error agent=%s: %s", agent, exc)
            return {"success": False, "run_id": run_id, "error": str(exc)}

    # ------------------------------------------------------------------

    async def _execute_inline(
        self,
        payload: dict[str, Any],
        run_id: str,
    ) -> dict[str, Any]:
        """Execute *payload* inline using the worker-pool agent router."""
        from runtime.worker_pool import _route_to_agent

        task_type = payload.get("type", "plan")
        agent = payload.get("agent", "planner")
        record_command(agent, task_type)
        result = await _route_to_agent(task_type, agent, payload)
        result.setdefault("run_id", run_id)
        return result

    # ------------------------------------------------------------------

    def health(self) -> dict[str, Any]:
        """Return dispatcher health information."""
        queue_health = self._queue.health()
        cb_statuses = {name: cb.status() for name, cb in self._circuit_breakers.items()}
        return {
            "queue": queue_health,
            "circuit_breakers": cb_statuses,
        }
