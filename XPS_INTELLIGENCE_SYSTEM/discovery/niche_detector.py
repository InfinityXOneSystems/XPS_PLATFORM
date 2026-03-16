"""
discovery/niche_detector.py
============================
Niche Detector — finds underserved market niches.

Combines competition analysis and demand signals to identify
high-opportunity gaps in a given industry and region.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Niche seed data keyed by normalised industry name
# ---------------------------------------------------------------------------

_NICHE_DATA: Dict[str, List[Dict[str, Any]]] = {
    "flooring": [
        {
            "niche": "Luxury Vinyl Plank (LVP) installation",
            "competition_score": 35,
            "demand_index": 88,
            "opportunity_score": 85,
            "rationale": "Rapidly replacing carpet in mid-range homes; few specialists.",
        },
        {
            "niche": "Commercial hardwood refinishing",
            "competition_score": 28,
            "demand_index": 76,
            "opportunity_score": 90,
            "rationale": "Hotels and offices on 5-year refinish cycles; long contracts.",
        },
        {
            "niche": "Heated radiant floor systems",
            "competition_score": 20,
            "demand_index": 65,
            "opportunity_score": 93,
            "rationale": "Premium add-on with near-zero local competition in most metros.",
        },
    ],
    "epoxy": [
        {
            "niche": "Residential garage epoxy",
            "competition_score": 40,
            "demand_index": 92,
            "opportunity_score": 82,
            "rationale": "Viral social media exposure; homeowners actively searching.",
        },
        {
            "niche": "Industrial warehouse coatings",
            "competition_score": 30,
            "demand_index": 84,
            "opportunity_score": 88,
            "rationale": "OSHA safety markings drive recurring demand; large ticket sizes.",
        },
        {
            "niche": "Decorative metallic epoxy",
            "competition_score": 18,
            "demand_index": 70,
            "opportunity_score": 95,
            "rationale": "Niche aesthetic demand; very few certified installers.",
        },
    ],
    "construction": [
        {
            "niche": "ADU / accessory dwelling unit builds",
            "competition_score": 45,
            "demand_index": 89,
            "opportunity_score": 76,
            "rationale": "State zoning reforms opening ADU market; permits accelerating.",
        },
        {
            "niche": "Passive-house / green construction",
            "competition_score": 22,
            "demand_index": 68,
            "opportunity_score": 92,
            "rationale": "Energy-code tightening creates premium market with few qualified builders.",
        },
    ],
    "landscaping": [
        {
            "niche": "Xeriscaping / drought-tolerant design",
            "competition_score": 25,
            "demand_index": 82,
            "opportunity_score": 90,
            "rationale": "Water restrictions in Sun Belt driving mandatory conversions.",
        },
        {
            "niche": "Outdoor kitchen & hardscape",
            "competition_score": 50,
            "demand_index": 95,
            "opportunity_score": 74,
            "rationale": "Post-pandemic outdoor living boom; high average ticket value.",
        },
    ],
}


class NicheDetector:
    """Finds underserved market niches for a given industry and region."""

    def __init__(self) -> None:
        self._last_report: List[dict] = []

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def detect(self, industry: str, region: str) -> List[dict]:
        """Return niches for *industry* in *region*, sorted by opportunity.

        Each item contains ``niche``, ``competition_score`` (lower = better),
        ``opportunity_score`` (higher = better), and ``rationale``.
        """
        key = industry.lower().strip().split()[0]
        niches = _NICHE_DATA.get(key, self._generic_niches(industry))
        enriched = [
            {**n, "region": region, "industry": industry}
            for n in niches
        ]
        enriched.sort(key=lambda n: n["opportunity_score"], reverse=True)
        self._last_report = enriched
        logger.info("niches_detected industry=%s region=%s count=%s", industry, region, len(enriched))
        return enriched

    def score_competition(self, niche: str) -> int:
        """Return a 0–100 competition score for *niche* (lower = less competition).

        Uses stored niche data when available, otherwise estimates from name length
        as a simple heuristic for unknown niches.
        """
        for niches in _NICHE_DATA.values():
            for item in niches:
                if niche.lower() in item["niche"].lower():
                    return item["competition_score"]
        # Generic heuristic: longer / more specific names imply lower competition
        return max(10, 60 - len(niche) // 2)

    def generate_report(self) -> str:
        """Return the last detection results serialised as a JSON string.

        The output matches the structure expected for ``DISCOVERY_REPORT.json``.
        """
        report = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "module": "NicheDetector",
            "niches": self._last_report,
            "total": len(self._last_report),
        }
        return json.dumps(report, indent=2)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _generic_niches(industry: str) -> List[Dict[str, Any]]:
        return [
            {
                "niche": f"Premium {industry} services",
                "competition_score": 40,
                "demand_index": 70,
                "opportunity_score": 70,
                "rationale": f"Generic premium tier in {industry}; moderate opportunity.",
            },
            {
                "niche": f"Commercial {industry} contracts",
                "competition_score": 35,
                "demand_index": 75,
                "opportunity_score": 75,
                "rationale": f"B2B contracts offer stable recurring revenue in {industry}.",
            },
        ]
