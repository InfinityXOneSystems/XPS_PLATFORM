"""
agents/vision/vision_agent.py
Vision Agent — Long-range intelligence and market horizon scanning.

Capabilities:
  - Ingest and analyse daily intelligence from Vision Cortex
  - Identify market trends in flooring/construction industries
  - Generate strategic insight reports
  - Feed findings to the Infinity Library for vector search
Vision Agent — detects trends and emerging opportunities.

Reads intelligence from vision_cortex and infinity_library.
Generates forward-looking insights.
"""

from __future__ import annotations

import logging
from typing import Any

from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)


class VisionAgent(BaseAgent):
    """Long-range market intelligence and horizon scanning agent."""

    agent_name = "VISION_AGENT"

    async def execute(self, task: dict, context: dict | None = None) -> dict[str, Any]:
        """Execute a vision-level intelligence task.

        Supported task types:
          - ``scan_market``      — Analyse current market conditions
          - ``generate_report``  — Produce an intelligence report
          - ``ingest_cortex``    — Ingest data from Vision Cortex
        """
        ctx = context or {}
        task_type = task.get("type", "scan_market")

        logger.info("[VISION_AGENT] Processing task type=%s", task_type)

        if task_type == "generate_report":
            return await self._generate_report(task, ctx)
        if task_type == "ingest_cortex":
            return await self._ingest_cortex(task, ctx)
        return await self._scan_market(task, ctx)

    async def _scan_market(self, task: dict, ctx: dict) -> dict:
        industries = task.get("industries", ["flooring", "construction"])
        regions = task.get("regions", ["nationwide"])

        logger.info("[VISION_AGENT] Scanning market for %s in %s", industries, regions)

        return {
            "success": True,
            "industries": industries,
            "regions": regions,
            "insights": [
                f"Market scan complete for {', '.join(industries)}",
                "Trend: increased demand for eco-friendly flooring",
                "Trend: commercial construction rebound in Sun Belt",
            ],
            "signal_count": 3,
        }

    async def _generate_report(self, task: dict, ctx: dict) -> dict:
        topic = task.get("topic", "market_overview")
        logger.info("[VISION_AGENT] Generating report: %s", topic)
        return {
            "success": True,
            "report_topic": topic,
            "sections": ["executive_summary", "market_trends", "opportunities", "risks"],
            "status": "draft",
        }

    async def _ingest_cortex(self, task: dict, ctx: dict) -> dict:
        source = task.get("source", "vision_cortex/seed_list/")
        logger.info("[VISION_AGENT] Ingesting from Vision Cortex: %s", source)
        return {
            "success": True,
            "source": source,
            "records_ingested": 0,
            "message": "Vision Cortex ingestion queued",
        }
import json
import logging
import os
import time
from pathlib import Path
from typing import Any

try:
    from agents.base_agent import BaseAgent
except ImportError:
    import abc

    class BaseAgent(abc.ABC):  # type: ignore[no-redef]
        agent_name: str = "base_agent"
        max_retries: int = 2
        retry_delay: float = 1.0

        def __init__(self) -> None:
            self._run_id = None
            self._queue = None

        @abc.abstractmethod
        async def execute(self, task: dict, context: dict | None = None) -> dict: ...

        def emit_event(self, *_: Any, **__: Any) -> None: ...
        def capabilities(self) -> list[str]: return []
        def health(self) -> dict: return {"agent": self.agent_name, "status": "ok"}

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data paths
# ---------------------------------------------------------------------------

_REPO_ROOT = Path(__file__).resolve().parents[2]
_VISION_DATA = _REPO_ROOT / "vision_cortex" / "data"
_LIBRARY_DATA = _REPO_ROOT / "infinity_library"

# ---------------------------------------------------------------------------
# Static trend catalogue (heuristic baseline)
# ---------------------------------------------------------------------------

_INDUSTRY_TRENDS: list[dict[str, Any]] = [
    {
        "trend": "Epoxy flooring demand surge",
        "industry": "flooring",
        "strength": 0.88,
        "horizon_months": 18,
        "drivers": ["home renovation boom", "commercial remodels", "DIY content growth"],
    },
    {
        "trend": "Green / sustainable construction materials",
        "industry": "construction",
        "strength": 0.75,
        "horizon_months": 36,
        "drivers": ["ESG mandates", "energy codes", "consumer preference"],
    },
    {
        "trend": "Contractor digitalisation",
        "industry": "general_construction",
        "strength": 0.72,
        "horizon_months": 24,
        "drivers": ["CRM adoption", "online lead gen", "review-driven trust"],
    },
    {
        "trend": "Smart home integration with flooring",
        "industry": "flooring",
        "strength": 0.60,
        "horizon_months": 30,
        "drivers": ["IoT sensors in floors", "heated floor systems", "smart tile"],
    },
    {
        "trend": "Micro-market local contractor dominance",
        "industry": "flooring",
        "strength": 0.80,
        "horizon_months": 12,
        "drivers": ["local SEO", "Google Maps prominence", "trust signals"],
    },
]


