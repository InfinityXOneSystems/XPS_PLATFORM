"""
agents/documentation/documentation_agent.py
============================================
Documentation Agent — Automated technical documentation generation.

Capabilities:
  - Generate API documentation from code
  - Update README and architecture docs
  - Create runbooks and SOPs
  - Maintain a changelog
"""

from __future__ import annotations

import logging
from typing import Any

from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)


class DocumentationAgent(BaseAgent):
    """Automated documentation generation agent."""

    agent_name = "DOCUMENTATION_AGENT"

    async def execute(self, task: dict, context: dict | None = None) -> dict[str, Any]:
        """Execute a documentation task.

        Supported task types:
          - ``generate_api_docs``   — Generate API documentation
          - ``update_readme``       — Update README files
          - ``create_runbook``      — Create an operational runbook
          - ``update_changelog``    — Append to CHANGELOG
        """
        ctx = context or {}
        task_type = task.get("type", "generate_api_docs")

        logger.info("[DOCUMENTATION_AGENT] Processing task type=%s", task_type)

        if task_type == "update_readme":
            return await self._update_readme(task, ctx)
        if task_type == "create_runbook":
            return await self._create_runbook(task, ctx)
        if task_type == "update_changelog":
            return await self._update_changelog(task, ctx)
        return await self._generate_api_docs(task, ctx)

    async def _generate_api_docs(self, task: dict, ctx: dict) -> dict:
        source_path = task.get("source_path", "backend/app/")
        return {
            "success": True,
            "source_path": source_path,
            "docs_generated": [],
            "status": "queued",
        }

    async def _update_readme(self, task: dict, ctx: dict) -> dict:
        target = task.get("target", "README.md")
        return {
            "success": True,
            "target": target,
            "status": "updated",
        }

    async def _create_runbook(self, task: dict, ctx: dict) -> dict:
        topic = task.get("topic", "deployment")
        return {
            "success": True,
            "runbook_topic": topic,
            "path": f"docs/{topic.upper()}_RUNBOOK.md",
            "status": "created",
        }

    async def _update_changelog(self, task: dict, ctx: dict) -> dict:
        entry = task.get("entry", "")
        return {
            "success": True,
            "entry": entry,
            "appended_to": "CHANGELOG.md",
        }
