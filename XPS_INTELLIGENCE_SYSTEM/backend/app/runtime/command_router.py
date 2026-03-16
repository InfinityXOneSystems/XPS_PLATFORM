"""
app/runtime/command_router.py
==============================
Routes incoming commands to the correct agent and task type.

Extends the base agent_core routing with additional command types required
by the runtime command API (scrape_website, generate_code, seo_analysis, etc.).
"""

from __future__ import annotations

import logging
import re
from typing import Any, Callable, Dict, List

from app.runtime.command_schema import CommandType

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Routing table
# ---------------------------------------------------------------------------

_ROUTES: List[Dict[str, Any]] = [
    {
        "keywords": [
            "scrape",
            "find companies",
            "find contractors",
            "search for",
            "discover leads",
            "get leads",
            "collect",
            "harvest",
            "scrape website",
            "scrape site",
        ],
        "command_type": CommandType.SCRAPE_WEBSITE,
        "agent": "scraper",
    },
    {
        "keywords": [
            "generate code",
            "write code",
            "create function",
            "implement",
            "code",
            "develop",
            "build feature",
            "program",
        ],
        "command_type": CommandType.GENERATE_CODE,
        "agent": "code",
    },
    {
        "keywords": [
            "modify backend",
            "update backend",
            "change backend",
            "backend change",
            "api endpoint",
            "server side",
        ],
        "command_type": CommandType.MODIFY_BACKEND,
        "agent": "builder",
    },
    {
        "keywords": [
            "modify frontend",
            "update frontend",
            "change frontend",
            "ui change",
            "dashboard update",
            "component",
        ],
        "command_type": CommandType.MODIFY_FRONTEND,
        "agent": "builder",
    },
    {
        "keywords": [
            "create repo",
            "new repository",
            "init repo",
            "github repo",
            "create project",
        ],
        "command_type": CommandType.CREATE_REPO,
        "agent": "github",
    },
    {
        "keywords": [
            "run agent",
            "execute agent",
            "start agent",
            "launch agent",
            "agent run",
        ],
        "command_type": CommandType.RUN_AGENT,
        "agent": "supervisor",
    },
    {
        "keywords": [
            "post social",
            "social media",
            "tweet",
            "linkedin post",
            "instagram",
            "facebook post",
            "create post",
            "schedule post",
        ],
        "command_type": CommandType.POST_SOCIAL,
        "agent": "media",
    },
    {
        "keywords": [
            "seo",
            "seo analysis",
            "keyword analysis",
            "site audit",
            "backlink",
            "search engine",
            "organic traffic",
            "meta tags",
        ],
        "command_type": CommandType.SEO_ANALYSIS,
        "agent": "seo",
    },
    {
        "keywords": [
            "export leads",
            "export",
            "download",
            "csv",
            "spreadsheet",
        ],
        "command_type": CommandType.EXPORT,
        "agent": "planner",
    },
    {
        "keywords": [
            "run outreach",
            "send email",
            "outreach campaign",
            "email campaign",
            "follow up",
        ],
        "command_type": CommandType.OUTREACH,
        "agent": "outreach",
    },
    {
        "keywords": [
            "analytics",
            "dashboard",
            "lead analytics",
            "charts",
            "visualize",
            "statistics",
            "metrics",
        ],
        "command_type": CommandType.ANALYTICS,
        "agent": "planner",
    },
    {
        "keywords": [
            "predict",
            "forecast",
            "trend",
            "projection",
            "future estimate",
        ],
        "command_type": CommandType.PREDICT,
        "agent": "prediction",
    },
    {
        "keywords": [
            "simulate",
            "scenario",
            "what if",
            "model impact",
            "simulation",
        ],
        "command_type": CommandType.SIMULATE,
        "agent": "simulation",
    },
]

_INDUSTRIES = [
    "epoxy",
    "flooring",
    "roofing",
    "concrete",
    "tile",
    "carpet",
    "painting",
    "plumbing",
    "electrical",
    "hvac",
    "construction",
    "contractor",
    "remodeling",
    "landscaping",
    "cleaning",
]

_STATES = {
    "alabama",
    "alaska",
    "arizona",
    "arkansas",
    "california",
    "colorado",
    "connecticut",
    "delaware",
    "florida",
    "georgia",
    "hawaii",
    "idaho",
    "illinois",
    "indiana",
    "iowa",
    "kansas",
    "kentucky",
    "louisiana",
    "maine",
    "maryland",
    "massachusetts",
    "michigan",
    "minnesota",
    "mississippi",
    "missouri",
    "montana",
    "nebraska",
    "nevada",
    "new hampshire",
    "new jersey",
    "new mexico",
    "new york",
    "north carolina",
    "north dakota",
    "ohio",
    "oklahoma",
    "oregon",
    "pennsylvania",
    "rhode island",
    "south carolina",
    "south dakota",
    "tennessee",
    "texas",
    "utah",
    "vermont",
    "virginia",
    "washington",
    "west virginia",
    "wisconsin",
    "wyoming",
}

