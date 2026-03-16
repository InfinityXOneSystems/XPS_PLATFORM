#!/usr/bin/env python3
"""
scripts/scrape_port_st_lucie.py
================================
Port St Lucie, FL — Real Lead Scraper

Uses the ShadowRestScraper (multi-source HTTP scraper: YellowPages, Yelp,
BBB, Manta, Google Maps HTML) to collect real contractor leads from
Port St Lucie, Florida.

No API keys required.  Writes results to:
  leads/port_st_lucie_leads.json   — PSL-specific batch file
  leads/scored_leads.json          — merged into the full pipeline
  pages/data/scored_leads.json     — GitHub Pages dashboard
  data/leads/scored_leads.json     — legacy fallback
  leads/leads.json                 — raw leads store
  data/leads/leads.json            — legacy raw leads

Usage:
    python scripts/scrape_port_st_lucie.py
    python scripts/scrape_port_st_lucie.py --dry-run     # scrape but don't write
    python scripts/scrape_port_st_lucie.py --keywords "epoxy,tile"
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
log = logging.getLogger("scrape_psl")

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_PATH = REPO_ROOT / "backend"

# Ensure backend is importable
if str(BACKEND_PATH) not in sys.path:
    sys.path.insert(0, str(BACKEND_PATH))

# ─────────────────────────────────────────────────────────────────────────────
# Targets
# ─────────────────────────────────────────────────────────────────────────────

DEFAULT_KEYWORDS = [
    "flooring contractors",
    "epoxy flooring",
    "tile installation",
    "hardwood floor installation",
    "carpet installation",
    "concrete polishing",
    "floor refinishing",
    "vinyl flooring installation",
    "general contractors",
]

CITY = "Port St Lucie"
STATE = "FL"

# ─────────────────────────────────────────────────────────────────────────────
# Normalisation helpers
# ─────────────────────────────────────────────────────────────────────────────

_LEADING_NUM_RE = re.compile(r"^\d+\.\s*")
_CITY_STATE_ZIP_RE = re.compile(r"^(.+?),\s*([A-Z]{2})\s*\d{5}")


def _clean_name(name: str) -> str:
    return _LEADING_NUM_RE.sub("", name).strip()


def _parse_city_state(address: str, city_raw: str, state_raw: str):
    """Extract canonical city + state."""
    if city_raw:
        m = _CITY_STATE_ZIP_RE.match(city_raw.strip())
        if m:
            return m.group(1).strip(), m.group(2)
    if address:
        m = re.search(r"([A-Za-z\s\.]+),\s*([A-Z]{2})\s*\d{5}", address)
        if m:
            return m.group(1).strip(), m.group(2)
    city = city_raw.split(",")[0].strip() if city_raw else CITY
    state = state_raw.strip() if state_raw else STATE
    return city, state


def _score_lead(lead: dict) -> int:
    score = 0
    if lead.get("website"):   score += 15
    if lead.get("phone"):     score += 10
    if lead.get("email"):     score += 15
    if lead.get("address"):   score += 5
    if float(lead.get("rating") or 0) >= 4.0:
        score += 10
    if int(lead.get("reviews") or 0) >= 10:
        score += 5
    if lead.get("city") and lead.get("state"):
        score += 10
    kw = (lead.get("industry") or lead.get("keyword") or "").lower()
    if any(x in kw for x in ("floor", "tile", "epoxy", "hardwood", "carpet",
                              "concrete", "polish", "vinyl", "laminate")):
        score += 20
    elif any(x in kw for x in ("general", "contract", "construct", "handyman")):
        score += 10
    return min(score, 100)


_AREA_CITIES = frozenset([
    "port st lucie", "port saint lucie", "psl",
    "stuart", "palm city", "jensen beach", "fort pierce",
    "hobe sound", "jupiter", "vero beach",
])


def _normalise_leads(raw_leads: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert raw scraper output to canonical schema; dedup by company+city."""
    today = time.strftime("%Y-%m-%d")
    seen_phones: set = set()
    seen_names: set = set()
    out: List[Dict[str, Any]] = []

    for r in raw_leads:
        raw_name = _clean_name(r.get("company_name") or "")
        if not raw_name:
            continue

        norm_name = re.sub(r"\s+", " ", raw_name.lower().strip())
        if norm_name in seen_names:
            continue

        raw_phone = r.get("phone", "")
        norm_phone = re.sub(r"\D", "", raw_phone)
        if norm_phone and norm_phone in seen_phones:
            continue

        city, state = _parse_city_state(
            r.get("address", ""),
            r.get("city", ""),
            r.get("state", ""),
        )

        # Keep only Treasure Coast / PSL-area leads
        city_norm = city.lower()
        phone_is_area = norm_phone.startswith("772") or norm_phone.startswith("1772")
        city_is_area = city_norm in _AREA_CITIES
        if not (phone_is_area or city_is_area):
            continue

        seen_names.add(norm_name)
        if norm_phone:
            seen_phones.add(norm_phone)

        website = (r.get("website") or "").strip()
        if website and not website.startswith(("http://", "https://")):
            website = "https://" + website

        lead: Dict[str, Any] = {
            "company": raw_name,
            "phone": raw_phone,
            "email": "",
            "website": website,
            "address": (r.get("address") or "").strip(),
            "city": city,
            "state": state,
            "country": "USA",
            "industry": (r.get("industry") or "flooring contractors").strip(),
            "category": (r.get("industry") or "flooring contractors").strip(),
            "rating": float(r.get("rating") or 0),
            "reviews": int(r.get("reviews") or 0),
            "source": r.get("source", "shadow_scraper"),
            "scrapedAt": today,
        }
        lead["lead_score"] = _score_lead(lead)
        lead["tier"] = (
            "HOT" if lead["lead_score"] >= 75
            else "WARM" if lead["lead_score"] >= 50
            else "COLD"
        )
        out.append(lead)

    out.sort(key=lambda l: l["lead_score"], reverse=True)
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Main scrape function
# ─────────────────────────────────────────────────────────────────────────────

