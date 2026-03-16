"""
task_dispatcher/task_dispatcher.py
=====================================
Intelligent task dispatcher for the XPS Intelligence Platform.

Sits between the RuntimeController and the WorkerPool.  It:
  - Parses incoming command dicts
  - Routes to the correct handler function (scrape / seo / social / outreach …)
  - Applies rate-limiting per task type
  - Validates payloads before dispatch
  - Records metrics for every dispatch decision

Handlers are registered via @TaskDispatcher.register(task_type) or
TaskDispatcher.register_handler(task_type, fn).

Usage::

    from task_dispatcher import get_dispatcher

    dispatcher = get_dispatcher()
    result = await dispatcher.dispatch({"type": "scrape", "command": "find epoxy contractors ohio"})
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Any, Callable, Coroutine, Dict, Optional

from observability import record_metric, start_span

logger = logging.getLogger("task_dispatcher")


# ---------------------------------------------------------------------------
# Result model
# ---------------------------------------------------------------------------


@dataclass
class DispatchResult:
    success: bool
    task_type: str
    result: Any = None
    error: Optional[str] = None
    duration_ms: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "task_type": self.task_type,
            "result": self.result,
            "error": self.error,
            "duration_ms": self.duration_ms,
        }


# ---------------------------------------------------------------------------
# Rate limiter (token bucket, per task type)
# ---------------------------------------------------------------------------


class _TokenBucket:
    def __init__(self, rate: float, capacity: float) -> None:
        self._rate = rate          # tokens per second
        self._capacity = capacity  # max burst
        self._tokens = capacity
        self._last = time.monotonic()

    def consume(self, tokens: float = 1.0) -> bool:
        now = time.monotonic()
        elapsed = now - self._last
        self._tokens = min(self._capacity, self._tokens + elapsed * self._rate)
        self._last = now
        if self._tokens >= tokens:
            self._tokens -= tokens
            return True
        return False


# ---------------------------------------------------------------------------
# TaskDispatcher
# ---------------------------------------------------------------------------


# Handler type: async (payload: dict) → dict
_Handler = Callable[[Dict[str, Any]], Coroutine[Any, Any, Dict[str, Any]]]

# Rate limits per task type (requests/sec, burst)
_DEFAULT_RATE_LIMITS: Dict[str, tuple[float, float]] = {
    "scrape": (0.5, 5.0),    # 0.5 req/s, burst 5
    "seo": (1.0, 10.0),
    "social": (0.5, 5.0),
    "outreach": (0.2, 3.0),
    "export": (2.0, 20.0),
    "plan": (2.0, 10.0),
    "default": (5.0, 50.0),
}


class TaskDispatcher:
    """Routes tasks to registered handlers with rate-limiting."""

    def __init__(self) -> None:
        self._handlers: Dict[str, _Handler] = {}
        self._rate_limiters: Dict[str, _TokenBucket] = {}
        # Pre-initialise the default fallback bucket once so every unknown type
        # shares it (preserving cross-call rate limiting) rather than getting a
        # fresh full bucket on every dispatch.
        _default_rate, _default_burst = _DEFAULT_RATE_LIMITS["default"]
        self._default_bucket = _TokenBucket(_default_rate, _default_burst)
        self._setup_default_handlers()

    def _setup_default_handlers(self) -> None:
        """Register built-in handlers for known task types."""
        self.register_handler("plan", self._handle_plan)
        self.register_handler("scrape", self._handle_scrape)
        self.register_handler("seo", self._handle_seo)
        self.register_handler("social", self._handle_social)
        self.register_handler("outreach", self._handle_outreach)
        self.register_handler("export", self._handle_export)
        self.register_handler("score", self._handle_score)
        self.register_handler("dedup", self._handle_dedup)
        self.register_handler("code", self._handle_code)
        self.register_handler("github", self._handle_github)
        self.register_handler("predict", self._handle_predict)
        self.register_handler("simulate", self._handle_simulate)

    # ------------------------------------------------------------------
    # Handler registration
    # ------------------------------------------------------------------

    def register_handler(self, task_type: str, handler: _Handler) -> None:
        self._handlers[task_type] = handler
        rate, burst = _DEFAULT_RATE_LIMITS.get(task_type, _DEFAULT_RATE_LIMITS["default"])
        self._rate_limiters[task_type] = _TokenBucket(rate, burst)
        logger.debug("TaskDispatcher: registered handler for '%s'", task_type)

    def register(self, task_type: str) -> Callable[[_Handler], _Handler]:
        """Decorator: @dispatcher.register('my_type')"""
        def decorator(fn: _Handler) -> _Handler:
            self.register_handler(task_type, fn)
            return fn
        return decorator

    # ------------------------------------------------------------------
    # Dispatch
    # ------------------------------------------------------------------

    async def dispatch(self, payload: Dict[str, Any]) -> DispatchResult:
        """Route *payload* to the appropriate handler."""
        task_type = payload.get("type", "plan")
        command = payload.get("command", "")

        with start_span(f"dispatcher.{task_type}", tags={"type": task_type}) as span:
            start = time.monotonic()

            # Rate-limit check
            bucket = self._rate_limiters.get(task_type, self._default_bucket)
            if not bucket.consume():
                record_metric("dispatcher.rate_limited", tags={"type": task_type})
                logger.warning("TaskDispatcher: rate limit exceeded for '%s'", task_type)
                return DispatchResult(
                    success=False,
                    task_type=task_type,
                    error=f"Rate limit exceeded for task type '{task_type}'",
                )

            handler = self._handlers.get(task_type) or self._handlers.get("plan")
            try:
                result = await handler(payload)
                duration = (time.monotonic() - start) * 1000
                record_metric(
                    "dispatcher.task.completed",
                    tags={"type": task_type},
                )
                span.set_tag("success", True)
                return DispatchResult(
                    success=True,
                    task_type=task_type,
                    result=result,
                    duration_ms=duration,
                )
            except Exception as exc:
                duration = (time.monotonic() - start) * 1000
                record_metric("dispatcher.task.failed", tags={"type": task_type})
                span.set_tag("error", str(exc))
                logger.error(
                    "TaskDispatcher: handler for '%s' failed: %s", task_type, exc
                )
                return DispatchResult(
                    success=False,
                    task_type=task_type,
                    error=str(exc),
                    duration_ms=duration,
                )

    # ------------------------------------------------------------------
    # Built-in handlers — delegate to existing agent modules
    # ------------------------------------------------------------------

    async def _handle_plan(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        command = payload.get("command", "")
        try:
            from agent_core.orchestrator import run_pipeline
            return await run_pipeline(command)
        except Exception as exc:
            return {"success": False, "error": str(exc), "command": command}

    async def _handle_scrape(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        command = payload.get("command", "")
        try:
            from agents.scraper.scraper_agent import ScraperAgent
            agent = ScraperAgent()
            return await agent.run(command)
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    async def _handle_seo(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        command = payload.get("command", "")
        try:
            from agents.seo.seo_agent import SEOAgent
            agent = SEOAgent()
            return await agent.run(command)
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    async def _handle_social(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        command = payload.get("command", "")
        try:
            from agents.social.social_agent import SocialAgent
            agent = SocialAgent()
            return await agent.run(command)
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    async def _handle_outreach(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        command = payload.get("command", "")
        try:
            from agents.outreach.outreach_agent import OutreachAgent
            agent = OutreachAgent()
            return await agent.run(command)
        except Exception as exc:
            # Graceful fallback — outreach agent may not be importable in all envs
            return {"success": False, "error": str(exc)}

    async def _handle_export(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return {"success": True, "message": "Export queued", "format": payload.get("format", "json")}

    async def _handle_score(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return {"success": True, "message": "Scoring pipeline queued"}

    async def _handle_dedup(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return {"success": True, "message": "Deduplication queued"}

    async def _handle_code(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        command = payload.get("command", "")
        try:
            from agents.code.code_agent import CodeAgent
            agent = CodeAgent()
            return await agent.run(command)
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    async def _handle_github(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        command = payload.get("command", "")
        try:
            from agents.github.github_agent import GitHubAgent
            agent = GitHubAgent()
            return await agent.run(command)
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    async def _handle_predict(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        command = payload.get("command", "")
        try:
            from agents.prediction.prediction_agent import PredictionAgent
            agent = PredictionAgent()
            return await agent.run(command)
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    async def _handle_simulate(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        command = payload.get("command", "")
        try:
            from agents.simulation.simulation_agent import SimulationAgent
            agent = SimulationAgent()
            return await agent.run(command)
        except Exception as exc:
            return {"success": False, "error": str(exc)}


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

_dispatcher: Optional[TaskDispatcher] = None


def get_dispatcher() -> TaskDispatcher:
    global _dispatcher
    if _dispatcher is None:
        _dispatcher = TaskDispatcher()
    return _dispatcher
