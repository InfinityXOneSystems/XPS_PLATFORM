"""
predictions/niche_opportunity_model.py
========================================
Niche Opportunity Model — identifies and scores niche market opportunities.
"""
from __future__ import annotations

from typing import List


# ---------------------------------------------------------------------------
# Niche knowledge base
# ---------------------------------------------------------------------------

_INDUSTRY_NICHES: dict[str, list[dict]] = {
    "flooring": [
        {
            "niche": "Luxury vinyl plank (LVP) residential installation",
            "opportunity_score": 88,
            "competition_score": 52,
            "growth_rate_pct": 14,
            "target_customer": "Homeowners aged 30–55 undertaking home renovation.",
            "entry_barrier": "low",
        },
        {
            "niche": "Commercial healthcare flooring",
            "opportunity_score": 82,
            "competition_score": 38,
            "growth_rate_pct": 9,
            "target_customer": "Hospital and clinic facility managers.",
            "entry_barrier": "medium",
        },
        {
            "niche": "Sustainable cork & bamboo flooring",
            "opportunity_score": 74,
            "competition_score": 29,
            "growth_rate_pct": 11,
            "target_customer": "Eco-conscious residential and boutique commercial buyers.",
            "entry_barrier": "low",
        },
        {
            "niche": "Multi-family residential flooring contracts",
            "opportunity_score": 80,
            "competition_score": 60,
            "growth_rate_pct": 7,
            "target_customer": "Property developers and HOA managers.",
            "entry_barrier": "medium",
        },
        {
            "niche": "Hardwood floor restoration & refinishing",
            "opportunity_score": 71,
            "competition_score": 44,
            "growth_rate_pct": 5,
            "target_customer": "Owners of pre-1990 homes in established neighbourhoods.",
            "entry_barrier": "low",
        },
    ],
    "epoxy": [
        {
            "niche": "Warehouse & logistics centre epoxy flooring",
            "opportunity_score": 91,
            "competition_score": 35,
            "growth_rate_pct": 18,
            "target_customer": "E-commerce fulfilment centre facility managers.",
            "entry_barrier": "medium",
        },
        {
            "niche": "Residential garage epoxy kits & installation",
            "opportunity_score": 85,
            "competition_score": 55,
            "growth_rate_pct": 22,
            "target_customer": "Homeowners wanting premium garage aesthetics.",
            "entry_barrier": "low",
        },
        {
            "niche": "Metallic epoxy decorative flooring",
            "opportunity_score": 78,
            "competition_score": 25,
            "growth_rate_pct": 20,
            "target_customer": "Boutique retail and restaurant owners.",
            "entry_barrier": "low",
        },
        {
            "niche": "Food-grade epoxy for commercial kitchens",
            "opportunity_score": 83,
            "competition_score": 30,
            "growth_rate_pct": 12,
            "target_customer": "Restaurant chains and food-processing facilities.",
            "entry_barrier": "high",
        },
        {
            "niche": "3D epoxy art flooring",
            "opportunity_score": 68,
            "competition_score": 20,
            "growth_rate_pct": 30,
            "target_customer": "High-end residential and luxury commercial clients.",
            "entry_barrier": "medium",
        },
    ],
    "construction": [
        {
            "niche": "Modular & prefab residential construction",
            "opportunity_score": 87,
            "competition_score": 40,
            "growth_rate_pct": 16,
            "target_customer": "Cost-sensitive first-time homebuyers and developers.",
            "entry_barrier": "high",
        },
        {
            "niche": "Green / LEED-certified commercial construction",
            "opportunity_score": 81,
            "competition_score": 45,
            "growth_rate_pct": 11,
            "target_customer": "ESG-focused corporations and institutional developers.",
            "entry_barrier": "high",
        },
        {
            "niche": "Accessory dwelling unit (ADU) construction",
            "opportunity_score": 84,
            "competition_score": 38,
            "growth_rate_pct": 25,
            "target_customer": "Homeowners in high-density metros seeking rental income.",
            "entry_barrier": "low",
        },
        {
            "niche": "Data centre construction & fit-out",
            "opportunity_score": 90,
            "competition_score": 50,
            "growth_rate_pct": 20,
            "target_customer": "Cloud providers and colocation operators.",
            "entry_barrier": "very high",
        },
        {
            "niche": "Disaster-resilient residential retrofitting",
            "opportunity_score": 76,
            "competition_score": 22,
            "growth_rate_pct": 14,
            "target_customer": "Homeowners in hurricane/wildfire-prone regions.",
            "entry_barrier": "medium",
        },
    ],
}

