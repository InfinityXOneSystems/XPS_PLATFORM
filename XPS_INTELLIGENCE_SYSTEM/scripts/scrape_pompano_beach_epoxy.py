#!/usr/bin/env python3
"""
scripts/scrape_pompano_beach_epoxy.py
======================================
Real Playwright scraper for epoxy floor contractors in Pompano Beach, FL.

Searches Google Maps for "epoxy floor contractors Pompano Beach FL" and
collects comprehensive business data:
  - Company name
  - Phone number
  - Website
  - Address
  - Rating
  - Review count
  - Business category
  - Lead score

Results are saved to:
  - leads/pompano_beach_epoxy.json
  - leads/leads.json  (merged)
"""

import asyncio
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
LEADS_DIR = REPO_ROOT / "leads"
OUTPUT_FILE = LEADS_DIR / "pompano_beach_epoxy.json"
LEADS_FILE = LEADS_DIR / "leads.json"


def score_lead(lead: dict) -> int:
    """Compute a lead quality score (0-100)."""
    score = 0
    if lead.get("phone"):
        score += 10
    if lead.get("website"):
        score += 10
    if lead.get("email"):
        score += 15
    if lead.get("address"):
        score += 5
    rating = lead.get("rating", 0)
    if rating and rating >= 4.0:
        score += 10
    reviews = lead.get("reviews", 0)
    if reviews and reviews >= 10:
        score += 5
    if reviews and reviews >= 50:
        score += 5
    if lead.get("city") and lead.get("state"):
        score += 10
    # Industry match
    keywords = ["epoxy", "floor", "coating", "concrete", "garage"]
    text = " ".join([
        str(lead.get("company_name", "")),
        str(lead.get("category", "")),
    ]).lower()
    if any(k in text for k in keywords):
        score += 20
    return min(score, 100)


async def scrape_google_maps(query: str, max_results: int = 20) -> list:
    """Scrape Google Maps for business listings."""
    from playwright.async_api import async_playwright

    leads = []
    print(f"🔍 Searching Google Maps: '{query}'")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 900},
        )
        page = await context.new_page()

        try:
            # Navigate to Google Maps search
            search_url = f"https://www.google.com/maps/search/{query.replace(' ', '+')}"
            print(f"  Navigating to: {search_url}")
            await page.goto(search_url, timeout=30000, wait_until="domcontentloaded")
            await page.wait_for_timeout(3000)

            # Scroll to load more results
            results_container = None
            for selector in ["div[role='feed']", ".m6QErb[aria-label]", "div[aria-label*='Results']"]:
                try:
                    results_container = await page.query_selector(selector)
                    if results_container:
                        break
                except Exception:
                    pass

            if results_container:
                print(f"  Found results container, scrolling to load listings…")
                for _ in range(5):
                    await page.evaluate("arguments[0].scrollTop += 1000", results_container)
                    await page.wait_for_timeout(1200)
            else:
                # Fallback: scroll the page
                for _ in range(4):
                    await page.keyboard.press("End")
                    await page.wait_for_timeout(1000)

            # Extract all listing links
            listing_links = await page.query_selector_all("a[href*='/maps/place/']")
            unique_urls = []
            seen = set()
            for link in listing_links:
                href = await link.get_attribute("href")
                if href and href not in seen and "/maps/place/" in href:
                    seen.add(href)
                    unique_urls.append(href)
                    if len(unique_urls) >= max_results:
                        break

            print(f"  Found {len(unique_urls)} listing URLs")

            # Visit each listing and extract data
            for i, url in enumerate(unique_urls[:max_results]):
                lead = await extract_listing_data(page, url, i + 1)
                if lead:
                    lead["lead_score"] = score_lead(lead)
                    leads.append(lead)
                    print(f"  [{i+1}/{len(unique_urls)}] ✅ {lead.get('company_name', 'Unknown')}")
                await page.wait_for_timeout(800)

        except Exception as e:
            print(f"  ⚠️  Scrape error: {e}")
            # Return whatever we have so far plus generate mock data if nothing found
        finally:
            await browser.close()

    # If real scraping got 0 results, fall back to the universal shadow scraper
    if not leads:
        print("  ⚠️  No Playwright results — falling back to universal_shadow_scraper.py")
        import subprocess, sys
        result = subprocess.run(
            [sys.executable, "scripts/universal_shadow_scraper.py",
             "--keywords", "epoxy flooring contractor,garage epoxy installer",
             "--locations", "Pompano Beach, FL",
             "--max-per-keyword", "20"],
            cwd=str(REPO_ROOT)
        )
        if result.returncode != 0:
            print(f"  ❌  universal_shadow_scraper.py failed (exit {result.returncode}) — no leads available")
            return []
        # Load whatever the universal scraper wrote
        scored_path = REPO_ROOT / "leads" / "scored_leads.json"
        if scored_path.exists():
            import json as _json
            all_leads = _json.loads(scored_path.read_text())
            leads = [l for l in all_leads if l.get("city","").lower() == "pompano beach"][:20]

    return leads


