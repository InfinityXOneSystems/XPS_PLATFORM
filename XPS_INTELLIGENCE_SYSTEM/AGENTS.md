# XPS Lead Intelligence — Agent Architecture

> **Purpose:** Defines the AI operating system architecture, agent roles, and
> development conventions for GitHub Copilot autonomous agents working in this
> repository.

---

## System Mission

Build and maintain an autonomous contractor lead generation platform for the
flooring and construction industries.

The system must:

- Discover contractors via web scraping
- Verify and enrich business contact data
- Score leads by quality and relevance
- Automate personalised outreach
- Display intelligence in a dashboard
- Operate autonomously via GitHub Actions

---

## Architecture

```
Orchestrator (agents/orchestrator/)
        │
        ▼
Task Queue (task_queue/ — BullMQ + Redis)
        │
        ▼
Scraper Agents
  ├── Google Maps  (scrapers/google_maps_scraper.js)
  ├── Bing Maps    (scrapers/bing_maps_scraper.js)
  ├── Yelp         (scrapers/yelp_scraper.js)
  └── Directories  (scrapers/directory_scraper.js)
        │
        ▼
Raw Lead Database (db/ — PostgreSQL + SQLite fallback)
        │
        ▼
Validation Engine (validation/lead_validation_pipeline.js)
        │
        ▼
Enrichment Engine (agents/enrichment/ + agents/email/)
        │
        ▼
Lead Scoring (agents/scoring/lead_scoring.js)
        │
        ▼
Outreach Automation (outreach/outreach_engine.js)
        │
        ▼
Dashboard + API
  ├── Static HTML  (pages/)
  ├── Next.js      (dashboard/)
  └── GPT Actions  (agents/gpt_actions/server.js)
```

---

## Agent Roles

| Agent | Location | Responsibility |
|-------|----------|---------------|
| Orchestrator | `agents/orchestrator/infinity_orchestrator.js` | Coordinate all pipeline stages |
| Supervisor | `agent_core/` | FastAPI gateway; gates, plans, executes commands |
| Scraper Agents | `scrapers/` | Collect raw leads from external sources |
| Enrichment Agent | `agents/enrichment/`, `agents/email/` | Discover emails, websites, LinkedIn |
| Scoring Agent | `agents/scoring/` | Compute lead quality scores |
| Outreach Agent | `outreach/` | Send and schedule personalised emails |
| Monitor Agent | `agents/monitor/` | Health-check all subsystems |
| Dedup Agent | `agents/dedupe/` | Remove duplicate leads |

---

## Technology Stack

### Backend

| Technology | Purpose |
|------------|---------|
| Node.js 18+ | Scraper runtime, pipeline scripts |
| Python 3.11+ | AI agent core (FastAPI, LangGraph) |
| Crawlee / Playwright | Browser automation for scrapers |
| PostgreSQL (`pg`) | Primary lead database |
| Redis + BullMQ | Distributed task queue |
| Nodemailer | Email delivery |

### Frontend

| Technology | Purpose |
|------------|---------|
| Next.js 16 | React dashboard (static export) |
| Tailwind CSS | Utility-first styling |
| PWA (SW + Manifest) | Offline support, installability |

### CI/CD

| Technology | Purpose |
|------------|---------|
| GitHub Actions | Autonomous workflows |
| GitHub Pages | Static dashboard hosting |

---

## Lead Scoring Criteria

| Signal | Points |
|--------|--------|
| Website present | +10 |
| Phone present | +10 |
| Email discovered | +15 |
| Address complete | +5 |
| Rating > 4.0 | +10 |
| Reviews > 10 | +5 |
| Website reachable | +15 |
| Industry match | +20 |
| City/state present | +10 |

**Tier thresholds:** HOT ≥ 75 · WARM 50–74 · COLD < 50

---

## Coding Conventions

### Module System

- All Node.js files use `"use strict"` and CommonJS (`require` / `module.exports`).
- Python files use standard imports; the agent core package is `agent_core/`.

### Paths

- Primary lead data: `leads/leads.json` (canonical).
- Legacy fallback: `data/leads/leads.json` (kept for backward compatibility).
- All pipeline scripts **dual-write** to both paths.

### Scoring Field

- Canonical field name: `lead_score`.
- Legacy alias `score` is supported for reading; new code writes `lead_score`.

### Error Handling

- Every scraper wraps its outer loop in `try/finally` and always closes the
  browser instance.
- All pipeline scripts log at `[Module]` prefix level for traceability.

### Tests

- Unit tests live in `tests/*.test.js` and use Node.js built-in `node:test`.
- Run with: `npm test`
- Integration tests: `npm run test:integration`

---

## Agent Permissions

Copilot agents operating in this repository MAY:

- Read all repository files
- Create and commit files to feature branches
- Open pull requests
- Update `data/` and `leads/` directories
- Trigger GitHub Actions workflows

Copilot agents MUST NOT:

- Delete the `leads/` or `data/` directories
- Overwrite the lead database without a backup step
- Commit secrets or credentials
- Push directly to `main` — all changes go through PRs

---

## Development Phases

| Phase | Status | Scope |
|-------|--------|-------|
| 1 — System Architecture | ✅ | Repository structure, DB schema, CI |
| 2 — Scrapers | ✅ | Google Maps, Bing Maps, Yelp, Directory |
| 3 — Validation + Enrichment | ✅ | Dedup, validation pipeline, email discovery |
| 4 — Lead Scoring | ✅ | Scoring engine, tiers, industry detection |
| 5 — Outreach Automation | 🔄 | Nodemailer integration, follow-up scheduler |
| 6 — Dashboard + PWA | ✅ | Next.js, GitHub Pages, service worker |
| 7 — Autonomous Orchestration | ✅ | GitHub Actions cron pipelines |
| 8 — Nationwide Discovery | 🔄 | Multi-source aggregation, progress tracking |

---

## Running the Platform

```bash
# Full stack (Docker)
docker compose up -d

# Individual services
npm run agent:server   # FastAPI agent core  :8000
npm run gateway        # Express GPT gateway :3200
npm run worker         # Task queue worker
npm run dashboard      # Next.js dashboard   :3000

# Pipeline
npm run score          # Score leads
npm run dedup          # Deduplicate leads
npm test               # Run unit tests
```

---

_See also: [MASTER_BLUEPRINT.md](./MASTER_BLUEPRINT.md) · [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) · [IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md)_
