from typing import Any, Dict

import structlog
from fastapi import APIRouter, HTTPException

logger = structlog.get_logger()
router = APIRouter(prefix="/agents", tags=["agents"])

# In-memory agent registry - in production, use Redis
_agent_registry: Dict[str, Dict[str, Any]] = {
    "scraper_agent": {
        "status": "idle",
        "logs": [],
        "description": "Processes pending scrape jobs",
    },
    "enrichment_agent": {
        "status": "idle",
        "logs": [],
        "description": "Enriches leads with missing data",
    },
    "database_agent": {
        "status": "idle",
        "logs": [],
        "description": "Nightly DB cleanup and dedup",
    },
    "outreach_agent": {
        "status": "idle",
        "logs": [],
        "description": "Sends outreach to high-score leads",
    },
    "health_agent": {
        "status": "idle",
        "logs": [],
        "description": "System health monitoring",
    },
}


@router.get("")
def list_agents():
    return {
        "agents": [{"name": name, **info} for name, info in _agent_registry.items()]
    }


@router.post("/{name}/start")
def start_agent(name: str):
    if name not in _agent_registry:
        raise HTTPException(status_code=404, detail=f"Agent '{name}' not found")
    agent = _agent_registry[name]
    if agent["status"] == "running":
        raise HTTPException(
            status_code=400, detail=f"Agent '{name}' is already running"
        )
    agent["status"] = "running"
    agent["logs"].append(f"Agent {name} started manually")
    logger.info("agent_started", agent=name)

    try:
        from app.celery_app import trigger_agent

        trigger_agent.delay(name)
    except Exception as e:
        logger.warning("celery_unavailable", error=str(e))

    return {"name": name, "status": "running", "message": f"Agent '{name}' started"}


@router.post("/{name}/stop")
def stop_agent(name: str):
    if name not in _agent_registry:
        raise HTTPException(status_code=404, detail=f"Agent '{name}' not found")
    _agent_registry[name]["status"] = "idle"
    _agent_registry[name]["logs"].append(f"Agent {name} stopped manually")
    return {"name": name, "status": "idle", "message": f"Agent '{name}' stopped"}


@router.get("/{name}/logs")
def get_agent_logs(name: str):
    if name not in _agent_registry:
        raise HTTPException(status_code=404, detail=f"Agent '{name}' not found")
    return {"name": name, "logs": _agent_registry[name]["logs"][-100:]}
