"""
agents/planner.py
=================
Natural-language command parser and LangGraph task-plan builder.

Given a command like "scrape epoxy contractors tampa" it produces
an ordered list of tasks that the orchestrator will execute.
"""

from __future__ import annotations

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Intent → task-list mappings
# ---------------------------------------------------------------------------

US_STATES = {
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
    "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
    "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
    "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
    "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
    "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS",
    "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV",
    "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
    "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK",
    "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
    "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
    "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV",
    "wisconsin": "WI", "wyoming": "WY", "tampa": "FL", "miami": "FL",
    "chicago": "IL", "dallas": "TX", "houston": "TX", "phoenix": "AZ",
    "seattle": "WA", "denver": "CO", "atlanta": "GA", "boston": "MA",
    "portland": "OR", "nashville": "TN", "charlotte": "NC", "columbus": "OH",
    "cleveland": "OH", "cincinnati": "OH",
}

INDUSTRY_KEYWORDS = [
    "epoxy", "flooring", "tile", "hardwood", "carpet", "concrete", "painting",
    "roofing", "plumbing", "electrical", "hvac", "landscaping", "cleaning",
    "remodeling", "construction", "contractor",
]


def _detect_intent(command: str) -> str:
    cmd = command.lower()
    words = set(re.split(r"\W+", cmd))
    # "status / health / check" takes priority over substring matches
    if any(w in words for w in ["status", "health"]) or (
        "check" in words and "scraper" not in words
    ):
        return "status"
    if any(w in words for w in ["scrape", "scraping"]) or any(
        w in cmd for w in ["find contractors", "search contractors", "discover leads", "get leads"]
    ):
        return "scrape"
    if any(w in cmd for w in ["outreach", "campaign"]) or (
        "email" in words and "generate" not in words
    ):
        return "outreach"
    if any(w in cmd for w in ["top leads", "show leads", "best leads", "high score"]):
        return "show_leads"
    if any(w in words for w in ["export", "csv", "download"]):
        return "export"
    if any(w in cmd for w in ["pipeline", "run all", "run pipeline"]):
        return "pipeline"
    if any(w in words for w in ["generate", "create", "write", "analyze"]):
        return "generate"
    return "unknown"


def _extract_location(command: str) -> tuple[str, str]:
    """Return (city, state_abbrev) from the command string."""
    words = command.lower().split()
    city = ""
    state = ""
    for i, w in enumerate(words):
        # two-word state/city
        two = f"{w} {words[i+1]}" if i + 1 < len(words) else ""
        if two in US_STATES:
            city = two.title()
            state = US_STATES[two]
            break
        if w in US_STATES:
            # could be a city name that maps to a state
            city = w.title()
            state = US_STATES[w]
    return city, state


def _extract_keyword(command: str) -> str:
    """Return industry keyword extracted from command."""
    cmd = command.lower()
    for kw in INDUSTRY_KEYWORDS:
        if kw in cmd:
            return kw
    # Fallback: words after 'scrape/find/search'
    m = re.search(r"(?:scrape|find|search|discover)\s+(.+?)(?:\s+in\s+|\s+near\s+|\s+\w+,\s*|$)", cmd)
    if m:
        return m.group(1).strip()
    return "contractor"


def build_task_plan(command: str) -> dict[str, Any]:
    """
    Parse *command* and return a task plan dict.

    Returned structure::

        {
            "intent": "scrape",
            "command": "scrape epoxy contractors tampa",
            "tasks": [
                {"id": 1, "name": "scrape_google_maps", "params": {...}},
                ...
            ]
        }
    """
    intent = _detect_intent(command)
    city, state = _extract_location(command)
    keyword = _extract_keyword(command)

    logger.info("Plan: intent=%s keyword=%s city=%s state=%s", intent, keyword, city, state)

    if intent == "scrape":
        tasks = [
            {"id": 1, "name": "scrape_google_maps",   "params": {"keyword": keyword, "city": city, "state": state}},
            {"id": 2, "name": "extract_company_data",  "params": {}},
            {"id": 3, "name": "score_opportunities",   "params": {}},
            {"id": 4, "name": "return_results",        "params": {}},
        ]
    elif intent == "outreach":
        tasks = [
            {"id": 1, "name": "load_top_leads",       "params": {"min_score": 50}},
            {"id": 2, "name": "generate_emails",      "params": {"template": "default"}},
            {"id": 3, "name": "send_outreach_batch",  "params": {"dry_run": True}},
            {"id": 4, "name": "return_results",       "params": {}},
        ]
    elif intent == "show_leads":
        tasks = [
            {"id": 1, "name": "load_top_leads",  "params": {"limit": 10}},
            {"id": 2, "name": "return_results",  "params": {}},
        ]
    elif intent == "export":
        tasks = [
            {"id": 1, "name": "export_csv",      "params": {}},
            {"id": 2, "name": "return_results",  "params": {}},
        ]
    elif intent == "pipeline":
        tasks = [
            {"id": 1, "name": "trigger_workflow", "params": {"workflow_id": "lead_pipeline.yml"}},
            {"id": 2, "name": "return_results",   "params": {}},
        ]
    elif intent == "status":
        tasks = [
            {"id": 1, "name": "system_status",  "params": {}},
            {"id": 2, "name": "return_results", "params": {}},
        ]
    elif intent == "generate":
        tasks = [
            {"id": 1, "name": "open_interpreter", "params": {"prompt": command}},
            {"id": 2, "name": "return_results",   "params": {}},
        ]
    else:
        tasks = [
            {"id": 1, "name": "open_interpreter", "params": {"prompt": command}},
            {"id": 2, "name": "return_results",   "params": {}},
        ]

    return {"intent": intent, "command": command, "keyword": keyword, "city": city, "state": state, "tasks": tasks}
