"""
app/observability/tracing.py
==============================
Request tracing for the runtime pipeline.
Provides a lightweight trace context without an external tracing backend.
"""

from __future__ import annotations

import threading
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Dict, Generator, List, Optional

_lock = threading.Lock()
_traces: List[Dict[str, Any]] = []
_MAX_TRACES = 1000

# Thread-local current trace ID
_local = threading.local()


def current_trace_id() -> Optional[str]:
    """Return the trace ID for the current thread, or None."""
    return getattr(_local, "trace_id", None)


@contextmanager
def trace(operation: str, **tags: Any) -> Generator[str, None, None]:
    """
    Context manager that records a trace span.

    Usage::

        with trace("runtime.command", command_type="scrape") as trace_id:
            ...
    """
    trace_id = str(uuid.uuid4())
    _local.trace_id = trace_id
    start = datetime.now(timezone.utc)
    span: Dict[str, Any] = {
        "trace_id": trace_id,
        "operation": operation,
        "tags": tags,
        "started_at": start.isoformat(),
        "completed_at": None,
        "duration_ms": None,
        "error": None,
    }
    try:
        yield trace_id
        end = datetime.now(timezone.utc)
        span["completed_at"] = end.isoformat()
        span["duration_ms"] = (end - start).total_seconds() * 1000
    except Exception as exc:
        span["error"] = str(exc)
        end = datetime.now(timezone.utc)
        span["completed_at"] = end.isoformat()
        span["duration_ms"] = (end - start).total_seconds() * 1000
        raise
    finally:
        _local.trace_id = None
        with _lock:
            _traces.append(span)
            if len(_traces) > _MAX_TRACES:
                _traces.pop(0)


def get_recent_traces(limit: int = 50) -> List[Dict[str, Any]]:
    """Return the most recent *limit* trace spans."""
    with _lock:
        return list(_traces[-limit:])


def clear_traces() -> None:
    """Clear all recorded traces (used in testing)."""
    with _lock:
        _traces.clear()
