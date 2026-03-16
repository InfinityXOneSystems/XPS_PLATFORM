"""
app/observability/metrics.py
==============================
Lightweight metrics collection for the runtime pipeline.
"""

from __future__ import annotations

import threading
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict

_lock = threading.Lock()

_counters: Dict[str, int] = defaultdict(int)
_gauges: Dict[str, float] = {}
_histograms: Dict[str, list] = defaultdict(list)


def increment(name: str, value: int = 1) -> None:
    """Increment a named counter."""
    with _lock:
        _counters[name] += value


def gauge(name: str, value: float) -> None:
    """Set a named gauge to an absolute value."""
    with _lock:
        _gauges[name] = value


def observe(name: str, value: float) -> None:
    """Record an observation in a named histogram."""
    with _lock:
        _histograms[name].append(value)


def get_all() -> Dict[str, Any]:
    """Return a snapshot of all metrics."""
    with _lock:
        hist_summary = {
            name: {
                "count": len(vals),
                "sum": sum(vals),
                "avg": sum(vals) / len(vals) if vals else 0.0,
                "min": min(vals) if vals else 0.0,
                "max": max(vals) if vals else 0.0,
            }
            for name, vals in _histograms.items()
        }
        return {
            "counters": dict(_counters),
            "gauges": dict(_gauges),
            "histograms": hist_summary,
            "collected_at": datetime.now(timezone.utc).isoformat(),
        }


def reset() -> None:
    """Reset all metrics (used in testing)."""
    with _lock:
        _counters.clear()
        _gauges.clear()
        _histograms.clear()
