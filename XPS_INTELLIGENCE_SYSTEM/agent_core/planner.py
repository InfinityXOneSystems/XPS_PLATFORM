"""
planner.py – Planning agent.

Converts natural-language commands into structured Plan objects.

The planner uses a lightweight rule-based parser when LangGraph /
LangChain are not available, and falls back to the LangGraph graph
execution when they are.  This makes the module importable and
testable in environments where the heavy AI dependencies are absent.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional

from .validator import Command, Plan, PlanStep

logger = logging.getLogger("agent_core.planner")

# ---------------------------------------------------------------------------
# Keyword → step mapping (used by the rule-based fallback)
# ---------------------------------------------------------------------------

_KEYWORD_STEPS: List[Dict[str, Any]] = [
    {
        "keywords": ["scrape", "find", "search", "discover"],
        "tool": "playwright_scraper",
        "description": "Scrape contractor listings from online directories",
    },
    {
        "keywords": ["email", "contact", "reach"],
        "tool": "email_generator",
        "description": "Generate and discover business emails for leads",
    },
    {
        "keywords": ["score", "analyze", "rank", "evaluate"],
        "tool": "lead_analyzer",
        "description": "Score and analyze discovered leads",
    },
    {
        "keywords": ["schedule", "calendar", "follow"],
        "tool": "calendar_tool",
        "description": "Schedule follow-up outreach for qualified leads",
    },
]

_DEFAULT_STEPS: List[Dict[str, Any]] = [
    {
        "tool": "playwright_scraper",
        "description": "Scrape contractor listings from online directories",
    },
    {
        "tool": "lead_analyzer",
        "description": "Score and analyze discovered leads",
    },
]


# ---------------------------------------------------------------------------
# Rule-based planner (always available)
# ---------------------------------------------------------------------------


def _parse_command_text(text: str) -> Dict[str, str]:
    """
    Extract task / industry / location from a plain-text command.

    Examples accepted:
      "scrape epoxy contractors tampa"
      "find flooring contractors in ohio"
      "discover roofing leads chicago illinois"
    """
    text = text.strip().lower()

    # Industry: look for known industry keywords
    industries = [
        "epoxy", "flooring", "roofing", "concrete", "tile", "carpet",
        "painting", "plumbing", "electrical", "hvac", "construction",
        "contractor", "contractors",
    ]
    found_industry = "contractor"
    for kw in industries:
        if kw in text:
            found_industry = kw
            break

    # Location: last one or two words after known action words / "in" / "near"
    # Strategy: strip action words then take remaining tokens as location
    action_words = {
        "scrape", "find", "search", "discover", "get", "fetch",
        "generate", "run", "export", "leads", "lead",
    }
    tokens = re.sub(r"[,]", " ", text).split()
    location_tokens = [
        re.sub(r"[^a-zA-Z]", "", t)
        for t in tokens
        if t not in action_words and t not in industries and t != "in"
    ]
    location_tokens = [t for t in location_tokens if t]  # drop empty strings
    location = " ".join(location_tokens) if location_tokens else "usa"

    return {
        "task": text,
        "industry": found_industry,
        "location": location,
    }


def _build_steps(task_text: str, industry: str = "contractor", location: str = "usa") -> List[PlanStep]:
    """Build plan steps by matching task keywords to tool mappings."""
    task_lower = task_text.lower()
    matched: List[PlanStep] = []
    seen: set = set()

    for mapping in _KEYWORD_STEPS:
        if any(kw in task_lower for kw in mapping["keywords"]):
            tool = mapping["tool"]
            if tool not in seen:
                seen.add(tool)
                matched.append(
                    PlanStep(
                        tool=tool,
                        description=mapping["description"],
                        params={"task": task_text, "industry": industry, "location": location},
                    )
                )

    if not matched:
        # Default: scrape + analyze
        for d in _DEFAULT_STEPS:
            matched.append(
                PlanStep(
                    tool=d["tool"],
                    description=d["description"],
                    params={"task": task_text, "industry": industry, "location": location},
                )
            )

    return matched


def plan_from_text(command_text: str) -> Plan:
    """
    Convert a natural-language command string into a validated Plan.

    Raises ValueError if the resulting command fails Pydantic validation.
    """
    parsed = _parse_command_text(command_text)
    command = Command(**parsed)
    steps = _build_steps(command_text, industry=command.industry, location=command.location)
    return Plan(command=command, steps=steps)


# ---------------------------------------------------------------------------
# LangGraph-based planner (optional – requires langgraph + langchain)
# ---------------------------------------------------------------------------


def _try_build_langgraph_planner() -> Optional[Any]:
    """
    Attempt to construct a LangGraph StateGraph planner.

    Returns the compiled graph if dependencies are available, else None.
    """
    try:
        from langgraph.graph import StateGraph, END  # type: ignore
        from langchain_core.messages import HumanMessage  # type: ignore
        from typing import TypedDict

        class PlannerState(TypedDict):
            command_text: str
            plan: Optional[Dict[str, Any]]

        def parse_node(state: PlannerState) -> PlannerState:
            plan = plan_from_text(state["command_text"])
            return {**state, "plan": plan.model_dump()}

        graph: StateGraph = StateGraph(PlannerState)
        graph.add_node("parse", parse_node)
        graph.set_entry_point("parse")
        graph.add_edge("parse", END)
        return graph.compile()

    except ImportError:
        logger.debug("LangGraph not available – using rule-based planner")
        return None


_langgraph_planner: Optional[Any] = None
_langgraph_checked: bool = False


def plan(command_text: str) -> Plan:
    """
    Primary entry point – produce a Plan from a natural-language command.

    Uses LangGraph when available, falls back to the rule-based planner.
    """
    global _langgraph_planner, _langgraph_checked

    if not _langgraph_checked:
        _langgraph_planner = _try_build_langgraph_planner()
        _langgraph_checked = True

    if _langgraph_planner is not None:
        try:
            result = _langgraph_planner.invoke({"command_text": command_text, "plan": None})
            raw_plan = result.get("plan") or {}
            if raw_plan:
                return Plan(**raw_plan)
        except Exception as exc:
            logger.warning("LangGraph planner failed (%s), falling back", exc)

    return plan_from_text(command_text)
