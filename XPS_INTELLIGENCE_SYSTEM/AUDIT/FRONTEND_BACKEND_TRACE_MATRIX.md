# Frontend–Backend Trace Matrix

**Generated:** 2026-03-10  
**Status:** ✅ COMPLETE  

---

## Overview

The XPS Intelligence platform has three frontend layers:

1. **Next.js Dashboard** (`dashboard/`) — admin/operator UI, served from this repo
2. **Vite+React Frontend** (`InfinityXOneSystems/XPS-INTELLIGENCE-FRONTEND`) — separate repo
3. **Express Gateway** (`api/gateway.js`) — internal proxy layer

---

## Next.js Dashboard → FastAPI Backend

| Dashboard Page | Route | Backend Endpoint | Method | Status |
|----------------|-------|-----------------|--------|--------|
| `index.js` | `/` | Static + nav | - | ✅ |
| `leads.js` | `/leads` | `GET /api/v1/leads` | GET | ✅ |
| `leads.js` | `/leads` | `POST /api/v1/leads` | POST | ✅ |
| `leads.js` | `/leads` | `DELETE /api/v1/leads/{id}` | DELETE | ✅ |
| `leads.js` | `/leads` | `GET /api/v1/leads/export` | GET | ✅ |
| `analytics.js` | `/analytics` | `GET /api/v1/leads/stats` | GET | ✅ |
| `chat.js` | `/chat` | `POST /api/v1/runtime/command` | POST | ✅ |
| `chat.js` | `/chat` | `GET /api/v1/runtime/task/{id}` | GET | ✅ |
| `chat.js` | `/chat` | `POST /api/v1/multi-agent/sessions` | POST | ✅ |
| `chat.js` | `/chat` | `POST /api/v1/multi-agent/sessions/{id}/message` | POST | ✅ |
| `crm.js` | `/crm` | `GET /api/v1/crm/contacts` | GET | ✅ |
| `crm.js` | `/crm` | `POST /api/v1/crm/contacts` | POST | ✅ |
| `crm.js` | `/crm` | `GET /api/v1/crm/pipeline` | GET | ✅ |
| `connectors.js` | `/connectors` | `GET /api/v1/connectors` | GET | ✅ |
| `connectors.js` | `/connectors` | `POST /api/v1/connectors/{id}/test` | POST | ✅ |
| `settings.js` | `/settings` | `GET /api/v1/admin/settings` | GET | ✅ |
| `settings.js` | `/settings` | `POST /api/v1/admin/settings` | POST | ✅ |
| `studio.js` | `/studio` | `GET /api/v1/runtime/file` | GET | ✅ |
| `studio.js` | `/studio` | `POST /api/v1/runtime/file` | POST | ✅ |
| `workspace.js` | `/workspace` | `GET /api/v1/runtime/file` | GET | ✅ |
| `intelligence.js` | `/intelligence` | `GET /api/v1/intelligence/vision-cortex/status` | GET | ✅ |
| `intelligence.js` | `/intelligence` | `GET /api/v1/intelligence/briefing` | GET | ✅ |
| `intelligence.js` | `/intelligence` | `GET /api/v1/intelligence/discovery` | GET | ✅ |
| `invention-lab.js` | `/invention-lab` | `POST /api/v1/intelligence/invention/run` | POST | ✅ |
| `invention-lab.js` | `/invention-lab` | `GET /api/v1/intelligence/hypotheses/generate` | GET | ✅ |
| `trends.js` | `/trends` | `GET /api/v1/intelligence/trends` | GET | ✅ |
| `trends.js` | `/trends` | `GET /api/v1/intelligence/niches` | GET | ✅ |
| `guardian.js` | `/guardian` | `GET /api/v1/intelligence/system-status` | GET | ✅ |

---

## Vite Frontend Contract Layer

The `contracts/frontend/` directory contains TypeScript contract files that define the wiring between the Vite frontend and backend:

| Contract File | Purpose | Backend Route |
|---------------|---------|---------------|
| `contracts/frontend/src/services/runtimeService.ts` | Runtime command client | `POST /api/v1/runtime/command` |
| `contracts/frontend/src/components/RuntimeCommandChat.tsx` | Chat UI component | `GET /api/v1/runtime/task/{id}` |

**VITE_API_URL** env var points to the Railway backend.

---

## Express Gateway → FastAPI Proxy

The Express gateway (`api/gateway.js`) proxies these routes to the FastAPI backend:

| Gateway Route | Proxy Target | Description |
|---------------|-------------|-------------|
| `GET /health` | inline | Returns 200 OK |
| `GET /api/status` | inline | System status |
| `OPTIONS *` | inline | 204 CORS preflight |
| All other `/api/*` | `http://backend:8000` | FastAPI proxy |

---

## Authentication Trace

| Auth Layer | Mechanism | Covers |
|------------|-----------|--------|
| Admin API | `X-Admin-Secret` header | All `/api/v1/admin/*` endpoints |
| CORS | `ALLOWED_ORIGINS` env var | All FastAPI routes |
| Next.js Auth | Next.js session | Dashboard pages |

---

## Real-Time Communication

| Feature | Method | Client | Server |
|---------|--------|--------|--------|
| Task polling | HTTP polling (1s interval) | `chat.js` | `GET /api/v1/runtime/task/{id}` |
| Agent status | HTTP polling | `guardian.js` | `GET /api/v1/intelligence/system-status` |
| Vision Cortex | HTTP POST + poll | `intelligence.js` | `POST /api/v1/intelligence/vision-cortex/run` |

---

## Data Flow Trace

```
User Input (chat.js)
    │
    ▼
POST /api/v1/runtime/command
    │
    ▼
RuntimeController.handle_command()
    │
    ├── CommandRouter.route(command)
    │       └── Dispatches to appropriate agent
    │
    ├── TaskDispatcher.dispatch(task)
    │       └── WorkerPool (6 concurrent workers)
    │
    └── TaskStateStore.store(task_id, status)
            │
            ▼
        GET /api/v1/runtime/task/{task_id}  ← Frontend polls
            │
            ▼
        Response displayed in chat.js
```

---

## Status Summary

| Layer | Traced | Wired | Tested |
|-------|--------|-------|--------|
| Next.js → FastAPI | ✅ | ✅ | ✅ |
| Vite Frontend → FastAPI | ✅ | ✅ | Contract files present |
| Express Gateway | ✅ | ✅ | ✅ |
| Agent ↔ Runtime | ✅ | ✅ | ✅ |
| Auth | ✅ | ✅ | ✅ (24 admin tests) |

**PRODUCTION_READY = TRUE (frontend-backend integration)**
