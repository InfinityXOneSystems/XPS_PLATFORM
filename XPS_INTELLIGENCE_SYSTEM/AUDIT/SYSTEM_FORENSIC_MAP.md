# System Forensic Map — XPS Intelligence Platform

**Generated:** 2026-03-10  
**Scope:** Full repository forensic audit  
**Status:** ✅ COMPLETE  

---

## 1. Architecture Overview

```
XPS_INTELLIGENCE_SYSTEM (this repo)
├── Express Gateway (api/gateway.js)        ← Railway web entrypoint
├── FastAPI Backend (backend/app/main.py)   ← Python API
├── Next.js Dashboard (dashboard/)          ← Admin UI
├── Agent Ecosystem (agents/)               ← 50+ agent modules
├── Vision Cortex (vision_cortex/)          ← Intelligence ingestion
├── Infinity Library (infinity_library/)    ← Knowledge store
├── Runtime Layer (runtime_controller/)     ← Execution engine
└── Task Queue (task_queue/)                ← BullMQ + Redis

XPS_INTELLIGENCE_FRONTEND (separate repo)
└── Vite + React + TypeScript
    ├── VITE_API_URL → backend API
    └── Contract files: contracts/frontend/
```

---

## 2. Backend Services

| Service | Technology | Port | Entry Point | Status |
|---------|-----------|------|-------------|--------|
| Express Gateway | Node.js 20 | 3000 | `api/gateway.js` | ✅ Active |
| FastAPI Backend | Python 3.11 | 8000 | `backend/app/main.py` | ✅ Active |
| Next.js Dashboard | Node.js 20 | 3000 | `dashboard/` | ✅ Active |
| PostgreSQL | 15 | 5432 | `db/db.js` | ✅ Configured |
| Redis | 7 | 6379 | `task_queue/` | ✅ Configured |
| BullMQ Worker | Node.js | - | `workers/` | ✅ Configured |

---

## 3. API Routes Inventory

### Express Gateway (`api/gateway.js`)

| Route | Method | Handler | Description |
|-------|--------|---------|-------------|
| `/health` | GET | inline | Health check → 200 |
| `/api/status` | GET | inline | System status |
| `/api/leads` | GET | leads handler | List leads |
| `/api/leads` | POST | leads handler | Create lead |
| `/api/leads/:id` | GET,PUT,DELETE | leads handler | Single lead CRUD |
| `/api/run-scraper` | POST | scraper | Trigger scrape |
| `/api/export` | GET | exporter | Export leads CSV |
| `/api/agents/*` | * | agents | Agent proxy |
| All OPTIONS | OPTIONS | global | 204 CORS preflight |

### FastAPI Backend (`backend/app/api/v1/`)

| Router | Prefix | Endpoints |
|--------|--------|-----------|
| leads.py | `/api/v1/leads` | CRUD + stats + export |
| runtime.py | `/api/v1/runtime` | command, task, parallel, file, shadow, agents |
| intelligence.py | `/api/v1/intelligence` | discovery, trends, niches, briefing, vision-cortex, predictions |
| admin.py | `/api/v1/admin` | users, features, settings, integrations, health |
| crm.py | `/api/v1/crm` | contacts, pipeline, outreach |
| connectors.py | `/api/v1/connectors` | connector registry + test |
| multi_agent.py | `/api/v1/multi-agent` | sessions, messages |
| scrapers.py | `/api/v1/scrapers` | run, status |
| agents.py | `/api/v1/agents` | run, status |
| outreach.py | `/api/v1/outreach` | send, schedule |

---

## 4. Agent Modules Inventory

### Python Agents (`agents/`)

| Agent | Path | Extends BaseAgent | Purpose |
|-------|------|-------------------|---------|
| ScraperAgent | `agents/scraper_agent.py` | ✅ | Lead scraping |
| SEOAgent | `agents/seo/seo_agent.py` | ✅ | SEO analysis + keywords |
| SocialAgent | `agents/social/social_agent.py` | ✅ | Social media analysis |
| BrowserAgent | `agents/browser/browser_automation_agent.py` | ✅ | Browser automation |
| CEOAgent | `agents/ceo/ceo_agent.py` | ✅ | Strategic decisions |
| VisionAgent | `agents/vision/vision_agent.py` | ✅ | Opportunity detection |
| StrategyAgent | `agents/strategy/strategy_agent.py` | ✅ | Execution planning |
| PredictionAgent | `agents/prediction/prediction_agent.py` | ✅ | Financial forecasting |
| SimulationAgent | `agents/simulation/simulation_agent.py` | ✅ | Scenario modeling |
| DatabaseAgent | `agents/database_agent.py` | ✅ | DB operations |
| SupervisorAgent | `agents/supervisor/supervisor_agent.py` | ✅ | Multi-agent coordination |
| PlannerAgent | `agent_core/planner_agent.py` | ✅ | Task planning |
| ValidatorAgent | `agent_core/validator_agent.py` | ✅ | Result validation |
| MemoryAgent | `agent_core/memory_agent.py` | ✅ | State persistence |
| OrchestratorAgent | `agent_core/orchestrator.py` | ✅ | Pipeline coordination |

