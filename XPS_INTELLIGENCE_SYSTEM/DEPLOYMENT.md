# XPS Intelligence – Deployment Guide

## System Architecture

```
XPS-INTELLIGENCE-FRONTEND  (Vercel / Docker Desktop)
─────────────────────────────────
Vite + React + TypeScript
Uses Groq API for AI chat (VITE_GROQ_API_KEY)
VITE_API_URL ──────────────────────────► POST /api/v1/runtime/command
                                         GET  /api/v1/runtime/task/{id}
                                         GET  /health
                XPS_INTELLIGENCE_SYSTEM  (Railway / Docker Desktop)
                ──────────────────────────────────────────────────
                FastAPI backend
                ├── Railway Postgres plugin  (DATABASE_URL)
                ├── Railway Redis plugin     (REDIS_URL)
                └── Railway Ollama service  (OLLAMA_BASE_URL)
```

| Layer | Repo | Platform | URL |
|-------|------|----------|-----|
| Frontend | XPS-INTELLIGENCE-FRONTEND | Vercel | `https://xps-intelligence.vercel.app` |
| Backend API | XPS_INTELLIGENCE_SYSTEM | Railway | `https://xpsintelligencesystem-production.up.railway.app` |
| Database | Railway PostgreSQL | Railway | internal |
| Queue | Railway Redis | Railway | internal |
| Local LLM | Railway Ollama | Railway | internal |

---

## Backend – Railway (XPS_INTELLIGENCE_SYSTEM)

### 1. Connect Railway to GitHub

