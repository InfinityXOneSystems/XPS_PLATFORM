"""
discovery/discovery_engine.py
================================
Discovery Engine — orchestrates market scanning, trend analysis,
and niche detection into a unified DISCOVERY_REPORT.

Usage::

    from discovery.discovery_engine import run_discovery

    report = run_discovery("epoxy", "Texas")
    print(report["opportunity_score"])
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


def run_discovery(industry: str, region: str) -> dict:
    """Run the full discovery pipeline for *industry* in *region*.

    Orchestrates:

    1. :class:`~discovery.market_scanner.MarketScanner` — market analysis
    2. :class:`~discovery.trend_analyzer.TrendAnalyzer` — trend detection
    3. :class:`~discovery.niche_detector.NicheDetector` — niche opportunities

    Returns a unified dict suitable for serialising as ``DISCOVERY_REPORT.json``.
    """
    from discovery.market_scanner import MarketScanner
    from discovery.niche_detector import NicheDetector
    from discovery.trend_analyzer import TrendAnalyzer

    report: Dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "industry": industry,
        "region": region,
        "market_analysis": {},
        "trends": [],
        "niches": [],
        "opportunity_score": 0,
        "summary": "",
    }

    # --- 1. Market scan ---------------------------------------------------
    try:
        scanner = MarketScanner()
        market_data = scanner.scan(industry, region)
        market_score = scanner.score_market(market_data)
        report["market_analysis"] = market_data
        report["market_score"] = market_score
        logger.info("market_scan_done score=%s", market_score)
    except Exception as exc:
        logger.warning("market_scan_failed: %s", exc)
        report["market_analysis"] = {"error": str(exc)}
        market_score = 50

    # --- 2. Trend analysis ------------------------------------------------
    try:
        analyzer = TrendAnalyzer()
        demo_data = _build_demo_data(industry, region)
        trends = analyzer.analyze_trends(demo_data)
        emerging = analyzer.detect_emerging(demo_data)
        report["trends"] = trends
        report["emerging_trends"] = emerging
        trend_score = round(sum(t["score"] for t in emerging) / max(len(emerging), 1), 2)
        report["trend_score"] = trend_score
        logger.info("trends_done count=%s emerging=%s", len(trends), len(emerging))
    except Exception as exc:
        logger.warning("trend_analysis_failed: %s", exc)
        report["trends"] = []
        trend_score = 50

    # --- 3. Niche detection -----------------------------------------------
    try:
        detector = NicheDetector()
        niches = detector.detect(industry, region)
        report["niches"] = niches
        niche_score = round(sum(n["opportunity_score"] for n in niches) / max(len(niches), 1), 2)
        report["niche_score"] = niche_score
        logger.info("niches_done count=%s", len(niches))
    except Exception as exc:
        logger.warning("niche_detection_failed: %s", exc)
        report["niches"] = []
        niche_score = 50

    # --- 4. Composite score -----------------------------------------------
    composite = int((market_score * 0.4) + (trend_score * 0.3) + (niche_score * 0.3))
    report["opportunity_score"] = min(composite, 100)

    # --- 5. Summary -------------------------------------------------------
    tier = _score_tier(report["opportunity_score"])
    top_niches: List[str] = [n["niche"] for n in report.get("niches", [])[:2]]
    report["summary"] = (
        f"{tier} opportunity in {industry} / {region}. "
        f"Market growth rate: {report['market_analysis'].get('growth_rate', 'N/A')}%. "
        f"Top niches: {', '.join(top_niches) or 'N/A'}."
    )

    logger.info("discovery_complete industry=%s region=%s score=%s tier=%s", industry, region, report["opportunity_score"], tier)
    return report


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _score_tier(score: int) -> str:
    if score >= 80:
        return "🔥 HIGH"
    if score >= 55:
        return "🟡 MODERATE"
    return "❄️ LOW"


def _build_demo_data(industry: str, region: str) -> list:
    """Build a minimal list of demo records to feed the trend analyzer."""
    return [
        {"industry": industry, "region": region, "source": "demo", "tags": [industry, "renovation"]},
        {"industry": industry, "region": region, "source": "demo", "tags": [industry, "commercial"]},
        {"industry": industry, "region": region, "source": "demo", "tags": [industry, "residential", "premium"]},
    ]
