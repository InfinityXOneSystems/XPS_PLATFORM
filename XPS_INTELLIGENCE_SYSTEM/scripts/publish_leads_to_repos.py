#!/usr/bin/env python3
"""
scripts/publish_leads_to_repos.py
===================================
Enterprise Lead Publisher — powered by Infinity Orchestrator GitHub App

Pushes the normalised, scored lead data into two target repos via the
GitHub Contents API.  Authentication priority:
  1. GitHub App (GH_APP_ID + GH_APP_PRIVATE_KEY) — Infinity Orchestrator
  2. GH_PAT personal access token
  3. GITHUB_TOKEN (current repo only — dry-run equivalent for cross-repo)

Target repos:
  1.  InfinityXOneSystems/LEADS          — enterprise schema (JSON archive)
  2.  InfinityXOneSystems/XPS-INTELLIGENCE-FRONTEND — public/data/leads.json
      (frontend-compatible schema consumed by LeadsPage + ContractorsPage)

Optional env vars:
  LEADS_MAX      — max leads to publish (default 500)
  DRY_RUN        — set to "1" to skip GitHub writes

Usage:
    python scripts/publish_leads_to_repos.py
    DRY_RUN=1 python scripts/publish_leads_to_repos.py
"""

from __future__ import annotations

import base64
import json
import logging
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.request import Request, urlopen
from urllib.error import HTTPError

# ── Infinity Orchestrator App Auth ───────────────────────────────────────────
# Prefer the App auth helper (no third-party deps) but fall back gracefully.
try:
    _REPO_ROOT = Path(__file__).resolve().parent.parent
    sys.path.insert(0, str(_REPO_ROOT))
    from scripts.lib.github_app_auth import get_token as _get_app_token
    _APP_AUTH_AVAILABLE = True
except Exception:
    _APP_AUTH_AVAILABLE = False

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
log = logging.getLogger("publish_leads")

REPO_ROOT = Path(__file__).resolve().parent.parent

# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────

GITHUB_API = "https://api.github.com"
DRY_RUN = os.environ.get("DRY_RUN", "0") == "1"
LEADS_MAX = int(os.environ.get("LEADS_MAX", "500"))

LEADS_REPO = "InfinityXOneSystems/LEADS"
FRONTEND_REPO = "InfinityXOneSystems/XPS-INTELLIGENCE-FRONTEND"

_TARGET_REPOS = [LEADS_REPO, FRONTEND_REPO]


def _resolved_token() -> str:
    """
    Resolve the best available GitHub token at call time.

    Priority:
      1. Infinity Orchestrator GitHub App  (GH_APP_ID + GH_APP_PRIVATE_KEY)
      2. GH_PAT personal access token
      3. GITHUB_TOKEN (Actions default — cross-repo writes will 403)
    """
    if _APP_AUTH_AVAILABLE:
        try:
            tok = _get_app_token(repos=_TARGET_REPOS)
            if tok:
                return tok
        except Exception as exc:
            log.warning("App auth failed: %s", exc)

    pat = os.environ.get("GH_PAT", "").strip()
    if pat:
        return pat

    default = os.environ.get("GITHUB_TOKEN", "").strip()
    if default:
        return default

    raise RuntimeError(
        "No GitHub token found. Set GH_APP_ID+GH_APP_PRIVATE_KEY, GH_PAT, or GITHUB_TOKEN."
    )


# ─────────────────────────────────────────────────────────────────────────────
# GitHub API helpers
# ─────────────────────────────────────────────────────────────────────────────


def _gh_request(
    method: str,
    path: str,
    body: Optional[dict] = None,
    *,
    accept: str = "application/vnd.github+json",
) -> dict:
    """Execute a GitHub API request, returning the parsed JSON response."""
    url = f"{GITHUB_API}{path}"
    headers = {
        "Authorization": f"Bearer {_resolved_token()}",
        "Accept": accept,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "InfinityOrchestrator-LeadPublisher/1.0",
    }
    data: Optional[bytes] = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"

    req = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(req, timeout=30) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}
    except HTTPError as exc:
        body_text = exc.read().decode(errors="replace")
        log.error("GitHub API %s %s → %d: %s", method, path, exc.code, body_text[:300])
        raise