def scrape_port_st_lucie(
    keywords: Optional[List[str]] = None,
    max_per_keyword: int = 25,
    dry_run: bool = False,
) -> List[Dict[str, Any]]:
    """
    Run the ShadowRestScraper against Port St Lucie, FL for each keyword
    and return normalised, deduplicated leads.
    """
    try:
        from app.scrapers.shadow_rest_scraper import ShadowRestScraper
    except ImportError as exc:
        log.error("Cannot import ShadowRestScraper: %s", exc)
        log.error("Make sure backend/ dependencies are installed: pip install httpx beautifulsoup4")
        return []

    keywords = keywords or DEFAULT_KEYWORDS
    scraper = ShadowRestScraper(concurrency=3, playwright_enabled=False)

    all_raw: List[Dict[str, Any]] = []
    for kw in keywords:
        log.info("Scraping: %r in %s, %s …", kw, CITY, STATE)
        try:
            leads = scraper.scrape(
                query=kw,
                city=CITY,
                state=STATE,
                max_results=max_per_keyword,
            )
            log.info("  → %d leads from %r", len(leads), kw)
            all_raw.extend(leads)
            time.sleep(1.0)  # polite rate limiting
        except Exception as exc:
            log.warning("  → FAILED: %s", exc)

    log.info("Total raw scraped: %d", len(all_raw))

    normalised = _normalise_leads(all_raw)
    log.info("Normalised unique PSL leads: %d", len(normalised))

    return normalised


