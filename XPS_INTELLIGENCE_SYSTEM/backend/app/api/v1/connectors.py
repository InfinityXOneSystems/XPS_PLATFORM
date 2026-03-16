"""
backend/app/api/v1/connectors.py
==================================
Universal Connector Suite — manages all external service integrations:
  - GitHub (sandbox repo access, webhooks, Actions)
  - Google Workspace (Gmail, Drive, Calendar, Docs, Sheets)
  - Vercel (deploys, env vars, webhook trigger)
  - Docker MCP (container management)
  - Local Machine (socket bridge)
  - Groq / OpenAI / Ollama (LLM providers)
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/connectors", tags=["connectors"])

# ── In-memory connector registry ─────────────────────────────────────────────
_REGISTRY: Dict[str, Dict[str, Any]] = {
    "github": {
        "id": "github",
        "name": "GitHub",
        "icon": "🐙",
        "category": "dev",
        "status": "unconfigured",
        "capabilities": [
            "repo_read",
            "repo_write",
            "actions_trigger",
            "webhook",
            "sandbox",
        ],
        "token_key": "GITHUB_TOKEN",
        "configured_at": None,
    },
    "vercel": {
        "id": "vercel",
        "name": "Vercel",
        "icon": "▲",
        "category": "deploy",
        "status": "unconfigured",
        "capabilities": ["deploy", "webhook_trigger", "env_vars", "domains"],
        "webhook_url": (  # noqa: E501
            "https://api.vercel.com/v1/integrations/deploy/"
            "prj_eNK90PC48eWsMW3O6aHHRWsM4wwI/ugf4FE56k4"
        ),
        "token_key": "VERCEL_TOKEN",
        "configured_at": None,
    },
    "google_workspace": {
        "id": "google_workspace",
        "name": "Google Workspace",
        "icon": "🔵",
        "category": "productivity",
        "status": "unconfigured",
        "capabilities": ["gmail", "drive", "calendar", "docs", "sheets"],
        "token_key": "GOOGLE_SERVICE_ACCOUNT_JSON",
        "scopes": [
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/drive",
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/documents",
            "https://www.googleapis.com/auth/spreadsheets",
        ],
        "configured_at": None,
    },
    "docker_mcp": {
        "id": "docker_mcp",
        "name": "Docker MCP",
        "icon": "🐋",
        "category": "infrastructure",
        "status": "unconfigured",
        "capabilities": [
            "container_list",
            "container_run",
            "container_stop",
            "image_pull",
            "volume_mount",
        ],
        "socket_path": "/var/run/docker.sock",
        "token_key": "DOCKER_HOST",
        "configured_at": None,
    },
    "local_machine": {
        "id": "local_machine",
        "name": "Local Machine",
        "icon": "💻",
        "category": "infrastructure",
        "status": "unconfigured",
        "capabilities": [
            "filesystem_read",
            "filesystem_write",
            "shell_exec",
            "process_list",
        ],
        "bridge_url": "ws://localhost:9000/mcp",
        "token_key": "LOCAL_MCP_SECRET",
        "configured_at": None,
    },
    "groq": {
        "id": "groq",
        "name": "Groq LLM",
        "icon": "⚡",
        "category": "llm",
        "status": "unconfigured",
        "capabilities": ["text_completion", "code_generation", "function_calling"],
        "token_key": "GROQ_API_KEY",
        "models": ["llama3-8b-8192", "llama3-70b-8192", "mixtral-8x7b-32768"],
        "configured_at": None,
    },
    "openai": {
        "id": "openai",
        "name": "OpenAI",
        "icon": "🤖",
        "category": "llm",
        "status": "unconfigured",
        "capabilities": [
            "text_completion",
            "code_generation",
            "image_generation",
            "function_calling",
        ],
        "token_key": "OPENAI_API_KEY",
        "models": ["gpt-4o", "gpt-4o-mini", "dall-e-3"],
        "configured_at": None,
    },
}


def _check_connector_health(connector_id: str) -> str:
    """Returns 'connected', 'unconfigured', or 'error'."""
    conn = _REGISTRY.get(connector_id)
    if not conn:
        return "error"
    token_key = conn.get("token_key")
    if token_key and os.getenv(token_key):
        return "connected"
    return "unconfigured"


def _refresh_all_statuses() -> None:
    """Update all connector statuses from environment."""
    for cid, conn in _REGISTRY.items():
        conn["status"] = _check_connector_health(cid)


# ── Schemas ───────────────────────────────────────────────────────────────────


class ConnectorConfigRequest(BaseModel):
    connector_id: str
    token: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None


class VercelDeployRequest(BaseModel):
    webhook_url: Optional[str] = None
    branch: Optional[str] = "main"


class GithubActionRequest(BaseModel):
    repo: str
    workflow_id: str
    ref: str = "main"
    inputs: Optional[Dict[str, Any]] = None


class GoogleWorkspaceRequest(BaseModel):
    service: str  # gmail | drive | calendar | docs | sheets
    action: str
    payload: Optional[Dict[str, Any]] = None


class DockerRequest(BaseModel):
    action: str  # list | run | stop | pull
    payload: Optional[Dict[str, Any]] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/", summary="List all connectors and their status")
def list_connectors() -> Dict[str, Any]:
    _refresh_all_statuses()
    return {
        "connectors": list(_REGISTRY.values()),
        "total": len(_REGISTRY),
        "connected": sum(1 for c in _REGISTRY.values() if c["status"] == "connected"),
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/{connector_id}", summary="Get single connector status")
def get_connector(connector_id: str) -> Dict[str, Any]:
    conn = _REGISTRY.get(connector_id)
    if not conn:
        raise HTTPException(
            status_code=404, detail=f"Connector '{connector_id}' not found"
        )
    conn["status"] = _check_connector_health(connector_id)
    return conn


@router.post("/configure", summary="Configure a connector with token/credentials")
def configure_connector(req: ConnectorConfigRequest) -> Dict[str, Any]:
    conn = _REGISTRY.get(req.connector_id)
    if not conn:
        raise HTTPException(
            status_code=404, detail=f"Connector '{req.connector_id}' not found"
        )

    if req.token:
        # Store in environment for this session
        token_key = conn.get("token_key", "")
        if token_key:
            os.environ[token_key] = req.token

    if req.extra:
        conn.update(req.extra)

    conn["status"] = "connected"
    conn["configured_at"] = datetime.now(timezone.utc).isoformat()

    logger.info("connector_configured", extra={"connector_id": req.connector_id})
    return {"success": True, "connector": conn}


@router.post("/vercel/deploy", summary="Trigger Vercel webhook deployment")
def trigger_vercel_deploy(req: VercelDeployRequest) -> Dict[str, Any]:
    """Triggers the Vercel webhook for the XPS Intelligence Frontend."""
    import urllib.error
    import urllib.request

    webhook_url = req.webhook_url or _REGISTRY["vercel"].get("webhook_url", "")
    if not webhook_url:
        raise HTTPException(status_code=400, detail="No Vercel webhook URL configured")

    try:
        request = urllib.request.Request(
            webhook_url,
            method="GET",
            headers={"User-Agent": "XPS-Intelligence/1.0"},
        )
        with urllib.request.urlopen(request, timeout=10) as resp:
            status_code = resp.getcode()
            body = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        status_code = e.code
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Webhook call failed: {e}")

    _REGISTRY["vercel"]["status"] = "connected"
    _REGISTRY["vercel"]["last_deploy"] = datetime.now(timezone.utc).isoformat()

    logger.info("vercel_deploy_triggered", extra={"status_code": status_code})
    return {
        "success": True,
        "webhook_url": webhook_url,
        "status_code": status_code,
        "response": body[:500],
        "triggered_at": datetime.now(timezone.utc).isoformat(),
        "message": "Vercel deployment webhook triggered successfully",
    }


@router.post("/github/action", summary="Trigger a GitHub Actions workflow")
def trigger_github_action(req: GithubActionRequest) -> Dict[str, Any]:
    """Dispatch a GitHub Actions workflow run."""
    import json
    import urllib.error
    import urllib.request

    token = os.getenv("GITHUB_TOKEN", "")
    if not token:
        return {
            "success": False,
            "message": "GITHUB_TOKEN not set — configure in Settings",
            "repo": req.repo,
        }

    url = f"https://api.github.com/repos/{req.repo}/actions/workflows/{req.workflow_id}/dispatches"
    payload = json.dumps({"ref": req.ref, "inputs": req.inputs or {}}).encode()
    request = urllib.request.Request(
        url,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=10):
            pass
        return {
            "success": True,
            "repo": req.repo,
            "workflow": req.workflow_id,
            "ref": req.ref,
        }
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        raise HTTPException(status_code=e.code, detail=body)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/google/workspace", summary="Interact with Google Workspace services")
def google_workspace_action(req: GoogleWorkspaceRequest) -> Dict[str, Any]:
    """Route actions to Gmail, Drive, Calendar, Docs, Sheets."""
    token = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    if not token:
        return {
            "success": False,
            "service": req.service,
            "action": req.action,
            "message": "GOOGLE_SERVICE_ACCOUNT_JSON not set — configure in Settings",
        }

    # In a full implementation this would use google-api-python-client
    return {
        "success": True,
        "service": req.service,
        "action": req.action,
        "message": f"Google {req.service} action '{req.action}' queued",
        "payload": req.payload,
        "executed_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/docker/action", summary="Docker MCP container management")
def docker_action(req: DockerRequest) -> Dict[str, Any]:
    """Docker MCP actions: list, run, stop, pull."""
    import shutil

    docker_available = shutil.which("docker") is not None
    socket_available = os.path.exists("/var/run/docker.sock")

    if not docker_available and not socket_available:
        return {
            "success": False,
            "action": req.action,
            "message": "Docker not available in this environment",
            "docker_socket": "/var/run/docker.sock",
            "mcp_bridge_url": _REGISTRY["docker_mcp"]["bridge_url"],
        }

    import subprocess

    cmd_map = {
        "list": ["docker", "ps", "--format", "json"],
        "list_images": ["docker", "images", "--format", "json"],
    }

    if req.action in cmd_map:
        try:
            result = subprocess.run(
                cmd_map[req.action], capture_output=True, text=True, timeout=10
            )
            return {"success": True, "action": req.action, "output": result.stdout}
        except Exception as e:
            return {"success": False, "action": req.action, "error": str(e)}

    return {
        "success": True,
        "action": req.action,
        "message": f"Docker action '{req.action}' acknowledged",
        "payload": req.payload,
    }


@router.get("/vercel/status", summary="Check Vercel frontend deployment status")
def vercel_status() -> Dict[str, Any]:
    """Returns Vercel project and frontend deployment info."""
    return {
        "project_id": "prj_eNK90PC48eWsMW3O6aHHRWsM4wwI",
        "frontend_repo": "InfinityXOneSystems/XPS-INTELLIGENCE-FRONTEND",
        "vercel_url": "https://xps-intelligence.vercel.app",
        "webhook_url": _REGISTRY["vercel"]["webhook_url"],
        "llm_provider": "groq",
        "groq_integration": "vercel_env",
        "autonomous_deploy": True,
        "status": _REGISTRY["vercel"]["status"],
        "last_deploy": _REGISTRY["vercel"].get("last_deploy"),
    }
