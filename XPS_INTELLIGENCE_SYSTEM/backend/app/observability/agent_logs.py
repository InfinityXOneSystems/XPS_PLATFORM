"""
app/observability/agent_logs.py
================================
Structured agent activity logging.
"""

from __future__ import annotations

import logging
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_logs: List[Dict[str, Any]] = []
_MAX_LOG_ENTRIES = 5000


def record(
    agent: str,
    task_id: str,
    event: str,
    level: str = "info",
    details: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Record an agent activity log entry.

    :param agent:   Agent name (e.g. "scraper", "code").
    :param task_id: Associated task ID.
    :param event:   Short event name (e.g. "task_started").
    :param level:   Log level string.
    :param details: Optional extra data.
    """
    entry: Dict[str, Any] = {
        "agent": agent,
        "task_id": task_id,
        "event": event,
        "level": level,
        "details": details or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    with _lock:
        _logs.append(entry)
        if len(_logs) > _MAX_LOG_ENTRIES:
            _logs.pop(0)

    getattr(logger, level, logger.info)(
        "%s | %s | %s",
        agent,
        task_id,
        event,
        extra=details or {},
    )


def get_logs(
    agent: Optional[str] = None,
    task_id: Optional[str] = None,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    """Return recent log entries, optionally filtered."""
    with _lock:
        entries = list(_logs)

    if agent:
        entries = [e for e in entries if e["agent"] == agent]
    if task_id:
        entries = [e for e in entries if e["task_id"] == task_id]

    return entries[-limit:]


def clear_logs() -> None:
    """Clear all in-memory log entries (used in testing)."""
    with _lock:
        _logs.clear()
