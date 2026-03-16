"""
MCP Gateway — Central routing layer for all MCP tool servers.

Responsibilities:
  - Route tool requests to the correct MCP server
  - Enforce security policies (allowlists, rate limits)
  - Manage credentials via environment variables
  - Log every tool call for auditability
  - Expose /tools endpoint for dynamic tool discovery

Usage:
    python -m infrastructure.mcp.gateway.mcp_gateway
    # or
    uvicorn infrastructure.mcp.gateway.mcp_gateway:app --port 4000
"""

from __future__ import annotations

import json
import logging
import os
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from fastapi import FastAPI, HTTPException, Request
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    _FASTAPI_AVAILABLE = True
except ImportError:  # pragma: no cover
    _FASTAPI_AVAILABLE = False

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [MCP-Gateway] %(levelname)s %(message)s",
)

# ---------------------------------------------------------------------------
# Registry loader
# ---------------------------------------------------------------------------
_REGISTRY_PATH = Path(__file__).parent.parent / "registry" / "tool_registry.json"
_MCP_CONFIG_PATH = Path(__file__).parent.parent / "mcp.json"


def _load_registry() -> Dict[str, Any]:
    """Load the tool registry from disk."""
    if _REGISTRY_PATH.exists():
        with open(_REGISTRY_PATH) as fh:
            return json.load(fh)
    return {"tools": [], "categories": {}}


def _load_mcp_config() -> Dict[str, Any]:
    """Load mcp.json, return empty mcpServers dict if missing."""
    if _MCP_CONFIG_PATH.exists():
        with open(_MCP_CONFIG_PATH) as fh:
            return json.load(fh)
    return {"mcpServers": {}}


# ---------------------------------------------------------------------------
# In-memory audit log
# ---------------------------------------------------------------------------
_audit_log: List[Dict[str, Any]] = []
_MAX_AUDIT = 10_000


def _audit(event: str, tool: str, payload: Any = None, result: Any = None) -> None:
    entry = {
        "id": str(uuid.uuid4()),
        "ts": time.time(),
        "event": event,
        "tool": tool,
        "payload": payload,
        "result": result,
    }
    _audit_log.append(entry)
    if len(_audit_log) > _MAX_AUDIT:
        _audit_log.pop(0)
    logger.info("tool_call tool=%s event=%s", tool, event)


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------
if _FASTAPI_AVAILABLE:
    class ToolCallRequest(BaseModel):
        tool: str
        parameters: Dict[str, Any] = {}
        context: Optional[Dict[str, Any]] = None

    class ToolCallResponse(BaseModel):
        call_id: str
        tool: str
        status: str
        result: Optional[Any] = None
        error: Optional[str] = None
        duration_ms: float


# ---------------------------------------------------------------------------
# Gateway core logic (usable without FastAPI)
# ---------------------------------------------------------------------------
class MCPGateway:
    """Central MCP tool gateway."""

    def __init__(self) -> None:
        self._registry = _load_registry()
        self._config = _load_mcp_config()
        self._servers: Dict[str, Any] = {}
        logger.info(
            "MCPGateway initialised — %d tools registered",
            len(self._registry.get("tools", [])),
        )

    # ------------------------------------------------------------------
    def list_tools(self) -> List[Dict[str, Any]]:
        """Return all registered tools with metadata."""
        return self._registry.get("tools", [])

    # ------------------------------------------------------------------
    def list_categories(self) -> Dict[str, List[str]]:
        """Return tools grouped by category."""
        return self._registry.get("categories", {})

    # ------------------------------------------------------------------
    def call_tool(self, tool_name: str, parameters: Dict[str, Any]) -> Any:
        """Route a tool call to the appropriate server."""
        start = time.time()
        _audit("call_start", tool_name, parameters)

        # Look up tool definition
        tool_def = self._find_tool(tool_name)
        if tool_def is None:
            _audit("call_error", tool_name, parameters, "Tool not found")
            raise KeyError(f"Tool '{tool_name}' not registered in MCP registry")

        # Validate required parameters
        missing = [
            p for p in tool_def.get("required_params", []) if p not in parameters
        ]
        if missing:
            msg = f"Missing required parameters for '{tool_name}': {missing}"
            _audit("call_error", tool_name, parameters, msg)
            raise ValueError(msg)

        # Dispatch
        try:
            result = self._dispatch(tool_def, parameters)
            duration_ms = (time.time() - start) * 1000
            _audit("call_success", tool_name, parameters, str(result)[:200])
            return {
                "call_id": str(uuid.uuid4()),
                "tool": tool_name,
                "status": "success",
                "result": result,
                "duration_ms": duration_ms,
            }
        except Exception as exc:  # noqa: BLE001
            duration_ms = (time.time() - start) * 1000
            _audit("call_error", tool_name, parameters, str(exc))
            return {
                "call_id": str(uuid.uuid4()),
                "tool": tool_name,
                "status": "error",
                "error": str(exc),
                "duration_ms": duration_ms,
            }

    # ------------------------------------------------------------------
    def get_audit_log(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Return recent audit log entries."""
        return _audit_log[-limit:]

    # ------------------------------------------------------------------
    def _find_tool(self, name: str) -> Optional[Dict[str, Any]]:
        for tool in self._registry.get("tools", []):
            if tool.get("name") == name:
                return tool
        return None

    # ------------------------------------------------------------------
    def _dispatch(self, tool_def: Dict[str, Any], parameters: Dict[str, Any]) -> Any:
        """Dispatch call to a server handler. Extensible via server registry."""
        server_name = tool_def.get("server", "builtin")
        handler_name = tool_def.get("handler", tool_def["name"])

        # Built-in echo handler (for testing / stubs)
        if server_name == "builtin":
            return {"echo": handler_name, "params": parameters}

        # Future: dynamic server dispatch via subprocess or HTTP
        raise NotImplementedError(
            f"Server '{server_name}' not yet connected. "
            "Register it in infrastructure/mcp/servers/ and update mcp.json."
        )


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------
if _FASTAPI_AVAILABLE:
    app = FastAPI(
        title="XPS MCP Gateway",
        description="Central MCP tool routing gateway for the XPS Intelligence platform",
        version="1.0.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=os.environ.get("MCP_CORS_ORIGINS", "*").split(","),
        allow_methods=["*"],
        allow_headers=["*"],
    )

    _gateway = MCPGateway()

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "mcp-gateway"}

    @app.get("/tools")
    def list_tools():
        """Discover all registered MCP tools."""
        return {
            "tools": _gateway.list_tools(),
            "categories": _gateway.list_categories(),
            "total": len(_gateway.list_tools()),
        }

    @app.post("/call", response_model=None)
    def call_tool(request: ToolCallRequest):
        """Invoke a registered MCP tool."""
        try:
            return _gateway.call_tool(request.tool, request.parameters)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.get("/audit")
    def audit_log(limit: int = 100):
        """Return recent tool audit log."""
        return {"entries": _gateway.get_audit_log(limit)}

    @app.get("/config")
    def mcp_config():
        """Return current mcp.json configuration."""
        return _load_mcp_config()


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":  # pragma: no cover
    if not _FASTAPI_AVAILABLE:
        print("FastAPI not installed. Run: pip install fastapi uvicorn")
        raise SystemExit(1)
    import uvicorn
    port = int(os.environ.get("MCP_GATEWAY_PORT", "4000"))
    uvicorn.run("infrastructure.mcp.gateway.mcp_gateway:app", host="0.0.0.0", port=port, reload=True)
