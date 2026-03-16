# XPS Lead Intelligence Platform

> **Autonomous B2B lead generation for the flooring and construction industry.**  
> Discover · Validate · Enrich · Score · Outreach · Dashboard — fully automated.

[![Lead Pipeline](https://github.com/InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM/actions/workflows/lead_pipeline.yml/badge.svg)](https://github.com/InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM/actions/workflows/lead_pipeline.yml)
[![Repo Guardian](https://github.com/InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM/actions/workflows/repo_guardian.yml/badge.svg)](https://github.com/InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM/actions/workflows/repo_guardian.yml)
[![Docs Reflection](https://github.com/InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM/actions/workflows/docs_reflection.yml/badge.svg)](https://github.com/InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM/actions/workflows/docs_reflection.yml)
[![System Validation](https://github.com/InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM/actions/workflows/system_validation.yml/badge.svg)](https://github.com/InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM/actions/workflows/system_validation.yml)
[![Full Autonomous Pipeline](https://github.com/InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM/actions/workflows/pipeline.yml/badge.svg)](https://github.com/InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM/actions/workflows/pipeline.yml)
[![Code Quality](https://github.com/InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM/actions/workflows/code_quality.yml/badge.svg)](https://github.com/InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM/actions/workflows/code_quality.yml)
[![Repo Sync](https://github.com/InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM/actions/workflows/repo_sync.yml/badge.svg)](https://github.com/InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM/actions/workflows/repo_sync.yml)

---

## What Is This?

The **XPS Lead Intelligence Platform** is an open-source, autonomous lead generation system built specifically for flooring and construction contractors. It:

- 🔍 **Discovers** contractors from Google Maps, Bing Maps, Yelp, and directories
- ✅ **Validates** and deduplicates contact data
- 📊 **Enriches** records with emails, LinkedIn profiles, and additional contacts
- 🏆 **Scores** leads 0–100 using a proprietary quality model
- 📧 **Automates outreach** with personalized email sequences
- 📱 **Displays** leads in a real-time PWA dashboard with dark/light mode
- 🤖 **Operates autonomously** via GitHub Actions — no human required
- 🛡️ **Self-heals** via the Repo Guardian — auto-detects and fixes system issues

**Phase 7 is active.** The full autonomous pipeline, dashboard, scoring engine, outreach automation, and Repo Guardian are all operational.

### Live Dashboard & Leads

🌐 **[Live Dashboard](https://infinityxonesystems.github.io/XPS_INTELLIGENCE_SYSTEM/)** — Full analytics and control panel

📋 **[View Leads](https://infinityxonesystems.github.io/XPS_INTELLIGENCE_SYSTEM/pages/leads.html)** — Browse, filter, paginate and export all contractor leads via Gmail

---

## Quickstart

### Prerequisites

- Node.js 20+
- PostgreSQL 14+ (optional; falls back to JSON-only mode)
- Git

### 1. Clone and Install

```bash
git clone https://github.com/InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM.git
cd XPS_INTELLIGENCE_SYSTEM
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD, etc.
```

### 3. Initialize Database (optional but recommended)

```bash
node -e "require('./db/db').initSchema().then(() => { console.log('Schema ready'); process.exit(0); })"
```

### 4. Run Lead Scoring

```bash
npm run score
# Outputs: leads/scored_leads.json, leads/scoring_report.json
#          (also copies to data/leads/ for backward compatibility)
```

### 5. Export Dashboard Snapshots

```bash
npm run export
# Reads from PostgreSQL (or falls back to JSON) and writes:
#   leads/scored_leads.json             (primary)
#   dashboard/public/data/scored_leads.json
#   dashboard/public/data/scoring_report.json
```

### 6. Start the Dashboard

```bash
cd dashboard
npm install
npm run dev
# Open http://localhost:3000
```

### 7. Start GPT Actions API (Copilot Mobile / Custom GPT)

```bash
npm run gpt-actions
# Server on http://localhost:3100
# OpenAPI spec: http://localhost:3100/openapi.json
```

### 8. Update Living Docs

```bash
npm run docs
# Updates docs/REPO_MAP.md, docs/TODO.md, docs/STATUS.md, docs/SELF_REVIEW.md
```

---

## Operations

### Autonomous Pipeline

The lead pipeline runs automatically via GitHub Actions every 4 hours:

| Workflow | Schedule | Purpose |
|---|---|---|
| **Lead Intelligence Pipeline** | **Every 4h + dispatch** | **Full pipeline: scrape → validate → score → export** |
| **Repo Guardian** | **Every 6h** | **Health monitor + auto-fix + issue creation** |
| Lead Validation | Push / PR | Validate lead data + post PR comments |
| Code Quality | Push / PR | Tests, lint, workflow YAML checks |
| PR Agent | Pull request | Policy check + safe auto-fix (trusted branches) |
| **Docs Reflection** | **Daily + Push** | **Update living docs, self-review, create issues** |
| National Discovery | Configurable | Nationwide contractor discovery |
| System Validation | Push / PR | Health checks |

**Trigger pipeline manually:**
1. Go to [Actions tab](https://github.com/InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM/actions)
2. Select **Lead Intelligence Pipeline**
3. Click **Run workflow**

The **Repo Guardian** (`repo_guardian.yml`) autonomously:
- Runs health checks every 6 hours
- Auto-fixes UTF-16 encoded files
- Ensures required directories exist
- Re-generates missing scored leads
- Creates GitHub Issues when tests fail
- Refreshes living docs when all checks pass

See [docs/RUNBOOK.md](docs/RUNBOOK.md) for the complete operations guide.

### Required GitHub Secrets

| Secret | Purpose |
|---|---|
| `DATABASE_HOST` | PostgreSQL host |
| `DATABASE_NAME` | PostgreSQL database name |
| `DATABASE_USER` | PostgreSQL user |
| `DATABASE_PASSWORD` | PostgreSQL password |
| `DATABASE_SSL` | `true` if SSL required |
| `SMTP_HOST` | Email server (outreach) |
| `SMTP_PORT` | Email server port |
| `SMTP_USER` | Email username |
| `SMTP_PASS` | Email password |
| `OUTREACH_FROM_EMAIL` | Sender email address |

`GITHUB_TOKEN` is auto-provided by GitHub Actions.

### Runbooks

See **[docs/RUNBOOKS.md](docs/RUNBOOKS.md)** for step-by-step operational procedures including:
- System bootstrap
- Manual pipeline runs
- Dashboard deployment
- Database setup
- Troubleshooting guide
- Emergency rollback

---

## Documentation

| Document | Description |
|---|---|
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | **Complete operations runbook** (start here) |
| [docs/VISION.md](docs/VISION.md) | Product vision, mission, and principles |
| [docs/BLUEPRINT.md](docs/BLUEPRINT.md) | System blueprint: components and data flow |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical architecture and deployment |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Development phases and milestones |
| [docs/SOP.md](docs/SOP.md) | Standard operating procedures |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Operations guide |
| [docs/RUNBOOKS.md](docs/RUNBOOKS.md) | Step-by-step operational runbooks |
| [docs/SECURITY.md](docs/SECURITY.md) | Security policy and threat model |
| [docs/DATA_GOVERNANCE.md](docs/DATA_GOVERNANCE.md) | Data sources, compliance, retention |
| [docs/GLOSSARY.md](docs/GLOSSARY.md) | Key terms and definitions |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Architecture decision log (ADR-lite) |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Release history |
| [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md) | Vision vs. implementation tracker |

### Auto-Generated Living Docs

These are updated automatically by `tools/docs/evolve_docs.js` and the `docs_reflection` workflow:

| Document | Description |
|---|---|
| [docs/REPO_MAP.md](docs/REPO_MAP.md) | Repository file tree + key entrypoints |
| [docs/TODO.md](docs/TODO.md) | Open TODO items from codebase |
| [docs/TODO.json](docs/TODO.json) | Machine-readable TODO data |
| [docs/STATUS.md](docs/STATUS.md) | Current pipeline status |
| [docs/SELF_REVIEW.md](docs/SELF_REVIEW.md) | Automated repo review + recommendations |
| [docs/todo.html](docs/todo.html) | Interactive TODO web dashboard |

### Investor Materials

| Document | Description |
|---|---|
| [docs/INVESTOR_OVERVIEW.md](docs/INVESTOR_OVERVIEW.md) | One-pager: problem, solution, market |
| [docs/INVESTOR_DECK_OUTLINE.md](docs/INVESTOR_DECK_OUTLINE.md) | Slide-by-slide pitch deck outline |

---

## Architecture

```
Orchestrator → Task Queue → Scrapers → Raw Data → Validation
    → Enrichment → Lead Scoring → Outreach → Dashboard + API
```

**Tech Stack:**
- **Backend:** Node.js, Crawlee, Playwright, Express, PostgreSQL, Redis
- **Dashboard:** Next.js 16, Tailwind CSS, TypeScript, PWA
- **CI/CD:** GitHub Actions, GitHub Pages
- **AI:** OpenAI (optional enrichment)

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full details.

---

## Project Structure

```
XPS_INTELLIGENCE_SYSTEM/
├── leads/           — 📁 PRIMARY LEADS FOLDER (all lead data files live here)
│   ├── leads.json          — raw scraped leads
│   ├── scored_leads.json   — scored & ranked leads
│   ├── scoring_report.json — scoring summary & tier breakdown
│   ├── validated_leads.json
│   ├── validation_report.json
│   ├── duplicates.json
│   └── invalid_leads.json
├── agents/          — Pipeline agents (orchestrator, scoring, email, etc.)
├── scrapers/        — Web scrapers (Google Maps, Bing, etc.)
├── outreach/        — Email outreach automation
├── db/              — PostgreSQL database layer
├── dashboard/       — ⭐ Next.js enterprise dashboard (13 pages: Chat, Leads, CRM, Analytics, Vision Cortex, etc.) → GitHub Pages + Vercel
├── frontend/        — ⭐ Vite+React control panel (4 tabs: Chat Agent, Leads, Agent Activity, Task Status) → Vercel
├── pages/           — Static HTML dashboard (GitHub Pages legacy)
├── data/            — Pipeline outputs (exports, datasets; leads/ is primary)
├── docs/            — Documentation suite
├── tools/docs/      — evolve_docs.js + create_issues.js
├── tests/           — Unit tests
└── .github/         — GitHub Actions workflows
```

> **⚠️ THREE FRONTENDS across TWO repos:**
> - `dashboard/` (Next.js, 13 pages) — this repo
> - `frontend/` (Vite+React, 4 tabs) — this repo  
> - [`XPS-INTELLIGENCE-FRONTEND`](https://github.com/InfinityXOneSystems/XPS-INTELLIGENCE-FRONTEND) (Vite+React 19, 20 pages) — **separate repo**
>
> See [DASHBOARD_GUIDE.md](DASHBOARD_GUIDE.md) for full documentation of all three.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes following the code style
4. Run tests: `npm test`
5. Open a Pull Request

See [docs/SOP.md](docs/SOP.md) for development procedures.

---

## License

ISC License — see [LICENSE](LICENSE) for details.

---

## Links

- **Dashboard — Next.js (GitHub Pages):** [https://infinityxonesystems.github.io/XPS_INTELLIGENCE_SYSTEM/](https://infinityxonesystems.github.io/XPS_INTELLIGENCE_SYSTEM/)
- **Dashboard — Next.js (Vercel):** [https://xps-intelligence-dashboard.vercel.app](https://xps-intelligence-dashboard.vercel.app) *(dashboard/)*
- **Frontend Control Panel (Vercel):** [https://xps-intelligence.vercel.app](https://xps-intelligence.vercel.app) *(frontend/)*
- **XPS-INTELLIGENCE-FRONTEND (separate repo):** [https://github.com/InfinityXOneSystems/XPS-INTELLIGENCE-FRONTEND](https://github.com/InfinityXOneSystems/XPS-INTELLIGENCE-FRONTEND)
- **Backend API (Railway):** [https://xps-intelligence.up.railway.app](https://xps-intelligence.up.railway.app)
- **Frontend Guide:** [DASHBOARD_GUIDE.md](DASHBOARD_GUIDE.md)
- **GitHub:** [https://github.com/InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM](https://github.com/InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM)
- **Issues:** [https://github.com/InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM/issues](https://github.com/InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM/issues)