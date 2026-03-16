#!/usr/bin/env python3
"""
scripts/supabase_lead_writer.py
================================
Railway PostgreSQL + LEADS Repo Lead Writer

Routes ALL scraped leads to:
  1. Railway PostgreSQL (via DATABASE_URL) — primary storage
  2. InfinityXOneSystems/LEADS GitHub repo — JSON archive

Environment variables:
  DATABASE_URL     — PostgreSQL connection string from Railway
                     (${{ Postgres.DATABASE_URL }} in Railway service vars)
  DATABASE_PUBLIC_URL — external connection string (optional, for local runs)
  GITHUB_TOKEN     — push leads JSON to InfinityXOneSystems/LEADS

Usage:
  python scripts/supabase_lead_writer.py --input leads/leads.json
  # or import:
  from scripts.supabase_lead_writer import write_leads
"""

from __future__ import annotations

import argparse
import base64 as b64
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.error import HTTPError
from urllib.request import Request, urlopen

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
log = logging.getLogger("lead_writer")

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

# Railway provides DATABASE_URL in the linked service environment.
# DATABASE_PUBLIC_URL is available for external (non-private-network) access.
DATABASE_URL = os.environ.get("DATABASE_URL", "") or os.environ.get("DATABASE_PUBLIC_URL", "")

# GitHub LEADS repo (leads archive)
LEADS_REPO = "InfinityXOneSystems/LEADS"
GITHUB_API = "https://api.github.com"

# ─────────────────────────────────────────────────────────────────────────────
# Lead normalisation
# ─────────────────────────────────────────────────────────────────────────────


def _normalise_lead(lead: dict) -> dict:
    """Map arbitrary scraper output to the canonical PostgreSQL leads schema."""
    return {
        "company_name": (lead.get("company_name") or lead.get("company") or "").strip(),
        "contact_name": lead.get("contact_name") or lead.get("contact") or None,
        "phone": lead.get("phone") or None,
        "email": lead.get("email") or None,
        "website": lead.get("website") or None,
        "address": lead.get("address") or None,
        "city": (lead.get("city") or "").strip(),
        "state": (lead.get("state") or "").strip(),
        "country": lead.get("country") or "US",
        "industry": lead.get("industry") or lead.get("category") or None,
        "category": lead.get("category") or None,
        "keyword": lead.get("keyword") or None,
        "rating": _safe_float(lead.get("rating")),
        "reviews": _safe_int(lead.get("reviews")),
        "lead_score": _safe_int(lead.get("lead_score") or lead.get("score")) or 0,
        "tier": lead.get("tier") or None,
        "status": lead.get("status") or "new",
        "source": lead.get("source") or "pipeline",
    }


def _safe_float(v) -> Optional[float]:
    try:
        return float(v) if v is not None else None
    except (ValueError, TypeError):
        return None


def _safe_int(v) -> Optional[int]:
    try:
        return int(v) if v is not None else None
    except (ValueError, TypeError):
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Railway PostgreSQL write
# ─────────────────────────────────────────────────────────────────────────────