def _merge_into_pipeline(new_leads: List[Dict[str, Any]]) -> int:
    """Merge new leads into the existing pipeline files; returns count added."""
    files_to_merge = [
        REPO_ROOT / "leads" / "scored_leads.json",
        REPO_ROOT / "pages" / "data" / "scored_leads.json",
        REPO_ROOT / "data" / "leads" / "scored_leads.json",
    ]

    # Load existing from primary source
    primary = REPO_ROOT / "leads" / "scored_leads.json"
    existing: List[Dict[str, Any]] = []
    if primary.exists():
        try:
            existing = json.loads(primary.read_text(encoding="utf-8"))
        except Exception as exc:
            log.warning("Could not load %s: %s", primary, exc)

    def _lead_key(l: dict) -> str:
        name = re.sub(r"\s+", " ", (l.get("company") or l.get("company_name") or "").lower().strip())
        city = (l.get("city") or "").lower().strip().split(",")[0]
        return f"{name}|{city}"

    seen = {_lead_key(l) for l in existing}
    added = 0
    for lead in new_leads:
        k = _lead_key(lead)
        if k not in seen:
            seen.add(k)
            existing.append(lead)
            added += 1

    if added == 0:
        log.info("No new leads to add (all already present)")
        return 0

    # Sort by score descending; re-assign IDs
    existing.sort(key=lambda l: l.get("lead_score") or l.get("score") or 0, reverse=True)
    for i, l in enumerate(existing):
        l["id"] = i + 1

    payload = json.dumps(existing, indent=2)
    for dest in files_to_merge:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(payload, encoding="utf-8")
        log.info("Updated %s (%d leads)", dest, len(existing))

    # Also update raw leads.json
    for raw_path in [
        REPO_ROOT / "leads" / "leads.json",
        REPO_ROOT / "data" / "leads" / "leads.json",
    ]:
        if raw_path.exists():
            try:
                raw = json.loads(raw_path.read_text(encoding="utf-8"))
            except Exception:
                raw = []
            raw_keys = {_lead_key(l) for l in raw}
            for lead in new_leads:
                k = _lead_key(lead)
                if k not in raw_keys:
                    raw_keys.add(k)
                    raw_lead = {
                        "company": lead["company"],
                        "phone": lead["phone"],
                        "email": lead["email"],
                        "website": lead["website"],
                        "address": lead["address"],
                        "city": (lead.get("city") or "").split(",")[0].strip(),
                        "state": "FL",
                        "country": "USA",
                        "keyword": lead["industry"],
                        "category": lead["category"],
                        "rating": lead["rating"],
                        "reviews": lead["reviews"],
                        "source": lead["source"],
                        "scrapedAt": lead["scrapedAt"],
                    }
                    raw.append(raw_lead)
            raw_path.write_text(json.dumps(raw, indent=2), encoding="utf-8")
            log.info("Updated raw %s (%d leads)", raw_path, len(raw))

    return added


def _print_summary(leads: List[Dict[str, Any]]) -> None:
    hot  = [l for l in leads if l["tier"] == "HOT"]
    warm = [l for l in leads if l["tier"] == "WARM"]
    cold = [l for l in leads if l["tier"] == "COLD"]

    print(f"\n{'='*60}")
    print(f"  PORT ST LUCIE, FL — REAL SCRAPED LEADS")
    print(f"  Scraped: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}")
    print(f"{'='*60}")
    print(f"  Total leads: {len(leads)}")
    print(f"  HOT  (≥75): {len(hot)}")
    print(f"  WARM (50–74): {len(warm)}")
    print(f"  COLD (<50):  {len(cold)}")
    print(f"{'='*60}\n")

    for i, l in enumerate(leads[:20], 1):
        tier_icon = "🔥" if l["tier"] == "HOT" else "🌡" if l["tier"] == "WARM" else "🧊"
        print(f"  [{i:2d}] {tier_icon} {l['company']}")
        print(f"       Phone:   {l['phone'] or '—'}")
        print(f"       City:    {l['city']}, {l['state']}")
        print(f"       Website: {l['website'] or '—'}")
        print(f"       Source:  {l['source']}  |  Score: {l['lead_score']}")
        print()


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────

def _cli(argv: Optional[list] = None) -> int:
    p = argparse.ArgumentParser(
        description="Scrape real contractor leads from Port St Lucie, FL"
    )
    p.add_argument("--keywords", default="", help="Comma-separated keywords to scrape")
    p.add_argument("--max-per-keyword", type=int, default=25)
    p.add_argument("--dry-run", action="store_true",
                   help="Scrape but do not write to pipeline files")
    args = p.parse_args(argv)

    keywords = [k.strip() for k in args.keywords.split(",")] if args.keywords else None

    leads = scrape_port_st_lucie(
        keywords=keywords,
        max_per_keyword=args.max_per_keyword,
        dry_run=args.dry_run,
    )

    if not leads:
        log.error("No leads scraped — check network connectivity and see logs above")
        return 1

    _print_summary(leads)

    # Save PSL-specific batch file
    psl_out = REPO_ROOT / "leads" / "port_st_lucie_leads.json"
    psl_out.parent.mkdir(parents=True, exist_ok=True)
    psl_out.write_text(json.dumps(leads, indent=2), encoding="utf-8")
    log.info("Saved %d PSL leads → %s", len(leads), psl_out)

    if not args.dry_run:
        added = _merge_into_pipeline(leads)
        log.info("Merged %d new leads into pipeline", added)

    return 0


if __name__ == "__main__":
    sys.exit(_cli())
