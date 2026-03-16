"""
agents/tools/scraper.py
=======================
Playwright-based Google Maps scraper tool for the AI agent pipeline.

Returns structured lead data: company name, website, phone, rating, address.
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


async def scrape_google_maps(keyword: str, city: str, state: str = "") -> list[dict[str, Any]]:
    """
    Search Google Maps for businesses matching *keyword* in *city* / *state*.

    Returns a list of lead dicts with fields:
        company_name, phone, website, rating, review_count, address, city, state, industry
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.error("playwright not installed — run: pip install playwright && playwright install")
        return []

    query = f"{keyword} in {city} {state}".strip()
    logger.info("Scraping Google Maps for: %s", query)
    leads: list[dict[str, Any]] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=["--no-sandbox"])
        try:
            page = await browser.new_page()
            await page.set_extra_http_headers({"Accept-Language": "en-US,en;q=0.9"})

            search_url = (
                "https://www.google.com/maps/search/"
                + query.replace(" ", "+")
            )
            await page.goto(search_url, wait_until="networkidle", timeout=30_000)

            # Scroll to load more results
            feed_sel = 'div[role="feed"]'
            for _ in range(5):
                try:
                    await page.evaluate(
                        f'document.querySelector("{feed_sel}")?.scrollBy(0, 800)'
                    )
                    await asyncio.sleep(1)
                except Exception:
                    break

            # Extract listings
            cards = await page.query_selector_all("div.Nv2PK")
            logger.info("Found %d listing cards", len(cards))

            for card in cards[:50]:
                try:
                    lead = await _parse_card(card)
                    if lead:
                        lead["city"] = city
                        lead["state"] = state
                        lead["industry"] = keyword
                        leads.append(lead)
                except Exception as exc:
                    logger.debug("Card parse error: %s", exc)
        finally:
            await browser.close()

    logger.info("Scraped %d leads for '%s'", len(leads), query)
    return leads


async def _parse_card(card: Any) -> dict[str, Any] | None:
    """Extract fields from a single Google Maps listing card."""
    name_el = await card.query_selector("div.qBF1Pd")
    if not name_el:
        return None
    name = (await name_el.inner_text()).strip()
    if not name:
        return None

    rating: float | None = None
    review_count: int | None = None
    rating_el = await card.query_selector("span.MW4etd")
    if rating_el:
        try:
            rating = float((await rating_el.inner_text()).strip())
        except ValueError:
            pass
    review_el = await card.query_selector("span.UY7F9")
    if review_el:
        text = re.sub(r"[^\d]", "", await review_el.inner_text())
        review_count = int(text) if text else None

    phone: str | None = None
    website: str | None = None
    address: str | None = None

    meta_els = await card.query_selector_all("div.W4Efsd > div > span")
    for el in meta_els:
        text = (await el.inner_text()).strip()
        if re.match(r"^\+?[\d\s()\-]{7,}$", text):
            phone = text
        elif text.startswith("http") or "." in text and "/" not in text:
            website = text
        elif text and not address:
            address = text

    return {
        "company_name": name,
        "phone": phone,
        "website": website,
        "rating": rating,
        "review_count": review_count,
        "address": address,
    }


def run_scrape(keyword: str, city: str, state: str = "") -> list[dict[str, Any]]:
    """Synchronous wrapper for use in non-async contexts."""
    return asyncio.run(scrape_google_maps(keyword, city, state))
