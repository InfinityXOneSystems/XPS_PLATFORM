# XPS Intelligence — Frontend Integration Guide

This document describes how the **XPS_INTELLIGENCE_SYSTEM** backend connects to the
[XPS-INTELLIGENCE-FRONTEND](https://github.com/InfinityXOneSystems/XPS-INTELLIGENCE-FRONTEND)
React/Vite dashboard.

---

## Architecture

```
XPS-INTELLIGENCE-FRONTEND  ─►  XPS_INTELLIGENCE_SYSTEM (this repo)
  Vite/React SPA                  Express Gateway  :3000
  Radix UI + Tailwind             FastAPI Core     :8000
  React Query hooks               PostgreSQL       :5432
  openapi.yaml contract           Redis            :6379
```

---

## API Base URL

The frontend reads `VITE_API_URL` (defaults to `http://localhost:3000/api`).

Set it in the frontend's `.env`:

```bash
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000
```

---

## Implemented Endpoints

All routes are served by `api/gateway.js` (Express, port 3000):

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/leads` | List leads (city/state/minScore/limit/offset filters) |
| `POST` | `/api/leads` | Create a new lead |
| `GET` | `/api/leads/metrics` | Dashboard KPI metrics |
| `GET` | `/api/leads/:id` | Get single lead |
| `PUT` | `/api/leads/:id` | Update a lead |
| `DELETE` | `/api/leads/:id` | Delete a lead |
| `POST` | `/api/leads/:id/assign` | Assign lead to rep |
| `PUT` | `/api/leads/:id/status` | Update lead status |
| `POST` | `/api/leads/:id/notes` | Add note to lead |
| `POST` | `/api/scraper/run` | Start a scraper job |
| `GET` | `/api/scraper/status/:jobId` | Get job status |
| `GET` | `/api/scraper/logs` | Get scraper history |
| `POST` | `/api/scraper/results` | Ingest results from GitHub Actions |
| `GET` | `/api/agent/plans` | List agent plans |
| `POST` | `/api/agent/plans` | Create & execute plan |
| `GET` | `/api/agent/plans/:id` | Get specific plan |
| `GET` | `/api/tools` | List available tools |
| `GET` | `/api/stats` | Aggregate statistics |
| `GET` | `/api/pipeline/status` | Pipeline health |
| `POST` | `/api/pipeline/run` | Trigger GitHub Actions workflow |
| `GET` | `/api/monitoring/health` | Service health |
| `GET` | `/api/heatmap` | Geographic lead density |

Full contract: [`contracts/openapi.yaml`](../contracts/openapi.yaml)

---

## Running Locally

```bash
# 1. Start backend services
docker compose up -d postgres redis

# 2. Start API gateway
npm run gateway          # :3000

# 3. Start FastAPI agent core  
npm run agent:server     # :8000

# 4. Run the frontend (from XPS-INTELLIGENCE-FRONTEND repo)
cd ../XPS-INTELLIGENCE-FRONTEND
cp .env.example .env
# Edit .env: VITE_API_URL=http://localhost:3000/api
npm install && npm run dev  # :5173
```

---

## Authentication

The gateway accepts `Authorization: Bearer <token>` headers.
Set `JWT_SECRET` in `.env` to enable token validation.

---

## CORS

The gateway allows all origins by default in development.
For production, set `CORS_ALLOWED_ORIGINS` as a comma-separated list:

```bash
CORS_ALLOWED_ORIGINS=https://xps-intelligence.vercel.app,https://your-domain.com
```

---

## Contract Sync

The shared API contract lives in `contracts/openapi.yaml` (this repo) and is
mirrored as `openapi.yaml` in the frontend repo.

To regenerate TypeScript types in the frontend:

```bash
cd XPS-INTELLIGENCE-FRONTEND
npx openapi-typescript ../XPS_INTELLIGENCE_SYSTEM/contracts/openapi.yaml -o src/types/api.d.ts
```
