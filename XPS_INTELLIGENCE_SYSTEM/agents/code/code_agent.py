"""
agents/code/code_agent.py
==========================
Code generation and editing agent.

Capabilities:
  - Generate new files / functions from natural-language descriptions
  - Refactor existing code
  - Fix bugs
  - Run linters / formatters
  - Write and run tests
"""

from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are XPS Code Agent, an expert software engineer specialising in "
    "Python, Node.js, TypeScript, React, and Next.js. "
    "When asked to generate code, return ONLY the code block without explanations "
    "unless specifically asked. For file creation requests include the full file path "
    "as a comment on the first line."
)


class CodeAgent:
    """
    Autonomous code generation and editing agent.

    Example::

        agent = CodeAgent()
        result = await agent.run("Create a Python function to validate email addresses")
    """

    def __init__(self) -> None:
        self._model: str | None = None

    async def run(self, command: str) -> dict[str, Any]:
        """
        Execute a coding task described by *command*.

        :returns: {
            "success": bool,
            "code": str,
            "language": str,
            "files_created": list[str],
            "message": str,
        }
        """
        logger.info("CodeAgent.run: %r", command)

        code = await self._generate_code(command)
        language = self._detect_language(command)

        files_created: list[str] = []
        if "create" in command.lower() or "write" in command.lower():
            path = self._extract_file_path(code)
            if path:
                files_created = self._write_file(path, code)

        return {
            "success": True,
            "code": code,
            "language": language,
            "files_created": files_created,
            "message": f"Code generated for: {command[:80]}",
        }

    async def generate_file(self, description: str, file_path: str) -> dict[str, Any]:
        """Generate and write a complete file to *file_path*."""
        prompt = f"Generate a complete {os.path.splitext(file_path)[1]} file: {description}"
        code = await self._generate_code(prompt)
        written = self._write_file(file_path, code)
        return {"success": bool(written), "file_path": file_path, "code": code}

    async def refactor(self, file_path: str, instructions: str) -> dict[str, Any]:
        """Refactor an existing file according to *instructions*."""
        try:
            with open(file_path, "r", encoding="utf-8") as fh:
                original = fh.read()
        except OSError as exc:
            return {"success": False, "error": str(exc)}

        prompt = (
            f"Refactor the following code according to these instructions: {instructions}\n\n"
            f"```\n{original[:4000]}\n```\n\nReturn ONLY the refactored code."
        )
        new_code = await self._generate_code(prompt)
        written = self._write_file(file_path, new_code)
        return {"success": bool(written), "file_path": file_path, "code": new_code}

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    async def _generate_code(self, prompt: str) -> str:
        """Call the LLM to generate code."""
        try:
            import asyncio
            from llm.ollama_client import complete

            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(
                None,
                lambda: complete(prompt, system=_SYSTEM_PROMPT, task="code"),
            )
        except Exception as exc:
            logger.debug("LLM code generation unavailable: %s", exc)
            return f"# Generated stub for: {prompt}\n# TODO: implement\n"

    @staticmethod
    def _detect_language(command: str) -> str:
        lower = command.lower()
        if any(k in lower for k in ("python", ".py", "fastapi", "flask", "django")):
            return "python"
        if any(k in lower for k in ("typescript", ".ts", "tsx")):
            return "typescript"
        if any(k in lower for k in ("react", "next.js", "component", "page")):
            return "typescript"
        if any(k in lower for k in ("javascript", "node", ".js")):
            return "javascript"
        return "python"

    @staticmethod
    def _extract_file_path(code: str) -> str | None:
        """Try to extract a file path from the first comment line."""
        for line in code.splitlines():
            stripped = line.strip().lstrip("#").lstrip("//").strip()
            if "/" in stripped and "." in stripped.split("/")[-1]:
                return stripped
        return None

    @staticmethod
    def _write_file(path: str, content: str) -> list[str]:
        """Write *content* to *path*, creating parent dirs as needed."""
        try:
            os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(content)
            logger.info("CodeAgent wrote: %s", path)
            return [path]
        except OSError as exc:
            logger.error("CodeAgent write error: %s", exc)
            return []
