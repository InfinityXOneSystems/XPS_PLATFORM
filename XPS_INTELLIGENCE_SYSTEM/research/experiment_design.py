"""
research/experiment_design.py
===============================
Experiment Design Engine — generates experiment plans for hypotheses.

Produces EXPERIMENT_PLAN.md-compatible output.
"""
from __future__ import annotations

import re
from typing import List


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_EXPERIMENT_TYPES = ("a/b_test", "survey", "prototype", "analysis", "simulation")

_TYPE_HINTS: dict[str, list[str]] = {
    "a/b_test": ["compare", "versus", "vs", "split", "variant", "conversion"],
    "survey": ["customer", "opinion", "preference", "willingness", "demand", "perception"],
    "prototype": ["build", "technical", "product", "software", "platform", "automation", "system"],
    "analysis": ["financial", "market", "data", "trend", "historical", "model", "roi", "metric"],
    "simulation": ["forecast", "scenario", "simulate", "predict", "projection", "model"],
}

_DEFAULT_METRICS: dict[str, list[str]] = {
    "a/b_test": ["conversion_rate", "click_through_rate", "revenue_per_user"],
    "survey": ["response_rate", "net_promoter_score", "customer_satisfaction_score"],
    "prototype": ["time_to_build", "user_acceptance_rate", "performance_benchmark"],
    "analysis": ["growth_rate", "market_size", "roi", "payback_period"],
    "simulation": ["predicted_growth", "confidence_interval", "scenario_spread"],
}

_DURATIONS: dict[str, str] = {
    "a/b_test": "2 weeks",
    "survey": "1 week",
    "prototype": "4 weeks",
    "analysis": "1 week",
    "simulation": "1 week",
}

