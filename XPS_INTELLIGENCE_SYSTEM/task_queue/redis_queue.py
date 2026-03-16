"""
queue/redis_queue.py
====================
Redis-backed task queue for the XPS Intelligence Platform.

Architecture::

    Planner Agent
         ↓
    Redis Queue   (list-based LPUSH / BRPOP)
         ↓
    Worker Agents

Features:
  - FIFO queue with LPUSH / BRPOP
  - Task serialisation (JSON)
  - Dead-letter queue for failed tasks
  - Task status tracking (hash per task)
  - Graceful fallback when Redis is unavailable (in-process deque)

Environment variables:
  REDIS_URL  – full redis:// URL  (default: redis://localhost:6379/0)
"""

from __future__ import annotations

import json
import logging
import os
import time
import uuid
from collections import deque
from typing import Any

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

QUEUE_KEY = "xps:task_queue"
DEAD_LETTER_KEY = "xps:task_dlq"
STATUS_PREFIX = "xps:task:"


# ---------------------------------------------------------------------------
# Redis connection (optional dependency)
# ---------------------------------------------------------------------------


def _get_redis():
    """Return a Redis client or None if redis-py is unavailable."""
    try:
        import redis  # type: ignore

        client = redis.from_url(REDIS_URL, socket_timeout=5, socket_connect_timeout=5)
        client.ping()
        return client
    except Exception as exc:
        logger.debug("Redis unavailable (%s) – using in-process fallback", exc)
        return None


# ---------------------------------------------------------------------------
# In-process fallback queue (no Redis required)
# ---------------------------------------------------------------------------

_IN_PROCESS_QUEUE: deque[str] = deque()
_IN_PROCESS_DLQ: deque[str] = deque()
_IN_PROCESS_STATUS: dict[str, dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


class TaskQueue:
    """
    Thin wrapper around Redis (or in-process fallback) for task queuing.

    Usage::

        q = TaskQueue()
        task_id = q.enqueue({"command": "scrape epoxy orlando", "priority": 1})
        task = q.dequeue(timeout=5)
    """

    def __init__(self) -> None:
        self._redis = _get_redis()
        if self._redis:
            logger.info("TaskQueue: using Redis at %s", REDIS_URL)
        else:
            logger.info("TaskQueue: Redis unavailable – using in-process fallback")

    # ------------------------------------------------------------------
    # Enqueue
    # ------------------------------------------------------------------

    def enqueue(self, payload: dict[str, Any], *, queue: str = QUEUE_KEY) -> str:
        """
        Push *payload* onto the queue.

        :returns: Unique task_id string.
        """
        task_id = str(uuid.uuid4())
        task = {
            "task_id": task_id,
            "status": "queued",
            "enqueued_at": time.time(),
            "payload": payload,
        }
        raw = json.dumps(task)

        if self._redis:
            try:
                self._redis.lpush(queue, raw)
                self._redis.hset(
                    f"{STATUS_PREFIX}{task_id}",
                    mapping={"status": "queued", "enqueued_at": str(time.time())},
                )
                self._redis.expire(f"{STATUS_PREFIX}{task_id}", 86400)
                logger.debug("Enqueued task %s to Redis", task_id)
                return task_id
            except Exception as exc:
                logger.warning("Redis enqueue failed (%s) – falling back", exc)

        _IN_PROCESS_QUEUE.appendleft(raw)
        _IN_PROCESS_STATUS[task_id] = task
        logger.debug("Enqueued task %s to in-process queue", task_id)
        return task_id

    # ------------------------------------------------------------------
    # Dequeue
    # ------------------------------------------------------------------

    def dequeue(self, timeout: int = 5, queue: str = QUEUE_KEY) -> dict[str, Any] | None:
        """
        Block-pop one task from the queue.

        :param timeout: Seconds to wait for a task (0 = non-blocking).
        :returns: Task dict or None if the queue is empty.
        """
        if self._redis:
            try:
                result = self._redis.brpop(queue, timeout=timeout)
                if result:
                    _, raw = result
                    return json.loads(raw)
                return None
            except Exception as exc:
                logger.warning("Redis dequeue failed (%s) – falling back", exc)

        if _IN_PROCESS_QUEUE:
            raw = _IN_PROCESS_QUEUE.pop()
            return json.loads(raw)
        return None

    # ------------------------------------------------------------------
    # Status
    # ------------------------------------------------------------------

    def update_status(self, task_id: str, status: str, **extra: Any) -> None:
        """Update the status of a task."""
        update: dict[str, Any] = {"status": status, "updated_at": str(time.time()), **extra}
        if self._redis:
            try:
                self._redis.hset(f"{STATUS_PREFIX}{task_id}", mapping={k: str(v) for k, v in update.items()})
                return
            except Exception as exc:
                logger.debug("Redis status update failed: %s", exc)
        if task_id in _IN_PROCESS_STATUS:
            _IN_PROCESS_STATUS[task_id].update(update)

    def get_status(self, task_id: str) -> dict[str, Any] | None:
        """Return the status dict for *task_id*, or None."""
        if self._redis:
            try:
                data = self._redis.hgetall(f"{STATUS_PREFIX}{task_id}")
                if data:
                    return {k.decode(): v.decode() for k, v in data.items()}
            except Exception:
                pass
        return _IN_PROCESS_STATUS.get(task_id)

    # ------------------------------------------------------------------
    # Dead-letter
    # ------------------------------------------------------------------

    def nack(self, task: dict[str, Any], error: str) -> None:
        """Move a failed task to the dead-letter queue."""
        task["error"] = error
        task["failed_at"] = time.time()
        raw = json.dumps(task)
        if self._redis:
            try:
                self._redis.lpush(DEAD_LETTER_KEY, raw)
                return
            except Exception:
                pass
        _IN_PROCESS_DLQ.appendleft(raw)

    # ------------------------------------------------------------------
    # Queue length
    # ------------------------------------------------------------------

    def queue_length(self, queue: str = QUEUE_KEY) -> int:
        """Return current queue length."""
        if self._redis:
            try:
                return int(self._redis.llen(queue))
            except Exception:
                pass
        return len(_IN_PROCESS_QUEUE)

    def dlq_length(self) -> int:
        """Return dead-letter queue length."""
        if self._redis:
            try:
                return int(self._redis.llen(DEAD_LETTER_KEY))
            except Exception:
                pass
        return len(_IN_PROCESS_DLQ)

    # ------------------------------------------------------------------
    # Health
    # ------------------------------------------------------------------

    def health(self) -> dict[str, Any]:
        """Return health information for the queue system."""
        redis_ok = False
        if self._redis:
            try:
                self._redis.ping()
                redis_ok = True
            except Exception:
                pass
        return {
            "redis_connected": redis_ok,
            "queue_length": self.queue_length(),
            "dlq_length": self.dlq_length(),
            "backend": "redis" if redis_ok else "in-process",
        }
