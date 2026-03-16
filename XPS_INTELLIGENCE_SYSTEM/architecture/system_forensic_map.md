# XPS Intelligence — System Forensic Map

**Generated:** 2026-03-10  
**Status:** Phase 1 — Forensic Analysis

---

## Executive Summary

XPS Intelligence is a full-stack autonomous AI platform designed for contractor
lead generation in the flooring and construction industries. The system combines
web scraping, AI enrichment, lead scoring, and personalised outreach into a
self-managing pipeline backed by a Next.js dashboard.

---

## Repository Structure

```
XPS_INTELLIGENCE_SYSTEM/
├── agent_core/          Python FastAPI agent supervisor
├── agents/              50+ specialised agent modules
├── api/                 Express.js REST gateway (port 3200)
├── backend/             FastAPI Python backend (port 8000)
├── contracts/           API schemas and frontend contracts
├── dashboard/           Next.js dashboard (port 3000)
├── data/                Legacy lead data
├── database/            DB schema and migrations
├── db/                  Knex.js DB layer
├── docs/                Technical documentation
├── fault_tolerance/     Circuit breaker / retry / bulkhead
├── frontend/            Frontend contracts and stubs
├── infrastructure/      (NEW) MCP tool infrastructure
├── integrations/        Third-party integrations
├── kernel/              KernelRuntime lifecycle manager
├── leads/               Canonical lead data store
├── llm/                 LLM routing layer
├── memory/              Agent memory system
├── nginx/               Reverse proxy config
├── observability/       Metrics + distributed tracing
├── outreach/            Email outreach engine
├── pages/               Static HTML pages
├── prompts/             Agent prompt templates
├── queue/               Task queue (BullMQ + Redis)
├── reasoning_graph/     (NEW) Agent reasoning graph
├── runtime/             Runtime pipeline components
├── runtime_controller/  Central runtime controller
├── sandbox/             Isolated code execution sandbox
├── scrapers/            Web scraping agents
├── scripts/             Pipeline automation scripts
├── task_dispatcher/     Task dispatch layer
├── task_queue/          Python task queue worker
├── tests/               Unit and integration tests
├── tools/               Data export and sync tools
├── validation/          Lead validation pipeline
├── validators/          Schema validators
├── vision_cortex/       (NEW) Daily intelligence ingestion
├── infinity_library/    (NEW) Knowledge vector store
├── validation_engine/   (NEW) Self-validation system
├── monitoring_engine/   (NEW) System monitoring
├── self_healing_engine/ (NEW) Auto-recovery system
├── playwright_gateway/  (NEW) Browser automation gateway
└── worker_pool/         Async worker pool
```

---

## Frontend Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `pages/index.html` | Static landing page |
| `/dashboard` | Next.js app | Lead intelligence dashboard |
| `/dashboard/leads` | LeadsTable | Paginated lead display |
| `/dashboard/analytics` | Analytics | Lead scoring charts |
| `/dashboard/outreach` | Outreach | Campaign management |
| `/dashboard/settings` | Settings | System configuration |
| `/dashboard/runtime` | RuntimeChat | AI command interface |

---

## Backend APIs

### Express Gateway (api/gateway.js — port 3200)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/status` | System status |
| GET | `/api/leads` | Fetch paginated leads |
| POST | `/api/leads` | Create new lead |
| GET | `/api/leads/:id` | Get lead by ID |
| PUT | `/api/leads/:id` | Update lead |
| DELETE | `/api/leads/:id` | Delete lead |
| GET | `/api/analytics` | Lead analytics |
| POST | `/api/score` | Score lead(s) |
| POST | `/api/outreach/send` | Send outreach email |
| GET | `/api/outreach/logs` | Outreach history |
| OPTIONS | `*` | CORS preflight (204) |

### FastAPI Backend (backend/app/main.py — port 8000)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/v1/status` | System status |
| POST | `/api/v1/runtime/command` | Execute runtime command |
| GET | `/api/v1/runtime/task/{id}` | Poll task status |
| GET | `/api/v1/leads` | Fetch leads |
| POST | `/api/v1/leads` | Create lead |
| GET | `/api/v1/agents` | List agents |
| POST | `/api/v1/agents/{name}/run` | Run specific agent |

---

## Agent Modules

### Python Agents (agents/)

| Agent | Path | Responsibility |
|-------|------|---------------|
| BaseAgent | `agents/base_agent.py` | Base class with retries, events, TaskQueue |
| Orchestrator | `agents/orchestrator/infinity_orchestrator.js` | Pipeline coordination |
| Supervisor | `agent_core/supervisor_agent.py` | FastAPI gateway, command routing |
| SEO Agent | `agents/seo/seo_agent.py` | HTML analysis, keyword strategy |
| Social Agent | `agents/social/social_agent.py` | Profile discovery, scoring |
| Browser Agent | `agents/browser/browser_automation_agent.py` | UI automation |
| Enrichment | `agents/enrichment/` | Email/website discovery |
| Scoring | `agents/scoring/lead_scoring.js` | Lead quality scoring |
| Monitor | `agents/monitor/` | System health checks |
| Dedupe | `agents/dedupe/` | Duplicate removal |
| Parser | `agents/parser/` | Data extraction |
| Crawler | `agents/crawler/` | Web crawling |
| Memory | `agents/memory/` | Agent memory |
| GitHub | `agents/github/` | GitHub integration |
| DevOps | `agents/devops/` | Infrastructure management |

---

## GitHub Actions Workflows

