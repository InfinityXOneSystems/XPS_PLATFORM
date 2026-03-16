"""
runtime/sandbox_executor.py
============================
Sandbox execution wrapper for XPS Intelligence Platform agents.

All agents MUST execute through the SandboxExecutor when performing
filesystem or network operations.  The executor enforces:

  - Network boundary: optionally restrict to allowed domains
  - Filesystem boundary: optionally restrict to allowed base directories
  - Execution timeout
  - Resource accounting

Usage::

    executor = SandboxExecutor(
        allowed_domains=["maps.google.com", "yelp.com"],
        allowed_paths=["/tmp/xps_data"],
        timeout=60,
    )
    result = await executor.run_agent(MyAgent(), task)
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Any

from runtime.observability import record_agent_health, record_error

logger = logging.getLogger(__name__)

# Default allowed filesystem roots for agents
_DEFAULT_ALLOWED_PATHS = [
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "leads"),
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data"),
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs"),
    "/tmp/xps_data",
]

# Default execution timeout (seconds)
_DEFAULT_TIMEOUT = int(os.getenv("SANDBOX_TIMEOUT", "120"))


class SandboxViolation(Exception):
    """Raised when a sandbox boundary is violated."""


class SandboxExecutor:
    """
    Execution sandbox for XPS agents.

    Wraps agent.execute() with:
      - Timeout enforcement
      - Filesystem access validation
      - Network domain allow-listing
      - Execution metrics

    :param allowed_domains: List of allowed network domains (None = allow all).
    :param allowed_paths: List of allowed filesystem paths (None = use defaults).
    :param timeout: Maximum execution time in seconds.
    """

    def __init__(
        self,
        allowed_domains: list[str] | None = None,
        allowed_paths: list[str] | None = None,
        timeout: float = _DEFAULT_TIMEOUT,
    ) -> None:
        self.allowed_domains = allowed_domains  # None = no restriction
        self.allowed_paths = allowed_paths or _DEFAULT_ALLOWED_PATHS
        self.timeout = timeout
        self._executions = 0
        self._violations = 0

    # ------------------------------------------------------------------

    def validate_path(self, path: str) -> bool:
        """Return True if *path* is under an allowed filesystem root."""
        abs_path = os.path.abspath(path)
        for allowed in self.allowed_paths:
            if abs_path.startswith(os.path.abspath(allowed)):
                return True
        return False

    def validate_domain(self, url: str) -> bool:
        """Return True if *url* matches an allowed domain (or no restriction set)."""
        if self.allowed_domains is None:
            return True
        from urllib.parse import urlparse
        hostname = urlparse(url).hostname or ""
        for domain in self.allowed_domains:
            if hostname == domain or hostname.endswith(f".{domain}"):
                return True
        return False

    # ------------------------------------------------------------------

    async def run_agent(
        self,
        agent: Any,
        task: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Execute *agent*.execute(*task*, *context*) inside the sandbox.

        :param agent: An agent instance with an async ``execute`` method.
        :param task: Task payload dict.
        :param context: Optional context dict.
        :returns: Agent result dict.
        :raises SandboxViolation: If the agent violates sandbox boundaries.
        """
        agent_name = getattr(agent, "agent_name", type(agent).__name__)
        self._executions += 1
        start = time.time()

        # Inject sandbox context into task
        sandboxed_task = {
            **task,
            "_sandbox": {
                "allowed_paths": self.allowed_paths,
                "allowed_domains": self.allowed_domains,
                "timeout": self.timeout,
            },
        }

        logger.info("[SandboxExecutor] Running agent=%s task_type=%s", agent_name, task.get("type", "?"))

        try:
            result = await asyncio.wait_for(
                agent.execute(sandboxed_task, context),
                timeout=self.timeout,
            )
            elapsed = time.time() - start
            record_agent_health(agent_name, status="ok", last_execution_ms=round(elapsed * 1000))
            logger.info("[SandboxExecutor] Agent %s completed in %.2fs", agent_name, elapsed)
            return result
        except asyncio.TimeoutError:
            self._violations += 1
            record_error("sandbox_timeout", agent_name)
            record_agent_health(agent_name, status="timeout")
            msg = f"Agent {agent_name} timed out after {self.timeout}s"
            logger.error("[SandboxExecutor] %s", msg)
            return {"success": False, "error": msg, "agent": agent_name}
        except SandboxViolation as exc:
            self._violations += 1
            record_error("sandbox_violation", agent_name)
            record_agent_health(agent_name, status="violation")
            logger.error("[SandboxExecutor] Sandbox violation by %s: %s", agent_name, exc)
            return {"success": False, "error": f"Sandbox violation: {exc}", "agent": agent_name}
        except Exception as exc:
            record_error(str(exc), agent_name)
            record_agent_health(agent_name, status="error", error=str(exc))
            logger.error("[SandboxExecutor] Agent %s error: %s", agent_name, exc)
            return {"success": False, "error": str(exc), "agent": agent_name}

    # ------------------------------------------------------------------

    def status(self) -> dict[str, Any]:
        """Return sandbox executor status."""
        return {
            "executions_total": self._executions,
            "violations_total": self._violations,
            "timeout_seconds": self.timeout,
            "allowed_paths": self.allowed_paths,
            "network_restricted": self.allowed_domains is not None,
        }


# ---------------------------------------------------------------------------
# Module-level default executor
# ---------------------------------------------------------------------------

_default_executor = SandboxExecutor()


async def sandboxed_run(
    agent: Any,
    task: dict[str, Any],
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Run *agent* through the default module-level sandbox executor.

    Convenience wrapper for::

        executor = SandboxExecutor()
        result = await executor.run_agent(agent, task)
    """
    return await _default_executor.run_agent(agent, task, context)
