"""
agent_core/command_router.py
=============================
Routes natural-language commands to the appropriate agent type.

The router analyses the command text and returns a routing decision::

    {
        "agent": "scraper" | "code" | "frontend" | "backend" |
                 "github" | "interpreter" | "planner",
        "type":  "scrape" | "code" | ...
        "confidence": 0.0 – 1.0,
        "params": { ... extracted parameters ... }
    }
"""

from __future__ import annotations

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Routing rules (keyword → agent + task type)
# ---------------------------------------------------------------------------

_ROUTES: list[dict[str, Any]] = [
    {
        "keywords": ["scrape", "find companies", "find contractors", "search for", "discover leads",
                     "get leads", "collect", "harvest"],
        "agent": "scraper",
        "type": "scrape",
    },
    {
        "keywords": ["create page", "add page", "build ui", "generate ui", "modify component",
                     "add widget", "update dashboard", "create dashboard", "frontend"],
        "agent": "frontend",
        "type": "frontend",
    },
    {
        "keywords": ["add endpoint", "modify api", "update backend", "create api",
                     "new route", "backend", "server"],
        "agent": "backend",
        "type": "backend",
    },
    {
        "keywords": ["push to github", "open pr", "create pr", "commit", "pull request",
                     "sync repo", "trigger workflow", "github"],
        "agent": "github",
        "type": "github",
    },
    {
        "keywords": ["write code", "generate code", "implement", "refactor", "fix bug",
                     "create function", "code"],
        "agent": "code",
        "type": "code",
    },
    {
        "keywords": ["run script", "execute", "install", "pip install", "npm install",
                     "run command", "shell", "python", "bash"],
        "agent": "interpreter",
        "type": "interpret",
    },
    {
        "keywords": ["export leads", "export", "download", "csv"],
        "agent": "planner",
        "type": "export",
    },
    {
        "keywords": ["run outreach", "send email", "outreach campaign", "email"],
        "agent": "planner",
        "type": "outreach",
    },
    {
        "keywords": ["analytics", "dashboard", "lead analytics", "charts", "visualize"],
        "agent": "frontend",
        "type": "analytics",
    },
    {
        "keywords": ["predict", "forecast", "trend", "projection", "future", "estimate"],
        "agent": "prediction",
        "type": "predict",
    },
    {
        "keywords": ["simulate", "scenario", "what if", "model", "projection", "impact"],
        "agent": "simulation",
        "type": "simulate",
    },
    {
        "keywords": ["seo", "search engine", "meta tags", "keywords", "backlinks",
                     "sitemap", "structured data", "on-page", "ranking"],
        "agent": "seo",
        "type": "seo",
    },
    {
        "keywords": ["social media", "linkedin", "facebook", "instagram",
                     "social profile", "social presence", "hashtag", "post"],
        "agent": "social",
        "type": "social",
    },
    {
        "keywords": ["seo", "analyse website", "analyze website", "website analysis",
                     "meta tags", "page title", "contact info", "website seo"],
        "agent": "seo_agent",
        "type": "seo",
    },
    {
        "keywords": ["social media", "facebook", "instagram", "linkedin", "twitter",
                     "social profile", "find profile", "social presence"],
        "agent": "social_media_agent",
        "type": "social",
    },
    {
        "keywords": ["browser", "automate browser", "screenshot", "fill form", "type text",
                     "click button", "navigate to", "scroll page", "extract page"],
        "agent": "browser_automation_agent",
        "type": "browser",
    },
]

# ---------------------------------------------------------------------------
# Location / keyword extractors
# ---------------------------------------------------------------------------

_STATES = {
    "alabama", "alaska", "arizona", "arkansas", "california", "colorado",
    "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho",
    "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine",
    "maryland", "massachusetts", "michigan", "minnesota", "mississippi",
    "missouri", "montana", "nebraska", "nevada", "new hampshire", "new jersey",
    "new mexico", "new york", "north carolina", "north dakota", "ohio",
    "oklahoma", "oregon", "pennsylvania", "rhode island", "south carolina",
    "south dakota", "tennessee", "texas", "utah", "vermont", "virginia",
    "washington", "west virginia", "wisconsin", "wyoming",
}

_STATE_ABBR = {
    "al", "ak", "az", "ar", "ca", "co", "ct", "de", "fl", "ga", "hi",
    "id", "il", "in", "ia", "ks", "ky", "la", "me", "md", "ma", "mi",
    "mn", "ms", "mo", "mt", "ne", "nv", "nh", "nj", "nm", "ny", "nc",
    "nd", "oh", "ok", "or", "pa", "ri", "sc", "sd", "tn", "tx", "ut",
    "vt", "va", "wa", "wv", "wi", "wy",
}

_INDUSTRIES = [
    "epoxy", "flooring", "roofing", "concrete", "tile", "carpet",
    "painting", "plumbing", "electrical", "hvac", "construction",
    "contractor", "remodeling", "landscaping", "cleaning",
]


def _extract_location(text: str) -> dict[str, str]:
    """Extract city/state from command text."""
    lower = text.lower()
    city = ""
    state = ""

    # Check for "in/near <city> <state>" patterns (location can be anywhere in string)
    match = re.search(r"\b(?:in|near|around)\s+([a-zA-Z][a-zA-Z\s]{1,30}?)(?:\s+([a-z]{2}))?\s*(?:\b|$)", lower)
    if match:
        city = match.group(1).strip().title()
        state_raw = match.group(2)
        if state_raw and state_raw in _STATE_ABBR:
            state = state_raw.upper()

    # Check for known state names
    for st in _STATES:
        if st in lower:
            state = st.title()
            # Remove state from city candidate
            city = city.replace(st.title(), "").strip()
            break

    # Check for state abbreviations at end
    abbr_match = re.search(r"\b([a-z]{2})\s*$", lower)
    if abbr_match and abbr_match.group(1) in _STATE_ABBR and not state:
        state = abbr_match.group(1).upper()

    return {"city": city, "state": state}


def _extract_keyword(text: str) -> str:
    """Extract the industry/keyword from a command."""
    lower = text.lower()
    for ind in _INDUSTRIES:
        if ind in lower:
            return ind
    return "contractor"


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------


def route(command: str) -> dict[str, Any]:
    """
    Analyse *command* and return a routing decision.

    :returns: Dict with agent, type, confidence, params keys.
    """
    lower = command.lower().strip()
    best_agent = "planner"
    best_type = "plan"
    best_score = 0
    best_matches: list[str] = []

    for rule in _ROUTES:
        matches = [kw for kw in rule["keywords"] if kw in lower]
        if len(matches) > best_score:
            best_score = len(matches)
            best_agent = rule["agent"]
            best_type = rule["type"]
            best_matches = matches

    confidence = min(1.0, best_score / 2)
    location = _extract_location(command)
    keyword = _extract_keyword(command)

    logger.debug(
        "route: command=%r → agent=%s type=%s confidence=%.2f matches=%s",
        command,
        best_agent,
        best_type,
        confidence,
        best_matches,
    )

    return {
        "agent": best_agent,
        "type": best_type,
        "confidence": confidence,
        "matched_keywords": best_matches,
        "params": {
            "command": command,
            "keyword": keyword,
            **location,
        },
    }
