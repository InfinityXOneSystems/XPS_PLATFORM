"""
app/sandbox/sandbox_executor.py
=================================
Main sandbox entry point.  All agent code execution goes through here.
Provides filesystem and network isolation, output capture, and safety checks.
"""

from __future__ import annotations

import contextlib
import io
import logging
import textwrap
import time
from typing import Any, Dict, Optional

from app.runtime.error_manager import SandboxViolationError
from app.sandbox.filesystem_guard import FilesystemGuard
from app.sandbox.network_guard import NetworkGuard

logger = logging.getLogger(__name__)

_DEFAULT_TIMEOUT = 30  # seconds


class SandboxExecutor:
    """
    Executes agent tasks in a restricted environment.

    The sandbox:
    - Captures stdout / stderr
    - Enforces filesystem access rules
    - Optionally restricts outbound network access
    - Prevents execution of disallowed built-ins
    """

    def __init__(
        self,
        allowed_paths: Optional[list] = None,
        network_allowed: bool = True,
        timeout: int = _DEFAULT_TIMEOUT,
    ):
        self._fs_guard = FilesystemGuard(allowed_paths=allowed_paths)
        self._net_guard = NetworkGuard(network_allowed=network_allowed)
        self._timeout = timeout

    def run(
        self,
        task: Dict[str, Any],
        handler,
    ) -> Dict[str, Any]:
        """
        Execute *handler(task)* inside the sandbox.

        :param task:    Task dict (must contain task_id).
        :param handler: Callable that takes the task dict and returns a result.
        :returns: Dict with keys: result, stdout, stderr, duration_ms, error.
        :raises:  SandboxViolationError if a policy is violated.
        """
        task_id = task.get("task_id", "unknown")
        stdout_buf = io.StringIO()
        stderr_buf = io.StringIO()
        start = time.monotonic()

        logger.debug("sandbox_execute_start", extra={"task_id": task_id})

        try:
            with (
                contextlib.redirect_stdout(stdout_buf),
                contextlib.redirect_stderr(stderr_buf),
            ):
                result = handler(task)

            duration_ms = (time.monotonic() - start) * 1000
            logger.debug(
                "sandbox_execute_complete",
                extra={"task_id": task_id, "duration_ms": round(duration_ms, 2)},
            )
            return {
                "result": result,
                "stdout": stdout_buf.getvalue(),
                "stderr": stderr_buf.getvalue(),
                "duration_ms": round(duration_ms, 2),
                "error": None,
            }

        except SandboxViolationError:
            raise

        except Exception as exc:
            duration_ms = (time.monotonic() - start) * 1000
            logger.error(
                "sandbox_execute_error",
                extra={"task_id": task_id, "error": str(exc)},
                exc_info=exc,
            )
            return {
                "result": None,
                "stdout": stdout_buf.getvalue(),
                "stderr": stderr_buf.getvalue(),
                "duration_ms": round(duration_ms, 2),
                "error": str(exc),
            }

    def execute_code(
        self, code: str, context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute a Python code string inside the sandbox.

        WARNING: Use only with trusted, validated code strings.
        """
        self._fs_guard.check_code(code)
        self._net_guard.check_code(code)

        local_ns: Dict[str, Any] = context or {}
        stdout_buf = io.StringIO()
        stderr_buf = io.StringIO()
        start = time.monotonic()

        try:
            with (
                contextlib.redirect_stdout(stdout_buf),
                contextlib.redirect_stderr(stderr_buf),
            ):
                # NOTE: Passing {"__builtins__": {}} reduces but does not eliminate risk.
                # Object introspection can still reach built-ins via the type system.
                # Only execute pre-validated, trusted code strings through this path.
                exec(  # noqa: S102
                    compile(textwrap.dedent(code), "<sandbox>", "exec"),
                    {"__builtins__": {}},
                    local_ns,
                )
            duration_ms = (time.monotonic() - start) * 1000
            return {
                "result": local_ns.get("result"),
                "stdout": stdout_buf.getvalue(),
                "stderr": stderr_buf.getvalue(),
                "duration_ms": round(duration_ms, 2),
                "error": None,
            }
        except SandboxViolationError:
            raise
        except Exception as exc:
            duration_ms = (time.monotonic() - start) * 1000
            return {
                "result": None,
                "stdout": stdout_buf.getvalue(),
                "stderr": stderr_buf.getvalue(),
                "duration_ms": round(duration_ms, 2),
                "error": str(exc),
            }
