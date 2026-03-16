"""
agents/supervisor/supervisor_agent.py
=======================================
Supervisor agent – coordinates multi-agent workflows and
handles agent failures with retry/fallback logic.

The supervisor implements the top-level orchestration loop::

    Receive task
        ↓
    Select agent(s)
        ↓
    Execute with timeout
        ↓
    Handle failure / retry
        ↓
    Aggregate results
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

logger = logging.getLogger(__name__)

MAX_CONCURRENT_AGENTS = int(__import__("os").getenv("SUPERVISOR_MAX_AGENTS", "5"))
AGENT_TIMEOUT = int(__import__("os").getenv("SUPERVISOR_AGENT_TIMEOUT", "120"))


class SupervisorAgent:
    """
    Top-level supervisor that coordinates all other agents.

    Example::

        supervisor = SupervisorAgent()
        result = await supervisor.run_pipeline([
            {"type": "scrape", "command": "scrape epoxy orlando"},
            {"type": "github", "command": "push to github"},
        ])
    """

    async def run_pipeline(self, tasks: list[dict[str, Any]]) -> dict[str, Any]:
        """
        Execute a list of tasks sequentially, stopping on hard failures.

        :param tasks: List of task dicts with at minimum a ``type`` key.
        :returns: Aggregated results and any errors.
        """
        results: list[dict[str, Any]] = []
        errors: list[str] = []

        for task in tasks:
            try:
                result = await asyncio.wait_for(
                    self._dispatch(task),
                    timeout=AGENT_TIMEOUT,
                )
                results.append(result)
                if not result.get("success", True):
                    errors.append(result.get("error", f"Task failed: {task}"))
            except asyncio.TimeoutError:
                error = f"Task timed out after {AGENT_TIMEOUT}s: {task.get('type', '?')}"
                logger.warning(error)
                errors.append(error)
            except Exception as exc:
                error = f"Task error ({task.get('type', '?')}): {exc}"
                logger.error(error)
                errors.append(error)

        return {
            "success": len(errors) == 0,
            "tasks_completed": len(results),
            "results": results,
            "errors": errors,
        }

    async def run_parallel(self, tasks: list[dict[str, Any]]) -> dict[str, Any]:
        """Execute tasks in parallel with a concurrency limit."""
        semaphore = asyncio.Semaphore(MAX_CONCURRENT_AGENTS)

        async def bounded_dispatch(task: dict[str, Any]) -> dict[str, Any]:
            async with semaphore:
                try:
                    return await asyncio.wait_for(self._dispatch(task), timeout=AGENT_TIMEOUT)
                except Exception as exc:
                    return {"success": False, "error": str(exc)}

        task_coroutines = [bounded_dispatch(t) for t in tasks]
        results = await asyncio.gather(*task_coroutines, return_exceptions=False)

        errors = [r.get("error", "") for r in results if not r.get("success", True)]
        return {
            "success": len(errors) == 0,
            "tasks_completed": len(results),
            "results": list(results),
            "errors": errors,
        }

    # ------------------------------------------------------------------

    async def _dispatch(self, task: dict[str, Any]) -> dict[str, Any]:
        """Route a task to the appropriate agent."""
        task_type = task.get("type", "plan")
        command = task.get("command", "")
        logger.info("Supervisor dispatching: type=%s command=%r", task_type, command)

        if task_type == "scrape":
            from agents.tools.scraper import scrape_google_maps
            keyword = task.get("keyword", command)
            city = task.get("city", "")
            state = task.get("state", "")
            leads = await scrape_google_maps(keyword, city, state)
            return {"success": True, "leads_found": len(leads)}

        if task_type == "code":
            from agents.code.code_agent import CodeAgent
            return await CodeAgent().run(command)

        if task_type == "github":
            from agents.github.github_agent import GitHubAgent
            return await GitHubAgent().run(command)

        if task_type in ("frontend", "analytics"):
            from agents.frontend.frontend_agent import FrontendAgent
            return await FrontendAgent().run(command)

        if task_type == "backend":
            from agents.backend.backend_agent import BackendAgent
            return await BackendAgent().run(command)

        if task_type == "interpret":
            from agents.interpreter.interpreter_agent import InterpreterAgent
            return await InterpreterAgent().run(command)

        if task_type == "predict" or task_type == "forecast":
            from agents.prediction.prediction_agent import PredictionAgent
            return await PredictionAgent().run(command)

        if task_type == "simulate" or task_type == "scenario":
            from agents.simulation.simulation_agent import SimulationAgent
            return await SimulationAgent().run(command)

        if task_type == "seo":
            from agents.seo.seo_agent import SEOAgent
            return await SEOAgent().run(command)

        if task_type == "social":
            from agents.social.social_agent import SocialAgent
            return await SocialAgent().run(command)

        if task_type in ("browser", "automation"):
            from agents.browser.browser_automation_agent import BrowserAutomationAgent
            return await BrowserAutomationAgent().run(command)

        # Default: run full LangGraph pipeline
        from agent_core.langgraph_runtime import run_graph
        run_id = str(int(time.time() * 1000))
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, run_graph, command, run_id)
        return result
