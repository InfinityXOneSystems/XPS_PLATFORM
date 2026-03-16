#!/usr/bin/env python3
"""
scripts/fix_xps_frontend_config.py
====================================
Patches the wrong Railway backend URL in the InfinityXOneSystems/XPS-INTELLIGENCE-FRONTEND
repository.  Uses the same GitHub App authentication as publish_leads_to_repos.py.

Problem:  XPS-INTELLIGENCE-FRONTEND has 'xpsintelligencesystem-production.up.railway.app'
          (and 'xps-intelligence-system.up.railway.app') hard-coded in multiple config
          files, causing the UI to show "no backend" because the real Railway service is
          at https://xps-intelligence.up.railway.app

Files patched in XPS-INTELLIGENCE-FRONTEND:
  1. vercel.json                    — VITE_API_URL env + rewrite destinations
  2. .env.production                — VITE_API_URL / VITE_WS_URL
  3. .env.example                   — VITE_API_URL / BACKEND_URL comments
  4. .env.local.example             — production URL comments
  5. pages/api/_proxyHelper.js      — DEFAULT_BACKEND constant
  6. src/lib/leadsApi.ts            — normalise { success, data: { leads } } response shape

Authentication priority (same as publish_leads_to_repos.py):
  1. GitHub App  (GH_APP_ID + GH_APP_PRIVATE_KEY)  — Infinity Orchestrator
  2. GH_PAT personal access token
  3. GITHUB_TOKEN (will 403 for cross-repo writes without App/PAT)

Usage:
    python scripts/fix_xps_frontend_config.py
    DRY_RUN=1 python scripts/fix_xps_frontend_config.py   # show diff only
"""

from __future__ import annotations

import base64
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.request import Request, urlopen
from urllib.error import HTTPError

# ── App auth ──────────────────────────────────────────────────────────────────
_REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_REPO_ROOT))
try:
    from scripts.lib.github_app_auth import get_token as _get_app_token
    _APP_AUTH_AVAILABLE = True
except Exception:
    _APP_AUTH_AVAILABLE = False

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
log = logging.getLogger("fix_frontend")

# ── Constants ─────────────────────────────────────────────────────────────────

GITHUB_API = "https://api.github.com"
FRONTEND_REPO = "InfinityXOneSystems/XPS-INTELLIGENCE-FRONTEND"
BRANCH = "main"
DRY_RUN = os.environ.get("DRY_RUN", "0") == "1"

CORRECT_RAILWAY_URL = "https://xps-intelligence.up.railway.app"
CORRECT_API_URL = f"{CORRECT_RAILWAY_URL}/api"
CORRECT_WS_URL = f"wss://xps-intelligence.up.railway.app"

# ── Auth ──────────────────────────────────────────────────────────────────────


def _resolved_token() -> str:
    if _APP_AUTH_AVAILABLE:
        try:
            tok = _get_app_token(repos=[FRONTEND_REPO])
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


# ── GitHub API helpers ────────────────────────────────────────────────────────


