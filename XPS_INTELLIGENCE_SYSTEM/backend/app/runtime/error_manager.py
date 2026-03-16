"""
app/runtime/error_manager.py
==============================
Centralised error handling for the runtime command pipeline.
"""

from __future__ import annotations

import logging
import traceback
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class RuntimeError_(Exception):
    """Base class for runtime pipeline errors."""

    def __init__(
        self, message: str, code: str = "RUNTIME_ERROR", details: Optional[Dict] = None
    ):
        super().__init__(message)
        self.code = code
        self.details = details or {}
        self.timestamp = datetime.now(timezone.utc).isoformat()


class CommandValidationError(RuntimeError_):
    """Raised when a command fails validation."""

    def __init__(self, message: str, errors: list | None = None):
        super().__init__(
            message, code="VALIDATION_ERROR", details={"errors": errors or []}
        )


class AgentNotFoundError(RuntimeError_):
    """Raised when no agent is found for a command type."""

    def __init__(self, agent: str):
        super().__init__(
            f"No agent registered for: {agent!r}",
            code="AGENT_NOT_FOUND",
            details={"agent": agent},
        )


class TaskDispatchError(RuntimeError_):
    """Raised when task dispatch fails."""

    def __init__(self, message: str, task_id: str = ""):
        super().__init__(message, code="DISPATCH_ERROR", details={"task_id": task_id})


class QueueUnavailableError(RuntimeError_):
    """Raised when the task queue is not available."""

    def __init__(self, message: str = "Queue service unavailable"):
        super().__init__(message, code="QUEUE_UNAVAILABLE")


class SandboxViolationError(RuntimeError_):
    """Raised when a sandbox security policy is violated."""

    def __init__(self, message: str, violation_type: str = ""):
        super().__init__(
            message,
            code="SANDBOX_VIOLATION",
            details={"violation_type": violation_type},
        )


def format_error(exc: Exception) -> Dict[str, Any]:
    """
    Serialise an exception to a JSON-safe dict for API responses.
    """
    if isinstance(exc, RuntimeError_):
        return {
            "code": exc.code,
            "message": str(exc),
            "details": exc.details,
            "timestamp": exc.timestamp,
        }
    return {
        "code": "INTERNAL_ERROR",
        "message": str(exc),
        "details": {"traceback": traceback.format_exc()},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def log_error(exc: Exception, context: Dict[str, Any] | None = None) -> None:
    """Log an exception with structured context."""
    context = context or {}
    logger.error(
        "runtime_error",
        extra={
            "error_type": type(exc).__name__,
            "error_message": str(exc),
            **context,
        },
        exc_info=exc,
    )
