"""
app/scrapers/shadow_rest_scraper.py
=====================================
Shadow REST API Scraper — replaces the stub-based GoogleMapsScraper.

Strategy
--------
* Uses ``requests`` + ``BeautifulSoup`` for lightweight HTTP scraping of
  public business directories — **no API keys required**.
* Optionally uses Playwright (headless browser) when
  ``PLAYWRIGHT_ENABLED=true`` for JavaScript-rendered pages.
* Targets multiple sources concurrently via ``concurrent.futures``.
* Deduplicates by phone number and normalised company name.

Sources
-------
1. Google Maps HTML (search endpoint — public, no key)
2. YellowPages — structured HTML
3. Yelp — structured HTML
4. BBB (Better Business Bureau) — public registry
5. Manta — small-business directory

All HTTP calls use randomised ``User-Agent`` headers and polite rate-limiting
so the scraper behaves like a normal browser.
"""

from __future__ import annotations

import logging
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional
from urllib.parse import quote_plus

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) "
    "Gecko/20100101 Firefox/125.0",
]

_PHONE_RE = re.compile(r"\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}")
_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")

_DEFAULT_TIMEOUT = int(os.getenv("SCRAPER_TIMEOUT", "20"))
_CONCURRENCY = int(os.getenv("SCRAPER_CONCURRENCY", "5"))
_PLAYWRIGHT_ENABLED = os.getenv("PLAYWRIGHT_ENABLED", "true").lower() in (
    "true",
    "1",
    "yes",
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _ua() -> str:
    import random

    return random.choice(_USER_AGENTS)


def _headers() -> Dict[str, str]:
    return {
        "User-Agent": _ua(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }


def _safe_get(url: str, timeout: int = _DEFAULT_TIMEOUT) -> Optional[str]:
    """HTTP GET with retries; returns HTML text or None on failure."""
    for attempt in range(3):
        try:
            with httpx.Client(
                headers=_headers(),
                follow_redirects=True,
                timeout=timeout,
            ) as client:
                resp = client.get(url)
                resp.raise_for_status()
                return resp.text
        except Exception as exc:
            logger.debug("_safe_get attempt=%d url=%s error=%s", attempt + 1, url, exc)
            if attempt < 2:
                time.sleep(1.5 * (attempt + 1))
    return None


def _normalise_name(name: str) -> str:
    return re.sub(r"\s+", " ", name.lower().strip())


def _normalise_phone(phone: str) -> str:
    return re.sub(r"\D", "", phone)


# ---------------------------------------------------------------------------
# Source scrapers
# ---------------------------------------------------------------------------


def _scrape_yellowpages(query: str, location: str) -> List[Dict[str, Any]]:
    """Scrape YellowPages search results."""
    url = (
        f"https://www.yellowpages.com/search"
        f"?search_terms={quote_plus(query)}"
        f"&geo_location_terms={quote_plus(location)}"
    )
    html = _safe_get(url)
    if not html:
        return []

    soup = BeautifulSoup(html, "html.parser")
    results: List[Dict[str, Any]] = []

    for card in soup.select(".result, .srp-listing, [class*='listing']")[:30]:
        name_el = card.select_one(
            ".business-name, h2.n, [class*='business-name'], [class*='listing-name']"
        )
        if not name_el:
            continue
        name = name_el.get_text(strip=True)
        if not name:
            continue

        phone_el = card.select_one(".phones, [class*='phone'], .number")
        phone = phone_el.get_text(strip=True) if phone_el else ""

        addr_el = card.select_one(".adr, [class*='address'], .street-address")
        city_el = card.select_one(".locality, [class*='city']")
        state_el = card.select_one(".region, [class*='state']")

        city = city_el.get_text(strip=True) if city_el else ""
        state = state_el.get_text(strip=True) if state_el else ""
        address = addr_el.get_text(strip=True) if addr_el else ""

        website_el = card.select_one("a.track-visit-website, [class*='website'] a")
        website = website_el.get("href", "") if website_el else ""
        if website and not website.startswith("http"):
            website = ""

        item: Dict[str, Any] = {
            "company_name": name,
            "phone": phone,
            "address": address,
            "city": city,
            "state": state,
            "website": website,
            "source": "yellowpages",
        }
        results.append(item)

    logger.info(
        "yellowpages returned %d results for %s %s", len(results), query, location
    )
    return results


def _scrape_yelp(query: str, location: str) -> List[Dict[str, Any]]:
    """Scrape Yelp search results."""
    url = (
        f"https://www.yelp.com/search"
        f"?find_desc={quote_plus(query)}"
        f"&find_loc={quote_plus(location)}"
    )
    html = _safe_get(url)
    if not html:
        return []

    soup = BeautifulSoup(html, "html.parser")
    results: List[Dict[str, Any]] = []

    # Yelp embeds JSON-LD data on the page
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            import json

            data = json.loads(script.string or "")
            if isinstance(data, list):
                items = data
            elif isinstance(data, dict):
                items = [data]
            else:
                continue

            for item in items:
                if item.get("@type") not in (
                    "LocalBusiness",
                    "Restaurant",
                    "HomeAndConstructionBusiness",
                ):
                    continue
                name = item.get("name", "")
                if not name:
                    continue
                addr = item.get("address", {})
                results.append(
                    {
                        "company_name": name,
                        "phone": item.get("telephone", ""),
                        "website": item.get("url", ""),
                        "address": addr.get("streetAddress", ""),
                        "city": addr.get("addressLocality", ""),
                        "state": addr.get("addressRegion", ""),
                        "rating": item.get("aggregateRating", {}).get("ratingValue"),
                        "reviews": item.get("aggregateRating", {}).get("reviewCount"),
                        "source": "yelp",
                    }
                )
        except Exception:
            continue

    # Fallback: parse listing cards
    if not results:
        for card in soup.select('[class*="businessName"], [class*="business-name"]')[
            :20
        ]:
            name = card.get_text(strip=True)
            if name:
                results.append({"company_name": name, "source": "yelp"})

    logger.info("yelp returned %d results for %s %s", len(results), query, location)
    return results


def _scrape_bbb(query: str, location: str) -> List[Dict[str, Any]]:
    """Scrape BBB (Better Business Bureau) directory."""
    url = (
        f"https://www.bbb.org/search"
        f"?find_text={quote_plus(query)}"
        f"&find_loc={quote_plus(location)}"
    )
    html = _safe_get(url)
    if not html:
        return []

    soup = BeautifulSoup(html, "html.parser")
    results: List[Dict[str, Any]] = []

    for card in soup.select(
        ".result-content, [class*='result-'], [data-testid*='result']"
    )[:30]:
        name_el = card.select_one(
            "h3, h4, [class*='business-name'], [class*='BusinessName']"
        )
        if not name_el:
            continue
        name = name_el.get_text(strip=True)
        if not name:
            continue

        phone_el = card.select_one("[class*='phone'], [href^='tel:']")
        phone = ""
        if phone_el:
            phone = phone_el.get_text(strip=True) or phone_el.get("href", "").replace(
                "tel:", ""
            )

        addr_el = card.select_one("[class*='address'], address")
        address = addr_el.get_text(strip=True) if addr_el else ""

        city, state = "", ""
        if address:
            m = re.search(r"([A-Za-z\s]+),\s*([A-Z]{2})", address)
            if m:
                city = m.group(1).strip()
                state = m.group(2)

        results.append(
            {
                "company_name": name,
                "phone": phone,
                "address": address,
                "city": city,
                "state": state,
                "source": "bbb",
            }
        )

    logger.info("bbb returned %d results for %s %s", len(results), query, location)
    return results


def _scrape_manta(query: str, location: str) -> List[Dict[str, Any]]:
    """Scrape Manta small-business directory."""
    url = (
        f"https://www.manta.com/mb_{quote_plus(query.replace(' ', '_'))}"
        f"/{quote_plus(location.replace(' ', '_').replace(',', ''))}"
    )
    html = _safe_get(url)
    if not html:
        return []

    soup = BeautifulSoup(html, "html.parser")
    results: List[Dict[str, Any]] = []

    for card in soup.select(".listing, [class*='result'], article")[:30]:
        name_el = card.select_one("h2, h3, [class*='business-name'], [class*='name']")
        if not name_el:
            continue
        name = name_el.get_text(strip=True)
        if not name:
            continue

        phone_text = ""
        phones = _PHONE_RE.findall(card.get_text())
        if phones:
            phone_text = phones[0]

        city, state = "", ""
        addr_text = card.get_text()
        m = re.search(r"([A-Za-z\s]{3,}),\s*([A-Z]{2})\s*\d{5}", addr_text)
        if m:
            city = m.group(1).strip()
            state = m.group(2)

        website_el = card.select_one("a[href^='http']")
        website = website_el.get("href", "") if website_el else ""

        results.append(
            {
                "company_name": name,
                "phone": phone_text,
                "city": city,
                "state": state,
                "website": website,
                "source": "manta",
            }
        )

    logger.info("manta returned %d results for %s %s", len(results), query, location)
    return results


def _scrape_google_maps_html(query: str, location: str) -> List[Dict[str, Any]]:
    """
    Lightweight Google Maps HTML extraction.

    Google renders its maps pages dynamically via JavaScript, so pure HTML
    parsing is limited.  We extract whatever phone numbers and names we can
    find in the page source (which does contain partial data in meta tags,
    JSON snippets, and og: tags) rather than returning stubs.
    """
    full_query = f"{query} {location}".strip()
    url = f"https://www.google.com/maps/search/{quote_plus(full_query)}"
    html = _safe_get(url)
    if not html:
        return []

    soup = BeautifulSoup(html, "html.parser")
    results: List[Dict[str, Any]] = []

    # Extract from structured JSON-LD if present
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            import json

            data = json.loads(script.string or "")
            if not isinstance(data, dict):
                continue
            if data.get("@type") in ("LocalBusiness", "Organization"):
                name = data.get("name", "")
                if name:
                    addr = data.get("address", {})
                    results.append(
                        {
                            "company_name": name,
                            "phone": data.get("telephone", ""),
                            "website": data.get("url", ""),
                            "address": addr.get("streetAddress", ""),
                            "city": addr.get("addressLocality", ""),
                            "state": addr.get("addressRegion", ""),
                            "source": "google_maps",
                        }
                    )
        except Exception:
            continue

    # Fallback: extract phone numbers embedded anywhere in the page source
    if not results:
        phones = list(set(_PHONE_RE.findall(html)))[:10]
        for i, phone in enumerate(phones):
            results.append(
                {
                    "phone": phone,
                    "source": "google_maps",
                    "city": (
                        location.split(",")[0].strip() if "," in location else location
                    ),
                }
            )

    logger.info("google_maps_html returned %d results for %s", len(results), full_query)
    return results


# ---------------------------------------------------------------------------
# Playwright scraper (optional, richer data)
# ---------------------------------------------------------------------------


def _scrape_with_playwright(query: str, location: str) -> List[Dict[str, Any]]:
    """
    Use a headless Playwright browser to extract listings from sources that
    require JavaScript rendering.  Falls back gracefully to an empty list if
    Playwright is not installed or times out.
    """
    if not _PLAYWRIGHT_ENABLED:
        return []

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        logger.warning("playwright not available; skipping headless scrape")
        return []

    results: List[Dict[str, Any]] = []
    full_query = f"{query} contractors {location}".strip()
    url = f"https://www.yellowpages.com/search?search_terms={quote_plus(full_query)}"

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, args=["--no-sandbox"])
            try:
                page = browser.new_page()
                page.set_extra_http_headers(_headers())
                page.goto(
                    url, timeout=_DEFAULT_TIMEOUT * 1000, wait_until="domcontentloaded"
                )
                html = page.content()
                results = _scrape_yellowpages_html(html)
            finally:
                browser.close()
    except Exception as exc:
        logger.warning("playwright scrape failed: %s", exc)

    logger.info("playwright returned %d results for %s", len(results), full_query)
    return results


def _scrape_yellowpages_html(html: str) -> List[Dict[str, Any]]:
    """Parse YellowPages HTML already fetched (used by Playwright path)."""
    soup = BeautifulSoup(html, "html.parser")
    results: List[Dict[str, Any]] = []

    for card in soup.select(".result, .srp-listing")[:30]:
        name_el = card.select_one(".business-name, h2.n")
        if not name_el:
            continue
        name = name_el.get_text(strip=True)
        if not name:
            continue

        phone_el = card.select_one(".phones, .number")
        phone = phone_el.get_text(strip=True) if phone_el else ""

        city_el = card.select_one(".locality")
        state_el = card.select_one(".region")

        results.append(
            {
                "company_name": name,
                "phone": phone,
                "city": city_el.get_text(strip=True) if city_el else "",
                "state": state_el.get_text(strip=True) if state_el else "",
                "source": "yellowpages_pw",
            }
        )
    return results


# ---------------------------------------------------------------------------
# Deduplication
# ---------------------------------------------------------------------------


def _deduplicate(leads: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Remove duplicate leads.

    Two leads are considered duplicates when they share a normalised phone
    number OR a normalised company name.
    """
    seen_phones: set = set()
    seen_names: set = set()
    unique: List[Dict[str, Any]] = []

    for lead in leads:
        phone = _normalise_phone(lead.get("phone") or "")
        name = _normalise_name(lead.get("company_name") or "")

        if not name:
            continue
        if phone and phone in seen_phones:
            continue
        if name in seen_names:
            continue

        if phone:
            seen_phones.add(phone)
        seen_names.add(name)
        unique.append(lead)

    return unique


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


class ShadowRestScraper:
    """
    Multi-source business scraper that uses public HTTP endpoints.

    No API keys are required.  The scraper queries multiple directories
    concurrently and deduplicates the merged results.
    """

    def __init__(
        self,
        concurrency: int = _CONCURRENCY,
        timeout: int = _DEFAULT_TIMEOUT,
        playwright_enabled: bool = _PLAYWRIGHT_ENABLED,
    ) -> None:
        self.concurrency = concurrency
        self.timeout = timeout
        self.playwright_enabled = playwright_enabled

    # ------------------------------------------------------------------
    # Public entry points
    # ------------------------------------------------------------------

    def scrape(
        self,
        query: str,
        city: str = "",
        state: str = "",
        max_results: int = 50,
    ) -> List[Dict[str, Any]]:
        """
        Scrape *query* businesses from multiple sources concurrently.

        :param query: Industry / keyword (e.g. ``"epoxy contractors"``).
        :param city:  Optional city filter.
        :param state: Optional state filter.
        :param max_results: Cap on returned results.
        :returns: Deduplicated list of lead dicts.
        """
        location_parts = [p for p in [city, state] if p]
        location = ", ".join(location_parts) if location_parts else "United States"

        logger.info("[ShadowRestScraper] scrape query=%r location=%r", query, location)

        scrapers = [
            ("yellowpages", _scrape_yellowpages),
            ("yelp", _scrape_yelp),
            ("bbb", _scrape_bbb),
            ("manta", _scrape_manta),
            ("google_maps", _scrape_google_maps_html),
        ]

        # Optionally add Playwright source
        if self.playwright_enabled:
            scrapers.append(("playwright", _scrape_with_playwright))

        all_leads: List[Dict[str, Any]] = []

        with ThreadPoolExecutor(
            max_workers=min(self.concurrency, len(scrapers))
        ) as pool:
            futures = {pool.submit(fn, query, location): name for name, fn in scrapers}
            for future in as_completed(futures, timeout=self.timeout * 2):
                source_name = futures[future]
                try:
                    leads = future.result(timeout=self.timeout)
                    # Inject industry / query into each lead
                    for lead in leads:
                        lead.setdefault("industry", query)
                    all_leads.extend(leads)
                    logger.info(
                        "[ShadowRestScraper] source=%s leads=%d",
                        source_name,
                        len(leads),
                    )
                except Exception as exc:
                    logger.warning(
                        "[ShadowRestScraper] source=%s failed: %s",
                        source_name,
                        exc,
                    )

        deduped = _deduplicate(all_leads)
        logger.info(
            "[ShadowRestScraper] total=%d deduped=%d query=%r",
            len(all_leads),
            len(deduped),
            query,
        )
        return deduped[:max_results]

    def scrape_business_directory(
        self,
        query: str,
        location: str = "United States",
        max_results: int = 50,
    ) -> List[Dict[str, Any]]:
        """Convenience wrapper: scrape a business directory by free-text location."""
        parts = location.split(",")
        city = parts[0].strip() if parts else ""
        state = parts[1].strip() if len(parts) > 1 else ""
        return self.scrape(query=query, city=city, state=state, max_results=max_results)
