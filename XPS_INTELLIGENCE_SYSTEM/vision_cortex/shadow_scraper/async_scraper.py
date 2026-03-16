"""
vision_cortex/shadow_scraper/async_scraper.py
=============================================
Async shadow scraper for intelligence ingestion.
Runs in background, collects from all seed sources.
Gracefully degrades when optional dependencies are absent.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import aiohttp
    _AIOHTTP_AVAILABLE = True
except ImportError:
    _AIOHTTP_AVAILABLE = False

try:
    import feedparser
    _FEEDPARSER_AVAILABLE = True
except ImportError:
    _FEEDPARSER_AVAILABLE = False

try:
    from bs4 import BeautifulSoup
    _BS4_AVAILABLE = True
except ImportError:
    _BS4_AVAILABLE = False

try:
    import urllib.request as _urllib_request
    _URLLIB_AVAILABLE = True
except ImportError:
    _URLLIB_AVAILABLE = False

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"
SOURCES_PATH = Path(__file__).parent.parent / "seed_list" / "sources.json"

DEFAULT_TIMEOUT_SECONDS = 30
DEFAULT_RATE_LIMIT_DELAY = 1.0
DEFAULT_USER_AGENT = (
    "XPS-Intelligence-VisionCortex/1.0 (research aggregator; +https://github.com/xps)"
)


def _load_sources() -> List[Dict[str, Any]]:
    """Load seed sources from the JSON manifest."""
    if not SOURCES_PATH.exists():
        logger.warning("sources.json not found at %s", SOURCES_PATH)
        return []
    with open(SOURCES_PATH, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _output_path(source_id: str) -> Path:
    return DATA_DIR / f"{source_id}.json"


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _parse_rss_feedparser(raw: str, source: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Parse RSS/Atom with feedparser and return normalised item dicts."""
    feed = feedparser.parse(raw)
    items: List[Dict[str, Any]] = []
    for entry in feed.entries:
        items.append(
            {
                "title": entry.get("title", ""),
                "url": entry.get("link", ""),
                "summary": entry.get("summary", ""),
                "published": entry.get("published", ""),
                "author": entry.get("author", ""),
                "tags": [t.get("term", "") for t in entry.get("tags", [])],
                "source_id": source["id"],
                "source_name": source["name"],
                "category": source["category"],
                "scraped_at": _now_iso(),
            }
        )
    return items


