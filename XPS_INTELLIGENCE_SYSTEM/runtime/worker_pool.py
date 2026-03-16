"""
runtime/worker_pool.py
=======================
Async distributed worker pool for the XPS Intelligence Platform.

Provides a pool of async worker coroutines that pull tasks from the
shared TaskQueue and execute them.  Workers are supervised for automatic
recovery on crash (via WorkerRecovery).

Architecture::

    TaskDispatcher
         │  enqueue
         ▼
    TaskQueue (Redis / in-process)
         │  dequeue
         ▼
    WorkerPool  ← n_workers concurrent coroutines
         │  dispatch
         ▼
    Agent handlers

Usage::

    pool = WorkerPool(n_workers=4)
    await pool.start()           # blocks; runs workers forever
    await pool.start_background() # non-blocking; returns running tasks
    pool.status()                # health info
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Any

from task_queue.redis_queue import TaskQueue
from runtime.fault_tolerance import WorkerRecovery
from runtime.observability import record_command, record_error, record_latency, record_agent_health

logger = logging.getLogger(__name__)

N_WORKERS = int(os.getenv("WORKER_POOL_SIZE", "4"))
POLL_TIMEOUT = int(os.getenv("WORKER_POLL_TIMEOUT", "5"))
MAX_RETRIES = int(os.getenv("WORKER_MAX_RETRIES", "3"))


# ---------------------------------------------------------------------------
# Task dispatcher function (routes task → agent)
# ---------------------------------------------------------------------------


async def _execute_task(task: dict[str, Any]) -> dict[str, Any]:
    """Route and execute one task using the appropriate agent."""
    payload = task.get("payload", {})
    task_type = payload.get("type", "plan")
    command = payload.get("command", "")
    agent_name = payload.get("agent", "planner")

    logger.info("[WorkerPool] Executing type=%s agent=%s command=%r", task_type, agent_name, command)
    record_command(agent_name, task_type)

    start = time.time()
    try:
        result = await _route_to_agent(task_type, agent_name, payload)
        record_latency(agent_name, time.time() - start)
        record_agent_health(agent_name, status="ok")
        return result
    except Exception as exc:
        record_error(str(exc), agent_name)
        record_agent_health(agent_name, status="error", error=str(exc))
        raise


async def _route_to_agent(task_type: str, agent_name: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Dispatch to the appropriate agent based on task_type."""
    command = payload.get("command", "")

    if task_type == "scrape":
        from agents.scraper.scraper_agent import ScraperAgent
        return await ScraperAgent().execute(payload)

    if task_type == "seo":
        from agents.seo.seo_agent import SEOAgent
        return await SEOAgent().execute(payload)

    if task_type == "social":
        from agents.social.social_media_agent import SocialMediaAgent
        return await SocialMediaAgent().execute(payload)

    if task_type in ("browser", "automation"):
        from agents.browser.browser_automation_agent import BrowserAutomationAgent
        return await BrowserAutomationAgent().execute(payload)

    if task_type == "code":
        from agents.code.code_agent import CodeAgent
        return await CodeAgent().execute(payload)

    if task_type in ("frontend", "analytics"):
        from agents.frontend.frontend_agent import FrontendAgent
        return await FrontendAgent().execute(payload)

    if task_type == "backend":
        from agents.backend.backend_agent import BackendAgent
        return await BackendAgent().execute(payload)

    if task_type == "github":
        from agents.github.github_agent import GitHubAgent
        return await GitHubAgent().execute(payload)

    if task_type == "interpret":
        from agents.interpreter.interpreter_agent import InterpreterAgent
        return await InterpreterAgent().execute(payload)

    if task_type in ("predict", "forecast"):
        from agents.prediction.prediction_agent import PredictionAgent
        return await PredictionAgent().execute(payload)

    if task_type in ("simulate", "scenario"):
        from agents.simulation.simulation_agent import SimulationAgent
        return await SimulationAgent().execute(payload)

    # Default: full orchestration pipeline
    return await _run_full_pipeline(command)