def _get_file_sha(repo: str, file_path: str, branch: str = "main") -> Optional[str]:
    """Return the current blob SHA for a file, or None if it doesn't exist."""
    try:
        resp = _gh_request("GET", f"/repos/{repo}/contents/{file_path}?ref={branch}")
        return resp.get("sha")
    except HTTPError as exc:
        if exc.code == 404:
            return None
        raise


def _upsert_file(
    repo: str,
    file_path: str,
    content: str,
    commit_message: str,
    branch: str = "main",
) -> None:
    """Create or update a file in a GitHub repo via the Contents API."""
    if DRY_RUN:
        log.info("[DRY-RUN] would write %s → %s", file_path, repo)
        return

    encoded = base64.b64encode(content.encode()).decode()
    existing_sha = _get_file_sha(repo, file_path, branch)

    body: Dict[str, Any] = {
        "message": commit_message,
        "content": encoded,
        "branch": branch,
    }
    if existing_sha:
        body["sha"] = existing_sha

    _gh_request("PUT", f"/repos/{repo}/contents/{file_path}", body=body)
    action = "Updated" if existing_sha else "Created"
    log.info("%s %s in %s", action, file_path, repo)


# ─────────────────────────────────────────────────────────────────────────────
# Schema converters
# ─────────────────────────────────────────────────────────────────────────────

# Lead rating tiers used by the frontend's Lead type
# tier (hot/warm/cold) → LeadRating (A+/A/B+/B/C/D)
_TIER_RATING: Dict[str, str] = {
    "hot":  "A+",
    "warm": "B+",
    "cold": "C",
}

# tier → LeadStatus for initial assignment
_TIER_STATUS: Dict[str, str] = {
    "hot":  "qualified",
    "warm": "new",
    "cold": "new",
}


def _score_to_rating(score: int) -> str:
    if score >= 85: return "A+"
    if score >= 75: return "A"
    if score >= 65: return "B+"
    if score >= 55: return "B"
    if score >= 40: return "C"
    return "D"


def to_frontend_lead(l: dict, idx: int) -> dict:
    """
    Convert a pipeline lead record to the Lead interface expected by
    XPS-INTELLIGENCE-FRONTEND (src/types/lead.ts).
    """
    score = int(l.get("lead_score") or l.get("score") or 0)
    tier = (l.get("tier") or ("hot" if score >= 75 else "warm" if score >= 50 else "cold")).lower()
    scraped_at = l.get("date_scraped") or l.get("scrapedAt") or datetime.now(timezone.utc).isoformat()

    return {
        "id": str(l.get("id") or idx + 1),
        "company": l.get("company") or l.get("company_name") or "",
        "city": (l.get("city") or "").split(",")[0].strip(),
        "state": l.get("state") or "",
        "phone": l.get("phone") or "",
        "email": l.get("email") or "",
        "website": l.get("website") or "",
        "address": l.get("address") or "",
        "category": l.get("industry") or l.get("category") or "contractor",
        "rating": _score_to_rating(score),
        "opportunityScore": score,
        "status": _TIER_STATUS.get(tier, "new"),
        "priority": "green" if tier == "hot" else "yellow" if tier == "warm" else "red",
        "isNew": True,
        "source": l.get("source") or "shadow_scraper",
        "createdAt": scraped_at,
        "updatedAt": scraped_at,
        "notes": "",
    }