async def extract_listing_data(page, url: str, idx: int) -> dict | None:
    """Navigate to a listing and extract business data."""
    try:
        await page.goto(url, timeout=20000, wait_until="domcontentloaded")
        await page.wait_for_timeout(2000)

        lead = {
            "source": "google_maps",
            "city": "Pompano Beach",
            "state": "FL",
            "scraped_at": datetime.utcnow().isoformat(),
        }

        # Company name
        for sel in ["h1.DUwDvf", "h1[class*='fontHeadlineLarge']", "h1", "[data-attrid='title']"]:
            el = await page.query_selector(sel)
            if el:
                name = (await el.inner_text()).strip()
                if name:
                    lead["company_name"] = name
                    break

        # Rating
        for sel in ["span.ceNzKf", "div.F7nice span[aria-hidden='true']", "span[aria-label*='stars']"]:
            el = await page.query_selector(sel)
            if el:
                txt = await el.inner_text()
                m = re.search(r"([\d.]+)", txt)
                if m:
                    lead["rating"] = float(m.group(1))
                    break

        # Review count
        for sel in ["button[aria-label*='reviews']", "span.UY7F9", "span[aria-label*='reviews']"]:
            el = await page.query_selector(sel)
            if el:
                txt = await el.inner_text()
                m = re.search(r"([\d,]+)", txt)
                if m:
                    lead["reviews"] = int(m.group(1).replace(",", ""))
                    break

        # Phone
        page_text = await page.inner_text("body")
        phone_m = re.search(r"\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}", page_text)
        if phone_m:
            lead["phone"] = phone_m.group(0).strip()

        # Website
        for sel in ["a[data-item-id='authority']", "a[href*='http'][aria-label*='website' i]", "a[data-tooltip*='website' i]"]:
            el = await page.query_selector(sel)
            if el:
                href = await el.get_attribute("href")
                if href and not href.startswith("https://maps"):
                    lead["website"] = href
                    break

        # Address
        for sel in ["button[data-item-id='address']", "div[data-item-id='address']", "[aria-label*='Address']"]:
            el = await page.query_selector(sel)
            if el:
                addr = (await el.inner_text()).strip()
                if addr:
                    lead["address"] = addr
                    break

        # Category
        for sel in ["button.DkEaL", "span.YhemCb", ".lfPIob"]:
            el = await page.query_selector(sel)
            if el:
                cat = (await el.inner_text()).strip()
                if cat:
                    lead["category"] = cat
                    break

        return lead if lead.get("company_name") else None

    except Exception:
        return None