async def _run_full_pipeline(command: str) -> dict[str, Any]:
    """Execute the full PLAN → EXECUTE pipeline."""
    try:
        loop = asyncio.get_event_loop()
        from agent_core.orchestrator import run_pipeline
        result = await run_pipeline(command)
        return result
    except Exception as exc:
        logger.error("[WorkerPool] Pipeline error: %s", exc)
        return {"success": False, "error": str(exc)}


# ---------------------------------------------------------------------------
# WorkerPool
# ---------------------------------------------------------------------------


class WorkerPool:
    """
    Pool of async worker coroutines backed by the TaskQueue.

    :param n_workers: Number of concurrent workers.
    """

    def __init__(self, n_workers: int = N_WORKERS) -> None:
        self.n_workers = n_workers
        self._queue = TaskQueue()
        self._running = False
        self._workers_started = 0
        self._tasks_processed = 0
        self._tasks_failed = 0
        self._background_tasks: list[asyncio.Task] = []
        logger.info("[WorkerPool] Initialised with %d workers", n_workers)

    # ------------------------------------------------------------------

    async def _worker_loop(self) -> None:
        """Single worker: continuously dequeue and process tasks."""
        self._workers_started += 1
        logger.info("[WorkerPool] Worker started (total active: %d)", self._workers_started)
        while self._running:
            try:
                task = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: self._queue.dequeue(timeout=POLL_TIMEOUT),
                )
                if task is None:
                    continue
                await self._process(task)
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error("[WorkerPool] Worker loop error: %s", exc)
                await asyncio.sleep(1)
        self._workers_started -= 1
        logger.info("[WorkerPool] Worker stopped")

    async def _process(self, task: dict[str, Any]) -> None:
        """Process one task with retry logic."""
        task_id = task.get("task_id", "unknown")
        self._queue.update_status(task_id, "processing")
        attempt = 0
        while attempt <= MAX_RETRIES:
            try:
                result = await _execute_task(task)
                self._tasks_processed += 1
                self._queue.update_status(task_id, "done", result=str(result)[:500])
                logger.info("[WorkerPool] Task %s done: success=%s", task_id, result.get("success"))
                return
            except Exception as exc:
                attempt += 1
                if attempt > MAX_RETRIES:
                    self._tasks_failed += 1
                    self._queue.nack(task, str(exc))
                    self._queue.update_status(task_id, "failed", error=str(exc))
                    logger.error("[WorkerPool] Task %s failed after %d retries: %s", task_id, attempt, exc)
                    return
                wait = 2 ** attempt
                logger.warning("[WorkerPool] Task %s attempt %d failed: %s – retrying in %ds", task_id, attempt, exc, wait)
                await asyncio.sleep(wait)

    # ------------------------------------------------------------------

    async def start(self) -> None:
        """Start all workers and run forever (blocks until cancelled)."""
        self._running = True

        async def make_worker() -> None:
            await self._worker_loop()

        recovery = WorkerRecovery(factory=make_worker, n_workers=self.n_workers, restart_delay=2.0)
        await recovery.start()

    async def start_background(self) -> list[asyncio.Task]:
        """Start workers as background tasks (non-blocking)."""
        self._running = True
        for i in range(self.n_workers):
            t = asyncio.create_task(self._worker_loop(), name=f"worker-{i}")
            self._background_tasks.append(t)
        logger.info("[WorkerPool] Started %d background workers", self.n_workers)
        return self._background_tasks

    async def stop(self) -> None:
        """Stop all workers gracefully."""
        self._running = False
        for t in self._background_tasks:
            t.cancel()
        await asyncio.gather(*self._background_tasks, return_exceptions=True)
        self._background_tasks.clear()
        logger.info("[WorkerPool] All workers stopped")

    def status(self) -> dict[str, Any]:
        """Return pool status information."""
        queue_health = self._queue.health()
        return {
            "n_workers_configured": self.n_workers,
            "workers_active": self._workers_started,
            "tasks_processed": self._tasks_processed,
            "tasks_failed": self._tasks_failed,
            "queue": queue_health,
        }

    def health(self) -> dict[str, Any]:
        """Alias for status()."""
        return self.status()