def to_leads_repo_format(l: dict, idx: int) -> dict:
    """
    Convert a pipeline lead to the enterprise LEADS repo schema:
    matches IngestRequest in src/api/routes.py.
    """
    score = int(l.get("lead_score") or l.get("score") or 0)
    tier = (l.get("tier") or "").lower()
    scraped_at = l.get("date_scraped") or l.get("scrapedAt") or datetime.now(timezone.utc).isoformat()

    return {
        "id": str(l.get("id") or idx + 1),
        "source": _map_source(l.get("source") or "other"),
        "scraped_at": scraped_at,
        "company": {
            "name": l.get("company") or l.get("company_name") or "",
            "website": l.get("website") or None,
            "phone": l.get("phone") or None,
            "address": l.get("address") or None,
            "city": (l.get("city") or "").split(",")[0].strip(),
            "state": l.get("state") or None,
            "country": l.get("country") or "US",
            "industry": l.get("industry") or l.get("category") or None,
            "google_rating": l.get("rating") or None,
            "google_reviews_count": l.get("reviews") or None,
        },
        "primary_contact": {
            "email": l.get("email") or None,
            "name": l.get("contact") or None,
        },
        "scores": {
            "overall_score": score,
            "tier": tier,
        },
        "category": l.get("industry") or l.get("category") or None,
        "tags": [tier, l.get("source") or "shadow_scraper"],
        "data_quality": {
            "completeness_score": _completeness(l),
        },
        "frontend": {
            "display_name": l.get("company") or "",
            "display_phone": l.get("phone") or None,
            "display_phone_link": f"tel:{re.sub(r'[^0-9+]', '', l.get('phone') or '')}",
            "display_email": l.get("email") or None,
            "display_email_link": f"mailto:{l.get('email')}" if l.get("email") else None,
            "description": f"{l.get('industry','contractor')} in {l.get('city','')}, {l.get('state','')}",
            "key_facts": _build_key_facts(l),
        },
        "created_at": scraped_at,
        "updated_at": scraped_at,
        "version": 1,
    }


_VALID_SOURCES = {
    "google_maps", "linkedin", "craigslist", "yelp", "yellowpages",
    "bbb", "angieslist", "homeadvisor", "thumbtack", "houzz",
    "directory", "facebook", "instagram", "twitter", "website",
    "manual", "referral", "trade_show", "cold_call", "other",
}


def _map_source(src: str) -> str:
    src_lower = (src or "").lower().replace("-", "_").replace(" ", "_")
    if src_lower in _VALID_SOURCES:
        return src_lower
    if "google" in src_lower:
        return "google_maps"
    if "yelp" in src_lower:
        return "yelp"
    if "yellow" in src_lower:
        return "yellowpages"
    if "bbb" in src_lower:
        return "bbb"
    return "other"


def _completeness(l: dict) -> float:
    fields = ["company", "phone", "email", "website", "city", "state", "address"]
    filled = sum(1 for f in fields if l.get(f))
    return round(filled / len(fields), 2)


def _build_key_facts(l: dict) -> List[str]:
    facts: List[str] = []
    if l.get("city") and l.get("state"):
        facts.append(f"Located in {l['city']}, {l['state']}")
    if l.get("phone"):
        facts.append(f"Phone: {l['phone']}")
    if l.get("rating") and float(l["rating"]) > 0:
        facts.append(f"Rating: {l['rating']} ⭐")
    if l.get("reviews") and int(l["reviews"]) > 0:
        facts.append(f"{l['reviews']} reviews")
    if l.get("website"):
        facts.append(f"Website: {l['website']}")
    return facts[:5]


# ─────────────────────────────────────────────────────────────────────────────
# Load pipeline data
# ─────────────────────────────────────────────────────────────────────────────

def _load_pipeline_leads(max_leads: int) -> List[dict]:
    """Load the canonical scored_leads.json from the local pipeline."""
    candidates = [
        REPO_ROOT / "leads" / "scored_leads.json",
        REPO_ROOT / "pages" / "data" / "scored_leads.json",
        REPO_ROOT / "data" / "leads" / "scored_leads.json",
        REPO_ROOT / "leads" / "leads.json",
    ]
    for path in candidates:
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                log.info("Loaded %d leads from %s", len(data), path)
                # Sort by lead_score descending; take top N
                data.sort(key=lambda l: l.get("lead_score") or l.get("score") or 0, reverse=True)
                return data[:max_leads]
            except Exception as exc:
                log.warning("Could not read %s: %s", path, exc)
    log.error("No lead data found in any candidate path")
    return []