def generate_realistic_leads() -> list:
    """
    Generate realistic mock leads for Pompano Beach FL epoxy contractors.
    Used as fallback when Google Maps is not accessible (e.g. CI environment).
    Data is modelled after real business patterns in the area.
    """
    now = datetime.utcnow().isoformat()
    raw = [
        {
            "company_name": "South Florida Epoxy Pros",
            "phone": "(954) 781-2200",
            "website": "https://www.sfepoxypros.com",
            "email": "info@sfepoxypros.com",
            "address": "1450 NE 48th St, Pompano Beach, FL 33064",
            "city": "Pompano Beach",
            "state": "FL",
            "rating": 4.8,
            "reviews": 127,
            "category": "Epoxy Floor Coating",
            "source": "google_maps",
            "scraped_at": now,
        },
        {
            "company_name": "Broward Epoxy & Concrete",
            "phone": "(954) 942-5530",
            "website": "https://www.browardepoxy.com",
            "email": "contact@browardepoxy.com",
            "address": "2201 W Copans Rd, Pompano Beach, FL 33069",
            "city": "Pompano Beach",
            "state": "FL",
            "rating": 4.6,
            "reviews": 89,
            "category": "Epoxy Floor Installer",
            "source": "google_maps",
            "scraped_at": now,
        },
        {
            "company_name": "Prestige Garage Floors FL",
            "phone": "(954) 509-1122",
            "website": "https://www.prestigegaragefl.com",
            "email": "sales@prestigegaragefl.com",
            "address": "500 NW 12th Ave, Pompano Beach, FL 33069",
            "city": "Pompano Beach",
            "state": "FL",
            "rating": 4.9,
            "reviews": 204,
            "category": "Garage Floor Epoxy",
            "source": "google_maps",
            "scraped_at": now,
        },
        {
            "company_name": "Coastal Floor Solutions",
            "phone": "(954) 788-4400",
            "website": "https://www.coastalfloorsfl.com",
            "email": "",
            "address": "3300 N Andrews Ave, Pompano Beach, FL 33064",
            "city": "Pompano Beach",
            "state": "FL",
            "rating": 4.3,
            "reviews": 45,
            "category": "Flooring Contractor",
            "source": "google_maps",
            "scraped_at": now,
        },
        {
            "company_name": "XPS Concrete Coatings",
            "phone": "(954) 360-0088",
            "website": "https://www.xpscoatings.com",
            "email": "xpscoatings@gmail.com",
            "address": "1100 SW 10th St, Pompano Beach, FL 33060",
            "city": "Pompano Beach",
            "state": "FL",
            "rating": 4.7,
            "reviews": 76,
            "category": "Epoxy Floor Coating",
            "source": "google_maps",
            "scraped_at": now,
        },
        {
            "company_name": "Sunshine State Epoxy",
            "phone": "(954) 243-7761",
            "website": "https://www.sunshineepoxy.com",
            "email": "info@sunshineepoxy.com",
            "address": "601 E Sample Rd, Pompano Beach, FL 33064",
            "city": "Pompano Beach",
            "state": "FL",
            "rating": 4.5,
            "reviews": 61,
            "category": "Epoxy Floor Installer",
            "source": "google_maps",
            "scraped_at": now,
        },
        {
            "company_name": "Elite Garage Coatings",
            "phone": "(954) 831-6650",
            "website": "",
            "email": "",
            "address": "2850 N Federal Hwy, Pompano Beach, FL 33064",
            "city": "Pompano Beach",
            "state": "FL",
            "rating": 4.2,
            "reviews": 18,
            "category": "Epoxy Floor Coating",
            "source": "google_maps",
            "scraped_at": now,
        },
        {
            "company_name": "Tri-County Floor Masters",
            "phone": "(954) 977-3300",
            "website": "https://www.tcfloormasters.com",
            "email": "service@tcfloormasters.com",
            "address": "4100 NW 1st Ave, Pompano Beach, FL 33064",
            "city": "Pompano Beach",
            "state": "FL",
            "rating": 4.6,
            "reviews": 112,
            "category": "Concrete Coating",
            "source": "google_maps",
            "scraped_at": now,
        },
        {
            "company_name": "Premium Epoxy Floors Inc",
            "phone": "(954) 425-1515",
            "website": "https://www.premiumepoxyfloorsfl.com",
            "email": "quote@premiumepoxy.com",
            "address": "801 NE 3rd St, Pompano Beach, FL 33060",
            "city": "Pompano Beach",
            "state": "FL",
            "rating": 4.9,
            "reviews": 183,
            "category": "Epoxy Floor Installer",
            "source": "google_maps",
            "scraped_at": now,
        },
        {
            "company_name": "FloorShine Epoxy & Polish",
            "phone": "(954) 699-5500",
            "website": "https://www.floorshinepb.com",
            "email": "",
            "address": "1201 W Cypress Creek Rd, Pompano Beach, FL 33069",
            "city": "Pompano Beach",
            "state": "FL",
            "rating": 4.4,
            "reviews": 33,
            "category": "Floor Polishing & Epoxy",
            "source": "google_maps",
            "scraped_at": now,
        },
        {
            "company_name": "Metallic Epoxy Masters",
            "phone": "(954) 344-8877",
            "website": "https://www.metallicepoxymasters.com",
            "email": "art@metallicepoxymasters.com",
            "address": "700 SW 12th Ave, Pompano Beach, FL 33069",
            "city": "Pompano Beach",
            "state": "FL",
            "rating": 5.0,
            "reviews": 52,
            "category": "Decorative Epoxy Floors",
            "source": "google_maps",
            "scraped_at": now,
        },
        {
            "company_name": "Pompano Garage & Floor Co",
            "phone": "(954) 586-9900",
            "website": "https://www.pompanogaragefloors.com",
            "email": "info@pompanogaragefloors.com",
            "address": "3505 N Dixie Hwy, Pompano Beach, FL 33064",
            "city": "Pompano Beach",
            "state": "FL",
            "rating": 4.1,
            "reviews": 27,
            "category": "Garage Floor Epoxy",
            "source": "google_maps",
            "scraped_at": now,
        },
    ]

    for lead in raw:
        lead["lead_score"] = score_lead(lead)
    return raw


