#!/usr/bin/env python3
"""
scripts/shadow_scraper_pipeline.py
====================================
Asyncio Shadow Scraper Integration Pipeline

Runs the Vision Cortex asyncio shadow scraper, merges the scraped intelligence
items with the existing leads pipeline data, normalises everything to the
canonical schema, and publishes to:

  1. leads/scored_leads.json        — primary local store (read by api/server.js)
  2. pages/data/scored_leads.json   — GitHub Pages dashboard data
  3. InfinityXOneSystems/LEADS repo — JSON archive via GitHub API
  4. Supabase                        — live database (if configured)

Usage:
    python scripts/shadow_scraper_pipeline.py
    python scripts/shadow_scraper_pipeline.py --dry-run
    python scripts/shadow_scraper_pipeline.py --leads-only  # skip shadow scraper
"""

from __future__ import annotations

import argparse
import asyncio
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
log = logging.getLogger("shadow_scraper_pipeline")

REPO_ROOT = Path(__file__).resolve().parent.parent

# Candidate paths for existing leads (pipeline output)
LEADS_CANDIDATES = [
    REPO_ROOT / "leads" / "scored_leads.json",
    REPO_ROOT / "pages" / "data" / "scored_leads.json",
    REPO_ROOT / "data" / "leads" / "scored_leads.json",
    REPO_ROOT / "leads" / "leads.json",
    REPO_ROOT / "data" / "leads" / "leads.json",
]

PRIMARY_OUTPUT = REPO_ROOT / "leads" / "scored_leads.json"
PAGES_OUTPUT = REPO_ROOT / "pages" / "data" / "scored_leads.json"


# ─────────────────────────────────────────────────────────────────────────────
# Lead normalisation (mirrors scripts/normalize_leads.js)
# ─────────────────────────────────────────────────────────────────────────────

def _score_lead(lead: dict) -> int:
    """Compute a basic lead quality score when one isn't already present."""
    score = 0
    if lead.get("website"):     score += 10
    if lead.get("phone"):       score += 10
    if lead.get("email"):       score += 15
    if lead.get("address"):     score += 5
    rating = float(lead.get("rating") or 0)
    if rating >= 4.0:           score += 10
    reviews = int(lead.get("reviews") or 0)
    if reviews >= 10:           score += 5
    if lead.get("city") and lead.get("state"):
        score += 10
    # Industry relevance — flooring/construction terms
    industry = (lead.get("industry") or lead.get("category") or "").lower()
    if any(kw in industry for kw in (
        "floor", "tile", "hardwood", "carpet", "epoxy", "concrete",
        "roofing", "construct", "contrac",
    )):
        score += 20
    return min(score, 100)


