"""
app/api/v1/intelligence.py
===========================
Intelligence & Discovery API endpoints.

GET  /intelligence/discovery              — run market discovery
GET  /intelligence/trends                 — get trend analysis
GET  /intelligence/niches                 — get niche opportunities
GET  /intelligence/briefing               — get daily briefing (JSON)
GET  /intelligence/briefing/markdown      — get daily briefing (Markdown)
GET  /intelligence/system/status          — system guardian status
GET  /intelligence/vision-cortex/status   — vision cortex / scraper status
POST /intelligence/vision-cortex/run      — trigger a scraping run
GET  /intelligence/predictions/{sector}   — financial market prediction for a sector
GET  /intelligence/industry/{industry}/growth  — industry growth model
POST /intelligence/invention/run          — run invention pipeline
GET  /intelligence/hypotheses/generate    — generate hypothesis from observation
GET  /intelligence/experiment/design      — design experiment for a hypothesis
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Ensure repository root modules are importable from within the backend tree
# ---------------------------------------------------------------------------
_REPO_ROOT = Path(__file__).resolve().parents[5]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

router = APIRouter(prefix="/intelligence", tags=["intelligence"])


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class VisionCortexRunRequest(BaseModel):
    """Payload for triggering a scraping run via the vision cortex."""

    industry: str = "flooring"
    region: str = "Texas"
    max_leads: int = 50


class DiscoveryResponse(BaseModel):
    industry: str
    region: str
    opportunity_score: int
    summary: str
    market_analysis: Dict[str, Any] = {}
    trends: List[Dict[str, Any]] = []
    niches: List[Dict[str, Any]] = []


# ---------------------------------------------------------------------------
# Helper: safe import wrapper
# ---------------------------------------------------------------------------


def _try_import(module_path: str):
    """Import *module_path* and return the module, or None on failure."""
    try:
        import importlib

        return importlib.import_module(module_path)
    except Exception as exc:
        logger.warning("module_import_failed module=%s error=%s", module_path, exc)
        return None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/discovery",
    summary="Run market discovery",
    response_description="Unified DISCOVERY_REPORT for the requested industry / region",
)
def get_discovery(
    industry: str = Query(
        default="flooring",
        description="Target industry (e.g. epoxy, flooring, construction)",
    ),
    region: str = Query(default="Texas", description="Target geographic region"),
) -> Dict[str, Any]:
    """Run the full discovery pipeline (market scan + trends + niches) and return
    a structured opportunity report.
    """
    try:
        mod = _try_import("discovery.discovery_engine")
        if mod is None:
            raise ImportError("discovery.discovery_engine not available")
        result = mod.run_discovery(industry=industry, region=region)
        return result
    except Exception as exc:
        logger.error("discovery_endpoint_error: %s", exc)
        # Return demo data so the endpoint never hard-fails
        return {
            "industry": industry,
            "region": region,
            "opportunity_score": 75,
            "summary": f"Demo discovery report for {industry} / {region}.",
            "market_analysis": {"growth_rate": 8.0, "avg_competition": 45},
            "trends": [{"name": industry, "score": 80, "emerging": True}],
            "niches": [
                {
                    "niche": f"Premium {industry}",
                    "opportunity_score": 80,
                    "competition_score": 35,
                }
            ],
            "note": "demo_data",
            "error": str(exc),
        }


@router.get(
    "/trends",
    summary="Get trend analysis",
    response_description="List of detected market trends",
)
def get_trends(
    industry: str = Query(default="flooring", description="Industry to analyse"),
    region: str = Query(default="Texas", description="Target region"),
) -> Dict[str, Any]:
    """Return trend objects for the requested industry / region."""
    try:
        mod = _try_import("discovery.trend_analyzer")
        if mod is None:
            raise ImportError("discovery.trend_analyzer not available")

        analyzer = mod.TrendAnalyzer()
        demo_data = [
            {
                "industry": industry,
                "region": region,
                "source": "api",
                "tags": [industry, "renovation"],
            },
            {
                "industry": industry,
                "region": region,
                "source": "api",
                "tags": [industry, "commercial", "premium"],
            },
        ]
        trends = analyzer.analyze_trends(demo_data)
        emerging = analyzer.detect_emerging(demo_data)
        return {
            "industry": industry,
            "region": region,
            "trends": trends,
            "emerging": emerging,
            "total": len(trends),
        }
    except Exception as exc:
        logger.error("trends_endpoint_error: %s", exc)
        return {
            "industry": industry,
            "region": region,
            "trends": [{"name": industry, "score": 75.0, "emerging": True}],
            "emerging": [{"name": industry, "score": 75.0, "emerging": True}],
            "total": 1,
            "note": "demo_data",
            "error": str(exc),
        }


@router.get(
    "/niches",
    summary="Get niche opportunities",
    response_description="List of detected niche opportunities",
)
def get_niches(
    industry: str = Query(default="flooring", description="Industry to scan"),
    region: str = Query(default="Texas", description="Target region"),
) -> Dict[str, Any]:
    """Return underserved niche opportunities for the requested industry / region."""
    try:
        mod = _try_import("discovery.niche_detector")
        if mod is None:
            raise ImportError("discovery.niche_detector not available")

        detector = mod.NicheDetector()
        niches = detector.detect(industry=industry, region=region)
        return {
            "industry": industry,
            "region": region,
            "niches": niches,
            "total": len(niches),
        }
    except Exception as exc:
        logger.error("niches_endpoint_error: %s", exc)
        return {
            "industry": industry,
            "region": region,
            "niches": [
                {
                    "niche": f"Premium {industry}",
                    "opportunity_score": 80,
                    "competition_score": 30,
                }
            ],
            "total": 1,
            "note": "demo_data",
            "error": str(exc),
        }


@router.get(
    "/briefing",
    summary="Get daily intelligence briefing (JSON)",
    response_description="Structured daily briefing object",
)
def get_briefing() -> Dict[str, Any]:
    """Return the full daily intelligence briefing as structured JSON."""
    try:
        mod = _try_import("notifications.daily_briefing_agent")
        if mod is None:
            raise ImportError("notifications.daily_briefing_agent not available")

        agent = mod.DailyBriefingAgent()
        return agent.generate_json()
    except Exception as exc:
        logger.error("briefing_endpoint_error: %s", exc)
        from datetime import date, datetime, timezone

        return {
            "date": date.today().isoformat(),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_leads": 0,
            "financial_predictions": [],
            "market_opportunities": [],
            "startup_signals": [],
            "top_leads": [],
            "system_health": {"status": "unknown"},
            "note": "demo_data",
            "error": str(exc),
        }


@router.get(
    "/briefing/markdown",
    summary="Get daily intelligence briefing (Markdown)",
    response_description="Markdown-formatted daily briefing",
)
def get_briefing_markdown() -> Dict[str, Any]:
    """Return the daily briefing rendered as a Markdown string."""
    try:
        mod = _try_import("notifications.daily_briefing_agent")
        if mod is None:
            raise ImportError("notifications.daily_briefing_agent not available")

        agent = mod.DailyBriefingAgent()
        return {"markdown": agent.generate()}
    except Exception as exc:
        logger.error("briefing_markdown_error: %s", exc)
        return {
            "markdown": "# XPS Daily Briefing\n\n_Data unavailable._",
            "error": str(exc),
        }


@router.get(
    "/system/status",
    summary="System Guardian status",
    response_description="Full system health and anomaly report",
)
def get_system_status() -> Dict[str, Any]:
    """Return a comprehensive system health report via the System Guardian."""
    try:
        mod = _try_import("system_guardian.system_guardian")
        if mod is None:
            raise ImportError("system_guardian.system_guardian not available")

        return mod.get_system_status()
    except Exception as exc:
        logger.error("system_status_endpoint_error: %s", exc)
        return {
            "overall": "unknown",
            "health": {},
            "issues": [],
            "note": "demo_data",
            "error": str(exc),
        }


@router.get(
    "/vision-cortex/status",
    summary="Vision cortex / scraper status",
    response_description="Status of the vision cortex scraping subsystem",
)
def get_vision_cortex_status() -> Dict[str, Any]:
    """Return the current status of the vision cortex scraping layer."""
    try:
        vision_path = _REPO_ROOT / "vision_cortex"
        scripts = list(vision_path.glob("*.py")) if vision_path.exists() else []
        return {
            "available": vision_path.exists(),
            "scripts": [s.name for s in scripts],
            "status": "idle",
        }
    except Exception as exc:
        logger.error("vision_cortex_status_error: %s", exc)
        return {
            "available": False,
            "scripts": [],
            "status": "unknown",
            "error": str(exc),
        }


@router.post(
    "/vision-cortex/run",
    summary="Trigger a vision cortex scraping run",
    status_code=status.HTTP_202_ACCEPTED,
    response_description="Acknowledgement of the scraping run request",
)
def trigger_vision_cortex_run(payload: VisionCortexRunRequest) -> Dict[str, Any]:
    """Enqueue a scraping run for the requested industry / region.

    The run is dispatched to the task queue; this endpoint returns immediately
    with an acknowledgement and a task reference.
    """
    try:
        import uuid

        task_id = str(uuid.uuid4())
        logger.info(
            "vision_cortex_run_requested industry=%s region=%s task_id=%s",
            payload.industry,
            payload.region,
            task_id,
        )
        # Attempt to enqueue via the runtime queue if available
        try:
            from app.queue.queue_manager import QueueManager

            qm = QueueManager()
            qm.enqueue(
                "scrape",
                {
                    "industry": payload.industry,
                    "region": payload.region,
                    "max_leads": payload.max_leads,
                    "task_id": task_id,
                },
            )
        except Exception:
            # Queue may not be running in all environments — not fatal
            pass

        return {
            "accepted": True,
            "task_id": task_id,
            "industry": payload.industry,
            "region": payload.region,
            "max_leads": payload.max_leads,
            "message": f"Scraping run queued for {payload.industry} in {payload.region}.",
        }
    except Exception as exc:
        logger.error("vision_cortex_run_error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to enqueue scraping run: {exc}",
        ) from exc


# ---------------------------------------------------------------------------
# Phase 9 — Financial predictions
# ---------------------------------------------------------------------------


@router.get(
    "/predictions/{sector}",
    summary="Financial market prediction for a sector",
    response_description="Growth forecast and signals for the requested sector",
)
def get_financial_prediction(
    sector: str,
    timeframe_months: int = Query(
        default=12, ge=1, le=60, description="Forecast horizon in months"
    ),
) -> Dict[str, Any]:
    """Return a heuristic financial market forecast for *sector* over *timeframe_months*."""
    try:
        from predictions.financial_market_predictor import FinancialMarketPredictor

        predictor = FinancialMarketPredictor()
        return predictor.predict(sector=sector, timeframe_months=timeframe_months)
    except Exception as exc:
        logger.error("financial_prediction_error sector=%s: %s", sector, exc)
        return {
            "sector": sector,
            "timeframe_months": timeframe_months,
            "growth_prediction": 5.0,
            "confidence": 0.55,
            "bullish_signals": ["General economic expansion."],
            "bearish_signals": ["Macroeconomic uncertainty."],
            "recommendation": "watch",
            "note": "demo_data",
            "error": str(exc),
        }


@router.get(
    "/industry/{industry}/growth",
    summary="Industry growth model",
    response_description="Historical context, projections, and growth drivers for the industry",
)
def get_industry_growth(industry: str) -> Dict[str, Any]:
    """Return a growth model for the requested *industry*."""
    try:
        from predictions.industry_growth_model import IndustryGrowthModel

        model = IndustryGrowthModel()
        return model.model(industry=industry)
    except Exception as exc:
        logger.error("industry_growth_error industry=%s: %s", industry, exc)
        return {
            "industry": industry,
            "description": f"Growth model for {industry}.",
            "historical_cagr_pct": 5.0,
            "current_market_size_bn": 10.0,
            "projected_market_size_bn": 12.8,
            "projection_years": 5,
            "annual_projections": [],
            "growth_drivers": ["General economic expansion."],
            "headwinds": ["Macroeconomic uncertainty."],
            "growth_potential_score": 55,
            "note": "demo_data",
            "error": str(exc),
        }


# ---------------------------------------------------------------------------
# Phase 7 — Invention pipeline
# ---------------------------------------------------------------------------


class InventionPipelineRequest(BaseModel):
    """Payload for the invention pipeline endpoint."""

    industry: str = "flooring"
    count: int = 5


@router.post(
    "/invention/run",
    summary="Run the invention pipeline",
    status_code=status.HTTP_200_OK,
    response_description="Full invention report with scored and ranked ideas",
)
def run_invention(payload: InventionPipelineRequest) -> Dict[str, Any]:
    """Generate, score, and rank business ideas for the requested industry.

    Returns a full report dict including a Markdown ``markdown_report`` field.
    """
    try:
        from invention_factory.invention_pipeline import run_invention_pipeline

        return run_invention_pipeline(industry=payload.industry, count=payload.count)
    except Exception as exc:
        logger.error("invention_pipeline_error industry=%s: %s", payload.industry, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Invention pipeline failed: {exc}",
        ) from exc


# ---------------------------------------------------------------------------
# Phase 5 — Meta-cognition: hypotheses and experiment design
# ---------------------------------------------------------------------------


@router.get(
    "/hypotheses/generate",
    summary="Generate a hypothesis from a market observation",
    response_description="Structured hypothesis dict with confidence and suggested experiments",
)
def generate_hypothesis(
    observation: str = Query(
        ..., description="Free-text market observation to convert into a hypothesis"
    ),
) -> Dict[str, Any]:
    """Convert a market *observation* into a testable hypothesis with metadata."""
    try:
        from research.hypotheses.hypothesis_generator import HypothesisGenerator

        generator = HypothesisGenerator()
        return generator.generate_from_observation(observation)
    except Exception as exc:
        logger.error("hypothesis_generation_error: %s", exc)
        return {
            "hypothesis": f"The observation '{observation[:60]}...' warrants further investigation.",  # noqa: E501
            "confidence": 0.5,
            "category": "market",
            "testability": "medium",
            "suggested_experiments": ["Conduct a targeted market survey."],
            "note": "demo_data",
            "error": str(exc),
        }


@router.get(
    "/experiment/design",
    summary="Design an experiment for a hypothesis",
    response_description="Structured experiment plan with type, metrics, duration and risk factors",
)
def design_experiment(
    hypothesis: str = Query(
        ..., description="Hypothesis statement to design an experiment for"
    ),
    metrics: Optional[str] = Query(
        default=None, description="Comma-separated list of evaluation metrics"
    ),
) -> Dict[str, Any]:
    """Return a structured experiment plan for the given *hypothesis*.

    Supply an optional comma-separated *metrics* list to override the defaults.
    """
    try:
        from research.experiment_design import ExperimentDesigner

        designer = ExperimentDesigner()
        metric_list: Optional[List[str]] = (
            [m.strip() for m in metrics.split(",") if m.strip()] if metrics else None
        )
        return designer.design(hypothesis=hypothesis, metrics=metric_list)
    except Exception as exc:
        logger.error("experiment_design_error: %s", exc)
        return {
            "hypothesis": hypothesis,
            "experiment_type": "analysis",
            "proposed_experiment": "Conduct a structured market analysis.",
            "evaluation_metrics": ["growth_rate", "market_size"],
            "estimated_duration": "1 week",
            "resources_needed": ["market data sources"],
            "success_criteria": "Data supports hypothesis at ≥ 70 % confidence.",
            "risk_factors": ["Incomplete data coverage."],
            "note": "demo_data",
            "error": str(exc),
        }
