"""
agents/rest_api/rest_api_agent.py
===================================
Universal REST API connector agent.

Supports:
  - Generic REST API calls (GET, POST, PUT, DELETE)
  - Google API integration
  - GitHub API integration
  - ChatGPT Actions endpoint
  - Custom external service connectors
"""

from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.request
from typing import Any

logger = logging.getLogger(__name__)


class RestApiAgent:
    """
    Universal REST API agent.

    Example::

        agent = RestApiAgent()
        result = await agent.run("GET https://api.example.com/data")
    """

    async def run(self, command: str) -> dict[str, Any]:
        """
        Execute a REST API request described by *command*.

        Supports formats:
          - "GET https://..."
          - "POST https://... {json body}"
          - Named connectors: "google maps search ...", "github ..."
        """
        import re

        lower = command.lower().strip()

        # Named connectors
        if "google" in lower:
            return await self._google_connector(command)
        if lower.startswith("github"):
            return await self._github_connector(command)

        # Generic HTTP request
        method_match = re.match(r"^(GET|POST|PUT|DELETE|PATCH)\s+(https?://\S+)", command, re.I)
        if method_match:
            method = method_match.group(1).upper()
            url = method_match.group(2)
            body_text = command[method_match.end():].strip()
            body = json.loads(body_text) if body_text else None
            return await self._http_call(method, url, body)

        return {"success": False, "error": f"Unrecognised REST command: {command[:80]}"}

    # ------------------------------------------------------------------

    async def _http_call(
        self,
        method: str,
        url: str,
        body: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """Execute a generic HTTP request."""
        import asyncio

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._sync_http, method, url, body, headers)

    @staticmethod
    def _sync_http(
        method: str,
        url: str,
        body: dict[str, Any] | None,
        headers: dict[str, str] | None,
    ) -> dict[str, Any]:
        req_headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if headers:
            req_headers.update(headers)
        data = json.dumps(body).encode() if body else None
        req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = resp.read()
                return {
                    "success": True,
                    "status": resp.status,
                    "body": json.loads(raw) if raw else {},
                }
        except urllib.error.HTTPError as exc:
            return {"success": False, "status": exc.code, "error": str(exc)}
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    async def _google_connector(self, command: str) -> dict[str, Any]:
        """Google API connector – uses GOOGLE_API_KEY from environment."""
        api_key = os.getenv("GOOGLE_API_KEY", "")
        if not api_key:
            return {"success": False, "error": "GOOGLE_API_KEY not set"}

        # Simple Places API text search
        import re
        query_match = re.search(r"search\s+(.+?)(?:\s+in\s+(.+))?$", command, re.I)
        if query_match:
            query = query_match.group(1)
            location = query_match.group(2) or ""
            full_query = f"{query} {location}".strip()
            url = (
                "https://maps.googleapis.com/maps/api/place/textsearch/json"
                f"?query={urllib.parse.quote(full_query)}&key={api_key}"
            )
            import urllib.parse
            return await self._http_call("GET", url)

        return {"success": False, "error": "Could not parse Google API command"}

    async def _github_connector(self, command: str) -> dict[str, Any]:
        """GitHub API connector."""
        import re

        token = os.getenv("GITHUB_TOKEN", "")
        repo = os.getenv("GITHUB_REPOSITORY", "InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM")
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        headers["Accept"] = "application/vnd.github+json"

        # Parse intent
        if "workflow" in command.lower():
            wf_match = re.search(r"([\w_]+\.yml)", command)
            wf = wf_match.group(1) if wf_match else "lead_pipeline.yml"
            url = f"https://api.github.com/repos/{repo}/actions/workflows/{wf}/runs?per_page=5"
            return await self._http_call("GET", url, headers=headers)

        url = f"https://api.github.com/repos/{repo}"
        return await self._http_call("GET", url, headers=headers)