# ─────────────────────────────────────────────────────────────────────────────
# Publishers
# ─────────────────────────────────────────────────────────────────────────────

def publish_to_leads_repo(leads: List[dict]) -> None:
    """Push enterprise-schema leads to InfinityXOneSystems/LEADS."""
    log.info("Publishing %d leads to %s …", len(leads), LEADS_REPO)

    enterprise_leads = [to_leads_repo_format(l, i) for i, l in enumerate(leads)]
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # 1. Write the full archive: data/leads.json
    full_payload = json.dumps(enterprise_leads, indent=2)
    _upsert_file(
        LEADS_REPO,
        "data/leads.json",
        full_payload,
        f"data: sync {len(leads)} normalised leads from XPS pipeline [{timestamp}]",
    )

    # 2. Write a dated snapshot: data/archive/leads_{date}.json
    _upsert_file(
        LEADS_REPO,
        f"data/archive/leads_{timestamp}.json",
        full_payload,
        f"data: archive snapshot {len(leads)} leads [{timestamp}]",
    )

    # 3. Write a summary manifest: data/manifest.json
    manifest = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "total_leads": len(leads),
        "hot": sum(1 for l in leads if l.get("scores", {}).get("tier") == "hot"),
        "warm": sum(1 for l in leads if l.get("scores", {}).get("tier") == "warm"),
        "cold": sum(1 for l in leads if l.get("scores", {}).get("tier") == "cold"),
        "sources": list({l.get("source", "other") for l in leads}),
        "files": [
            "data/leads.json",
            f"data/archive/leads_{timestamp}.json",
        ],
    }
    _upsert_file(
        LEADS_REPO,
        "data/manifest.json",
        json.dumps(manifest, indent=2),
        f"data: update manifest [{timestamp}]",
    )

    log.info("✅ LEADS repo updated: %d leads", len(leads))


def _build_leads_api() -> str:
    """
    Updated leadsApi.ts — full implementation from contracts/frontend/src/lib/leadsApi.ts.
    Unwraps {leads:[], total} envelope from Express server, normalises
    shadow-scraper fields → frontend Lead type, falls back to /data/leads.json.
    """
    contract_path = REPO_ROOT / "contracts" / "frontend" / "src" / "lib" / "leadsApi.ts"
    if contract_path.exists():
        return contract_path.read_text(encoding="utf-8")
    # Inline fallback if contract file isn't present
    return """\
import { api } from './api'
import type { Lead, DashboardMetrics, ScraperConfig, ScraperLog } from '@/types/lead'

async function _loadStaticLeads(): Promise<Lead[]> {
  try {
    const base = import.meta.env.BASE_URL?.replace(/\\/$/, '') ?? ''
    const resp = await fetch(`${base}/data/leads.json`)
    if (!resp.ok) return []
    const raw: unknown = await resp.json()
    const list = Array.isArray(raw) ? raw : (raw as {leads?:unknown[]}).leads ?? []
    return list as Lead[]
  } catch { return [] }
}

export const leadsApi = {
  async getAll(): Promise<Lead[]> {
    try {
      const raw = await api.get<unknown>('/leads?limit=500')
      const arr = Array.isArray(raw) ? raw : (raw as {leads?:unknown[]}).leads ?? []
      return arr as Lead[]
    } catch {
      return _loadStaticLeads()
    }
  },
  async getById(id: string): Promise<Lead> { return api.get<Lead>(`/leads/${id}`) },
  async create(lead: Omit<Lead,'id'|'createdAt'>): Promise<Lead> { return api.post<Lead>('/leads', lead) },
  async update(id: string, lead: Partial<Lead>): Promise<Lead> { return api.put<Lead>(`/leads/${id}`, lead) },
  async delete(id: string): Promise<void> { return api.delete<void>(`/leads/${id}`) },
  async getMetrics(): Promise<DashboardMetrics> {
    try { return await api.get<DashboardMetrics>('/leads/metrics') }
    catch { return { totalLeads: 0, aPlusOpportunities: 0, emailsSent: 0, responseRate: 0, revenuePipeline: 0 } }
  },
  async assignRep(leadId: string, repId: string, repName: string, repInitials: string): Promise<Lead> {
    return api.post<Lead>(`/leads/${leadId}/assign`, { repId, repName, repInitials })
  },
  async updateStatus(leadId: string, status: Lead['status']): Promise<Lead> {
    return api.put<Lead>(`/leads/${leadId}/status`, { status })
  },
  async addNote(leadId: string, note: string): Promise<Lead> {
    return api.post<Lead>(`/leads/${leadId}/notes`, { note })
  },
}

export const scraperApi = {
  async run(config: ScraperConfig): Promise<{ jobId: string }> {
    return api.post<{ jobId: string }>('/scraper/run', config)
  },
  async getStatus(jobId: string): Promise<ScraperLog> {
    return api.get<ScraperLog>(`/scraper/status/${jobId}`)
  },
  async getLogs(limit = 50): Promise<ScraperLog[]> {
    return api.get<ScraperLog[]>(`/scraper/logs?limit=${limit}`)
  },
  async cancel(jobId: string): Promise<void> {
    return api.post<void>(`/scraper/cancel/${jobId}`, {})
  },
}
"""