_RESOURCES: dict[str, list[str]] = {
    "a/b_test": ["A/B testing tool", "web analytics setup", "traffic source"],
    "survey": ["survey platform (e.g. Typeform)", "participant recruitment", "analysis spreadsheet"],
    "prototype": ["development environment", "designer", "user testers"],
    "analysis": ["market data sources", "spreadsheet or BI tool", "industry reports"],
    "simulation": ["modelling spreadsheet", "historical data", "statistical library"],
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _detect_experiment_type(hypothesis: str) -> str:
    lower = hypothesis.lower()
    scores: dict[str, int] = {t: 0 for t in _EXPERIMENT_TYPES}
    for t, hints in _TYPE_HINTS.items():
        for h in hints:
            if h in lower:
                scores[t] += 1
    best = max(scores, key=lambda k: scores[k])
    return best if scores[best] > 0 else "analysis"


def _build_proposed_experiment(hypothesis: str, exp_type: str) -> str:
    templates = {
        "a/b_test": (
            "Design two variants (A and B) that test the core assumption in the hypothesis. "
            "Run both variants with a matched audience for 2 weeks and measure primary KPIs."
        ),
        "survey": (
            "Recruit 50–100 target respondents and administer a structured survey with "
            "5–10 questions validating the core assumption. Analyse results for statistical significance."
        ),
        "prototype": (
            "Build a minimal viable prototype (MVP) that embodies the core technical claim. "
            "Conduct usability testing with at least 5 target users and collect structured feedback."
        ),
        "analysis": (
            "Gather publicly available data on the market or financial variables cited in the hypothesis. "
            "Perform a quantitative analysis and compare outcomes against the stated prediction."
        ),
        "simulation": (
            "Construct a Monte Carlo or scenario-based model using historical base rates. "
            "Run 1 000 simulations across optimistic, base, and pessimistic scenarios."
        ),
    }
    return templates.get(exp_type, templates["analysis"])


def _build_success_criteria(exp_type: str) -> str:
    criteria = {
        "a/b_test": "Variant B achieves ≥ 10 % lift on the primary metric with p < 0.05.",
        "survey": "≥ 60 % of respondents confirm the stated problem or need.",
        "prototype": "≥ 4 / 5 user-testers rate core functionality as 'acceptable' or above.",
        "analysis": "Data supports the hypothesis at ≥ 70 % confidence.",
        "simulation": "Base-case scenario shows positive outcome; downside risk < 20 %.",
    }
    return criteria.get(exp_type, "Data supports the hypothesis at ≥ 70 % confidence.")


def _build_risk_factors(exp_type: str, hypothesis: str) -> list[str]:
    base_risks = {
        "a/b_test": [
            "Insufficient traffic volume to reach statistical significance.",
            "External market events contaminating the test window.",
        ],
        "survey": [
            "Self-selection bias skewing respondent pool.",
            "Leading question design influencing responses.",
        ],
        "prototype": [
            "Scope creep delaying prototype delivery.",
            "User testers not representative of the actual target market.",
        ],
        "analysis": [
            "Reliance on outdated or incomplete public data.",
            "Survivorship bias in comparable-company benchmarks.",
        ],
        "simulation": [
            "Model assumptions diverge significantly from real-world conditions.",
            "Fat-tail events not captured by historical data.",
        ],
    }
    risks = list(base_risks.get(exp_type, []))
    # Add a context-aware risk based on hypothesis content
    if re.search(r"\b(ai|automation|ml|software)\b", hypothesis, re.I):
        risks.append("Technical complexity may underestimate integration effort.")
    if re.search(r"\b(international|global|overseas)\b", hypothesis, re.I):
        risks.append("Regulatory or cultural differences may invalidate local findings.")
    return risks


# ---------------------------------------------------------------------------
# Main class
# ---------------------------------------------------------------------------


class ExperimentDesigner:
    """Generates structured experiment plans for given hypotheses."""

    def design(self, hypothesis: str, metrics: List[str] | None = None) -> dict:
        """Design an experiment plan for a single hypothesis.

        Parameters
        ----------
        hypothesis:
            The hypothesis statement to be tested.
        metrics:
            Optional list of evaluation metrics; defaults are inferred from
            experiment type if not provided.

        Returns
        -------
        dict with keys: hypothesis, experiment_type, proposed_experiment,
        evaluation_metrics, estimated_duration, resources_needed,
        success_criteria, risk_factors.
        """
        if not hypothesis or not hypothesis.strip():
            return {
                "hypothesis": hypothesis,
                "experiment_type": "analysis",
                "proposed_experiment": "No valid hypothesis provided.",
                "evaluation_metrics": [],
                "estimated_duration": "N/A",
                "resources_needed": [],
                "success_criteria": "N/A",
                "risk_factors": [],
            }

        hypothesis = hypothesis.strip()
        exp_type = _detect_experiment_type(hypothesis)

        return {
            "hypothesis": hypothesis,
            "experiment_type": exp_type,
            "proposed_experiment": _build_proposed_experiment(hypothesis, exp_type),
            "evaluation_metrics": metrics if metrics else _DEFAULT_METRICS.get(exp_type, []),
            "estimated_duration": _DURATIONS.get(exp_type, "2 weeks"),
            "resources_needed": _RESOURCES.get(exp_type, []),
            "success_criteria": _build_success_criteria(exp_type),
            "risk_factors": _build_risk_factors(exp_type, hypothesis),
        }

    def to_markdown(self, plan: dict) -> str:
        """Render an experiment plan as an EXPERIMENT_PLAN.md-compatible Markdown string.

        Parameters
        ----------
        plan:
            Experiment plan dict as returned by :meth:`design`.

        Returns
        -------
        Formatted Markdown string.
        """
        metrics_md = "\n".join(f"- {m}" for m in plan.get("evaluation_metrics", []))
        resources_md = "\n".join(f"- {r}" for r in plan.get("resources_needed", []))
        risks_md = "\n".join(f"- {r}" for r in plan.get("risk_factors", []))

        return f"""# Experiment Plan

## Hypothesis
{plan.get('hypothesis', 'N/A')}

## Experiment Type
`{plan.get('experiment_type', 'analysis')}`

## Proposed Experiment
{plan.get('proposed_experiment', '')}

## Evaluation Metrics
{metrics_md or '- (none specified)'}

## Estimated Duration
{plan.get('estimated_duration', 'N/A')}

## Resources Needed
{resources_md or '- (none specified)'}

## Success Criteria
{plan.get('success_criteria', 'N/A')}

## Risk Factors
{risks_md or '- (none identified)'}
"""

    def design_batch(self, hypotheses: list) -> List[dict]:
        """Design experiment plans for a list of hypothesis strings or dicts.

        Parameters
        ----------
        hypotheses:
            List of hypothesis strings, or dicts with a ``hypothesis`` key.

        Returns
        -------
        List of experiment plan dicts.
        """
        plans = []
        for item in hypotheses:
            if isinstance(item, dict):
                hyp_text = item.get("hypothesis", "")
            else:
                hyp_text = str(item)
            plans.append(self.design(hyp_text))
        return plans
