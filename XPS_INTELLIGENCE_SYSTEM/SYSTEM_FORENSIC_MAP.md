# SYSTEM_FORENSIC_MAP.md

> **Purpose:** Authoritative forensic map of the XPS Intelligence System repository.
> Generated from live codebase analysis. Last updated: 2025.

---

## Table of Contents

1. [Architecture Diagram](#1-architecture-diagram)
2. [Backend Services](#2-backend-services)
3. [Frontend Services](#3-frontend-services)
4. [API Routes Inventory](#4-api-routes-inventory)
5. [Agent Modules Inventory](#5-agent-modules-inventory)
6. [Database Schemas](#6-database-schemas)
7. [Automation Pipelines](#7-automation-pipelines)
8. [Scraping Systems](#8-scraping-systems)
9. [Dependency Graph](#9-dependency-graph)
10. [Execution Flow](#10-execution-flow)
11. [Bottlenecks Identified](#11-bottlenecks-identified)
12. [Security Risks](#12-security-risks)

---

## 1. Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         XPS INTELLIGENCE PLATFORM                            │
├─────────────────────────────┬────────────────────────────────────────────────┤
│       FRONTEND LAYER        │              BACKEND LAYER                     │
│                             │                                                │
│  ┌──────────────────────┐   │   ┌─────────────────────────────────────────┐  │
│  │  XPS-INTELLIGENCE-   │   │   │  FastAPI  (Railway :8000)               │  │
│  │  FRONTEND            │   │   │  backend/app/main.py                    │  │
│  │  Vite + React + TS   │───┼──►│  /api/v1/*  (11 route modules)         │  │
│  │  (Vercel)            │   │   │                                         │  │
│  └──────────────────────┘   │   │  ┌──────────────┐  ┌────────────────┐  │  │
│                             │   │  │ RuntimeCtrl  │  │  WorkerPool    │  │  │
│  ┌──────────────────────┐   │   │  │ (Python)     │  │  n=4 workers   │  │  │
│  │  Next.js Dashboard   │   │   │  └──────┬───────┘  └───────┬────────┘  │  │
│  │  ./dashboard/        │   │   │         │                   │           │  │
│  │  (GitHub Pages)      │───┼──►│  ┌──────▼───────────────────▼────────┐  │  │
│  └──────────────────────┘   │   │  │         TaskDispatcher             │  │  │
│                             │   │  │  Inline (fast) / Queued (async)    │  │  │
│  ┌──────────────────────┐   │   │  └──────────────────────┬────────────┘  │  │
│  │  Express Gateway     │   │   │                         │               │  │
│  │  api/gateway.js      │   │   │  ┌──────────────────────▼────────────┐  │  │
│  │  :3200               │───┼──►│  │    Redis TaskQueue (BullMQ)       │  │  │
│  └──────────────────────┘   │   │  │    task_queue/redis_queue.py      │  │  │
│                             │   │  └──────────────────────┬────────────┘  │  │
└─────────────────────────────┘   │                         │               │  │
                                  │  ┌──────────────────────▼────────────┐  │  │
                                  │  │         AGENT LAYER               │  │  │
                                  │  │                                   │  │  │
                                  │  │  Scraper  Enrichment  Scoring     │  │  │
                                  │  │  Outreach  Monitor   Dedup        │  │  │
                                  │  │  Prediction  Simulation  SEO      │  │  │
                                  │  └──────────────────────┬────────────┘  │  │
                                  │                         │               │  │
                                  │  ┌──────────────────────▼────────────┐  │  │
                                  │  │       DATA LAYER                  │  │  │
                                  │  │  PostgreSQL  Redis  Qdrant        │  │  │
                                  │  │  SQLite (fallback)                │  │  │
                                  │  │  leads/leads.json (canonical)     │  │  │
                                  │  └───────────────────────────────────┘  │  │
                                  └─────────────────────────────────────────┘  │
                                                                                │
└──────────────────────────────────────────────────────────────────────────────┘

GitHub Actions (25 workflows)
  ├── enterprise_lead_pipeline.yml  (2hr cron — scrape → validate → score → export)
  ├── autonomous_pipeline.yml       (scheduled orchestration)
  ├── national_discovery.yml        (multi-source lead discovery)
  ├── lead_scraper.yml              (scraper triggers)
  ├── deploy-backend.yml            (Railway push deploy)
  ├── nextjs.yml                    (GitHub Pages deploy)
  └── system_validation.yml        (pytest + integration tests)
```

---

## 2. Backend Services

### 2.1 FastAPI Backend (`backend/`)

| Property | Value |
|----------|-------|
| Framework | FastAPI 0.111+ |
| Runtime | Python 3.11+ / Uvicorn |
| Deployment | Railway (`https://xpsintelligencesystem-production.up.railway.app`) |
| Start command | `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Docs UI | `/docs` (Swagger), `/redoc` |
| Metrics | `/metrics` (Prometheus counters + histograms) |
| Health | `/health` |

**Key modules:**

```
backend/
├── app/
│   ├── main.py             # FastAPI app, CORS, lifespan, Prometheus middleware
│   ├── config.py           # Pydantic settings (env-driven)
│   ├── database.py         # SQLAlchemy engine, session factory
│   ├── celery_app.py       # Celery (optional async tasks)
│   └── api/v1/
│       ├── leads.py        # Contractor CRUD + CSV export
│       ├── scrapers.py     # Scrape job management
│       ├── agents.py       # Agent lifecycle (start/stop/logs)
│       ├── runtime.py      # Runtime command execution
│       ├── commands.py     # Natural-language command parser
│       ├── outreach.py     # Email campaign management
│       ├── system.py       # System health + metrics
│       ├── admin.py        # Admin CRUD (users, features, settings)
│       ├── connectors.py   # External service connectors (Vercel, GitHub, Docker)
│       ├── crm.py          # CRM pipeline management
│       └── multi_agent.py  # Multi-agent session orchestration
├── alembic/                # Database migrations
└── tests/                  # pytest test suite (7 test modules)
```

### 2.2 Express Gateway (`api/gateway.js`)

| Property | Value |
|----------|-------|
| Framework | Express 5.x |
| Port | 3200 |
| Purpose | GPT Actions bridge, rate-limiting proxy, webhook entry point |
| Railway service | `api-gateway` |

### 2.3 Infinity Orchestrator (`agents/orchestrator/infinity_orchestrator.js`)

| Property | Value |
|----------|-------|
| Framework | Express |
| Port | 3300 |
| Purpose | GitHub webhook handler, slash-command router (`/scrape`, `/score`, `/outreach`) |
| Auth | HMAC-SHA256 webhook signature validation |

### 2.4 GPT Actions Server (`agents/gpt_actions/server.js`)

| Property | Value |
|----------|-------|
| Purpose | OpenAI GPT Actions plugin endpoint |
| Start | `npm run gpt-actions` |

### 2.5 Python Agent Core (`agent_core/`)

| Module | Purpose |
|--------|---------|
| `api.py` | FastAPI sub-app (port 8000) |
| `command_router.py` | Routes natural-language commands to handlers |
| `orchestrator.py` | Python-side orchestration logic |
| `langgraph_runtime.py` | LangGraph state machine for multi-step agent flows |
| `planner.py` | Task planning and decomposition |
| `executor.py` | Safe command execution |
| `gates.py` | Permission gates (validates agent actions before execution) |
| `validator.py` | Output schema validation |
| `state_manager.py` | Shared state across agent runs |
| `chat_interpreter.py` | Natural-language → command translation |

### 2.6 Runtime Layer (`runtime/`)

| Module | Purpose |
|--------|---------|
| `runtime_controller.py` | Central controller: command routing, agent lifecycle, metrics |
| `sandbox_executor.py` | Sandboxed agent execution (network + filesystem boundaries) |
| `task_dispatcher.py` | Inline vs queued task routing with circuit breakers |
| `worker_pool.py` | Async worker pool (n=4 default, env-configurable) |
| `fault_tolerance.py` | CircuitBreaker, RetryPolicy, Bulkhead |
| `observability.py` | Structured metrics, distributed tracing, correlation IDs |

### 2.7 Kernel (`kernel/kernel_runtime.py`)

Manages agent lifecycle states: `REGISTERED → RUNNING → IDLE → TERMINATED`.  
Runs health ping loop, enforces resource budgets.

---

## 3. Frontend Services

### 3.1 Next.js Dashboard (`./dashboard/`)

| Property | Value |
|----------|-------|
| Framework | Next.js 16 (Pages Router) |
| Styling | Tailwind CSS |
| Deployment | GitHub Pages (via `nextjs.yml` workflow) |
| Dev port | 3000 |
| PWA | Service worker + Web Manifest (`dashboard/public/sw.js`) |

**Pages:**

| Route | File | Purpose |
|-------|------|---------|
| `/` | `pages/index.js` | Dashboard home / KPI overview |
| `/leads` | `pages/leads.js` | Lead browser + filtering |
| `/analytics` | `pages/analytics.js` | Charts and performance metrics |
| `/chat` | `pages/chat.js` | LLM command chat interface |
| `/crm` | `pages/crm.js` | CRM pipeline view |
| `/connectors` | `pages/connectors.js` | External service connectors |
| `/settings` | `pages/settings.js` | System configuration |
| `/studio` | `pages/studio.js` | Agent studio / workflow builder |
| `/workspace` | `pages/workspace.js` | Multi-agent workspace |
| `/admin` | `pages/admin/` | Admin panel |

**Key components:**
- `dashboard/components/RuntimeCommandChat.js` — LLM command terminal embedded in UI

### 3.2 Separate Frontend Repo: XPS-INTELLIGENCE-FRONTEND

| Property | Value |
|----------|-------|
| Repository | `InfinityXOneSystems/XPS-INTELLIGENCE-FRONTEND` |
| Stack | Vite + React + TypeScript |
| Deployment | Vercel (`https://xps-intelligence.vercel.app`) |
| API target | `VITE_API_URL` → Railway backend |
| Primary endpoints | `POST /api/v1/runtime/command`, `GET /api/v1/runtime/task/{id}` |

---

## 4. API Routes Inventory

All routes are prefixed with `/api/v1`.

### `/api/v1/leads` — Lead Management

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/leads` | List contractors (paginated, filtered) |
| `GET` | `/leads/export/csv` | Export leads as CSV |
| `GET` | `/leads/stats/summary` | Aggregate statistics |
| `GET` | `/leads/{lead_id}` | Get single contractor |
| `POST` | `/leads` | Create contractor |
| `PUT` | `/leads/{lead_id}` | Update contractor |
| `DELETE` | `/leads/{lead_id}` | Delete contractor |

### `/api/v1/scrapers` — Scrape Job Management

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/scrapers/jobs` | Create scrape job |
| `GET` | `/scrapers/jobs` | List scrape jobs |
| `GET` | `/scrapers/jobs/{job_id}` | Get job status |
| `POST` | `/scrapers/jobs/{job_id}/cancel` | Cancel job |
| `GET` | `/scrapers/status` | Scraper health status |

### `/api/v1/agents` — Agent Lifecycle

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/agents` | List all agents |
| `POST` | `/agents/{name}/start` | Start an agent |
| `POST` | `/agents/{name}/stop` | Stop an agent |
| `GET` | `/agents/{name}/logs` | Get agent logs |

### `/api/v1/runtime` — Runtime Command Interface

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/runtime/command` | Execute a runtime command |
| `GET` | `/runtime/task/{id}` | Poll task status |
| `POST` | `/runtime/agent/start` | Start agent via runtime |
| `GET` | `/runtime/health` | Runtime health check |
| `POST` | `/runtime/sandbox/run` | Execute in sandbox |
| `GET` | `/runtime/metrics` | Runtime metrics |
| `POST` | `/runtime/worker/scale` | Scale worker pool |

### `/api/v1/commands` — Command Parser

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/commands/execute` | Execute natural-language command |

### `/api/v1/outreach` — Email Campaigns

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/outreach/campaigns` | Create email campaign |
| `GET` | `/outreach/campaigns` | List campaigns |
| `POST` | `/outreach/send` | Send campaign |
| `GET` | `/outreach/stats` | Delivery statistics |

### `/api/v1/system` — System Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/system/health` | Full system health |
| `GET` | `/system/metrics` | Prometheus-style metrics |
| `GET` | `/system/status` | Service status overview |

### `/api/v1/admin` — Admin Panel

| Method | Path | Description |
|--------|------|-------------|
| `GET/POST` | `/admin/users` | User management |
| `PUT/DELETE` | `/admin/users/{user_id}` | Update/delete user |
| `GET` | `/admin/analytics` | Platform analytics |
| `GET/POST/PUT/DELETE` | `/admin/features` | Feature flags |
| `GET/PUT` | `/admin/settings/{key}` | System settings |
| `GET/POST/DELETE` | `/admin/promotions` | Promotions |
| `GET` | `/admin/payments/invoices` | Invoice list |
| `GET/POST` | `/admin/integrations` | External integrations |
| `GET` | `/admin/health` | Admin health check |
| `GET` | `/admin/copilot/prompt` | Copilot system prompt |

### `/api/v1/connectors` — External Service Connectors

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/connectors/` | List all connectors + status |
| `GET` | `/connectors/{id}` | Get connector status |
| `POST` | `/connectors/configure` | Configure connector credentials |
| `POST` | `/connectors/vercel/deploy` | Trigger Vercel deployment |
| `POST` | `/connectors/github/action` | Trigger GitHub Actions workflow |
| `POST` | `/connectors/google/workspace` | Google Workspace operations |
| `POST` | `/connectors/docker/action` | Docker MCP management |
| `GET` | `/connectors/vercel/status` | Vercel deployment status |

### `/api/v1/crm` — CRM Pipeline

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/crm/` | List CRM contacts |
| `GET` | `/crm/stats` | Pipeline statistics |
| `GET` | `/crm/{id}` | Get single contact |
| `PATCH` | `/crm/{id}` | Update contact |
| `POST` | `/crm/{id}/note` | Add note |
| `POST` | `/crm/{id}/outreach` | Log outreach activity |
| `POST` | `/crm/bulk/stage` | Bulk stage update |
| `GET` | `/crm/export/csv` | Export CRM as CSV |
| `DELETE` | `/crm/{id}` | Delete contact |

### `/api/v1/multi_agent` — Multi-Agent Sessions

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/multi_agent/agents` | List available agent profiles |
| `POST` | `/multi_agent/sessions` | Create multi-agent session |
| `GET` | `/multi_agent/sessions` | List active sessions |
| `GET` | `/multi_agent/sessions/{id}` | Get session + history |
| `POST` | `/multi_agent/sessions/{id}/message` | Send message to session |
| `DELETE` | `/multi_agent/sessions/{id}` | Close session |

---

## 5. Agent Modules Inventory

### Python Agents (`agents/*.py` + `agents/*/`)

| Agent | Location | Responsibility |
|-------|----------|---------------|
| BaseAgent | `agents/base_agent.py` | Abstract base: execute(), run(), event bus, retry logic |
| BrowserAgent | `agents/browser/browser_automation_agent.py` | Playwright browser automation |
| BuilderAgent | `agents/builder/builder_agent.py` | Code generation and build tasks |
| CodeAgent | `agents/code/code_agent.py` | Code analysis, generation, refactoring |
| BackendAgent | `agents/backend/backend_agent.py` | Backend service management |
| FrontendAgent | `agents/frontend/frontend_agent.py` | Frontend build and deployment |
| DevOpsAgent | `agents/devops/devops_agent.py` | Infrastructure and CI/CD |
| GitHubAgent | `agents/github/github_agent.py` | GitHub API operations |
| HeadlessAgent | `agents/headless/headless_agent_async.py` | Async headless browser tasks |
| InterpreterAgent | `agents/interpreter/interpreter_agent.py` | Open Interpreter integration |
| MediaAgent | `agents/media/media_agent.py` | Media processing and generation |
| MemoryAgent | `agents/memory/memory_agent.py` | Persistent memory management |
| ParallelExecutor | `agents/parallel/parallel_executor.py` | Concurrent multi-agent execution |
| PipelineAgent | `agents/pipeline/autonomous_lead_pipeline.py` | End-to-end pipeline coordination |
| PlannerAgent | `agents/planner/planner_agent.py` | Task decomposition and planning |
| PredictionAgent | `agents/prediction/prediction_agent.py` | Market forecasting, lead scoring ML |
| RestApiAgent | `agents/rest_api/rest_api_agent.py` | External REST API integration |
| ScraperAgent | `agents/scraper/scraper_agent.py` | Unified scraper orchestration |
| SeoAgent | `agents/seo/seo_agent.py` | SEO analysis and optimization |
| ShadowAgent | `agents/shadow/shadow_agent.py` | Background silent execution |
| SimulationAgent | `agents/simulation/simulation_agent.py` | Business scenario simulation |
| SocialAgent | `agents/social/social_agent.py` | Social media operations |
| SocialMediaAgent | `agents/social/social_media_agent.py` | Extended social media pipeline |
| SupervisorAgent | `agents/supervisor/supervisor_agent.py` | Multi-agent supervision and coordination |
| ValidatorAgent | `agents/validator/validator_agent.py` | Output validation and QA |
| RepoGuardian | `agents/repo_guardian.py` | Repository integrity monitoring |

### JavaScript Agents (`agents/**/*.js`)

| Directory | Key Files | Responsibility |
|-----------|-----------|---------------|
| `agents/ai/` | `ai_email_generator.js`, `prompt_registry.js`, `sales_ai_chat.js` | AI-powered email gen, voice coaching, call intelligence |
| `agents/automation/` | `github_workflow_dispatcher.js` | Programmatic workflow triggering |
| `agents/captcha/` | `captcha_solver.js` | CAPTCHA bypass during scraping |
| `agents/crawler/` | `maps_scroller.js`, `website_scraper.js` | DOM crawling and scrolling |
| `agents/dedupe/` | `deduplication_engine.js`, `duplicate_filter.js` | Lead deduplication |
| `agents/discovery/` | `lead_discovery_engine.js`, `national_query_builder.js` | Lead discovery, national query generation |
| `agents/email/` | `email_extractor.js`, `site_email_finder.js` | Email discovery from websites |
| `agents/enrichment/` | `company_enrichment_engine.js`, `revenue_estimation.js` | Company data enrichment |
| `agents/exporter/` | `csv_exporter.js` | Data export |
| `agents/gpt_actions/` | `server.js` | GPT plugin endpoint |
| `agents/headless/` | `headless_agent.js`, `headless_browser.js` | Headless browser pool |
| `agents/intelligence/` | `lead_sniper.js`, `opportunity_heatmap.js` | Lead targeting intelligence |
| `agents/logging/` | `system_logger.js` | Structured log aggregation |
| `agents/monitor/` | `full_system_monitor.js`, `health_monitor.js` | System health monitoring |
| `agents/orchestrator/` | `infinity_orchestrator.js`, `system_orchestrator.js` | Pipeline coordination |
| `agents/outreach/` | `email_outreach.js`, `follow_up_automation.js`, `invoice_generator.js` | Outreach automation |
| `agents/parser/` | `maps_parser.js` | Structured data parsing from maps |
| `agents/proxy/` | `proxy_rotation.js` | IP rotation for scraping |
| `agents/sales/` | `sales_pipeline_tracker.js`, `revenue_forecast.js` | Sales pipeline management |
| `agents/scoring/` | `lead_scoring.js`, `score_engine.js`, `scoring_pipeline.js` | Lead quality scoring |
| `agents/scraping/` | `async_scraping_engine.js` | Async multi-source scraping |

---

## 6. Database Schemas

### 6.1 PostgreSQL (Primary)

**Connection:** `postgresql://leadgen:leadgen123@localhost:5432/leadgen`  
**ORM:** SQLAlchemy (declarative base)  
**Migrations:** Alembic (`backend/alembic/`)

```
contractors                    # Primary lead table
├── id (UUID PK)
├── name
├── phone
├── email
├── website
├── address
├── city / state / zip
├── industry
├── rating (float)
├── review_count (int)
├── lead_score (int)           # canonical scoring field
├── tier (HOT/WARM/COLD)
├── source
├── status
├── created_at / updated_at
└── enriched_at

scrape_jobs                    # Scraper job tracking
├── id (UUID PK)
├── source
├── query
├── status
├── leads_found
└── created_at / completed_at

outreach_campaigns             # Email campaign management
├── id (UUID PK)
├── name
├── subject
├── body
├── status
└── created_at

crm_contacts                   # CRM pipeline
├── id (UUID PK)
├── contractor_id (FK)
├── pipeline_stage
├── notes (JSON)
└── last_contact_at

admin_users                    # Admin panel users
admin_features                 # Feature flags
admin_settings                 # Key-value settings
admin_promotions               # Promotions
```

### 6.2 SQLite (Fallback)

| File | Purpose |
|------|---------|
| `db/leads.db` | Local lead storage fallback |
| `database/database.js` | Node.js SQLite adapter (better-sqlite3) |

**Knex migrations** (`knexfile.js`):
```bash
npm run db:migrate    # Apply migrations
npm run db:seed       # Seed test data
npm run db:rollback   # Rollback last batch
```

### 6.3 Redis

| Use | Key Pattern |
|-----|-------------|
| Task queue | `bull:*` (BullMQ) |
| Short-term memory | `xps:session:*` |
| Rate limiting | `rl:*` |
| Scraper state | `scraper:*` |

### 6.4 Qdrant (Vector DB)

| Collection | Purpose |
|-----------|---------|
| `leads` | Semantic lead embeddings for similarity search |
| `memory` | Agent memory embeddings |

### 6.5 Lead JSON Files

| Path | Purpose |
|------|---------|
| `leads/leads.json` | **Canonical** lead store |
| `data/leads/leads.json` | Legacy fallback (dual-write maintained) |

---

## 7. Automation Pipelines

### GitHub Actions Workflows (25 total)

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `enterprise_lead_pipeline.yml` | `*/2 * * * *` (2hr cron) | Full pipeline: scrape → validate → score → export |
| `autonomous_pipeline.yml` | schedule + dispatch | Orchestrated multi-stage pipeline |
| `national_discovery.yml` | schedule | Multi-source nationwide lead discovery |
| `lead_scraper.yml` | schedule | Individual scraper runs |
| `lead_pipeline.yml` | push + schedule | Validation + scoring pipeline |
| `lead_validation.yml` | push | Lead schema validation |
| `infinity_orchestrator.yml` | schedule | Orchestrator health + dispatch |
| `headless_agent.yml` | schedule + dispatch | Headless browser agent execution |
| `social_scraper.yml` | schedule | Social media scraper |
| `scrape-schedule.yml` | cron | Scheduled scrape cadence |
| `deploy-backend.yml` | push to main | Railway backend deployment |
| `deploy.yml` | push | Multi-service deployment |
| `nextjs.yml` | push | GitHub Pages dashboard deployment |
| `ci.yml` | push + PR | Lint + test (backend + frontend) |
| `code_quality.yml` | push + PR | Code quality checks |
| `system_validation.yml` | push + schedule | pytest + integration tests |
| `docs_reflection.yml` | push + schedule | Doc self-review and issue creation |
| `repo_guardian.yml` | push | Repository integrity checks |
| `repo_sync.yml` | schedule | Repo sync operations |
| `self_edit.yml` | dispatch | Autonomous self-editing agent |
| `pr_agent.yml` | PR events | PR review automation |
| `issue_triage.yml` | issue events | Issue classification |
| `merge_guard.yml` | PR events | Merge protection checks |
| `runner_health.yml` | schedule | GitHub Actions runner health |
| `update-deps.yml` | schedule | Automated dependency updates |

### Node.js Pipeline Scripts

```
npm run score          → agents/scoring/scoring_pipeline.js
npm run dedup          → scripts/run_deduplication.js
npm run pipeline       → score + export
npm run city-pipeline  → generate-city-leads + score + city_export
npm run orchestrator   → agents/orchestrator/infinity_orchestrator.js
npm run scheduler      → scripts/scraper_scheduler.js
npm run monitor        → agents/monitor/full_system_monitor.js
```

---

## 8. Scraping Systems

### 8.1 Primary Scrapers (`scrapers/`)

| File | Source | Technology |
|------|--------|-----------|
| `google_maps_scraper.js` | Google Maps | Playwright + Crawlee |
| `bing_maps_scraper.js` | Bing Maps | Playwright |
| `yelp_scraper.js` | Yelp | Playwright + Cheerio |
| `directory_scraper.js` | Business directories | Playwright |
| `engine.js` | Multi-source router | Crawlee |
| `scraper_queue.js` | Queue coordinator | BullMQ |
| `scrapers/maps/google_maps_scraper.js` | Maps v2 | Crawlee |
| `scrapers/parallel_scraper_coordinator.py` | Python coordinator | asyncio |

### 8.2 Social Scrapers (`scrapers/social/`)

| File | Platform |
|------|---------|
| `social_scraper_engine.js` | Router |
| `facebook_scraper.js` | Facebook |
| `instagram_scraper.js` | Instagram |
| `linkedin_scraper.js` | LinkedIn |
| `twitter_scraper.js` | Twitter/X |

### 8.3 Crawler Agents (`agents/crawler/`)

| File | Purpose |
|------|---------|
| `maps_scroller.js` | Infinite scroll on maps results |
| `website_scraper.js` | Business website content extraction |

### 8.4 Anti-Detection

| Component | Location |
|-----------|---------|
| Proxy rotation | `agents/proxy/proxy_rotation.js` |
| CAPTCHA solver | `agents/captcha/captcha_solver.js` |
| Rate limiting | Configurable via `SCRAPING_RATE_LIMIT` env var |

### 8.5 Scraping Pipeline

```
Query Builder → Scraper Engine → Maps Parser → Lead Extraction
       ↓                                              ↓
National Query Builder                    Raw Lead Database
(agents/discovery/national_query_builder.js)
       ↓
City Lead Generator
(scripts/generate_city_leads.js)
```

---

## 9. Dependency Graph

### Python Stack

```
FastAPI ──────────────────┐
Uvicorn ──────────────────┤
SQLAlchemy + psycopg2 ────┤─→ PostgreSQL
Alembic ──────────────────┤
LangGraph + LangChain ────┤─→ LLM Providers (Groq → Ollama → OpenAI)
Redis-py ─────────────────┤─→ Redis
Qdrant-client ────────────┤─→ Qdrant
Pydantic v2 ──────────────┤
structlog ────────────────┤
Prometheus-client ────────┘
```

### Node.js Stack

```
Express 5 ───────────────┐
Crawlee 3 ───────────────┤
Playwright 1.58 ──────────┤
Cheerio ─────────────────┤─→ Web targets
Selenium ─────────────────┤
Steel SDK ────────────────┤
Axios ───────────────────┤
OpenAI SDK ──────────────┤─→ GPT-4
Nodemailer ──────────────┤─→ SMTP
BullMQ ──────────────────┤─→ Redis
pg ──────────────────────┤─→ PostgreSQL
better-sqlite3 ──────────┤─→ SQLite
knex ────────────────────┤
node-cron ───────────────┤
csv-writer ──────────────┘
```

### LLM Provider Priority

```
LLM_PROVIDER=auto  →  Groq (llama3-8b-8192)
                       → Ollama (llama3.2, local)
                         → OpenAI (GPT-4, fallback)
```

---

## 10. Execution Flow

### Lead Discovery → Outreach Full Pipeline

```
1. TRIGGER
   └─ GitHub Actions cron / manual dispatch / webhook

2. DISCOVERY
   ├─ national_query_builder.js  → generates geo+industry query matrix
   ├─ scraper_scheduler.js       → distributes to scraper workers
   └─ [google_maps | bing | yelp | directory]_scraper.js → raw leads

3. PARSING
   └─ maps_parser.js / website_scraper.js → structured lead objects

4. STORAGE
   └─ Dual-write: leads/leads.json + PostgreSQL contractors table

5. DEDUPLICATION
   └─ agents/dedupe/deduplication_engine.js → fingerprint + merge

6. VALIDATION
   └─ validation/lead_validation_pipeline.js → schema + field checks

7. ENRICHMENT
   ├─ agents/email/email_extractor.js         → email discovery
   ├─ agents/enrichment/company_enrichment_engine.js → company data
   ├─ agents/enrichment/social_profile_finder.js     → social profiles
   └─ agents/enrichment/technology_stack_detection.js → tech signals

8. SCORING
   └─ agents/scoring/scoring_pipeline.js
      Signal weights: website+10, phone+10, email+15, address+5,
                      rating>4+10, reviews>10+5, reachable+15,
                      industry+20, city/state+10
      Tiers: HOT≥75 / WARM 50-74 / COLD<50

9. EXPORT
   └─ tools/export_snapshot.js → CSV + JSON snapshots

10. OUTREACH
    └─ outreach/outreach_engine.js
       ├─ agents/ai/ai_email_generator.js → personalised email
       └─ outreach/follow_up_scheduler.js → automated follow-up

11. DASHBOARD UPDATE
    └─ Next.js dashboard pulls from /api/v1/leads
```

### Runtime Command Flow (Frontend → Backend)

```
User types command in chat UI (RuntimeCommandChat.js)
  ↓
POST /api/v1/runtime/command  (FastAPI backend)
  ↓
RuntimeController.handle_command()
  ↓
agent_core/command_router.route()  →  LLM intent parsing
  ↓
TaskDispatcher.dispatch()
  ├─ fast path: inline execution (SEO, social, browser, scrape)
  └─ async path: Redis TaskQueue → WorkerPool → Agent
  ↓
GET /api/v1/runtime/task/{id}  (polling)
  ↓
Response rendered in chat UI
```

---

## 11. Bottlenecks Identified

| # | Bottleneck | Location | Impact |
|---|-----------|---------|--------|
| 1 | **Single Redis instance** | `task_queue/redis_queue.py` | SPOF for entire task queue; no sentinel/cluster config |
| 2 | **Worker pool size hardcoded default** | `runtime/worker_pool.py` (N_WORKERS=4) | Under-utilises multi-core hosts; needs autoscaling |
| 3 | **Playwright browser instances not pooled** | `scrapers/*.js` | Each scrape spawns new browser; high memory/CPU cost |
| 4 | **Dual-write consistency** | `leads/leads.json` + PostgreSQL | JSON file write not atomic; risk of partial writes on crash |
| 5 | **LLM routing latency** | `llm/llm_router.py` | Sequential provider probing; Groq timeout adds ~5s cold start |
| 6 | **No pagination on lead export** | `agents/exporter/csv_exporter.js` | Exporting all leads at once; memory issue at scale |
| 7 | **Scraper rate limiting config** | `SCRAPING_RATE_LIMIT` env var | Default of 10 may hit Google Maps ban triggers |
| 8 | **Alembic migrations not auto-run** | `backend/alembic/` | Requires manual `alembic upgrade head`; CI doesn't enforce |
| 9 | **Missing health checks on worker services** | `docker-compose.yml` worker service | Docker compose worker has no `healthcheck` block |
| 10 | **Open CORS policy** | `backend/app/main.py` | `allow_origins=["*"]` in production is insecure |

---

## 12. Security Risks

| # | Risk | Severity | Location |
|---|------|---------|---------|
| 1 | **Wildcard CORS** (`allow_origins=["*"]`) | HIGH | `backend/app/main.py` — set `CORS_ALLOWED_ORIGINS` env var |
| 2 | **Default SECRET_KEY in config** (`"dev-secret-key-change-in-production"`) | HIGH | `backend/app/config.py` — must be overridden in production |
| 3 | **Default DB credentials in config** | HIGH | `backend/app/config.py` (plaintext fallback `leadgen:leadgen123`) |
| 4 | **GITHUB_WEBHOOK_SECRET optional** | MEDIUM | `agents/orchestrator/infinity_orchestrator.js` — empty string disables HMAC validation |
| 5 | **Sandbox escape via unsanitised paths** | MEDIUM | `runtime/sandbox_executor.py` — path traversal in `allowed_paths` check |
| 6 | **Proxy credentials in env vars** | MEDIUM | `PROXY_URL` env var — may contain credentials logged in stdout |
| 7 | **No rate limiting on `/api/v1/runtime/command`** | MEDIUM | FastAPI backend — unbounded LLM calls possible |
| 8 | **Open Interpreter execution** | MEDIUM | `agents/interpreter/interpreter_agent.py` — arbitrary code execution risk |
| 9 | **SQLite file in repo root** | LOW | `db/leads.db` — may be committed with sensitive lead data |
| 10 | **npm scripts execute without sandboxing** | LOW | `package.json` pipeline scripts — no filesystem restriction |

---

*This document is auto-derived from the live codebase. Re-run the forensic commands at the top to refresh.*
