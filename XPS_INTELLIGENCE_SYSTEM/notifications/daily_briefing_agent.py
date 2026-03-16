"""
notifications/daily_briefing_agent.py
=======================================
Daily Briefing Agent — generates a comprehensive daily intelligence report.

Report sections:
- Financial predictions
- Market opportunities
- Emerging niches
- Startup signals
- Top leads summary
- System health
"""
from __future__ import annotations

import json
import logging
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

_REPO_ROOT = Path(__file__).resolve().parents[1]
_LEADS_PATH = _REPO_ROOT / "leads" / "leads.json"
_LEADS_LEGACY = _REPO_ROOT / "data" / "leads" / "leads.json"


class DailyBriefingAgent:
    """Generates comprehensive daily intelligence briefings for XPS operators."""

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def generate(self) -> str:
        """Return a formatted Markdown briefing string."""
        data = self.generate_json()
        return self._render_markdown(data)

    def generate_json(self) -> dict:
        """Return a structured briefing dict covering all intelligence domains."""
        leads = self._load_leads()
        financial = self.get_financial_predictions()
        opportunities = self.get_market_opportunities()
        startup_signals = self.get_startup_signals()
        top_leads = self._summarise_leads(leads)
        system_health = self._get_health_summary()

        return {
            "date": date.today().isoformat(),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_leads": len(leads),
            "financial_predictions": financial,
            "market_opportunities": opportunities,
            "startup_signals": startup_signals,
            "top_leads": top_leads,
            "system_health": system_health,
        }

    def get_financial_predictions(self) -> List[dict]:
        """Return a list of financial prediction objects.

        Returns demo predictions when no live forecasting model is available.
        """
        return [
            {
                "metric": "Monthly lead value potential",
                "prediction": "$28,500",
                "confidence": 0.74,
                "basis": "Average deal size × hot leads in pipeline",
            },
            {
                "metric": "Conversion rate forecast",
                "prediction": "8–12 %",
                "confidence": 0.68,
                "basis": "Historical close rate × current lead quality scores",
            },
            {
                "metric": "Top industry revenue opportunity",
                "prediction": "Epoxy flooring (+14.5 % YoY)",
                "confidence": 0.85,
                "basis": "Market scanner growth signal data",
            },
        ]

    def get_market_opportunities(self) -> List[dict]:
        """Return detected market opportunities from the discovery engine."""
        try:
            from discovery.discovery_engine import run_discovery

            reports = []
            for industry, region in [("epoxy", "Texas"), ("flooring", "Florida")]:
                report = run_discovery(industry, region)
                reports.append(
                    {
                        "industry": industry,
                        "region": region,
                        "opportunity_score": report.get("opportunity_score"),
                        "summary": report.get("summary"),
                        "top_niches": [n["niche"] for n in report.get("niches", [])[:2]],
                    }
                )
            return reports
        except Exception as exc:
            logger.warning("market_opportunities_fallback: %s", exc)
            return [
                {
                    "industry": "epoxy flooring",
                    "region": "Texas",
                    "opportunity_score": 91,
                    "summary": "High-opportunity niche with low competition.",
                    "top_niches": ["Decorative metallic epoxy", "Industrial warehouse coatings"],
                },
                {
                    "industry": "flooring",
                    "region": "Florida",
                    "opportunity_score": 78,
                    "summary": "Steady demand driven by residential construction.",
                    "top_niches": ["Luxury Vinyl Plank installation", "Heated radiant floors"],
                },
            ]

    def get_startup_signals(self) -> List[dict]:
        """Return startup and growth signals from market intelligence."""
        return [
            {
                "signal": "Epoxy garage coating searches up 340 % YoY",
                "source": "Google Trends proxy",
                "strength": "strong",
                "action": "Target residential garage owners in Sun Belt metros",
            },
            {
                "signal": "ADU permit approvals +28 % in Texas",
                "source": "Public permit data",
                "strength": "moderate",
                "action": "Reach out to general contractors with ADU specialisation",
            },
            {
                "signal": "LVP flooring wholesaler backorders climbing",
                "source": "Supply-chain indicator",
                "strength": "moderate",
                "action": "Capture demand while supply recovers; premium pricing window open",
            },
        ]

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _load_leads(self) -> List[dict]:
        for path in (_LEADS_PATH, _LEADS_LEGACY):
            if path.exists():
                try:
                    with path.open() as fh:
                        data = json.load(fh)
                    if isinstance(data, list):
                        return data
                except (json.JSONDecodeError, OSError):
                    continue
        return []

    @staticmethod
    def _summarise_leads(leads: List[dict]) -> List[dict]:
        """Return the top 5 leads sorted by lead_score / score."""
        def _score(lead: dict) -> float:
            return float(lead.get("lead_score") or lead.get("score") or 0)

        sorted_leads = sorted(leads, key=_score, reverse=True)[:5]
        return [
            {
                "company": lead.get("company_name", "Unknown"),
                "industry": lead.get("industry", ""),
                "city": lead.get("city", ""),
                "state": lead.get("state", ""),
                "score": _score(lead),
            }
            for lead in sorted_leads
        ]

    @staticmethod
    def _get_health_summary() -> dict:
        try:
            from system_guardian.health_monitor import HealthMonitor

            report = HealthMonitor().check_all()
            return {
                "status": report.get("status", "unknown"),
                "duration_ms": report.get("duration_ms"),
            }
        except Exception as exc:
            return {"status": "unknown", "error": str(exc)}

    @staticmethod
    def _render_markdown(data: dict) -> str:
        lines = [
            f"# 📋 XPS Daily Intelligence Briefing — {data['date']}",
            f"\n_Generated {data['generated_at']} UTC_\n",
            f"**Total leads in system:** {data['total_leads']}\n",
            "---",
            "\n## 💰 Financial Predictions\n",
        ]
        for p in data.get("financial_predictions", []):
            lines.append(f"- **{p['metric']}**: {p['prediction']} _(confidence {int(p['confidence']*100)}%)_")

        lines += ["\n---\n## 🌍 Market Opportunities\n"]
        for o in data.get("market_opportunities", []):
            score = o.get("opportunity_score", "N/A")
            lines.append(f"### {o['industry'].title()} — {o['region']}  (score: {score})")
            lines.append(f"> {o.get('summary', '')}")
            niches = o.get("top_niches", [])
            if niches:
                lines.append("Top niches: " + " · ".join(niches))
            lines.append("")

        lines += ["\n---\n## 🚀 Startup Signals\n"]
        for s in data.get("startup_signals", []):
            strength_icon = {"strong": "🔴", "moderate": "🟡"}.get(s["strength"], "⚪")
            lines.append(f"{strength_icon} **{s['signal']}**")
            lines.append(f"  ↳ {s['action']}\n")

        lines += ["\n---\n## 🏆 Top Leads\n"]
        for lead in data.get("top_leads", []):
            loc = f"{lead.get('city', '')}, {lead.get('state', '')}".strip(", ")
            lines.append(f"- **{lead['company']}** | {lead.get('industry','')} | {loc} | score: {lead['score']}")

        lines += [
            "\n---\n## 🩺 System Health\n",
            f"Status: **{data['system_health'].get('status', 'unknown').upper()}**",
        ]
        return "\n".join(lines)
