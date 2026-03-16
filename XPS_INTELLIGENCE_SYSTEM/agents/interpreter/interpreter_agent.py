"""
agents/interpreter/interpreter_agent.py
=========================================
Open-Interpreter integration agent.

Capabilities:
  - Execute Python code
  - Execute shell commands
  - Edit files
  - Run builds
  - Install dependencies
  - Run scraping scripts

Exposes an async interface for use in the agent pipeline.
Open Interpreter is optional; the agent falls back to a
subprocess-based executor when it is not available.
"""

from __future__ import annotations

import asyncio
import logging
import os
import subprocess
import sys
from typing import Any

logger = logging.getLogger(__name__)

# Safety: block dangerous shell patterns.
# NOTE: This denylist is a best-effort defence-in-depth measure.
# Production deployments should use container-level isolation (Docker)
# and/or OS-level sandboxing (seccomp/AppArmor) as primary controls.
_BLOCKED_PATTERNS = [
    "rm -rf /",
    "rm -rf ~",
    "mkfs",
    "dd if=",
    "> /dev/",
    "format c:",
    ":(){ :|: &};:",  # fork bomb
    "curl | bash",
    "wget | bash",
    "curl | sh",
]


def _is_safe(command: str) -> bool:
    lower = command.lower()
    return not any(p in lower for p in _BLOCKED_PATTERNS)


class InterpreterAgent:
    """
    Wraps Open Interpreter (or subprocess fallback) for autonomous
    code/command execution via the chat interface.

    Example::

        agent = InterpreterAgent()
        result = await agent.run("pip install playwright && playwright install chromium")
    """

    def __init__(self) -> None:
        self._interpreter = self._load_interpreter()

    @staticmethod
    def _load_interpreter():
        """Try to load Open Interpreter; return None if unavailable."""
        try:
            import interpreter as oi  # type: ignore

            oi.auto_run = True
            oi.offline = True  # use local LLM via Ollama
            oi.llm.model = os.getenv("OLLAMA_MODEL", "llama3.2")
            oi.llm.api_base = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
            logger.info("Open Interpreter loaded successfully")
            return oi
        except ImportError:
            logger.info("Open Interpreter not installed – using subprocess fallback")
            return None
        except Exception as exc:
            logger.warning("Open Interpreter init failed: %s", exc)
            return None

    async def run(self, command: str) -> dict[str, Any]:
        """
        Execute *command* using Open Interpreter or subprocess fallback.

        :returns: {
            "success": bool,
            "output": str,
            "error": str | None,
        }
        """
        logger.info("InterpreterAgent.run: %r", command)

        if not _is_safe(command):
            return {
                "success": False,
                "output": "",
                "error": f"Command blocked for safety: {command[:80]}",
            }

        if self._interpreter is not None:
            return await self._run_with_oi(command)

        return await self._run_subprocess(command)

    # ------------------------------------------------------------------

    async def _run_with_oi(self, command: str) -> dict[str, Any]:
        """Execute via Open Interpreter."""
        loop = asyncio.get_event_loop()
        try:
            def _sync() -> str:
                output_chunks = []
                for chunk in self._interpreter.chat(command, stream=True, display=False):
                    if chunk.get("type") == "output":
                        output_chunks.append(str(chunk.get("content", "")))
                return "\n".join(output_chunks)

            output = await loop.run_in_executor(None, _sync)
            return {"success": True, "output": output, "error": None}
        except Exception as exc:
            logger.error("Open Interpreter execution error: %s", exc)
            return {"success": False, "output": "", "error": str(exc)}

    async def _run_subprocess(self, command: str) -> dict[str, Any]:
        """Fallback: execute via asyncio subprocess."""
        try:
            # Determine if this is Python or shell
            is_python = command.strip().startswith(("python", "pip", "import", "from "))
            if is_python and not command.startswith("python"):
                cmd = [sys.executable, "-c", command]
            else:
                cmd = ["bash", "-c", command] if os.name != "nt" else ["cmd", "/c", command]

            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)

            output = stdout.decode("utf-8", errors="replace")
            error_text = stderr.decode("utf-8", errors="replace") if proc.returncode != 0 else None

            return {
                "success": proc.returncode == 0,
                "output": output,
                "error": error_text,
            }
        except asyncio.TimeoutError:
            return {"success": False, "output": "", "error": "Command timed out after 120s"}
        except Exception as exc:
            logger.error("Subprocess execution error: %s", exc)
            return {"success": False, "output": "", "error": str(exc)}
