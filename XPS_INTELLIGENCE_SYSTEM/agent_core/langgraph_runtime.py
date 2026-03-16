"""
agent_core/langgraph_runtime.py
================================
LangGraph-based agent orchestration runtime.

Architecture::

    User Request
         ↓
    Planner Agent (builds TaskGraph)
         ↓
    Task Graph (LangGraph StateGraph)
         ↓
    Executor Agents (per step)
         ↓
    Memory Store

When LangGraph is not installed the runtime falls back to the
existing rule-based planner + executor pipeline so the system
can run in environments without the heavy AI dependencies.
"""

from __future__ import annotations

import logging
import time
from typing import Any, TypedDict

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# State schema (shared across all graph nodes)
# ---------------------------------------------------------------------------


class AgentState(TypedDict, total=False):
    """Shared state object passed between graph nodes."""

    command: str
    plan: dict[str, Any]
    results: list[dict[str, Any]]
    errors: list[str]
    leads_found: int
    high_value: int
    run_id: str
    done: bool


# ---------------------------------------------------------------------------
# Node implementations
# ---------------------------------------------------------------------------


def _plan_node(state: AgentState) -> AgentState:
    """Convert the raw command into a structured plan."""
    try:
        from .planner import plan as build_plan

        command = state.get("command", "")
        agent_plan = build_plan(command)
        return {
            **state,
            "plan": agent_plan.model_dump(),
        }
    except Exception as exc:
        logger.error("Plan node error: %s", exc)
        return {**state, "errors": state.get("errors", []) + [str(exc)]}


def _execute_node(state: AgentState) -> AgentState:
    """Execute each step in the plan."""
    plan_data = state.get("plan", {})
    errors: list[str] = list(state.get("errors", []))
    results: list[dict[str, Any]] = []
    leads_found = 0
    high_value = 0

    steps = plan_data.get("steps", [])
    for step in steps:
        tool = step.get("tool", "")
        try:
            result = _run_tool(tool, plan_data.get("command", {}))
            results.append({"tool": tool, **result})
            leads_found += result.get("leads_found", 0)
            high_value += result.get("high_value", 0)
        except Exception as exc:
            logger.error("Execute node tool=%s error=%s", tool, exc)
            errors.append(f"{tool}: {exc}")

    return {
        **state,
        "results": results,
        "errors": errors,
        "leads_found": leads_found,
        "high_value": high_value,
        "done": True,
    }


def _memory_node(state: AgentState) -> AgentState:
    """Persist run results to the memory layer."""
    try:
        from memory.memory_manager import MemoryManager

        mgr = MemoryManager()
        command = state.get("command", "")
        summary = (
            f"Command: {command} | "
            f"leads={state.get('leads_found', 0)} "
            f"high_value={state.get('high_value', 0)}"
        )
        mgr.remember(summary, metadata={"run_id": state.get("run_id", ""), "type": "run"})
        mgr.set(f"last_run:{state.get('run_id', 'latest')}", summary)
    except Exception as exc:
        logger.debug("Memory node error (non-fatal): %s", exc)

    return state


def _run_tool(tool: str, command: dict[str, Any]) -> dict[str, Any]:
    """Dispatch a single tool call and return its result dict."""
    from .executor import _TOOL_REGISTRY

    handler = _TOOL_REGISTRY.get(tool)
    if handler:
        return handler(command) or {}
    logger.debug("Tool '%s' not registered – returning empty result", tool)
    return {}


# ---------------------------------------------------------------------------
# Graph builder
# ---------------------------------------------------------------------------


def _build_graph():
    """Build and compile the LangGraph StateGraph."""
    try:
        from langgraph.graph import StateGraph, END  # type: ignore

        builder = StateGraph(AgentState)
        builder.add_node("plan", _plan_node)
        builder.add_node("execute", _execute_node)
        builder.add_node("memory", _memory_node)

        builder.set_entry_point("plan")
        builder.add_edge("plan", "execute")
        builder.add_edge("execute", "memory")
        builder.add_edge("memory", END)

        return builder.compile()
    except ImportError:
        logger.info("LangGraph not available – graph execution disabled")
        return None
    except Exception as exc:
        logger.warning("Failed to build LangGraph graph: %s", exc)
        return None


_COMPILED_GRAPH = None


def _get_graph():
    global _COMPILED_GRAPH
    if _COMPILED_GRAPH is None:
        _COMPILED_GRAPH = _build_graph()
    return _COMPILED_GRAPH


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def run_graph(command: str, run_id: str | None = None) -> dict[str, Any]:
    """
    Execute the full agent pipeline via LangGraph.

    Falls back to the legacy executor when LangGraph is unavailable.

    :param command: Natural-language command string.
    :param run_id:  Optional run identifier for state tracking.
    :returns: Result dict with success, leads_found, high_value, errors.
    """
    rid = run_id or str(int(time.time() * 1000))
    graph = _get_graph()

    if graph is not None:
        try:
            initial: AgentState = {
                "command": command,
                "plan": {},
                "results": [],
                "errors": [],
                "leads_found": 0,
                "high_value": 0,
                "run_id": rid,
                "done": False,
            }
            final_state: AgentState = graph.invoke(initial)
            return {
                "run_id": rid,
                "success": not bool(final_state.get("errors")),
                "leads_found": final_state.get("leads_found", 0),
                "high_value": final_state.get("high_value", 0),
                "message": f"Pipeline complete via LangGraph ({len(final_state.get('results', []))} steps)",
                "errors": final_state.get("errors", []),
                "retried": False,
            }
        except Exception as exc:
            logger.warning("LangGraph execution failed (%s) – falling back to legacy executor", exc)

    # Legacy fallback
    return _legacy_run(command, rid)


def _legacy_run(command: str, run_id: str) -> dict[str, Any]:
    """Run the legacy planner → executor pipeline."""
    try:
        from .planner import plan
        from .executor import Executor
        from .state_manager import StateManager

        sm = StateManager()
        ex = Executor(state_manager=sm)
        agent_plan = plan(command)
        result = ex.execute(agent_plan.command.model_dump(), agent_plan, run_id=run_id)
        return {
            "run_id": run_id,
            "success": result.success,
            "leads_found": result.leads_found,
            "high_value": result.high_value,
            "message": result.message,
            "errors": result.errors,
            "retried": result.retried,
        }
    except Exception as exc:
        logger.error("Legacy run failed: %s", exc)
        return {
            "run_id": run_id,
            "success": False,
            "leads_found": 0,
            "high_value": 0,
            "message": f"Pipeline error: {exc}",
            "errors": [str(exc)],
            "retried": False,
        }
