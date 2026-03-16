# XPS Intelligence – Active Memory

> Last updated: 2026-03-10  
> Status: Production-ready backend · Frontend wiring ready

---

## System Architecture

```
XPS-INTELLIGENCE-FRONTEND  (Vercel)
   Vite + React + TypeScript
   VITE_API_URL → Railway
         │
         │  POST /api/v1/runtime/command
         │  GET  /api/v1/runtime/task/{id}
         ▼
XPS_INTELLIGENCE_SYSTEM  (Railway)
   FastAPI backend  :8000
         │
   ┌─────┴──────┐
   │            │
RuntimeController   Agents
   │            ├── scraper_agent
TaskDispatcher  ├── seo_agent
   │            ├── social_agent
WorkerPool      ├── browser_agent
   │            ├── enrichment_agent
TaskStateStore  └── outreach_agent
(Redis / memory)
         │
   PostgreSQL DB
```

---

## Backend Modules (backend/app/)

| Module | Path | Description |
|--------|------|-------------|
| Runtime API | `api/v1/runtime.py` | POST /runtime/command, GET /runtime/task/{id} |
| System API | `api/v1/system.py` | GET /system/health, /system/metrics, /system/tasks |
| RuntimeController | `runtime/runtime_controller.py` | Entry point — validate → route → dispatch |
| CommandRouter | `runtime/command_router.py` | Keyword-based routing to agent + command type |
| CommandValidator | `runtime/command_validator.py` | Validate command text and params |
| CommandSchema | `runtime/command_schema.py` | Pydantic models for request/response |
| TaskDispatcher | `runtime/task_dispatcher.py` | Dispatch tasks to worker pool |
| TaskStateStore | `queue/task_state_store.py` | Redis-backed (in-memory fallback) task state |
| WorkerPool | `workers/worker_pool.py` | Async worker execution |
| Observability | `observability/` | Metrics, tracing, agent logs, health |
| Browser Agent | `agents/browser_agent/browser.py` | Web navigation, extraction, Playwright |
| SEO Agent | `agents/seo_agent/seo.py` | HTML analysis, keyword strategy |
| Social Agent | `agents/social_agent/social.py` | Social profile discovery |
| Scraper Agent | `agents/scraper_agent/scraper.py` | Lead scraping handler |

---

## Frontend Contract Files (contracts/frontend/)

Files ready to copy into `XPS-INTELLIGENCE-FRONTEND`:

| File | Purpose |
|------|---------|
| `src/services/runtimeService.ts` | Typed API client for runtime endpoints |
| `src/components/RuntimeCommandChat.tsx` | Chat UI with live task polling |

See `contracts/frontend/README.md` for integration instructions.

---

## Environment Variables

### Backend (Railway)
- `DATABASE_URL` — PostgreSQL
- `REDIS_URL` — Redis
- `SECRET_KEY` — JWT
- `SENDGRID_API_KEY` — Email outreach
- `OPENAI_API_KEY` — LLM
- `GITHUB_TOKEN` — GitHub Actions
- `PLAYWRIGHT_ENABLED` — Browser automation (default: false)

### Frontend (Vercel — XPS-INTELLIGENCE-FRONTEND)
- `VITE_API_URL` — Backend Railway URL (e.g. `https://xps-api.up.railway.app`)

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health check |
| POST | `/api/v1/runtime/command` | Submit NL command → returns task_id |
| GET | `/api/v1/runtime/task/{id}` | Poll task status/logs/result |
| GET | `/system/health` | Dependency health (DB, Redis, agents) |
| GET | `/system/metrics` | Prometheus-style runtime metrics |
| GET | `/system/tasks` | List all tracked tasks |
| GET | `/api/v1/leads` | List leads |
| GET | `/api/v1/agents` | List agents and status |
| POST | `/api/v1/agents/{name}/start` | Start an agent |
| GET | `/docs` | Swagger UI |

---

## Command Types (auto-detected from NL text)

| Command Type | Keywords |
|-------------|---------|
| `scrape_website` | scrape, find contractors, discover leads |
| `seo_analysis` | seo, keyword analysis, site audit |
| `post_social` | social media, tweet, linkedin post |
| `run_agent` | run agent, execute agent |
| `outreach` | send email, outreach campaign |
| `export` | export leads, csv, download |
| `analytics` | analytics, dashboard, metrics |
| `generate_code` | generate code, build feature |

---

## CI/CD

- `ci.yml` — Backend lint/test + dashboard build/lint (refs: `dashboard/`)
- `deploy-backend.yml` — Test + Railway deploy on backend changes
- `system_validation.yml` — Full system health validation on all branches

---

## Known Constraints

- Admin API tests (22 failures) require `ADMIN_SECRET` env var — pre-existing, unrelated to runtime changes
- Playwright browser features require `PLAYWRIGHT_ENABLED=true` + Playwright browsers installed
- In-memory task store used when Redis unavailable (suitable for development)
