"""
agents/backend/backend_agent.py
================================
Backend API modification agent.

Capabilities:
  - Add new Express/FastAPI endpoints
  - Modify existing routes
  - Generate OpenAPI schema
  - Sync frontend client from OpenAPI spec
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any

logger = logging.getLogger(__name__)

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GATEWAY_FILE = os.path.join(ROOT, "api", "gateway.js")
OPENAPI_FILE = os.path.join(ROOT, "agents", "gpt_actions", "openapi.json")


class BackendAgent:
    """
    Autonomous backend API modification agent.

    Example::

        agent = BackendAgent()
        result = await agent.run("Add endpoint GET /api/stats that returns lead statistics")
    """

    async def run(self, command: str) -> dict[str, Any]:
        lower = command.lower()
        logger.info("BackendAgent.run: %r", command)

        if "openapi" in lower or "spec" in lower or "schema" in lower:
            return await self._generate_openapi()

        if "sync" in lower and "frontend" in lower:
            return await self._sync_frontend_client()

        if "add endpoint" in lower or "new route" in lower or "add route" in lower:
            return await self._add_endpoint(command)

        # Generate via LLM
        return await self._generate_with_llm(command)

    # ------------------------------------------------------------------

    async def _add_endpoint(self, command: str) -> dict[str, Any]:
        """Parse the command and append a new route to gateway.js."""
        method_match = re.search(r'\b(GET|POST|PUT|DELETE|PATCH)\b', command, re.I)
        path_match = re.search(r'(/[a-zA-Z0-9/_:-]+)', command)

        method = method_match.group(1).lower() if method_match else "get"
        route_path = path_match.group(1) if path_match else "/api/new-endpoint"

        handler_code = await self._llm_generate_handler(method, route_path, command)
        appended = self._append_to_gateway(handler_code)

        return {
            "success": appended,
            "method": method,
            "path": route_path,
            "message": f"Added {method.upper()} {route_path} to gateway.js",
        }

    async def _generate_openapi(self) -> dict[str, Any]:
        """Regenerate the OpenAPI JSON from gateway.js routes."""
        import json

        try:
            routes = self._extract_routes()
            spec = {
                "openapi": "3.0.0",
                "info": {
                    "title": "XPS Intelligence API",
                    "version": "1.0.0",
                    "description": "Autonomous lead intelligence platform API",
                },
                "servers": [{"url": "http://localhost:3200"}],
                "paths": {},
            }
            for route in routes:
                path = route["path"]
                method = route["method"]
                if path not in spec["paths"]:
                    spec["paths"][path] = {}
                spec["paths"][path][method] = {
                    "summary": f"{method.upper()} {path}",
                    "responses": {
                        "200": {"description": "Success"},
                        "500": {"description": "Server error"},
                    },
                }

            os.makedirs(os.path.dirname(OPENAPI_FILE), exist_ok=True)
            with open(OPENAPI_FILE, "w", encoding="utf-8") as fh:
                json.dump(spec, fh, indent=2)

            return {"success": True, "routes": len(routes), "file": "agents/gpt_actions/openapi.json"}
        except Exception as exc:
            logger.error("OpenAPI generation failed: %s", exc)
            return {"success": False, "error": str(exc)}

    async def _sync_frontend_client(self) -> dict[str, Any]:
        """Generate a TypeScript API client from the OpenAPI spec."""
        if not os.path.exists(OPENAPI_FILE):
            await self._generate_openapi()

        try:
            import subprocess

            client_dir = os.path.join(ROOT, "dashboard", "api")
            os.makedirs(client_dir, exist_ok=True)
            # Use openapi-typescript if available
            result = subprocess.run(
                ["npx", "--yes", "openapi-typescript", OPENAPI_FILE, "--output", os.path.join(client_dir, "schema.d.ts")],
                capture_output=True,
                text=True,
                timeout=60,
            )
            success = result.returncode == 0
            return {
                "success": success,
                "client_file": "dashboard/api/schema.d.ts",
                "message": "Frontend API client synced" if success else result.stderr[:200],
            }
        except Exception as exc:
            logger.error("Frontend sync failed: %s", exc)
            return {"success": False, "error": str(exc)}

    async def _generate_with_llm(self, command: str) -> dict[str, Any]:
        """Use the LLM to generate backend code."""
        code = await self._llm_generate_handler("get", "/api/custom", command)
        return {"success": True, "code": code, "message": f"Generated code for: {command[:60]}"}

    # ------------------------------------------------------------------

    async def _llm_generate_handler(self, method: str, path: str, description: str) -> str:
        try:
            import asyncio
            from llm.ollama_client import complete

            prompt = (
                f"Generate an Express.js route handler for:\n"
                f"Method: {method.upper()}\nPath: {path}\nDescription: {description}\n\n"
                "Return ONLY the route handler code (app.get/app.post etc.) "
                "with proper error handling and JSON responses."
            )
            system = "You are an expert Node.js/Express developer. Generate clean, production-ready route handlers."
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, lambda: complete(prompt, system=system, task="code"))
        except Exception as exc:
            logger.debug("LLM backend generation unavailable: %s", exc)
            return (
                f"\n// {method.upper()} {path}\n"
                f"app.{method}('{path}', (req, res) => {{\n"
                f"  // TODO: implement {description[:60]}\n"
                f"  res.json({{ success: true }});\n"
                f"}});\n"
            )

    def _append_to_gateway(self, code: str) -> bool:
        """Append a route handler to gateway.js before the server listen call."""
        try:
            with open(GATEWAY_FILE, "r", encoding="utf-8") as fh:
                content = fh.read()

            # Insert before app.listen or at end
            insert_marker = "app.listen"
            if insert_marker in content:
                idx = content.rfind(insert_marker)
                content = content[:idx] + "\n" + code + "\n\n" + content[idx:]
            else:
                content += "\n" + code + "\n"

            with open(GATEWAY_FILE, "w", encoding="utf-8") as fh:
                fh.write(content)
            return True
        except Exception as exc:
            logger.error("Append to gateway failed: %s", exc)
            return False

    def _extract_routes(self) -> list[dict[str, str]]:
        """Extract route definitions from gateway.js."""
        if not os.path.exists(GATEWAY_FILE):
            return []
        try:
            with open(GATEWAY_FILE, "r", encoding="utf-8") as fh:
                content = fh.read()
            matches = re.findall(r'app\.(get|post|put|delete|patch)\s*\(\s*["\']([^"\']+)["\']', content)
            return [{"method": m[0], "path": m[1]} for m in matches]
        except Exception:
            return []
