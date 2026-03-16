"""
agent_core/orchestrator.py
===========================
LangGraph-based agent orchestration pipeline.

This module wires together all specialised agents into a single
directed LangGraph ``StateGraph``.  Each node in the graph
corresponds to one agent; edges define the execution order.

Default pipeline::

    PlannerAgent → ScraperAgent → ValidatorAgent → MemoryAgent
                       ↑ (on scrape intent)
    Other intents: PlannerAgent → execute_node → MemoryAgent

This module defines the multi-agent orchestration graph and pipeline
helpers; integration with ``agent_core.langgraph_runtime`` (for example
via ``run_graph()``) is handled by the caller or higher-level runtime
utilities.

Public API::

    run_pipeline(command, run_id=None)      – async entry point
    run_pipeline_sync(command, run_id=None) – synchronous entry point

Both functions return::

    {
        "run_id": str,
        "success": bool,
        "leads_found": int,
        "high_value": int,
        "message": str,
        "errors": list[str],
        "plan": dict,
        "results": list[dict],
    }
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, TypedDict

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Shared state schema
# ---------------------------------------------------------------------------


class OrchestratorState(TypedDict, total=False):
    """State passed between graph nodes."""

    run_id: str
    command: str
    plan: dict[str, Any]
    leads: list[dict[str, Any]]
    validation: dict[str, Any]
    results: list[dict[str, Any]]
    errors: list[str]
    leads_found: int
    high_value: int
    intent: str
    done: bool


# ---------------------------------------------------------------------------
# Node helpers (sync wrappers for LangGraph)
# ---------------------------------------------------------------------------


def _run_async(coro):
    """Run *coro* in the current or a new event loop."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(asyncio.run, coro)
                return future.result()
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


# ---------------------------------------------------------------------------
# Graph nodes
# ---------------------------------------------------------------------------


def _planner_node(state: OrchestratorState) -> OrchestratorState:
    """Parse command → structured plan."""
    try:
        from agents.planner.planner_agent import PlannerAgent

        agent = PlannerAgent()
        agent._run_id = state.get("run_id")
        result = _run_async(
            agent.execute({"command": state.get("command", "")})
        )
        return {
            **state,
            "plan": result.get("plan", {}),
            "intent": result.get("intent", "unknown"),
        }
    except Exception as exc:
        logger.error("Planner node error: %s", exc)
        return {**state, "errors": state.get("errors", []) + [f"planner: {exc}"]}


def _scraper_node(state: OrchestratorState) -> OrchestratorState:
    """Scrape leads when intent is 'scrape'."""
    intent = state.get("intent", "scrape")
    if intent != "scrape":
        return state
    try:
        from agents.scraper.scraper_agent import ScraperAgent

        plan = state.get("plan", {})
        entities = plan.get("entities", {})
        agent = ScraperAgent()
        agent._run_id = state.get("run_id")
        result = _run_async(
            agent.execute({
                "command": state.get("command", ""),
                "keyword": entities.get("keyword", ""),
                "city": entities.get("city", ""),
                "state": entities.get("state", ""),
            })
        )
        leads = result.get("leads", [])
        return {
            **state,
            "leads": leads,
            "leads_found": len(leads),
            "results": state.get("results", []) + [{"node": "scraper", **result}],
        }
    except Exception as exc:
        logger.error("Scraper node error: %s", exc)
        return {**state, "errors": state.get("errors", []) + [f"scraper: {exc}"]}


def _validator_node(state: OrchestratorState) -> OrchestratorState:
    """Validate the scraped leads."""
    leads = state.get("leads", [])
    if not leads:
        return state
    try:
        from agents.validator.validator_agent import ValidatorAgent

        agent = ValidatorAgent()
        agent._run_id = state.get("run_id")
        result = _run_async(
            agent.execute({"type": "leads", "leads": leads})
        )
        # Keep only valid leads
        valid_leads = result.get("valid_leads", leads)
        high_value = sum(
            1 for l in valid_leads
            if (l.get("lead_score") or l.get("score") or 0) >= 35
        )
        return {
            **state,
            "leads": valid_leads,
            "leads_found": len(valid_leads),
            "high_value": high_value,
            "validation": result,
            "results": state.get("results", []) + [{"node": "validator", **result}],
        }
    except Exception as exc:
        logger.error("Validator node error: %s", exc)
        return {**state, "errors": state.get("errors", []) + [f"validator: {exc}"]}


def _execute_node(state: OrchestratorState) -> OrchestratorState:
    """Execute non-scrape tasks via the legacy orchestrator."""
    intent = state.get("intent", "scrape")
    if intent == "scrape":
        return state  # Already handled by scraper node
    try:
        from agents.orchestrator import run_plan

        plan = state.get("plan", {})
        result_state = _run_async(run_plan(plan))
        output = result_state.get("output", {})
        leads = result_state.get("leads", [])
        return {
            **state,
            "leads": leads,
            "leads_found": len(leads),
            "results": state.get("results", []) + [{"node": "execute", "output": output}],
        }
    except Exception as exc:
        logger.error("Execute node error: %s", exc)
        return {**state, "errors": state.get("errors", []) + [f"execute: {exc}"]}


