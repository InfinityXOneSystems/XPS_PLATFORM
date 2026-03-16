# XPS Lead Intelligence — Implementation Checklist

> **Purpose:** Track the gap between the VISION/BLUEPRINT and the current codebase.  
> **Updated:** 2026-03-06  
> **Legend:** ✅ Complete · 🔄 Partial · ❌ Not Started · 🔧 In Progress

---

## Phase 1 — System Architecture ✅

| Component | Status | Location |
|-----------|--------|----------|
| Repository structure | ✅ | Root directories |
| Module separation | ✅ | `agents/`, `scrapers/`, `db/`, `validation/`, `outreach/` |
| CommonJS module system | ✅ | `package.json` |
| Environment config | ✅ | `.env.example`, `dotenv` |
| PostgreSQL DB layer | ✅ | `db/db.js`, `db/schema.sql`, `db/leadStore.js` |
| GitHub Actions CI | ✅ | `.github/workflows/` |
| ESLint / code quality | ✅ | `.github/workflows/code_quality.yml` |

---

## Phase 2 — Scrapers ✅

| Component | Status | Location |
|-----------|--------|----------|
| Google Maps scraper | ✅ | `scrapers/google_maps_scraper.js` |
| Bing Maps scraper | ✅ | `scrapers/bing_maps_scraper.js` |
| Scraper engine (Crawlee) | ✅ | `scrapers/engine.js` |
| Scraper queue (BullMQ) | ✅ | `scrapers/scraper_queue.js` |
| Keyword dataset | ✅ | `data/datasets/XPS_LEAD_INTELLIGENCE_SYSTEM/keywords.csv` |
| Locations dataset | ✅ | `data/datasets/XPS_LEAD_INTELLIGENCE_SYSTEM/locations.csv` |
| Nationwide discovery workflow | ✅ | `.github/workflows/lead_scraper.yml` |
| Yelp scraper | ✅ | `scrapers/yelp_scraper.js` |
| Contractor directory scrapers | ✅ | `scrapers/directory_scraper.js` (Angi + HomeAdvisor) |

---

## Phase 3 — Validation + Enrichment ✅

| Component | Status | Location |
|-----------|--------|----------|
| Lead validator | ✅ | `validators/lead_validator.js` |
| Deduplication engine | ✅ | `validation/dedupe.js` |
| Validation pipeline | ✅ | `validation/lead_validation_pipeline.js` |
| Contract validator | ✅ | `validators/lead_contract_validator.js` |
| Email discovery | 🔄 | `agents/email/` — stub, needs SMTP integration |
| LinkedIn enrichment | ❌ | Not implemented — planned |
| Website reachability check | 🔄 | Basic URL validation in `validators/lead_validator.js` |
| Enrichment agent | 🔄 | `agents/discovery/` — partial |

---

## Phase 4 — Lead Scoring ✅

| Component | Status | Location |
|-----------|--------|----------|
| Scoring engine | ✅ | `agents/scoring/lead_scoring.js` |
| Scoring pipeline | ✅ | `agents/scoring/scoring_pipeline.js` |
| Score criteria (website +10, email +15, phone +10, reviews +5, rating +10) | ✅ | `agents/scoring/lead_scoring.js` |
| HOT/WARM/COLD tiers | ✅ | `agents/scoring/lead_scoring.js` |
| Industry detection | ✅ | `agents/scoring/lead_scoring.js` |
| Geography scoring | ✅ | `agents/scoring/lead_scoring.js` |
| Unit tests for scoring | ✅ | `tests/lead_scoring.test.js` |
| Unit tests for validation | ✅ | `tests/validation.test.js` |

---

## Phase 5 — Outreach Automation 🔄

| Component | Status | Location |
|-----------|--------|----------|
| Outreach engine | ✅ | `outreach/outreach_engine.js` |
| Follow-up scheduler | ✅ | `outreach/follow_up_scheduler.js` |
| Outreach log | ✅ | `outreach/outreach_log.js` |
| Email templates | ✅ | `outreach/templates/outreach_templates.csv` |
| SMTP integration (Nodemailer) | 🔄 | Simulated — needs real credentials in `.env` |
| SendGrid integration | ❌ | Planned as optional alternative |
| Unsubscribe handling | ❌ | Not implemented |
| Outreach unit tests | ❌ | `tests/outreach.test.js` — not yet created |
| Outreach in pipeline workflow | ✅ | `.github/workflows/lead_pipeline.yml` Stage 4 |

---

## Phase 6 — Dashboard + PWA ✅