1. Login to [railway.app](https://railway.app)
2. New Project → Deploy from GitHub repo → `InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM`
3. Select **Root Directory**: `backend`
4. Railway auto-detects `backend/railway.json` and uses `Dockerfile` in that directory
5. Click **Deploy**

### 2. Add Railway Managed Services

In the Railway project dashboard, add the following plugins/services:

| Service | Type | Notes |
|---------|------|-------|
| **Postgres** | Railway Plugin | Provides `${{Postgres.DATABASE_URL}}` |
| **Redis** | Railway Plugin | Provides `${{Redis.REDIS_URL}}` |
| **Ollama** | Custom Service | Image: `ollama/ollama:latest`, Port: `11434` |

For Ollama: after deploying the service, exec into it and pull the model:
```bash
railway run --service ollama ollama pull llama3.2
```

### 3. Environment Variables (Railway dashboard → Variables)

> **Tip:** Copy all variables from [`.env.railway.template`](.env.railway.template) into the
> Railway Backend service → Variables tab.

| Variable | Description | Value |
|----------|-------------|-------|
| `DATABASE_URL` | Railway Postgres connection | `${{Postgres.DATABASE_URL}}` |
| `REDIS_URL` | Railway Redis connection | `${{Redis.REDIS_URL}}` |
| `OLLAMA_BASE_URL` | Railway Ollama service | `http://${{Ollama.RAILWAY_PRIVATE_DOMAIN}}:11434` |
| `OLLAMA_MODEL` | Ollama model to use | `llama3.2` |
| `LLM_PROVIDER` | LLM routing mode | `auto` (Groq→Ollama→OpenAI) |
| `GROQ_API_KEY` | Groq cloud API key | `gsk_...` |
| `GROQ_MODEL` | Groq model | `llama3-8b-8192` |
| `SECRET_KEY` | JWT signing secret | `openssl rand -hex 32` |
| `CORS_ALLOWED_ORIGINS` | Allowed frontend origins | `https://xps-intelligence.vercel.app,...` |
| `FRONTEND_URL` | Frontend base URL | `https://xps-intelligence.vercel.app` |
| `GITHUB_TOKEN` | Repo access for pipelines | `ghp_xxxx` |
| `SENDGRID_API_KEY` | Outreach emails | `SG.xxxx` |

### 4. Verify Backend

```bash
curl https://xpsintelligencesystem-production.up.railway.app/health
# → {"status":"healthy","service":"leadgen-api","version":"1.0.0"}

# Test runtime command endpoint
curl -X POST https://xpsintelligencesystem-production.up.railway.app/api/v1/runtime/command \
  -H "Content-Type: application/json" \
  -d '{"command":"status","priority":5}'
# → {"task_id":"...","status":"queued","command_type":"...","agent":"...","message":"...","params":{}}
```

---

## Frontend – Vercel (XPS-INTELLIGENCE-FRONTEND)

### 1. Connect Vercel to GitHub

1. Login to [vercel.com](https://vercel.com)
2. Add New Project → Import `InfinityXOneSystems/XPS-INTELLIGENCE-FRONTEND`
3. Framework: **Vite** (auto-detected)
4. Root directory: `/` (no change needed)

### 2. Environment Variables (Vercel dashboard → Settings → Environment Variables)

> **Full instructions:** See [`VERCEL_DEPLOYMENT_SETUP.md`](VERCEL_DEPLOYMENT_SETUP.md) for a step-by-step guide including testing commands.

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://xpsintelligencesystem-production.up.railway.app` |
| `VITE_BACKEND_URL` | `https://xpsintelligencesystem-production.up.railway.app` |
| `VITE_API_BASE_URL` | `https://xpsintelligencesystem-production.up.railway.app` |
| `VITE_GROQ_API_KEY` | Your Groq API key (`gsk_...`) |
| `VITE_GROQ_MODEL` | `llama3-8b-8192` |

### 3. Wire the RuntimeCommandChat Component

The `RuntimeCommandChat` component that talks to the backend runtime API is ready to use.
Copy the contract files from this repo:

```bash
# From XPS-INTELLIGENCE-FRONTEND root
cp path/to/XPS_INTELLIGENCE_SYSTEM/contracts/frontend/src/services/runtimeService.ts src/services/
cp path/to/XPS_INTELLIGENCE_SYSTEM/contracts/frontend/src/components/RuntimeCommandChat.tsx src/components/
```

Then add it to `AgentPage.tsx`:

```tsx
import { RuntimeCommandChat } from '@/components/RuntimeCommandChat'

// In your JSX:
<div className="h-[calc(100vh-8rem)]">
  <RuntimeCommandChat />
</div>
```

See `contracts/frontend/README.md` for full integration instructions.

---

## Docker Desktop Local Development

Run the full stack locally using Docker Desktop. This mirrors the Railway topology exactly.

### Prerequisites

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop)
2. Clone both repos into the same parent directory:
   ```
   C:\XPS_PLATFORM\
   ├── XPS_INTELLIGENCE_SYSTEM\   ← this repo
   └── XPS-INTELLIGENCE-FRONTEND\ ← frontend repo
   ```
3. Copy and fill in the environment file:
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local — at minimum set GROQ_API_KEY
   ```

### Start the full stack

```bash
# From XPS_INTELLIGENCE_SYSTEM directory
docker compose -f docker-compose.desktop.yml up -d

# On first startup, pull the Ollama model:
docker compose -f docker-compose.desktop.yml exec ollama ollama pull llama3.2
```

### Services

| Service | URL | Description |
|---------|-----|-------------|
| `backend` | http://localhost:8000 | FastAPI backend |
| `gateway` | http://localhost:3000 | Express API gateway |
| `frontend` | http://localhost:5173 | Vite dev server (XPS-INTELLIGENCE-FRONTEND, uses Groq) |
| `ollama` | http://localhost:11434 | Local Ollama LLM (mirrors Railway Ollama service) |
| `postgres` | localhost:5432 | PostgreSQL (mirrors Railway Postgres plugin) |
| `redis` | localhost:6379 | Redis (mirrors Railway Redis plugin) |

### Verify

```bash
curl http://localhost:8000/health
# → {"status":"healthy","service":"leadgen-api","version":"1.0.0"}

curl http://localhost:3000/api/health
# → {"status":"OK"}
```

### Stop

```bash
docker compose -f docker-compose.desktop.yml down
```

---

## Runtime API Contract

### POST `/api/v1/runtime/command`

**Request:**
```json
{
  "command": "scrape epoxy contractors in Texas",
  "priority": 5,
  "params": {},
  "timeout_seconds": 300
}
```

**Response (202 Accepted):**
```json
{
  "task_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "status": "queued",
  "command_type": "scrape_website",
  "agent": "scraper",
  "message": "Task queued successfully",
  "params": {}
}
```

### GET `/api/v1/runtime/task/{task_id}`

**Response:**
```json
{
  "task_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "status": "completed",
  "command_type": "scrape_website",
  "agent": "scraper",
  "created_at": "2026-03-10T05:00:00Z",
  "started_at": "2026-03-10T05:00:01Z",
  "completed_at": "2026-03-10T05:00:15Z",
  "result": {"leads_scraped": 42},
  "error": null,
  "logs": ["Starting scrape...", "Found 42 leads", "Done."],
  "retries": 0
}
```

**Task status flow:** `pending` → `queued` → `running` → `completed` | `failed` | `retrying`

---

## CI/CD Workflows

| Workflow | Repo | Trigger | Action |
|----------|------|---------|--------|
| `ci.yml` | XPS_INTELLIGENCE_SYSTEM | Push/PR to main | Backend tests + dashboard build |
| `deploy-backend.yml` | XPS_INTELLIGENCE_SYSTEM | Push to main (backend/) | Test + deploy to Railway |
| `system_validation.yml` | XPS_INTELLIGENCE_SYSTEM | Push/PR to any branch | Full system health check |

---

## Troubleshooting

### Frontend shows "Connection error"
→ `VITE_API_URL` is not set or wrong. Check Vercel env vars or `.env.local`.
→ CORS: add the frontend origin to `CORS_ALLOWED_ORIGINS` in Railway Variables.

### Task stays in `queued` forever
→ Worker pool may be at capacity. Check Railway logs.
→ Redis may not be connected. Check `REDIS_URL`.

### Railway deploy fails with "RAILWAY_TOKEN not set"
→ Add `RAILWAY_TOKEN` secret in GitHub repo Settings → Secrets.
→ Get token from Railway dashboard → Account → Tokens.

### Backend 500 on `/api/v1/runtime/command`
→ Check Railway logs: `railway logs`
→ Ensure `DATABASE_URL` and `REDIS_URL` are set.

### Ollama model not found
→ Railway: `railway run --service ollama ollama pull llama3.2`
→ Docker Desktop: `docker compose -f docker-compose.desktop.yml exec ollama ollama pull llama3.2`

### Groq API errors
→ Verify `GROQ_API_KEY` is valid at https://console.groq.com
→ Check the model name: `GROQ_MODEL=llama3-8b-8192`
→ If Groq is unavailable, set `LLM_PROVIDER=ollama` to fall back to local Ollama.