def _memory_node(state: OrchestratorState) -> OrchestratorState:
    """Persist run results to the memory layer."""
    try:
        from agents.memory.memory_agent import MemoryAgent

        agent = MemoryAgent()
        agent._run_id = state.get("run_id")
        summary = (
            f"run_id={state.get('run_id')} "
            f"command={state.get('command', '')!r} "
            f"leads={state.get('leads_found', 0)} "
            f"high_value={state.get('high_value', 0)}"
        )
        _run_async(agent.execute({
            "operation": "store",
            "key": f"run:{state.get('run_id', 'latest')}",
            "value": summary,
            "text": summary,
        }))
    except Exception as exc:
        logger.debug("Memory node error (non-fatal): %s", exc)
    return {**state, "done": True}


# ---------------------------------------------------------------------------
# LangGraph builder
# ---------------------------------------------------------------------------


def _build_graph():
    """Compile the multi-agent LangGraph StateGraph."""
    try:
        from langgraph.graph import StateGraph, END  # type: ignore

        builder = StateGraph(OrchestratorState)
        builder.add_node("plan", _planner_node)
        builder.add_node("scrape", _scraper_node)
        builder.add_node("validate", _validator_node)
        builder.add_node("execute", _execute_node)
        builder.add_node("memory", _memory_node)

        builder.set_entry_point("plan")
        builder.add_edge("plan", "scrape")
        builder.add_edge("scrape", "validate")
        builder.add_edge("validate", "execute")
        builder.add_edge("execute", "memory")
        builder.add_edge("memory", END)

        return builder.compile()
    except ImportError:
        logger.info("LangGraph not available – orchestrator will use async fallback")
        return None
    except Exception as exc:
        logger.warning("Failed to build orchestrator graph: %s", exc)
        return None


_COMPILED_GRAPH = None


def _get_graph():
    global _COMPILED_GRAPH
    if _COMPILED_GRAPH is None:
        _COMPILED_GRAPH = _build_graph()
    return _COMPILED_GRAPH


# ---------------------------------------------------------------------------
# Async pipeline (no LangGraph required)
# ---------------------------------------------------------------------------


async def _run_pipeline_async(command: str, run_id: str) -> OrchestratorState:
    """Execute the full pipeline without LangGraph."""
    state: OrchestratorState = {
        "run_id": run_id,
        "command": command,
        "plan": {},
        "leads": [],
        "results": [],
        "errors": [],
        "leads_found": 0,
        "high_value": 0,
        "intent": "scrape",
        "done": False,
    }

    state = _planner_node(state)
    state = _scraper_node(state)
    state = _validator_node(state)
    state = _execute_node(state)
    state = _memory_node(state)
    return state


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def run_pipeline(
    command: str,
    run_id: str | None = None,
) -> dict[str, Any]:
    """
    Execute the full multi-agent pipeline asynchronously.

    Uses LangGraph when available; falls back to direct async execution.

    :param command: Natural-language command.
    :param run_id:  Optional run identifier.
    :returns: Result dict.
    """
    rid = run_id or str(int(time.time() * 1000))
    graph = _get_graph()

    if graph is not None:
        try:
            initial: OrchestratorState = {
                "run_id": rid,
                "command": command,
                "plan": {},
                "leads": [],
                "results": [],
                "errors": [],
                "leads_found": 0,
                "high_value": 0,
                "intent": "scrape",
                "done": False,
            }
            loop = asyncio.get_event_loop()
            final_state: OrchestratorState = await loop.run_in_executor(
                None, graph.invoke, initial
            )
            return _state_to_result(final_state, rid)
        except Exception as exc:
            logger.warning("LangGraph pipeline failed (%s) – falling back to async", exc)

    final_state = await _run_pipeline_async(command, rid)
    return _state_to_result(final_state, rid)


def run_pipeline_sync(
    command: str,
    run_id: str | None = None,
) -> dict[str, Any]:
    """
    Synchronous entry point for the multi-agent pipeline.

    :param command: Natural-language command.
    :param run_id:  Optional run identifier.
    :returns: Result dict.
    """
    rid = run_id or str(int(time.time() * 1000))
    graph = _get_graph()

    if graph is not None:
        try:
            initial: OrchestratorState = {
                "run_id": rid,
                "command": command,
                "plan": {},
                "leads": [],
                "results": [],
                "errors": [],
                "leads_found": 0,
                "high_value": 0,
                "intent": "scrape",
                "done": False,
            }
            final_state: OrchestratorState = graph.invoke(initial)
            return _state_to_result(final_state, rid)
        except Exception as exc:
            logger.warning("LangGraph sync pipeline failed (%s) – falling back", exc)

    # Sync fallback via shared async runner (handles running event loops safely)
    final_state = _run_async(_run_pipeline_async(command, rid))

    return _state_to_result(final_state, rid)


def _state_to_result(state: OrchestratorState, run_id: str) -> dict[str, Any]:
    errors = state.get("errors", [])
    n_results = len(state.get("results", []))
    return {
        "run_id": run_id,
        "success": not bool(errors),
        "leads_found": state.get("leads_found", 0),
        "high_value": state.get("high_value", 0),
        "message": f"Pipeline complete ({n_results} stage(s))",
        "errors": errors,
        "plan": state.get("plan", {}),
        "results": state.get("results", []),
        "intent": state.get("intent", "unknown"),
    }
