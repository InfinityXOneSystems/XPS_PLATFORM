"""
validator.py – Pydantic schemas and validation helpers.

All data flowing through the PLAN → VALIDATE → EXECUTE pipeline must
pass the validation gates defined here before any tool is invoked.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_FIELD_LENGTH = 200
MAX_PLAN_STEPS = 5

# Tasks that the system recognises and can plan for
SUPPORTED_TASKS = {
    "scrape", "find", "search", "discover",
    "generate", "email",
    "score", "analyze", "analyse", "rank", "evaluate",
    "schedule", "calendar",
    "export", "run",
}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class Command(BaseModel):
    """Validated natural-language command parsed from user input."""

    model_config = ConfigDict(extra="forbid")

    task: str
    industry: str
    location: str

    @field_validator("task")
    @classmethod
    def task_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("task must not be empty")
        if len(v) > MAX_FIELD_LENGTH:
            raise ValueError(f"task must not exceed {MAX_FIELD_LENGTH} characters")
        return v

    @field_validator("industry")
    @classmethod
    def industry_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("industry must not be empty")
        if len(v) > MAX_FIELD_LENGTH:
            raise ValueError(f"industry must not exceed {MAX_FIELD_LENGTH} characters")
        return v.lower()

    @field_validator("location")
    @classmethod
    def location_valid(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("location must not be empty")
        if len(v) > MAX_FIELD_LENGTH:
            raise ValueError(f"location must not exceed {MAX_FIELD_LENGTH} characters")
        # Accept "city state", "city, state", or just "state"
        if not re.match(r"^[a-zA-Z ,]+$", v):
            raise ValueError("location must contain only letters, spaces, and commas")
        return v.lower()


class PlanStep(BaseModel):
    """A single step in an agent execution plan."""

    tool: str
    description: str
    params: Optional[Dict[str, Any]] = None


class Plan(BaseModel):
    """Structured execution plan produced by the planner."""

    command: Command
    steps: List[PlanStep]

    @model_validator(mode="after")
    def steps_not_empty(self) -> "Plan":
        if not self.steps:
            raise ValueError("plan must contain at least one step")
        if len(self.steps) > MAX_PLAN_STEPS:
            raise ValueError(
                f"plan must not exceed {MAX_PLAN_STEPS} steps "
                f"(got {len(self.steps)})"
            )
        return self


class ExecutionResult(BaseModel):
    """Result returned after executing a plan."""

    success: bool
    leads_found: int = 0
    high_value: int = 0
    message: str = ""
    errors: List[str] = []
    retried: bool = False


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------


def normalize_command(raw_text: str) -> Dict[str, str]:
    """
    Convert a natural-language command string into a structured dict.

    Example::

        normalize_command("scrape epoxy contractors tampa")
        # → {"task": "scrape", "industry": "epoxy", "location": "tampa"}

    Raises ValueError for unsupported or unrecognisable commands.
    """
    raw_text = raw_text.strip()
    if not raw_text:
        raise ValueError("command text must not be empty")
    if len(raw_text) > MAX_FIELD_LENGTH:
        raise ValueError(
            f"command must not exceed {MAX_FIELD_LENGTH} characters "
            f"(got {len(raw_text)})"
        )

    tokens = re.sub(r"[,]", " ", raw_text.lower()).split()

    # Identify the action verb (first supported-task token)
    task = None
    for token in tokens:
        if token in SUPPORTED_TASKS:
            task = token
            break
    if task is None:
        raise ValueError(
            f"unsupported command: '{raw_text}'. "
            f"Supported tasks: {sorted(SUPPORTED_TASKS)}"
        )

    # Industry: well-known keywords
    industries = [
        "epoxy", "flooring", "roofing", "concrete", "tile", "carpet",
        "painting", "plumbing", "electrical", "hvac", "construction",
        "contractor", "contractors",
    ]
    industry = "contractor"
    for kw in industries:
        if kw in tokens:
            industry = kw
            break

    # Location: remaining tokens after stripping action words and industry words
    _skip_prepositions = {"in", "near", "for"}
    _skip_context_words = {"leads", "lead", "outreach", "emails"}
    skip = set(industries) | SUPPORTED_TASKS | _skip_prepositions | _skip_context_words
    location_tokens = [
        re.sub(r"[^a-zA-Z]", "", t)
        for t in tokens
        if t not in skip
    ]
    location_tokens = [t for t in location_tokens if t]
    location = " ".join(location_tokens) if location_tokens else "usa"

    return {"task": task, "industry": industry, "location": location}


def validate_command(raw: Dict[str, Any]) -> Command:
    """Parse and validate a raw command dict, raising ValueError on failure."""
    return Command(**raw)


def validate_plan(plan: "Plan", allowed_tools: List[str]) -> List[str]:
    """
    Validate every step tool against the allowed-tools list.

    Also checks that the plan does not exceed MAX_PLAN_STEPS.

    Returns a list of violation messages (empty list means valid).
    """
    violations: List[str] = []
    if len(plan.steps) > MAX_PLAN_STEPS:
        violations.append(
            f"plan has {len(plan.steps)} steps; maximum is {MAX_PLAN_STEPS}"
        )
    for i, step in enumerate(plan.steps):
        if step.tool not in allowed_tools:
            violations.append(
                f"step[{i}] uses disallowed tool '{step.tool}' "
                f"(allowed: {allowed_tools})"
            )
    return violations


def validate_result(result: ExecutionResult, min_leads: int = 5) -> bool:
    """Return True if the result meets minimum quality thresholds."""
    return result.success and result.leads_found >= min_leads


def validate_result_values(result: ExecutionResult) -> List[str]:
    """
    Validate ExecutionResult values before returning a response.

    RESULT VALIDATION stage – checks that output values are within
    reasonable bounds to prevent nonsensical or corrupted results from
    propagating to callers.

    Rules:
      - ``leads_found`` must be in the range [0, 1000]
      - ``high_value`` must not exceed ``leads_found``

    Returns a list of violation messages.  An empty list means the
    result passes all checks.
    """
    violations: List[str] = []
    if not (0 <= result.leads_found <= 1000):
        violations.append(
            f"leads_found={result.leads_found} is out of valid range [0, 1000]"
        )
    if result.high_value > result.leads_found:
        violations.append(
            f"high_value={result.high_value} must not exceed "
            f"leads_found={result.leads_found}"
        )
    return violations