def write_leads_to_postgres(
    leads: List[dict],
    batch_size: int = 100,
    database_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Upsert leads into Railway PostgreSQL via psycopg2.

    Conflict resolution: ON CONFLICT (company_name, city, state) DO UPDATE.
    Batches inserts to avoid large transactions.

    Returns summary dict with success/failure counts.
    """
    url = database_url or DATABASE_URL
    if not url:
        log.warning(
            "DATABASE_URL not set — skipping PostgreSQL write. "
            "Set DATABASE_URL=${{ Postgres.DATABASE_URL }} in Railway service vars."
        )
        return {"success": 0, "failed": 0, "total": len(leads), "skipped": True}

    try:
        import psycopg2  # type: ignore
        import psycopg2.extras  # type: ignore
    except ImportError:
        log.error(
            "psycopg2 not installed. Run: pip install psycopg2-binary"
        )
        return {"success": 0, "failed": len(leads), "total": len(leads), "error": "psycopg2 not installed"}

    normalised = [_normalise_lead(l) for l in leads]
    valid = [r for r in normalised if r["company_name"]]

    if not valid:
        log.info("No valid leads to write to PostgreSQL.")
        return {"success": 0, "failed": 0, "total": 0}

    # Determine SSL mode: private network (*.railway.internal) doesn't need SSL
    is_private = ".railway.internal" in url or "localhost" in url
    ssl_mode = None if is_private else {"sslmode": "require"}

    upsert_sql = """
        INSERT INTO leads (
            company_name, contact_name, phone, email, website, address,
            city, state, country, industry, category, keyword,
            rating, reviews, lead_score, tier, status, source, date_scraped
        ) VALUES (
            %(company_name)s, %(contact_name)s, %(phone)s, %(email)s, %(website)s, %(address)s,
            %(city)s, %(state)s, %(country)s, %(industry)s, %(category)s, %(keyword)s,
            %(rating)s, %(reviews)s, %(lead_score)s, %(tier)s, %(status)s, %(source)s,
            NOW()
        )
        ON CONFLICT (company_name, city, state) DO UPDATE SET
            contact_name  = EXCLUDED.contact_name,
            phone         = EXCLUDED.phone,
            email         = EXCLUDED.email,
            website       = EXCLUDED.website,
            address       = EXCLUDED.address,
            industry      = EXCLUDED.industry,
            category      = EXCLUDED.category,
            keyword       = EXCLUDED.keyword,
            rating        = EXCLUDED.rating,
            reviews       = EXCLUDED.reviews,
            lead_score    = EXCLUDED.lead_score,
            tier          = EXCLUDED.tier,
            status        = EXCLUDED.status,
            source        = EXCLUDED.source,
            date_scraped  = NOW(),
            updated_at    = NOW()
    """

    success_count = 0
    failed_count = 0

    try:
        conn_kwargs: dict = {"dsn": url}
        if ssl_mode:
            conn_kwargs["sslmode"] = ssl_mode["sslmode"]

        with psycopg2.connect(url) as conn:
            conn.autocommit = False
            for i in range(0, len(valid), batch_size):
                batch = valid[i : i + batch_size]
                try:
                    with conn.cursor() as cur:
                        psycopg2.extras.execute_batch(cur, upsert_sql, batch)
                    conn.commit()
                    success_count += len(batch)
                    log.info(
                        "PostgreSQL batch %d/%d: ✅ %d leads written",
                        i // batch_size + 1,
                        (len(valid) - 1) // batch_size + 1,
                        len(batch),
                    )
                except Exception as exc:
                    conn.rollback()
                    failed_count += len(batch)
                    log.error(
                        "PostgreSQL batch %d/%d: ❌ %s",
                        i // batch_size + 1,
                        (len(valid) - 1) // batch_size + 1,
                        exc,
                    )
    except Exception as exc:
        log.error("PostgreSQL connection failed: %s", exc)
        return {"success": 0, "failed": len(valid), "total": len(valid), "error": str(exc)}

    log.info(
        "PostgreSQL write complete: %d success, %d failed (of %d total)",
        success_count, failed_count, len(valid),
    )
    return {"success": success_count, "failed": failed_count, "total": len(valid)}


# Keep backward-compat alias so any code importing write_leads_to_supabase still works
def write_leads_to_supabase(
    leads: List[dict],
    batch_size: int = 100,
) -> Dict[str, Any]:
    """Backward-compatible alias → delegates to write_leads_to_postgres."""
    log.warning(
        "write_leads_to_supabase() is deprecated — routing to Railway PostgreSQL instead."
    )
    return write_leads_to_postgres(leads, batch_size=batch_size)


# ─────────────────────────────────────────────────────────────────────────────
# GitHub LEADS repo push
# ─────────────────────────────────────────────────────────────────────────────


def _http_put_or_post(url: str, payload: Any, headers: dict, method: str = "PUT") -> dict:
    """PUT/POST JSON payload to URL, return parsed response."""
    data = json.dumps(payload).encode("utf-8")
    req = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(req, timeout=30) as resp:
            body = resp.read()
            return {"status": resp.status, "body": json.loads(body) if body else {}}
    except HTTPError as exc:
        body = exc.read()
        log.warning("HTTP %d: %s", exc.code, body[:200])
        return {"status": exc.code, "body": body.decode("utf-8", errors="replace")[:200]}


def push_leads_to_github_repo(
    leads: List[dict],
    date_slug: str,
    github_token: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Push leads JSON to InfinityXOneSystems/LEADS repo.

    Writes two files:
      leads/leads_{date_slug}.json  — timestamped snapshot
      leads/latest.json             — always the latest batch
    """
    token = github_token or os.environ.get("GITHUB_TOKEN", "")
    if not token:
        log.warning("GITHUB_TOKEN not set — skipping LEADS repo push")
        return {"success": False, "reason": "GITHUB_TOKEN not set"}

    base = f"{GITHUB_API}/repos/{LEADS_REPO}/contents"
    auth_headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
    }

    files = {
        f"leads/leads_{date_slug}.json": json.dumps(leads, indent=2),
        "leads/latest.json": json.dumps(leads, indent=2),
    }

    pushed = 0
    for path_in_repo, content in files.items():
        encoded = b64.b64encode(content.encode()).decode()
        # Get existing sha if file exists
        sha = None
        get_req = Request(f"{base}/{path_in_repo}", headers=auth_headers)
        try:
            with urlopen(get_req, timeout=10) as r:
                sha = json.loads(r.read())["sha"]
        except HTTPError:
            pass  # File doesn't exist yet

        payload: dict = {
            "message": f"chore(leads): autonomous pipeline update {date_slug}",
            "content": encoded,
        }
        if sha:
            payload["sha"] = sha

        method = "PUT"  # GitHub Contents API always uses PUT for create and update
        result = _http_put_or_post(f"{base}/{path_in_repo}", payload, auth_headers, method="PUT")
        if result["status"] in (200, 201):
            log.info("✅ Pushed %s to LEADS repo", path_in_repo)
            pushed += 1
        else:
            log.error("❌ Failed to push %s: HTTP %d", path_in_repo, result["status"])

    return {"success": pushed == len(files), "files_pushed": pushed}


