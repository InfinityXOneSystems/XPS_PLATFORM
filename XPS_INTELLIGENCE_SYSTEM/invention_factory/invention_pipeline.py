"""
invention_factory/invention_pipeline.py
=========================================
Invention Pipeline — orchestrates idea generation → scoring → documentation.

Produces INVENTION_REPORT.md
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import List

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _try_store_in_library(ideas: list[dict], industry: str) -> bool:
    """Attempt to persist top ideas to the infinity library; returns True on success."""
    try:
        import sys
        from pathlib import Path

        repo_root = Path(__file__).resolve().parents[1]
        if str(repo_root) not in sys.path:
            sys.path.insert(0, str(repo_root))

        from infinity_library.library import InfinityLibrary

        lib = InfinityLibrary()
        for idea in ideas:
            lib.store(
                content=idea.get("description", ""),
                metadata={
                    "type": "invention_idea",
                    "title": idea.get("title", ""),
                    "industry": industry,
                    "overall_score": idea.get("overall_score", 0),
                },
            )
        return True
    except Exception as exc:
        logger.debug("infinity_library_store_skipped: %s", exc)
        return False


def _format_idea_section(rank: int, idea: dict) -> str:
    return (
        f"### {rank}. {idea.get('title', 'Untitled')}\n\n"
        f"**Description:** {idea.get('description', '')}\n\n"
        f"**Target Market:** {idea.get('target_market', 'N/A')}\n\n"
        f"**Revenue Model:** {idea.get('revenue_model', 'N/A')}\n\n"
        f"| Dimension | Score |\n"
        f"|-----------|-------|\n"
        f"| Market Potential | {idea.get('market_potential', 'N/A')}/100 |\n"
        f"| Technical Feasibility | {idea.get('technical_feasibility', 'N/A')}/100 |\n"
        f"| Financial Viability | {idea.get('financial_viability', 'N/A')}/100 |\n"
        f"| Competitive Advantage | {idea.get('competitive_advantage', 'N/A')}/100 |\n"
        f"| **Overall Score** | **{idea.get('overall_score', 'N/A')}/100** |\n"
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def run_invention_pipeline(industry: str, count: int = 5) -> dict:
    """Run the full invention pipeline: generate → score → store → report.

    Parameters
    ----------
    industry:
        Target industry name (e.g. 'flooring', 'epoxy', 'construction').
    count:
        Number of ideas to generate.

    Returns
    -------
    dict with: industry, generated_at, ideas (scored & ranked), top_idea,
    library_stored, markdown_report.
    """
    from invention_factory.idea_generator import IdeaGenerator
    from invention_factory.idea_scorer import IdeaScorer

    generator = IdeaGenerator()
    scorer = IdeaScorer()

    raw_ideas = generator.generate_batch(count=count, industry=industry)
    ranked_ideas = scorer.rank(raw_ideas)

    top_ideas = ranked_ideas[:min(count, len(ranked_ideas))]
    top_idea = top_ideas[0] if top_ideas else {}

    library_stored = _try_store_in_library(top_ideas, industry)

    report_md = generate_invention_report(industry, ideas=top_ideas)

    return {
        "industry": industry,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "count_requested": count,
        "count_generated": len(top_ideas),
        "ideas": top_ideas,
        "top_idea": top_idea,
        "library_stored": library_stored,
        "markdown_report": report_md,
    }


def generate_invention_report(industry: str, ideas: list | None = None) -> str:
    """Return a formatted INVENTION_REPORT.md string.

    Parameters
    ----------
    industry:
        Target industry name.
    ideas:
        Pre-scored idea list; if None, 5 ideas are generated fresh.

    Returns
    -------
    Markdown string suitable for writing to INVENTION_REPORT.md.
    """
    if ideas is None:
        from invention_factory.idea_generator import IdeaGenerator
        from invention_factory.idea_scorer import IdeaScorer

        generator = IdeaGenerator()
        scorer = IdeaScorer()
        ideas = scorer.rank(generator.generate_batch(count=5, industry=industry))

    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    avg_score = round(sum(i.get("overall_score", 0) for i in ideas) / max(len(ideas), 1), 1)
    top_score = max((i.get("overall_score", 0) for i in ideas), default=0)

    lines: List[str] = [
        f"# Invention Report — {industry.title()}",
        f"\n> Generated: {now}",
        "\n---\n",
        "## Executive Summary\n",
        f"This report presents **{len(ideas)} business ideas** identified for the "
        f"**{industry}** industry through automated market signal analysis.",
        f"\n- **Average Idea Score:** {avg_score}/100",
        f"- **Top Idea Score:** {top_score}/100",
        "\n---\n",
        "## Market Analysis\n",
    ]

    # Market analysis block
    try:
        from predictions.industry_growth_model import IndustryGrowthModel
        model = IndustryGrowthModel()
        growth = model.model(industry)
        lines += [
            f"- **Historical CAGR:** {growth['historical_cagr_pct']} %",
            f"- **Current Market Size:** ${growth['current_market_size_bn']}B",
            f"- **5-Year Projected Size:** ${growth['projected_market_size_bn']}B",
            f"- **Growth Potential Score:** {growth['growth_potential_score']}/100",
            "\n**Growth Drivers:**",
        ]
        for driver in growth["growth_drivers"]:
            lines.append(f"- {driver}")
        lines.append("")
    except Exception:
        lines.append("_(Market analysis data unavailable.)_\n")

    lines += ["\n---\n", "## Top Business Ideas\n"]
    for rank, idea in enumerate(ideas, start=1):
        lines.append(_format_idea_section(rank, idea))

    lines += [
        "\n---\n",
        "## Financial Projections\n",
        "_Based on average SaaS / service business benchmarks for the sector._\n",
        "| Metric | Conservative | Base | Optimistic |",
        "|--------|-------------|------|------------|",
        "| Year 1 Revenue | $80K | $150K | $350K |",
        "| Year 2 Revenue | $200K | $450K | $1.2M |",
        "| Year 3 Revenue | $500K | $1.1M | $3.5M |",
        "| Gross Margin | 55% | 65% | 75% |",
        "| Payback Period | 18 months | 12 months | 8 months |",
        "\n---\n",
        "## Build Plan\n",
        "1. **Weeks 1–2:** Validate top idea with 10 customer discovery interviews.",
        "2. **Weeks 3–6:** Build a functional MVP or service prototype.",
        "3. **Weeks 7–10:** Soft-launch with 3–5 pilot customers.",
        "4. **Weeks 11–16:** Iterate based on feedback; establish pricing.",
        "5. **Weeks 17–24:** Scale go-to-market and hire first sales/ops hire.",
        "\n---\n",
        f"_Report generated by XPS Intelligence Invention Factory — {now}_",
    ]

    return "\n".join(lines)
