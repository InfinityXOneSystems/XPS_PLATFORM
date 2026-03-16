"""
app/runtime/policy_engine.py
=============================
Enforces execution policies: command allow-lists, rate limits, sandbox rules.
"""

import logging
import threading
import time
from typing import Any, Dict, Optional

from app.runtime.command_validator import (
    ALLOWED_COMMANDS,
    SANDBOX_REQUIRED,
    ValidationError,
)

logger = logging.getLogger(__name__)

# Rate limiting: max commands per minute per "client" (IP or identifier)
DEFAULT_RATE_LIMIT = 60  # per minute
MAX_PARAMETERS_SIZE = 65536  # 64 KB — prevents oversized request payloads
_rate_store: Dict[str, list] = {}
_rate_lock = threading.Lock()


class PolicyViolation(Exception):
    """Raised when a command violates an execution policy."""


def _check_rate_limit(client_id: str, limit: int = DEFAULT_RATE_LIMIT) -> None:
    """Sliding-window rate limiter. Raises PolicyViolation if limit exceeded."""
    now = time.monotonic()
    window = 60.0
    with _rate_lock:
        timestamps = _rate_store.get(client_id, [])
        # Remove entries older than the window
        timestamps = [t for t in timestamps if now - t < window]
        if len(timestamps) >= limit:
            raise PolicyViolation(
                f"Rate limit exceeded: {limit} commands per minute for client '{client_id}'"
            )
        timestamps.append(now)
        _rate_store[client_id] = timestamps


def enforce(
    command: str,
    parameters: Optional[Dict[str, Any]] = None,
    client_id: str = "default",
    rate_limit: int = DEFAULT_RATE_LIMIT,
) -> Dict[str, Any]:
    """
    Apply all policies to the given command.

    :returns: Policy metadata dict (sandbox_required, etc.).
    :raises PolicyViolation: If any policy is violated.
    :raises ValidationError: If the command is not in the allow-list.
    """
    # 1. Allow-list check
    if command not in ALLOWED_COMMANDS:
        raise ValidationError(
            f"Command '{command}' is not in the allow-list", field="command"
        )

    # 2. Rate limit
    _check_rate_limit(client_id, rate_limit)

    # 3. Sandbox requirement
    sandbox_required = command in SANDBOX_REQUIRED

    # 4. Parameter size guard (prevent oversized payloads)
    if parameters:
        import json

        raw = json.dumps(parameters)
        if len(raw) > MAX_PARAMETERS_SIZE:
            raise PolicyViolation(
                "parameters payload exceeds maximum allowed size (64 KB)"
            )

    logger.debug(
        "policy OK: command=%s client=%s sandbox=%s",
        command,
        client_id,
        sandbox_required,
    )

    return {
        "sandbox_required": sandbox_required,
        "client_id": client_id,
        "command": command,
    }


def reset_rate_limits() -> None:
    """Clear all rate-limit state (useful in tests)."""
    with _rate_lock:
        _rate_store.clear()
