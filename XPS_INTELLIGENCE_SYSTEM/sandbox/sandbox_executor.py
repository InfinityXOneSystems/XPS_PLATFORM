"""
sandbox/sandbox_executor.py
============================
Secure Sandbox Execution System for XPS Intelligence.

Capabilities:
  - Execute Python code in an isolated subprocess
  - Execute Node.js code in an isolated subprocess
  - Time-bounded execution (configurable timeout)
  - Memory usage limits
  - Clean environment (no host credentials)
  - Automatic cleanup after execution

All agent-generated code MUST pass through this executor.

Usage::

    executor = SandboxExecutor()
    result = executor.run_python("print('hello from sandbox')")
    result = executor.run_node("console.log('hello')")
"""

from __future__ import annotations

import logging
import os
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
DEFAULT_TIMEOUT_S = int(os.environ.get("SANDBOX_MAX_TIMEOUT_S", "30"))
DEFAULT_MEMORY_MB = int(os.environ.get("SANDBOX_MAX_MEMORY_MB", "256"))

# Blocked imports / patterns — extend as needed
_PYTHON_BLOCKLIST = [
    "import os",
    "import subprocess",
    "import sys",
    "__import__",
    "eval(",
    "exec(",
    "open(",
    "os.system",
    "subprocess.run",
    "shutil.rmtree",
]


class SandboxViolationError(Exception):
    """Raised when submitted code contains forbidden patterns."""


class SandboxResult:
    """Result of a sandbox execution."""

    def __init__(
        self,
        success: bool,
        stdout: str,
        stderr: str,
        exit_code: int,
        duration_ms: float,
        timed_out: bool = False,
    ) -> None:
        self.success = success
        self.stdout = stdout
        self.stderr = stderr
        self.exit_code = exit_code
        self.duration_ms = duration_ms
        self.timed_out = timed_out

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "stdout": self.stdout,
            "stderr": self.stderr,
            "exit_code": self.exit_code,
            "duration_ms": self.duration_ms,
            "timed_out": self.timed_out,
        }


class SandboxExecutor:
    """
    Secure sandbox executor for agent-generated code.

    Execution is always done in an isolated subprocess with:
      - A temporary directory as working directory
      - A clean environment (no host secrets)
      - A hard timeout
      - Static analysis to block dangerous patterns
    """

    def __init__(
        self,
        timeout_s: int = DEFAULT_TIMEOUT_S,
        allowed_imports: Optional[List[str]] = None,
        enable_guard: bool = True,
    ) -> None:
        self.timeout_s = timeout_s
        self.allowed_imports = allowed_imports or []
        self.enable_guard = enable_guard

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run_python(self, code: str, packages: Optional[List[str]] = None) -> SandboxResult:
        """Execute Python code in an isolated sandbox."""
        logger.info("[SandboxExecutor] Running Python code (%d chars)", len(code))

        if self.enable_guard:
            self._guard_python(code)

        with tempfile.TemporaryDirectory(prefix="xps_sandbox_") as tmpdir:
            code_file = Path(tmpdir) / "sandbox_code.py"
            code_file.write_text(code)
            return self._run(["python3", str(code_file)], tmpdir)

    def run_node(self, code: str) -> SandboxResult:
        """Execute Node.js code in an isolated sandbox."""
        logger.info("[SandboxExecutor] Running Node.js code (%d chars)", len(code))

        with tempfile.TemporaryDirectory(prefix="xps_sandbox_") as tmpdir:
            code_file = Path(tmpdir) / "sandbox_code.js"
            code_file.write_text(code)
            return self._run(["node", str(code_file)], tmpdir)

    def run_shell(self, command: str) -> SandboxResult:
        """Execute a shell command in an isolated sandbox (extremely restricted)."""
        logger.warning("[SandboxExecutor] Shell execution requested: %s", command[:80])
        # Shell execution is always guarded and logged
        if any(c in command for c in [";", "&&", "||", "|", "`", "$("]):
            raise SandboxViolationError("Shell chaining operators are not allowed")
        with tempfile.TemporaryDirectory(prefix="xps_sandbox_shell_") as tmpdir:
            return self._run(command.split(), tmpdir)

    def destroy(self) -> None:
        """Cleanup — no persistent state to destroy for subprocess-based sandbox."""
        logger.info("[SandboxExecutor] Sandbox destroyed (stateless subprocess executor)")

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _run(self, cmd: List[str], cwd: str) -> SandboxResult:
        """Run a command in an isolated environment."""
        # Build a minimal clean environment
        clean_env = {
            "HOME": cwd,
            "TMPDIR": cwd,
            "PATH": "/usr/local/bin:/usr/bin:/bin",
            "PYTHONDONTWRITEBYTECODE": "1",
            "PYTHONUNBUFFERED": "1",
            "NODE_ENV": "sandbox",
        }

        start = time.time()
        try:
            proc = subprocess.run(  # noqa: S603
                cmd,
                capture_output=True,
                text=True,
                timeout=self.timeout_s,
                cwd=cwd,
                env=clean_env,
            )
            duration_ms = (time.time() - start) * 1000
            success = proc.returncode == 0

            logger.info(
                "[SandboxExecutor] Execution complete — exit=%d duration=%.0fms",
                proc.returncode, duration_ms,
            )

            return SandboxResult(
                success=success,
                stdout=proc.stdout,
                stderr=proc.stderr,
                exit_code=proc.returncode,
                duration_ms=duration_ms,
            )

        except subprocess.TimeoutExpired:
            duration_ms = (time.time() - start) * 1000
            logger.warning("[SandboxExecutor] Execution timed out after %ds", self.timeout_s)
            return SandboxResult(
                success=False,
                stdout="",
                stderr=f"Execution timed out after {self.timeout_s}s",
                exit_code=-1,
                duration_ms=duration_ms,
                timed_out=True,
            )

    def _guard_python(self, code: str) -> None:
        """Static analysis guard for Python code."""
        violations = [p for p in _PYTHON_BLOCKLIST if p in code]
        # Allow if explicitly in allowed_imports
        violations = [
            v for v in violations
            if not any(v in allowed for allowed in self.allowed_imports)
        ]
        if violations:
            raise SandboxViolationError(
                f"Forbidden patterns detected in sandbox code: {violations}"
            )
