# Workflow Governance Framework

> **XPS Intelligence System — TAP-Compliant Workflow Control**
> Version: 1.0.0 | Effective: 2026-03-11

---

## Crisis Context

Before this framework, the repository had:

- **25+ workflow files** in `.github/workflows/`
- **2000+ monthly runs** (exponential growth from nested triggers)
- Auto-cascade chains: `docs_reflection` → auto-commit → triggers `repo_sync` + `lead_validation` + `code_quality` + more
- Duplicate schedulers: `pipeline.yml` + `enterprise_lead_pipeline.yml` + `lead_scraper.yml` all ran every 2h
- Zero centralized dispatch — each workflow triggered independently

**After this framework:** ~100 governed runs/month.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  TIER 0: workflow_dispatcher.yml (Central Guardian)      │
│  Triggers: push main, PR sync, manual, nightly          │
│  Validates SHA + branch, builds dispatch plan           │
└──────────────┬──────────────────────────────────────────┘
               │ workflow_dispatch (controlled)
       ┌───────┴────────────────────────────────┐
       ▼                                        ▼
TIER 1: Quality Gates               TIER 5: Governance
├─ ci.yml                           ├─ merge_guard.yml
├─ code_quality.yml                 ├─ pr_agent.yml
└─ system_validation.yml            └─ issue_triage.yml
       │
       ▼ (main branch only)
TIER 2: Deployment
├─ deploy-backend.yml (Railway)
└─ nextjs.yml (GitHub Pages)
       │
       ▼ (dispatch or scheduled daily max)
TIER 3: Async Intelligence
├─ lead_scraper.yml       ← canonical scraper (was duplicated by scrape-schedule.yml)
├─ lead_validation.yml
├─ social_scraper.yml     (nightly only)
└─ national_discovery.yml (dispatch-only)
       │
       ▼ (dispatch-only)
