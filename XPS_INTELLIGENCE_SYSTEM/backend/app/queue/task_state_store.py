"""
app/queue/task_state_store.py
==============================
Stores and retrieves task state.  Uses Redis when available and falls back
to an in-process dictionary so tests can run without a live Redis instance.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory fallback store
# ---------------------------------------------------------------------------
_IN_MEMORY: Dict[str, Dict[str, Any]] = {}


def _redis_client():
    """Return a Redis client or None if Redis is unavailable."""
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


_TTL_SECONDS = 86400  # 24 h


class TaskStateStore:
    """Thin wrapper around Redis (or in-memory) for task state persistence."""

    def __init__(self, prefix: str = "xps:task:"):
        self.prefix = prefix

    def _key(self, task_id: str) -> str:
        return f"{self.prefix}{task_id}"

    def save(self, task_id: str, state: Dict[str, Any]) -> None:
        """Persist task state."""
        r = _get_redis()
        if r:
            try:
                r.set(self._key(task_id), json.dumps(state), ex=_TTL_SECONDS)
                return
            except Exception as exc:
                logger.warning(
                    "task_state_store_redis_write_failed", extra={"error": str(exc)}
                )
        _IN_MEMORY[task_id] = state

    def get(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve task state; returns None if not found."""
        r = _get_redis()
        if r:
            try:
                raw = r.get(self._key(task_id))
                if raw:
                    return json.loads(raw)
            except Exception as exc:
                logger.warning(
                    "task_state_store_redis_read_failed", extra={"error": str(exc)}
                )
        return _IN_MEMORY.get(task_id)

    def update(self, task_id: str, updates: Dict[str, Any]) -> None:
        """Merge *updates* into an existing task state."""
        state = self.get(task_id) or {}
        state.update(updates)
        state["updated_at"] = datetime.now(timezone.utc).isoformat()
        self.save(task_id, state)

    def list_all(self) -> Dict[str, Dict[str, Any]]:
        """Return all known task states (in-memory only — for dev/debug)."""
        r = _get_redis()
        if r:
            try:
                keys = r.keys(f"{self.prefix}*")
                result = {}
                for key in keys:
                    raw = r.get(key)
                    if raw:
                        task_id = key.decode()[len(self.prefix) :]
                        result[task_id] = json.loads(raw)
                return result
            except Exception as exc:
                logger.warning(
                    "task_state_store_list_failed", extra={"error": str(exc)}
                )
        return dict(_IN_MEMORY)

    def delete(self, task_id: str) -> None:
        """Remove a task from state store."""
        r = _get_redis()
        if r:
            try:
                r.delete(self._key(task_id))
            except Exception:
                pass
        _IN_MEMORY.pop(task_id, None)


# Module-level shared instance
_store = TaskStateStore()


def get_task_state_store() -> TaskStateStore:
    """Return the shared TaskStateStore instance."""
    return _store