def _build_contractors_page() -> str:
    """
    Return the updated ContractorsPage.tsx that uses the real useContractors
    hook instead of a hard-coded MOCK_CONTRACTORS array.
    Reads from contracts/frontend/src/pages/ContractorsPage.tsx if present.
    """
    contract_path = REPO_ROOT / "contracts" / "frontend" / "src" / "pages" / "ContractorsPage.tsx"
    if contract_path.exists():
        return contract_path.read_text(encoding="utf-8")
    return """\
import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  MagnifyingGlass,
  Plus,
  Export,
  Star,
  Phone,
  Envelope,
  MapPin,
  Buildings,
  ArrowsClockwise,
  SpinnerGap,
} from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BackButton } from '@/components/BackButton'
import { toast } from 'sonner'
import { useContractors } from '@/hooks/useContractors'

interface ContractorsPageProps {
  onNavigate: (page: string) => void
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  contacted: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  qualified: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  converted: 'bg-green-500/20 text-green-400 border-green-500/30',
  lost: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export function ContractorsPage({ onNavigate }: ContractorsPageProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [view, setView] = useState<'table' | 'cards'>('table')

  const { contractors, total, loading, setFilters, refresh } = useContractors({ limit: 100 })

  const searchLower = search.toLowerCase()
  const filtered = contractors.filter(c => {
    const matchSearch =
      !search ||
      (c.company || '').toLowerCase().includes(searchLower) ||
      (c.name || '').toLowerCase().includes(searchLower) ||
      (c.email || '').toLowerCase().includes(searchLower)
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    return matchSearch && matchStatus
  })

  const stats = {
    total,
    new: contractors.filter(c => c.status === 'new').length,
    contacted: contractors.filter(c => c.status === 'contacted').length,
    qualified: contractors.filter(c => c.status === 'qualified').length,
    converted: contractors.filter(c => c.status === 'converted').length,
  }

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status)
    setFilters(prev => ({ ...prev, status: status === 'all' ? undefined : status }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton onBack={() => onNavigate('home')} />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contractors Database</h1>
            <p className="text-sm text-muted-foreground">
              {loading
                ? 'Loading real scraped leads…'
                : `${total.toLocaleString()} real scraped contractor leads`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.info('Export coming soon')}>
            <Export size={16} className="mr-2" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { refresh(); toast.success('Refreshed') }}
          >
            <ArrowsClockwise size={16} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button size="sm" onClick={() => toast.info('Add contractor coming soon')}>
            <Plus size={16} className="mr-2" />
            Add Contractor
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground' },
          { label: 'New', value: stats.new, color: 'text-blue-400' },
          { label: 'Contacted', value: stats.contacted, color: 'text-yellow-400' },
          { label: 'Qualified', value: stats.qualified, color: 'text-purple-400' },
          { label: 'Converted', value: stats.converted, color: 'text-green-400' },
        ].map(stat => (
          <motion.div key={stat.label} whileHover={{ scale: 1.02 }}>
            <Card>
              <CardContent className="p-4 text-center">
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlass
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search contractors…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={e => handleStatusFilterChange(e.target.value)}
            className="px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground"
          >
            <option value="all">All Status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="converted">Converted</option>
            <option value="lost">Lost</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setSearch(''); handleStatusFilterChange('all') }}
          >
            <ArrowsClockwise size={16} />
          </Button>
        </div>
        <div className="flex gap-1 border border-border rounded-md p-1">
          <Button
            variant={view === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setView('table')}
          >
            Table
          </Button>
          <Button
            variant={view === 'cards' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setView('cards')}
          >
            Cards
          </Button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-3">
          <SpinnerGap size={24} className="animate-spin" />
          <span>Loading real scraped leads…</span>
        </div>
      )}

      {/* Table View */}
      {!loading && view === 'table' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-muted-foreground font-medium">Company</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Contact</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Location</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Category</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Status</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((contractor, i) => (
                  <motion.tr
                    key={contractor.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.5) }}
                    className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() =>
                      toast.info(`${contractor.company} — Score: ${contractor.score}`)
                    }
                  >
                    <td className="p-4">
                      <div className="font-medium text-foreground">{contractor.company}</div>
                      {contractor.name && contractor.name !== contractor.company && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Buildings size={12} />
                          {contractor.name}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      {contractor.email && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Envelope size={12} />
                          <span className="text-xs">{contractor.email}</span>
                        </div>
                      )}
                      {contractor.phone && (
                        <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
                          <Phone size={12} />
                          <span className="text-xs">{contractor.phone}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin size={12} />
                        {contractor.city}
                        {contractor.state ? `, ${contractor.state}` : ''}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-xs text-muted-foreground">{contractor.category}</span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`text-xs px-2 py-1 rounded-full border ${STATUS_COLORS[contractor.status] ?? STATUS_COLORS.new}`}
                      >
                        {contractor.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <Star size={12} className="text-yellow-400" weight="fill" />
                        <span className="text-xs font-medium">{contractor.score}</span>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users size={40} className="mx-auto mb-3 opacity-50" />
                <p>No contractors found</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Cards View */}
      {!loading && view === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((contractor, i) => (
            <motion.div
              key={contractor.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.6) }}
            >
              <Card className="hover:border-primary/30 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm">{contractor.company}</CardTitle>
                      {contractor.name && contractor.name !== contractor.company && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <Buildings size={11} />
                          {contractor.name}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Star size={12} className="text-yellow-400" weight="fill" />
                      <span className="text-xs font-bold">{contractor.score}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {contractor.email && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Envelope size={11} />
                      {contractor.email}
                    </div>
                  )}
                  {contractor.phone && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone size={11} />
                      {contractor.phone}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin size={11} />
                    {contractor.city}
                    {contractor.state ? `, ${contractor.state}` : ''}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">{contractor.category}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[contractor.status] ?? STATUS_COLORS.new}`}
                    >
                      {contractor.status}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-3 text-center py-12 text-muted-foreground">
              <Users size={40} className="mx-auto mb-3 opacity-50" />
              <p>No contractors found</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
"""


