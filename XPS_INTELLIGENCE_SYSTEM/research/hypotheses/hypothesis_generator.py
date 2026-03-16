"""
research/hypotheses/hypothesis_generator.py
=============================================
Hypothesis Generator — converts market observations into testable hypotheses.

Example output:
    "AI marketing automation for small construction companies could scale rapidly."
"""
from __future__ import annotations

import hashlib
import re
from typing import List


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_CATEGORIES = ("market", "technical", "financial", "operational")
_TESTABILITY_SCORES = {"high": 1.0, "medium": 0.6, "low": 0.3}

_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "market": ["demand", "customer", "competitor", "market", "growth", "adoption", "trend", "niche"],
    "technical": ["technology", "automation", "software", "ai", "platform", "integration", "system"],
    "financial": ["revenue", "profit", "cost", "pricing", "investment", "roi", "margin", "funding"],
    "operational": ["process", "workflow", "team", "scale", "efficiency", "operation", "supply"],
}

_EXPERIMENT_TEMPLATES: dict[str, list[str]] = {
    "market": [
        "Run a targeted survey on {topic} with 50+ industry respondents.",
        "Analyse 3-month search-volume trends for {topic} keywords.",
        "Interview 10 potential customers about their pain points with {topic}.",
    ],
    "technical": [
        "Build a minimal prototype addressing {topic} and measure build time.",
        "Benchmark existing tools against the proposed {topic} solution.",
        "Conduct a spike for 1 week to validate technical feasibility of {topic}.",
    ],
    "financial": [
        "Model a 12-month P&L projection assuming 3 growth scenarios for {topic}.",
        "Identify comparable businesses in {topic} and analyse their unit economics.",
        "Run a willingness-to-pay survey to validate pricing assumptions for {topic}.",
    ],
    "operational": [
        "Pilot the {topic} workflow with an internal team for 2 weeks.",
        "Map the current process and identify the top 3 bottlenecks in {topic}.",
        "Shadow a practitioner for a day to document the real workflow around {topic}.",
    ],
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _classify_category(observation: str) -> str:
    """Classify observation into one of the four hypothesis categories."""
    lower = observation.lower()
    scores: dict[str, int] = {cat: 0 for cat in _CATEGORIES}
    for cat, keywords in _CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in lower:
                scores[cat] += 1
    best = max(scores, key=lambda c: scores[c])
    return best if scores[best] > 0 else "market"


def _estimate_confidence(observation: str) -> float:
    """Estimate confidence based on specificity and length of observation."""
    words = len(observation.split())
    # Reward specificity: numbers, percentages, proper nouns
    specificity_bonus = len(re.findall(r"\d+%?|\$[\d,]+|[A-Z][a-zA-Z]{3,}", observation)) * 0.05
    base = min(0.45 + (words / 200), 0.70)
    return min(round(base + specificity_bonus, 2), 0.95)


def _estimate_testability(observation: str, category: str) -> str:
    """Assign testability tier based on category and observation clues."""
    lower = observation.lower()
    measurable_hints = ["metric", "measure", "track", "survey", "data", "rate", "score", "percentage"]
    if any(h in lower for h in measurable_hints) or category in ("market", "financial"):
        return "high"
    if category == "technical":
        return "medium"
    return "low"


def _extract_topic(observation: str) -> str:
    """Pull a short topic label from the observation (first 5 significant words)."""
    words = [w for w in observation.split() if len(w) > 3][:5]
    return " ".join(words) if words else observation[:40]


def _build_hypothesis_statement(observation: str, category: str) -> str:
    """Construct a testable hypothesis statement from the observation."""
    topic = _extract_topic(observation)
    prefixes = {
        "market": "There is a significant unmet market demand for",
        "technical": "A technical solution involving",
        "financial": "Investing in",
        "operational": "Optimising the operational workflow around",
    }
    suffixes = {
        "market": "that could generate measurable revenue within 6 months.",
        "technical": "could reduce delivery time or cost by at least 20%.",
        "financial": "would produce a positive ROI within 12 months.",
        "operational": "could improve team throughput by at least 15%.",
    }
    return f"{prefixes[category]} {topic} {suffixes[category]}"


def _make_experiments(category: str, topic: str) -> list[str]:
    templates = _EXPERIMENT_TEMPLATES.get(category, _EXPERIMENT_TEMPLATES["market"])
    return [t.format(topic=topic) for t in templates]


def _stable_id(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()[:8]  # noqa: S324 — non-security use


# ---------------------------------------------------------------------------
# Main class
# ---------------------------------------------------------------------------


class HypothesisGenerator:
    """Converts market observations into structured, testable hypotheses."""

    def generate_from_observation(self, observation: str) -> dict:
        """Return a hypothesis dict derived from a single market observation.

        Parameters
        ----------
        observation:
            Free-text description of a market signal or observation.

        Returns
        -------
        dict with keys: id, hypothesis, confidence, category, testability,
        suggested_experiments.
        """
        if not observation or not observation.strip():
            return {
                "id": "00000000",
                "hypothesis": "Insufficient observation provided.",
                "confidence": 0.0,
                "category": "market",
                "testability": "low",
                "suggested_experiments": [],
            }

        observation = observation.strip()
        category = _classify_category(observation)
        confidence = _estimate_confidence(observation)
        testability = _estimate_testability(observation, category)
        topic = _extract_topic(observation)
        hypothesis = _build_hypothesis_statement(observation, category)
        experiments = _make_experiments(category, topic)

        return {
            "id": _stable_id(hypothesis),
            "hypothesis": hypothesis,
            "confidence": confidence,
            "category": category,
            "testability": testability,
            "suggested_experiments": experiments,
            "source_observation": observation,
        }

    def generate_batch(self, observations: List[str]) -> List[dict]:
        """Generate hypotheses for a list of observations.

        Parameters
        ----------
        observations:
            List of free-text market observation strings.

        Returns
        -------
        List of hypothesis dicts in the same order as the input.
        """
        return [self.generate_from_observation(obs) for obs in observations]

    def prioritize(self, hypotheses: List[dict]) -> List[dict]:
        """Sort hypotheses by (confidence × testability_score) descending.

        Parameters
        ----------
        hypotheses:
            List of hypothesis dicts as returned by generate_from_observation.

        Returns
        -------
        The same list, sorted highest-priority first.
        """
        def _score(h: dict) -> float:
            t_score = _TESTABILITY_SCORES.get(h.get("testability", "low"), 0.3)
            return h.get("confidence", 0.0) * t_score

        return sorted(hypotheses, key=_score, reverse=True)
