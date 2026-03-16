"""
app/queue/queue_manager.py
===========================
Manages multiple named queues and distributes tasks to workers.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from app.queue.redis_queue import RedisQueue

logger = logging.getLogger(__name__)


class QueueManager:
    """
    Central registry for named task queues.

    Usage::

        manager = QueueManager()
        manager.enqueue("scraper", task_dict)
        task = manager.dequeue("scraper")
    """

    def __init__(self):
        self._queues: Dict[str, RedisQueue] = {}

    def _get_or_create(self, name: str) -> RedisQueue:
        if name not in self._queues:
            self._queues[name] = RedisQueue(queue_name=f"xps:{name}")
        return self._queues[name]

    def enqueue(self, queue_name: str, task: Dict[str, Any]) -> str:
        """Enqueue a task on the named queue; returns task_id."""
        q = self._get_or_create(queue_name)
        task_id = q.enqueue(task)
        logger.debug(
            "queue_manager_enqueued",
            extra={"queue": queue_name, "task_id": task_id},
        )
        return task_id

    def dequeue(self, queue_name: str, timeout: int = 5) -> Optional[Dict[str, Any]]:
        """Pop and return the next task from the named queue."""
        q = self._get_or_create(queue_name)
        return q.dequeue(timeout=timeout)

    def queue_sizes(self) -> Dict[str, int]:
        """Return a dict of {queue_name: size} for all registered queues."""
        return {name: q.size() for name, q in self._queues.items()}

    def total_queued(self) -> int:
        """Return the sum of all queue sizes."""
        return sum(self.queue_sizes().values())

    def clear_all(self) -> None:
        """Clear all queues (used in testing)."""
        for q in self._queues.values():
            q.clear()


# Shared singleton
_manager = QueueManager()


def get_queue_manager() -> QueueManager:
    """Return the shared QueueManager instance."""
    return _manager
