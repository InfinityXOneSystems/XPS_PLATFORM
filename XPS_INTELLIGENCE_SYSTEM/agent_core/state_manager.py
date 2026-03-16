"""
state_manager.py – Lightweight in-memory + file-backed agent run state.

State is written to /logs/agent_runs.jsonl so every run is persisted
for debugging and auditing.
"""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger("agent_core.state_manager")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_DIR = os.path.join(ROOT, "logs")
RUNS_FILE = os.path.join(LOG_DIR, "agent_runs.jsonl")


def _ensure_log_dir() -> None:
    os.makedirs(LOG_DIR, exist_ok=True)


class StateManager:
    """
    Manages state for agent runs.

    Each run is identified by a unique ``run_id`` string.  State is
    stored in memory and appended to ``logs/agent_runs.jsonl`` for
    persistence.
    """

    def __init__(self) -> None:
        _ensure_log_dir()
        self._lock = threading.Lock()
        self._runs: Dict[str, Dict[str, Any]] = {}

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------

    def create(self, run_id: str, initial: Optional[Dict[str, Any]] = None) -> None:
        """Create a new run record."""
        state: Dict[str, Any] = {
            "run_id": run_id,
            "created_at": time.time(),
            "updated_at": time.time(),
            **(initial or {}),
        }
        with self._lock:
            self._runs[run_id] = state
        self._append_log(state)
        logger.debug("created run %s", run_id)

    def update(self, run_id: str, patch: Dict[str, Any]) -> None:
        """Merge ``patch`` into the existing run state."""
        with self._lock:
            if run_id not in self._runs:
                self._runs[run_id] = {"run_id": run_id}
            self._runs[run_id].update(patch)
            self._runs[run_id]["updated_at"] = time.time()
            snapshot = dict(self._runs[run_id])
        self._append_log(snapshot)
        logger.debug("updated run %s: %s", run_id, patch)

    def get(self, run_id: str) -> Optional[Dict[str, Any]]:
        """Return a copy of the run state, or None if not found."""
        with self._lock:
            state = self._runs.get(run_id)
            return dict(state) if state else None

    def all_runs(self) -> Dict[str, Dict[str, Any]]:
        """Return a snapshot of all in-memory run states."""
        with self._lock:
            return {k: dict(v) for k, v in self._runs.items()}

    # ------------------------------------------------------------------
    # Audit logging
    # ------------------------------------------------------------------

    def audit(
        self,
        run_id: str,
        *,
        command: Optional[Dict[str, Any]] = None,
        plan: Optional[Dict[str, Any]] = None,
        tools_used: Optional[List[str]] = None,
        results: Optional[Dict[str, Any]] = None,
        errors: Optional[List[str]] = None,
    ) -> None:
        """
        Write a structured audit log entry with all required fields.

        The entry is appended to ``logs/agent_runs.jsonl`` and is
        separate from the incremental state updates written by
        ``create`` / ``update``.
        """
        entry: Dict[str, Any] = {
            "timestamp": time.time(),
            "run_id": run_id,
            "command": command or {},
            "plan": plan or {},
            "tools_used": tools_used or [],
            "results": results or {},
            "errors": errors or [],
        }
        self._append_log(entry)
        logger.debug("audit log entry written for run %s", run_id)

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def _append_log(self, state: Dict[str, Any]) -> None:
        """Append a JSON line to the runs log file."""
        try:
            with open(RUNS_FILE, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(state, default=str) + "\n")
        except OSError as exc:
            logger.warning("Could not write to %s: %s", RUNS_FILE, exc)
