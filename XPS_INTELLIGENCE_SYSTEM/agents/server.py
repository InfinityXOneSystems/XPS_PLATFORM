"""
agents/server.py
================
FastAPI agent server — exposes POST /agent/run for the dashboard UI.

Start with:
    uvicorn agents.server:app --host 0.0.0.0 --port 8000 --reload

Or via the helper script:
    python agents/server.py
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path
from typing import Any

# Ensure the repo root is on sys.path so `agents.*` imports resolve.
ROOT = Path(__file__).parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="XPS Intelligence Agent API",
    description="AI orchestration backend for the XPS lead intelligence platform.",
    version="1.0.0",
)

# Allow the Next.js dev server and GitHub Pages to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class AgentRequest(BaseModel):
    command: str


class AgentResponse(BaseModel):
    success: bool
    command: str
    intent: str
    summary: str
    leads_count: int
    leads: list[dict[str, Any]] = []
    output: dict[str, Any] = {}
    error: str | None = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/")
async def root() -> dict[str, Any]:
    return {
        "service": "XPS Intelligence Agent API",
        "version": "1.0.0",
        "endpoints": {
            "POST /agent/run": "Execute a natural-language command",
            "GET  /agent/health": "Health check",
            "GET  /agent/status": "System status",
        },
    }


@app.get("/agent/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "xps-agent-server"}


@app.get("/agent/status")
async def status() -> dict[str, Any]:
    from agents.orchestrator import _count_leads, _load_state
    mem = _load_state()
    return {
        "leads_on_disk": _count_leads(),
        "last_command": mem.get("last_command"),
        "last_run": mem.get("last_run"),
        "pipeline_runs": mem.get("pipeline_runs", 0),
    }


@app.post("/agent/run", response_model=AgentResponse)
async def run_agent(req: AgentRequest) -> AgentResponse:
    """
    Execute a natural-language command through the full agent pipeline.

    Example request body::

        {"command": "scrape epoxy contractors tampa"}

    The server will:
    1. Parse the command into an intent + task plan (planner.py)
    2. Execute all tasks via the orchestrator (orchestrator.py)
    3. Return structured JSON results
    """
    if not req.command.strip():
        raise HTTPException(status_code=400, detail="command must not be empty")

    logger.info("Received command: %s", req.command)

    from agents.planner import build_task_plan
    from agents.orchestrator import run_plan

    plan = build_task_plan(req.command)
    state = await run_plan(plan)

    leads = state.get("leads", [])
    hot_leads = [l for l in leads if (l.get("lead_score") or 0) >= 35]

    # Build human-readable summary
    intent = plan.get("intent", "unknown")
    if intent == "scrape":
        summary = (
            f"{len(leads)} companies discovered, "
            f"{len(hot_leads)} high opportunity, "
            f"city: {plan.get('city') or 'unknown'}"
        )
    elif intent == "outreach":
        out = state.get("output", {}).get("outreach", {})
        summary = f"Outreach queued: {out.get('queued', 0)}, sent: {out.get('sent', 0)}"
    elif intent == "show_leads":
        summary = f"Top {len(leads)} leads loaded from database"
    elif intent == "export":
        rows = state.get("output", {}).get("csv_rows", 0)
        summary = f"CSV export ready — {rows} rows"
    elif intent == "pipeline":
        wf = state.get("output", {}).get("workflow", {})
        summary = f"Pipeline triggered: {wf.get('workflow', 'lead_pipeline.yml')}"
    elif intent == "status":
        summary = "System status report generated"
    else:
        interp = state.get("output", {}).get("interpreter", "")
        summary = interp[:200] if interp else f"Command processed: {req.command}"

    return AgentResponse(
        success=state.get("error") is None,
        command=req.command,
        intent=intent,
        summary=summary,
        leads_count=len(leads),
        leads=leads[:20],  # return up to 20 leads in response
        output=state.get("output", {}),
        error=state.get("error"),
    )


# ---------------------------------------------------------------------------
# Dev entry-point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("AGENT_PORT", "8000"))
    logger.info("Starting XPS Agent Server on port %d", port)
    uvicorn.run("agents.server:app", host="0.0.0.0", port=port, reload=True)
