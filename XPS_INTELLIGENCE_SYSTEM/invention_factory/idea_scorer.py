"""
invention_factory/idea_scorer.py
===================================
Idea Scorer — evaluates and scores generated ideas.
"""
from __future__ import annotations

from typing import List


# ---------------------------------------------------------------------------
# Scoring weights
# ---------------------------------------------------------------------------

_WEIGHTS = {
    "market_potential": 0.35,
    "technical_feasibility": 0.25,
    "financial_viability": 0.25,
    "competitive_advantage": 0.15,
}


# ---------------------------------------------------------------------------
# Heuristic scoring functions
# ---------------------------------------------------------------------------


def _score_market_potential(idea: dict) -> int:
    """Derive market potential from innovation_score and revenue model clues."""
    base = idea.get("innovation_score", 70)
    revenue_model = (idea.get("revenue_model") or "").lower()
    bonus = 0
    if "subscription" in revenue_model or "saas" in revenue_model:
        bonus += 8
    if "commission" in revenue_model:
        bonus += 4
    if "franchise" in revenue_model:
        bonus += 6
    return min(int(base) + bonus, 100)


def _score_technical_feasibility(idea: dict) -> int:
    """Derive technical feasibility from the idea's feasibility_score."""
    base = idea.get("feasibility_score", 70)
    description = (idea.get("description") or "").lower()
    penalty = 0
    hard_words = ["iot", "ai", "machine learning", "augmented reality", "blockchain"]
    for w in hard_words:
        if w in description:
            penalty += 4
    return max(int(base) - penalty, 30)


def _score_financial_viability(idea: dict) -> int:
    """Estimate financial viability from revenue model characteristics."""
    revenue_model = (idea.get("revenue_model") or "").lower()
    score = 60  # baseline
    if "subscription" in revenue_model or "saas" in revenue_model:
        score += 15
    if "commission" in revenue_model:
        score += 8
    if "franchise" in revenue_model:
        score += 12
    if "hardware" in revenue_model:
        score -= 8
    feasibility = idea.get("feasibility_score", 70)
    score = int(score * (feasibility / 100) ** 0.3)
    return max(min(score, 100), 20)


def _score_competitive_advantage(idea: dict) -> int:
    """Estimate competitive advantage from innovation_score and description."""
    base = idea.get("innovation_score", 70)
    description = (idea.get("description") or "").lower()
    bonus = 0
    advantage_words = ["unique", "patent", "first", "exclusive", "proprietary", "network effect"]
    for w in advantage_words:
        if w in description:
            bonus += 5
    return min(int(base) + bonus, 100)


# ---------------------------------------------------------------------------
# Main class
# ---------------------------------------------------------------------------


class IdeaScorer:
    """Evaluates and scores business ideas across four dimensions."""

    def score(self, idea: dict) -> dict:
        """Add scoring dimensions to an idea dict.

        Parameters
        ----------
        idea:
            Idea dict as returned by :class:`~invention_factory.idea_generator.IdeaGenerator`.

        Returns
        -------
        The same dict augmented with: market_potential, technical_feasibility,
        financial_viability, competitive_advantage, overall_score.
        """
        market = _score_market_potential(idea)
        technical = _score_technical_feasibility(idea)
        financial = _score_financial_viability(idea)
        competitive = _score_competitive_advantage(idea)

        overall = int(
            market * _WEIGHTS["market_potential"]
            + technical * _WEIGHTS["technical_feasibility"]
            + financial * _WEIGHTS["financial_viability"]
            + competitive * _WEIGHTS["competitive_advantage"]
        )

        return {
            **idea,
            "market_potential": market,
            "technical_feasibility": technical,
            "financial_viability": financial,
            "competitive_advantage": competitive,
            "overall_score": overall,
        }

    def rank(self, ideas: List[dict]) -> List[dict]:
        """Score and rank ideas by overall_score descending.

        Parameters
        ----------
        ideas:
            List of idea dicts.

        Returns
        -------
        List of scored idea dicts sorted by overall_score descending.
        """
        scored = [self.score(idea) if "overall_score" not in idea else idea for idea in ideas]
        return sorted(scored, key=lambda x: x.get("overall_score", 0), reverse=True)
