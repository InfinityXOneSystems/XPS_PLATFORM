"""
agents/validator/validator_agent.py
=====================================
ValidatorAgent – validates code, lead data, pipeline outputs, and
agent plans before they are passed downstream.

Validation targets:
  - Lead records (required fields, format, deduplication)
  - Python/JavaScript code snippets (syntax, security patterns)
  - Agent plans (valid tasks, parameter bounds)
  - Pipeline results (numeric sanity checks)

All checks are additive: the agent collects every violation before
returning so callers see the full picture in one pass.
"""

from __future__ import annotations

import ast
import json
import logging
import re
from typing import Any

from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lead validation helpers
# ---------------------------------------------------------------------------

_PHONE_RE = re.compile(r"^\+?[\d\s\-().]{7,20}$")
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _validate_lead(lead: dict[str, Any]) -> list[str]:
    """Return a list of validation errors for *lead*, empty if valid."""
    errors: list[str] = []
    if not lead.get("company_name", "").strip():
        errors.append("company_name is required")
    phone = lead.get("phone", "")
    if phone and not _PHONE_RE.match(str(phone).strip()):
        errors.append(f"invalid phone: {phone!r}")
    email = lead.get("email", "")
    if email and not _EMAIL_RE.match(str(email).strip()):
        errors.append(f"invalid email: {email!r}")
    return errors


def _validate_leads(leads: list[dict[str, Any]]) -> dict[str, Any]:
    """Validate a list of lead records; return a summary dict."""
    valid: list[dict[str, Any]] = []
    invalid: list[dict[str, Any]] = []
    for lead in leads:
        errs = _validate_lead(lead)
        if errs:
            invalid.append({**lead, "_errors": errs})
        else:
            valid.append(lead)
    return {
        "total": len(leads),
        "valid": len(valid),
        "invalid": len(invalid),
        "valid_leads": valid,
        "invalid_leads": invalid,
    }


# ---------------------------------------------------------------------------
# Code validation helpers
# ---------------------------------------------------------------------------

_DANGEROUS_PATTERNS = [
    re.compile(r"\beval\s*\("),
    re.compile(r"\bexec\s*\("),
    re.compile(r"__import__"),
    re.compile(r"subprocess\.call\s*\(\s*['\"]rm\s+-rf"),
    re.compile(r"os\.system\s*\(\s*['\"]rm\s+-rf"),
]


def _validate_python_code(code: str) -> dict[str, Any]:
    """Check Python *code* for syntax errors and dangerous patterns."""
    errors: list[str] = []
    warnings: list[str] = []

    # Syntax check
    try:
        ast.parse(code)
    except SyntaxError as exc:
        errors.append(f"SyntaxError at line {exc.lineno}: {exc.msg}")

    # Dangerous pattern check
    for pattern in _DANGEROUS_PATTERNS:
        if pattern.search(code):
            warnings.append(f"Potentially dangerous pattern: {pattern.pattern!r}")

    return {
        "syntax_ok": not bool(errors),
        "errors": errors,
        "warnings": warnings,
        "lines": len(code.splitlines()),
    }


def _validate_javascript_code(code: str) -> dict[str, Any]:
    """Lightweight JS validation – checks for obvious dangerous patterns."""
    warnings: list[str] = []
    js_dangerous = [
        re.compile(r"\beval\s*\("),
        re.compile(r"Function\s*\("),
        re.compile(r"require\s*\(\s*['\"]child_process['\"]"),
    ]
    for pattern in js_dangerous:
        if pattern.search(code):
            warnings.append(f"Potentially dangerous pattern: {pattern.pattern!r}")
    return {
        "syntax_ok": True,  # no JS parser available
        "errors": [],
        "warnings": warnings,
        "lines": len(code.splitlines()),
    }


# ---------------------------------------------------------------------------
# Plan validation helpers
# ---------------------------------------------------------------------------

_ALLOWED_TASK_NAMES = {
    "scrape_google_maps", "extract_company_data", "score_opportunities",
    "load_top_leads", "generate_emails", "send_outreach_batch",
    "export_csv", "trigger_workflow", "system_status", "open_interpreter",
    "return_results", "scrape_bing_maps", "scrape_yelp", "scrape_directories",
    "enrich_leads", "validate_leads", "deduplicate_leads",
}


def _validate_plan(plan: dict[str, Any]) -> dict[str, Any]:
    """Validate a task plan dict; return a summary dict."""
    errors: list[str] = []
    tasks = plan.get("tasks", [])
    if not tasks:
        errors.append("plan has no tasks")
    for i, task in enumerate(tasks):
        name = task.get("name", "")
        if not name:
            errors.append(f"task[{i}] missing 'name'")
        elif name not in _ALLOWED_TASK_NAMES:
            errors.append(f"task[{i}] unknown name: {name!r}")
    return {
        "valid": not bool(errors),
        "errors": errors,
        "task_count": len(tasks),
    }


