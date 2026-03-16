"""
agent_core/chat_interpreter.py
================================
Chat interface interpreter for the XPS Intelligence Platform.

Converts natural-language chat messages into executable agent tasks.
Supports:
  - Command routing via command_router
  - LLM-assisted intent extraction (Ollama)
  - Session context tracking via memory layer
  - Streaming response support
"""

from __future__ import annotations

import logging
import time
import uuid
from typing import Any, Generator

from .command_router import route

logger = logging.getLogger(__name__)

# Hardcoded command shortcuts for reliability without LLM
_SHORTCUTS: dict[str, dict[str, Any]] = {
    "help": {
        "response": (
            "**XPS Intelligence Platform Commands**\n\n"
            "- `scrape <industry> in <city> <state>` – scrape contractor leads\n"
            "- `export leads` – export leads to CSV\n"
            "- `run outreach campaign` – start email outreach\n"
            "- `push to github` – sync changes to GitHub\n"
            "- `create dashboard` – generate analytics dashboard\n"
            "- `run script <cmd>` – execute a shell command\n"
            "- `status` – system status\n"
        ),
        "action": "help",
    },
    "status": {"action": "status"},
    "export leads": {"action": "export", "type": "export"},
}


class ChatInterpreter:
    """
    Interprets chat messages and dispatches them to the agent runtime.

    Usage::

        ci = ChatInterpreter()
        reply = ci.process("scrape epoxy contractors in Tampa FL")
    """

    def __init__(self, use_llm: bool = True) -> None:
        self._use_llm = use_llm
        self._session_id = str(uuid.uuid4())
        self._history: list[dict[str, str]] = []

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def process(self, message: str) -> dict[str, Any]:
        """
        Process a chat message and return a response dict.

        :returns: {
            "session_id": str,
            "message_id": str,
            "response": str,
            "action_taken": str | None,
            "result": dict | None,
            "suggestions": list[str],
        }
        """
        message_id = str(uuid.uuid4())
        self._history.append({"role": "user", "content": message, "ts": str(time.time())})

        # Check shortcuts first
        lower = message.lower().strip()
        for shortcut, meta in _SHORTCUTS.items():
            if lower == shortcut or lower.startswith(shortcut + " "):
                if meta.get("action") == "help":
                    return self._build_response(
                        message_id,
                        response=meta["response"],
                        action="help",
                    )
                if meta.get("action") == "status":
                    return self._build_response(
                        message_id,
                        response=self._get_status_text(),
                        action="status",
                    )

        # Route command
        routing = route(message)
        logger.info(
            "Chat: session=%s agent=%s type=%s",
            self._session_id,
            routing["agent"],
            routing["type"],
        )

        # Enqueue task
        result = self._enqueue_task(routing)

        # Build human-readable response
        response_text = self._build_response_text(message, routing, result)
        suggestions = self._get_suggestions(routing["agent"])

        reply = self._build_response(
            message_id,
            response=response_text,
            action=routing["type"],
            result=result,
            suggestions=suggestions,
        )
        self._history.append({"role": "assistant", "content": response_text, "ts": str(time.time())})
        return reply

    def stream(self, message: str) -> Generator[str, None, None]:
        """
        Stream a response for *message* token-by-token.

        Uses the smart LLM router (Groq → Ollama → OpenAI).
        Falls back to non-streaming if no provider is available.
        """
        routing = route(message)

        # Use smart LLM router if enabled
        if self._use_llm:
            try:
                from llm.llm_router import stream_complete

                system = (
                    "You are XPS Intelligence, an autonomous lead generation AI. "
                    "Help the user with scraping, lead management, and system control. "
                    "Be concise and helpful."
                )
                context = "\n".join(
                    f"{m['role']}: {m['content']}"
                    for m in self._history[-6:]
                )
                prompt = f"{context}\nuser: {message}" if context else message

                yielded = False
                for chunk in stream_complete(prompt, system=system, task="plan"):
                    if chunk:
                        yield chunk
                        yielded = True
                if yielded:
                    return
            except Exception as exc:
                logger.debug("LLM router stream unavailable: %s", exc)

        # Fallback: yield the non-streaming response
        result = self.process(message)
        yield result.get("response", "Processing your request...")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _enqueue_task(self, routing: dict[str, Any]) -> dict[str, Any]:
        """Push the routed task into the queue and return initial status."""
        try:
            from task_queue.redis_queue import TaskQueue

            q = TaskQueue()
            task_id = q.enqueue({
                "type": routing["type"],
                "agent": routing["agent"],
                **routing["params"],
            })
            return {"task_id": task_id, "queued": True, "agent": routing["agent"]}
        except Exception as exc:
            logger.debug("Queue enqueue failed (non-fatal): %s", exc)
            # Run synchronously as fallback
            return self._run_sync(routing)

    def _run_sync(self, routing: dict[str, Any]) -> dict[str, Any]:
        """Execute the routed task synchronously (no queue)."""
        task_type = routing["type"]
        params = routing["params"]

        if task_type == "scrape":
            try:
                from agents.tools.scraper import run_scrape
                leads = run_scrape(params.get("keyword", ""), params.get("city", ""), params.get("state", ""))
                return {"success": True, "leads_found": len(leads), "leads": leads[:5]}
            except Exception as exc:
                return {"success": False, "error": str(exc)}

        # Default: run agent pipeline
        try:
            from .langgraph_runtime import run_graph
            return run_graph(params.get("command", ""))
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    def _build_response_text(
        self,
        message: str,
        routing: dict[str, Any],
        result: dict[str, Any],
    ) -> str:
        """Generate a human-readable response for the given routing + result."""
        agent = routing["agent"]
        task_type = routing["type"]
        params = routing["params"]

        if result.get("queued"):
            task_id = result.get("task_id", "")
            return (
                f"✅ Task queued (ID: `{task_id[:8]}…`)\n"
                f"Agent: **{agent}** | Type: **{task_type}**\n"
                f"Processing `{params.get('command', message)}` — "
                f"results will be available shortly."
            )

        if result.get("success") is False:
            return f"❌ Task failed: {result.get('error', 'unknown error')}"

        leads = result.get("leads_found", 0)
        if leads:
            return (
                f"✅ Found **{leads} leads** "
                f"({result.get('high_value', 0)} high-value) "
                f"for `{params.get('command', message)}`"
            )

        return f"✅ Task dispatched to **{agent}** agent. Processing…"

    def _get_status_text(self) -> str:
        """Return a formatted system status string."""
        lines = ["**XPS Intelligence Platform Status**\n"]
        # Queue health
        try:
            from task_queue.redis_queue import TaskQueue
            h = TaskQueue().health()
            lines.append(f"- Queue: {'🟢 Redis' if h['redis_connected'] else '🟡 In-process'} (depth: {h['queue_length']})")
        except Exception:
            lines.append("- Queue: 🔴 Unavailable")

        # Memory health
        try:
            from memory.memory_manager import MemoryManager
            h = MemoryManager().health()
            lines.append(f"- Redis: {'🟢' if h['redis'] else '🔴'}")
            lines.append(f"- Qdrant: {'🟢' if h['qdrant'] else '🔴'}")
            lines.append(f"- Postgres: {'🟢' if h['postgres'] else '🔴'}")
        except Exception:
            lines.append("- Memory: 🔴 Unavailable")

        # Ollama
        try:
            from llm.ollama_client import health_check, list_models
            if health_check():
                models = list_models()
                lines.append(f"- Ollama: 🟢 ({len(models)} models)")
            else:
                lines.append("- Ollama: 🔴 Offline")
        except Exception:
            lines.append("- Ollama: 🔴 Unavailable")

        # LangGraph
        try:
            import langgraph  # type: ignore  # noqa: F401
            lines.append("- LangGraph: 🟢")
        except ImportError:
            lines.append("- LangGraph: 🔴 Not installed")

        return "\n".join(lines)

    def _get_suggestions(self, agent: str) -> list[str]:
        """Return contextual follow-up suggestions."""
        _SUGGESTIONS: dict[str, list[str]] = {
            "scraper": [
                "export leads",
                "run outreach campaign",
                "score leads",
            ],
            "frontend": [
                "push to github",
                "create analytics dashboard",
            ],
            "github": [
                "trigger lead pipeline workflow",
                "check workflow status",
            ],
            "code": [
                "push to github",
                "run tests",
            ],
        }
        return _SUGGESTIONS.get(agent, ["status", "help"])

    def _build_response(
        self,
        message_id: str,
        response: str,
        action: str | None = None,
        result: dict[str, Any] | None = None,
        suggestions: list[str] | None = None,
    ) -> dict[str, Any]:
        return {
            "session_id": self._session_id,
            "message_id": message_id,
            "response": response,
            "action_taken": action,
            "result": result,
            "suggestions": suggestions or [],
        }

    @property
    def history(self) -> list[dict[str, str]]:
        """Return the conversation history."""
        return list(self._history)
