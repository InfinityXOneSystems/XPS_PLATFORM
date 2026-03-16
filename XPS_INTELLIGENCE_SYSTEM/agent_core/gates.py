"""
gates.py – Execution gates.

Every tool invocation must pass ALL gates in order.  A gate raises
GateError on failure so the executor can abort safely.

Gates:
  1. command_gate   – command schema is valid
  2. tool_gate      – tool is on the allow-list
  3. plan_gate      – plan structure is valid (non-empty steps, all tools allowed)
  4. param_gate     – tool parameters match required schema
"""

from __future__ import annotations

from typing import Any, Dict, List

from .validator import Command, Plan, validate_plan


# ---------------------------------------------------------------------------
# Allow-list
# ---------------------------------------------------------------------------

ALLOWED_TOOLS: List[str] = [
    "playwright_scraper",
    "email_generator",
    "calendar_tool",
    "lead_analyzer",
]

# Required parameters per tool (used by param_gate)
_TOOL_PARAM_SCHEMA: Dict[str, List[str]] = {
    "playwright_scraper": ["industry", "location"],
    "email_generator": [],
    "lead_analyzer": [],
    "calendar_tool": [],
}


# ---------------------------------------------------------------------------
# Gate exception
# ---------------------------------------------------------------------------


class GateError(Exception):
    """Raised when an execution gate fails."""

    def __init__(self, gate: str, reason: str) -> None:
        self.gate = gate
        self.reason = reason
        super().__init__(f"[{gate}] {reason}")


# ---------------------------------------------------------------------------
# Individual gates
# ---------------------------------------------------------------------------


def command_gate(raw_command: Dict[str, Any]) -> Command:
    """
    Gate 1 – validate the command schema.

    Returns a validated Command on success; raises GateError on failure.
    """
    try:
        return Command(**raw_command)
    except Exception as exc:
        raise GateError("command_gate", str(exc)) from exc


def tool_gate(tool_name: str) -> None:
    """
    Gate 2 – verify the tool is on the allow-list.

    Raises GateError if the tool is not permitted.
    """
    if tool_name not in ALLOWED_TOOLS:
        raise GateError(
            "tool_gate",
            f"tool '{tool_name}' is not permitted (allowed: {ALLOWED_TOOLS})",
        )


def param_gate(tool_name: str, params: Dict[str, Any]) -> None:
    """
    Gate 4 – verify that required parameters are present for a tool.

    Raises GateError if a required parameter is missing.
    """
    required = _TOOL_PARAM_SCHEMA.get(tool_name, [])
    missing = [k for k in required if k not in params]
    if missing:
        raise GateError(
            "param_gate",
            f"tool '{tool_name}' is missing required parameter(s): {missing}",
        )


def plan_gate(plan: Plan) -> None:
    """
    Gate 3 – validate plan structure and every tool it references.

    Raises GateError if any violation is found.
    """
    violations = validate_plan(plan, ALLOWED_TOOLS)
    if violations:
        raise GateError("plan_gate", "; ".join(violations))


# ---------------------------------------------------------------------------
# Composite gate runner
# ---------------------------------------------------------------------------


def run_all_gates(raw_command: Dict[str, Any], plan: Plan) -> Command:
    """
    Run all gates in order.

    Returns the validated Command on success.
    Raises GateError on the first failing gate.
    """
    cmd = command_gate(raw_command)
    plan_gate(plan)
    # individual tool gates are also checked inside plan_gate via validate_plan,
    # but we run them explicitly here for each step for belt-and-suspenders safety.
    for step in plan.steps:
        tool_gate(step.tool)
        if step.params:
            param_gate(step.tool, step.params)
    return cmd