_DEFAULT_NICHES: list[dict] = [
    {
        "niche": f"Premium services",
        "opportunity_score": 70,
        "competition_score": 40,
        "growth_rate_pct": 8,
        "target_customer": "High-value B2B and B2C clients.",
        "entry_barrier": "medium",
    },
    {
        "niche": "Digital-first customer acquisition",
        "opportunity_score": 75,
        "competition_score": 50,
        "growth_rate_pct": 12,
        "target_customer": "Tech-savvy SMB buyers.",
        "entry_barrier": "low",
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _opportunity_net_score(niche: dict) -> float:
    """Compute opportunity net score: opportunity_score − (competition_score × 0.4)."""
    return niche["opportunity_score"] - niche["competition_score"] * 0.4


# ---------------------------------------------------------------------------
# Main class
# ---------------------------------------------------------------------------


class NicheOpportunityModel:
    """Identifies and scores niche market opportunities within an industry."""

    def score(self, niche: str, industry: str, region: str) -> dict:
        """Return a comprehensive opportunity score for a specific niche.

        Parameters
        ----------
        niche:
            Niche label to look up or describe.
        industry:
            Parent industry name.
        region:
            Target geographic region (used for context in the output).

        Returns
        -------
        dict with opportunity_score, competition_score, net_score, growth_rate_pct,
        target_customer, entry_barrier, recommendation, region.
        """
        key = industry.lower().replace(" ", "_")
        niches = _INDUSTRY_NICHES.get(key, _DEFAULT_NICHES)

        # Fuzzy match on niche name
        matched = next(
            (n for n in niches if niche.lower() in n["niche"].lower()),
            None,
        )

        if matched is None:
            # Build a generic score for an unknown niche
            matched = {
                "niche": niche,
                "opportunity_score": 60,
                "competition_score": 45,
                "growth_rate_pct": 7,
                "target_customer": f"Industry practitioners in the {industry} sector.",
                "entry_barrier": "medium",
            }

        net = round(_opportunity_net_score(matched), 1)
        rec = "pursue" if net >= 50 else ("monitor" if net >= 35 else "deprioritise")

        return {
            **matched,
            "industry": industry,
            "region": region,
            "net_score": net,
            "recommendation": rec,
        }

    def top_niches(self, industry: str, count: int = 10) -> List[dict]:
        """Return the top *count* niches for an industry ranked by net opportunity score.

        Parameters
        ----------
        industry:
            Industry name.
        count:
            Number of niches to return.

        Returns
        -------
        List of niche dicts sorted by net_score descending.
        """
        key = industry.lower().replace(" ", "_")
        niches = _INDUSTRY_NICHES.get(key, _DEFAULT_NICHES)
        enriched = []
        for n in niches:
            enriched.append({
                **n,
                "industry": industry,
                "net_score": round(_opportunity_net_score(n), 1),
            })
        return sorted(enriched, key=lambda x: x["net_score"], reverse=True)[:count]

    def generate_report(self, industry: str) -> str:
        """Return a Markdown report of niche opportunities for an industry.

        Parameters
        ----------
        industry:
            Industry name.

        Returns
        -------
        Formatted Markdown string.
        """
        niches = self.top_niches(industry)
        lines = [
            f"# Niche Opportunity Report — {industry.title()}\n",
            f"**Total niches analysed:** {len(niches)}\n",
            "---\n",
        ]
        for i, n in enumerate(niches, start=1):
            lines.append(f"## {i}. {n['niche']}")
            lines.append(f"- **Opportunity Score:** {n['opportunity_score']}/100")
            lines.append(f"- **Competition Score:** {n['competition_score']}/100")
            lines.append(f"- **Net Score:** {n['net_score']}")
            lines.append(f"- **Growth Rate:** {n['growth_rate_pct']} % p.a.")
            lines.append(f"- **Target Customer:** {n['target_customer']}")
            lines.append(f"- **Entry Barrier:** {n['entry_barrier'].title()}")
            lines.append("")
        return "\n".join(lines)
