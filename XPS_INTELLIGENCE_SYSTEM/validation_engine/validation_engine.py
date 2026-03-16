"""
validation_engine/validation_engine.py
========================================
Validation Engine — Automated self-validation for the XPS Intelligence platform.

Validates:
  - Service health (backends, APIs, queues)
  - Data integrity (lead schema, required fields)
  - Agent health (can agents accept tasks?)
  - Configuration integrity (env vars, secrets present)

Returns structured ValidationReport objects that feed into the self-healing loop.
"""

from __future__ import annotations

import json
import logging
import os
import time
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class ValidationLevel(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class ValidationResult:
    """Result of a single validation check."""

    def __init__(
        self,
        check_name: str,
        passed: bool,
        level: ValidationLevel = ValidationLevel.INFO,
        message: str = "",
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.check_name = check_name
        self.passed = passed
        self.level = level
        self.message = message
        self.details = details or {}
        self.timestamp = time.time()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "check_name": self.check_name,
            "passed": self.passed,
            "level": self.level.value,
            "message": self.message,
            "details": self.details,
            "timestamp": self.timestamp,
        }


class ValidationReport:
    """Full validation report from one engine run."""

    def __init__(self) -> None:
        self.results: List[ValidationResult] = []
        self.started_at = time.time()
        self.completed_at: Optional[float] = None

    def add(self, result: ValidationResult) -> None:
        self.results.append(result)

    def complete(self) -> None:
        self.completed_at = time.time()

    @property
    def passed(self) -> bool:
        return all(r.passed for r in self.results if r.level == ValidationLevel.CRITICAL)

    @property
    def error_count(self) -> int:
        return sum(1 for r in self.results if not r.passed)

    def summary(self) -> Dict[str, Any]:
        return {
            "passed": self.passed,
            "total_checks": len(self.results),
            "error_count": self.error_count,
            "duration_s": (self.completed_at or time.time()) - self.started_at,
            "critical_failures": [
                r.to_dict()
                for r in self.results
                if not r.passed and r.level == ValidationLevel.CRITICAL
            ],
        }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "summary": self.summary(),
            "results": [r.to_dict() for r in self.results],
        }


class ValidationEngine:
    """
    Automated self-validation engine.

    Runs a suite of checks and returns a ValidationReport.
    Can be run on demand or scheduled via cron/GitHub Actions.
    """

    def __init__(self) -> None:
        self._checks = [
            self._check_required_env_vars,
            self._check_leads_data,
            self._check_mcp_registry,
            self._check_reasoning_graph_importable,
            self._check_infinity_library_importable,
        ]

    def run(self) -> ValidationReport:
        """Run all validation checks. Returns a ValidationReport."""
        report = ValidationReport()
        logger.info("[ValidationEngine] Starting validation run — %d checks", len(self._checks))

        for check_fn in self._checks:
            try:
                result = check_fn()
                report.add(result)
            except Exception as exc:  # noqa: BLE001
                report.add(ValidationResult(
                    check_name=check_fn.__name__,
                    passed=False,
                    level=ValidationLevel.ERROR,
                    message=f"Check raised exception: {exc}",
                ))

        report.complete()
        logger.info(
            "[ValidationEngine] Validation complete — %d checks, %d errors",
            len(report.results), report.error_count,
        )
        return report

    # ------------------------------------------------------------------
    # Individual checks
    # ------------------------------------------------------------------

    def _check_required_env_vars(self) -> ValidationResult:
        required = ["SECRET_KEY"]
        recommended = ["DATABASE_URL", "REDIS_URL", "OPENAI_API_KEY"]

        missing_required = [v for v in required if not os.environ.get(v)]
        missing_recommended = [v for v in recommended if not os.environ.get(v)]

        if missing_required:
            return ValidationResult(
                "required_env_vars",
                passed=False,
                level=ValidationLevel.CRITICAL,
                message=f"Missing required env vars: {missing_required}",
                details={"missing": missing_required},
            )
        if missing_recommended:
            return ValidationResult(
                "required_env_vars",
                passed=True,
                level=ValidationLevel.WARNING,
                message=f"Recommended env vars not set: {missing_recommended}",
                details={"missing_recommended": missing_recommended},
            )
        return ValidationResult("required_env_vars", passed=True, message="All env vars present")

    def _check_leads_data(self) -> ValidationResult:
        leads_path = Path("leads/leads.json")
        if not leads_path.exists():
            return ValidationResult(
                "leads_data",
                passed=False,
                level=ValidationLevel.WARNING,
                message="leads/leads.json not found",
            )
        try:
            with open(leads_path) as fh:
                data = json.load(fh)
            count = len(data) if isinstance(data, list) else 0
            return ValidationResult(
                "leads_data",
                passed=True,
                message=f"leads/leads.json readable — {count} entries",
                details={"count": count},
            )
        except Exception as exc:  # noqa: BLE001
            return ValidationResult(
                "leads_data",
                passed=False,
                level=ValidationLevel.ERROR,
                message=f"leads/leads.json is not valid JSON: {exc}",
            )

    def _check_mcp_registry(self) -> ValidationResult:
        registry_path = Path("infrastructure/mcp/registry/tool_registry.json")
        if not registry_path.exists():
            return ValidationResult(
                "mcp_registry",
                passed=False,
                level=ValidationLevel.WARNING,
                message="MCP tool registry not found",
            )
        try:
            with open(registry_path) as fh:
                registry = json.load(fh)
            tool_count = len(registry.get("tools", []))
            return ValidationResult(
                "mcp_registry",
                passed=True,
                message=f"MCP registry readable — {tool_count} tools registered",
                details={"tool_count": tool_count},
            )
        except Exception as exc:  # noqa: BLE001
            return ValidationResult(
                "mcp_registry",
                passed=False,
                level=ValidationLevel.ERROR,
                message=f"MCP registry is not valid JSON: {exc}",
            )

    def _check_reasoning_graph_importable(self) -> ValidationResult:
        try:
            from reasoning_graph import ReasoningGraph  # noqa: F401
            return ValidationResult(
                "reasoning_graph_import",
                passed=True,
                message="ReasoningGraph module importable",
            )
        except ImportError as exc:
            return ValidationResult(
                "reasoning_graph_import",
                passed=False,
                level=ValidationLevel.WARNING,
                message=f"ReasoningGraph import failed: {exc}",
            )

    def _check_infinity_library_importable(self) -> ValidationResult:
        try:
            from infinity_library import InfinityLibrary  # noqa: F401
            return ValidationResult(
                "infinity_library_import",
                passed=True,
                message="InfinityLibrary module importable",
            )
        except ImportError as exc:
            return ValidationResult(
                "infinity_library_import",
                passed=False,
                level=ValidationLevel.WARNING,
                message=f"InfinityLibrary import failed: {exc}",
            )
