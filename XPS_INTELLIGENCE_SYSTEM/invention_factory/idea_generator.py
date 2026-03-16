"""
invention_factory/idea_generator.py
=====================================
Idea Generator — generates business and product ideas from market signals.
"""
from __future__ import annotations

import hashlib
import random
from typing import List


# ---------------------------------------------------------------------------
# Idea templates by industry
# ---------------------------------------------------------------------------

_IDEA_TEMPLATES: dict[str, list[dict]] = {
    "flooring": [
        {
            "title": "AI-Powered Floor Design Visualiser",
            "description": (
                "A mobile app that uses augmented reality to overlay different flooring "
                "options on a live camera feed of any room, enabling customers to visualise "
                "and select their preferred flooring before purchase."
            ),
            "target_market": "Homeowners and residential interior designers.",
            "revenue_model": "SaaS subscription for contractors + affiliate commissions on material sales.",
        },
        {
            "title": "On-Demand Flooring Installation Marketplace",
            "description": (
                "An Uber-style marketplace connecting homeowners with vetted flooring installers "
                "for same-day or next-day appointments, with upfront pricing and GPS tracking."
            ),
            "target_market": "Urban homeowners requiring fast, reliable installation.",
            "revenue_model": "Commission per completed job (15–20 %).",
        },
        {
            "title": "Flooring-as-a-Service for Landlords",
            "description": (
                "A subscription model where property owners pay a monthly fee for perpetual "
                "flooring coverage including installation, maintenance, and replacement, "
                "eliminating capital expenditure."
            ),
            "target_market": "Residential landlords and property management companies.",
            "revenue_model": "Monthly subscription per unit under management.",
        },
        {
            "title": "Commercial Flooring Analytics Platform",
            "description": (
                "IoT sensors embedded in commercial floors to track foot-traffic patterns, "
                "wear indicators, and maintenance triggers, delivered via a SaaS dashboard."
            ),
            "target_market": "Retail chains, airports, and large commercial facilities.",
            "revenue_model": "Hardware + SaaS subscription.",
        },
        {
            "title": "Flooring Waste Recycling Network",
            "description": (
                "A logistics platform that collects and redistributes off-cut and "
                "end-of-life flooring materials to charity housing projects and resellers, "
                "providing ESG credentials to contractors."
            ),
            "target_market": "Flooring contractors and sustainability-focused enterprises.",
            "revenue_model": "Membership fee + materials brokerage commission.",
        },
    ],
    "epoxy": [
        {
            "title": "DIY Epoxy Kit Subscription Box",
            "description": (
                "A monthly subscription delivering curated epoxy coating kits with tools, "
                "pigments, and instructional content for home hobbyists."
            ),
            "target_market": "DIY enthusiasts and homeowners aged 25–45.",
            "revenue_model": "Monthly subscription ($49–$129/mo).",
        },
        {
            "title": "Epoxy Floor Coating Franchise System",
            "description": (
                "A turnkey franchise model for epoxy floor coating businesses, providing "
                "brand, equipment, training, and lead generation in an exclusive territory."
            ),
            "target_market": "Aspiring entrepreneurs with trade or construction background.",
            "revenue_model": "Franchise fee + royalty on revenue.",
        },
        {
            "title": "Industrial Epoxy Maintenance Contracts",
            "description": (
                "Annual maintenance contracts for warehouse and factory epoxy floors, "
                "covering inspection, crack repair, and recoating, sold to facility managers."
            ),
            "target_market": "Manufacturing and logistics facility managers.",
            "revenue_model": "Annual contract ($2 000–$15 000 per facility).",
        },
    ],
    "construction": [
        {
            "title": "ADU Construction Concierge Service",
            "description": (
                "An end-to-end service that handles permitting, design, construction, and "
                "rental placement of accessory dwelling units for homeowners."
            ),
            "target_market": "Homeowners in high-cost metro areas seeking passive income.",
            "revenue_model": "Fixed project fee + ongoing property management commission.",
        },
        {
            "title": "Modular Office Pod Manufacturer",
            "description": (
                "Pre-engineered, rapidly deployable office pods for residential backyards "
                "and commercial campuses, delivered and installed within 5 days."
            ),
            "target_market": "Remote workers and corporate campuses.",
            "revenue_model": "Direct sale + financing programme.",
        },
        {
            "title": "Green Construction Compliance SaaS",
            "description": (
                "A platform that automates LEED/BREEAM compliance documentation for "
                "general contractors, reducing certification labour by 60 %."
            ),
            "target_market": "Mid-market general contractors pursuing green certifications.",
            "revenue_model": "Annual SaaS licence per project.",
        },
    ],
}

