"""
vision_cortex/daily_briefing.py
================================
Generates a daily intelligence briefing in Markdown format from processed
IntelligenceItem data.  Summarises top opportunities, identifies trending
topics, and surfaces market signals across all source categories.
"""

from __future__ import annotations

import json
import logging
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent / "data"
PROCESSED_PATH = DATA_DIR / "processed.json"

_CATEGORY_LABELS: Dict[str, str] = {
    "ai_research": "🤖 AI Research",
    "venture_capital": "💰 Venture Capital",
    "startups": "🚀 Startups",
    "technology": "⚙️ Technology",
    "financial": "📈 Financial",
    "markets": "🌍 Emerging Markets",
}

_TOP_N_PER_SECTION = 5
_TOP_KEYWORDS_N = 10


# ---------------------------------------------------------------------------
# Loader
# ---------------------------------------------------------------------------

def _load_processed(path: Path) -> List[Dict[str, Any]]:
    """Load items from *processed.json* (or any equivalent file)."""
    if not path.exists():
        logger.warning("[Briefing] No processed data at %s", path)
        return []
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data.get("items", [])
    except (json.JSONDecodeError, OSError) as exc:
        logger.error("[Briefing] Cannot load processed data: %s", exc)
        return []


# ---------------------------------------------------------------------------
# Analysis helpers
# ---------------------------------------------------------------------------

def _top_items_by_score(
    items: List[Dict[str, Any]],
    score_key: str,
    n: int,
) -> List[Dict[str, Any]]:
    return sorted(items, key=lambda x: x.get(score_key, 0), reverse=True)[:n]


def _group_by_category(
    items: List[Dict[str, Any]],
) -> Dict[str, List[Dict[str, Any]]]:
    groups: Dict[str, List[Dict[str, Any]]] = {}
    for item in items:
        cat = item.get("category", "unknown")
        groups.setdefault(cat, []).append(item)
    return groups


def _top_keywords(items: List[Dict[str, Any]], n: int) -> List[Tuple[str, int]]:
    counter: Counter = Counter()
    for item in items:
        for kw in item.get("keywords", []):
            counter[kw] += 1
    return counter.most_common(n)


def _trending_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [i for i in items if i.get("is_trending")]


def _sentiment_summary(items: List[Dict[str, Any]]) -> Dict[str, int]:
    summary: Dict[str, int] = {"positive": 0, "negative": 0, "neutral": 0}
    for item in items:
        s = item.get("sentiment", "neutral")
        if s in summary:
            summary[s] += 1
    return summary


def _avg_score(items: List[Dict[str, Any]], key: str) -> float:
    if not items:
        return 0.0
    return round(sum(i.get(key, 0) for i in items) / len(items), 1)


# ---------------------------------------------------------------------------
# Markdown builders
# ---------------------------------------------------------------------------

def _md_header(title: str, date_str: str, total: int) -> str:
    return (
        f"# {title}\n\n"
        f"> **Generated:** {date_str}  \n"
        f"> **Total signals processed:** {total}\n\n"
        "---\n\n"
    )


def _md_executive_summary(
    items: List[Dict[str, Any]],
    keyword_counts: List[Tuple[str, int]],
    sentiment: Dict[str, int],
) -> str:
    avg_rel = _avg_score(items, "relevance_score")
    avg_opp = _avg_score(items, "opportunity_score")
    trending_count = len(_trending_items(items))
    top_kws = ", ".join(kw for kw, _ in keyword_counts[:5]) or "N/A"

    return (
        "## 📋 Executive Summary\n\n"
        f"| Metric | Value |\n"
        f"|--------|-------|\n"
        f"| Signals Analysed | {len(items)} |\n"
        f"| Avg Relevance Score | {avg_rel}/100 |\n"
        f"| Avg Opportunity Score | {avg_opp}/100 |\n"
        f"| Trending Topics | {trending_count} |\n"
        f"| Positive Signals | {sentiment['positive']} |\n"
        f"| Negative Signals | {sentiment['negative']} |\n"
        f"| Neutral Signals | {sentiment['neutral']} |\n"
        f"| Top Keywords | {top_kws} |\n\n"
    )


def _md_top_opportunities(items: List[Dict[str, Any]]) -> str:
    top = _top_items_by_score(items, "opportunity_score", _TOP_N_PER_SECTION)
    if not top:
        return "## 🎯 Top Opportunities\n\n_No opportunity signals detected._\n\n"

    lines = ["## 🎯 Top Opportunities\n"]
    for i, item in enumerate(top, 1):
        title = item.get("title", "Untitled")[:120]
        url = item.get("url", "")
        opp = item.get("opportunity_score", 0)
        source = item.get("source_name", "")
        cat = _CATEGORY_LABELS.get(item.get("category", ""), item.get("category", ""))
        summary = item.get("summary", "")[:200]
        if summary:
            summary = f"\n   > {summary}"
        link = f"[{title}]({url})" if url else title
        lines.append(
            f"{i}. **{link}**  \n"
            f"   {cat} · {source} · Score: **{opp}**{summary}\n"
        )
    return "\n".join(lines) + "\n"