def merge_into_leads(new_leads: list) -> None:
    """Merge new leads into the main leads.json file."""
    LEADS_DIR.mkdir(parents=True, exist_ok=True)

    existing = []
    if LEADS_FILE.exists():
        try:
            with open(LEADS_FILE) as f:
                existing = json.load(f)
        except Exception:
            existing = []

    existing_names = {(l.get("company_name", "").lower(), l.get("city", "").lower()) for l in existing}
    added = 0
    for lead in new_leads:
        key = (lead.get("company_name", "").lower(), lead.get("city", "").lower())
        if key not in existing_names:
            existing.append(lead)
            existing_names.add(key)
            added += 1

    with open(LEADS_FILE, "w") as f:
        json.dump(existing, f, indent=2)

    print(f"  → Merged {added} new leads into {LEADS_FILE}")


async def main():
    query = "epoxy floor contractors Pompano Beach FL"

    print("=" * 60)
    print("XPS Intelligence — Pompano Beach Epoxy Scraper")
    print("=" * 60)
    print(f"Query: {query}")
    print(f"Time:  {datetime.utcnow().isoformat()}Z")
    print()

    leads = await scrape_google_maps(query, max_results=15)

    if not leads:
        print("❌ No leads found")
        sys.exit(1)

    # Save to dedicated file
    LEADS_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(leads, f, indent=2)

    print(f"\n✅ Saved {len(leads)} leads to {OUTPUT_FILE}")

    # Merge into main leads file
    merge_into_leads(leads)

    # Print summary table
    print("\n" + "=" * 60)
    print(f"{'#':<4} {'Company':<35} {'Phone':<16} {'Rating':<7} {'Score'}")
    print("-" * 80)
    for i, lead in enumerate(sorted(leads, key=lambda x: x.get("lead_score", 0), reverse=True), 1):
        name = (lead.get("company_name") or "Unknown")[:34]
        phone = (lead.get("phone") or "—")[:15]
        rating = lead.get("rating", "—")
        score = lead.get("lead_score", 0)
        print(f"{i:<4} {name:<35} {phone:<16} {str(rating):<7} {score}")

    print("=" * 60)
    print(f"\nTotal leads scraped: {len(leads)}")
    hot = sum(1 for l in leads if l.get("lead_score", 0) >= 75)
    warm = sum(1 for l in leads if 50 <= l.get("lead_score", 0) < 75)
    cold = sum(1 for l in leads if l.get("lead_score", 0) < 50)
    print(f"HOT (≥75):  {hot}")
    print(f"WARM (50-74): {warm}")
    print(f"COLD (<50): {cold}")

    return leads


if __name__ == "__main__":
    asyncio.run(main())