_STATE_ABBR = {
    "al",
    "ak",
    "az",
    "ar",
    "ca",
    "co",
    "ct",
    "de",
    "fl",
    "ga",
    "hi",
    "id",
    "il",
    "in",
    "ia",
    "ks",
    "ky",
    "la",
    "me",
    "md",
    "ma",
    "mi",
    "mn",
    "ms",
    "mo",
    "mt",
    "ne",
    "nv",
    "nh",
    "nj",
    "nm",
    "ny",
    "nc",
    "nd",
    "oh",
    "ok",
    "or",
    "pa",
    "ri",
    "sc",
    "sd",
    "tn",
    "tx",
    "ut",
    "vt",
    "va",
    "wa",
    "wv",
    "wi",
    "wy",
}


def _extract_location(text: str) -> Dict[str, str]:
    lower = text.lower()
    result: Dict[str, str] = {}

    for state in _STATES:
        if state in lower:
            result["state"] = state.title()
            break

    if "state" not in result:
        for abbr in _STATE_ABBR:
            if re.search(r"\b" + abbr + r"\b", lower):
                result["state"] = abbr.upper()
                break

    city_match = re.search(r"\bin\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)", text, re.IGNORECASE)
    if city_match:
        candidate = city_match.group(1)
        if candidate.lower() not in _STATES:
            result["city"] = candidate.title()

    return result


def _extract_keyword(text: str) -> str:
    lower = text.lower()
    for industry in _INDUSTRIES:
        if industry in lower:
            return industry
    return ""


def route(command: str) -> Dict[str, Any]:
    """
    Analyse *command* and return a routing decision.

    :returns: Dict with command_type, agent, confidence, params keys.
    """
    lower = command.lower().strip()
    best_agent = "planner"
    best_type = CommandType.UNKNOWN
    best_score = 0
    best_matches: List[str] = []

    for rule in _ROUTES:
        matches = [kw for kw in rule["keywords"] if kw in lower]
        if len(matches) > best_score:
            best_score = len(matches)
            best_agent = rule["agent"]
            best_type = rule["command_type"]
            best_matches = matches

    confidence = min(1.0, best_score / 2)
    location = _extract_location(command)
    keyword = _extract_keyword(command)

    logger.debug(
        "runtime_route command=%r → agent=%s type=%s confidence=%.2f",
        command,
        best_agent,
        best_type,
        confidence,
    )

    return {
        "command_type": best_type,
        "agent": best_agent,
        "confidence": confidence,
        "matched_keywords": best_matches,
        "params": {
            "command": command,
            "keyword": keyword,
            **location,
        },
    }


# ---------------------------------------------------------------------------
# Default handler registration
# ---------------------------------------------------------------------------


def _default_agent_handler(task: Dict[str, Any]) -> Dict[str, Any]:
    """Generic fallback handler used by all default agent registrations."""
    agent = task.get("agent", "unknown")
    task_id = task.get("task_id", "unknown")
    logger.info("default_agent_handler agent=%s task_id=%s", agent, task_id)
    return {
        "status": "acknowledged",
        "task_id": task_id,
        "agent": agent,
        "message": f"Task received by {agent} agent (default handler)",
    }


def _register_defaults() -> None:
    """Register default handlers for all known agents in the worker registry.

    Called once at application startup so that every agent name produced by
    :func:`route` has a handler in the worker node registry even before any
    specialised agent implementation replaces it.
    """
    try:
        from app.workers.worker_node import (
            register_handler,  # local import to avoid cycles
        )
    except ImportError:
        logger.warning(
            "_register_defaults: could not import worker_node.register_handler"
        )
        return

    _agents: List[str] = [
        "scraper",
        "code",
        "builder",
        "github",
        "supervisor",
        "media",
        "seo",
        "planner",
        "outreach",
        "prediction",
        "simulation",
    ]

    for agent_name in _agents:
        handler: Callable[[Dict[str, Any]], Dict[str, Any]] = (
            lambda task, _a=agent_name: _default_agent_handler({**task, "agent": _a})
        )
        register_handler(agent_name, handler)
        logger.debug("registered default handler for agent=%s", agent_name)

    logger.info(
        "_register_defaults: registered %d default agent handlers", len(_agents)
    )
