"""
system_guardian/watchdog_agent.py
====================================
Watchdog Agent — monitors for anomalies and triggers automated repairs.

Operates on health metrics produced by
:class:`~system_guardian.health_monitor.HealthMonitor` and attempts to
self-heal where possible (e.g. recreating missing data files with safe
default content).
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

_REPO_ROOT = Path(__file__).resolve().parents[1]


class WatchdogAgent:
    """Monitors for anomalies in system health metrics and triggers repairs."""

    def __init__(self) -> None:
        self._issues: List[dict] = []

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def watch(self) -> List[dict]:
        """Run a full watch cycle and return a list of issues found.

        Each issue has: ``type``, ``severity``, ``detail``, ``repaired``.
        """
        from system_guardian.health_monitor import HealthMonitor

        health = HealthMonitor().check_all()
        issues = self.detect_anomalies(health)
        self._issues = issues

        for issue in issues:
            repaired = self.trigger_repair(issue)
            issue["repaired"] = repaired

        logger.info("watchdog_cycle_complete issues=%s", len(issues))
        return issues

    def detect_anomalies(self, metrics: dict) -> List[dict]:
        """Analyse *metrics* and return a list of anomaly dicts."""
        anomalies: List[dict] = []

        # --- Data integrity anomalies ------------------------------------
        for alias, status in metrics.get("data_integrity", {}).items():
            if not status.get("exists"):
                anomalies.append(
                    {
                        "type": "missing_data_file",
                        "severity": "high",
                        "detail": f"Data file '{alias}' not found at {status.get('path')}",
                        "meta": status,
                    }
                )
            elif not status.get("valid"):
                anomalies.append(
                    {
                        "type": "corrupt_data_file",
                        "severity": "critical",
                        "detail": f"Data file '{alias}' exists but is not valid JSON",
                        "meta": status,
                    }
                )

        # --- Agent file anomalies ----------------------------------------
        for alias, status in metrics.get("agents", {}).items():
            if not status.get("exists"):
                anomalies.append(
                    {
                        "type": "missing_agent",
                        "severity": "medium",
                        "detail": f"Agent file '{alias}' not found at {status.get('path')}",
                        "meta": status,
                    }
                )

        # --- System-level degradation ------------------------------------
        if metrics.get("status") == "degraded":
            anomalies.append(
                {
                    "type": "system_degraded",
                    "severity": "high",
                    "detail": "Overall system status is degraded",
                    "meta": {},
                }
            )

        logger.info("anomalies_detected count=%s", len(anomalies))
        return anomalies

    def trigger_repair(self, issue: dict) -> bool:
        """Attempt to repair *issue*. Returns True if repair succeeded."""
        issue_type = issue.get("type")

        try:
            if issue_type == "missing_data_file":
                return self._repair_missing_data_file(issue)
            # Other issue types are logged but not auto-repaired
            logger.info("no_auto_repair_available issue_type=%s", issue_type)
            return False
        except Exception as exc:
            logger.error("repair_failed issue_type=%s error=%s", issue_type, exc)
            return False

    # ------------------------------------------------------------------
    # Repair handlers
    # ------------------------------------------------------------------

    @staticmethod
    def _repair_missing_data_file(issue: dict) -> bool:
        """Create an empty leads file so downstream components don't crash."""
        path_str = issue.get("meta", {}).get("path")
        if not path_str:
            return False

        path = Path(path_str)
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            if not path.exists():
                path.write_text(json.dumps([], indent=2))
                logger.info("data_file_recreated path=%s", path)
            return True
        except OSError as exc:
            logger.error("data_file_repair_failed path=%s error=%s", path, exc)
            return False
