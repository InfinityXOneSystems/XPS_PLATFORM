# SYSTEM_CAPABILITIES.md

> **Purpose:** Comprehensive capabilities reference for the XPS Intelligence Platform.
> Covers all modules, agents, API endpoints, deployment procedures, and pipeline stages.

---

## Table of Contents

1. [Full Architecture Diagram](#1-full-architecture-diagram)
2. [System Modules](#2-system-modules)
3. [Agent Roster](#3-agent-roster)
4. [Complete API Endpoint Reference](#4-complete-api-endpoint-reference)
5. [Deployment Instructions](#5-deployment-instructions)
6. [Environment Variables](#6-environment-variables)
7. [Running Locally](#7-running-locally)
8. [Pipeline Stages](#8-pipeline-stages)

---

## 1. Full Architecture Diagram

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║                        XPS INTELLIGENCE PLATFORM v1.0                          ║
╠═══════════════════════════╦══════════════════════════════════════════════════════╣
║      CLIENT LAYER         ║                SERVICE LAYER                        ║
║                           ║                                                      ║
║  ┌─────────────────────┐  ║  ┌──────────────────────────────────────────────┐   ║
║  │ Vite+React+TS (SPA) │  ║  │        FastAPI Backend   :8000               │   ║
║  │ Vercel CDN          │──╬─►│  /api/v1/ (11 router modules)               │   ║
║  │ VITE_API_URL        │  ║  │  Prometheus /metrics  │  Swagger /docs       │   ║
║  └─────────────────────┘  ║  └─────────────┬────────────────────────────────┘   ║
║                           ║                │                                      ║
║  ┌─────────────────────┐  ║  ┌─────────────▼────────────────────────────────┐   ║
║  │ Next.js Dashboard   │  ║  │        EXPRESS GATEWAY   :3200               │   ║
║  │ GitHub Pages        │──╬─►│  api/gateway.js  •  Rate limiting            │   ║
║  │ PWA (offline SW)    │  ║  └─────────────┬────────────────────────────────┘   ║
║  └─────────────────────┘  ║                │                                      ║
║                           ║  ┌─────────────▼────────────────────────────────┐   ║
║  ┌─────────────────────┐  ║  │     INFINITY ORCHESTRATOR   :3300            │   ║
║  │ GitHub Webhooks     │──╬─►│  GitHub webhook handler                      │   ║
║  │ Slash commands      │  ║  │  HMAC-SHA256 signature validation            │   ║
║  └─────────────────────┘  ║  └─────────────┬────────────────────────────────┘   ║
║                           ║                │                                      ║
╠═══════════════════════════╬════════════════▼═════════════════════════════════════╣
║      RUNTIME LAYER        ║                                                      ║
║                           ║  ┌──────────────────────────────────────────────┐   ║
║  KernelRuntime            ║  │          RuntimeController                   │   ║
║  └─ AgentRegistry         ║  │  route → plan → dispatch → observe          │   ║
║     └─ REGISTERED         ║  └────┬─────────────┬────────────────┬─────────┘   ║
║        RUNNING            ║       │             │                │              ║
║        IDLE               ║  ┌────▼────┐  ┌────▼────┐  ┌────────▼──────────┐  ║
║        ERROR              ║  │ Command │  │  Task   │  │  SandboxExecutor  │  ║
║        TERMINATED         ║  │ Router  │  │Dispatch-│  │  Network boundary │  ║
║                           ║  │(LangGrph│  │ er      │  │  Path boundary    │  ║
║  FaultTolerance           ║  │ state   │  │CB+Retry │  │  Timeout enforced │  ║
║  └─ CircuitBreaker        ║  │ machine)│  └────┬────┘  └───────────────────┘  ║
║  └─ RetryPolicy           ║  └─────────┘       │                              ║
║  └─ Bulkhead              ║                ┌────▼────────────────┐             ║
║                           ║                │   Redis TaskQueue   │             ║
║  Observability            ║                │   task_queue/       │             ║
║  └─ Metrics               ║                └────┬────────────────┘             ║
║  └─ Tracing               ║                     │                              ║
║  └─ Structured logs       ║                ┌────▼────────────────┐             ║
║                           ║                │    WorkerPool       │             ║
╠═══════════════════════════╣                │    n=4 async workers│             ║
║       MEMORY LAYER        ║                └────┬────────────────┘             ║
║                           ║                     │                              ║
║  Redis  → session cache   ║  ╔══════════════════▼══════════════════════════╗   ║
║  Qdrant → vector search   ║  ║              AGENT LAYER                    ║   ║
║  Postgres→ structured     ║  ║                                             ║   ║
║           long-term        ║  ║  Scraper  Enrichment  Scoring  Outreach    ║   ║
║                           ║  ║  Monitor  Dedup       Predict  Simulate     ║   ║
║  LLM Router               ║  ║  SEO      Social      Browser  GitHub       ║   ║
║  └─ Groq (primary)        ║  ║  Code     Builder     DevOps   Validator    ║   ║
║  └─ Ollama (local)        ║  ╚══════════════════════════════════════════════╝   ║
║  └─ OpenAI (fallback)     ║                                                      ║
╠═══════════════════════════╬══════════════════════════════════════════════════════╣
║        DATA LAYER         ║                                                      ║
║                           ║   PostgreSQL :5432  │  Redis :6379  │  Qdrant :6333 ║
║  leads/leads.json         ║   SQLite fallback   │  Ollama :11434                ║
║  (canonical lead store)   ║                                                      ║
╚═══════════════════════════╩══════════════════════════════════════════════════════╝

  GitHub Actions (25 workflows)
  ├── Lead pipeline (2hr cron)        ├── System validation (pytest)
  ├── National discovery              ├── Deploy → Railway / Vercel / Pages
  ├── Social scraper                  └── Self-edit / Docs reflection / PR agent
```

---

## 2. System Modules

### 2.1 `runtime/` — Runtime Controller

The central execution plane. All agent commands flow through here.

| Module | Capability |
|--------|-----------|
| `runtime_controller.py` | Receives commands, routes via CommandRouter, manages agent lifecycle, emits observability events |
| `sandbox_executor.py` | Enforces network domain whitelist, filesystem path whitelist, and execution timeout for every agent run |
| `task_dispatcher.py` | Routes tasks to inline (fast ≤60s) or async queue path; per-agent CircuitBreaker protection |
| `worker_pool.py` | Pool of `n` async coroutines pulling from TaskQueue; WorkerRecovery auto-restarts crashed workers |
| `fault_tolerance.py` | CircuitBreaker (open/half-open/closed), RetryPolicy (exponential backoff + jitter), Bulkhead (concurrency limiter) |
| `observability.py` | Metrics counters/gauges/histograms, distributed tracing spans, correlation IDs, 60s rollup, JSON export |

**Inline agent types** (fast path, no queue):
`seo`, `social`, `browser`, `scrape`, `automation`

**Queued agent types** (async path):
`batch_scrape`, `outreach`, `export`, `pipeline`

---

### 2.2 `kernel/` — Kernel Runtime

Low-level agent lifecycle management beneath the RuntimeController.

| Capability | Detail |
|-----------|--------|
| Agent registration | `kernel.register(name, agent_instance)` |
| Lifecycle states | `REGISTERED → RUNNING → IDLE → TERMINATED` (+ `ERROR`) |
| Health ping loop | Background thread pings all registered agents |
| Resource budgets | Advisory CPU/memory quotas per agent |
| Emergency shutdown | `kernel.shutdown()` — kills all running tasks |

---

### 2.3 `agent_core/` — Python Agent Core (FastAPI sub-app)

The gateway between natural-language commands and agent execution.

| Module | Capability |
|--------|-----------|
| `api.py` | FastAPI sub-application on port 8000 |
| `command_router.py` | Maps command strings to registered handler functions |
| `chat_interpreter.py` | Natural language → structured command translation via LLM |
| `langgraph_runtime.py` | LangGraph state machine for multi-step agent workflows |
| `planner.py` | Decomposes complex tasks into ordered subtask lists |
| `executor.py` | Safe shell/Python execution with sandboxing |
| `gates.py` | Pre-execution permission checks (validates actions before they run) |
| `validator.py` | Post-execution output schema validation |
| `state_manager.py` | Thread-safe shared state across agent runs |
| `orchestrator.py` | Python-side pipeline coordination |

---

### 2.4 `llm/` — LLM Router

Smart multi-provider LLM routing with automatic failover.

| Module | Capability |
|--------|-----------|
| `llm_router.py` | Provider probing, latency tracking, automatic failover |
| `groq_client.py` | Groq API client (llama3-8b-8192 default) |
| `ollama_client.py` | Ollama local inference client |

**Provider priority:** `Groq → Ollama → OpenAI` (configurable via `LLM_PROVIDER`)

---

### 2.5 `memory/` — Memory Manager

Three-tier persistent memory system.

| Tier | Backend | Purpose |
|------|---------|---------|
| Short-term | Redis | Session memory, ephemeral context |
| Semantic | Qdrant | Vector embeddings for similarity recall |
| Long-term | PostgreSQL | Structured persistent storage |

Gracefully degrades to in-process storage when external services are unavailable.

---

### 2.6 `observability/` — Observability System

Enterprise-grade telemetry.

| Capability | Detail |
|-----------|--------|
| Metrics | Counters, gauges, histograms with tag support |
| Tracing | Distributed spans with parent/child relationships and correlation IDs |
| Logging | Structured JSON logs via `structlog` |
| Time-series | In-memory rolling 60s aggregation |
| Export | JSON export (Prometheus/Datadog compatible) |
| HTTP metrics | `REQUEST_COUNT` and `REQUEST_LATENCY` Prometheus counters on FastAPI |

---

### 2.7 `fault_tolerance/` — Fault Tolerance Layer

| Component | Capability |
|-----------|-----------|
| `CircuitBreaker` | open/half-open/closed state machine, configurable failure threshold |
| `RetryPolicy` | Exponential backoff with jitter, max retry cap |
| `Bulkhead` | Per-agent concurrency limiter to prevent cascade failures |
| `Fallback` | Static or callable fallback value on final failure |
| `@fault_tolerant()` | Decorator combining all four patterns |

---

### 2.8 `task_queue/` — Distributed Task Queue

| Module | Capability |
|--------|-----------|
| `redis_queue.py` | Redis-backed FIFO queue with priority support |
| `worker.py` | Task worker process (`python -m task_queue.worker`) |

---

### 2.9 `validation/` & `validators/` — Validation Pipeline

| Module | Capability |
|--------|-----------|
| `validation/lead_validation_pipeline.js` | Full lead field validation: schema, required fields, format checks |
| `validation/dedupe.js` | Deduplication pre-check |
| `validators/lead_validator.js` | Individual lead record validator |
| `validators/lead_contract_validator.js` | Validates against lead data contract |
| `validators/system_validator.js` | System-level integrity checks |

---

### 2.10 `scrapers/` — Scraping Engine

| Source | File | Technology |
|--------|------|-----------|
| Google Maps | `scrapers/google_maps_scraper.js` | Playwright + Crawlee |
| Bing Maps | `scrapers/bing_maps_scraper.js` | Playwright |
| Yelp | `scrapers/yelp_scraper.js` | Playwright + Cheerio |
| Directories | `scrapers/directory_scraper.js` | Playwright |
| Multi-source router | `scrapers/engine.js` | Crawlee |
| Queue coordinator | `scrapers/scraper_queue.js` | BullMQ |
| Facebook | `scrapers/social/facebook_scraper.js` | Playwright |
| Instagram | `scrapers/social/instagram_scraper.js` | Playwright |
| LinkedIn | `scrapers/social/linkedin_scraper.js` | Playwright |
| Twitter/X | `scrapers/social/twitter_scraper.js` | Playwright |
| Python coordinator | `scrapers/parallel_scraper_coordinator.py` | asyncio |

---

### 2.11 `outreach/` — Outreach Engine

| Module | Capability |
|--------|-----------|
| `outreach_engine.js` | Master outreach coordinator |
| `follow_up_scheduler.js` | Automated follow-up sequence scheduling |
| `outreach_log.js` | Delivery and response tracking |

---

### 2.12 `sandbox/` — Sandbox Manager

| Module | Capability |
|--------|-----------|
| `sandbox/sandbox_manager.js` | Node.js sandbox management |
| `sandbox/sandbox_guard.py` | Python-level execution guard |
| `runtime/sandbox_executor.py` | Full network + filesystem boundary enforcement |

---

### 2.13 `db/` & `database/` — Database Layer

| Module | Capability |
|--------|-----------|
| `database/database.js` | Node.js SQLite adapter (better-sqlite3) |
| `db/` | SQLite database files |
| `knexfile.js` | Knex migration configuration |
| `backend/app/database.py` | SQLAlchemy engine, session factory |
| `backend/alembic/` | PostgreSQL migration history |

---

## 3. Agent Roster

### 3.1 Python Agents

#### Orchestrator (`agents/orchestrator.py`)
Coordinates top-level pipeline execution. Routes between discovery, enrichment, scoring, and outreach.

#### Scraper Agent (`agents/scraper/scraper_agent.py`)
Unified Python-side scraper orchestration. Wraps JS scrapers and parallel coordinator. Outputs raw lead objects.

#### Code Agent (`agents/code/code_agent.py`)
Code analysis, generation, and refactoring. Used for self-improvement workflows and automated code tasks.

#### Builder Agent (`agents/builder/builder_agent.py`)
Compiles and builds project artifacts. Triggers frontend/backend builds and validates outputs.

#### SEO Agent (`agents/seo/seo_agent.py`)
Full website SEO analysis: meta tags, headings, structured data (JSON-LD), keyword extraction, backlink discovery, page reachability, social profile detection, contact info extraction, SEO scoring per domain.

#### Social Agent (`agents/social/social_agent.py`)
Social media profile discovery (LinkedIn, Facebook, Instagram). Business page scraping (public data). Hashtag/keyword monitoring. Social lead enrichment.

#### Browser Agent (`agents/browser/browser_automation_agent.py`)
Playwright-based browser automation. Handles dynamic JS-rendered pages, form submission, screenshot capture.

#### CEO Agent (via `agents/supervisor/supervisor_agent.py`)
High-level supervisor that coordinates multi-agent workflows. Selects appropriate agents for tasks, manages timeouts (`SUPERVISOR_AGENT_TIMEOUT=120s`), handles failures with retry/fallback, aggregates results.

#### Vision Agent (`agents/media/media_agent.py`)
Media processing and generation. Image analysis, screenshot interpretation, visual content tasks.

#### Prediction Agent (`agents/prediction/prediction_agent.py`)
Market forecasting, trend analysis, predictive lead scoring. Capabilities:
- Revenue forecasting with scenario modeling
- Market trend prediction from historical data
- Lead conversion probability scoring
- Seasonal demand analysis
- Industry growth predictions

#### Strategy Agent (`agents/planner/planner_agent.py`)
Task decomposition and strategic planning. Breaks complex goals into ordered subtask sequences. Interfaces with LangGraph for multi-step execution.

#### Simulation Agent (`agents/simulation/simulation_agent.py`)
Business scenario modeling and what-if analysis. Capabilities:
- Revenue scenario modeling (optimistic/base/pessimistic)
- Market penetration simulations
- Competitive analysis scenarios
- Resource allocation optimization
- Growth strategy simulations

#### Validation Agent (`agents/validator/validator_agent.py`)
Output validation and quality assurance. Validates agent outputs against expected schemas.

#### Documentation Agent (`agents/github/github_agent.py`)
GitHub API operations: issue creation, PR management, file commits, workflow triggering, repository management.

#### DevOps Agent (`agents/devops/devops_agent.py`)
Infrastructure and CI/CD automation. Docker operations, deployment management, service health.

#### Shadow Agent (`agents/shadow/shadow_agent.py`)
Silent background execution. Runs tasks without emitting events or logging to primary streams.

#### Interpreter Agent (`agents/interpreter/interpreter_agent.py`)
Open Interpreter integration. Executes natural-language coding tasks via the Open Interpreter runtime.

#### Memory Agent (`agents/memory/memory_agent.py`)
Manages the three-tier memory system (Redis/Qdrant/Postgres). Stores, retrieves, and searches agent memories.

#### Parallel Executor (`agents/parallel/parallel_executor.py`)
Runs multiple agents concurrently. Manages async task fan-out and result aggregation.

#### Pipeline Agent (`agents/pipeline/autonomous_lead_pipeline.py`)
End-to-end pipeline coordination: discovery → enrichment → scoring → outreach.

#### REST API Agent (`agents/rest_api/rest_api_agent.py`)
External REST API integration. Makes authenticated requests to third-party services on behalf of the platform.

#### Repo Guardian (`agents/repo_guardian.py`)
Repository integrity monitoring. Detects unauthorized changes, validates file checksums, enforces governance rules.

---

### 3.2 JavaScript Agents (Key Modules)

| Agent | File | Capability |
|-------|------|-----------|
| **Discovery Engine** | `agents/discovery/lead_discovery_engine.js` | Multi-source lead discovery orchestration |
| **National Query Builder** | `agents/discovery/national_query_builder.js` | Generates geo×industry query matrix for nationwide coverage |
| **Company Enrichment** | `agents/enrichment/company_enrichment_engine.js` | Full company profile enrichment |
| **Revenue Estimator** | `agents/enrichment/revenue_estimation.js` | Estimates annual revenue from signals |
| **Tech Stack Detector** | `agents/enrichment/technology_stack_detection.js` | Identifies website technologies |
| **Construction Signal** | `agents/enrichment/construction_signal_detection.js` | Detects active construction projects |
| **Social Profile Finder** | `agents/enrichment/social_profile_finder.js` | Discovers all social media profiles |
| **Review Aggregator** | `agents/enrichment/review_aggregator.js` | Aggregates reviews from multiple platforms |
| **Email Extractor** | `agents/email/email_extractor.js` | Multi-source email discovery |
| **Site Email Finder** | `agents/email/site_email_finder.js` | Deep website email extraction |
| **Lead Scoring** | `agents/scoring/lead_scoring.js` | Applies scoring weights and assigns tiers |
| **Score Engine** | `agents/scoring/score_engine.js` | Signal computation engine |
| **Scoring Pipeline** | `agents/scoring/scoring_pipeline.js` | Batch scoring pipeline with export |
| **Dedup Engine** | `agents/dedupe/deduplication_engine.js` | Fingerprint-based deduplication |
| **AI Email Generator** | `agents/ai/ai_email_generator.js` | GPT-4 personalised email generation |
| **Sales AI Chat** | `agents/ai/sales_ai_chat.js` | AI-powered sales conversation assistant |
| **Voice Coaching** | `agents/ai/voice_coaching.js` | Call coaching and script generation |
| **Lead Sniper** | `agents/intelligence/lead_sniper.js` | High-precision targeting of HOT leads |
| **Opportunity Heatmap** | `agents/intelligence/opportunity_heatmap.js` | Geographic opportunity mapping |
| **Outreach Engine** | `agents/outreach/email_outreach.js` | Personalised email outreach |
| **Follow-up Automation** | `agents/outreach/follow_up_automation.js` | Multi-step follow-up sequences |
| **Invoice Generator** | `agents/outreach/invoice_generator.js` | Automated invoice creation |
| **Proposal Generator** | `agents/outreach/proposal_generator.js` | Business proposal generation |
| **SMS Campaign** | `agents/outreach/sms_campaign.js` | SMS outreach campaigns |
| **System Monitor** | `agents/monitor/full_system_monitor.js` | Full platform health monitoring |
| **Proxy Rotation** | `agents/proxy/proxy_rotation.js` | Rotating proxy pool for scraper anti-detection |
| **CAPTCHA Solver** | `agents/captcha/captcha_solver.js` | Automated CAPTCHA handling |
| **Headless Browser** | `agents/headless/headless_browser.js` | Managed headless browser pool |
| **Workflow Dispatcher** | `agents/automation/github_workflow_dispatcher.js` | Programmatic GitHub Actions triggering |

---

## 4. Complete API Endpoint Reference

**Base URL (Production):** `https://xpsintelligencesystem-production.up.railway.app`  
**Base URL (Local):** `http://localhost:8000`  
**API prefix:** `/api/v1`

### Core Endpoints

```
GET  /health           → Platform health check
GET  /metrics          → Prometheus metrics
GET  /docs             → Swagger UI
GET  /redoc            → ReDoc UI
```

### Lead Management `/api/v1/leads`

```
GET    /leads                     List leads (query: page, limit, tier, city, state, industry)
GET    /leads/export/csv          Export all leads as CSV
GET    /leads/stats/summary       Aggregate stats (total, by tier, by industry)
GET    /leads/{lead_id}           Get single lead
POST   /leads                     Create lead (body: ContractorCreate schema)
PUT    /leads/{lead_id}           Update lead
DELETE /leads/{lead_id}           Delete lead
```

### Scraper Jobs `/api/v1/scrapers`

```
POST   /scrapers/jobs             Create scrape job {source, query, city, state, industry}
GET    /scrapers/jobs             List all scrape jobs
GET    /scrapers/jobs/{job_id}    Get job status
POST   /scrapers/jobs/{job_id}/cancel  Cancel job
GET    /scrapers/status           Scraper system health
```

### Agent Lifecycle `/api/v1/agents`

```
GET    /agents                    List all registered agents with status
POST   /agents/{name}/start       Start agent instance
POST   /agents/{name}/stop        Stop agent instance
GET    /agents/{name}/logs        Stream agent logs
```

### Runtime Commands `/api/v1/runtime`

```
POST   /runtime/command           Execute command {command: str, context?: dict}
GET    /runtime/task/{id}         Poll task result {status, result, error}
POST   /runtime/agent/start       Start agent via runtime {agent_name, config}
GET    /runtime/health            Runtime subsystem health
POST   /runtime/sandbox/run       Sandboxed execution {code, allowed_paths, timeout}
GET    /runtime/metrics           Runtime performance metrics
POST   /runtime/worker/scale      Scale worker pool {n_workers: int}
```

### Natural Language Commands `/api/v1/commands`

```
POST   /commands/execute          {command: "scrape flooring contractors in Miami FL"}
                                  → Parsed intent + execution result
```

### Outreach `/api/v1/outreach`

```
POST   /outreach/campaigns        Create campaign {name, subject, body, lead_filter}
GET    /outreach/campaigns        List campaigns
POST   /outreach/send             Send campaign {campaign_id}
GET    /outreach/stats            Delivery stats {sent, opened, replied}
```

### System `/api/v1/system`

```
GET    /system/health             Full system health (all subsystems)
GET    /system/metrics            Prometheus-format metrics
GET    /system/status             Service status overview
```

### Admin `/api/v1/admin`

```
GET    /admin/users               List users
POST   /admin/users               Create user
PUT    /admin/users/{user_id}     Update user
DELETE /admin/users/{user_id}     Delete user
GET    /admin/analytics           Platform analytics dashboard data
GET    /admin/features            Feature flags list
POST   /admin/features            Create feature flag
PUT    /admin/features/{id}       Update feature flag
DELETE /admin/features/{id}       Delete feature flag
GET    /admin/settings/{key}      Get setting value
PUT    /admin/settings/{key}      Update setting value
GET    /admin/promotions          List promotions
POST   /admin/promotions          Create promotion
DELETE /admin/promotions/{id}     Delete promotion
GET    /admin/payments/invoices   Invoice history
GET    /admin/integrations        External integrations list
POST   /admin/integrations        Register integration
GET    /admin/health              Admin subsystem health
GET    /admin/copilot/prompt      Active Copilot system prompt
```

### Connectors `/api/v1/connectors`

```
GET    /connectors/               List all connectors + status
GET    /connectors/{id}           Get connector status
POST   /connectors/configure      {connector_id, credentials} → Configure
POST   /connectors/vercel/deploy  Trigger Vercel deployment webhook
POST   /connectors/github/action  {workflow, inputs} → Trigger GitHub Actions
POST   /connectors/google/workspace  Google Workspace operations
POST   /connectors/docker/action  Docker MCP container management
GET    /connectors/vercel/status  Vercel deployment status
```

### CRM `/api/v1/crm`

```
GET    /crm/                      List contacts (query: stage, assigned_to)
GET    /crm/stats                 Pipeline statistics {by_stage, conversion_rates}
GET    /crm/{id}                  Get contact with full history
PATCH  /crm/{id}                  Update contact fields
POST   /crm/{id}/note             Add note {content}
POST   /crm/{id}/outreach         Log outreach {type, notes, outcome}
POST   /crm/bulk/stage            Bulk update {ids: [], stage}
GET    /crm/export/csv            Export CRM as CSV
DELETE /crm/{id}                  Delete contact
```

### Multi-Agent Sessions `/api/v1/multi_agent`

```
GET    /multi_agent/agents                    List available agent profiles
POST   /multi_agent/sessions                  Create session {agents: [], goal}
GET    /multi_agent/sessions                  List active sessions
GET    /multi_agent/sessions/{id}             Get session + full message history
POST   /multi_agent/sessions/{id}/message     Send message {role, content}
DELETE /multi_agent/sessions/{id}             Close session
```

---

## 5. Deployment Instructions

### 5.1 Railway (Backend)

The FastAPI backend + worker services deploy to Railway.

**Step 1: Connect repo**
```
1. Login to railway.app
2. New Project → Deploy from GitHub → InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM
3. Set start command: cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT
4. Add PostgreSQL plugin (Railway managed)
5. Add Redis plugin (Railway managed)
```

**Step 2: Set environment variables**

Copy from `.env.railway.template` and set in Railway → Project → Variables (see §6).

**Step 3: Verify deployment**
```bash
curl https://xpsintelligencesystem-production.up.railway.app/health
# Expected: {"status":"OK","timestamp":"..."}

curl -X POST https://xpsintelligencesystem-production.up.railway.app/api/v1/runtime/command \
  -H "Content-Type: application/json" \
  -d '{"command": "status"}'
```

**Step 4: Run migrations**
```bash
# Via Railway shell or local with DATABASE_URL set
cd backend && alembic upgrade head
```

---

### 5.2 Vercel (Separate Frontend — XPS-INTELLIGENCE-FRONTEND)

The Vite+React+TS frontend deploys to Vercel.

**Step 1: Connect repo**
```
1. Login to vercel.com
2. New Project → Import from GitHub → InfinityXOneSystems/XPS-INTELLIGENCE-FRONTEND
3. Framework: Vite
4. Build command: npm run build
5. Output directory: dist
```

**Step 2: Set environment variables in Vercel dashboard**
```
VITE_API_URL=https://xpsintelligencesystem-production.up.railway.app
VITE_BACKEND_URL=https://xpsintelligencesystem-production.up.railway.app
VITE_API_BASE_URL=https://xpsintelligencesystem-production.up.railway.app
```

**Step 3: Set Railway CORS**

In Railway → Variables, ensure:
```
CORS_ALLOWED_ORIGINS=https://xps-intelligence.vercel.app,https://xps-intelligence-*.vercel.app,http://localhost:3000
FRONTEND_URL=https://xps-intelligence.vercel.app
```

**Step 4: Redeploy after env var changes**

Vercel injects variables at build time — a redeploy is required after any change.

---

### 5.3 GitHub Pages (Next.js Dashboard)

The Next.js dashboard deploys automatically via the `nextjs.yml` workflow on every push to `main`.

**Manual trigger:**
```bash
gh workflow run nextjs.yml
```

**URL:** `https://infinityxonesystems.github.io/XPS_INTELLIGENCE_SYSTEM/`

---

### 5.4 Docker Compose (Full Stack Local)

```bash
docker compose up -d

# Services started:
#  redis          :6379
#  postgres       :5432
#  qdrant         :6333  (vector DB)
#  ollama         :11434 (local LLM)
#  backend        :8000  (FastAPI)
#  gateway        :3200  (Express)
#  frontend       :3000  (Next.js)
#  worker         (x2 replicas, no external port)
#  scraper-worker (no external port)
#  interpreter    (no external port)

# View logs
docker compose logs -f backend

# Run migrations inside container
docker compose exec backend alembic upgrade head
```

---

## 6. Environment Variables

### Backend (FastAPI + Runtime)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | `postgresql://leadgen:leadgen123@localhost:5432/leadgen` | PostgreSQL connection string |
| `REDIS_URL` | ✅ | `redis://localhost:6379/0` | Redis connection string |
| `SECRET_KEY` | ✅ | `dev-secret-key-change-in-production` | JWT signing secret — **change in production** |
| `OPENAI_API_KEY` | ⬜ | `""` | OpenAI API key (LLM fallback) |
| `SENDGRID_API_KEY` | ⬜ | `""` | SendGrid for outreach email delivery |
| `GITHUB_TOKEN` | ⬜ | `""` | GitHub PAT for pipeline operations |
| `GITHUB_REPO` | ⬜ | `your-org/LEAD_GEN_INTELLIGENCE` | Target GitHub repository |
| `SCRAPER_CONCURRENCY` | ⬜ | `10` | Max concurrent scraper instances |
| `MAX_LEADS_PER_DAY` | ⬜ | `100000` | Daily lead discovery cap |

### Runtime Layer

| Variable | Default | Description |
|----------|---------|-------------|
| `SANDBOX_TIMEOUT` | `120` | Max agent execution time (seconds) |
| `WORKER_POOL_SIZE` | `4` | Number of async worker coroutines |
| `WORKER_POLL_TIMEOUT` | `5` | Queue poll interval (seconds) |
| `WORKER_MAX_RETRIES` | `3` | Task retry limit before dead-letter |
| `DISPATCHER_INLINE_TIMEOUT` | `60` | Fast-path execution timeout (seconds) |
| `SUPERVISOR_MAX_AGENTS` | `5` | Max concurrent agents per supervisor |
| `SUPERVISOR_AGENT_TIMEOUT` | `120` | Per-agent timeout in supervisor |

### LLM Router

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `auto` | `auto` \| `groq` \| `ollama` \| `openai` |
| `GROQ_API_KEY` | `""` | Groq API key (enables Groq provider) |
| `GROQ_MODEL` | `llama3-8b-8192` | Groq model name |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `llama3.2` | Ollama model name |

### Scraper / Proxy

| Variable | Default | Description |
|----------|---------|-------------|
| `SCRAPING_RATE_LIMIT` | `10` | Requests per second cap |
| `PROXY_URL` | `""` | HTTP proxy URL (optional) |
| `PROXY_ENABLED` | `false` | Enable proxy rotation |

### CORS / Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ALLOWED_ORIGINS` | `*` | Comma-separated allowed origins — **restrict in production** |
| `FRONTEND_URL` | `""` | Vercel frontend base URL |

### Frontend (Vite + React)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Railway backend base URL |
| `VITE_BACKEND_URL` | Railway backend base URL (alias) |
| `VITE_API_BASE_URL` | Railway backend base URL (alias) |

### Infrastructure

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | `xps` | PostgreSQL username (Docker Compose) |
| `POSTGRES_PASSWORD` | `xpspass` | PostgreSQL password (Docker Compose) |
| `POSTGRES_DB` | `xps` | PostgreSQL database name (Docker Compose) |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant vector DB URL |

### Orchestrator / GitHub

| Variable | Description |
|----------|-------------|
| `GITHUB_WEBHOOK_SECRET` | HMAC secret for webhook signature validation |
| `ORCHESTRATOR_PORT` | Infinity Orchestrator server port (default: 3300) |

---

## 7. Running Locally

### Prerequisites

```bash
# Required
node 18+       (npm 9+)
python 3.11+
redis-server
postgresql 14+

# Optional (for full capabilities)
docker + docker compose
ollama  (local LLM)
playwright browsers
```

### Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM.git
cd XPS_INTELLIGENCE_SYSTEM

# 2. Install Node.js dependencies
npm install

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Copy and configure environment
cp .env.example .env  # edit with your values

# 5. Run database migrations
npm run db:migrate    # SQLite/Knex migrations
cd backend && alembic upgrade head  # PostgreSQL migrations
cd ..

# 6. Start all services (recommended: Docker)
docker compose up -d

# Or start individually:
npm run agent:server   # FastAPI backend        :8000
npm run gateway        # Express gateway        :3200
npm run worker         # Python task worker
npm run dashboard      # Next.js dashboard      :3000

# 7. Verify
curl http://localhost:8000/health
```

### Running the Lead Pipeline

```bash
# Full pipeline (score + export)
npm run pipeline

# Individual stages
npm run score           # Score all leads
npm run dedup           # Deduplicate leads
npm run generate-city-leads  # Generate city-based queries
npm run city-pipeline   # City leads + score + export

# Scraping
npm run scheduler       # Start scheduled scraper
npm run social-scraper  # Start social media scraper
npm run headless-agent  # Start headless browser agent

# Monitoring
npm run monitor         # Full system monitor
npm run orchestrator    # Start orchestrator server
```

### Running Tests

```bash
# Unit tests (Node.js built-in test runner)
npm test

# Integration tests
npm run test:integration

# Python tests (pytest)
cd backend && pytest
# or from root:
pytest tests/

# Specific test suites
pytest tests/test_runtime.py
pytest tests/test_agents.py
pytest tests/system/test_agent_health.py

# Playwright E2E tests
npx playwright test tests/playwright/
```

### Accessing Services

| Service | URL | Credentials |
|---------|-----|-------------|
| FastAPI docs | `http://localhost:8000/docs` | None |
| FastAPI metrics | `http://localhost:8000/metrics` | None |
| Next.js dashboard | `http://localhost:3000` | None |
| Express gateway | `http://localhost:3200` | None |
| Qdrant UI | `http://localhost:6333/dashboard` | None |
| Ollama | `http://localhost:11434` | None |
| PostgreSQL | `localhost:5432` | `xps` / `xpspass` |
| Redis | `localhost:6379` | None |

---

## 8. Pipeline Stages

### Stage 1 — Discovery

```
INPUT: industry keywords + geo targets
  ↓
agents/discovery/national_query_builder.js
  → Generates query matrix: {industry} × {city, state}
  ↓
scripts/scraper_scheduler.js
  → Distributes queries to scraper worker pool
  ↓
[google_maps | bing_maps | yelp | directory]_scraper.js
  → Playwright browser automation
  → DOM extraction (name, phone, address, rating, reviews)
  → Scrolls to load all results
OUTPUT: raw lead JSON array
```

### Stage 2 — Parsing & Storage

```
INPUT: raw lead array
  ↓
agents/parser/maps_parser.js
  → Normalises field names
  → Extracts structured address components
  ↓
agents/crawler/website_scraper.js
  → Visits each lead's website
  → Extracts contact info, description
  ↓
DUAL-WRITE:
  → leads/leads.json                          (canonical)
  → PostgreSQL contractors table (via API)    (structured)
OUTPUT: normalised leads in database
```

### Stage 3 — Deduplication

```
INPUT: new leads + existing lead database
  ↓
agents/dedupe/deduplication_engine.js
  → Fingerprint: hash(name + phone + address)
  → Fuzzy match on name + city
  → Merge duplicate records (keep highest score)
OUTPUT: deduplicated lead set
```

### Stage 4 — Validation

```
INPUT: deduplicated leads
  ↓
validation/lead_validation_pipeline.js
  → Required fields: name, phone OR email, city, state
  → Format checks: phone E.164, email RFC 5322
  → URL format validation
  → Industry classification check
  ↓
validators/lead_contract_validator.js
  → Contract schema compliance
OUTPUT: validated lead set with error annotations
```

### Stage 5 — Enrichment

```
INPUT: validated leads
  ↓
agents/email/email_extractor.js
  → Multi-source email discovery:
    contact page scrape, WHOIS, social profiles
  ↓
agents/enrichment/company_enrichment_engine.js
  → Full company profile:
    founded year, employee count, revenue estimate,
    service areas, certifications
  ↓
agents/enrichment/social_profile_finder.js
  → LinkedIn, Facebook, Instagram, Twitter discovery
  ↓
agents/enrichment/technology_stack_detection.js
  → Website technology fingerprinting
  ↓
agents/enrichment/construction_signal_detection.js
  → Active project signals (permit data, job postings)
  ↓
agents/enrichment/review_aggregator.js
  → Aggregate reviews from Google, Yelp, BBB
OUTPUT: enriched lead records
```

### Stage 6 — Scoring

```
INPUT: enriched leads
  ↓
agents/scoring/score_engine.js
  → Signal evaluation:

  Signal                  Points
  ─────────────────────   ──────
  website present           +10
  phone present             +10
  email discovered          +15
  address complete           +5
  rating > 4.0              +10
  reviews > 10               +5
  website reachable         +15
  industry match            +20
  city/state present        +10

  Total range: 0 – 100
  ↓
agents/scoring/lead_scoring.js
  → Tier assignment:
    HOT   ≥ 75 points
    WARM  50–74 points
    COLD  < 50 points
  ↓
agents/scoring/scoring_pipeline.js
  → Batch update: writes lead_score + tier to all records
OUTPUT: scored + tiered leads
```

### Stage 7 — Export

```
INPUT: scored leads
  ↓
agents/exporter/csv_exporter.js
  → Generates CSV export with all fields
  ↓
tools/export_snapshot.js
  → Creates timestamped JSON snapshot
  → Archives to data/snapshots/
OUTPUT: leads.csv + snapshot JSON
```

### Stage 8 — Outreach

```
INPUT: HOT/WARM leads without prior contact
  ↓
agents/ai/ai_email_generator.js
  → GPT-4 personalised email:
    - References contractor's specific business name
    - Mentions their review count / rating
    - Industry-specific value proposition
    - Clear call to action
  ↓
outreach/outreach_engine.js
  → Nodemailer delivery (SendGrid SMTP)
  → Logs delivery status
  ↓
outreach/follow_up_scheduler.js
  → Schedules follow-up sequence:
    Day 3 → first follow-up
    Day 7 → second follow-up
    Day 14 → final follow-up
  ↓
agents/outreach/email_tracking.js
  → Tracks opens, clicks, replies
OUTPUT: outreach records in PostgreSQL + CRM contacts
```

### Stage 9 — Intelligence & Reporting

```
INPUT: scored + tracked leads
  ↓
agents/intelligence/opportunity_heatmap.js
  → Geographic opportunity density mapping
  ↓
agents/prediction/prediction_agent.py
  → Revenue forecast
  → Conversion probability per lead
  ↓
agents/simulation/simulation_agent.py
  → Scenario modeling (optimistic/base/pessimistic)
  ↓
agents/sales/revenue_forecast.js
  → Sales pipeline revenue projection
OUTPUT: intelligence reports + dashboard data
```

### Stage 10 — Dashboard Sync

```
INPUT: processed leads + intelligence data
  ↓
GET /api/v1/leads                → Lead browser
GET /api/v1/leads/stats/summary  → KPI cards
GET /api/v1/outreach/stats       → Campaign performance
GET /api/v1/crm/stats            → Pipeline metrics
  ↓
Next.js dashboard (dashboard/) + Vite SPA (XPS-INTELLIGENCE-FRONTEND)
  → Real-time display via polling
OUTPUT: live dashboard with all intelligence data
```

---

## Scoring Field Convention

> All new code writes `lead_score` as the canonical field name.
> Legacy field `score` is supported for reading but not written by new modules.

## Module System Convention

> All Node.js files use `"use strict"` and CommonJS (`require` / `module.exports`).
> All pipeline scripts log at `[Module]` prefix level for traceability.
> All scrapers wrap their outer loop in `try/finally` to always close the browser.

---

*See also: [SYSTEM_FORENSIC_MAP.md](SYSTEM_FORENSIC_MAP.md) · [DEPLOYMENT.md](DEPLOYMENT.md) · [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md) · [AGENTS.md](AGENTS.md)*
