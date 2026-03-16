"""
backend/app/api/v1/multi_agent.py
===================================
Multi-Agent Chat API — orchestrate multiple specialised agents in a shared
conversation thread.

Each message goes to one or more active agents.  The orchestrator decomposes
complex requests into sub-tasks, dispatches them in parallel, and assembles
the results into a unified response thread.

Endpoints:
  POST /multi-agent/sessions          — create a new multi-agent session
  GET  /multi-agent/sessions          — list active sessions
  GET  /multi-agent/sessions/{id}     — get session with full message history
  POST /multi-agent/sessions/{id}/message — send a message; get agent replies
  DELETE /multi-agent/sessions/{id}   — close session
  GET  /multi-agent/agents            — list available agent profiles
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/multi-agent", tags=["multi_agent"])

# ---------------------------------------------------------------------------
# Agent registry
# ---------------------------------------------------------------------------

AGENT_PROFILES: List[Dict[str, Any]] = [
    {
        "id": "orchestrator",
        "name": "Orchestrator",
        "icon": "🧠",
        "color": "#FFD700",
        "description": "Plans and coordinates all agent tasks. Decomposes complex requests.",
        "capabilities": ["planning", "coordination", "task_decomposition", "pipeline"],
        "command_type": "RUN_AGENT",
    },
    {
        "id": "scraper",
        "name": "Scraper",
        "icon": "🕷️",
        "color": "#3b82f6",
        "description": "Web scraping, lead discovery, Google Maps, Yelp, directories.",
        "capabilities": ["scrape", "leads", "google_maps", "yelp", "web_data"],
        "command_type": "SCRAPE_WEBSITE",
    },
    {
        "id": "code",
        "name": "Code Agent",
        "icon": "💻",
        "color": "#4ade80",
        "description": "Code generation, refactoring, debugging, full-stack dev.",
        "capabilities": ["generate_code", "debug", "refactor", "frontend", "backend"],
        "command_type": "GENERATE_CODE",
    },
    {
        "id": "builder",
        "name": "Builder",
        "icon": "🏗️",
        "color": "#f59e0b",
        "description": "Frontend and backend modifications, UI generation.",
        "capabilities": ["modify_frontend", "modify_backend", "ui", "components"],
        "command_type": "MODIFY_FRONTEND",
    },
    {
        "id": "crm",
        "name": "CRM Agent",
        "icon": "🗂️",
        "color": "#f97316",
        "description": "Lead management, pipeline stages, outreach, follow-up.",
        "capabilities": ["crm", "outreach", "follow_up", "pipeline", "contacts"],
        "command_type": "OUTREACH",
    },
    {
        "id": "seo",
        "name": "SEO Agent",
        "icon": "🔍",
        "color": "#8b5cf6",
        "description": "SEO audits, keyword research, content strategy.",
        "capabilities": ["seo", "keywords", "audit", "content", "backlinks"],
        "command_type": "SEO_ANALYSIS",
    },
    {
        "id": "media",
        "name": "Media Agent",
        "icon": "🎨",
        "color": "#ec4899",
        "description": "Image generation, video creation, social media content.",
        "capabilities": ["image", "video", "social", "content", "design"],
        "command_type": "POST_SOCIAL",
    },
    {
        "id": "github",
        "name": "GitHub Agent",
        "icon": "🐙",
        "color": "#94a3b8",
        "description": "Repo management, PRs, workflow dispatch, code review.",
        "capabilities": ["repo", "pr", "commit", "actions", "review"],
        "command_type": "CREATE_REPO",
    },
    {
        "id": "analytics",
        "name": "Analytics Agent",
        "icon": "📊",
        "color": "#06b6d4",
        "description": "Lead analytics, reports, forecasting, trend analysis.",
        "capabilities": ["analytics", "reports", "charts", "forecast", "metrics"],
        "command_type": "ANALYTICS",
    },
]

AGENT_BY_ID = {a["id"]: a for a in AGENT_PROFILES}

# ---------------------------------------------------------------------------
# In-memory session store
# ---------------------------------------------------------------------------

_SESSIONS: Dict[str, Dict[str, Any]] = {}


def _new_session(agents: List[str], title: str = "") -> Dict[str, Any]:
    sid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": sid,
        "title": title or f"Session {sid[:8]}",
        "created_at": now,
        "updated_at": now,
        "active_agents": agents,
        "messages": [
            {
                "id": str(uuid.uuid4()),
                "role": "system",
                "agent_id": "orchestrator",
                "agent_name": "Orchestrator",
                "content": (
                    f"🧠 Multi-agent session started with {len(agents)} agents: "
                    + ", ".join(agents)
                    + ".\n\nType a message or @mention a specific agent."
                ),
                "timestamp": now,
                "metadata": {},
            }
        ],
    }


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class CreateSessionRequest(BaseModel):
    agents: List[str] = ["orchestrator", "scraper", "code", "crm"]
    title: Optional[str] = None


class SendMessageRequest(BaseModel):
    content: str
    target_agents: Optional[List[str]] = None  # None = broadcast to all active


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _extract_mentions(content: str, active_agents: List[str]) -> List[str]:
    """Extract @agent mentions from message content."""
    mentioned = []
    for aid in active_agents:
        if f"@{aid}" in content.lower():
            mentioned.append(aid)
    return mentioned or active_agents


async def _dispatch_to_agent(
    agent_id: str, user_message: str, session: Dict
) -> Dict[str, Any]:
    """Dispatch message to an agent and return its reply."""
    agent = AGENT_BY_ID.get(agent_id)
    if not agent:
        return {"error": f"Unknown agent: {agent_id}"}

    now = datetime.now(timezone.utc).isoformat()

    # Try to call the runtime API
    try:
        from app.runtime.command_schema import CommandRequest
        from app.runtime.runtime_controller import RuntimeController

        controller = RuntimeController.get_instance()
        cmd = CommandRequest(command=user_message, priority=5)
        result = await asyncio.wait_for(controller.handle_command(cmd), timeout=30)
        content = (
            f"✅ Task `{result.get('task_id', '')[:8]}` queued\n"
            f"Status: {result.get('status', 'queued')}\n"
            f"Agent: {agent['name']}"
        )
        metadata = result
    except Exception as e:
        # Fallback: generate a contextual response
        content = _generate_agent_response(agent, user_message)
        metadata = {"fallback": True, "error": str(e)}

    return {
        "id": str(uuid.uuid4()),
        "role": "assistant",
        "agent_id": agent_id,
        "agent_name": agent["name"],
        "agent_icon": agent["icon"],
        "agent_color": agent["color"],
        "content": content,
        "timestamp": now,
        "metadata": metadata,
    }


def _generate_agent_response(agent: Dict, user_message: str) -> str:
    """Generate a contextual placeholder response for an agent."""
    msg_lower = user_message.lower()
    aid = agent["id"]

    if aid == "orchestrator":
        return (
            "🧠 **Orchestrator** — Breaking down your request:\n\n"
            f"1. Parsing intent from: `{user_message[:60]}…`\n"
            "2. Routing sub-tasks to relevant agents\n"
            "3. Will aggregate results and report back\n\n"
            "_Dispatching to active agents…_"
        )
    if aid == "scraper":
        location = "the area"
        for word in [
            "miami",
            "pompano",
            "fort lauderdale",
            "boca raton",
            "orlando",
            "fl",
            "florida",
        ]:
            if word in msg_lower:
                location = word.title()
                break
        return (
            "🕷️ **Scraper Agent** — Starting lead discovery\n\n"
            f"• Target: `{location}`\n"
            "• Sources: Google Maps, Yelp, directories\n"
            "• Mode: Parallel asyncio (8 concurrent targets)\n"
            "• Output: leads/crm_contacts.json + LEADS repo push\n\n"
            f"_Run: `scrape epoxy contractors in {location}` to trigger_"
        )
    if aid == "code":
        return (
            "💻 **Code Agent** — Ready to generate code\n\n"
            "• Language: Auto-detected from context\n"
            "• Mode: Full-stack (frontend + backend)\n"
            "• Output will appear in the Universal Editor\n\n"
            "_Specify: language, framework, function signature_"
        )
    if aid == "builder":
        return (
            "🏗️ **Builder Agent** — UI/backend modification ready\n\n"
            "• Can modify: Next.js pages, Python APIs, React components\n"
            "• Respects: existing patterns and conventions\n"
            "• Preview: Universal Editor → HTML Preview mode\n\n"
            "_Describe what you want built or changed_"
        )
    if aid == "crm":
        return (
            "🗂️ **CRM Agent** — Lead pipeline active\n\n"
            "• CRM contacts: available at /api/v1/crm/\n"
            "• Stages: new → contacted → interested → proposal → won\n"
            "• Outreach: email, SMS, voice, follow-up\n\n"
            "_Commands: move to stage, log outreach, add note, export CSV_"
        )
    if aid == "seo":
        return (
            "🔍 **SEO Agent** — Analysis ready\n\n"
            "• Capabilities: site audit, keyword research, backlinks\n"
            "• API: POST /api/v1/runtime/command with 'seo analysis'\n\n"
            "_Provide a URL or domain to analyse_"
        )
    if aid == "media":
        return (
            "🎨 **Media Agent** — Creative suite ready\n\n"
            "• Image generation via AI prompts\n"
            "• Video storyboard creation\n"
            "• Social media content calendar\n\n"
            "_Describe what you want created_"
        )
    if aid == "github":
        return (
            "🐙 **GitHub Agent** — Repository access ready\n\n"
            "• Can: create repos, dispatch workflows, commit code, open PRs\n"
            "• Repos: XPS_INTELLIGENCE_SYSTEM, LEADS, XPS-INTELLIGENCE-FRONTEND\n\n"
            "_Specify: repo, action, branch_"
        )
    if aid == "analytics":
        return (
            "📊 **Analytics Agent** — Metrics ready\n\n"
            "• Lead scoring distribution\n"
            "• Pipeline conversion rates\n"
            "• Outreach performance\n"
            "• Available at: /analytics\n\n"
            "_Ask for specific metrics or reports_"
        )
    return f"{agent['icon']} **{agent['name']}** — Processing: `{user_message[:80]}`"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/agents", summary="List all available agent profiles")
def list_agents() -> List[Dict[str, Any]]:
    return AGENT_PROFILES


@router.post("/sessions", summary="Create a new multi-agent session")
def create_session(req: CreateSessionRequest) -> Dict[str, Any]:
    # Validate agent IDs
    invalid = [a for a in req.agents if a not in AGENT_BY_ID]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Unknown agent IDs: {invalid}")
    session = _new_session(req.agents, req.title)
    _SESSIONS[session["id"]] = session
    return session


@router.get("/sessions", summary="List all active sessions")
def list_sessions() -> List[Dict[str, Any]]:
    return [{k: v for k, v in s.items() if k != "messages"} for s in _SESSIONS.values()]


@router.get("/sessions/{session_id}", summary="Get session with full message history")
def get_session(session_id: str) -> Dict[str, Any]:
    if session_id not in _SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found")
    return _SESSIONS[session_id]


@router.post("/sessions/{session_id}/message", summary="Send a message to the session")
async def send_message(session_id: str, req: SendMessageRequest) -> Dict[str, Any]:
    if session_id not in _SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found")

    session = _SESSIONS[session_id]
    now = datetime.now(timezone.utc).isoformat()

    # Add user message
    user_msg = {
        "id": str(uuid.uuid4()),
        "role": "user",
        "agent_id": None,
        "agent_name": "You",
        "content": req.content,
        "timestamp": now,
        "metadata": {},
    }
    session["messages"].append(user_msg)

    # Determine target agents
    if req.target_agents:
        targets = [a for a in req.target_agents if a in session["active_agents"]]
    else:
        targets = _extract_mentions(req.content, session["active_agents"])

    # Dispatch to agents in parallel
    replies = await asyncio.gather(
        *[_dispatch_to_agent(aid, req.content, session) for aid in targets],
        return_exceptions=True,
    )

    agent_replies = []
    for r in replies:
        if isinstance(r, Exception):
            logger.warning("agent_dispatch_error", extra={"error": str(r)})
            continue
        if isinstance(r, dict) and "content" in r:
            session["messages"].append(r)
            agent_replies.append(r)

    session["updated_at"] = datetime.now(timezone.utc).isoformat()
    _SESSIONS[session_id] = session

    return {
        "user_message": user_msg,
        "agent_replies": agent_replies,
        "session_id": session_id,
        "message_count": len(session["messages"]),
    }


@router.delete("/sessions/{session_id}", summary="Close a session")
def close_session(session_id: str) -> Dict[str, Any]:
    if session_id not in _SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found")
    removed = _SESSIONS.pop(session_id)
    return {"success": True, "closed": removed["title"]}
