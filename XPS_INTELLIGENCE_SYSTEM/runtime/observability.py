"""
runtime/observability.py
=========================
Lightweight observability layer for the XPS Intelligence Platform.

Provides:
  - In-process metrics (counters, histograms, gauges)
  - Structured agent-level event tracing
  - System health endpoint data
  - Log aggregation helpers

All metrics are in-memory (no external dependency required).  For
production, export to Prometheus or OpenTelemetry by replacing the
``_METRICS`` backend below.

Usage::

    from runtime.observability import record_command, record_error, record_latency
    from runtime.observability import get_metrics, get_trace, health_snapshot

    record_command("scraper", "scrape")
    record_latency("scraper", 1.23)
    snap = health_snapshot()
"""

from __future__ import annotations

import collections
import logging
import os
import threading
import time
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Thread-safe in-process metrics store
# ---------------------------------------------------------------------------

_LOCK = threading.Lock()

_METRICS: dict[str, Any] = {
    # Command counters: {agent_type: {task_type: count}}
    "commands": collections.defaultdict(lambda: collections.defaultdict(int)),
    # Error counters: {error_class: {agent_type: count}}
    "errors": collections.defaultdict(lambda: collections.defaultdict(int)),
    # Latency histogram buckets (seconds): {agent_type: [float, ...]}
    "latency": collections.defaultdict(list),
    # Agent health pings: {agent_name: {"last_seen": float, "status": str}}
    "agents": {},
    # Trace ring buffer (last N events)
    "traces": collections.deque(maxlen=1000),
    # System start time
    "start_time": time.time(),
    # Total tasks processed
    "tasks_total": 0,
    # Total tasks failed
    "tasks_failed": 0,
}


# ---------------------------------------------------------------------------
# Write helpers
# ---------------------------------------------------------------------------


def record_command(agent_type: str, task_type: str) -> None:
    """Increment command counter for *agent_type* / *task_type*."""
    with _LOCK:
        _METRICS["commands"][agent_type][task_type] += 1
        _METRICS["tasks_total"] += 1
    _add_trace("command", {"agent": agent_type, "task_type": task_type})


def record_error(error: str, agent_type: str = "unknown") -> None:
    """Increment error counter."""
    error_class = error[:64] if isinstance(error, str) else type(error).__name__
    with _LOCK:
        _METRICS["errors"][error_class][agent_type] += 1
        _METRICS["tasks_failed"] += 1
    _add_trace("error", {"agent": agent_type, "error": error_class})


def record_latency(agent_type: str, seconds: float) -> None:
    """Record a latency sample for *agent_type*."""
    with _LOCK:
        bucket = _METRICS["latency"][agent_type]
        bucket.append(seconds)
        # Keep last 500 samples per agent
        if len(bucket) > 500:
            _METRICS["latency"][agent_type] = bucket[-500:]


def record_agent_health(agent_name: str, status: str = "ok", **extra: Any) -> None:
    """Update the last-seen health record for *agent_name*."""
    with _LOCK:
        _METRICS["agents"][agent_name] = {
            "last_seen": time.time(),
            "status": status,
            **extra,
        }


def _add_trace(event_type: str, data: dict[str, Any]) -> None:
    with _LOCK:
        _METRICS["traces"].append(
            {
                "ts": time.time(),
                "type": event_type,
                **data,
            }
        )


def reset_metrics() -> None:
    """Reset all metrics to zero (useful for test isolation)."""
    with _LOCK:
        _METRICS["commands"] = collections.defaultdict(lambda: collections.defaultdict(int))
        _METRICS["errors"] = collections.defaultdict(lambda: collections.defaultdict(int))
        _METRICS["latency"] = collections.defaultdict(list)
        _METRICS["agents"] = {}
        _METRICS["traces"] = collections.deque(maxlen=1000)
        _METRICS["tasks_total"] = 0
        _METRICS["tasks_failed"] = 0
        _METRICS["start_time"] = time.time()# ---------------------------------------------------------------------------
# Read helpers
# ---------------------------------------------------------------------------


def get_metrics() -> dict[str, Any]:
    """Return a serialisable snapshot of all metrics."""
    with _LOCK:
        commands = {k: dict(v) for k, v in _METRICS["commands"].items()}
        errors = {k: dict(v) for k, v in _METRICS["errors"].items()}
        latency: dict[str, Any] = {}
        for agent, samples in _METRICS["latency"].items():
            if samples:
                latency[agent] = {
                    "count": len(samples),
                    "mean": round(sum(samples) / len(samples), 4),
                    "p95": round(_percentile(sorted(samples), 95), 4),
                    "max": round(max(samples), 4),
                }
        agents = dict(_METRICS["agents"])
        return {
            "uptime_seconds": round(time.time() - _METRICS["start_time"], 1),
            "tasks_total": _METRICS["tasks_total"],
            "tasks_failed": _METRICS["tasks_failed"],
            "commands": commands,
            "errors": errors,
            "latency": latency,
            "agents": agents,
        }


def get_trace(limit: int = 100) -> list[dict[str, Any]]:
    """Return the *limit* most recent trace events (newest first)."""
    with _LOCK:
        events = list(_METRICS["traces"])
    return list(reversed(events[-limit:]))


def health_snapshot() -> dict[str, Any]:
    """Return a condensed health snapshot suitable for a /health endpoint."""
    m = get_metrics()
    agents_ok = [a for a, v in m["agents"].items() if v.get("status") == "ok"]
    agents_down = [a for a, v in m["agents"].items() if v.get("status") != "ok"]
    status = "degraded" if agents_down else "ok"
    return {
        "status": status,
        "uptime_seconds": m["uptime_seconds"],
        "tasks_total": m["tasks_total"],
        "tasks_failed": m["tasks_failed"],
        "agents_healthy": agents_ok,
        "agents_degraded": agents_down,
    }


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------


def _percentile(sorted_samples: list[float], pct: int) -> float:
    if not sorted_samples:
        return 0.0
    idx = max(0, int(len(sorted_samples) * pct / 100) - 1)
    return sorted_samples[idx]