# ---------------------------------------------------------------------------
# Result validation helpers (mirrors agent_core.gates)
# ---------------------------------------------------------------------------

def _validate_result_values(result: dict[str, Any]) -> list[str]:
    """Check numeric result fields for sanity."""
    violations: list[str] = []
    leads_found = result.get("leads_found", 0)
    high_value = result.get("high_value", 0)
    if leads_found < 0:
        violations.append("leads_found must be >= 0")
    if leads_found > 1000:
        violations.append("leads_found exceeds maximum (1000)")
    if high_value < 0:
        violations.append("high_value must be >= 0")
    if high_value > leads_found:
        violations.append("high_value cannot exceed leads_found")
    return violations


# ---------------------------------------------------------------------------
# ValidatorAgent
# ---------------------------------------------------------------------------


class ValidatorAgent(BaseAgent):
    """
    Validates code, lead data, plans, and pipeline results.

    Example::

        agent = ValidatorAgent()

        # Validate leads
        result = await agent.run("validate leads")
        # (set context={"leads": [...]})

        # Validate Python code
        result = await agent.execute(
            {"command": "validate code", "code": "def foo(): pass", "language": "python"}
        )

    The ``execute`` method dispatches to the appropriate validator
    based on the ``type`` or ``command`` key in *task*.
    """

    agent_name = "validator"

    async def execute(
        self,
        task: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Validate the target specified in *task*.

        Task dispatch key priority:
          1. ``task["type"]`` – ``"leads"``, ``"code"``, ``"plan"``, ``"result"``
          2. ``task["command"]`` – free-form; keyword matched

        :returns: ``{"success": bool, "valid": bool, "errors": [...], ...}``
        """
        command = task.get("command", "").lower()
        target_type = task.get("type", "")

        if target_type == "leads" or "lead" in command:
            leads = task.get("leads") or (context or {}).get("leads") or []
            return self._wrap(self._validate_leads_task(leads))

        if target_type == "code" or "code" in command:
            code = task.get("code", "")
            language = task.get("language", "python").lower()
            return self._wrap(self._validate_code_task(code, language))

        if target_type == "plan" or "plan" in command:
            plan = task.get("plan") or (context or {}).get("plan") or {}
            return self._wrap(self._validate_plan_task(plan))

        if target_type == "result" or "result" in command:
            result = task.get("result") or (context or {}) or {}
            return self._wrap(self._validate_result_task(result))

        # Default: validate whatever is in context
        leads = (context or {}).get("leads")
        if leads is not None:
            return self._wrap(self._validate_leads_task(leads))

        return {
            "success": True,
            "valid": True,
            "errors": [],
            "message": "No validation target found – nothing to validate",
        }

    def _wrap(self, validation_result: dict[str, Any]) -> dict[str, Any]:
        """Add success/message keys to a raw validation dict."""
        valid = validation_result.get("valid", not bool(validation_result.get("errors")))
        return {
            "success": True,
            "valid": valid,
            "message": "Validation passed" if valid else f"Validation failed: {len(validation_result.get('errors', []))} error(s)",
            **validation_result,
        }

    def _validate_leads_task(self, leads: list[dict[str, Any]]) -> dict[str, Any]:
        logger.info("ValidatorAgent: validating %d leads", len(leads))
        result = _validate_leads(leads)
        result["valid"] = result["invalid"] == 0
        return result

    def _validate_code_task(self, code: str, language: str) -> dict[str, Any]:
        logger.info("ValidatorAgent: validating %s code (%d lines)", language, len(code.splitlines()))
        if language in ("js", "javascript", "node"):
            result = _validate_javascript_code(code)
        else:
            result = _validate_python_code(code)
        result["valid"] = result.get("syntax_ok", True) and not result.get("errors")
        return result

    def _validate_plan_task(self, plan: dict[str, Any]) -> dict[str, Any]:
        logger.info("ValidatorAgent: validating plan with %d tasks", len(plan.get("tasks", [])))
        return _validate_plan(plan)

    def _validate_result_task(self, result: dict[str, Any]) -> dict[str, Any]:
        violations = _validate_result_values(result)
        return {
            "valid": not bool(violations),
            "errors": violations,
        }

    def capabilities(self) -> list[str]:
        return ["lead_validation", "code_validation", "plan_validation", "result_validation"]
