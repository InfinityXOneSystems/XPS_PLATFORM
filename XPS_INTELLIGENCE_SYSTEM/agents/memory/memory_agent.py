"""
agents/memory/memory_agent.py
==============================
MemoryAgent – manages persistent state for the XPS Intelligence Platform.

The agent wraps the ``memory.MemoryManager`` (Redis + Qdrant + Postgres)
and exposes a uniform ``execute`` / ``run`` interface compatible with the
rest of the agent system.

Operations (dispatched via ``task["operation"]`` or keyword in ``task["command"]``):

  ``store``   – persist a key/value pair or a text memory
  ``recall``  – semantic search over stored memories
  ``get``     – retrieve a specific key
  ``delete``  – remove a key
  ``save_lead`` – persist a lead record to structured storage
  ``health``  – return memory backend health
  ``summary`` – return a summary of stored memories/leads
"""

from __future__ import annotations

import logging
import time
import uuid
from typing import Any

from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)


class MemoryAgent(BaseAgent):
    """
    Persistent memory and state management agent.

    Example::

        agent = MemoryAgent()

        # Store a value
        await agent.execute({"operation": "store", "key": "last_run", "value": "2024-01-01"})

        # Semantic recall
        result = await agent.execute({"operation": "recall", "query": "epoxy leads florida"})
        memories = result["memories"]

        # Save a lead
        await agent.execute({"operation": "save_lead", "lead": {"company_name": "Epoxy Pros", ...}})
    """

    agent_name = "memory"

    def __init__(self) -> None:
        super().__init__()
        self._manager = self._init_manager()

    def _init_manager(self):
        try:
            from memory.memory_manager import MemoryManager
            return MemoryManager()
        except Exception as exc:
            logger.warning("MemoryManager unavailable: %s", exc)
            return None

    # ------------------------------------------------------------------
    # Core execution
    # ------------------------------------------------------------------

    async def execute(
        self,
        task: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Execute a memory operation described in *task*.

        Task keys:
          - ``operation`` – one of store / recall / get / delete / save_lead /
            health / summary
          - ``command``   – free-form fallback (keyword matched)

        :returns: Result dict with ``success``, ``message``, and
                  operation-specific fields.
        """
        command = task.get("command", "").lower()
        operation = task.get("operation") or self._detect_operation(command)
        logger.info("MemoryAgent.execute: operation=%r", operation)

        if operation == "store":
            return await self._op_store(task)
        if operation == "recall":
            return await self._op_recall(task)
        if operation == "get":
            return await self._op_get(task)
        if operation == "delete":
            return await self._op_delete(task)
        if operation == "save_lead":
            return await self._op_save_lead(task, context)
        if operation == "health":
            return await self._op_health()
        if operation == "summary":
            return await self._op_summary()

        # Default: store the entire task as a memory
        text = task.get("text") or task.get("value") or str(task)
        return await self._op_store({"key": f"auto:{int(time.time())}", "text": text})

    # ------------------------------------------------------------------
    # Operation handlers
    # ------------------------------------------------------------------

    async def _op_store(self, task: dict[str, Any]) -> dict[str, Any]:
        key = task.get("key", f"memory:{int(time.time())}")
        value = task.get("value") or task.get("text", "")
        ttl = int(task.get("ttl", 3600))
        text = task.get("text", "")

        stored_kv = False
        stored_vector = False

        if self._manager:
            try:
                if value:
                    self._manager.set(key, str(value), ttl=ttl)
                    stored_kv = True
                if text:
                    self._manager.remember(text, metadata={"key": key})
                    stored_vector = True
            except Exception as exc:
                logger.warning("MemoryAgent store error: %s", exc)
        else:
            # Fallback in-process store
            _IN_PROCESS_KV[key] = str(value or text)
            stored_kv = True

        return {
            "success": True,
            "stored_kv": stored_kv,
            "stored_vector": stored_vector,
            "key": key,
            "message": f"Stored key={key!r}",
        }

    async def _op_recall(self, task: dict[str, Any]) -> dict[str, Any]:
        query = task.get("query") or task.get("text") or task.get("command", "")
        top_k = int(task.get("top_k", 5))
        memories: list[dict[str, Any]] = []

        if self._manager:
            try:
                memories = self._manager.recall(query, top_k=top_k)
            except Exception as exc:
                logger.warning("MemoryAgent recall error: %s", exc)
        else:
            # Fallback: keyword match over in-process store
            q = query.lower()
            memories = [
                {"key": k, "text": v, "score": 1.0}
                for k, v in _IN_PROCESS_KV.items()
                if q in v.lower()
            ][:top_k]

        return {
            "success": True,
            "memories": memories,
            "count": len(memories),
            "message": f"Recalled {len(memories)} memories for query {query!r}",
        }

    async def _op_get(self, task: dict[str, Any]) -> dict[str, Any]:
        key = task.get("key", "")
        value: str | None = None

        if self._manager:
            try:
                value = self._manager.get(key)
            except Exception as exc:
                logger.warning("MemoryAgent get error: %s", exc)
        else:
            value = _IN_PROCESS_KV.get(key)

        return {
            "success": True,
            "key": key,
            "value": value,
            "found": value is not None,
            "message": f"Retrieved key={key!r}" if value is not None else f"Key {key!r} not found",
        }

    async def _op_delete(self, task: dict[str, Any]) -> dict[str, Any]:
        key = task.get("key", "")

        if self._manager:
            try:
                self._manager.delete(key)
            except Exception as exc:
                logger.warning("MemoryAgent delete error: %s", exc)
        else:
            _IN_PROCESS_KV.pop(key, None)

        return {"success": True, "key": key, "message": f"Deleted key={key!r}"}

    async def _op_save_lead(
        self, task: dict[str, Any], context: dict[str, Any] | None
    ) -> dict[str, Any]:
        lead = task.get("lead") or (context or {}).get("lead") or {}
        saved = 0

        if self._manager and lead:
            try:
                self._manager.save_lead(lead)
                saved = 1
            except Exception as exc:
                logger.warning("MemoryAgent save_lead error: %s", exc)
        elif lead:
            key = f"lead:{lead.get('company_name') or str(uuid.uuid4())}"
            import json
            _IN_PROCESS_KV[key] = json.dumps(lead)
            saved = 1

        return {
            "success": True,
            "saved": saved,
            "message": f"Saved {saved} lead(s)",
        }

    async def _op_health(self) -> dict[str, Any]:
        health: dict[str, Any] = {"backend": "in-process"}
        if self._manager:
            try:
                health = self._manager.health()
            except Exception as exc:
                logger.warning("MemoryAgent health check error: %s", exc)
        return {"success": True, "health": health}

    async def _op_summary(self) -> dict[str, Any]:
        count = len(_IN_PROCESS_KV)
        return {
            "success": True,
            "in_process_keys": count,
            "message": f"{count} in-process key(s) stored",
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _detect_operation(self, command: str) -> str:
        if any(w in command for w in ("store", "save", "set", "remember")):
            return "store"
        if any(w in command for w in ("recall", "search", "find", "query")):
            return "recall"
        if any(w in command for w in ("get", "retrieve", "fetch")):
            return "get"
        if any(w in command for w in ("delete", "remove", "forget")):
            return "delete"
        if "health" in command:
            return "health"
        if "summary" in command or "status" in command:
            return "summary"
        return "store"

    def capabilities(self) -> list[str]:
        return ["store", "recall", "get", "delete", "save_lead", "health", "summary"]


# ---------------------------------------------------------------------------
# In-process fallback KV store (used when MemoryManager unavailable)
# ---------------------------------------------------------------------------

_IN_PROCESS_KV: dict[str, str] = {}
