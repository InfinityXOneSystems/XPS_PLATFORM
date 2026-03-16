"""
agents/scraper/scraper_agent.py
================================
ScraperAgent – coordinates multi-source web scraping for contractor leads.

Sources supported (in priority order):
  1. Google Maps        (``agents/tools/scraper.py``)
  2. Bing Maps          (JS scraper via subprocess)
  3. Yelp               (JS scraper via subprocess)
  4. Contractor dirs    (JS scraper via subprocess)

The agent fans out to all configured sources concurrently, merges the
results, removes duplicates by phone/company-name, and returns a
deduplicated lead list.

All source adapters gracefully degrade to stub data when the
underlying scraper tool is unavailable (no Playwright, no API key, etc.)
so the pipeline can run end-to-end in restricted environments.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)

# Canonical fields we always include in every lead record
_LEAD_FIELDS = (
    "company_name", "phone", "website", "email",
    "rating", "review_count", "address", "city", "state",
    "industry_category", "source",
)


def _normalize_lead(lead: dict[str, Any], source: str) -> dict[str, Any]:
    """Ensure every lead has all canonical fields and a source tag."""
    normalized = {field: lead.get(field, "") for field in _LEAD_FIELDS}
    normalized["source"] = lead.get("source") or source
    # Preserve any extra fields
    for k, v in lead.items():
        if k not in normalized:
            normalized[k] = v
    return normalized


def _dedup_leads(leads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Remove duplicate leads keyed on phone or company_name."""
    seen_phones: set[str] = set()
    seen_names: set[str] = set()
    unique: list[dict[str, Any]] = []
    for lead in leads:
        phone = (lead.get("phone") or "").strip()
        name = (lead.get("company_name") or "").strip().lower()
        if phone and phone in seen_phones:
            continue
        if name and name in seen_names:
            continue
        if phone:
            seen_phones.add(phone)
        if name:
            seen_names.add(name)
        unique.append(lead)
    return unique


# ---------------------------------------------------------------------------
# Source adapters
# ---------------------------------------------------------------------------


async def _run_js_scraper(
    scraper_file: str,
    func_names: list[str],
    keyword: str,
    city: str,
    state: str,
    source: str,
) -> list[dict[str, Any]]:
    """
    Run a Node.js scraper via subprocess.

    :param scraper_file: Relative path to the scraper module.
    :param func_names:   Exported function names to try (first match wins).
    :param source:       Source tag applied to each returned lead.
    """
    try:
        import json

        fn_checks = " || ".join(f"s.{fn}" for fn in func_names)
        script = (
            f"const s = require('./{scraper_file}');"
            f"const fn = {fn_checks};"
            f"if (typeof fn !== 'function') {{ console.log('[]'); process.exit(0); }}"
            f"fn({json.dumps(keyword)},{json.dumps(city)},{json.dumps(state)})"
            f".then(r=>console.log(JSON.stringify(r||[])))"
            f".catch(()=>console.log('[]'));"
        )
        proc = await asyncio.create_subprocess_exec(
            "node", "-e", script,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=30)
        leads = json.loads(stdout.decode())
        return [_normalize_lead(l, source) for l in (leads or [])]
    except Exception as exc:
        logger.warning("%s scraper error: %s", source, exc)
        return []


async def _scrape_google_maps(keyword: str, city: str, state: str) -> list[dict[str, Any]]:
    """Delegate to the async Google Maps scraper tool."""
    try:
        from agents.tools.scraper import scrape_google_maps

        leads = await scrape_google_maps(keyword, city, state)
        return [_normalize_lead(l, "google_maps") for l in (leads or [])]
    except Exception as exc:
        logger.warning("Google Maps scraper error: %s", exc)
        return []


async def _scrape_bing_maps(keyword: str, city: str, state: str) -> list[dict[str, Any]]:
    """Call the Node.js Bing Maps scraper via subprocess."""
    return await _run_js_scraper(
        "scrapers/bing_maps_scraper.js",
        ["scrapeBingMaps", "default"],
        keyword, city, state,
        "bing_maps",
    )


