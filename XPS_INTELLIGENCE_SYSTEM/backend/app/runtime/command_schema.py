"""
app/runtime/command_schema.py
==============================
Pydantic schemas for the runtime command API.
"""

from __future__ import annotations

import uuid
from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field, field_validator


class CommandType(str, Enum):
    SCRAPE_WEBSITE = "scrape_website"
    GENERATE_CODE = "generate_code"
    MODIFY_BACKEND = "modify_backend"
    MODIFY_FRONTEND = "modify_frontend"
    CREATE_REPO = "create_repo"
    RUN_AGENT = "run_agent"
    POST_SOCIAL = "post_social"
    SEO_ANALYSIS = "seo_analysis"
    EXPORT = "export"
    OUTREACH = "outreach"
    ANALYTICS = "analytics"
    PREDICT = "predict"
    SIMULATE = "simulate"
    UNKNOWN = "unknown"


class TaskStatus(str, Enum):
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"


class RuntimeCommandRequest(BaseModel):
    """Incoming command from the frontend LLM interface."""

    command: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Natural language or structured command text",
    )
    command_type: Optional[CommandType] = Field(
        None,
        description="Explicit command type override (auto-detected if omitted)",
    )
    params: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Additional parameters for the command",
    )
    priority: int = Field(
        default=5,
        ge=1,
        le=10,
        description="Task priority (1=lowest, 10=highest)",
    )
    timeout_seconds: int = Field(
        default=300,
        ge=10,
        le=3600,
        description="Maximum execution time in seconds",
    )

    @field_validator("command")
    @classmethod
    def command_not_blank(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("command must not be blank")
        return stripped


class RuntimeCommandResponse(BaseModel):
    """Response returned after enqueuing a command."""

    task_id: str = Field(description="Unique task identifier")
    status: TaskStatus = Field(description="Current task status")
    command_type: CommandType = Field(description="Detected or provided command type")
    agent: str = Field(description="Agent assigned to handle this task")
    message: str = Field(description="Human-readable status message")
    params: Dict[str, Any] = Field(description="Resolved parameters for the task")


class TaskStatusResponse(BaseModel):
    """Response for GET /runtime/task/{task_id}."""

    task_id: str
    status: TaskStatus
    command_type: Optional[CommandType] = None
    agent: Optional[str] = None
    created_at: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    result: Optional[Any] = None
    error: Optional[str] = None
    logs: list = Field(default_factory=list)
    retries: int = Field(default=0)


def generate_task_id() -> str:
    """Generate a unique task ID."""
    return str(uuid.uuid4())
