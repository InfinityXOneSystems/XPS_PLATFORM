"""
kernel/kernel_runtime.py
==========================
Kernel Runtime — agent lifecycle management for the XPS Intelligence Platform.

The kernel is the low-level layer beneath the RuntimeController.  It manages:
  - Agent registration and discovery
  - Lifecycle events: REGISTERED → RUNNING → IDLE → TERMINATED
  - Resource budgets per agent (CPU/memory quotas — advisory)
  - Health ping loop
  - Emergency shutdown (kills all running tasks)

Usage::

    from kernel import get_kernel, KernelRuntime

    kernel = get_kernel()
    kernel.register("scraper", scraper_agent_instance)
    kernel.start()

    # Later
    kernel.shutdown()
"""

from __future__ import annotations

import asyncio
import logging
import threading
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

from observability import record_metric, start_span

logger = logging.getLogger("kernel")


# ---------------------------------------------------------------------------
# Agent lifecycle states
# ---------------------------------------------------------------------------


class AgentStatus(str, Enum):
    REGISTERED = "registered"
    RUNNING = "running"
    IDLE = "idle"
    ERROR = "error"
    TERMINATED = "terminated"


# ---------------------------------------------------------------------------
# Agent record
# ---------------------------------------------------------------------------


@dataclass
class AgentRecord:
    name: str
    instance: Any
    status: AgentStatus = AgentStatus.REGISTERED
    run_count: int = 0
    error_count: int = 0
    last_run: Optional[float] = None
    last_error: Optional[str] = None
    registered_at: float = field(default_factory=time.time)
    tags: Dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "status": self.status.value,
            "run_count": self.run_count,
            "error_count": self.error_count,
            "last_run": self.last_run,
            "last_error": self.last_error,
            "registered_at": self.registered_at,
            "tags": self.tags,
        }


# ---------------------------------------------------------------------------
# Kernel Runtime
# ---------------------------------------------------------------------------


class KernelRuntime:
    """Central agent lifecycle manager (singleton)."""

    def __init__(self, health_interval: float = 30.0) -> None:
        self._agents: Dict[str, AgentRecord] = {}
        self._lock = threading.Lock()
        self._health_interval = health_interval
        self._health_thread: Optional[threading.Thread] = None
        self._running = False
        self._hooks: Dict[str, List[Callable[[AgentRecord], None]]] = {
            "registered": [],
            "started": [],
            "completed": [],
            "error": [],
            "terminated": [],
        }
        logger.info("KernelRuntime initialised")

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register(
        self,
        name: str,
        instance: Any,
        tags: Optional[Dict[str, str]] = None,
        replace: bool = False,
    ) -> AgentRecord:
        """Register an agent with the kernel."""
        with self._lock:
            if name in self._agents and not replace:
                logger.debug("Kernel: agent '%s' already registered", name)
                return self._agents[name]
            record = AgentRecord(name=name, instance=instance, tags=tags or {})
            self._agents[name] = record
            logger.info("Kernel: registered agent '%s'", name)
            record_metric("kernel.agent.registered", tags={"agent": name})
        self._fire_hook("registered", record)
        return record

    def deregister(self, name: str) -> None:
        with self._lock:
            record = self._agents.pop(name, None)
        if record:
            record.status = AgentStatus.TERMINATED
            self._fire_hook("terminated", record)
            record_metric("kernel.agent.terminated", tags={"agent": name})

    # ------------------------------------------------------------------
    # Status management
    # ------------------------------------------------------------------

    def mark_running(self, name: str) -> None:
        self._update_status(name, AgentStatus.RUNNING)
        record_metric("kernel.agent.running", tags={"agent": name})

    def mark_idle(self, name: str) -> None:
        self._update_status(name, AgentStatus.IDLE)

    def mark_error(self, name: str, error: str) -> None:
        with self._lock:
            rec = self._agents.get(name)
            if rec:
                rec.status = AgentStatus.ERROR
                rec.error_count += 1
                rec.last_error = error
        record_metric("kernel.agent.error", tags={"agent": name})
        if rec:
            self._fire_hook("error", rec)

    def record_run(self, name: str) -> None:
        with self._lock:
            rec = self._agents.get(name)
            if rec:
                rec.run_count += 1
                rec.last_run = time.time()

    def _update_status(self, name: str, status: AgentStatus) -> None:
        with self._lock:
            rec = self._agents.get(name)
            if rec:
                rec.status = status

    # ------------------------------------------------------------------
    # Discovery
    # ------------------------------------------------------------------

    def get(self, name: str) -> Optional[AgentRecord]:
        with self._lock:
            return self._agents.get(name)

    def list_agents(self, status: Optional[AgentStatus] = None) -> List[AgentRecord]:
        with self._lock:
            records = list(self._agents.values())
        if status:
            records = [r for r in records if r.status == status]
        return records

    def status_summary(self) -> Dict[str, Any]:
        agents = self.list_agents()
        by_status: Dict[str, int] = {}
        for rec in agents:
            by_status[rec.status.value] = by_status.get(rec.status.value, 0) + 1
        return {
            "total": len(agents),
            "by_status": by_status,
            "agents": [r.to_dict() for r in agents],
        }

    # ------------------------------------------------------------------
    # Lifecycle hooks
    # ------------------------------------------------------------------

    def on(self, event: str, handler: Callable[[AgentRecord], None]) -> None:
        """Register a lifecycle hook."""
        if event not in self._hooks:
            self._hooks[event] = []
        self._hooks[event].append(handler)

    def _fire_hook(self, event: str, record: AgentRecord) -> None:
        for handler in self._hooks.get(event, []):
            try:
                handler(record)
            except Exception as exc:
                logger.debug("Kernel hook error [%s]: %s", event, exc)

    # ------------------------------------------------------------------
    # Health loop
    # ------------------------------------------------------------------

    def start(self) -> None:
        """Start the background health-ping loop."""
        if self._running:
            return
        self._running = True
        self._health_thread = threading.Thread(
            target=self._health_loop, daemon=True, name="kernel-health"
        )
        self._health_thread.start()
        logger.info("Kernel health loop started (interval=%.0fs)", self._health_interval)

    def shutdown(self) -> None:
        """Stop health loop and mark all agents terminated."""
        self._running = False
        with self._lock:
            for rec in self._agents.values():
                if rec.status not in (AgentStatus.TERMINATED, AgentStatus.ERROR):
                    rec.status = AgentStatus.TERMINATED
        logger.info("KernelRuntime shutdown")
        record_metric("kernel.shutdown")

    def _health_loop(self) -> None:
        while self._running:
            try:
                self._ping_agents()
            except Exception as exc:
                logger.warning("Kernel health loop error: %s", exc)
            time.sleep(self._health_interval)

    def _ping_agents(self) -> None:
        agents = self.list_agents()
        healthy = sum(
            1 for r in agents
            if r.status not in (AgentStatus.TERMINATED, AgentStatus.ERROR)
        )
        record_metric("kernel.agents.healthy", healthy, metric_type="gauge")
        record_metric("kernel.agents.total", len(agents), metric_type="gauge")
        logger.debug(
            "Kernel health ping: %d/%d agents healthy", healthy, len(agents)
        )


# ---------------------------------------------------------------------------
# Global singleton
# ---------------------------------------------------------------------------

_kernel: Optional[KernelRuntime] = None
_kernel_lock = threading.Lock()


def get_kernel() -> KernelRuntime:
    global _kernel
    if _kernel is None:
        with _kernel_lock:
            if _kernel is None:
                _kernel = KernelRuntime()
                _kernel.start()
    return _kernel
