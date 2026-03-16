"""
system_guardian/system_guardian.py
=====================================
System Guardian — top-level health and resilience controller.

Combines :class:`~system_guardian.health_monitor.HealthMonitor` and
:class:`~system_guardian.watchdog_agent.WatchdogAgent` into a single
callable that returns a comprehensive system status snapshot.

Usage::

    from system_guardian.system_guardian import get_system_status

    status = get_system_status()
    print(status["overall"])  # "healthy" | "degraded"
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


def get_system_status() -> dict:
    """Return a full system status snapshot.

    Runs health checks and anomaly detection, returning a unified dict with
    keys ``overall``, ``health``, ``issues``, ``repairs``, and ``checked_at``.
    """
    from system_guardian.health_monitor import HealthMonitor
    from system_guardian.watchdog_agent import WatchdogAgent

    status: Dict[str, Any] = {
        "overall": "unknown",
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "health": {},
        "issues": [],
        "repairs_attempted": 0,
        "repairs_succeeded": 0,
    }

    # --- Health check -----------------------------------------------------
    try:
        monitor = HealthMonitor()
        health = monitor.check_all()
        status["health"] = health
        status["overall"] = health.get("status", "unknown")
    except Exception as exc:
        logger.error("health_check_error: %s", exc)
        status["health"] = {"error": str(exc)}
        status["overall"] = "error"

    # --- Watchdog ---------------------------------------------------------
    try:
        watchdog = WatchdogAgent()
        issues = watchdog.detect_anomalies(status["health"])
        for issue in issues:
            repaired = watchdog.trigger_repair(issue)
            issue["repaired"] = repaired

        status["issues"] = issues
        status["repairs_attempted"] = len(issues)
        status["repairs_succeeded"] = sum(1 for i in issues if i.get("repaired"))
    except Exception as exc:
        logger.error("watchdog_error: %s", exc)
        status["issues"] = [{"type": "watchdog_error", "detail": str(exc), "severity": "high"}]

    logger.info("system_status_complete overall=%s issues=%s", status["overall"], len(status["issues"]))
    return status
