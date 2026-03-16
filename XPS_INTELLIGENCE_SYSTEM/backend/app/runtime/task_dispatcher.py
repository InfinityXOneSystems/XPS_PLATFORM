"""
app/runtime/task_dispatcher.py
================================
Dispatches validated commands to the appropriate queue and records their state.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict

from app.queue.queue_manager import get_queue_manager
from app.queue.task_state_store import get_task_state_store
from app.runtime.command_schema import CommandType, TaskStatus, generate_task_id
from app.runtime.error_manager import TaskDispatchError, log_error

logger = logging.getLogger(__name__)

# Map agent names → queue names
_AGENT_QUEUE_MAP: Dict[str, str] = {
    "scraper": "scraper",
    "code": "code",
    "builder": "builder",
    "github": "github",
    "supervisor": "default",
    "media": "media",
    "seo": "seo",
    "planner": "default",
    "prediction": "default",
    "simulation": "default",
    "outreach": "outreach",
}


class TaskDispatcher:
    """Enqueues a task and records its initial state."""

    def __init__(self):
        self._queue_manager = get_queue_manager()
        self._state_store = get_task_state_store()

    def dispatch(
        self,
        command: str,
        command_type: CommandType,
        agent: str,
        params: Dict[str, Any],
        priority: int = 5,
        timeout_seconds: int = 300,
    ) -> str:
        """
        Enqueue a command as a task.

        :returns: task_id string
        :raises:  TaskDispatchError on failure
        """
        task_id = generate_task_id()
        now = datetime.now(timezone.utc).isoformat()

        task: Dict[str, Any] = {
            "task_id": task_id,
            "command": command,
            "command_type": command_type.value,
            "agent": agent,
            "params": params,
            "priority": priority,
            "timeout_seconds": timeout_seconds,
            "status": TaskStatus.QUEUED.value,
            "created_at": now,
            "retries": 0,
            "logs": [],
        }

        queue_name = _AGENT_QUEUE_MAP.get(agent, "default")

        try:
            self._queue_manager.enqueue(queue_name, task)
        except Exception as exc:
            log_error(exc, {"task_id": task_id, "agent": agent})
            raise TaskDispatchError(
                f"Failed to enqueue task for agent {agent!r}: {exc}",
                task_id=task_id,
            ) from exc

        # Persist initial state
        self._state_store.save(task_id, task)

        logger.info(
            "task_dispatched",
            extra={
                "task_id": task_id,
                "agent": agent,
                "command_type": command_type.value,
                "queue": queue_name,
            },
        )
        return task_id


# Shared singleton
_dispatcher = TaskDispatcher()


def get_dispatcher() -> TaskDispatcher:
    """Return the shared TaskDispatcher instance."""
    return _dispatcher
