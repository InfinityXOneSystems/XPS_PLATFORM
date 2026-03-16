"""
executor.py – Tool executor with gate enforcement.

The executor will NEVER run a tool without first passing all gates.

Flow:
  1. Run all gates (command_gate → plan_gate → tool_gate per step)
  2. Execute each plan step via the registered tool handler
  3. Validate result (min leads threshold)
  4. Retry scraper up to MAX_RETRIES times if leads < MIN_LEADS
  5. Return ExecutionResult or fallback if all retries exhausted
"""

from __future__ import annotations

import concurrent.futures
import logging
import time
from typing import Any, Callable, Dict, List, Optional

from .gates import GateError, run_all_gates
from .state_manager import StateManager
from .validator import ExecutionResult, Plan, validate_result_values

logger = logging.getLogger("agent_core.executor")

MIN_LEADS = 5
MAX_RETRIES = 3
MAX_PLAN_STEPS = 5
MAX_EXECUTION_TIME = 30  # seconds

# Required parameters per tool
_TOOL_REQUIRED_PARAMS: Dict[str, List[str]] = {
    "playwright_scraper": ["industry", "location"],
    "email_generator": [],
    "lead_analyzer": [],
    "calendar_tool": [],
}

# ---------------------------------------------------------------------------
# Sandbox restrictions
# ---------------------------------------------------------------------------

_SANDBOX_BLOCKED_PATTERNS = [
    "rm -", "rmdir", "shutil.rmtree", "os.remove", "os.unlink",
    "subprocess", "os.system", "shell=True", "os.environ",
]


def _sandbox_check(tool: str, params: Dict[str, Any]) -> None:
    """
    Lightweight sandbox guard – blocks obviously dangerous param values.

    Raises RuntimeError if a prohibited pattern is detected.
    """
    for key, value in params.items():
        if isinstance(value, str):
            lower = value.lower()
            for pattern in _SANDBOX_BLOCKED_PATTERNS:
                if pattern in lower:
                    raise RuntimeError(
                        f"Sandbox violation: tool '{tool}' param '{key}' "
                        f"contains blocked pattern '{pattern}'"
                    )


# ---------------------------------------------------------------------------
# Tool registry
# ---------------------------------------------------------------------------

ToolHandler = Callable[[Dict[str, Any]], Dict[str, Any]]

_TOOL_REGISTRY: Dict[str, ToolHandler] = {}


def register_tool(name: str, handler: ToolHandler) -> None:
    """Register a callable handler for a named tool."""
    _TOOL_REGISTRY[name] = handler