def _parse_html_bs4(raw: str, source: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Very lightweight HTML extraction when feedparser is unavailable."""
    soup = BeautifulSoup(raw, "html.parser")
    items: List[Dict[str, Any]] = []
    for tag in soup.find_all(["h1", "h2", "h3", "article"])[:20]:
        text = tag.get_text(strip=True)
        if text:
            items.append(
                {
                    "title": text[:200],
                    "url": source["url"],
                    "summary": "",
                    "published": "",
                    "author": "",
                    "tags": source.get("tags", []),
                    "source_id": source["id"],
                    "source_name": source["name"],
                    "category": source["category"],
                    "scraped_at": _now_iso(),
                }
            )
    return items


def _parse_raw_minimal(raw: str, source: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Last-resort parser — returns a single placeholder item."""
    return [
        {
            "title": f"Raw content from {source['name']}",
            "url": source["url"],
            "summary": raw[:500] if raw else "",
            "published": "",
            "author": "",
            "tags": source.get("tags", []),
            "source_id": source["id"],
            "source_name": source["name"],
            "category": source["category"],
            "scraped_at": _now_iso(),
        }
    ]


def _parse_content(raw: str, source: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Route raw content through the best available parser."""
    if _FEEDPARSER_AVAILABLE and source.get("type") in ("rss", "atom"):
        return _parse_rss_feedparser(raw, source)
    if _BS4_AVAILABLE:
        return _parse_html_bs4(raw, source)
    return _parse_raw_minimal(raw, source)


async def _fetch_with_aiohttp(url: str, session: Any) -> Optional[str]:
    headers = {"User-Agent": DEFAULT_USER_AGENT}
    try:
        async with session.get(
            url,
            headers=headers,
            timeout=aiohttp.ClientTimeout(total=DEFAULT_TIMEOUT_SECONDS),
        ) as resp:
            if resp.status == 200:
                return await resp.text()
            logger.warning("HTTP %s for %s", resp.status, url)
            return None
    except Exception as exc:  # noqa: BLE001
        logger.error("aiohttp fetch failed for %s: %s", url, exc)
        return None


def _fetch_sync_urllib(url: str) -> Optional[str]:
    """Synchronous urllib fallback — only called when aiohttp is unavailable."""
    try:
        req = _urllib_request.Request(url, headers={"User-Agent": DEFAULT_USER_AGENT})
        with _urllib_request.urlopen(req, timeout=DEFAULT_TIMEOUT_SECONDS) as resp:  # noqa: S310
            return resp.read().decode("utf-8", errors="replace")
    except Exception as exc:  # noqa: BLE001
        logger.error("urllib fetch failed for %s: %s", url, exc)
        return None


async def scrape_source(
    source: Dict[str, Any],
    session: Any = None,
    rate_limit_delay: float = DEFAULT_RATE_LIMIT_DELAY,
) -> Dict[str, Any]:
    """Scrape a single source and persist results to DATA_DIR.

    Parameters
    ----------
    source:
        Source descriptor dict from sources.json.
    session:
        Optional aiohttp.ClientSession.  One will be created if not provided
        (and aiohttp is available).
    rate_limit_delay:
        Seconds to sleep after the request.

    Returns
    -------
    Dict with keys: source_id, items_count, status, scraped_at, output_path.
    """
    _ensure_data_dir()
    source_id = source["id"]
    url = source["url"]
    logger.info("[VisionCortex] Scraping %s (%s)", source["name"], url)

    raw: Optional[str] = None

    if _AIOHTTP_AVAILABLE:
        _owns_session = session is None
        if _owns_session:
            session = aiohttp.ClientSession()
        try:
            raw = await _fetch_with_aiohttp(url, session)
        finally:
            if _owns_session:
                await session.close()
        await asyncio.sleep(rate_limit_delay)
    else:
        # Run blocking urllib in a thread so we don't stall the event loop
        loop = asyncio.get_event_loop()
        raw = await loop.run_in_executor(None, _fetch_sync_urllib, url)
        await asyncio.sleep(rate_limit_delay)

    if raw is None:
        result = {
            "source_id": source_id,
            "items_count": 0,
            "status": "error",
            "scraped_at": _now_iso(),
            "output_path": str(_output_path(source_id)),
        }
        logger.warning("[VisionCortex] No data for %s", source_id)
        return result

    items = _parse_content(raw, source)

    payload = {
        "source": source,
        "scraped_at": _now_iso(),
        "items_count": len(items),
        "items": items,
    }

    out_path = _output_path(source_id)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)

    logger.info(
        "[VisionCortex] Saved %d items for %s → %s",
        len(items),
        source_id,
        out_path,
    )

    return {
        "source_id": source_id,
        "items_count": len(items),
        "status": "ok",
        "scraped_at": _now_iso(),
        "output_path": str(out_path),
    }


async def scrape_all(
    sources: List[Dict[str, Any]],
    rate_limit_delay: float = DEFAULT_RATE_LIMIT_DELAY,
    concurrency: int = 5,
) -> List[Dict[str, Any]]:
    """Scrape all sources concurrently with a semaphore-bounded concurrency limit.

    Parameters
    ----------
    sources:
        List of source descriptor dicts.
    rate_limit_delay:
        Per-request delay in seconds.
    concurrency:
        Maximum simultaneous HTTP requests.
    """
    semaphore = asyncio.Semaphore(concurrency)

    async def _bounded(src: Dict[str, Any]) -> Dict[str, Any]:
        async with semaphore:
            return await scrape_source(src, rate_limit_delay=rate_limit_delay)

    results = await asyncio.gather(*[_bounded(s) for s in sources], return_exceptions=True)

    normalised: List[Dict[str, Any]] = []
    for src, res in zip(sources, results):
        if isinstance(res, Exception):
            logger.error("[VisionCortex] Exception for %s: %s", src["id"], res)
            normalised.append(
                {
                    "source_id": src["id"],
                    "items_count": 0,
                    "status": "exception",
                    "error": str(res),
                    "scraped_at": _now_iso(),
                }
            )
        else:
            normalised.append(res)

    ok = sum(1 for r in normalised if r.get("status") == "ok")
    total_items = sum(r.get("items_count", 0) for r in normalised)
    logger.info(
        "[VisionCortex] scrape_all complete: %d/%d sources ok, %d total items",
        ok,
        len(sources),
        total_items,
    )
    return normalised


def run_once() -> List[Dict[str, Any]]:
    """Synchronous entry point — loads sources and runs one full scrape cycle.

    Returns
    -------
    List of per-source result dicts.
    """
    sources = _load_sources()
    if not sources:
        logger.warning("[VisionCortex] No sources loaded; skipping scrape.")
        return []

    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            raise RuntimeError("closed loop")
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    return loop.run_until_complete(scrape_all(sources))


def run_scheduled(interval_hours: float = 6.0) -> None:
    """Run scrape_all in an infinite loop, sleeping *interval_hours* between cycles.

    Intended to be launched as a long-running background process.
    """
    logger.info(
        "[VisionCortex] Scheduled scraper starting (interval=%.1fh)", interval_hours
    )
    sources = _load_sources()
    interval_seconds = interval_hours * 3600

    async def _loop() -> None:
        while True:
            logger.info("[VisionCortex] Starting scrape cycle at %s", _now_iso())
            await scrape_all(sources)
            logger.info(
                "[VisionCortex] Cycle complete. Next run in %.1fh.", interval_hours
            )
            await asyncio.sleep(interval_seconds)

    asyncio.run(_loop())


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    results = run_once()
    print(json.dumps(results, indent=2))
