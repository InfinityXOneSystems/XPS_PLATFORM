"""
vision_cortex/intelligence_processor.py
========================================
Processes raw scraped data from vision_cortex/data/ into structured
IntelligenceItem objects with relevance scoring, keyword extraction,
and trend identification.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent / "data"

# ---------------------------------------------------------------------------
# Keyword taxonomy used for relevance scoring
# ---------------------------------------------------------------------------

_TECH_KEYWORDS: List[str] = [
    "ai", "artificial intelligence", "machine learning", "deep learning",
    "llm", "gpt", "transformer", "neural network", "automation", "robot",
    "saas", "cloud", "api", "platform", "infrastructure", "devops",
    "kubernetes", "microservice", "serverless", "edge computing",
]

_BUSINESS_KEYWORDS: List[str] = [
    "revenue", "profit", "growth", "market", "funding", "investment",
    "acquisition", "ipo", "valuation", "venture capital", "series a",
    "series b", "seed round", "startup", "enterprise", "b2b", "b2c",
    "customer", "traction", "mrr", "arr", "burn rate", "runway",
]

_OPPORTUNITY_KEYWORDS: List[str] = [
    "launch", "new product", "announce", "raise", "partnership", "expand",
    "hire", "job", "opportunity", "breakthrough", "disruption", "innovation",
    "first", "fastest", "largest", "leading", "award", "winner",
]

_RISK_KEYWORDS: List[str] = [
    "layoff", "bankrupt", "lawsuit", "scandal", "hack", "breach",
    "regulation", "fine", "ban", "decline", "loss", "warning",
]

_ALL_KEYWORD_GROUPS: Dict[str, Tuple[List[str], int]] = {
    "technology": (_TECH_KEYWORDS, 2),
    "business": (_BUSINESS_KEYWORDS, 3),
    "opportunity": (_OPPORTUNITY_KEYWORDS, 4),
    "risk": (_RISK_KEYWORDS, -2),
}


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class IntelligenceItem:
    """A single processed intelligence signal."""

    source_id: str
    source_name: str
    category: str
    title: str
    url: str
    summary: str
    published: str
    author: str
    tags: List[str]
    scraped_at: str

    # Derived fields populated by the processor
    keywords: List[str] = field(default_factory=list)
    sentiment: str = "neutral"          # positive | negative | neutral
    relevance_score: float = 0.0        # 0–100
    opportunity_score: float = 0.0      # 0–100
    is_trending: bool = False
    processed_at: str = field(
        default_factory=lambda: datetime.now(tz=timezone.utc).isoformat()
    )

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalise_text(text: str) -> str:
    return text.lower()


def _extract_keywords(text: str) -> List[str]:
    """Return matched keywords from the taxonomy found in *text*."""
    lower = _normalise_text(text)
    found: List[str] = []
    for group_kws, _ in _ALL_KEYWORD_GROUPS.values():
        for kw in group_kws:
            if kw in lower and kw not in found:
                found.append(kw)
    return found


def _score_relevance(text: str) -> float:
    """Return a 0–100 relevance score weighted by keyword group importance."""
    lower = _normalise_text(text)
    score = 0.0
    for group_kws, weight in _ALL_KEYWORD_GROUPS.values():
        hits = sum(1 for kw in group_kws if kw in lower)
        score += hits * abs(weight)

    # Normalise: assume 20 keyword hits ≈ score of 100
    normalised = min(score / 20.0 * 100.0, 100.0)
    return round(normalised, 2)


def _score_opportunity(text: str) -> float:
    """Return a 0–100 opportunity score biased toward positive signals."""
    lower = _normalise_text(text)
    opp_hits = sum(1 for kw in _OPPORTUNITY_KEYWORDS if kw in lower)
    risk_hits = sum(1 for kw in _RISK_KEYWORDS if kw in lower)
    raw = (opp_hits * 5) - (risk_hits * 3)
    return round(max(0.0, min(float(raw), 100.0)), 2)


def _detect_sentiment(text: str) -> str:
    lower = _normalise_text(text)
    pos = sum(1 for kw in _OPPORTUNITY_KEYWORDS if kw in lower)
    neg = sum(1 for kw in _RISK_KEYWORDS if kw in lower)
    if pos > neg:
        return "positive"
    if neg > pos:
        return "negative"
    return "neutral"


def _is_trending(item_text: str, all_keywords: List[List[str]]) -> bool:
    """Rough trending signal: keyword appears in many other items."""
    if not all_keywords:
        return False
    item_kws = set(_extract_keywords(item_text))
    overlap_count = sum(1 for kws in all_keywords if item_kws & set(kws))
    return overlap_count >= max(2, len(all_keywords) // 5)


# ---------------------------------------------------------------------------
# Core processor
# ---------------------------------------------------------------------------

def _process_raw_file(path: Path) -> List[IntelligenceItem]:
    """Load a single raw JSON file and return processed IntelligenceItems."""
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except (json.JSONDecodeError, OSError) as exc:
        logger.error("[Processor] Cannot read %s: %s", path, exc)
        return []

    source = data.get("source", {})
    raw_items: List[Dict[str, Any]] = data.get("items", [])
    results: List[IntelligenceItem] = []

    for raw in raw_items:
        combined_text = f"{raw.get('title', '')} {raw.get('summary', '')}"
        item = IntelligenceItem(
            source_id=raw.get("source_id", source.get("id", "")),
            source_name=raw.get("source_name", source.get("name", "")),
            category=raw.get("category", source.get("category", "")),
            title=raw.get("title", ""),
            url=raw.get("url", ""),
            summary=raw.get("summary", ""),
            published=raw.get("published", ""),
            author=raw.get("author", ""),
            tags=raw.get("tags", []),
            scraped_at=raw.get("scraped_at", data.get("scraped_at", "")),
            keywords=_extract_keywords(combined_text),
            sentiment=_detect_sentiment(combined_text),
            relevance_score=_score_relevance(combined_text),
            opportunity_score=_score_opportunity(combined_text),
        )
        results.append(item)

    return results


def process_all(
    data_dir: Optional[Path] = None,
    min_relevance: float = 0.0,
) -> List[IntelligenceItem]:
    """Read all raw JSON files in *data_dir* and return processed items.

    Parameters
    ----------
    data_dir:
        Directory containing raw scraped JSON files. Defaults to
        ``vision_cortex/data/``.
    min_relevance:
        Discard items with a relevance_score below this threshold.

    Returns
    -------
    List of IntelligenceItem objects sorted by relevance_score descending.
    """
    target_dir = data_dir or DATA_DIR
    json_files = sorted(target_dir.glob("*.json"))

    if not json_files:
        logger.info("[Processor] No raw data files found in %s", target_dir)
        return []

    all_items: List[IntelligenceItem] = []
    for path in json_files:
        items = _process_raw_file(path)
        all_items.extend(items)

    # Back-fill trending flag
    all_kws = [item.keywords for item in all_items]
    for item in all_items:
        combined = f"{item.title} {item.summary}"
        item.is_trending = _is_trending(combined, all_kws)

    filtered = [i for i in all_items if i.relevance_score >= min_relevance]
    filtered.sort(key=lambda x: x.relevance_score, reverse=True)

    logger.info(
        "[Processor] Processed %d items from %d files (%d above relevance threshold).",
        len(all_items),
        len(json_files),
        len(filtered),
    )
    return filtered


def save_processed(
    items: List[IntelligenceItem],
    output_path: Optional[Path] = None,
) -> Path:
    """Persist processed intelligence to a JSON file.

    Parameters
    ----------
    items:
        List of processed IntelligenceItem objects.
    output_path:
        Destination path. Defaults to ``vision_cortex/data/processed.json``.
    """
    dest = output_path or (DATA_DIR / "processed.json")
    dest.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "total_items": len(items),
        "items": [i.to_dict() for i in items],
    }
    with open(dest, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    logger.info("[Processor] Saved %d processed items → %s", len(items), dest)
    return dest


if __name__ == "__main__":
    import logging as _logging
    _logging.basicConfig(
        level=_logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    processed = process_all()
    out = save_processed(processed)
    print(f"Saved {len(processed)} items to {out}")
