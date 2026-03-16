"""
discovery/market_scanner.py
============================
Market Scanner — discovers emerging business opportunities.

Scans configured industry verticals and geographic markets
to identify under-served niches and growth signals.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Demo / seed data used when no live data source is available.
# ---------------------------------------------------------------------------

_DEMO_MARKETS: Dict[str, Dict[str, Any]] = {
    "flooring": {
        "industry": "flooring",
        "growth_rate": 7.2,
        "avg_competition": 62,
        "top_regions": ["Texas", "Florida", "California", "Georgia"],
        "opportunity_score": 78,
        "signals": [
            "Rising residential construction permits",
            "Post-pandemic home renovation boom",
            "Luxury vinyl plank demand up 23 %",
        ],
    },
    "construction": {
        "industry": "construction",
        "growth_rate": 5.8,
        "avg_competition": 71,
        "top_regions": ["Texas", "Arizona", "North Carolina", "Nevada"],
        "opportunity_score": 65,
        "signals": [
            "Infrastructure bill driving commercial projects",
            "Labour shortage creating premium pricing opportunities",
            "Modular construction adoption accelerating",
        ],
    },
    "epoxy": {
        "industry": "epoxy flooring",
        "growth_rate": 14.5,
        "avg_competition": 38,
        "top_regions": ["Texas", "Florida", "Ohio", "Michigan"],
        "opportunity_score": 91,
        "signals": [
            "Garage epoxy trend surging on social media",
            "Industrial demand from warehouses and gyms",
            "Few established regional players",
        ],
    },
    "landscaping": {
        "industry": "landscaping",
        "growth_rate": 6.1,
        "avg_competition": 55,
        "top_regions": ["Florida", "Texas", "California", "Illinois"],
        "opportunity_score": 72,
        "signals": [
            "Drought-resistant landscaping demand rising",
            "HOA requirements driving recurring contracts",
            "Smart irrigation upsell potential",
        ],
    },
}

_NICHE_POOL: Dict[str, List[Dict[str, Any]]] = {
    "flooring": [
        {"niche": "Luxury Vinyl Plank installation", "competition_score": 35, "opportunity_score": 85},
        {"niche": "Commercial hardwood refinishing", "competition_score": 28, "opportunity_score": 90},
        {"niche": "Heated radiant floor systems", "competition_score": 20, "opportunity_score": 93},
    ],
    "epoxy": [
        {"niche": "Residential garage epoxy", "competition_score": 40, "opportunity_score": 82},
        {"niche": "Industrial warehouse coatings", "competition_score": 30, "opportunity_score": 88},
        {"niche": "Decorative metallic epoxy", "competition_score": 18, "opportunity_score": 95},
    ],
    "construction": [
        {"niche": "ADU / granny-flat builds", "competition_score": 45, "opportunity_score": 76},
        {"niche": "Tiny-home construction", "competition_score": 32, "opportunity_score": 84},
        {"niche": "Green / passive-house builds", "competition_score": 22, "opportunity_score": 92},
    ],
    "landscaping": [
        {"niche": "Xeriscaping / drought-tolerant design", "competition_score": 25, "opportunity_score": 90},
        {"niche": "Outdoor kitchen & hardscape", "competition_score": 50, "opportunity_score": 74},
        {"niche": "Commercial property maintenance contracts", "competition_score": 38, "opportunity_score": 80},
    ],
}


class MarketScanner:
    """Discovers emerging business opportunities across industry verticals."""

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def scan(self, industry: str, region: str) -> dict:
        """Return a market analysis dict for *industry* in *region*.

        Falls back to demo data when no live source is available.
        """
        key = self._normalise_key(industry)
        base = _DEMO_MARKETS.get(key, self._generic_market(industry))
        result = {**base, "region": region, "industry": industry}
        logger.info("market_scan_complete industry=%s region=%s", industry, region)
        return result

    def find_niches(self, industry: str) -> List[dict]:
        """Return niche opportunities for *industry*."""
        key = self._normalise_key(industry)
        niches = _NICHE_POOL.get(key, self._generic_niches(industry))
        logger.info("niches_found industry=%s count=%s", industry, len(niches))
        return niches

    def score_market(self, market_data: dict) -> int:
        """Compute a 0-100 opportunity score from *market_data*.

        Higher scores indicate greater opportunity.
        """
        score = 0

        growth = market_data.get("growth_rate", 0)
        score += min(int(growth * 3), 30)

        competition = market_data.get("avg_competition", 100)
        score += max(0, 30 - int(competition * 0.3))

        signals = market_data.get("signals", [])
        score += min(len(signals) * 10, 30)

        top_regions = market_data.get("top_regions", [])
        score += min(len(top_regions) * 2, 10)

        return min(score, 100)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _normalise_key(industry: str) -> str:
        return industry.lower().strip().split()[0]

    @staticmethod
    def _generic_market(industry: str) -> dict:
        return {
            "industry": industry,
            "growth_rate": 5.0,
            "avg_competition": 60,
            "top_regions": ["Texas", "Florida", "California"],
            "opportunity_score": 60,
            "signals": [f"Steady demand in {industry} sector"],
        }

    @staticmethod
    def _generic_niches(industry: str) -> List[dict]:
        return [
            {"niche": f"Premium {industry} services", "competition_score": 40, "opportunity_score": 70},
            {"niche": f"Commercial {industry} contracts", "competition_score": 35, "opportunity_score": 75},
        ]
