"""
infinity_library/experiment_tracker.py
========================================
Tracks scientific experiments within the Infinity Library.

Each experiment has:
- hypothesis: what we're testing
- design: how we test it
- metrics: what we measure
- results: what happened
- status: proposed | running | completed | failed
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

VALID_STATUSES = frozenset({"proposed", "running", "completed", "failed"})

_DEFAULT_STORE = Path(__file__).parent / "data" / "experiments"


class ExperimentTracker:
    """Tracks scientific experiments within the XPS Intelligence platform."""

    def __init__(self, store_path: Path | None = None) -> None:
        self._store = store_path or _DEFAULT_STORE
        self._store.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _path(self, exp_id: str) -> Path:
        return self._store / f"{exp_id}.json"

    def _load(self, exp_id: str) -> dict | None:
        path = self._path(exp_id)
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.error("Failed to load experiment %s: %s", exp_id, exc)
            return None

    def _save(self, experiment: dict) -> bool:
        path = self._path(experiment["id"])
        try:
            path.write_text(
                json.dumps(experiment, indent=2, default=str), encoding="utf-8"
            )
            return True
        except Exception as exc:
            logger.error("Failed to save experiment %s: %s", experiment["id"], exc)
            return False

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def create_experiment(
        self,
        hypothesis: str,
        design: str,
        metrics: List[str] | Dict[str, Any],
    ) -> str:
        """Create a new experiment record and return its id."""
        exp_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        experiment: Dict[str, Any] = {
            "id": exp_id,
            "hypothesis": hypothesis,
            "design": design,
            "metrics": metrics,
            "results": None,
            "status": "proposed",
            "created_at": now,
            "updated_at": now,
        }
        if not self._save(experiment):
            raise RuntimeError(f"Failed to persist experiment: {hypothesis[:60]}")
        logger.info("Created experiment %s: %s", exp_id, hypothesis[:60])
        return exp_id

    def update_results(
        self,
        exp_id: str,
        results: Any,
        status: str,
    ) -> bool:
        """Update results and status for an existing experiment.

        Returns True on success, False if the experiment was not found.
        """
        if status not in VALID_STATUSES:
            logger.warning("Invalid status '%s'; defaulting to 'running'.", status)
            status = "running"

        experiment = self._load(exp_id)
        if experiment is None:
            logger.warning("update_results: experiment %s not found", exp_id)
            return False

        experiment["results"] = results
        experiment["status"] = status
        experiment["updated_at"] = datetime.now(timezone.utc).isoformat()
        return self._save(experiment)

    def get_experiment(self, exp_id: str) -> dict | None:
        """Return a single experiment by id, or None if not found."""
        return self._load(exp_id)

    def list_experiments(self, status: Optional[str] = None) -> List[dict]:
        """List all experiments, optionally filtered by status."""
        experiments: List[dict] = []
        for path in sorted(self._store.glob("*.json")):
            try:
                exp = json.loads(path.read_text(encoding="utf-8"))
            except Exception as exc:
                logger.warning("Skipping unreadable experiment file %s: %s", path, exc)
                continue
            if status is None or exp.get("status") == status:
                experiments.append(exp)

        experiments.sort(key=lambda e: e.get("created_at", ""), reverse=True)
        return experiments

    def generate_experiment_plan(self, hypothesis: str) -> str:
        """Return a Markdown-formatted experiment plan for a given hypothesis."""
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        plan = f"""\
# EXPERIMENT PLAN
*Generated: {now}*

---

## Hypothesis
{hypothesis}

---

## Design
Describe the experimental setup here. Include:
- Control variables
- Independent variable(s)
- Dependent variable(s)
- Sample size / data sources
- Duration / iteration count

---

## Metrics
List measurable outcomes, e.g.:
- Precision / Recall / F1
- Latency (ms p50, p95, p99)
- Error rate (%)
- Throughput (items/sec)

---

## Procedure
1. Baseline measurement (before change)
2. Apply intervention
3. Measure under identical conditions
4. Record raw data in `results`

---

## Expected Outcome
State what a positive result looks like and define success criteria.

---

## Status
`proposed`

---
*Auto-generated by ExperimentTracker — fill in the sections above before running.*
"""
        return plan