# ─────────────────────────────────────────────────────────────────────────────
# GitHub Pages data write
# ─────────────────────────────────────────────────────────────────────────────

# Repo root = two levels up from this script (scripts/ → repo root)
_REPO_ROOT = Path(__file__).resolve().parent.parent


def write_pages_data(
    leads: List[dict],
    output_path: Optional[Path] = None,
) -> Dict[str, Any]:
    """
    Write normalised leads to pages/data/scored_leads.json so that
    the GitHub Pages lead dashboard can load them without an API call.

    Args:
        leads:       list of normalised lead dicts
        output_path: override destination path (default: pages/data/scored_leads.json)

    Returns:
        dict with success flag and path written
    """
    dest = output_path or (_REPO_ROOT / "pages" / "data" / "scored_leads.json")
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        dest.write_text(json.dumps(leads, indent=2), encoding="utf-8")
        log.info("✅ pages/data written: %d leads → %s", len(leads), dest)
        return {"success": True, "path": str(dest), "count": len(leads)}
    except Exception as exc:
        log.error("❌ Failed to write pages/data: %s", exc)
        return {"success": False, "error": str(exc)}


# ─────────────────────────────────────────────────────────────────────────────
# Full write pipeline
# ─────────────────────────────────────────────────────────────────────────────


def write_leads(
    leads: List[dict],
    date_slug: Optional[str] = None,
    skip_postgres: bool = False,
    skip_github: bool = False,
    # Legacy param name kept for backward compat
    skip_supabase: Optional[bool] = None,
) -> Dict[str, Any]:
    """
    Write leads to all configured sinks (Railway PostgreSQL + LEADS repo).

    Args:
        leads:          list of lead dicts from scraper/pipeline
        date_slug:      date string for file naming (default: today)
        skip_postgres:  skip PostgreSQL write (useful in dry-run)
        skip_github:    skip LEADS repo push (useful in dry-run)
        skip_pages:     skip pages/data write (useful in dry-run)

    Returns:
        dict with results from each sink
    """
    if not date_slug:
        date_slug = time.strftime("%Y-%m-%d")

    # Honor legacy skip_supabase param
    if skip_supabase is not None:
        skip_postgres = skip_supabase

    results: dict = {"leads_count": len(leads), "date": date_slug}

    if not skip_postgres:
        results["postgres"] = write_leads_to_postgres(leads)
        # Keep 'supabase' key for any callers that check it
        results["supabase"] = results["postgres"]
    else:
        results["postgres"] = {"skipped": True}
        results["supabase"] = {"skipped": True}

    if not skip_github:
        results["github_leads"] = push_leads_to_github_repo(leads, date_slug)
    else:
        results["github_leads"] = {"skipped": True}

    if not skip_pages:
        normalised = [_normalise_lead(l) for l in leads]
        results["pages_data"] = write_pages_data(normalised)
    else:
        results["pages_data"] = {"skipped": True}

    return results


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────


def _cli(argv: Optional[list] = None) -> int:
    p = argparse.ArgumentParser(
        description="Write scraped leads to Railway PostgreSQL and LEADS repo"
    )
    p.add_argument("--input", required=True, help="Path to leads JSON file")
    p.add_argument("--date", default=None, help="Date slug for file naming")
    p.add_argument("--dry-run", action="store_true", help="Validate only, no writes")
    args = p.parse_args(argv)

    leads_path = Path(args.input)
    if not leads_path.exists():
        log.error("Input file not found: %s", leads_path)
        return 1

    leads = json.loads(leads_path.read_text(encoding="utf-8"))
    log.info("Loaded %d leads from %s", len(leads), leads_path)

    result = write_leads(
        leads,
        date_slug=args.date,
        skip_postgres=args.dry_run,
        skip_github=args.dry_run,
        skip_pages=args.dry_run,
    )
    print(json.dumps(result, indent=2))
    return 0 if result.get("postgres", {}).get("failed", 0) == 0 else 1


if __name__ == "__main__":
    sys.exit(_cli())