class VisionAgent(BaseAgent):
    """
    Vision Agent — forward-looking trend and opportunity intelligence.

    Commands handled via :meth:`execute`:

    * ``"scan trends"``            — return current trend signals
    * ``"identify opportunities"`` — surface scored opportunity list
    * ``"forecast market"``        — produce a market forecast summary

    Reads live data from ``vision_cortex/data/`` and ``infinity_library/``
    when available; falls back to the built-in heuristic catalogue.
    """

    agent_name = "vision_agent"

    # ------------------------------------------------------------------
    # Public execute interface
    # ------------------------------------------------------------------

    async def execute(
        self,
        task: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        command = (task.get("command") or "").lower()
        ctx = context or {}

        self.emit_event("vision.execute", {"command": command})
        logger.info("[%s] Executing command: %s", self.agent_name, command)

        if "scan trend" in command:
            return self._scan_trends(task, ctx)
        if "identify opportunit" in command or "opportunities" in command:
            return self._identify_opportunities(task, ctx)
        if "forecast" in command or "market" in command:
            return self._forecast_market(task, ctx)

        return {
            "success": False,
            "error": f"Vision agent does not handle command: '{command}'",
            "trend_signals": [],
            "opportunity_scores": [],
        }

    # ------------------------------------------------------------------
    # Capabilities
    # ------------------------------------------------------------------

    def capabilities(self) -> list[str]:
        return ["scan trends", "identify opportunities", "forecast market"]

    # ------------------------------------------------------------------
    # Internal handlers
    # ------------------------------------------------------------------

    def _scan_trends(
        self, task: dict[str, Any], ctx: dict[str, Any]
    ) -> dict[str, Any]:
        industry_filter = ctx.get("industry") or task.get("industry")
        trends = self._load_trends(industry_filter)

        return {
            "success": True,
            "trend_signals": trends,
            "total_trends": len(trends),
            "scanned_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "data_sources": self._available_sources(),
        }

    def _identify_opportunities(
        self, task: dict[str, Any], ctx: dict[str, Any]
    ) -> dict[str, Any]:
        industry_filter = ctx.get("industry") or task.get("industry")
        trends = self._load_trends(industry_filter)

        opportunities = []
        for t in trends:
            score = round(t["strength"] * 100)
            opportunities.append({
                "opportunity": t["trend"],
                "industry": t["industry"],
                "opportunity_score": score,
                "horizon_months": t["horizon_months"],
                "drivers": t["drivers"],
                "recommendation": "pursue" if score >= 70 else "monitor",
            })

        opportunities.sort(key=lambda o: o["opportunity_score"], reverse=True)

        return {
            "success": True,
            "opportunity_scores": opportunities,
            "top_opportunity": opportunities[0] if opportunities else None,
            "identified_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

    def _forecast_market(
        self, task: dict[str, Any], ctx: dict[str, Any]
    ) -> dict[str, Any]:
        industry_filter = ctx.get("industry") or task.get("industry") or "flooring"
        trends = self._load_trends(industry_filter)

        avg_strength = (
            sum(t["strength"] for t in trends) / len(trends) if trends else 0.5
        )
        avg_horizon = (
            sum(t["horizon_months"] for t in trends) / len(trends) if trends else 12
        )

        if avg_strength >= 0.75:
            outlook = "BULLISH"
            summary = "Strong growth signals across tracked trends. Expand operations."
        elif avg_strength >= 0.55:
            outlook = "NEUTRAL"
            summary = "Moderate momentum. Maintain current strategy, watch key drivers."
        else:
            outlook = "BEARISH"
            summary = "Weak signals. Tighten spend, focus on proven niches."

        return {
            "success": True,
            "industry": industry_filter,
            "market_outlook": outlook,
            "average_trend_strength": round(avg_strength, 3),
            "average_horizon_months": round(avg_horizon, 1),
            "summary": summary,
            "trend_count": len(trends),
            "forecast_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

    # ------------------------------------------------------------------
    # Data loading helpers
    # ------------------------------------------------------------------

    def _load_trends(self, industry_filter: str | None = None) -> list[dict[str, Any]]:
        trends: list[dict[str, Any]] = []

        # Try live data from vision_cortex/data/
        if _VISION_DATA.is_dir():
            for fpath in _VISION_DATA.glob("*.json"):
                try:
                    with fpath.open() as f:
                        data = json.load(f)
                    if isinstance(data, list):
                        trends.extend(data)
                    elif isinstance(data, dict) and "trends" in data:
                        trends.extend(data["trends"])
                except Exception as exc:
                    logger.debug("VisionAgent: could not read %s: %s", fpath, exc)

        # Fall back to static catalogue if nothing was loaded
        if not trends:
            trends = list(_INDUSTRY_TRENDS)

        if industry_filter:
            fl = industry_filter.lower()
            trends = [t for t in trends if fl in t.get("industry", "").lower()]

        return trends

    def _available_sources(self) -> list[str]:
        sources = ["heuristic_catalogue"]
        if _VISION_DATA.is_dir() and any(_VISION_DATA.glob("*.json")):
            sources.append("vision_cortex/data")
        if _LIBRARY_DATA.is_dir():
            sources.append("infinity_library")
        return sources
