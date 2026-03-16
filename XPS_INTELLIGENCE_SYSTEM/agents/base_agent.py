"""
agents/base_agent.py
====================
Abstract base class for all XPS Intelligence Platform agents.

Every agent in the system inherits from BaseAgent to get:
  - A consistent async execution interface (``execute`` / ``run``)
  - Automatic Redis task-queue integration
  - Structured event emission
  - Uniform error handling with retry logic
  - Inter-agent communication helpers

Usage::

    class MyAgent(BaseAgent):
        agent_name = "my_agent"

        async def execute(self, task: dict, context: dict | None = None) -> dict:
            # ... implementation ...
            return {"success": True, "result": "done"}
"""

from __future__ import annotations

import abc
import asyncio
import logging
import threading
import time
import uuid
from typing import Any, Callable

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Event bus (in-process, thread-safe)
# ---------------------------------------------------------------------------

_EVENT_LISTENERS: dict[str, list[Callable[[dict[str, Any]], None]]] = {}
_EVENT_LOCK = threading.Lock()


def subscribe(event_type: str, handler: Callable[[dict[str, Any]], None]) -> None:
    """Register *handler* to be called whenever *event_type* is emitted."""
    with _EVENT_LOCK:
        _EVENT_LISTENERS.setdefault(event_type, []).append(handler)


def unsubscribe(event_type: str, handler: Callable[[dict[str, Any]], None]) -> None:
    """Remove *handler* from *event_type* listeners."""
    with _EVENT_LOCK:
        listeners = _EVENT_LISTENERS.get(event_type, [])
        if handler in listeners:
            listeners.remove(handler)


def emit(event: dict[str, Any]) -> None:
    """Dispatch *event* to all registered listeners."""
    event_type = event.get("type", "unknown")
    # Snapshot listener lists under the lock so we don't hold it during dispatch
    with _EVENT_LOCK:
        typed_handlers = list(_EVENT_LISTENERS.get(event_type, []))
        wildcard_handlers = list(_EVENT_LISTENERS.get("*", []))
    for handler in typed_handlers:
        try:
            handler(event)
        except Exception as exc:
            logger.debug("Event handler error for '%s': %s", event_type, exc)
    for handler in wildcard_handlers:
        try:
            handler(event)
        except Exception as exc:
            logger.debug("Wildcard event handler error: %s", exc)


# ---------------------------------------------------------------------------
# BaseAgent
# ---------------------------------------------------------------------------


class BaseAgent(abc.ABC):
    """
    Abstract base class for all XPS Intelligence agents.

    Subclasses must implement :meth:`execute`.  They may optionally
    override :meth:`health` and :meth:`capabilities`.

    Attributes
    ----------
    agent_name : str
        Unique identifier for this agent type.
    max_retries : int
        Number of automatic retries on transient failures.
    retry_delay : float
        Seconds to wait between retries (exponential back-off applied).
    """

    agent_name: str = "base_agent"
    max_retries: int = 2
    retry_delay: float = 1.0

    def __init__(self) -> None:
        self._run_id: str | None = None
        self._queue = self._init_queue()

    # ------------------------------------------------------------------
    # Task queue integration
    # ------------------------------------------------------------------

    def _init_queue(self):
        try:
            from task_queue.redis_queue import TaskQueue
            return TaskQueue()
        except Exception as exc:
            logger.debug("TaskQueue unavailable for %s: %s", self.agent_name, exc)
            return None

    def enqueue_task(self, payload: dict[str, Any]) -> str | None:
        """Push *payload* onto the shared Redis task queue."""
        if self._queue:
            try:
                return self._queue.enqueue(payload)
            except Exception as exc:
                logger.warning("%s.enqueue_task failed: %s", self.agent_name, exc)
        return None

    def update_task_status(self, task_id: str, status: str, **extra: Any) -> None:
        """Update a queued task's status."""
        if self._queue and task_id:
            try:
                self._queue.update_status(task_id, status, **extra)
            except Exception as exc:
                logger.debug("%s.update_task_status failed: %s", self.agent_name, exc)

    # ------------------------------------------------------------------
    # Event emission
    # ------------------------------------------------------------------

    def emit_event(self, event_type: str, data: dict[str, Any] | None = None) -> None:
        """Emit a structured event to all listeners."""
        event: dict[str, Any] = {
            "type": event_type,
            "agent": self.agent_name,
            "run_id": self._run_id,
            "timestamp": time.time(),
            **(data or {}),
        }
        emit(event)
        logger.debug("Event emitted: %s by %s", event_type, self.agent_name)

    # ------------------------------------------------------------------
    # Inter-agent communication
    # ------------------------------------------------------------------

    async def delegate(
        self,
        agent_class: type["BaseAgent"],
        task: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Instantiate *agent_class* and delegate *task* to it.

        :returns: The result dict from the delegated agent.
        """
        agent = agent_class()
        agent._run_id = self._run_id
        self.emit_event("agent.delegate", {"to": agent.agent_name, "task": task})
        return await agent.execute(task, context)

    # ------------------------------------------------------------------
    # Core execution interface
    # ------------------------------------------------------------------

    @abc.abstractmethod
    async def execute(
        self,
        task: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Execute *task* with optional shared *context*.

        Must return a dict with at minimum ``{"success": bool}``.
        """

    async def run(self, command: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        """
        Convenience wrapper: wrap a plain-text *command* in a task dict
        and call :meth:`execute` with retry logic.

        :returns: Execution result dict.
        """
        self._run_id = str(uuid.uuid4())
        task = {"command": command, "run_id": self._run_id}
        self.emit_event("agent.start", {"command": command})

        last_error: Exception | None = None
        for attempt in range(self.max_retries + 1):
            try:
                result = await self.execute(task, context)
                result.setdefault("run_id", self._run_id)
                result.setdefault("agent", self.agent_name)
                self.emit_event("agent.complete", {"result": result})
                return result
            except Exception as exc:
                last_error = exc
                logger.warning(
                    "%s attempt %d/%d failed: %s",
                    self.agent_name, attempt + 1, self.max_retries + 1, exc,
                )
                self.emit_event("agent.error", {"attempt": attempt + 1, "error": str(exc)})
                if attempt < self.max_retries:
                    await asyncio.sleep(self.retry_delay * min(2 ** attempt, 30))

        error_result = {
            "success": False,
            "run_id": self._run_id,
            "agent": self.agent_name,
            "error": str(last_error),
            "message": f"{self.agent_name} failed after {self.max_retries + 1} attempts",
        }
        self.emit_event("agent.failed", error_result)
        return error_result

    # ------------------------------------------------------------------
    # Health & capabilities
    # ------------------------------------------------------------------

    def health(self) -> dict[str, Any]:
        """Return a health status dict for this agent."""
        queue_ok = False
        if self._queue:
            try:
                h = self._queue.health()
                queue_ok = h.get("redis_connected", False) or h.get("backend") == "in-process"
            except Exception:
                pass
        return {
            "agent": self.agent_name,
            "status": "ok",
            "queue_connected": queue_ok,
        }

    def capabilities(self) -> list[str]:
        """Return a list of capability strings for this agent."""
        return []

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} agent_name={self.agent_name!r}>"