def _md_top_relevance(items: List[Dict[str, Any]]) -> str:
    top = _top_items_by_score(items, "relevance_score", _TOP_N_PER_SECTION)
    if not top:
        return "## 🔬 Highest Relevance Signals\n\n_No signals found._\n\n"

    lines = ["## 🔬 Highest Relevance Signals\n"]
    for i, item in enumerate(top, 1):
        title = item.get("title", "Untitled")[:120]
        url = item.get("url", "")
        rel = item.get("relevance_score", 0)
        source = item.get("source_name", "")
        link = f"[{title}]({url})" if url else title
        lines.append(f"{i}. **{link}** — {source} · Relevance: **{rel}**\n")
    return "\n".join(lines) + "\n"


def _md_trending(items: List[Dict[str, Any]]) -> str:
    trending = _trending_items(items)[:_TOP_N_PER_SECTION]
    if not trending:
        return "## 🔥 Trending Now\n\n_No trending signals detected._\n\n"

    lines = ["## 🔥 Trending Now\n"]
    for item in trending:
        title = item.get("title", "Untitled")[:120]
        url = item.get("url", "")
        kws = ", ".join(item.get("keywords", [])[:4])
        link = f"[{title}]({url})" if url else title
        lines.append(f"- **{link}**  \n  Keywords: `{kws}`\n")
    return "\n".join(lines) + "\n"


def _md_category_breakdown(
    grouped: Dict[str, List[Dict[str, Any]]],
) -> str:
    lines = ["## 📂 Category Breakdown\n"]
    for cat, cat_items in sorted(grouped.items(), key=lambda x: -len(x[1])):
        label = _CATEGORY_LABELS.get(cat, cat.replace("_", " ").title())
        avg_opp = _avg_score(cat_items, "opportunity_score")
        top = _top_items_by_score(cat_items, "opportunity_score", 3)
        lines.append(f"### {label} ({len(cat_items)} signals · avg opp: {avg_opp})\n")
        for item in top:
            title = item.get("title", "Untitled")[:100]
            url = item.get("url", "")
            link = f"[{title}]({url})" if url else title
            lines.append(f"- {link}\n")
        lines.append("")
    return "\n".join(lines)


def _md_keyword_cloud(keyword_counts: List[Tuple[str, int]]) -> str:
    if not keyword_counts:
        return "## 🏷️ Keyword Intelligence\n\n_No keyword data available._\n\n"

    lines = ["## 🏷️ Keyword Intelligence\n", "| Keyword | Frequency |", "|---------|-----------|"]
    for kw, count in keyword_counts:
        lines.append(f"| `{kw}` | {count} |")
    return "\n".join(lines) + "\n\n"


def _md_footer(generated_at: str) -> str:
    return (
        "---\n\n"
        f"*XPS Vision Cortex Daily Briefing · {generated_at} UTC*  \n"
        "*Powered by XPS Intelligence Platform*\n"
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_briefing(
    processed_path: Optional[Path] = None,
    title: str = "XPS Intelligence Daily Briefing",
) -> str:
    """Generate a Markdown daily briefing from processed intelligence data.

    Parameters
    ----------
    processed_path:
        Path to the ``processed.json`` file produced by
        ``intelligence_processor.process_all()``.  Defaults to
        ``vision_cortex/data/processed.json``.
    title:
        Briefing document title.

    Returns
    -------
    A fully formatted Markdown string ready to be written to
    ``DAILY_BRIEFING.md`` or served via an API endpoint.
    """
    source_path = processed_path or PROCESSED_PATH
    items = _load_processed(source_path)

    now = datetime.now(tz=timezone.utc)
    date_str = now.strftime("%A, %d %B %Y — %H:%M UTC")
    generated_at = now.strftime("%Y-%m-%d %H:%M")

    if not items:
        return (
            f"# {title}\n\n"
            f"> **Generated:** {date_str}\n\n"
            "_No intelligence data available. Run the scraper and processor first._\n"
        )

    keyword_counts = _top_keywords(items, _TOP_KEYWORDS_N)
    sentiment = _sentiment_summary(items)
    grouped = _group_by_category(items)

    sections = [
        _md_header(title, date_str, len(items)),
        _md_executive_summary(items, keyword_counts, sentiment),
        _md_top_opportunities(items),
        _md_top_relevance(items),
        _md_trending(items),
        _md_category_breakdown(grouped),
        _md_keyword_cloud(keyword_counts),
        _md_footer(generated_at),
    ]

    briefing = "\n".join(sections)
    logger.info(
        "[Briefing] Generated daily briefing: %d items, %d chars",
        len(items),
        len(briefing),
    )
    return briefing


def save_briefing(
    briefing: str,
    output_path: Optional[Path] = None,
) -> Path:
    """Write *briefing* to *output_path* (default: repo root ``DAILY_BRIEFING.md``)."""
    dest = output_path or (Path(__file__).parent.parent / "DAILY_BRIEFING.md")
    dest.parent.mkdir(parents=True, exist_ok=True)
    with open(dest, "w", encoding="utf-8") as fh:
        fh.write(briefing)
    logger.info("[Briefing] Saved briefing → %s", dest)
    return dest


if __name__ == "__main__":
    import logging as _logging
    _logging.basicConfig(
        level=_logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    md = generate_briefing()
    out = save_briefing(md)
    print(f"Briefing saved to {out}")
    print(f"\n--- Preview (first 800 chars) ---\n{md[:800]}")
