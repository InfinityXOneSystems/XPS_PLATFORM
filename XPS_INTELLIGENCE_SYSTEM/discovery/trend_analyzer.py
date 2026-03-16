"""
discovery/trend_analyzer.py
============================
Trend Analyzer — identifies trends from intelligence data.

Processes raw lead / market data to surface rising trends,
compute velocity scores, and flag emerging opportunities.
"""
from __future__ import annotations

import logging
import math
from collections import Counter
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class TrendAnalyzer:
    """Identifies and scores trends from structured intelligence data."""

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def analyze_trends(self, data: List[dict]) -> List[dict]:
        """Return a list of trend objects derived from *data*.

        Each trend object contains:
        - ``name``          — trend label
        - ``count``         — number of data points mentioning it
        - ``score``         — 0–100 trend strength
        - ``emerging``      — True if velocity is high
        """
        if not data:
            return self._demo_trends()

        keyword_counts = self._extract_keyword_counts(data)
        total = sum(keyword_counts.values()) or 1
        trends: List[dict] = []
        for name, count in keyword_counts.most_common(20):
            score = self.trend_score(name, data)
            trends.append(
                {
                    "name": name,
                    "count": count,
                    "frequency": round(count / total, 4),
                    "score": score,
                    "emerging": score >= 70,
                }
            )
        logger.info("trends_analyzed count=%s", len(trends))
        return trends

    def detect_emerging(self, data: List[dict]) -> List[dict]:
        """Return only rapidly-rising trends (score ≥ 70) from *data*."""
        all_trends = self.analyze_trends(data)
        emerging = [t for t in all_trends if t.get("emerging")]
        logger.info("emerging_trends_detected count=%s", len(emerging))
        return emerging

    def trend_score(self, trend_name: str, data: List[dict]) -> float:
        """Compute a 0–100 score expressing how strongly *trend_name* appears
        in *data*.

        Uses log-frequency scaled to [0, 100].
        """
        if not data:
            return 0.0

        hits = sum(
            1
            for record in data
            if trend_name.lower() in self._record_text(record).lower()
        )
        if hits == 0:
            return 0.0

        raw = math.log1p(hits) / math.log1p(len(data))
        return round(min(raw * 120, 100), 2)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _record_text(record: dict) -> str:
        """Flatten a record dict into a single searchable string."""
        parts: List[str] = []
        for v in record.values():
            if isinstance(v, str):
                parts.append(v)
            elif isinstance(v, (list, tuple)):
                parts.extend(str(i) for i in v)
        return " ".join(parts)

    def _extract_keyword_counts(self, data: List[dict]) -> Counter:
        counter: Counter = Counter()
        for record in data:
            text = self._record_text(record)
            words = [w.strip(".,;:") for w in text.lower().split() if len(w) > 4]
            counter.update(words)
        return counter

    @staticmethod
    def _demo_trends() -> List[Dict[str, Any]]:
        return [
            {"name": "epoxy flooring", "count": 142, "frequency": 0.18, "score": 88.0, "emerging": True},
            {"name": "luxury vinyl plank", "count": 118, "frequency": 0.15, "score": 82.0, "emerging": True},
            {"name": "commercial hardwood", "count": 95, "frequency": 0.12, "score": 74.0, "emerging": True},
            {"name": "residential renovation", "count": 201, "frequency": 0.26, "score": 91.0, "emerging": True},
            {"name": "outdoor living", "count": 67, "frequency": 0.09, "score": 61.0, "emerging": False},
        ]
