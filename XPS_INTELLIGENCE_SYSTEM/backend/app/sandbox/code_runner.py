"""
app/sandbox/code_runner.py
===========================
Safe Python code execution within the sandbox.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from app.sandbox.sandbox_executor import SandboxExecutor

logger = logging.getLogger(__name__)

_executor = SandboxExecutor(network_allowed=False)


def run_code(code: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Execute a Python code string safely.

    :param code:    Python source code to execute.
    :param context: Optional dict of names available inside the code.
    :returns:       Dict with result, stdout, stderr, duration_ms, error.
    """
    logger.info("code_runner_execute", extra={"code_length": len(code)})
    return _executor.execute_code(code, context=context)