| Component | Status | Location |
|-----------|--------|----------|
| Static HTML dashboard | ✅ | `pages/index.html` |
| Dashboard CSS (dark theme) | ✅ | `pages/dashboard.css` |
| Dashboard JS (charts, filters, terminal) | ✅ | `pages/dashboard.js` |
| PWA manifest | ✅ | `pages/manifest.webmanifest` |
| Service worker | ✅ | `pages/sw.js` |
| Dark / light mode toggle | ✅ | `pages/index.html` |
| Chart.js charts (industry, status, score) | ✅ | `pages/dashboard.js` |
| Lead table with pagination | ✅ | `pages/dashboard.js` |
| Filter bar | ✅ | `pages/index.html`, `pages/dashboard.js` |
| Command terminal | ✅ | `pages/index.html`, `pages/dashboard.js` |
| Analytics tab | ✅ | `pages/index.html` |
| Next.js dashboard | ✅ | `dashboard/` |
| GitHub Pages deployment | ✅ | `.github/workflows/nextjs.yml` |
| PWA install + offline support | ✅ | `pages/sw.js` |
| Push notifications | ❌ | Not implemented |
| Mobile responsive | ✅ | `pages/dashboard.css` |

---

## Phase 7 — Autonomous Orchestration ✅

| Component | Status | Location |
|-----------|--------|----------|
| Full pipeline workflow | ✅ | `.github/workflows/lead_pipeline.yml` |
| 4-hour schedule | ✅ | `lead_pipeline.yml` cron |
| Repo Guardian | ✅ | `.github/workflows/repo_guardian.yml` |
| System validation workflow | ✅ | `.github/workflows/system_validation.yml` |
| Docs auto-update workflow | ✅ | `.github/workflows/docs_reflection.yml` |
| PR governance agent | ✅ | `.github/workflows/pr_agent.yml` |
| Autonomous issue creation | ✅ | `repo_guardian.yml` → `create-issues` job |
| Auto-merge dependabot PRs | ❌ | Planned |
| Scraping progress tracking | ✅ | `data/scraper_progress.json` |
| Living docs | ✅ | `tools/docs/evolve_docs.js` |

---

## Phase 8 — Nationwide Lead Discovery 🔄

| Component | Status | Location |
|-----------|--------|----------|
| Nationwide location dataset | ✅ | `data/datasets/XPS_LEAD_INTELLIGENCE_SYSTEM/locations.csv` |
| Keyword dataset | ✅ | `data/datasets/XPS_LEAD_INTELLIGENCE_SYSTEM/keywords.csv` |
| Batch processing logic | ✅ | `scrapers/google_maps_scraper.js` |
| State-level filtering | ✅ | `lead_scraper.yml`, `lead_pipeline.yml` |
| Progress persistence | ✅ | `data/scraper_progress.json` |
| Concurrent scraping | ✅ | `scrapers/engine.js` |
| Yelp scraper | ✅ | `scrapers/yelp_scraper.js` |
| Multi-source aggregation | ✅ | Google + Bing + Yelp + Angi + HomeAdvisor |
| Contractor directory scrapers | ✅ | `scrapers/directory_scraper.js` |

---

## Documentation ✅

| Document | Status | Location |
|----------|--------|----------|
| README | ✅ | `README.md` |
| Architecture | ✅ | `docs/ARCHITECTURE.md` |
| Blueprint | ✅ | `docs/BLUEPRINT.md` |
| Master Blueprint | ✅ | `MASTER_BLUEPRINT.md` |
| Roadmap | ✅ | `docs/ROADMAP.md`, `ROADMAP.md` |
| Vision | ✅ | `VISION.md`, `docs/VISION.md` |
| Strategy | ✅ | `STRATEGY.md` |
| Agent Governance | ✅ | `AGENT_GOVERNANCE.md` |
| **AGENTS.md (Copilot agent instructions)** | ✅ | `AGENTS.md` |
| Data Governance | ✅ | `docs/DATA_GOVERNANCE.md` |
| Security policy | ✅ | `docs/SECURITY.md` |
| Operations manual | ✅ | `docs/OPERATIONS.md` |
| Glossary | ✅ | `docs/GLOSSARY.md` |
| Dashboard guide | ✅ | `DASHBOARD_GUIDE.md` |
| Repo map | ✅ | `docs/REPO_MAP.md` |
| Changelog | ✅ | `docs/CHANGELOG.md` |
| **Runbooks** | ✅ | `docs/RUNBOOKS.md` |
| **Implementation Checklist** | ✅ | `IMPLEMENTATION_CHECKLIST.md` |

---

## Open Items / Backlog

| Priority | Item | Notes |
|----------|------|-------|
| HIGH | Implement real SMTP in outreach engine | Add `SMTP_*` env vars and wire up Nodemailer |
| HIGH | Yelp scraper | Add Playwright-based Yelp scraper |
| HIGH | Outreach unit tests | Add `tests/outreach.test.js` |
| MEDIUM | LinkedIn enrichment agent | Scrape LinkedIn for company contacts |
| MEDIUM | Push notifications for HOT leads | Service Worker Push API |
| MEDIUM | Auto-merge Dependabot PRs | Add `dependabot-automerge.yml` |
| MEDIUM | Contractor directory scrapers | HomeAdvisor, Angi, Thumbtack |
| LOW | SendGrid integration | Optional alternative to Nodemailer |
| LOW | Unsubscribe handling | GDPR-compliant opt-out |
| LOW | Dashboard PWA push notifications | Notify on new HOT leads |

---

_This checklist is maintained as part of the XPS Lead Intelligence autonomous repository operations._