async def _scrape_yelp(keyword: str, city: str, state: str) -> list[dict[str, Any]]:
    """Call the Node.js Yelp scraper via subprocess."""
    return await _run_js_scraper(
        "scrapers/yelp_scraper.js",
        ["scrapeYelp", "default"],
        keyword, city, state,
        "yelp",
    )


async def _scrape_directories(keyword: str, city: str, state: str) -> list[dict[str, Any]]:
    """Call the Node.js directory scraper via subprocess."""
    return await _run_js_scraper(
        "scrapers/directory_scraper.js",
        ["scrapeDirectories", "default"],
        keyword, city, state,
        "directory",
    )


# ---------------------------------------------------------------------------
# ScraperAgent
# ---------------------------------------------------------------------------

_SOURCE_ADAPTERS = {
    "google_maps": _scrape_google_maps,
    "bing_maps": _scrape_bing_maps,
    "yelp": _scrape_yelp,
    "directories": _scrape_directories,
}

_DEFAULT_SOURCES = ["google_maps", "bing_maps", "yelp", "directories"]


class ScraperAgent(BaseAgent):
    """
    Multi-source contractor lead scraper.

    Fans out to multiple scraping sources concurrently, merges results,
    and removes duplicates.

    Example::

        agent = ScraperAgent()
        result = await agent.run("scrape epoxy contractors orlando florida")
        leads = result["leads"]

    To restrict sources::

        agent = ScraperAgent(sources=["google_maps", "yelp"])
    """

    agent_name = "scraper"

    def __init__(self, sources: list[str] | None = None) -> None:
        super().__init__()
        self._sources: list[str] = sources or _DEFAULT_SOURCES

    async def execute(
        self,
        task: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Fan out to all configured scraping sources and return merged leads.

        Task keys consumed:
          - ``command``  – free-form command (parsed for keyword/city/state)
          - ``keyword``  – explicit keyword override
          - ``city``     – explicit city override
          - ``state``    – explicit state override
          - ``sources``  – list of source names to use (optional override)

        :returns: ``{"success": True, "leads": [...], "leads_found": int, ...}``
        """
        command = task.get("command", "")
        keyword = task.get("keyword") or self._extract_keyword(command)
        city = task.get("city", "")
        state = task.get("state", "")
        sources = task.get("sources") or self._sources

        logger.info(
            "ScraperAgent.execute: keyword=%r city=%r state=%r sources=%s",
            keyword, city, state, sources,
        )
        self.emit_event("scraper.start", {"keyword": keyword, "city": city, "state": state})

        # Fan out concurrently – only iterate sources that have a registered adapter
        active_sources = [src for src in sources if src in _SOURCE_ADAPTERS]
        coros = [
            _SOURCE_ADAPTERS[src](keyword, city, state)
            for src in active_sources
        ]
        results = await asyncio.gather(*coros, return_exceptions=True)

        all_leads: list[dict[str, Any]] = []
        source_counts: dict[str, int] = {}
        for src, result in zip(active_sources, results):
            if isinstance(result, Exception):
                logger.warning("Source %s raised: %s", src, result)
                source_counts[src] = 0
            else:
                source_counts[src] = len(result)
                all_leads.extend(result)

        deduped = _dedup_leads(all_leads)
        self.emit_event("scraper.complete", {"leads_found": len(deduped)})

        return {
            "success": True,
            "leads": deduped,
            "leads_found": len(deduped),
            "source_counts": source_counts,
            "message": f"Scraped {len(deduped)} unique leads from {len(active_sources)} sources",
        }

    def _extract_keyword(self, command: str) -> str:
        """Extract a scraping keyword from a free-form command."""
        import re

        lower = command.lower()
        industry_keywords = [
            "epoxy", "flooring", "tile", "hardwood", "carpet", "concrete", "painting",
            "roofing", "plumbing", "electrical", "hvac", "landscaping", "cleaning",
            "remodeling", "construction", "contractor",
        ]
        for kw in industry_keywords:
            if kw in lower:
                return kw
        # Fall back to first noun-like token after "scrape"
        m = re.search(r"scrape\s+(\w+)", lower)
        if m:
            return m.group(1)
        return "contractor"

    def capabilities(self) -> list[str]:
        return ["google_maps", "bing_maps", "yelp", "directory_scraping", "deduplication"]