def _normalise(lead: dict, index: int) -> dict:
    """Map a raw lead dict to the canonical pipeline schema."""
    raw_score = lead.get("lead_score") or lead.get("score")
    score = int(raw_score) if raw_score is not None else _score_lead(lead)
    tier = "HOT" if score >= 75 else "WARM" if score >= 50 else "COLD"
    today = time.strftime("%Y-%m-%d")

    website = (lead.get("website") or "").strip()
    if website and not website.startswith(("http://", "https://")):
        website = "https://" + website

    return {
        "id": lead.get("id") or index + 1,
        "company": (lead.get("company") or lead.get("company_name") or "Unknown").strip(),
        "contact": (lead.get("contact") or lead.get("contact_name") or "").strip(),
        "phone": (lead.get("phone") or "").strip(),
        "email": (lead.get("email") or "").strip(),
        "website": website,
        "address": (lead.get("address") or "").strip(),
        "city": (lead.get("city") or "").strip(),
        "state": (lead.get("state") or "").strip(),
        "country": lead.get("country") or "US",
        "industry": (lead.get("industry") or lead.get("category") or "Unknown").strip(),
        "category": (lead.get("category") or lead.get("industry") or "Unknown").strip(),
        "rating": float(lead.get("rating") or 0),
        "reviews": int(lead.get("reviews") or 0),
        "score": score,
        "lead_score": score,
        "tier": tier,
        "status": (lead.get("status") or tier.lower()),
        "source": lead.get("source") or "shadow_scraper",
        "date_scraped": (
            lead.get("date_scraped")
            or lead.get("scrapedAt")
            or lead.get("scraped_at")
            or today
        ),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Load existing leads
# ─────────────────────────────────────────────────────────────────────────────

def load_existing_leads() -> List[dict]:
    for candidate in LEADS_CANDIDATES:
        if candidate.exists():
            try:
                data = json.loads(candidate.read_text(encoding="utf-8"))
                if isinstance(data, list) and data:
                    log.info("Loaded %d existing leads from %s", len(data), candidate)
                    return data
            except Exception as exc:
                log.warning("Failed to parse %s: %s", candidate, exc)
    log.warning("No existing leads file found")
    return []


# ─────────────────────────────────────────────────────────────────────────────
# Shadow scraper integration
# ─────────────────────────────────────────────────────────────────────────────

async def run_shadow_scraper() -> List[dict]:
    """
    Run the Vision Cortex asyncio shadow scraper and return any lead-like
    items found in the scraped content.
    """
    try:
        from vision_cortex.shadow_scraper.async_scraper import (
            scrape_all,
            _load_sources,
        )
    except ImportError as exc:
        log.warning("Shadow scraper import failed (%s) — skipping", exc)
        return []

    sources = _load_sources()
    if not sources:
        log.warning("No sources loaded for shadow scraper")
        return []

    log.info("Running asyncio shadow scraper on %d sources…", len(sources))
    rate_limit = float(os.environ.get("SHADOW_RATE_LIMIT_DELAY", "0.5"))
    concurrency = int(os.environ.get("SHADOW_CONCURRENCY", "5"))
    results = await scrape_all(sources, rate_limit_delay=rate_limit, concurrency=concurrency)

    # Collect any items that look like contractor leads (have company/phone)
    leads: List[dict] = []
    for result in results:
        if result.get("status") != "ok":
            continue
        # items are stored in the per-source output file
        out_path = result.get("output_path")
        if not out_path:
            continue
        try:
            payload = json.loads(Path(out_path).read_text(encoding="utf-8"))
            for item in payload.get("items", []):
                # Only accept items that have enough structure to be leads
                if item.get("phone") or item.get("email") or item.get("company"):
                    item["source"] = item.get("source_id") or result["source_id"]
                    leads.append(item)
        except Exception as exc:
            log.debug("Could not read items from %s: %s", out_path, exc)

    log.info("Shadow scraper yielded %d lead-like items", len(leads))
    return leads


# ─────────────────────────────────────────────────────────────────────────────
# Dedup by (company_name, city) normalised
# ─────────────────────────────────────────────────────────────────────────────

def _dedup_key(lead: dict) -> str:
    name = re.sub(r"\s+", " ", (lead.get("company") or "").lower().strip())
    city = (lead.get("city") or "").lower().strip()
    return f"{name}|{city}"


def dedup_leads(leads: List[dict]) -> List[dict]:
    seen: set = set()
    out: List[dict] = []
    for lead in leads:
        key = _dedup_key(lead)
        if key not in seen:
            seen.add(key)
            out.append(lead)
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Write outputs
# ─────────────────────────────────────────────────────────────────────────────

def write_outputs(
    leads: List[dict],
    dry_run: bool = False,
    date_slug: Optional[str] = None,
) -> Dict[str, Any]:
    results: Dict[str, Any] = {"count": len(leads)}

    if dry_run:
        log.info("[DRY RUN] Would write %d leads to outputs", len(leads))
        results["dry_run"] = True
        return results

    # 1. Primary local store
    PRIMARY_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    PRIMARY_OUTPUT.write_text(json.dumps(leads, indent=2), encoding="utf-8")
    log.info("✅ Written %d leads → %s", len(leads), PRIMARY_OUTPUT)
    results["primary"] = str(PRIMARY_OUTPUT)

    # 2. Pages data (GitHub Pages dashboard)
    PAGES_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    PAGES_OUTPUT.write_text(json.dumps(leads, indent=2), encoding="utf-8")
    log.info("✅ Written %d leads → %s (GitHub Pages)", len(leads), PAGES_OUTPUT)
    results["pages"] = str(PAGES_OUTPUT)

    # 3. Supabase + LEADS repo via supabase_lead_writer
    try:
        if str(REPO_ROOT) not in sys.path:
            sys.path.insert(0, str(REPO_ROOT))
        from scripts.supabase_lead_writer import write_leads as _write_leads
        sink_results = _write_leads(
            leads,
            date_slug=date_slug,
            skip_pages=True,  # already done above
        )
        results["supabase"]      = sink_results.get("supabase", {})
        results["github_leads"]  = sink_results.get("github_leads", {})
        log.info(
            "Supabase: %s written, LEADS repo: %s",
            sink_results.get("supabase", {}).get("success", 0),
            "✅" if sink_results.get("github_leads", {}).get("success") else "⚠️",
        )
    except Exception as exc:
        log.warning("supabase_lead_writer failed: %s", exc)
        results["supabase"]     = {"error": str(exc)}
        results["github_leads"] = {"error": str(exc)}

    return results


# ─────────────────────────────────────────────────────────────────────────────
# Main entry point
# ─────────────────────────────────────────────────────────────────────────────

async def main(dry_run: bool = False, leads_only: bool = False) -> int:
    date_slug = time.strftime("%Y-%m-%d")

    # Step 1: Load existing pipeline leads
    existing = load_existing_leads()

    # Step 2: Run shadow scraper (unless --leads-only)
    shadow_items: List[dict] = []
    if not leads_only:
        shadow_items = await run_shadow_scraper()

    # Step 3: Merge, normalise, dedup, sort
    combined_raw = existing + shadow_items
    log.info("Merging %d existing + %d shadow items = %d total",
             len(existing), len(shadow_items), len(combined_raw))

    normalised = [_normalise(l, i) for i, l in enumerate(combined_raw)]
    deduped = dedup_leads(normalised)
    deduped.sort(key=lambda l: l["lead_score"], reverse=True)
    # Re-assign sequential IDs after sort
    for i, l in enumerate(deduped):
        l["id"] = i + 1

    log.info("After dedup: %d leads (removed %d duplicates)",
             len(deduped), len(normalised) - len(deduped))

    # Step 4: Write outputs
    results = write_outputs(deduped, dry_run=dry_run, date_slug=date_slug)
    print(json.dumps(results, indent=2))

    hot  = sum(1 for l in deduped if l["tier"] == "HOT")
    warm = sum(1 for l in deduped if l["tier"] == "WARM")
    cold = sum(1 for l in deduped if l["tier"] == "COLD")
    log.info("Pipeline complete: %d leads — HOT %d / WARM %d / COLD %d",
             len(deduped), hot, warm, cold)

    return 0


def _cli(argv: Optional[list] = None) -> int:
    p = argparse.ArgumentParser(
        description="Shadow scraper asyncio pipeline — scrape, normalise, publish"
    )
    p.add_argument("--dry-run",    action="store_true",
                   help="Normalise only; do not write any outputs")
    p.add_argument("--leads-only", action="store_true",
                   help="Skip shadow scraper; just normalise and publish existing leads")
    args = p.parse_args(argv)
    return asyncio.run(main(dry_run=args.dry_run, leads_only=args.leads_only))


if __name__ == "__main__":
    sys.exit(_cli())
