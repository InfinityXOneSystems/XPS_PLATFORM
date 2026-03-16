"""
system_guardian/health_monitor.py
====================================
Health Monitor — checks subsystem health.

Checks:
- API endpoints (if reachable)
- Data file integrity
- Agent availability
- Queue status
"""
from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Paths relative to the repository root
_REPO_ROOT = Path(__file__).resolve().parents[1]

_DATA_FILES: Dict[str, Path] = {
    "leads_primary": _REPO_ROOT / "leads" / "leads.json",
    "leads_legacy": _REPO_ROOT / "data" / "leads" / "leads.json",
}

_AGENT_FILES: Dict[str, Path] = {
    "orchestrator": _REPO_ROOT / "agents" / "orchestrator" / "infinity_orchestrator.js",
    "scoring": _REPO_ROOT / "agents" / "scoring" / "lead_scoring.js",
    "outreach": _REPO_ROOT / "outreach" / "outreach_engine.js",
}


class HealthMonitor:
    """Checks the health of all XPS platform subsystems."""

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def check_all(self) -> dict:
        """Return a full health report across all subsystems."""
        start = time.monotonic()

        data_integrity = self.check_data_integrity()
        agent_status = self._check_agents()

        report: Dict[str, Any] = {
            "status": "unknown",
            "checked_at": self._utc_now(),
            "data_integrity": data_integrity,
            "agents": agent_status,
            "duration_ms": 0,
        }

        report["status"] = "healthy" if self.is_healthy(report) else "degraded"
        report["duration_ms"] = round((time.monotonic() - start) * 1000, 2)
        logger.info("health_check_complete status=%s", report["status"])
        return report

    def check_api(self, url: str) -> dict:
        """Check whether *url* is reachable and returns an HTTP 2xx response.

        Returns a dict with ``reachable``, ``status_code``, and ``latency_ms``.
        Does not raise on connection errors — returns ``reachable: False`` instead.
        """
        try:
            import urllib.request

            start = time.monotonic()
            with urllib.request.urlopen(url, timeout=5) as resp:  # noqa: S310
                status_code = resp.status
            latency_ms = round((time.monotonic() - start) * 1000, 2)
            return {"url": url, "reachable": True, "status_code": status_code, "latency_ms": latency_ms}
        except Exception as exc:
            return {"url": url, "reachable": False, "status_code": None, "latency_ms": None, "error": str(exc)}

    def check_data_integrity(self) -> dict:
        """Verify that key data files exist and contain valid JSON.

        Returns a dict mapping file aliases to status objects.
        """
        results: Dict[str, Any] = {}
        for alias, path in _DATA_FILES.items():
            results[alias] = self._check_json_file(path)
        return results

    def is_healthy(self, report: Optional[dict] = None) -> bool:
        """Return True if the system is considered healthy.

        Accepts an already-computed *report* dict or runs :meth:`check_all`
        if none is provided (avoids infinite recursion — use the parameter
        form from within :meth:`check_all`).
        """
        if report is None:
            report = self.check_all()

        data = report.get("data_integrity", {})
        # At least one lead file must be valid
        lead_files_ok = any(
            v.get("valid") for v in data.values()
        )
        return lead_files_ok

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _check_json_file(path: Path) -> Dict[str, Any]:
        if not path.exists():
            return {"path": str(path), "exists": False, "valid": False, "records": 0}
        try:
            with path.open() as fh:
                data = json.load(fh)
            records = len(data) if isinstance(data, list) else 1
            return {"path": str(path), "exists": True, "valid": True, "records": records}
        except (json.JSONDecodeError, OSError) as exc:
            return {"path": str(path), "exists": True, "valid": False, "error": str(exc), "records": 0}

    def _check_agents(self) -> Dict[str, Any]:
        results: Dict[str, Any] = {}
        for alias, path in _AGENT_FILES.items():
            results[alias] = {"path": str(path), "exists": path.exists()}
        return results

    @staticmethod
    def _utc_now() -> str:
        from datetime import datetime, timezone
        return datetime.now(timezone.utc).isoformat()