| Workflow | File | Trigger | Description |
|----------|------|---------|-------------|
| CI | `ci.yml` | push/PR to main | Lint + test + build |
| PR Agent | `pr_agent.yml` | PR events | Governance, auto-fix |
| Merge Conflict Guard | `merge_conflict.yml` | PR events | Detect conflicts |
| XPS System Validation | `validation.yml` | PR events | System validation |
| Deploy | `deploy.yml` | push to main | Deploy to Railway/Vercel |

---

## Docker Services (docker-compose.yml)

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| redis | redis:7-alpine | 6379 | Task queue + cache |
| postgres | postgres:16-alpine | 5432 | Primary database |
| backend | Custom Dockerfile | 8000 | FastAPI Python backend |
| gateway | Dockerfile.gateway | 3200 | Express.js API gateway |
| worker | Python | — | Async task worker |
| frontend | Node.js | 3000 | Next.js dashboard |
| qdrant | qdrant:latest | 6333 | Vector database |
| ollama | ollama/ollama | 11434 | Local LLM runtime |
| scraper-worker | Python | — | Scraping pipeline |
| interpreter | Python | — | Open Interpreter |

---

## Scraping Systems

| Source | File | Method |
|--------|------|--------|
| Google Maps | `scrapers/google_maps_scraper.js` | Playwright |
| Bing Maps | `scrapers/bing_maps_scraper.js` | Playwright |
| Yelp | `scrapers/yelp_scraper.js` | Playwright |
| Directories | `scrapers/directory_scraper.js` | HTTP + cheerio |
| Social | `scrapers/social/social_scraper_engine.js` | HTTP |
| Shadow | `vision_cortex/shadow_scraper/` | Stealth crawling |

---

## Data Flow

```
External Sources (Google Maps, Bing, Yelp, Directories)
        │
        ▼ Playwright / HTTP
Scraper Agents (scrapers/)
        │
        ▼ Raw JSON
Lead Database (PostgreSQL + leads/leads.json)
        │
        ▼
Deduplication Engine (agents/dedupe/)
        │
        ▼
Validation Pipeline (validation/lead_validation_pipeline.js)
        │
        ▼
Enrichment Engine (agents/enrichment/, agents/email/)
        │
        ▼
Lead Scoring (agents/scoring/lead_scoring.js)
        │  lead_score field, HOT/WARM/COLD tiers
        ▼
Outreach Engine (outreach/outreach_engine.js)
        │
        ▼
Dashboard (dashboard/ Next.js → GitHub Pages)
```

---

## Runtime Architecture

```
Frontend Command Input (RuntimeCommandChat)
        │ POST /api/v1/runtime/command
        ▼
RuntimeController (backend/app/runtime/runtime_controller.py)
        │
        ▼
CommandRouter → CommandValidator → TaskDispatcher
        │
        ▼
WorkerPool (async workers)
        │
        ▼
SandboxExecutor → Isolated Python execution
        │
        ▼
TaskStateStore → GET /api/v1/runtime/task/{id}
```

---

## Security Architecture

- CORS: Configured in Express gateway
- Auth: JWT tokens (planned; SECRET_KEY env var)  
- Sandbox: Docker container isolation for code execution
- Secrets: Environment variables only, no hardcoded credentials
- Rate Limiting: Express middleware (planned)
- Audit Logs: `logs/` directory, structured JSON

---

## External Integrations

| Service | Purpose | Env Var |
|---------|---------|---------|
| Railway | Backend hosting | `RAILWAY_*` |
| Vercel | Frontend hosting | `VERCEL_*` |
| Cloudflare Tunnel | Secure remote access via vizual-x.com | `CLOUDFLARE_*` |
| OpenAI | LLM inference | `OPENAI_API_KEY` |
| Redis | Queue + cache | `REDIS_URL` |
| PostgreSQL | Primary DB | `DATABASE_URL` |
| Qdrant | Vector search | `QDRANT_URL` |
| Ollama | Local LLM | `OLLAMA_URL` |
| Nodemailer | Email outreach | `SMTP_*` |
| ngrok | Local tunnel | `NGROK_*` |

---

## Lead Scoring Model

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

**Tiers:** HOT ≥ 75 · WARM 50–74 · COLD < 50

---

## Key Conventions

- **Module system:** Node.js uses `"use strict"` + CommonJS (`require`/`module.exports`)
- **Lead data:** Canonical path is `leads/leads.json`; scripts dual-write to `data/leads/leads.json`
- **Score field:** `lead_score` (canonical); `score` supported for legacy reads
- **Error handling:** All scrapers wrap outer loop in `try/finally` and close browser
- **Tests:** `tests/*.test.js` using `node:test`; `npm test` to run
- **Python tests:** `backend/tests/` using pytest; `cd backend && pytest tests/`
- **Logging:** `[Module]` prefix format for traceability

---

## Architecture Gaps Identified

1. **MCP Tool Infrastructure** — No universal tool protocol layer; tools are ad hoc
2. **Agent Orchestration** — CEO/Vision/Strategy-level agents missing
3. **Reasoning Graph** — No decision tracking or loop prevention
4. **Vision Cortex** — Daily intelligence ingestion not yet implemented
5. **Infinity Library** — Knowledge vector store not connected
6. **Self-Analysis System** — No automated self-validation/healing loop
7. **Playwright Gateway** — No centralised browser automation service
8. **Security Vault** — No credential vault; secrets via env vars only

---

_Next: Implement Tier-5 infrastructure (Phases 2–15)_