TIER 4: Self-Healing
├─ docs_reflection.yml    (dispatch-only, no auto-commit)
├─ repo_sync.yml          (dispatch-only)
├─ repo_guardian.yml      (health check, report-only)
├─ runner_health.yml      (diagnostics, no side effects)
├─ autonomous_pipeline.yml (dispatch-only)
├─ pipeline.yml            (dispatch-only)
└─ enterprise_lead_pipeline.yml (dispatch-only)
```

---

## Tier Definitions

### TIER 0 — Guardian

| Property | Value |
|---|---|
| Workflow | `workflow_dispatcher.yml` |
| Triggers | `push:main`, `pull_request:main`, `workflow_dispatch`, `schedule:nightly 03:00 UTC` |
| Purpose | Validate context; dispatch tier-based workflows via `workflow_dispatch` |
| Concurrency | `workflow-dispatcher-${{ github.ref }}` (cancel superseded) |
| Timeout | 10 min |

### TIER 1 — Quality Gates

| Workflow | Purpose | Triggers |
|---|---|---|
| `ci.yml` | Backend lint, tests, frontend build | push main/develop, PR→main, dispatch |
| `code_quality.yml` | Node.js tests, dashboard lint, YAML validation | push main, PR→main, dispatch |
| `system_validation.yml` | Architecture integrity, contract validation | push main, PR→main, dispatch |

### TIER 2 — Deployment

| Workflow | Purpose | Triggers |
|---|---|---|
| `deploy-backend.yml` | FastAPI → Railway | push main (backend paths), dispatch |
| `nextjs.yml` | Dashboard → GitHub Pages | push main (dashboard/ paths), dispatch |

### TIER 3 — Async Intelligence

| Workflow | Purpose | Schedule |
|---|---|---|
| `lead_scraper.yml` | Nationwide scraper (BingMaps + engine) | Once daily 06:00 UTC |
| `lead_validation.yml` | Lead quality gates | dispatch-only |
| `social_scraper.yml` | Social media enrichment | Once daily 02:00 UTC |
| `national_discovery.yml` | National query builder | dispatch-only |

### TIER 4 — Self-Healing (dispatch-only)

| Workflow | Purpose | Auto-commit? |
|---|---|---|
| `docs_reflection.yml` | Living docs generation | NO (report-only) |
| `repo_sync.yml` | Branch synchronisation | NO |
| `repo_guardian.yml` | Health checks | NO (report-only) |
| `runner_health.yml` | Runner diagnostics | NO |
| `autonomous_pipeline.yml` | Full agent pipeline | YES (with [skip ci]) |
| `pipeline.yml` | Lead pipeline | YES (with [skip ci]) |
| `enterprise_lead_pipeline.yml` | Enterprise pipeline | YES (with [skip ci]) |

### TIER 5 — Merge-Time Governance

| Workflow | Trigger | Purpose |
|---|---|---|
| `merge_guard.yml` | `push:main`, `pull_request` | Conflict detection |
| `pr_agent.yml` | `pull_request` | Policy checks |
| `issue_triage.yml` | `issues:opened/labeled` | Copilot routing |

---

## Deprecated Workflows

Moved to `.infinity/deprecated_workflows/` with 90-day retention.

| Original | Reason | Replaced By |
|---|---|---|
| `deploy.yml` | Duplicate Docker build + deploy | `deploy-backend.yml` |
| `scrape-schedule.yml` | Duplicate daily scraper trigger | `lead_scraper.yml` |

---

## Cascade Prevention Rules

### Rule 1: `[skip ci]` on all auto-commits

All workflows that commit data back to the repo **must** include `[skip ci]` in the commit message to prevent downstream trigger cascades:

```yaml
git commit -m "chore: pipeline update [skip ci]"
```

### Rule 2: No `push` triggers on self-healing workflows

Tier 4 workflows must not trigger on `push` events. They are dispatched via:
- Manual `workflow_dispatch`
- Tier 0 nightly governance run
- `repository_dispatch` (from external API calls)

### Rule 3: No duplicate schedulers per domain

| Domain | Canonical Scheduler |
|---|---|
| Lead scraping | `lead_scraper.yml` (daily 06:00) |
| Social enrichment | `social_scraper.yml` (daily 02:00) |
| Docs reflection | `docs_reflection.yml` (weekly via dispatcher) |
| Dependency updates | `update-deps.yml` (weekly Monday) |

### Rule 4: Concurrency limits

Every workflow must declare a `concurrency` group to prevent queue buildup:

```yaml
concurrency:
  group: <workflow-name>-${{ github.ref }}
  cancel-in-progress: true   # for fast-feedback tiers
  # cancel-in-progress: false  # for data-mutating tiers
```

---

## Run Budget

| Tier | Expected Runs/Month | Notes |
|---|---|---|
| 0 (Dispatcher) | ~30 | Every push to main + PRs |
| 1 (Quality Gates) | ~40 | Dispatched by Tier 0 |
| 2 (Deployment) | ~10 | Only on main with path changes |
| 3 (Intelligence) | ~20 | Daily scraper + dispatch |
| 4 (Self-Healing) | ~10 | Weekly dispatch |
| 5 (Governance) | ~20 | PR-driven |
| **TOTAL** | **~130** | *vs 2000+ before* |

---

## Rollback Strategy

1. All deprecated workflows are archived in `.infinity/deprecated_workflows/` — restore by copying back to `.github/workflows/`
2. The dispatcher can be disabled by removing its `schedule:` trigger or adding `if: false` to all dispatch jobs
3. Individual workflows still accept `workflow_dispatch` events and can be triggered manually at any time
4. Workflow run artifacts are retained for 30 days for audit

---

## Configuration

See `.infinity/workflow_config.json` for machine-readable tier definitions, dispatch rules, and cascade prevention enforcement settings.

---

*Governed by the XPS Intelligence TAP-Compliant Architecture. See also: `ARCHITECTURE_CONTRACT.md`*
