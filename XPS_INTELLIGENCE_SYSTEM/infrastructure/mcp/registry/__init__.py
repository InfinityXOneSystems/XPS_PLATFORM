"""MCP Tool Registry package."""

from pathlib import Path
import json

_REGISTRY_PATH = Path(__file__).parent / "tool_registry.json"


def load() -> dict:
    """Load and return the tool registry."""
    with open(_REGISTRY_PATH) as fh:
        return json.load(fh)


def list_tools() -> list:
    """Return the flat list of tool definitions."""
    return load().get("tools", [])


def list_categories() -> dict:
    """Return tools grouped by category."""
    return load().get("categories", {})


def find_tool(name: str) -> dict | None:
    """Find a tool definition by name."""
    for tool in list_tools():
        if tool.get("name") == name:
            return tool
    return None