def _default_playwright_scraper(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Stub Playwright scraper.

    In a live environment this would launch a Playwright browser and
    scrape lead data.  The stub returns a minimal result so the
    pipeline can complete in CI / test environments.
    """
    logger.info("playwright_scraper: params=%s", params)
    # Real implementation would use playwright to scrape
    try:
        from playwright.async_api import async_playwright  # type: ignore  # noqa: F401
        logger.debug("Playwright is available")
    except ImportError:
        logger.debug("Playwright not installed – returning stub leads")

    return {"leads": [], "leads_found": 0}


def _default_email_generator(params: Dict[str, Any]) -> Dict[str, Any]:
    logger.info("email_generator: params=%s", params)
    return {"emails_generated": 0}


def _default_lead_analyzer(params: Dict[str, Any]) -> Dict[str, Any]:
    logger.info("lead_analyzer: params=%s", params)
    return {"high_value": 0}


def _default_calendar_tool(params: Dict[str, Any]) -> Dict[str, Any]:
    logger.info("calendar_tool: params=%s", params)
    return {"scheduled": 0}


# Register defaults (can be overridden at runtime)
register_tool("playwright_scraper", _default_playwright_scraper)
register_tool("email_generator", _default_email_generator)
register_tool("lead_analyzer", _default_lead_analyzer)
register_tool("calendar_tool", _default_calendar_tool)


# ---------------------------------------------------------------------------
# Executor
# ---------------------------------------------------------------------------


class Executor:
    def __init__(self, state_manager: Optional[StateManager] = None) -> None:
        self._sm = state_manager or StateManager()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _validate_tool_params(self, tool: str, params: Dict[str, Any]) -> None:
        """
        Validate that required parameters are present for the given tool.

        Raises ValueError if a required parameter is missing.
        """
        required = _TOOL_REQUIRED_PARAMS.get(tool, [])
        missing = [k for k in required if k not in params]
        if missing:
            raise ValueError(
                f"tool '{tool}' is missing required parameter(s): {missing}"
            )

    def _run_tool(self, tool: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Invoke a registered tool handler inside an execution timeout.

        Raises RuntimeError if no handler is registered.
        Raises TimeoutError if MAX_EXECUTION_TIME is exceeded.
        """
        handler = _TOOL_REGISTRY.get(tool)
        if handler is None:
            raise RuntimeError(f"No handler registered for tool '{tool}'")

        # Sandbox check before running
        _sandbox_check(tool, params)

        # Validate required parameters
        self._validate_tool_params(tool, params)

        # Run with timeout enforcement.
        # NOTE: ThreadPoolExecutor.result(timeout) only stops *waiting* for the
        # result; it cannot forcibly interrupt an already-executing thread.
        # Tools that perform long-running I/O should implement their own
        # cancellation / cooperative timeout checks.
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(handler, params or {})
            try:
                return future.result(timeout=MAX_EXECUTION_TIME)
            except concurrent.futures.TimeoutError:
                raise TimeoutError(
                    f"tool '{tool}' exceeded max execution time "
                    f"({MAX_EXECUTION_TIME}s)"
                )

    def _execute_plan(self, plan: Plan, run_id: str) -> ExecutionResult:
        """Execute all steps in the plan and aggregate results."""
        leads_found = 0
        high_value = 0
        errors: List[str] = []

        for step in plan.steps:
            self._sm.update(run_id, {"current_step": step.tool, "status": "running"})
            try:
                # Enrich step params with command-level fields if missing.
                # The planner already sets these for steps it creates, but this
                # defensive fallback ensures manually-constructed PlanSteps
                # (e.g. in tests or direct API calls) also get the required params.
                params: Dict[str, Any] = dict(step.params or {})
                if "industry" not in params:
                    params["industry"] = plan.command.industry
                if "location" not in params:
                    params["location"] = plan.command.location
                result = self._run_tool(step.tool, params)
                leads_found += result.get("leads_found", 0)
                high_value += result.get("high_value", 0)
                logger.info("step '%s' completed: %s", step.tool, result)
            except Exception as exc:
                msg = f"step '{step.tool}' failed: {exc}"
                logger.error(msg)
                errors.append(msg)

        return ExecutionResult(
            success=len(errors) == 0,
            leads_found=leads_found,
            high_value=high_value,
            errors=errors,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def execute(
        self,
        raw_command: Dict[str, Any],
        plan: Plan,
        run_id: Optional[str] = None,
    ) -> ExecutionResult:
        """
        Execute a plan after passing all gates.

        Parameters
        ----------
        raw_command:
            The original command dict (used by command_gate).
        plan:
            The validated Plan produced by the planner.
        run_id:
            Optional caller-supplied run identifier.

        Returns
        -------
        ExecutionResult
        """
        run_id = run_id or str(int(time.time() * 1000))
        self._sm.create(run_id, {"status": "gate_check", "command": raw_command})

        # ── Guard: plan step limit ─────────────────────────────────────
        if len(plan.steps) > MAX_PLAN_STEPS:
            msg = f"plan has {len(plan.steps)} steps; maximum is {MAX_PLAN_STEPS}"
            logger.error(msg)
            self._sm.update(run_id, {"status": "aborted", "error": msg})
            return ExecutionResult(success=False, message=msg, errors=[msg])

        # ── Gate check ────────────────────────────────────────────────
        try:
            run_all_gates(raw_command, plan)
        except GateError as exc:
            logger.error("Gate failed: %s", exc)
            self._sm.update(run_id, {"status": "gate_failed", "error": str(exc)})
            return ExecutionResult(
                success=False,
                message=str(exc),
                errors=[str(exc)],
            )

        self._sm.update(run_id, {"status": "executing"})

        # ── Retry loop (up to MAX_RETRIES attempts) ───────────────────
        tools_used = [step.tool for step in plan.steps]
        plan_dump = plan.model_dump()
        last_result: Optional[ExecutionResult] = None
        retried = False

        for attempt in range(1, MAX_RETRIES + 1):
            result = self._execute_plan(plan, run_id)
            last_result = result

            # ── RESULT VALIDATION stage ───────────────────────────────
            rv_violations = validate_result_values(result)
            if rv_violations:
                msg = "Result validation failed: " + "; ".join(rv_violations)
                logger.error("run_id=%s  %s", run_id, msg)
                final_errors = result.errors + [msg]
                self._sm.update(run_id, {"status": "result_invalid", "errors": final_errors})
                invalid_result = ExecutionResult(
                    success=False,
                    leads_found=0,
                    high_value=0,
                    message=msg,
                    errors=final_errors,
                    retried=retried,
                )
                self._sm.audit(
                    run_id,
                    command=raw_command,
                    plan=plan_dump,
                    tools_used=tools_used,
                    results=invalid_result.model_dump(),
                    errors=final_errors,
                )
                return invalid_result

            if result.success and result.leads_found >= MIN_LEADS:
                result.retried = retried
                status = "completed" if not retried else "completed_after_retry"
                self._sm.update(
                    run_id,
                    {
                        "status": status,
                        "leads_found": result.leads_found,
                        "high_value": result.high_value,
                        "tools_used": tools_used,
                        "results": result.model_dump(),
                        "errors": result.errors,
                    },
                )
                self._sm.audit(
                    run_id,
                    command=raw_command,
                    plan=plan_dump,
                    tools_used=tools_used,
                    results=result.model_dump(),
                    errors=result.errors,
                )
                return result

            if attempt < MAX_RETRIES:
                retried = True
                logger.warning(
                    "Attempt %d/%d: insufficient leads (%d < %d) – retrying",
                    attempt,
                    MAX_RETRIES,
                    result.leads_found,
                    MIN_LEADS,
                )
                self._sm.update(
                    run_id,
                    {"status": f"retry_{attempt}", "leads_found": result.leads_found},
                )

        # ── All retries exhausted – return fallback ───────────────────
        logger.error(
            "All %d attempts yielded insufficient leads (%d) – returning fallback",
            MAX_RETRIES,
            last_result.leads_found if last_result else 0,
        )
        final_errors = last_result.errors if last_result else []
        self._sm.update(
            run_id,
            {
                "status": "fallback",
                "tools_used": tools_used,
                "results": last_result.model_dump() if last_result else {},
                "errors": final_errors,
            },
        )
        fallback = ExecutionResult(
            success=False,
            leads_found=last_result.leads_found if last_result else 0,
            high_value=last_result.high_value if last_result else 0,
            message="Primary data source unavailable",
            errors=final_errors,
            retried=True,
        )
        self._sm.audit(
            run_id,
            command=raw_command,
            plan=plan_dump,
            tools_used=tools_used,
            results=fallback.model_dump(),
            errors=final_errors,
        )
        return fallback