_DEFAULT_TEMPLATES: list[dict] = [
    {
        "title": "AI-Driven Market Intelligence Platform",
        "description": (
            "A SaaS platform delivering real-time competitive intelligence and lead "
            "scoring for B2B sales teams in the target industry."
        ),
        "target_market": "Sales and marketing teams at SMB companies.",
        "revenue_model": "Monthly SaaS subscription ($99–$499/mo).",
    },
    {
        "title": "On-Demand Expert Marketplace",
        "description": (
            "A marketplace connecting businesses with vetted domain experts for "
            "short-term project engagements in the target industry."
        ),
        "target_market": "SMBs needing specialist expertise without full-time hires.",
        "revenue_model": "Platform commission (20 %) on expert bookings.",
    },
]

_FEASIBILITY_SCORES = [65, 70, 75, 78, 80, 82, 85, 88]
_INNOVATION_SCORES = [60, 68, 72, 76, 80, 84, 88, 91]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _seed_from_text(text: str) -> int:
    return int(hashlib.md5(text.encode()).hexdigest(), 16) % (2**31)  # noqa: S324


def _pick(lst: list, seed: int) -> object:
    rng = random.Random(seed)
    return rng.choice(lst)


# ---------------------------------------------------------------------------
# Main class
# ---------------------------------------------------------------------------


class IdeaGenerator:
    """Generates business and product ideas from industry signals."""

    def generate(self, industry: str, signals: List[str]) -> dict:
        """Generate a single business idea for an industry given market signals.

        Parameters
        ----------
        industry:
            Target industry name.
        signals:
            List of market signal strings that inform the idea.

        Returns
        -------
        dict with: id, title, description, target_market, revenue_model,
        feasibility_score, innovation_score, signals_used.
        """
        key = industry.lower().replace(" ", "_")
        templates = _IDEA_TEMPLATES.get(key, _DEFAULT_TEMPLATES)

        signal_text = " ".join(signals)
        seed = _seed_from_text(industry + signal_text)
        rng = random.Random(seed)

        template = rng.choice(templates)
        feasibility = rng.choice(_FEASIBILITY_SCORES)
        innovation = rng.choice(_INNOVATION_SCORES)

        idea_id = hashlib.md5((template["title"] + industry).encode()).hexdigest()[:8]  # noqa: S324

        return {
            "id": idea_id,
            "title": template["title"],
            "description": template["description"],
            "target_market": template["target_market"],
            "revenue_model": template["revenue_model"],
            "feasibility_score": feasibility,
            "innovation_score": innovation,
            "signals_used": list(signals),
            "industry": industry,
        }

    def generate_batch(self, count: int, industry: str) -> List[dict]:
        """Generate *count* distinct ideas for an industry.

        Parameters
        ----------
        count:
            Number of ideas to generate.
        industry:
            Target industry name.

        Returns
        -------
        List of idea dicts (de-duplicated by title).
        """
        key = industry.lower().replace(" ", "_")
        templates = _IDEA_TEMPLATES.get(key, _DEFAULT_TEMPLATES)

        rng = random.Random(_seed_from_text(industry + str(count)))
        selected = (templates * ((count // len(templates)) + 2))[:count]

        seen_titles: set[str] = set()
        ideas = []
        for i, template in enumerate(selected):
            if template["title"] in seen_titles:
                continue
            seen_titles.add(template["title"])
            seed = _seed_from_text(template["title"] + str(i))
            r = random.Random(seed)
            idea_id = hashlib.md5((template["title"] + industry + str(i)).encode()).hexdigest()[:8]  # noqa: S324
            ideas.append({
                "id": idea_id,
                "title": template["title"],
                "description": template["description"],
                "target_market": template["target_market"],
                "revenue_model": template["revenue_model"],
                "feasibility_score": r.choice(_FEASIBILITY_SCORES),
                "innovation_score": r.choice(_INNOVATION_SCORES),
                "signals_used": [],
                "industry": industry,
            })

        return ideas[:count]
