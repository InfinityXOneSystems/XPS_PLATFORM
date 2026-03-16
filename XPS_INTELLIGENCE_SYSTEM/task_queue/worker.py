"""
task_queue/worker.py
====================
Async worker that pulls tasks from the queue and dispatches them to agents.

Usage::

    python -m task_queue.worker          # run continuously
    python -m task_queue.worker --once   # process one task then exit

Each task payload is expected to have the shape::

    {
        "task_id": "...",
        "payload": {
            "command": "scrape epoxy contractors orlando",
            "type": "scrape" | "code" | "plan" | ...
        }
    }
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import signal
import sys
import time
from typing import Any

from .redis_queue import TaskQueue

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
POLL_TIMEOUT = 5

try:
    MAX_RETRIES = int(os.getenv("WORKER_MAX_RETRIES", "3"))
except ValueError:
    pass

try:
    POLL_TIMEOUT = int(os.getenv("WORKER_POLL_TIMEOUT", "5"))
except ValueError:
    pass


# ---------------------------------------------------------------------------
# Dispatcher – maps task type to agent handler
# ---------------------------------------------------------------------------


async def _dispatch(task: dict[str, Any]) -> dict[str, Any]:
    """Route a task to the appropriate agent and return the result."""
    payload = task.get("payload", {})
    task_type = payload.get("type", "plan")
    command = payload.get("command", "")

    logger.info("Worker dispatching task_type=%s command=%r", task_type, command)

    if task_type == "scrape":
        return await _run_scrape(payload)
    if task_type == "code":
        return await _run_code(payload)
    if task_type == "github":
        return await _run_github(payload)
    if task_type == "interpret":
        return await _run_interpreter(payload)

    # Default: run full agent pipeline
    return await _run_agent_pipeline(command)


async def _run_agent_pipeline(command: str) -> dict[str, Any]:
    """Execute the full PLAN → EXECUTE pipeline via agent_core."""
    try:
        import asyncio as _asyncio

        loop = _asyncio.get_event_loop()
        result = await loop.run_in_executor(None, _sync_agent_pipeline, command)
        return result
    except Exception as exc:
        logger.error("Agent pipeline failed: %s", exc)
        return {"success": False, "error": str(exc)}


def _sync_agent_pipeline(command: str) -> dict[str, Any]:
    """Synchronous agent pipeline call (runs in thread pool)."""
    try:
        from agent_core.planner import plan
        from agent_core.executor import Executor
        from agent_core.state_manager import StateManager

        sm = StateManager()
        ex = Executor(state_manager=sm)
        agent_plan = plan(command)
        raw = agent_plan.command.model_dump()
        result = ex.execute(raw, agent_plan, run_id=str(int(time.time() * 1000)))
        return {
            "success": result.success,
            "leads_found": result.leads_found,
            "high_value": result.high_value,
            "message": result.message,
            "errors": result.errors,
        }
    except Exception as exc:
        logger.error("Sync pipeline error: %s", exc)
        return {"success": False, "error": str(exc)}


async def _run_scrape(payload: dict[str, Any]) -> dict[str, Any]:
    """Run the scraper agent."""
    keyword = payload.get("keyword", payload.get("command", ""))
    city = payload.get("city", "")
    state = payload.get("state", "")
    try:
        from agents.tools.scraper import scrape_google_maps
        leads = await scrape_google_maps(keyword, city, state)
        return {"success": True, "leads_found": len(leads), "leads": leads}
    except Exception as exc:
        logger.error("Scrape task failed: %s", exc)
        return {"success": False, "error": str(exc)}


async def _run_code(payload: dict[str, Any]) -> dict[str, Any]:
    """Run the code agent."""
    try:
        from agents.code.code_agent import CodeAgent
        agent = CodeAgent()
        result = await agent.run(payload.get("command", ""))
        return {"success": True, "result": result}
    except Exception as exc:
        logger.error("Code task failed: %s", exc)
        return {"success": False, "error": str(exc)}


async def _run_github(payload: dict[str, Any]) -> dict[str, Any]:
    """Run the GitHub agent."""
    try:
        from agents.github.github_agent import GitHubAgent
        agent = GitHubAgent()
        result = await agent.run(payload.get("command", ""))
        return {"success": True, "result": result}
    except Exception as exc:
        logger.error("GitHub task failed: %s", exc)
        return {"success": False, "error": str(exc)}


async def _run_interpreter(payload: dict[str, Any]) -> dict[str, Any]:
    """Run the Open Interpreter agent."""
    try:
        from agents.interpreter.interpreter_agent import InterpreterAgent
        agent = InterpreterAgent()
        result = await agent.run(payload.get("command", ""))
        return {"success": True, "result": result}
    except Exception as exc:
        logger.error("Interpreter task failed: %s", exc)
        return {"success": False, "error": str(exc)}


# ---------------------------------------------------------------------------
# Worker loop
# ---------------------------------------------------------------------------


class Worker:
    """Async worker that continuously processes tasks from the queue."""

    def __init__(self) -> None:
        self.queue = TaskQueue()
        self._running = True

    def stop(self) -> None:
        self._running = False

    async def process_one(self) -> bool:
        """Process a single task. Returns True if a task was processed."""
        task = self.queue.dequeue(timeout=POLL_TIMEOUT)
        if not task:
            return False

        task_id = task.get("task_id", "unknown")
        logger.info("Processing task %s", task_id)
        self.queue.update_status(task_id, "processing")

        retries = 0
        while retries <= MAX_RETRIES:
            try:
                result = await _dispatch(task)
                self.queue.update_status(task_id, "done", result=str(result))
                logger.info("Task %s completed: success=%s", task_id, result.get("success"))
                return True
            except Exception as exc:
                retries += 1
                logger.warning("Task %s attempt %d failed: %s", task_id, retries, exc)
                if retries > MAX_RETRIES:
                    self.queue.nack(task, str(exc))
                    self.queue.update_status(task_id, "failed", error=str(exc))
                    return True
                await asyncio.sleep(2 ** retries)

        return True

    async def run_forever(self) -> None:
        """Continuously process tasks until stopped."""
        logger.info("Worker started (queue backend: %s)", self.queue.health()["backend"])
        while self._running:
            try:
                await self.process_one()
            except Exception as exc:
                logger.error("Worker loop error: %s", exc)
                await asyncio.sleep(1)


# ---------------------------------------------------------------------------
# CLI entry-point
# ---------------------------------------------------------------------------


def _signal_handler(worker: Worker, sig: int, _frame: Any) -> None:
    logger.info("Worker received signal %d – shutting down", sig)
    worker.stop()


async def _main(once: bool = False) -> None:
    worker = Worker()
    signal.signal(signal.SIGTERM, lambda s, f: _signal_handler(worker, s, f))
    signal.signal(signal.SIGINT, lambda s, f: _signal_handler(worker, s, f))

    if once:
        await worker.process_one()
    else:
        await worker.run_forever()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    parser = argparse.ArgumentParser(description="XPS worker process")
    parser.add_argument("--once", action="store_true", help="Process one task then exit")
    args = parser.parse_args()
    asyncio.run(_main(once=args.once))