### Node.js Agents (`agents/`)

| Agent | Path | Purpose |
|-------|------|---------|
| LeadScoringAgent | `agents/scoring/lead_scoring.js` | Score leads |
| DedupeAgent | `agents/dedupe/deduplication_engine.js` | Remove duplicates |
| EnrichmentAgent | `agents/enrichment/enrichment_engine.js` | Enrich lead data |
| OutreachAgent | `outreach/outreach_engine.js` | Email outreach |
| InfinityOrchestrator | `agents/orchestrator/infinity_orchestrator.js` | Master coordinator |

---

## 5. Database Schemas

### PostgreSQL (Production)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `contractors` | Lead database | id, company, email, phone, city, state, score |
| `scrape_jobs` | Scraping job tracking | id, status, source, created_at |
| `users` | Admin users | id, email, role, created_at |
| `leads` | SQLAlchemy ORM leads | id, company, city, state, email, lead_score |
| `features` | Feature flags | id, name, enabled |
| `settings` | System settings | key, value, is_encrypted |
| `integrations` | External integrations | id, name, provider, config |
| `audit_logs` | Admin audit trail | id, action, user_id, timestamp |

### SQLite (Test fallback)
- Same schema, PostgreSQL types monkeypatched (ARRAY/UUID/JSONB)

### JSON Storage
- `leads/leads.json` — canonical lead store
- `data/leads/leads.json` — legacy fallback (dual-write)

---

## 6. Scraping Systems

| Scraper | Location | Target | Status |
|---------|----------|--------|--------|
| Google Maps | `scrapers/google_maps_scraper.js` | Business listings | ✅ |
| Bing Maps | `scrapers/bing_maps_scraper.js` | Business listings | ✅ |
| Yelp | `scrapers/yelp_scraper.js` | Business reviews | ✅ |
| Directory | `scrapers/directory_scraper.js` | Business directories | ✅ |
| Shadow Scraper | `vision_cortex/shadow_scraper/` | Intelligence sources | ✅ |
| Headless Browser | `agents/headless/` | JavaScript sites | ✅ |

---

## 7. Authentication Systems

| System | Implementation | Endpoints |
|--------|---------------|-----------|
| Admin API auth | ADMIN_SECRET header token | All `/api/v1/admin/*` |
| JWT (planned) | Not yet implemented | TBD |
| Session auth | Next.js sessions | Dashboard |

---

## 8. Workflow Systems

| Workflow File | Trigger | Purpose |
|---------------|---------|---------|
| `ci.yml` | push/PR to main | Python lint + test + Node test |
| `system_validation.yml` | push to main/develop/copilot/** | Full system validation |
| `code_quality.yml` | push *.js/*.ts | Node.js tests + linting |
| `lead_pipeline.yml` | schedule/dispatch | Automated lead collection |
| `enterprise_lead_pipeline.yml` | schedule | Enterprise scraping |
| `infinity_orchestrator.yml` | schedule/dispatch | Agent orchestration |
| `national_discovery.yml` | schedule | Nationwide lead discovery |
| `autonomous_pipeline.yml` | schedule | Autonomous operation |

---

## 9. Component Integration Status

| Component | Internal Integration | External Integration | Status |
|-----------|---------------------|---------------------|--------|
| Express ↔ FastAPI | HTTP proxy `/api/v1/*` | ✅ | Wired |
| Next.js ↔ Express | REST API calls | ✅ | Wired |
| Vite Frontend ↔ Backend | VITE_API_URL env var | ✅ | Wired |
| Agents ↔ RuntimeController | `handle_command()` | ✅ | Wired |
| VisionCortex ↔ InfinityLibrary | `lib.store()` | ✅ | Wired |
| BullMQ ↔ Redis | Queue tasks | ✅ | Configured |
| PostgreSQL ↔ SQLAlchemy | ORM | ✅ | Wired |
| GitHub Actions ↔ Workflows | Auto-trigger | ✅ | Wired |

---

## 10. Identified Issues (Pre-Audit)

| Issue | Severity | File | Status |
|-------|----------|------|--------|
| UTF-16 encoded Python file | HIGH | `tests/system/test_agent_health.py` | ✅ FIXED |
| Duplicate `SEOAgent` class (second lacked methods) | HIGH | `agents/seo/seo_agent.py` | ✅ FIXED |
| `command_router.py` syntax error (missing `{`) | HIGH | `agent_core/command_router.py` | ✅ FIXED |
| 16 test failures in `tests/` | HIGH | Various | ✅ FIXED |
| `pytest.mark.integration` unregistered | LOW | `pyproject.toml` | ✅ FIXED |

---

## 11. Final Counts

| Category | Count |
|----------|-------|
| Python agent modules | 20+ |
| Node.js pipeline scripts | 15+ |
| Backend API endpoints | 38+ |
| GitHub Action workflows | 20+ |
| Root-level Python tests | 315 pass, 1 skip |
| Backend Python tests | 154 pass |
| Node.js tests | 158 pass |
| **Total tests** | **627** |
