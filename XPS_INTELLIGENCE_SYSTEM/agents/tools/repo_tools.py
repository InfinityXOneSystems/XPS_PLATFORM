"""
agents/tools/repo_tools.py
==========================
Repository and GitHub Actions workflow tools for the AI agent pipeline.

Allows triggering GitHub Actions workflows and querying repository state.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import urllib.request
import urllib.error
import json

logger = logging.getLogger(__name__)

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
GITHUB_REPO = os.getenv("GITHUB_REPOSITORY", "InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM")
GITHUB_API = "https://api.github.com"


def _gh_request(
    path: str,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Make an authenticated GitHub API request."""
    url = f"{GITHUB_API}{path}"
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
    }
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

    data = json.dumps(payload).encode() if payload else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read()
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        body = exc.read()
        logger.error("GitHub API %s %s → %s: %s", method, path, exc.code, body[:200])
        return {"error": str(exc), "status": exc.code}
    except Exception as exc:
        logger.error("GitHub API request failed: %s", exc)
        return {"error": str(exc)}


def trigger_workflow(workflow_id: str, ref: str = "main", inputs: dict[str, Any] | None = None) -> dict[str, Any]:
    """
    Trigger a GitHub Actions workflow dispatch event.

    :param workflow_id: Workflow file name (e.g. 'lead_pipeline.yml') or numeric ID.
    :param ref: Branch or tag to run on.
    :param inputs: Optional workflow_dispatch inputs.
    """
    path = f"/repos/{GITHUB_REPO}/actions/workflows/{workflow_id}/dispatches"
    payload: dict[str, Any] = {"ref": ref}
    if inputs:
        payload["inputs"] = inputs
    result = _gh_request(path, method="POST", payload=payload)
    if "error" not in result:
        return {"success": True, "workflow": workflow_id, "ref": ref}
    return {"success": False, **result}


def list_workflow_runs(workflow_id: str, per_page: int = 5) -> list[dict[str, Any]]:
    """Return recent workflow runs for *workflow_id*."""
    path = f"/repos/{GITHUB_REPO}/actions/workflows/{workflow_id}/runs?per_page={per_page}"
    result = _gh_request(path)
    runs = result.get("workflow_runs", [])
    return [
        {
            "id": r.get("id"),
            "status": r.get("status"),
            "conclusion": r.get("conclusion"),
            "created_at": r.get("created_at"),
            "html_url": r.get("html_url"),
        }
        for r in runs
    ]


def get_repo_info() -> dict[str, Any]:
    """Return basic repository metadata."""
    result = _gh_request(f"/repos/{GITHUB_REPO}")
    return {
        "name": result.get("full_name"),
        "description": result.get("description"),
        "default_branch": result.get("default_branch"),
        "open_issues": result.get("open_issues_count"),
        "stars": result.get("stargazers_count"),
    }
