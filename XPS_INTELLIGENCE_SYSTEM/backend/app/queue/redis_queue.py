"""
app/queue/redis_queue.py
=========================
Redis-backed task queue with in-memory fallback for testing environments.
"""

from __future__ import annotations

import json
import logging
import os
import queue
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_FALLBACK_QUEUE: queue.Queue = queue.Queue()


def _redis_client():
    try:
        import redis

        url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        client = redis.from_url(url, socket_connect_timeout=1, socket_timeout=1)
        client.ping()
        return client
    except Exception:
        return None


_REDIS = None
_REDIS_CHECKED = False


def _get_redis():
    global _REDIS, _REDIS_CHECKED
    if not _REDIS_CHECKED:
        _REDIS = _redis_client()
        _REDIS_CHECKED = True
    return _REDIS


_QUEUE_NAME = "xps:tasks"


class RedisQueue:
    """
    FIFO task queue backed by Redis LPUSH/BRPOP.
    Falls back to an in-memory queue when Redis is unavailable.
    """

    def __init__(self, queue_name: str = _QUEUE_NAME):
        self.queue_name = queue_name

    def enqueue(self, task: Dict[str, Any]) -> str:
        """Add a task to the queue; returns task_id."""
        task.setdefault("enqueued_at", datetime.now(timezone.utc).isoformat())
        task_id: str = task.get("task_id", "")
        payload = json.dumps(task)

        r = _get_redis()
        if r:
            try:
                r.lpush(self.queue_name, payload)
                logger.debug("redis_queue_enqueued", extra={"task_id": task_id})
                return task_id
            except Exception as exc:
                logger.warning("redis_queue_enqueue_failed", extra={"error": str(exc)})

        _FALLBACK_QUEUE.put(task)
        logger.debug("fallback_queue_enqueued", extra={"task_id": task_id})
        return task_id

    def dequeue(self, timeout: int = 5) -> Optional[Dict[str, Any]]:
        """Pop and return the next task; returns None on timeout."""
        r = _get_redis()
        if r:
            try:
                result = r.brpop(self.queue_name, timeout=timeout)
                if result:
                    _, raw = result
                    return json.loads(raw)
                return None
            except Exception as exc:
                logger.warning("redis_queue_dequeue_failed", extra={"error": str(exc)})

        try:
            return _FALLBACK_QUEUE.get(timeout=timeout)
        except queue.Empty:
            return None

    def size(self) -> int:
        """Return approximate queue size."""
        r = _get_redis()
        if r:
            try:
                return r.llen(self.queue_name)
            except Exception:
                pass
        return _FALLBACK_QUEUE.qsize()

    def peek(self, count: int = 10) -> List[Dict[str, Any]]:
        """Peek at the next *count* tasks without removing them (best-effort)."""
        r = _get_redis()
        if r:
            try:
                items = r.lrange(self.queue_name, -count, -1)
                return [json.loads(item) for item in items]
            except Exception:
                pass
        items_list = list(_FALLBACK_QUEUE.queue)
        return items_list[-count:]

    def clear(self) -> None:
        """Remove all tasks from the queue."""
        r = _get_redis()
        if r:
            try:
                r.delete(self.queue_name)
            except Exception:
                pass
        while not _FALLBACK_QUEUE.empty():
            try:
                _FALLBACK_QUEUE.get_nowait()
            except queue.Empty:
                break


# Shared default queue instance
_default_queue = RedisQueue()


def get_default_queue() -> RedisQueue:
    """Return the shared default RedisQueue instance."""
    return _default_queue
