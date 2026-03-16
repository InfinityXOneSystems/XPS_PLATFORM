"""
agents/github/github_agent.py
==============================
GitHub automation agent.

Capabilities:
  - Read repository files
  - Write / update files
  - Open pull requests
  - Trigger GitHub Actions workflows
  - Sync frontend / backend repos
  - Check workflow run status
"""

from __future__ import annotations

import logging
import re
from typing import Any

from agents.tools.repo_tools import (
    get_repo_info,
    list_workflow_runs,
    trigger_workflow,
)

logger = logging.getLogger(__name__)


class GitHubAgent:
    """
    Autonomous GitHub operations agent.

    Example::

        agent = GitHubAgent()
        result = await agent.run("trigger lead pipeline workflow")
    """

    async def run(self, command: str) -> dict[str, Any]:
        """
        Execute a GitHub task described by *command*.

        Supported intents:
          - trigger <workflow>        → dispatch a workflow
          - status <workflow>         → list recent runs
          - repo info / status        → get repo metadata
          - push changes              → commit & push via git
          - open pr                   → open a pull request
        """
        lower = command.lower().strip()
        logger.info("GitHubAgent.run: %r", command)

        if "trigger" in lower or "run workflow" in lower or "dispatch" in lower:
            return await self._trigger_workflow(command)

        if "status" in lower and ("workflow" in lower or "run" in lower):
            return await self._workflow_status(command)

        if "repo info" in lower or "repo status" in lower:
            return await self._repo_info()

        if "push" in lower or "commit" in lower:
            return await self._push_changes(command)

        if "open pr" in lower or "pull request" in lower or "create pr" in lower:
            return await self._open_pr(command)

        if "sync" in lower:
            return await self._sync_repos()

        # Default: return repo info
        return await self._repo_info()

    # ------------------------------------------------------------------

    async def _trigger_workflow(self, command: str) -> dict[str, Any]:
        """Parse workflow name from command and trigger it."""
        # Try to extract workflow filename
        match = re.search(r"([\w_]+\.yml)", command)
        if match:
            workflow_id = match.group(1)
        else:
            # Map common names to workflow files
            workflow_map = {
                "lead pipeline": "lead_pipeline.yml",
                "pipeline": "lead_pipeline.yml",
                "scraper": "lead_scraper.yml",
                "validation": "lead_validation.yml",
                "social": "social_scraper.yml",
                "orchestrator": "infinity_orchestrator.yml",
                "national": "national_discovery.yml",
            }
            workflow_id = "lead_pipeline.yml"
            for key, val in workflow_map.items():
                if key in command.lower():
                    workflow_id = val
                    break

        result = trigger_workflow(workflow_id)
        return {
            "success": result.get("success", False),
            "workflow": workflow_id,
            "message": f"Triggered {workflow_id}" if result.get("success") else result.get("error", "Failed"),
        }

    async def _workflow_status(self, command: str) -> dict[str, Any]:
        """Return recent runs for the specified workflow."""
        match = re.search(r"([\w_]+\.yml)", command)
        workflow_id = match.group(1) if match else "lead_pipeline.yml"
        runs = list_workflow_runs(workflow_id, per_page=5)
        return {"success": True, "workflow": workflow_id, "runs": runs}

    async def _repo_info(self) -> dict[str, Any]:
        """Return basic repository information."""
        info = get_repo_info()
        return {"success": True, **info}

    async def _push_changes(self, command: str) -> dict[str, Any]:
        """Stage, commit, and push local changes via git."""
        try:
            import subprocess

            msg_match = re.search(r'(?:message|msg|commit)\s+["\']?(.+?)["\']?\s*$', command, re.I)
            msg = msg_match.group(1) if msg_match else "chore: autonomous agent update"

            # Use targeted file patterns rather than staging everything.
            # Only stage code and data files to avoid accidentally committing secrets.
            safe_patterns = [
                "agents/", "api/", "agent_core/", "dashboard/",
                "leads/", "scripts/", "tools/", "task_queue/",
                "llm/", "memory/", "requirements.txt", "package.json",
            ]
            for pattern in safe_patterns:
                subprocess.run(["git", "add", pattern], capture_output=True)

            result = subprocess.run(
                ["git", "commit", "-m", msg],
                capture_output=True,
                text=True,
            )
            if result.returncode not in (0, 1):  # 1 = nothing to commit
                raise RuntimeError(result.stderr)
            subprocess.run(["git", "push"], check=True, capture_output=True)
            return {"success": True, "message": f"Pushed: {msg}"}
        except Exception as exc:
            logger.error("Git push failed: %s", exc)
            return {"success": False, "error": str(exc)}

    async def _open_pr(self, command: str) -> dict[str, Any]:
        """Open a pull request via GitHub API."""
        import os

        token = os.getenv("GITHUB_TOKEN", "")
        repo = os.getenv("GITHUB_REPOSITORY", "InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM")
        if not token:
            return {"success": False, "error": "GITHUB_TOKEN not set"}

        from agents.tools.repo_tools import _gh_request

        info = get_repo_info()
        default_branch = info.get("default_branch", "main")
        branch_match = re.search(r"branch\s+([a-zA-Z0-9/_-]+)", command)
        head_branch = branch_match.group(1) if branch_match else "main"

        title_match = re.search(r'title\s+["\']?(.+?)["\']?\s*$', command, re.I)
        title = title_match.group(1) if title_match else "Automated PR by XPS Agent"

        payload = {
            "title": title,
            "head": head_branch,
            "base": default_branch,
            "body": "Automated pull request opened by XPS Intelligence Agent.",
        }
        result = _gh_request(f"/repos/{repo}/pulls", method="POST", payload=payload)
        if "error" in result:
            return {"success": False, "error": result["error"]}
        return {
            "success": True,
            "pr_number": result.get("number"),
            "url": result.get("html_url"),
            "title": title,
        }

    async def _sync_repos(self) -> dict[str, Any]:
        """Trigger sync workflows for both frontend and backend."""
        results = []
        for wf in ("repo_sync.yml",):
            results.append(trigger_workflow(wf))
        success = all(r.get("success") for r in results)
        return {"success": success, "synced": [r.get("workflow") for r in results]}
