"""
predictions/financial_market_predictor.py
==========================================
Financial Market Predictor — forecasts financial market trends.

Uses heuristic models based on industry data and trends.
No external ML dependencies required.
"""
from __future__ import annotations

from typing import List


# ---------------------------------------------------------------------------
# Sector knowledge base
# ---------------------------------------------------------------------------

_SECTOR_DATA: dict[str, dict] = {
    "flooring": {
        "base_growth": 6.5,
        "volatility": 0.12,
        "bullish": [
            "Residential construction spending at multi-decade highs.",
            "Luxury vinyl plank demand growing 14 % YoY.",
            "Remote-work home-improvement cycle sustained.",
        ],
        "bearish": [
            "Rising raw material costs compressing margins.",
            "Supply-chain disruptions from overseas manufacturers.",
        ],
        "default_rec": "buy",
    },
    "construction": {
        "base_growth": 5.8,
        "volatility": 0.15,
        "bullish": [
            "Infrastructure bill driving commercial project pipeline.",
            "Housing undersupply in major metropolitan areas.",
            "Green building certifications creating premium-price opportunities.",
        ],
        "bearish": [
            "Labour shortages limiting project velocity.",
            "Interest-rate sensitivity for new residential starts.",
        ],
        "default_rec": "hold",
    },
    "epoxy": {
        "base_growth": 9.2,
        "volatility": 0.18,
        "bullish": [
            "Industrial and warehouse flooring demand accelerating with e-commerce.",
            "Chemical-resistant flooring mandates in food/pharma sectors.",
            "DIY epoxy kits mainstream in home-improvement retail.",
        ],
        "bearish": [
            "Volatile petrochemical input prices.",
            "Skilled application labour in short supply.",
        ],
        "default_rec": "buy",
    },
    "technology": {
        "base_growth": 11.0,
        "volatility": 0.25,
        "bullish": [
            "AI adoption accelerating across all enterprise segments.",
            "Cloud infrastructure spending up 22 % YoY.",
            "SMB software spend recovering post-pandemic contraction.",
        ],
        "bearish": [
            "Valuation multiples compressed by rising discount rates.",
            "Increased regulatory scrutiny on data and AI.",
        ],
        "default_rec": "hold",
    },
    "real_estate": {
        "base_growth": 3.2,
        "volatility": 0.20,
        "bullish": [
            "Long-term housing undersupply in growth metros.",
            "Institutional capital continuing to flow into single-family rentals.",
        ],
        "bearish": [
            "Mortgage-rate sensitivity dampening transaction volumes.",
            "Office sector secular decline post-remote-work shift.",
        ],
        "default_rec": "watch",
    },
}

_DEFAULT_SECTOR = {
    "base_growth": 5.0,
    "volatility": 0.15,
    "bullish": [
        "General economic expansion supporting sector spending.",
        "Emerging-market demand providing incremental growth.",
    ],
    "bearish": [
        "Macroeconomic uncertainty may reduce discretionary investment.",
        "Competitive pressure from new entrants.",
    ],
    "default_rec": "watch",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _growth_for_timeframe(base: float, timeframe_months: int) -> float:
    """Annualise or pro-rate the base growth rate for the given timeframe."""
    annual = base
    if timeframe_months <= 3:
        return round(annual * (timeframe_months / 12) * 0.9, 2)
    if timeframe_months <= 6:
        return round(annual * (timeframe_months / 12), 2)
    if timeframe_months <= 12:
        return round(annual, 2)
    return round(annual * (timeframe_months / 12) * 0.85, 2)  # compounding fatigue


def _confidence_for_timeframe(timeframe_months: int, volatility: float) -> float:
    decay = min(timeframe_months / 24, 0.4)
    return round(max(0.90 - volatility - decay, 0.30), 2)


def _recommendation(growth: float, confidence: float, default: str) -> str:
    if growth >= 8.0 and confidence >= 0.65:
        return "buy"
    if growth >= 5.0 and confidence >= 0.50:
        return "hold"
    if growth >= 3.0:
        return "watch"
    return "avoid"


# ---------------------------------------------------------------------------
# Main class
# ---------------------------------------------------------------------------


class FinancialMarketPredictor:
    """Heuristic financial market predictor for sector-level trend forecasting."""

    def predict(self, sector: str, timeframe_months: int = 12) -> dict:
        """Forecast financial market trends for a sector over a given timeframe.

        Parameters
        ----------
        sector:
            Industry sector name (e.g. 'flooring', 'construction', 'epoxy').
        timeframe_months:
            Forecast horizon in months (default 12).

        Returns
        -------
        dict with keys: sector, timeframe_months, growth_prediction, confidence,
        bullish_signals, bearish_signals, recommendation.
        """
        data = _SECTOR_DATA.get(sector.lower().replace(" ", "_"), _DEFAULT_SECTOR)
        growth = _growth_for_timeframe(data["base_growth"], timeframe_months)
        confidence = _confidence_for_timeframe(timeframe_months, data["volatility"])
        rec = _recommendation(growth, confidence, data["default_rec"])

        return {
            "sector": sector,
            "timeframe_months": timeframe_months,
            "growth_prediction": growth,
            "confidence": confidence,
            "bullish_signals": list(data["bullish"]),
            "bearish_signals": list(data["bearish"]),
            "recommendation": rec,
        }

    def predict_multiple(self, sectors: List[str]) -> List[dict]:
        """Return predictions for a list of sector names.

        Parameters
        ----------
        sectors:
            List of sector name strings.

        Returns
        -------
        List of prediction dicts sorted by growth_prediction descending.
        """
        results = [self.predict(s) for s in sectors]
        return sorted(results, key=lambda r: r["growth_prediction"], reverse=True)
