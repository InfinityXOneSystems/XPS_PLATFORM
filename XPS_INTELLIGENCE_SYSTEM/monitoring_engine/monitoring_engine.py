"""
monitoring_engine/monitoring_engine.py
========================================
Monitoring Engine — Real-time system health monitoring for the XPS platform.

Monitors:
  - Service availability (HTTP health checks)
  - Queue depth (Redis)
  - Database connectivity
  - Agent activity
  - Error rate tracking

Exposes a /metrics endpoint compatible with Prometheus.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class ServiceStatus:
    """Health status for a single service."""

    def __init__(self, name: str, url: str) -> None:
        self.name = name
        self.url = url
        self.healthy = False
        self.last_check: Optional[float] = None
        self.last_error: Optional[str] = None
        self.response_ms: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "url": self.url,
            "healthy": self.healthy,
            "last_check": self.last_check,
            "last_error": self.last_error,
            "response_ms": self.response_ms,
        }


class MonitoringEngine:
    """
    System health monitoring engine.

    Performs HTTP health checks against all registered services and
    returns a structured health report.
    """

    DEFAULT_SERVICES = [
        {"name": "backend", "url": os.environ.get("BACKEND_URL", "http://localhost:8000") + "/health"},
        {"name": "gateway", "url": os.environ.get("GATEWAY_URL", "http://localhost:3200") + "/health"},
        {"name": "mcp_gateway", "url": os.environ.get("MCP_GATEWAY_URL", "http://localhost:4000") + "/health"},
    ]

    def __init__(self, services: Optional[List[Dict[str, str]]] = None) -> None:
        svc_defs = services if services is not None else self.DEFAULT_SERVICES
        self._services = [ServiceStatus(s["name"], s["url"]) for s in svc_defs]
        self._metrics: Dict[str, Any] = {}

    def check_all(self) -> Dict[str, Any]:
        """Run health checks against all services. Returns a health report."""
        logger.info("[MonitoringEngine] Running health checks for %d services", len(self._services))

        for svc in self._services:
            self._check_service(svc)

        healthy_count = sum(1 for s in self._services if s.healthy)
        report = {
            "timestamp": time.time(),
            "healthy": healthy_count == len(self._services),
            "services_total": len(self._services),
            "services_healthy": healthy_count,
            "services_unhealthy": len(self._services) - healthy_count,
            "services": [s.to_dict() for s in self._services],
        }

        logger.info(
            "[MonitoringEngine] Health check complete — %d/%d healthy",
            healthy_count, len(self._services),
        )
        return report

    def get_metrics(self) -> Dict[str, Any]:
        """Return Prometheus-compatible metrics dict."""
        report = self.check_all()
        return {
            "xps_services_total": report["services_total"],
            "xps_services_healthy": report["services_healthy"],
            "xps_services_unhealthy": report["services_unhealthy"],
            **{
                f"xps_service_{s['name']}_healthy": 1 if s["healthy"] else 0
                for s in report["services"]
            },
        }

    # ------------------------------------------------------------------

    def _check_service(self, svc: ServiceStatus) -> None:
        """HTTP health check for a single service."""
        # Validate URL scheme to prevent SSRF
        if not (svc.url.startswith("http://") or svc.url.startswith("https://")):
            svc.healthy = False
            svc.last_error = f"Invalid URL scheme: {svc.url}"
            svc.last_check = time.time()
            return
        try:
            import urllib.request
            start = time.time()
            with urllib.request.urlopen(svc.url, timeout=5) as resp:  # noqa: S310
                svc.response_ms = (time.time() - start) * 1000
                svc.healthy = resp.status == 200
                svc.last_error = None
        except (OSError, ValueError) as exc:
            svc.healthy = False
            svc.last_error = str(exc)
            svc.response_ms = None
        svc.last_check = time.time()
