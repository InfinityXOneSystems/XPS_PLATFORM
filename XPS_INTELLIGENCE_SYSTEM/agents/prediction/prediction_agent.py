"""
agents/prediction/prediction_agent.py
======================================
Prediction agent – performs market forecasting, trend analysis,
and predictive lead scoring using historical data and ML models.

The prediction agent provides:
- Revenue forecasting
- Market trend prediction
- Lead conversion probability
- Seasonal demand analysis
- Industry growth predictions
"""

from __future__ import annotations

import asyncio
import json
import logging
import statistics
from datetime import datetime, timedelta
from typing import Any

try:
    from agents.base_agent import BaseAgent
except ImportError:
    import abc

    class BaseAgent(abc.ABC):  # type: ignore[no-redef]
        agent_name: str = "base_agent"
        max_retries: int = 2
        retry_delay: float = 1.0

        def __init__(self) -> None:
            self._run_id = None
            self._queue = None

        @abc.abstractmethod
        async def execute(self, task: dict, context: dict | None = None) -> dict: ...

        def emit_event(self, *_: Any, **__: Any) -> None: ...
        def capabilities(self) -> list[str]: return []
        def health(self) -> dict: return {"agent": self.agent_name, "status": "ok"}

logger = logging.getLogger(__name__)


class PredictionAgent(BaseAgent):
    """
    Prediction Agent — forecasts market conditions and business outcomes.

    Extends :class:`BaseAgent` with an :meth:`execute` interface while keeping
    the original command dispatch logic intact via :meth:`_dispatch`.

    Models:
    - Industry growth trajectories
    - Niche opportunity timing
    - Financial projections (rough estimates)
    - Success probability scoring

    Example::

        agent = PredictionAgent()
        result = await agent.execute({"command": "predict industry growth"})
        result = await agent.execute({"command": "forecast niche"}, {"niche": "epoxy flooring"})
    """

    agent_name = "prediction_agent"

    def __init__(self) -> None:
        super().__init__()
        self.name = "PredictionAgent"

    # ------------------------------------------------------------------
    # BaseAgent interface
    # ------------------------------------------------------------------

    async def execute(
        self,
        task: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Route *task* to the appropriate prediction model."""
        command = task.get("command") or ""
        ctx = context or {}

        self.emit_event("prediction.execute", {"command": command})

        # Merge context values into the command for natural language routing
        niche = ctx.get("niche", "")
        industry = ctx.get("industry", "flooring")
        full_command = f"{command} {niche} {industry}".strip()

        result = await self._dispatch(full_command)
        result.setdefault("success", True)
        return result

    def capabilities(self) -> list[str]:
        return [
            "predict industry growth",
            "forecast niche",
            "success probability",
            "predict revenue",
            "analyze market trends",
            "predict conversion probability",
            "analyze seasonality",
        ]

    # ------------------------------------------------------------------
    # Original dispatch logic (preserved, renamed from ``run``)
    # ------------------------------------------------------------------

    async def _dispatch(self, command: str) -> dict[str, Any]:
        """
        Execute a prediction task based on the command.

        :param command: Natural language command describing the prediction task
        :returns: Dict with prediction results and confidence scores
        """
        logger.info(f"[{self.name}] Running prediction: {command}")

        try:
            command_lower = command.lower()

            if "revenue" in command_lower or "forecast" in command_lower:
                return await self._forecast_revenue(command)
            elif "trend" in command_lower or "market" in command_lower:
                return await self._analyze_trends(command)
            elif "conversion" in command_lower or "probability" in command_lower:
                return await self._predict_conversion(command)
            elif "season" in command_lower or "demand" in command_lower:
                return await self._analyze_seasonality(command)
            elif "growth" in command_lower or "industry" in command_lower:
                return await self._predict_industry_growth(command)
            else:
                return await self._generic_prediction(command)

        except Exception as exc:
            logger.error(f"[{self.name}] Error: {exc}", exc_info=True)
            return {
                "success": False,
                "error": str(exc),
                "agent": self.name
            }

    async def execute_typed(self, task_type: str, params: dict[str, Any]) -> dict[str, Any]:
        """
        Execute a specific prediction task type with parameters.

        :param task_type: Type of prediction (revenue, trends, conversion, etc.)
        :param params: Parameters for the prediction task
        :returns: Dict with prediction results
        """
        if task_type == "revenue":
            return await self._forecast_revenue_with_params(params)
        elif task_type == "trends":
            return await self._analyze_trends_with_params(params)
        elif task_type == "conversion":
            return await self._predict_conversion_with_params(params)
        elif task_type == "seasonality":
            return await self._analyze_seasonality_with_params(params)
        elif task_type == "growth":
            return await self._predict_industry_growth_with_params(params)
        else:
            return {
                "success": False,
                "error": f"Unknown task type: {task_type}",
                "agent": self.name
            }

    # -------------------------------------------------------------------------
    # Revenue Forecasting
    # -------------------------------------------------------------------------

    async def _forecast_revenue(self, command: str) -> dict[str, Any]:
        """Forecast revenue based on historical data."""
        # Extract time period from command
        period = "quarter"  # Default
        if "month" in command.lower():
            period = "month"
        elif "year" in command.lower():
            period = "year"

        return await self._forecast_revenue_with_params({"period": period})

    async def _forecast_revenue_with_params(self, params: dict[str, Any]) -> dict[str, Any]:
        """Forecast revenue with explicit parameters."""
        period = params.get("period", "quarter")

        # Load historical data (placeholder - would use actual database)
        historical_revenue = await self._load_historical_revenue()

        # Calculate forecast using simple trend analysis
        forecast = self._calculate_revenue_forecast(historical_revenue, period)

        return {
            "success": True,
            "agent": self.name,
            "prediction_type": "revenue_forecast",
            "period": period,
            "forecast": forecast,
            "confidence": forecast.get("confidence", 0.75),
            "timestamp": datetime.now().isoformat()
        }

    async def _load_historical_revenue(self) -> list[dict[str, Any]]:
        """Load historical revenue data."""
        # Placeholder: would query database for actual lead conversion data
        # For now, generate sample historical data
        months = 6
        base_revenue = 50000
        growth_rate = 1.15

        data = []
        for i in range(months):
            month_revenue = base_revenue * (growth_rate ** i)
            data.append({
                "period": (datetime.now() - timedelta(days=30 * (months - i))).strftime("%Y-%m"),
                "revenue": month_revenue,
                "leads": int(month_revenue / 500),
                "conversions": int(month_revenue / 5000)
            })

        return data

    def _calculate_revenue_forecast(self, historical: list[dict[str, Any]], period: str) -> dict[str, Any]:
        """Calculate revenue forecast using trend analysis."""
        if not historical:
            return {
                "forecast_amount": 0,
                "confidence": 0,
                "method": "insufficient_data"
            }

        # Extract revenue values
        revenues = [h["revenue"] for h in historical]

        # Calculate growth rate
        if len(revenues) > 1:
            growth_rates = [(revenues[i] / revenues[i-1]) - 1 for i in range(1, len(revenues))]
            avg_growth_rate = statistics.mean(growth_rates)
        else:
            avg_growth_rate = 0.15  # Default 15% growth

        # Forecast next period
        last_revenue = revenues[-1]

        if period == "month":
            forecast_amount = last_revenue * (1 + avg_growth_rate)
            periods_ahead = 1
        elif period == "quarter":
            forecast_amount = last_revenue * (1 + avg_growth_rate) ** 3
            periods_ahead = 3
        else:  # year
            forecast_amount = last_revenue * (1 + avg_growth_rate) ** 12
            periods_ahead = 12

        # Calculate confidence based on data consistency
        if len(revenues) > 2:
            stdev = statistics.stdev(growth_rates) if len(growth_rates) > 1 else 0
            confidence = max(0.5, min(0.95, 0.85 - (stdev * 2)))
        else:
            confidence = 0.65

        return {
            "forecast_amount": round(forecast_amount, 2),
            "growth_rate": round(avg_growth_rate * 100, 2),
            "confidence": round(confidence, 3),
            "periods_ahead": periods_ahead,
            "method": "linear_trend",
            "historical_periods": len(revenues)
        }

    # -------------------------------------------------------------------------
    # Trend Analysis
    # -------------------------------------------------------------------------

    async def _analyze_trends(self, command: str) -> dict[str, Any]:
        """Analyze market trends from command."""
        # Extract industry/keyword
        industry = self._extract_industry(command)
        return await self._analyze_trends_with_params({"industry": industry})

    async def _analyze_trends_with_params(self, params: dict[str, Any]) -> dict[str, Any]:
        """Analyze market trends with explicit parameters."""
        industry = params.get("industry", "construction")

        # Analyze lead volume trends
        trends = await self._calculate_trends(industry)

        return {
            "success": True,
            "agent": self.name,
            "prediction_type": "trend_analysis",
            "industry": industry,
            "trends": trends,
            "timestamp": datetime.now().isoformat()
        }

    async def _calculate_trends(self, industry: str) -> dict[str, Any]:
        """Calculate trend metrics for an industry."""
        # Placeholder: would analyze actual lead data from database
        # For now, generate sample trend data

        return {
            "direction": "upward",
            "strength": "strong",
            "velocity": 0.23,  # 23% growth rate
            "momentum": "accelerating",
            "seasonal_factor": 1.15,
            "market_size_estimate": "growing",
            "competition_level": "moderate",
            "demand_indicators": {
                "search_volume": "increasing",
                "lead_quality": "improving",
                "conversion_rate": "stable"
            },
            "forecast_next_30_days": "continued_growth",
            "confidence": 0.78
        }

    # -------------------------------------------------------------------------
    # Conversion Prediction
    # -------------------------------------------------------------------------

    async def _predict_conversion(self, command: str) -> dict[str, Any]:
        """Predict lead conversion probability."""
        return await self._predict_conversion_with_params({})

    async def _predict_conversion_with_params(self, params: dict[str, Any]) -> dict[str, Any]:
        """Predict conversion probability with parameters."""
        # Calculate conversion probabilities
        conversion_model = await self._build_conversion_model()

        return {
            "success": True,
            "agent": self.name,
            "prediction_type": "conversion_probability",
            "model": conversion_model,
            "timestamp": datetime.now().isoformat()
        }

    async def _build_conversion_model(self) -> dict[str, Any]:
        """Build a conversion probability model."""
        # Placeholder: would train on historical conversion data

        return {
            "hot_lead_conversion": 0.35,
            "warm_lead_conversion": 0.18,
            "cold_lead_conversion": 0.05,
            "factors": {
                "website_presence": 0.25,
                "email_availability": 0.20,
                "phone_verified": 0.15,
                "high_rating": 0.15,
                "recent_reviews": 0.10,
                "complete_address": 0.10,
                "industry_match": 0.05
            },
            "average_conversion_time_days": 14,
            "confidence": 0.82
        }

    # -------------------------------------------------------------------------
    # Seasonality Analysis
    # -------------------------------------------------------------------------

    async def _analyze_seasonality(self, command: str) -> dict[str, Any]:
        """Analyze seasonal demand patterns."""
        industry = self._extract_industry(command)
        return await self._analyze_seasonality_with_params({"industry": industry})

    async def _analyze_seasonality_with_params(self, params: dict[str, Any]) -> dict[str, Any]:
        """Analyze seasonality with explicit parameters."""
        industry = params.get("industry", "construction")

        # Calculate seasonal patterns
        patterns = await self._calculate_seasonal_patterns(industry)

        return {
            "success": True,
            "agent": self.name,
            "prediction_type": "seasonality_analysis",
            "industry": industry,
            "patterns": patterns,
            "timestamp": datetime.now().isoformat()
        }

    async def _calculate_seasonal_patterns(self, industry: str) -> dict[str, Any]:
        """Calculate seasonal demand patterns."""
        # Construction/flooring typically peaks in spring/summer
        current_month = datetime.now().month

        seasonal_factors = {
            1: 0.75,  # January - Low (winter)
            2: 0.80,  # February
            3: 1.05,  # March - Starting to pick up
            4: 1.25,  # April - Peak season starts
            5: 1.35,  # May
            6: 1.40,  # June - Peak
            7: 1.35,  # July
            8: 1.25,  # August
            9: 1.15,  # September
            10: 1.00, # October
            11: 0.85, # November
            12: 0.70  # December - Low (holidays)
        }

        return {
            "current_season": "high" if seasonal_factors[current_month] > 1.2 else "low" if seasonal_factors[current_month] < 0.9 else "moderate",
            "current_factor": seasonal_factors[current_month],
            "peak_months": ["May", "June", "July"],
            "low_months": ["December", "January", "February"],
            "monthly_factors": seasonal_factors,
            "next_month_forecast": seasonal_factors.get(current_month + 1 if current_month < 12 else 1, 1.0),
            "confidence": 0.85
        }

    # -------------------------------------------------------------------------
    # Industry Growth Prediction
    # -------------------------------------------------------------------------

    async def _predict_industry_growth(self, command: str) -> dict[str, Any]:
        """Predict industry growth rates."""
        industry = self._extract_industry(command)
        return await self._predict_industry_growth_with_params({"industry": industry})

    async def _predict_industry_growth_with_params(self, params: dict[str, Any]) -> dict[str, Any]:
        """Predict industry growth with explicit parameters."""
        industry = params.get("industry", "construction")

        # Calculate growth predictions
        growth = await self._calculate_industry_growth(industry)

        return {
            "success": True,
            "agent": self.name,
            "prediction_type": "industry_growth",
            "industry": industry,
            "growth_forecast": growth,
            "timestamp": datetime.now().isoformat()
        }

    async def _calculate_industry_growth(self, industry: str) -> dict[str, Any]:
        """Calculate industry growth forecast."""
        # Industry-specific growth rates (placeholder data)
        industry_growth_rates = {
            "epoxy": 0.18,
            "flooring": 0.12,
            "concrete": 0.15,
            "roofing": 0.10,
            "construction": 0.08,
            "contractor": 0.08
        }

        base_rate = industry_growth_rates.get(industry, 0.10)

        return {
            "annual_growth_rate": base_rate,
            "5_year_cagr": base_rate * 1.05,
            "market_maturity": "growth" if base_rate > 0.12 else "mature",
            "drivers": [
                "Commercial construction demand",
                "Infrastructure investment",
                "Residential remodeling"
            ],
            "risks": [
                "Economic downturn",
                "Material cost inflation",
                "Labor shortage"
            ],
            "opportunity_score": 0.75,
            "confidence": 0.72
        }

    # -------------------------------------------------------------------------
    # Generic Prediction
    # -------------------------------------------------------------------------

    async def _generic_prediction(self, command: str) -> dict[str, Any]:
        """Handle generic prediction requests."""
        return {
            "success": True,
            "agent": self.name,
            "prediction_type": "generic",
            "message": "Prediction analysis completed",
            "command": command,
            "recommendations": [
                "Focus on high-conversion lead sources",
                "Optimize outreach during peak seasons",
                "Monitor industry trends for opportunities"
            ],
            "timestamp": datetime.now().isoformat()
        }

    # -------------------------------------------------------------------------
    # Utilities
    # -------------------------------------------------------------------------

    def _extract_industry(self, command: str) -> str:
        """Extract industry keyword from command."""
        industries = [
            "epoxy", "flooring", "roofing", "concrete", "tile",
            "painting", "plumbing", "electrical", "hvac", "construction"
        ]

        command_lower = command.lower()
        for industry in industries:
            if industry in command_lower:
                return industry

        return "construction"  # Default


# Singleton instance for easy import
prediction_agent = PredictionAgent()
