#!/usr/bin/env python3
"""
scripts/lead_validator.py
==========================
XPS Intelligence — Real Lead Validator

Validates scraped contractor leads by:
  1. Checking website reachability (HTTP HEAD/GET with timeout)
  2. Validating US phone number format
  3. Checking required fields are present
  4. Deduplicating by company + city + state

Reads:  leads/scored_leads.json  (or leads/leads.json as fallback)
Writes: leads/scored_leads.json  (filtered to valid leads only)
        leads/validation_report.json (summary stats)
        leads/invalid_leads.json     (rejected leads for audit)

Usage:
    python scripts/lead_validator.py
    python scripts/lead_validator.py --no-url-check   # skip HTTP checks (fast mode)
    python scripts/lead_validator.py --min-score 50   # only keep leads with score >= 50
    python scripts/lead_validator.py --dry-run        # validate but don't write files
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import re
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
log = logging.getLogger("lead_validator")

REPO_ROOT = Path(__file__).resolve().parent.parent
LEADS_DIR = REPO_ROOT / "leads"

# ── Phone validation ─────────────────────────────────────────────────────────

_US_PHONE_RE = re.compile(
    r"(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})"
)


def is_valid_phone(phone: Optional[str]) -> bool:
    """Return True if phone looks like a valid US number."""
    if not phone:
        return False
    digits = re.sub(r"\D", "", str(phone))
    # US number: 10 digits, or 11 with leading 1
    if len(digits) == 10:
        return digits[0] != "0"
    if len(digits) == 11 and digits[0] == "1":
        return True
    return False


# ── URL validation ────────────────────────────────────────────────────────────

def normalise_url(url: Optional[str]) -> Optional[str]:
    """Ensure URL has a scheme; return None if clearly invalid."""
    if not url:
        return None
    url = url.strip()
    if not url:
        return None
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    # Must have at least one dot in the domain
    host = url.split("/")[2] if "/" in url[8:] else url[8:]
    if "." not in host:
        return None
    return url


def check_url_reachable(url: str, timeout: int = 8) -> bool:
    """Return True if URL returns HTTP 2xx or 3xx within timeout."""
    url = normalise_url(url)
    if not url:
        return False
    try:
        req = urllib.request.Request(
            url,
            method="HEAD",
            headers={"User-Agent": "XPS-Intelligence-Validator/1.0"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status < 400
    except Exception:
        # Try GET as fallback (some servers reject HEAD)
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "XPS-Intelligence-Validator/1.0"},
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.status < 400
        except Exception:
            return False


def check_urls_parallel(
    urls: List[str],
    max_workers: int = 20,
    timeout: int = 8,
) -> Dict[str, bool]:
    """Check multiple URLs in parallel. Returns {url: reachable}."""
    results: Dict[str, bool] = {}
    unique_urls = list(set(u for u in urls if u))
    if not unique_urls:
        return results

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_url = {
            executor.submit(check_url_reachable, u, timeout): u
            for u in unique_urls
        }
        for future in as_completed(future_to_url):
            url = future_to_url[future]
            try:
                results[url] = future.result()
            except Exception:
                results[url] = False
    return results


# ── Field completeness ────────────────────────────────────────────────────────

def completeness_score(lead: dict) -> float:
    """Return 0.0–1.0 fraction of key fields present."""
    fields = ["company_name", "phone", "email", "website", "city", "state", "address"]
    filled = sum(
        1 for f in fields
        if lead.get(f) or lead.get("company")  # legacy alias
    )
    return round(filled / len(fields), 2)


# ── Deduplication ─────────────────────────────────────────────────────────────

def dedup_leads(leads: List[dict]) -> Tuple[List[dict], int]:
    """Remove duplicates by (company_name, city, state). Returns (unique, n_removed)."""
    seen: set = set()
    unique: List[dict] = []
    for lead in leads:
        company = (lead.get("company_name") or lead.get("company") or "").lower().strip()
        city    = (lead.get("city") or "").lower().strip()
        state   = (lead.get("state") or "").lower().strip()
        key = (company, city, state)
        if key not in seen:
            seen.add(key)
            unique.append(lead)
    return unique, len(leads) - len(unique)


# ── Human-readable field enrichment ──────────────────────────────────────────

def enrich_lead(lead: dict, url_reachable: Optional[bool] = None) -> dict:
    """
    Add human-readable / display fields to a lead record without removing
    any existing fields.  This makes the JSON in the LEADS repo easier to
    read and consume by the frontend.
    """
    company   = lead.get("company_name") or lead.get("company") or ""
    city      = lead.get("city") or ""
    state     = lead.get("state") or ""
    phone     = lead.get("phone") or ""
    score     = int(lead.get("lead_score") or lead.get("score") or 0)
    tier      = (lead.get("tier") or "").upper()
    if not tier:
        tier = "HOT" if score >= 75 else "WARM" if score >= 50 else "COLD"

    formatted_phone = ""
    if phone:
        digits = re.sub(r"\D", "", str(phone))
        if len(digits) == 10:
            formatted_phone = f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
        elif len(digits) == 11 and digits[0] == "1":
            formatted_phone = f"+1 ({digits[1:4]}) {digits[4:7]}-{digits[7:]}"
        else:
            formatted_phone = phone

    location_str = ", ".join(filter(None, [city, state]))

    lead["display_name"]    = company
    lead["display_location"] = location_str
    lead["display_phone"]   = formatted_phone or phone
    lead["display_tier"]    = tier
    lead["display_score"]   = score
    if url_reachable is not None:
        lead["website_verified"] = url_reachable
    lead["validated_at"]    = datetime.now(timezone.utc).isoformat()
    return lead


# ── Lead loading ──────────────────────────────────────────────────────────────

def load_leads() -> List[dict]:
    """Load leads from the canonical scored_leads.json or fallback files."""
    candidates = [
        LEADS_DIR / "scored_leads.json",
        LEADS_DIR / "leads.json",
        REPO_ROOT / "data" / "leads" / "scored_leads.json",
        REPO_ROOT / "data" / "leads" / "leads.json",
    ]
    for path in candidates:
        if path.exists():
            try:
                raw = json.loads(path.read_text(encoding="utf-8"))
                leads = raw if isinstance(raw, list) else raw.get("leads", raw.get("data", []))
                if leads:
                    log.info("Loaded %d leads from %s", len(leads), path)
                    return leads
            except Exception as exc:
                log.warning("Could not read %s: %s", path, exc)
    log.warning("No lead files found in %s", LEADS_DIR)
    return []


# ── Main validation pipeline ──────────────────────────────────────────────────

def run_validation(
    leads: List[dict],
    *,
    check_urls: bool = True,
    min_score: int = 0,
    url_timeout: int = 8,
    max_url_workers: int = 20,
) -> Tuple[List[dict], List[dict], dict]:
    """
    Validate leads.

    Returns:
        valid_leads    — leads that passed all checks
        invalid_leads  — leads that failed (with rejection reason)
        report         — summary statistics dict
    """
    total_raw = len(leads)
    log.info("Starting validation of %d leads (url_check=%s, min_score=%d)",
             total_raw, check_urls, min_score)

    # Step 1: Deduplicate
    leads, n_dupes = dedup_leads(leads)
    log.info("Deduplication: removed %d duplicates → %d unique", n_dupes, len(leads))

    # Step 2: Score filter
    if min_score > 0:
        before = len(leads)
        leads = [l for l in leads if int(l.get("lead_score") or l.get("score") or 0) >= min_score]
        log.info("Score filter (>=%d): removed %d → %d remain", min_score, before - len(leads), len(leads))

    # Step 3: URL check in parallel
    url_results: Dict[str, bool] = {}
    if check_urls:
        all_urls = [normalise_url(l.get("website")) for l in leads if l.get("website")]
        all_urls = [u for u in all_urls if u]
        if all_urls:
            log.info("Checking %d unique URLs (workers=%d, timeout=%ds)…",
                     len(set(all_urls)), max_url_workers, url_timeout)
            url_results = check_urls_parallel(all_urls, max_workers=max_url_workers, timeout=url_timeout)
            reachable = sum(1 for v in url_results.values() if v)
            log.info("URL check complete: %d/%d reachable", reachable, len(url_results))

    # Step 4: Classify leads
    valid: List[dict] = []
    invalid: List[dict] = []

    for lead in leads:
        company = (lead.get("company_name") or lead.get("company") or "").strip()
        phone   = lead.get("phone") or ""
        website = lead.get("website") or ""
        city    = lead.get("city") or ""
        state   = lead.get("state") or ""

        reasons: List[str] = []

        # Required: company name
        if not company:
            reasons.append("missing_company_name")

        # Required: at least a city or state (location context)
        if not city and not state:
            reasons.append("missing_location")

        # Informational: validate phone format if present (non-blocking)
        if phone and not is_valid_phone(phone):
            reasons.append("invalid_phone_format")

        # URL reachability: informational warning only — does NOT block the lead.
        # Websites can be temporarily down; blocking here would drop valid leads.
        # Blocking reasons: missing_company, missing_location.
        # Non-blocking reasons: invalid_phone_format, website_unreachable.
        BLOCKING_REASONS = {"missing_company", "missing_location"}
        if check_urls and website:
            norm = normalise_url(website)
            # Use False as default: treat missing result as unreachable.
            if norm and not url_results.get(norm, False):
                reasons.append("website_unreachable")

        url_reachable = None
        if check_urls and website:
            norm = normalise_url(website)
            url_reachable = url_results.get(norm) if norm else None

        enriched = enrich_lead(dict(lead), url_reachable=url_reachable)

        # Only reject leads with at least one BLOCKING reason.
        # Non-blocking reasons (invalid_phone_format, website_unreachable) are
        # recorded on the lead for downstream visibility but do not cause rejection.
        blocking = [r for r in reasons if r in BLOCKING_REASONS]
        if blocking:
            enriched["_rejection_reasons"] = reasons  # include all reasons for audit
            invalid.append(enriched)
        else:
            if reasons:
                enriched["_validation_warnings"] = reasons  # non-blocking: keep as warning
            valid.append(enriched)

    log.info("Validation complete: %d valid, %d invalid", len(valid), len(invalid))

    # Build report
    hot  = sum(1 for l in valid if (l.get("tier") or "").upper() == "HOT")
    warm = sum(1 for l in valid if (l.get("tier") or "").upper() == "WARM")
    cold = sum(1 for l in valid if (l.get("tier") or "").upper() == "COLD")

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total_raw": total_raw,
            "duplicates_removed": n_dupes,
            "after_dedup": total_raw - n_dupes,
            "valid": len(valid),
            "invalid": len(invalid),
            "hot": hot,
            "warm": warm,
            "cold": cold,
            "url_check_enabled": check_urls,
            "min_score_filter": min_score,
        },
        "rejection_breakdown": {},
    }

    # Count rejection reasons
    for lead in invalid:
        for reason in lead.get("_rejection_reasons", []):
            report["rejection_breakdown"][reason] = (
                report["rejection_breakdown"].get(reason, 0) + 1
            )

    return valid, invalid, report


def main() -> int:
    parser = argparse.ArgumentParser(description="XPS Intelligence Lead Validator")
    parser.add_argument("--no-url-check", action="store_true",
                        help="Skip HTTP URL reachability checks (fast mode)")
    parser.add_argument("--min-score", type=int, default=0,
                        help="Minimum lead_score to keep (default: 0 = keep all)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Validate but do not write output files")
    parser.add_argument("--url-timeout", type=int, default=8,
                        help="HTTP timeout per URL in seconds (default: 8)")
    parser.add_argument("--workers", type=int, default=20,
                        help="Parallel URL check workers (default: 20)")
    args = parser.parse_args()

    leads = load_leads()
    if not leads:
        log.error("No leads to validate — exiting")
        return 1

    valid, invalid, report = run_validation(
        leads,
        check_urls=not args.no_url_check,
        min_score=args.min_score,
        url_timeout=args.url_timeout,
        max_url_workers=args.workers,
    )

    s = report["summary"]
    log.info(
        "RESULT — valid=%d  invalid=%d  HOT=%d  WARM=%d  COLD=%d",
        s["valid"], s["invalid"], s["hot"], s["warm"], s["cold"],
    )

    if args.dry_run:
        log.info("[DRY-RUN] would write %d valid leads to leads/scored_leads.json", len(valid))
        print(json.dumps(report, indent=2))
        return 0

    LEADS_DIR.mkdir(parents=True, exist_ok=True)

    # Write validated leads (overwrite scored_leads.json)
    out_path = LEADS_DIR / "scored_leads.json"
    out_path.write_text(json.dumps(valid, indent=2, ensure_ascii=False), encoding="utf-8")
    log.info("✅ Wrote %d validated leads → %s", len(valid), out_path)

    # Write invalid leads for audit
    inv_path = LEADS_DIR / "invalid_leads.json"
    inv_path.write_text(json.dumps(invalid, indent=2, ensure_ascii=False), encoding="utf-8")
    log.info("📋 Wrote %d invalid leads → %s", len(invalid), inv_path)

    # Write report
    rep_path = LEADS_DIR / "validation_report.json"
    rep_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    log.info("📊 Wrote validation report → %s", rep_path)

    return 0


if __name__ == "__main__":
    sys.exit(main())
