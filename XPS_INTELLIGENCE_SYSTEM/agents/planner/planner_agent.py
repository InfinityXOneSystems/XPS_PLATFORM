"""
agents/planner/planner_agent.py
================================
PlannerAgent – parses natural-language commands and decomposes them
into ordered task plans for the orchestration pipeline.

Architecture::

    command (str)
         ↓
    intent detection
         ↓
    entity extraction (keyword, city, state, industry …)
         ↓
    task decomposition → list[TaskStep]
         ↓
    Plan dict (consumed by orchestrator / LangGraph nodes)

The agent attempts to use the ``agent_core.planner`` rule-based
planner first and falls back to its own lightweight implementation
when that module is unavailable.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Industry / location helpers (mirrors agent_core.planner / agents.planner)
# ---------------------------------------------------------------------------

_INDUSTRY_KEYWORDS = [
    "epoxy", "flooring", "tile", "hardwood", "carpet", "concrete", "painting",
    "roofing", "plumbing", "electrical", "hvac", "landscaping", "cleaning",
    "remodeling", "construction", "contractor",
]

_CITY_STATE_MAP: dict[str, str] = {
    "tampa": "FL", "miami": "FL", "orlando": "FL", "jacksonville": "FL",
    "chicago": "IL", "dallas": "TX", "houston": "TX", "phoenix": "AZ",
    "seattle": "WA", "denver": "CO", "atlanta": "GA", "boston": "MA",
    "portland": "OR", "nashville": "TN", "charlotte": "NC", "columbus": "OH",
    "cleveland": "OH", "cincinnati": "OH", "los angeles": "CA", "san francisco": "CA",
    "new york": "NY", "detroit": "MI", "minneapolis": "MN", "memphis": "TN",
}

_INTENT_MAP: dict[str, list[str]] = {
    "scrape": ["scrape", "find", "discover", "search", "get leads", "collect"],
    "export": ["export", "download", "csv", "report"],
    "outreach": ["outreach", "email", "contact", "send", "campaign"],
    "status": ["status", "health", "check", "monitor"],
    "score": ["score", "rank", "tier", "qualify"],
    "enrich": ["enrich", "lookup", "find email", "discover email"],
    "build": ["build", "scaffold", "generate", "create module"],
    "deploy": ["deploy", "release", "push to production"],
}


def _detect_intent(command: str) -> str:
    lower = command.lower()
    for intent, triggers in _INTENT_MAP.items():
        if any(t in lower for t in triggers):
            return intent
    return "scrape"


def _extract_entities(command: str) -> dict[str, str]:
    """Extract keyword, city, state, industry from a command string."""
    lower = command.lower()

    industry = next((kw for kw in _INDUSTRY_KEYWORDS if kw in lower), "contractor")

    city = ""
    state = ""
    for city_name, st in _CITY_STATE_MAP.items():
        if city_name in lower:
            city = city_name.title()
            state = st
            break

    state_abbr_match = re.search(r'\b([A-Z]{2})\b', command)
    if state_abbr_match and not state:
        state = state_abbr_match.group(1)

    keyword = industry
    return {"keyword": keyword, "city": city, "state": state, "industry": industry}


# ---------------------------------------------------------------------------
# Task plan builders
# ---------------------------------------------------------------------------

def _build_scrape_plan(entities: dict[str, str], command: str) -> list[dict[str, Any]]:
    return [
        {
            "name": "scrape_google_maps",
            "params": {
                "keyword": entities["keyword"],
                "city": entities["city"],
                "state": entities["state"],
            },
            "description": f"Scrape Google Maps for {entities['keyword']} in {entities['city']}",
        },
        {
            "name": "score_opportunities",
            "params": {},
            "description": "Score scraped leads by quality signals",
        },
        {
            "name": "return_results",
            "params": {},
            "description": "Return final scored lead list",
        },
    ]


def _build_export_plan(entities: dict[str, str], command: str) -> list[dict[str, Any]]:
    return [
        {"name": "load_top_leads", "params": {"min_score": 0, "limit": 100}, "description": "Load top leads"},
        {"name": "export_csv", "params": {}, "description": "Export leads as CSV"},
        {"name": "return_results", "params": {}, "description": "Return CSV output"},
    ]


def _build_outreach_plan(entities: dict[str, str], command: str) -> list[dict[str, Any]]:
    return [
        {"name": "load_top_leads", "params": {"min_score": 30}, "description": "Load high-quality leads"},
        {"name": "generate_emails", "params": {"template": "default"}, "description": "Generate outreach emails"},
        {"name": "send_outreach_batch", "params": {"dry_run": True}, "description": "Send outreach emails"},
        {"name": "return_results", "params": {}, "description": "Return outreach summary"},
    ]


def _build_status_plan(entities: dict[str, str], command: str) -> list[dict[str, Any]]:
    return [
        {"name": "system_status", "params": {}, "description": "Check system status"},
        {"name": "return_results", "params": {}, "description": "Return status report"},
    ]


_PLAN_BUILDERS = {
    "scrape": _build_scrape_plan,
    "export": _build_export_plan,
    "outreach": _build_outreach_plan,
    "status": _build_status_plan,
}


# ---------------------------------------------------------------------------
# PlannerAgent
# ---------------------------------------------------------------------------


class PlannerAgent(BaseAgent):
    """
    Parses natural-language commands and produces structured task plans.

    Example::

        agent = PlannerAgent()
        result = await agent.run("scrape epoxy contractors orlando florida")
        plan = result["plan"]

    The returned ``plan`` dict is compatible with both the LangGraph
    orchestrator and the legacy ``agents/orchestrator.py`` runner.
    """

    agent_name = "planner"

    async def execute(
        self,
        task: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Parse *task["command"]* and return a structured plan.

        :returns: ``{"success": True, "plan": {...}, "intent": str, "entities": {...}}``
        """
        command = task.get("command", "")
        logger.info("PlannerAgent.execute: %r", command)

        plan = await self._build_plan(command)
        return {
            "success": True,
            "plan": plan,
            "intent": plan.get("intent", "unknown"),
            "entities": plan.get("entities", {}),
            "message": f"Plan created: {len(plan.get('tasks', []))} tasks",
        }

    async def _build_plan(self, command: str) -> dict[str, Any]:
        """
        Attempt to use ``agent_core.planner`` first; fall back to
        the built-in rule-based planner.
        """
        # Prefer agent_core.planner when available
        try:
            from agent_core.planner import plan as core_plan

            core_result = core_plan(command)
            plan_dict = core_result.model_dump() if hasattr(core_result, "model_dump") else {}
            if plan_dict:
                # Normalise to the orchestrator task format
                tasks = [
                    {
                        "name": step.get("tool", ""),
                        "params": step.get("params", {}),
                        "description": step.get("description", ""),
                    }
                    for step in plan_dict.get("steps", [])
                ]
                return {
                    "command": command,
                    "intent": plan_dict.get("intent", _detect_intent(command)),
                    "entities": _extract_entities(command),
                    "tasks": tasks,
                    "source": "agent_core.planner",
                }
            logger.warning(
                "agent_core.planner returned unexpected type %s – falling back",
                type(core_result).__name__,
            )
        except Exception as exc:
            logger.debug("agent_core.planner unavailable (%s) – using built-in planner", exc)

        # Built-in rule-based planner
        intent = _detect_intent(command)
        entities = _extract_entities(command)
        builder = _PLAN_BUILDERS.get(intent, _build_scrape_plan)
        tasks = builder(entities, command)

        return {
            "command": command,
            "intent": intent,
            "entities": entities,
            "tasks": tasks,
            "source": "built-in",
        }

    def capabilities(self) -> list[str]:
        return ["intent_detection", "entity_extraction", "task_decomposition", "plan_generation"]
