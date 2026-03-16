"""
agents/orchestrator.py
======================
LangGraph-based orchestrator that executes a task plan produced by planner.py.

Each task node in the graph calls the appropriate tool and accumulates results
into a shared AgentState.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, TypedDict

logger = logging.getLogger(__name__)

STATE_FILE = Path(__file__).parent / "memory" / "state.json"
LOG_DIR = Path(__file__).parent.parent / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Agent state
# ---------------------------------------------------------------------------

class AgentState(TypedDict, total=False):
    command: str
    plan: dict[str, Any]
    leads: list[dict[str, Any]]
    emails: list[dict[str, Any]]
    output: dict[str, Any]
    error: str | None


# ---------------------------------------------------------------------------
# Persistent memory helpers
# ---------------------------------------------------------------------------

def _load_state() -> dict[str, Any]:
    try:
        return json.loads(STATE_FILE.read_text())
    except Exception:
        return {}


def _save_state(updates: dict[str, Any]) -> None:
    state = _load_state()
    state.update(updates)
    STATE_FILE.write_text(json.dumps(state, indent=2))


# ---------------------------------------------------------------------------
# Task executors
# ---------------------------------------------------------------------------

async def _exec_scrape_google_maps(params: dict[str, Any], state: AgentState) -> None:
    from agents.tools.scraper import scrape_google_maps
    keyword = params.get("keyword", "contractor")
    city = params.get("city", "")
    s = params.get("state", "")
    leads = await scrape_google_maps(keyword, city, s)
    state["leads"] = leads


def _exec_extract_company_data(params: dict[str, Any], state: AgentState) -> None:
    # Leads are already structured dicts; just pass through.
    pass


def _exec_score_opportunities(params: dict[str, Any], state: AgentState) -> None:
    """Apply simple scoring heuristics to each lead."""
    for lead in state.get("leads", []):
        score = 0
        if lead.get("website"):
            score += 10
        if lead.get("phone"):
            score += 10
        if lead.get("email"):
            score += 15
        reviews = lead.get("review_count") or 0
        if reviews > 10:
            score += 5
        rating = lead.get("rating") or 0
        if rating > 4:
            score += 10
        lead["lead_score"] = score
        lead["tier"] = "HOT" if score >= 35 else "WARM" if score >= 20 else "COLD"


def _exec_load_top_leads(params: dict[str, Any], state: AgentState) -> None:
    leads_file = Path(__file__).parent.parent / "leads" / "scored_leads.json"
    if not leads_file.exists():
        leads_file = Path(__file__).parent.parent / "data" / "leads" / "scored_leads.json"
    try:
        all_leads: list[dict[str, Any]] = json.loads(leads_file.read_text())
    except Exception:
        all_leads = []
    min_score = params.get("min_score", 0)
    limit = params.get("limit", 50)
    filtered = [l for l in all_leads if (l.get("lead_score") or l.get("score") or 0) >= min_score]
    filtered.sort(key=lambda l: l.get("lead_score") or l.get("score") or 0, reverse=True)
    state["leads"] = filtered[:limit]


def _exec_generate_emails(params: dict[str, Any], state: AgentState) -> None:
    from agents.tools.email_tools import generate_outreach_email
    template = params.get("template", "default")
    emails = [generate_outreach_email(lead, template) for lead in state.get("leads", [])]
    state["emails"] = emails


def _exec_send_outreach_batch(params: dict[str, Any], state: AgentState) -> None:
    from agents.tools.email_tools import send_outreach_batch
    dry_run = params.get("dry_run", True)
    result = send_outreach_batch(state.get("leads", []), dry_run=dry_run)
    state.setdefault("output", {})["outreach"] = result


def _exec_export_csv(params: dict[str, Any], state: AgentState) -> None:
    import csv
    import io
    leads = state.get("leads", [])
    if not leads:
        # Try loading from file
        _exec_load_top_leads({}, state)
        leads = state.get("leads", [])
    buf = io.StringIO()
    if leads:
        writer = csv.DictWriter(buf, fieldnames=leads[0].keys())
        writer.writeheader()
        writer.writerows(leads)
    state.setdefault("output", {})["csv"] = buf.getvalue()
    state.setdefault("output", {})["csv_rows"] = len(leads)


def _exec_trigger_workflow(params: dict[str, Any], state: AgentState) -> None:
    from agents.tools.repo_tools import trigger_workflow
    workflow_id = params.get("workflow_id", "lead_pipeline.yml")
    result = trigger_workflow(workflow_id)
    state.setdefault("output", {})["workflow"] = result


def _exec_system_status(params: dict[str, Any], state: AgentState) -> None:
    state.setdefault("output", {})["status"] = {
        "scraper": "active",
        "validator": "active",
        "enricher": "idle",
        "scorer": "active",
        "outreach": "standby",
        "leads_on_disk": _count_leads(),
    }


def _exec_open_interpreter(params: dict[str, Any], state: AgentState) -> None:
    """Delegate free-form command to Open Interpreter when available."""
    prompt = params.get("prompt", "")
    try:
        import interpreter as oi
        oi.auto_run = True
        oi.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        result = oi.chat(prompt, display=False, stream=False)
        state.setdefault("output", {})["interpreter"] = str(result)
    except ImportError:
        state.setdefault("output", {})["interpreter"] = (
            "open-interpreter not installed. Install with: pip install open-interpreter"
        )
    except Exception as exc:
        state.setdefault("output", {})["interpreter"] = f"Error: {exc}"


def _exec_return_results(params: dict[str, Any], state: AgentState) -> None:
    """No-op — results are already in state; just mark completion."""
    pass


def _count_leads() -> int:
    for path in [
        Path(__file__).parent.parent / "leads" / "leads.json",
        Path(__file__).parent.parent / "data" / "leads" / "leads.json",
    ]:
        try:
            data = json.loads(path.read_text())
            return len(data) if isinstance(data, list) else 0
        except Exception:
            pass
    return 0


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

TASK_MAP = {
    "scrape_google_maps":    _exec_scrape_google_maps,
    "extract_company_data":  _exec_extract_company_data,
    "score_opportunities":   _exec_score_opportunities,
    "load_top_leads":        _exec_load_top_leads,
    "generate_emails":       _exec_generate_emails,
    "send_outreach_batch":   _exec_send_outreach_batch,
    "export_csv":            _exec_export_csv,
    "trigger_workflow":      _exec_trigger_workflow,
    "system_status":         _exec_system_status,
    "open_interpreter":      _exec_open_interpreter,
    "return_results":        _exec_return_results,
}


async def run_plan(plan: dict[str, Any]) -> AgentState:
    """
    Execute all tasks in *plan* sequentially, returning the final AgentState.
    """
    state: AgentState = {"command": plan.get("command", ""), "plan": plan}
    tasks = plan.get("tasks", [])

    for task in tasks:
        name = task.get("name", "")
        params = task.get("params", {})
        executor = TASK_MAP.get(name)
        if executor is None:
            logger.warning("Unknown task '%s' — skipping", name)
            continue
        try:
            import inspect
            if inspect.iscoroutinefunction(executor):
                await executor(params, state)
            else:
                executor(params, state)
        except Exception as exc:
            logger.error("Task '%s' failed: %s", name, exc)
            state["error"] = str(exc)

    # Persist state update
    _save_state({
        "last_command": plan.get("command"),
        "last_run": datetime.now(timezone.utc).isoformat(),
        "leads_discovered": len(state.get("leads", [])),
    })

    _write_log(plan, state)
    return state


def _write_log(plan: dict[str, Any], state: AgentState) -> None:
    """Append a structured log entry to logs/agent_runs.jsonl."""
    log_file = LOG_DIR / "agent_runs.jsonl"
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "command": plan.get("command"),
        "intent": plan.get("intent"),
        "tasks_executed": [t["name"] for t in plan.get("tasks", [])],
        "leads_count": len(state.get("leads", [])),
        "error": state.get("error"),
    }
    try:
        with log_file.open("a") as fh:
            fh.write(json.dumps(entry) + "\n")
    except Exception as exc:
        logger.warning("Could not write log: %s", exc)