def _gh_request(method: str, path: str, body: Optional[dict] = None) -> dict:
    url = f"{GITHUB_API}{path}"
    headers = {
        "Authorization": f"Bearer {_resolved_token()}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "InfinityOrchestrator-FrontendConfigFixer/1.0",
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
        log.error("GitHub API %s %s → %d: %s", method, path, exc.code, body_text[:400])
        raise


def _get_file(repo: str, file_path: str, branch: str = "main") -> tuple[str, str]:
    """Return (content_string, sha) for a file."""
    resp = _gh_request("GET", f"/repos/{repo}/contents/{file_path}?ref={branch}")
    content = base64.b64decode(resp["content"]).decode("utf-8")
    return content, resp["sha"]


def _upsert_file(
    repo: str,
    file_path: str,
    new_content: str,
    old_sha: str,
    commit_message: str,
    branch: str = "main",
) -> None:
    if DRY_RUN:
        log.info("[DRY-RUN] would update %s → %s", file_path, repo)
        return
    encoded = base64.b64encode(new_content.encode()).decode()
    body: Dict[str, Any] = {
        "message": commit_message,
        "content": encoded,
        "sha": old_sha,
        "branch": branch,
    }
    _gh_request("PUT", f"/repos/{repo}/contents/{file_path}", body=body)
    log.info("✅ Updated %s in %s", file_path, repo)


# ── File patchers ─────────────────────────────────────────────────────────────


def _patch_vercel_json(original: str) -> str:
    """Fix Railway URL in vercel.json rewrite destinations and env block."""
    out = original
    # Fix rewrite destinations
    out = out.replace(
        "https://xpsintelligencesystem-production.up.railway.app",
        CORRECT_RAILWAY_URL,
    )
    out = out.replace(
        "https://xps-intelligence-system.up.railway.app",
        CORRECT_RAILWAY_URL,
    )
    # Fix VITE_API_URL — must end with /api
    import re
    out = re.sub(
        r'("VITE_API_URL"\s*:\s*")https?://[^/"]*/api(")',
        rf'\g<1>{CORRECT_API_URL}\g<2>',
        out,
    )
    # Fix VITE_WS_URL
    out = re.sub(
        r'("VITE_WS_URL"\s*:\s*")wss?://[^"]+(")',
        rf'\g<1>{CORRECT_WS_URL}\g<2>',
        out,
    )
    # Fix BACKEND_URL
    out = out.replace(
        '"BACKEND_URL": "https://xpsintelligencesystem-production.up.railway.app"',
        f'"BACKEND_URL": "{CORRECT_RAILWAY_URL}"',
    )
    return out


def _patch_env_production(original: str) -> str:
    """Fix Railway URL in .env.production"""
    out = original
    out = out.replace("xpsintelligencesystem-production.up.railway.app", "xps-intelligence.up.railway.app")
    out = out.replace("xps-intelligence-system.up.railway.app", "xps-intelligence.up.railway.app")
    return out


def _patch_env_example(original: str) -> str:
    """Fix Railway URL in .env.example"""
    out = original
    out = out.replace("xpsintelligencesystem-production.up.railway.app", "xps-intelligence.up.railway.app")
    out = out.replace("xps-intelligence-system.up.railway.app", "xps-intelligence.up.railway.app")
    return out


def _patch_env_local_example(original: str) -> str:
    """Fix Railway URL references in .env.local.example comments"""
    out = original
    out = out.replace("xpsintelligencesystem-production.up.railway.app", "xps-intelligence.up.railway.app")
    out = out.replace("xps-intelligence-system.up.railway.app", "xps-intelligence.up.railway.app")
    return out


def _patch_proxy_helper(original: str) -> str:
    """Fix DEFAULT_BACKEND in pages/api/_proxyHelper.js"""
    out = original
    out = out.replace(
        "const DEFAULT_BACKEND = 'https://xpsintelligencesystem-production.up.railway.app'",
        f"const DEFAULT_BACKEND = '{CORRECT_RAILWAY_URL}'",
    )
    out = out.replace(
        'const DEFAULT_BACKEND = "https://xpsintelligencesystem-production.up.railway.app"',
        f'const DEFAULT_BACKEND = "{CORRECT_RAILWAY_URL}"',
    )
    out = out.replace(
        "const DEFAULT_BACKEND = 'https://xps-intelligence-system.up.railway.app'",
        f"const DEFAULT_BACKEND = '{CORRECT_RAILWAY_URL}'",
    )
    return out


def _patch_leads_api(original: str) -> str:
    """
    Update src/lib/leadsApi.ts so getAll() normalises the gateway response.

    The Railway gateway returns { success: true, data: { leads: [...], total: N } }
    but the old leadsApi expected a plain Lead[].  This patch adds response
    normalisation to handle both shapes gracefully.
    """
    OLD_GET_ALL = """  async getAll(): Promise<Lead[]> {
    return api.get<Lead[]>('/leads')
  },"""

    NEW_GET_ALL = """  async getAll(): Promise<Lead[]> {
    // The Railway gateway wraps responses: { success, data: { leads, total } }
    // Normalise to a plain Lead[] regardless of which shape arrives.
    const raw = await api.get<unknown>('/leads')
    if (raw && typeof raw === 'object') {
      // Shape: { success: true, data: { leads: [...], total: N } }
      if ('data' in raw) {
        const d = (raw as { data: { leads?: Lead[] } }).data
        return Array.isArray(d?.leads) ? d.leads : []
      }
      // Shape: { leads: [...], total: N, source: '...' }
      if ('leads' in raw) {
        const arr = (raw as { leads?: Lead[] }).leads
        return Array.isArray(arr) ? arr : []
      }
    }
    return Array.isArray(raw) ? (raw as Lead[]) : []
  },"""

    if OLD_GET_ALL in original:
        return original.replace(OLD_GET_ALL, NEW_GET_ALL)

    # Already patched or different formatting — log and leave unchanged
    log.info("leadsApi.ts getAll() already patched or has unexpected format — skipping")
    return original


# ── Main ──────────────────────────────────────────────────────────────────────


PATCHES = [
    ("vercel.json",               _patch_vercel_json,       "fix: correct Railway backend URL in Vercel config"),
    (".env.production",           _patch_env_production,    "fix: correct Railway backend URL in .env.production"),
    (".env.example",              _patch_env_example,       "fix: correct Railway backend URL in .env.example"),
    (".env.local.example",        _patch_env_local_example, "fix: correct Railway backend URL in .env.local.example"),
    ("pages/api/_proxyHelper.js", _patch_proxy_helper,      "fix: correct DEFAULT_BACKEND in Vercel proxy helper"),
    ("src/lib/leadsApi.ts",       _patch_leads_api,         "fix: normalise gateway { success, data } response in leadsApi.getAll"),
]


def main() -> int:
    if DRY_RUN:
        log.info("DRY_RUN=1 — showing what would change without writing")

    log.info("Patching %s on branch %s", FRONTEND_REPO, BRANCH)
    success_count = 0
    skip_count = 0
    fail_count = 0

    for file_path, patcher, commit_msg in PATCHES:
        try:
            original, sha = _get_file(FRONTEND_REPO, file_path, BRANCH)
        except HTTPError as exc:
            if exc.code == 404:
                log.warning("File not found (skip): %s", file_path)
                skip_count += 1
                continue
            log.error("Failed to fetch %s: %s", file_path, exc)
            fail_count += 1
            continue

        patched = patcher(original)
        if patched == original:
            log.info("No change needed: %s", file_path)
            skip_count += 1
            continue

        try:
            _upsert_file(FRONTEND_REPO, file_path, patched, sha, commit_msg, BRANCH)
            success_count += 1
        except Exception as exc:
            log.error("Failed to update %s: %s", file_path, exc)
            fail_count += 1

    log.info(
        "Done — updated: %d  skipped: %d  failed: %d",
        success_count,
        skip_count,
        fail_count,
    )
    return 1 if fail_count > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
