"""
self_healing_engine/self_healing_engine.py
===========================================
Self-Healing Engine — Automatic failure detection and recovery.

Capabilities:
  - Detect service failures via MonitoringEngine
  - Automatically restart failed services (via Docker or subprocess)
  - Run ValidationEngine on failure to diagnose root cause
  - Generate diagnostic reports
  - Escalate critical failures via logs / alerts

The self-healing loop runs continuously in the background.
"""

from __future__ import annotations

import logging
import os
import subprocess
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Service restart commands (extend for production)
_RESTART_COMMANDS: Dict[str, List[str]] = {
    "backend": ["docker", "compose", "restart", "backend"],
    "gateway": ["docker", "compose", "restart", "gateway"],
    "mcp_gateway": ["docker", "compose", "restart", "mcp-gateway"],
    "redis": ["docker", "compose", "restart", "redis"],
    "worker": ["docker", "compose", "restart", "agent-worker"],
}


class HealingAction:
    """A self-healing action performed by the engine."""

    def __init__(
        self,
        service: str,
        action: str,
        success: bool,
        message: str = "",
    ) -> None:
        self.service = service
        self.action = action
        self.success = success
        self.message = message
        self.timestamp = time.time()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "service": self.service,
            "action": self.action,
            "success": self.success,
            "message": self.message,
            "timestamp": self.timestamp,
        }


class SelfHealingEngine:
    """
    Automated self-healing engine.

    Monitors services, detects failures, and attempts automatic recovery.
    Generates diagnostic reports on persistent failures.
    """

    def __init__(
        self,
        max_restart_attempts: int = 3,
        restart_cooldown_s: float = 60.0,
        dry_run: bool = False,
    ) -> None:
        self.max_restart_attempts = max_restart_attempts
        self.restart_cooldown_s = restart_cooldown_s
        self.dry_run = dry_run
        self._restart_counts: Dict[str, int] = {}
        self._last_restart: Dict[str, float] = {}
        self._actions: List[HealingAction] = []

    def heal(self, health_report: Dict[str, Any]) -> List[HealingAction]:
        """
        Process a health report and attempt to heal unhealthy services.

        Returns a list of healing actions taken.
        """
        actions: List[HealingAction] = []
        unhealthy = [
            s for s in health_report.get("services", []) if not s.get("healthy")
        ]

        if not unhealthy:
            logger.info("[SelfHealingEngine] All services healthy — no action needed")
            return actions

        logger.warning(
            "[SelfHealingEngine] %d unhealthy services detected", len(unhealthy)
        )

        for svc in unhealthy:
            action = self._heal_service(svc["name"])
            if action:
                actions.append(action)
                self._actions.append(action)

        return actions

    def diagnose(self) -> Dict[str, Any]:
        """Generate a diagnostic report from healing history."""
        return {
            "total_healing_actions": len(self._actions),
            "restart_counts": dict(self._restart_counts),
            "recent_actions": [a.to_dict() for a in self._actions[-20:]],
        }

    # ------------------------------------------------------------------

    def _heal_service(self, service_name: str) -> Optional[HealingAction]:
        """Attempt to heal a single service."""
        now = time.time()
        last_restart = self._last_restart.get(service_name, 0)
        attempts = self._restart_counts.get(service_name, 0)

        # Respect cooldown
        if now - last_restart < self.restart_cooldown_s:
            logger.info(
                "[SelfHealingEngine] %s in cooldown — skipping restart", service_name
            )
            return None

        # Check max attempts
        if attempts >= self.max_restart_attempts:
            logger.error(
                "[SelfHealingEngine] %s exceeded max restart attempts (%d) — escalating",
                service_name, self.max_restart_attempts,
            )
            return HealingAction(
                service_name,
                "escalate",
                success=False,
                message=f"Service {service_name} failed {attempts} times — manual intervention required",
            )

        # Attempt restart
        cmd = _RESTART_COMMANDS.get(service_name)
        if not cmd:
            logger.warning(
                "[SelfHealingEngine] No restart command for service '%s'", service_name
            )
            return None

        # Validate command is from the pre-approved list (not dynamic/injected)
        if cmd[0] != "docker" or cmd[1] != "compose":
            logger.error("[SelfHealingEngine] Unsafe command rejected for '%s'", service_name)
            return HealingAction(service_name, "rejected", success=False,
                                 message="Command failed safety validation")

        self._restart_counts[service_name] = attempts + 1
        self._last_restart[service_name] = now

        if self.dry_run:
            logger.info("[SelfHealingEngine] DRY RUN — would restart %s", service_name)
            return HealingAction(service_name, "restart_dry_run", success=True, message="Dry run")

        try:
            result = subprocess.run(  # noqa: S603
                cmd, capture_output=True, text=True, timeout=30,
                cwd=os.getcwd(),
            )
            success = result.returncode == 0
            message = result.stdout.strip() or result.stderr.strip()
            logger.info(
                "[SelfHealingEngine] Restart %s for '%s' — stdout: %s",
                "succeeded" if success else "failed", service_name, message[:100],
            )
            return HealingAction(service_name, "restart", success=success, message=message)
        except Exception as exc:  # noqa: BLE001
            logger.error("[SelfHealingEngine] Restart error for %s: %s", service_name, exc)
            return HealingAction(service_name, "restart", success=False, message=str(exc))