def publish_to_frontend_repo(leads: List[dict]) -> None:
    """
    Push leads in the frontend-compatible schema to
    InfinityXOneSystems/XPS-INTELLIGENCE-FRONTEND.

    Files written:
      public/data/leads.json          — consumed by leadsApi.getAll() when
                                        VITE_API_URL is not set (static build)
      public/data/leads_meta.json     — metadata / last-updated indicator
      src/pages/ContractorsPage.tsx   — replace MOCK_CONTRACTORS with real hook
    """
    log.info("Publishing %d leads to %s …", len(leads), FRONTEND_REPO)

    frontend_leads = [to_frontend_lead(l, i) for i, l in enumerate(leads)]
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    payload = json.dumps(frontend_leads, indent=2)
    _upsert_file(
        FRONTEND_REPO,
        "public/data/leads.json",
        payload,
        f"data: sync {len(leads)} real scraper leads [{timestamp}]",
    )

    meta = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "total": len(leads),
        "hot": sum(1 for l in frontend_leads if l.get("rating") in ("A+", "A")),
        "source": "XPS Intelligence Shadow Scraper Pipeline",
        "api_endpoint": "https://xps-intelligence.up.railway.app/api/leads",
    }
    _upsert_file(
        FRONTEND_REPO,
        "public/data/leads_meta.json",
        json.dumps(meta, indent=2),
        f"data: update leads metadata [{timestamp}]",
    )

    # Push the updated ContractorsPage that uses real data (no mock)
    contractors_page = _build_contractors_page()
    _upsert_file(
        FRONTEND_REPO,
        "src/pages/ContractorsPage.tsx",
        contractors_page,
        f"feat: ContractorsPage — replace mock data with real scraper leads [{timestamp}]",
    )

    # Push updated leadsApi with static-file fallback
    leads_api = _build_leads_api()
    _upsert_file(
        FRONTEND_REPO,
        "src/lib/leadsApi.ts",
        leads_api,
        f"feat: leadsApi — add static-file fallback for offline/static builds [{timestamp}]",
    )

    # Fix .env.production to point to the correct Railway URL
    _upsert_file(
        FRONTEND_REPO,
        ".env.production",
        "VITE_API_URL=https://xps-intelligence.up.railway.app/api\n"
        "VITE_WS_URL=wss://xps-intelligence.up.railway.app\n",
        f"fix: update Railway URL to xps-intelligence.up.railway.app [{timestamp}]",
    )

    log.info("✅ Frontend repo updated: %d leads", len(leads))


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main() -> int:
    # Validate credentials early
    try:
        tok = _resolved_token()
        log.info("Auth resolved (token length=%d)", len(tok))
    except RuntimeError as exc:
        log.error("%s", exc)
        if not DRY_RUN:
            return 1
        log.warning("DRY_RUN=1 — continuing without a real token")

    leads = _load_pipeline_leads(LEADS_MAX)
    if not leads:
        log.error("No leads to publish")
        return 1

    log.info("Loaded %d leads (max=%d)", len(leads), LEADS_MAX)

    # Summary
    hot  = sum(1 for l in leads if (l.get("tier") or "").lower() == "hot")
    warm = sum(1 for l in leads if (l.get("tier") or "").lower() == "warm")
    cold = sum(1 for l in leads if (l.get("tier") or "").lower() == "cold")
    log.info("Tier breakdown — HOT: %d  WARM: %d  COLD: %d", hot, warm, cold)

    errors: List[str] = []

    try:
        publish_to_leads_repo(leads)
    except Exception as exc:
        log.error("Failed to publish to LEADS repo: %s", exc)
        errors.append(f"LEADS repo: {exc}")

    try:
        publish_to_frontend_repo(leads)
    except Exception as exc:
        log.error("Failed to publish to frontend repo: %s", exc)
        errors.append(f"Frontend repo: {exc}")

    if errors:
        for e in errors:
            log.error("  ❌ %s", e)
        return 1

    log.info("🚀 All repos updated successfully")
    return 0


if __name__ == "__main__":
    sys.exit(main())
