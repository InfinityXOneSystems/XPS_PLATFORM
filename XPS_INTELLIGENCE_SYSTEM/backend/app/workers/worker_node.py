"""
app/workers/worker_node.py
===========================
Individual worker node that processes tasks from a queue.
"""

from __future__ import annotations

import logging
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Optional

from app.queue.redis_queue import RedisQueue, get_default_queue
from app.queue.task_state_store import get_task_state_store
from app.runtime.command_schema import TaskStatus
from app.runtime.retry_policy import RetryPolicy, default_retry_policy

logger = logging.getLogger(__name__)

# Registry of agent handler functions: agent_name → callable
_AGENT_HANDLERS: Dict[str, Callable[[Dict[str, Any]], Any]] = {}


def register_handler(agent_name: str, handler: Callable[[Dict[str, Any]], Any]) -> None:
    """Register a callable handler for the given agent name."""
    _AGENT_HANDLERS[agent_name] = handler
    logger.debug("worker_handler_registered", extra={"agent": agent_name})


def _default_handler(task: Dict[str, Any]) -> Dict[str, Any]:
    """Fallback handler that acknowledges a task without executing it."""
    logger.info(
        "worker_default_handler",
        extra={"task_id": task.get("task_id"), "agent": task.get("agent")},
    )
    return {"status": "acknowledged", "task_id": task.get("task_id")}


class WorkerNode:
    """
    A single worker that pulls tasks from a queue and executes them.

    Supports graceful shutdown and is safe to run in a background thread.
    """

    def __init__(
        self,
        worker_id: Optional[str] = None,
        queue: Optional[RedisQueue] = None,
        retry_policy: Optional[RetryPolicy] = None,
        poll_interval: float = 1.0,
    ):
        self.worker_id = worker_id or str(uuid.uuid4())[:8]
        self._queue = queue or get_default_queue()
        self._retry_policy = retry_policy or default_retry_policy
        self._poll_interval = poll_interval
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._state_store = get_task_state_store()

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        """Start the worker in a background thread."""
        self._running = True
        self._thread = threading.Thread(
            target=self._run_loop,
            name=f"worker-{self.worker_id}",
            daemon=True,
        )
        self._thread.start()
        logger.info("worker_node_started", extra={"worker_id": self.worker_id})

    def stop(self) -> None:
        """Signal the worker to stop after the current task finishes."""
        self._running = False
        logger.info("worker_node_stopping", extra={"worker_id": self.worker_id})

    def is_alive(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    # ------------------------------------------------------------------
    # Processing
    # ------------------------------------------------------------------

    def _run_loop(self) -> None:
        while self._running:
            task = self._queue.dequeue(timeout=int(self._poll_interval))
            if task:
                self._process_task(task)
            else:
                time.sleep(self._poll_interval)

    def _process_task(self, task: Dict[str, Any]) -> None:
        task_id = task.get("task_id", "unknown")
        agent = task.get("agent", "planner")
        handler = _AGENT_HANDLERS.get(agent, _default_handler)

        self._state_store.update(
            task_id,
            {
                "status": TaskStatus.RUNNING.value,
                "started_at": datetime.now(timezone.utc).isoformat(),
                "worker_id": self.worker_id,
            },
        )

        try:
            result = handler(task)
            self._state_store.update(
                task_id,
                {
                    "status": TaskStatus.COMPLETED.value,
                    "result": result,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                },
            )
            logger.info(
                "worker_task_completed",
                extra={"task_id": task_id, "worker_id": self.worker_id},
            )

        except Exception as exc:
            retries = task.get("retries", 0)
            if self._retry_policy.should_retry(retries + 1, exc):
                task["retries"] = retries + 1
                delay = self._retry_policy.delay_for_attempt(task["retries"])
                task["retry_after_seconds"] = delay
                self._queue.enqueue(task)
                self._state_store.update(
                    task_id,
                    {"status": TaskStatus.RETRYING.value, "retries": task["retries"]},
                )
                logger.warning(
                    "worker_task_retrying",
                    extra={
                        "task_id": task_id,
                        "retries": task["retries"],
                        "delay_seconds": delay,
                    },
                )
            else:
                self._state_store.update(
                    task_id,
                    {
                        "status": TaskStatus.FAILED.value,
                        "error": str(exc),
                        "completed_at": datetime.now(timezone.utc).isoformat(),
                    },
                )
                logger.error(
                    "worker_task_failed",
                    extra={"task_id": task_id, "error": str(exc)},
                    exc_info=exc,
                )
