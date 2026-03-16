"""
app/runtime/command_validator.py
==================================
Validates incoming runtime commands before routing and dispatch.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Tuple

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Allow-list and sandbox requirements (consumed by policy_engine.py)
# ---------------------------------------------------------------------------

# All command types known to the runtime router.
ALLOWED_COMMANDS: List[str] = [
    "scrape_website",
    "generate_code",
    "modify_backend",
    "modify_frontend",
    "create_repo",
    "run_agent",
    "post_social",
    "seo_analysis",
    "outreach",
    "export",
    "health_check",
    "plan",
    "predict",
    "simulate",
    "unknown",
]

# Commands that must run inside the sandbox executor.
SANDBOX_REQUIRED: List[str] = [
    "scrape_website",
    "generate_code",
    "modify_backend",
    "modify_frontend",
    "create_repo",
    "run_agent",
    "post_social",
    "seo_analysis",
]


class ValidationError(Exception):
    """Raised when a command fails validation."""


def requires_sandbox(command_type: str) -> bool:
    """Return True if the given command type must run inside the sandbox."""
    return command_type in SANDBOX_REQUIRED


# Commands that require specific parameter keys
_REQUIRED_PARAMS: Dict[str, List[str]] = {
    "scrape_website": [],
    "generate_code": [],
    "modify_backend": [],
    "modify_frontend": [],
    "create_repo": [],
    "run_agent": [],
    "post_social": [],
    "seo_analysis": [],
}

# Patterns that indicate potentially unsafe commands
_BLOCKED_PATTERNS: List[re.Pattern] = [
    re.compile(r"\brm\s+-rf\b", re.I),
    re.compile(r"\bdrop\s+table\b", re.I),
    re.compile(r"\bdelete\s+from\b", re.I),
    re.compile(r"__import__", re.I),
    re.compile(r"\beval\s*\(", re.I),
    re.compile(r"\bexec\s*\(", re.I),
    re.compile(r"\bcompile\s*\(", re.I),
    re.compile(r"\bglobals\s*\(", re.I),
    re.compile(r"\blocals\s*\(", re.I),
    re.compile(r"\bvars\s*\(", re.I),
    re.compile(r"\bos\.system\b", re.I),
    re.compile(r"\bsubprocess\b", re.I),
]


class ValidationResult:
    """Holds the result of a validation check."""

    def __init__(self, valid: bool, errors: List[str] | None = None):
        self.valid = valid
        self.errors: List[str] = errors or []

    def __bool__(self) -> bool:
        return self.valid


def validate_command(
    command: str, params: Dict[str, Any] | None = None
) -> ValidationResult:
    """
    Validate a runtime command string.

    :param command: Raw command text.
    :param params:  Optional parameter dict provided by the caller.
    :returns:       ValidationResult with .valid and .errors.
    """
    errors: List[str] = []
    params = params or {}

    if not command or not command.strip():
        errors.append("Command must not be empty.")

    if len(command) > 2000:
        errors.append("Command exceeds maximum length of 2000 characters.")

    for pattern in _BLOCKED_PATTERNS:
        if pattern.search(command):
            errors.append(
                f"Command contains a potentially unsafe pattern: {pattern.pattern!r}"
            )

    if errors:
        logger.warning(
            "command_validation_failed",
            extra={"errors": errors, "command": command[:80]},
        )
        return ValidationResult(valid=False, errors=errors)

    logger.debug("command_validation_passed", extra={"command": command[:80]})
    return ValidationResult(valid=True)


def validate_params(
    command_type: str, params: Dict[str, Any]
) -> Tuple[bool, List[str]]:
    """
    Validate that required parameters are present for a command type.

    :returns: (is_valid, list_of_error_messages)
    """
    required = _REQUIRED_PARAMS.get(command_type, [])
    missing = [k for k in required if k not in params]
    if missing:
        return False, [f"Missing required parameters for {command_type}: {missing}"]
    return True, []
