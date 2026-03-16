"""
agents/shadow/shadow_agent.py
==============================
Shadow agent – observes all other agents, detects anomalies,
and reports system health metrics.

Metrics collected:
  - Worker count
  - Queue size
  - Scraping rate
  - Agent run count
  - Memory usage
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any

logger = logging.getLogger(__name__)


class ShadowAgent:
    """
    Passive monitoring agent that tracks system-wide metrics.

    Example::

        agent = ShadowAgent()
        metrics = await agent.collect()
    """

    def __init__(self) -> None:
        self._run_count: int = 0
        self._scrape_count: int = 0
        self._start_time: float = time.time()

    async def collect(self) -> dict[str, Any]:
        """Collect and return all system metrics."""
        metrics: dict[str, Any] = {
            "timestamp": time.time(),
            "uptime_seconds": int(time.time() - self._start_time),
        }
        metrics.update(self._queue_metrics())
        metrics.update(self._memory_metrics())
        metrics.update(self._process_metrics())
        metrics.update(self._run_metrics())
        return metrics

    # ------------------------------------------------------------------

    def _queue_metrics(self) -> dict[str, Any]:
        try:
            from task_queue.redis_queue import TaskQueue
            h = TaskQueue().health()
            return {
                "queue_size": h["queue_length"],
                "dlq_size": h["dlq_length"],
                "queue_backend": h["backend"],
            }
        except Exception:
            return {"queue_size": 0, "dlq_size": 0, "queue_backend": "unknown"}

    def _memory_metrics(self) -> dict[str, Any]:
        try:
            import psutil  # type: ignore
            proc = psutil.Process(os.getpid())
            return {
                "memory_mb": round(proc.memory_info().rss / 1024 / 1024, 1),
                "cpu_percent": proc.cpu_percent(interval=0.1),
            }
        except ImportError:
            return {"memory_mb": 0, "cpu_percent": 0}
        except Exception:
            return {"memory_mb": 0, "cpu_percent": 0}

    def _process_metrics(self) -> dict[str, Any]:
        try:
            import psutil  # type: ignore
            worker_count = sum(
                1 for p in psutil.process_iter(["name", "cmdline"])
                if "worker" in " ".join(p.info.get("cmdline") or []).lower()
            )
            return {"worker_count": worker_count}
        except Exception:
            return {"worker_count": 0}

    def _run_metrics(self) -> dict[str, Any]:
        try:
            log_file = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                "logs", "agent_runs.jsonl",
            )
            if os.path.exists(log_file):
                with open(log_file, "r", encoding="utf-8") as fh:
                    lines = fh.readlines()
                return {"total_agent_runs": len(lines)}
        except Exception:
            pass
        return {"total_agent_runs": 0}

    def record_scrape(self) -> None:
        """Increment the scrape counter."""
        self._scrape_count += 1

    def record_run(self) -> None:
        """Increment the agent run counter."""
        self._run_count += 1

    @property
    def scraping_rate(self) -> float:
        """Return scrapes per minute since agent start."""
        elapsed_minutes = (time.time() - self._start_time) / 60
        return self._scrape_count / elapsed_minutes if elapsed_minutes > 0 else 0.0


# Module-level singleton for use in monitoring endpoints
_shadow = ShadowAgent()


async def get_metrics() -> dict[str, Any]:
    """Return current system metrics from the module-level shadow agent."""
    return await _shadow.collect()
