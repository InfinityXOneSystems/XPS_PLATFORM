"""
predictions/industry_growth_model.py
=====================================
Industry Growth Model — models industry growth trajectories.
"""
from __future__ import annotations


# ---------------------------------------------------------------------------
# Industry knowledge base
# ---------------------------------------------------------------------------

_INDUSTRY_PROFILES: dict[str, dict] = {
    "flooring": {
        "description": "Residential and commercial floor-covering installation and supply.",
        "historical_cagr": 5.2,
        "current_market_size_bn": 42.0,
        "projected_market_size_bn": 58.0,
        "projection_years": 5,
        "drivers": [
            "Ongoing residential construction boom in Sun Belt states.",
            "Commercial renovation driven by return-to-office mandates.",
            "Luxury vinyl plank capturing laminate share at higher ASPs.",
        ],
        "headwinds": [
            "Import tariffs raising material costs.",
            "DIY channel erosion of professional installation revenue.",
        ],
        "growth_potential": 72,
    },
    "epoxy": {
        "description": "Epoxy coatings and resin flooring for industrial, commercial, and residential use.",
        "historical_cagr": 7.8,
        "current_market_size_bn": 5.6,
        "projected_market_size_bn": 8.2,
        "projection_years": 5,
        "drivers": [
            "E-commerce warehouse expansion driving industrial flooring demand.",
            "DIY mainstream adoption fuelled by social-media visibility.",
            "Food-safety and pharmaceutical compliance requirements.",
        ],
        "headwinds": [
            "Petrochemical input cost volatility.",
            "Specialised applicator shortage limiting market penetration.",
        ],
        "growth_potential": 84,
    },
    "construction": {
        "description": "General building and civil construction contracting.",
        "historical_cagr": 4.5,
        "current_market_size_bn": 1800.0,
        "projected_market_size_bn": 2250.0,
        "projection_years": 5,
        "drivers": [
            "Public infrastructure investment via federal spending bills.",
            "Continued data-centre and semiconductor fabrication facility construction.",
            "Residential housing deficit in key urban markets.",
        ],
        "headwinds": [
            "Skilled labour shortages increasing project costs.",
            "Material cost inflation impacting project viability.",
        ],
        "growth_potential": 65,
    },
    "technology": {
        "description": "Enterprise and SMB software, SaaS, and AI services.",
        "historical_cagr": 12.5,
        "current_market_size_bn": 600.0,
        "projected_market_size_bn": 1080.0,
        "projection_years": 5,
        "drivers": [
            "Generative AI driving a new application-layer investment cycle.",
            "Cloud migration still < 30 % complete for legacy enterprise workloads.",
            "Vertical SaaS displacing horizontal platforms in regulated industries.",
        ],
        "headwinds": [
            "Higher interest rates compressing SaaS valuation multiples.",
            "Regulatory pressure on AI and data privacy increasing compliance cost.",
        ],
        "growth_potential": 91,
    },
    "real_estate": {
        "description": "Residential and commercial property transactions, development, and management.",
        "historical_cagr": 3.1,
        "current_market_size_bn": 3700.0,
        "projected_market_size_bn": 4300.0,
        "projection_years": 5,
        "drivers": [
            "Structural housing undersupply in high-demand metros.",
            "Industrial / logistics real estate demand from e-commerce.",
        ],
        "headwinds": [
            "Elevated mortgage rates suppressing affordability.",
            "Office sector secular demand decline.",
        ],
        "growth_potential": 48,
    },
}

_DEFAULT_PROFILE: dict = {
    "description": "General industry sector.",
    "historical_cagr": 4.0,
    "current_market_size_bn": 10.0,
    "projected_market_size_bn": 12.5,
    "projection_years": 5,
    "drivers": ["General economic expansion.", "Digital transformation tailwinds."],
    "headwinds": ["Macroeconomic uncertainty.", "Competitive market saturation."],
    "growth_potential": 50,
}


# ---------------------------------------------------------------------------
# Main class
# ---------------------------------------------------------------------------


class IndustryGrowthModel:
    """Models industry growth trajectories using embedded knowledge profiles."""

    def model(self, industry: str) -> dict:
        """Return a growth model for the specified industry.

        Parameters
        ----------
        industry:
            Industry name (e.g. 'flooring', 'epoxy', 'construction').

        Returns
        -------
        dict with historical context, projections, drivers, and headwinds.
        """
        key = industry.lower().replace(" ", "_")
        profile = _INDUSTRY_PROFILES.get(key, dict(_DEFAULT_PROFILE))

        cagr = profile["historical_cagr"]
        current = profile["current_market_size_bn"]
        projected = profile["projected_market_size_bn"]
        years = profile["projection_years"]

        # Build year-by-year projection
        annual_projections = []
        size = current
        for yr in range(1, years + 1):
            size = round(size * (1 + cagr / 100), 2)
            annual_projections.append({"year": f"Year {yr}", "market_size_bn": size})

        return {
            "industry": industry,
            "description": profile["description"],
            "historical_cagr_pct": cagr,
            "current_market_size_bn": current,
            "projected_market_size_bn": projected,
            "projection_years": years,
            "annual_projections": annual_projections,
            "growth_drivers": profile["drivers"],
            "headwinds": profile["headwinds"],
            "growth_potential_score": profile["growth_potential"],
        }

    def score_growth_potential(self, industry: str) -> int:
        """Return a 0–100 growth potential score for the industry.

        Parameters
        ----------
        industry:
            Industry name.

        Returns
        -------
        Integer score between 0 and 100.
        """
        key = industry.lower().replace(" ", "_")
        profile = _INDUSTRY_PROFILES.get(key, _DEFAULT_PROFILE)
        return int(profile.get("growth_potential", 50))
