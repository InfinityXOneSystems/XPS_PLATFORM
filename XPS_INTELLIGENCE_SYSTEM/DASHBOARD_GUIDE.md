# XPS Intelligence — Frontend Applications Guide

> **⚠️ IMPORTANT FOR ALL AGENTS:** There are THREE separate frontend applications across TWO repos.  
> ALL THREE must be maintained. None should ever be forgotten.

---

## Overview — Three Frontends, One Backend

| | `dashboard/` | `frontend/` | `XPS-INTELLIGENCE-FRONTEND` repo |
|---|---|---|---|
| **Repo** | XPS_INTELLIGENCE_SYSTEM | XPS_INTELLIGENCE_SYSTEM | [XPS-INTELLIGENCE-FRONTEND](https://github.com/InfinityXOneSystems/XPS-INTELLIGENCE-FRONTEND) |
| **Framework** | Next.js 16 (static export) | Vite + React 18 + TypeScript | Vite + React 19 + TypeScript |
| **Package name** | `xps-intelligence-dashboard` | `xps-intelligence-frontend` | `spark-template` |
| **Purpose** | Full enterprise dashboard — 13 pages | AI control panel — 4 tabs | Full CRM/lead app — 20 pages |
| **Deploy target** | GitHub Pages (primary) + Vercel | Vercel (primary) | Vercel |
| **Workflow** | `nextjs.yml`, `dashboard_deploy.yml` | `frontend_deploy.yml` | own repo CI |
| **Backend** | `https://xps-intelligence.up.railway.app` | `https://xps-intelligence.up.railway.app` | `https://xps-intelligence.up.railway.app` |
| **Local dev** | `cd dashboard && npm run dev` → :3001 | `cd frontend && npm run dev` → :5173 | own repo → :5000 |

All three frontends connect to the **same Railway backend** (`api/gateway.js`).

> **⚠️ XPS-INTELLIGENCE-FRONTEND had wrong Railway URLs** causing "no backend" errors.  
> Run `.github/workflows/sync_xps_frontend.yml` to patch them automatically.
| **Local dev** | `cd dashboard && npm run dev` → `http://localhost:3001` | `cd frontend && npm run dev` → `http://localhost:5173` |

Both frontends connect to the **same Railway backend** (Express gateway at `api/gateway.js`).

---

## 1. `dashboard/` — Full Enterprise Dashboard (Next.js)

### Pages

| Route | File | Description |
|-------|------|-------------|
| `/` | `pages/index.js` | Home — navigation grid of all modules |
| `/chat` | `pages/chat.js` | **Autonomous AI Agent** — full 3-panel Manus-style layout; parallel task slots; shadow scraper activity |
| `/leads` | `pages/leads.js` | **Lead Viewer** — search, filter, paginate, export CSV; loads from API + static JSON fallback |
| `/crm` | `pages/crm.js` | Enterprise CRM — pipeline, outreach, follow-up, contacts |
| `/analytics` | `pages/analytics.js` | Lead analytics, pipeline charts, system health |
| `/intelligence` | `pages/intelligence.js` | Vision Cortex — AI intelligence scraper, daily briefings, market opportunities |
| `/invention-lab` | `pages/invention-lab.js` | Idea generation, hypothesis testing, experiment engine |
| `/trends` | `pages/trends.js` | Live trend discovery, niche scanner, competitive intelligence |
| `/guardian` | `pages/guardian.js` | System Guardian — real-time health, anomaly detection, auto-repair |
| `/workspace` | `pages/workspace.js` | Live browser, code editor, UI generation |
| `/studio` | `pages/studio.js` | AI image/video creator, business templates |
| `/connectors` | `pages/connectors.js` | GitHub, Google Workspace, Vercel, Docker MCP |
| `/settings` | `pages/settings.js` | LLM, APIs, scraping, outreach configuration |

### Components

- `components/RuntimeCommandChat.js` — Autonomous LLM chat with tool-call visualisation, parallel worker slots, shadow scraper activity feed

### Static Data (GitHub Pages)

The dashboard bundles static JSON in `public/data/` for offline / GitHub Pages serving:
- `public/data/scored_leads.json` — **auto-synced from `leads/scored_leads.json`** at build time
- `public/data/scoring_report.json` — lead scoring summary
- `public/data/analytics.json` — pre-computed analytics
- `public/data/guardian.json` — system guardian data
- `public/data/intelligence.json` — vision cortex data
- `public/data/trends.json` — market trend data

> The `nextjs.yml` workflow copies `leads/scored_leads.json` → `public/data/scored_leads.json` before building so the GitHub Pages deployment always has the latest lead data.

### Local Development

```bash
cd dashboard
cp .env.local.example .env.local   # configure backend URLs
npm install
npm run dev                         # → http://localhost:3001
```

### Build & Deploy

```bash
# GitHub Pages (auto on push to main)
cd dashboard && npm run build       # outputs to dashboard/out/

# Vercel (auto via dashboard_deploy.yml, or manual)
vercel --prod
```

### Environment Variables

| Variable | Local default | Production |
|----------|--------------|------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3099` | `https://xps-intelligence.up.railway.app` |
| `NEXT_PUBLIC_GATEWAY_URL` | `http://localhost:3099` | `https://xps-intelligence.up.railway.app` |
| `NEXT_PUBLIC_BASE_PATH` | *(empty)* | Set by GitHub Pages / Vercel automatically |

---

## 2. `frontend/` — Vite+React Control Panel

### Tabs

| Tab | Component | Description |
|-----|-----------|-------------|
| 💬 Chat Agent | `CommandChat.tsx` | LLM chat with Groq; smart local fallback reads live lead data; renders GFM markdown tables |
| 📋 Leads | `App.tsx → LeadsPanel` | Lead table with search; normalises all 3 gateway response shapes |
| 🤖 Agent Activity | `AgentActivityFeed.tsx` | Live agent task feed |
| 📊 Task Status | `TaskStatusPanel.tsx` | Runtime task monitor |

### Key files

```
frontend/src/
├── App.tsx                    # Root — tabs, status bar, leads panel
│   └── normaliseLeadsResponse()  # handles { success, data: { leads } } gateway format
├── components/
│   ├── CommandChat.tsx        # LLM chat; react-markdown + remark-gfm; SCRAPE_KEYWORDS[]
│   ├── TaskStatusPanel.tsx    # Task status display
│   └── AgentActivityFeed.tsx  # Agent activity feed
└── lib/
    ├── api.ts                 # Axios client (VITE_API_URL)
    └── runtimeClient.ts       # sendChatMessage, sendCommand, pollTaskUntilDone
```

### Local Development

```bash
cd frontend
npm install
npm run dev                    # → http://localhost:5173
# Backend must be running: cd .. && PORT=3099 node api/gateway.js
```

### Build & Deploy

```bash
cd frontend
VITE_API_URL=https://xps-intelligence.up.railway.app npm run build
# Vercel auto-deploys on push to main (see frontend_deploy.yml)
```

### Environment Variables

| Variable | Local default | Production |
|----------|--------------|------------|
| `VITE_API_URL` | `http://localhost:3099` | `https://xps-intelligence.up.railway.app` |
| `VITE_GATEWAY_URL` | `http://localhost:3099` | `https://xps-intelligence.up.railway.app` |

---

## Backend (shared by both frontends)

Both frontends call the same Railway Express gateway:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/status` | GET | System status, lead count |
| `/api/leads` | GET | Lead list (filter: city, state, minScore, limit, offset) |
| `/api/v1/chat` | POST | LLM chat (Groq when key set; smart local fallback otherwise) |
| `/api/v1/runtime/command` | POST | Dispatch a runtime command |
| `/api/v1/runtime/task/:id` | GET | Poll task status |
| `/api/v1/system/health` | GET | Detailed system health |
| `/api/v1/system/metrics` | GET | Pipeline metrics |

**Smart chat fallback** — when `GROQ_API_KEY` is not set, `buildSmartFallbackReply()` in `api/gateway.js` reads live lead data and answers:
- "find/scrape [keyword] in [city]" → markdown table of matching leads
- "how many leads / stats" → tier breakdown + top sources + top cities
- "best markets" → lead volume by state + top HOT leads
- "what can you do / help" → full capabilities list with live count

---

## Data Flow

```
Universal Shadow Scraper (scripts/universal_shadow_scraper.py)
         │  16 sources: YP, Yelp, BBB, Manta, SuperPages, DDG,
         │  Google Maps HTML, Bing Maps, Local.com, ChamberOfCommerce,
         │  Hotfrog, Playwright headless — NO API KEYS
         ▼
leads/scored_leads.json  (1,159+ real leads, primary)
         │
         ├──▶ pages/data/scored_leads.json   (GitHub Pages static)
         ├──▶ dashboard/public/data/scored_leads.json  (synced at build time)
         ├──▶ Railway PostgreSQL              (db/db.js — backend only)
         └──▶ Supabase                        (nxfbfbipjsfzoefpgrof.supabase.co)
                     │
              Express Gateway (api/gateway.js)
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
  dashboard/ (Next.js)    frontend/ (Vite+React)
  GitHub Pages + Vercel   Vercel
```

---

## Deployment Workflows

| Workflow | Triggers on | Deploys |
|----------|-------------|---------|
| `nextjs.yml` | push to `main` (dashboard/, data/, leads/) | `dashboard/` → GitHub Pages |
| `dashboard_deploy.yml` | push to main/develop/staging (dashboard/, leads/) | `dashboard/` → Vercel |
| `frontend_deploy.yml` | push to main/develop/staging (frontend/) | `frontend/` → Vercel |
| `sync_xps_frontend.yml` | manual / push `scripts/fix_xps_frontend_config.py` | patches XPS-INTELLIGENCE-FRONTEND repo URLs |
| `universal_scraper.yml` | cron 03:00 + 15:00 UTC | Scrapes → updates leads/scored_leads.json |
| `deploy-railway.yml` | push to main | Backend → Railway |

---

## 3. `XPS-INTELLIGENCE-FRONTEND` repo — Full CRM + Lead App (Vite + React 19)

> **Separate GitHub repo:** https://github.com/InfinityXOneSystems/XPS-INTELLIGENCE-FRONTEND

### Tech Stack

| Tech | Version | Purpose |
|------|---------|---------|
| Vite | 7 | Build tool |
| React | 19 | UI framework |
| TypeScript | 5.9 | Type safety |
| Tailwind CSS | 4 | Utility styling |
| Radix UI | latest | Accessible component primitives |
| TanStack Query | 5 | Server state / API caching |
| Recharts | 2 | Charts |
| Groq SDK | built-in | LLM chat (client-side) |
| Vercel Functions | `pages/api/` | Server-side proxy to Railway |

### Pages (20 total)

| Route | Component | Description |
|-------|-----------|-------------|
| `/` (home) | `HomePage` | Dashboard overview |
| `/dashboard` | `DashboardPage` | Lead metrics + stats |
| `/leads` | `LeadsPage` | Lead table with full CRM actions |
| `/prospects` | `ProspectsPage` | Prospect pipeline |
| `/contractors` | `ContractorsPage` | Contractor directory |
| `/pipeline` | `PipelinePage` | Sales pipeline |
| `/scraper` | `ScraperPage` | Trigger scrapers |
| `/leaderboard` | `LeaderboardPage` | Rep leaderboard |
| `/roadmap` | `RoadmapPage` | Product roadmap |
| `/canvas` | `CanvasPage` | Visual workspace |
| `/agent` | `AgentPage` | AI agent interface |
| `/logs` | `SystemLogsPage` | System logs |
| `/tasks` | `TaskQueuePage` | Task queue |
| `/editor` | `CodeEditorPage` | Code editor |
| `/sandbox` | `SandboxPage` | Sandbox environment |
| `/automation` | `AutomationPage` | Automation rules |
| `/reports` | `ReportsPage` | Reports |
| `/docs` | `DocsPage` | Documentation |
| `/settings` | `SettingsPage` | Settings + integrations |

### API Architecture

The frontend calls the Railway backend **directly** via `VITE_API_URL`:
```
Browser → https://xps-intelligence.up.railway.app/api/leads
```

Vercel serverless functions in `pages/api/` serve as a fallback proxy (with mock data
when the backend is unreachable) — they are NOT called by the main React app directly.

### Environment Variables

| Variable | Production value | Purpose |
|----------|-----------------|---------|
| `VITE_API_URL` | `https://xps-intelligence.up.railway.app/api` | Backend API base |
| `VITE_WS_URL` | `wss://xps-intelligence.up.railway.app` | WebSocket URL |
| `BACKEND_URL` | `https://xps-intelligence.up.railway.app` | Serverless function proxy target |
| `AI_GROQ_API_KEY` | set in Vercel settings | LLM chat |

### Known Bug (now auto-fixed)

The repo shipped with wrong Railway URLs:
- `xpsintelligencesystem-production.up.railway.app` — wrong (old name)
- `xps-intelligence-system.up.railway.app` — wrong (never existed)

**Fix:** Run the `sync_xps_frontend.yml` workflow (or `python scripts/fix_xps_frontend_config.py`).
This patches 6 files in the XPS-INTELLIGENCE-FRONTEND repo via GitHub App auth.

---

## Quick Start Checklist

```bash
# 1. Start backend
PORT=3099 node api/gateway.js

# 2. Start dashboard (Next.js, port 3001)
cd dashboard && npm install && npm run dev

# 3. Start frontend control panel (Vite, port 5173)
cd ../frontend && npm install && npm run dev

# 4. Open both
open http://localhost:3001   # Dashboard — 13 pages
open http://localhost:5173   # Frontend control panel — 4 tabs

# 5. XPS-INTELLIGENCE-FRONTEND (separate repo, clone + run separately)
# git clone https://github.com/InfinityXOneSystems/XPS-INTELLIGENCE-FRONTEND
# cd XPS-INTELLIGENCE-FRONTEND && npm install && npm run dev  → :5000
```
