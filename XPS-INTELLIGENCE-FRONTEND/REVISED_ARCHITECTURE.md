# XPS Intelligence — Revised System Architecture

> **Version**: 2.0 (post-forensic)  
> **Replaces**: ENTERPRISE_ARCHITECTURE.md (placeholder), PRD.md (frontend-only)  
> **Governed By**: Overseer-Prime / TAP Protocol  
> **Last Updated**: 2026-03-11

---

## 1. Guiding Principles

1. **One frontend** — The React/Vite app is the single UI surface. Deprecate the static HTML and Next.js dashboards in the backend repo.
2. **One API gateway** — All frontend API traffic goes through a single Express gateway on Railway. No direct DB access from frontend.
3. **Two runtimes, bridged** — Node.js (scraping, orchestration, lead pipeline) + Python (agents, LLM inference, vector search) coexist and communicate via HTTP on the same Railway deployment.
4. **Real agent execution** — Agents make real HTTP calls. Simulation is the fallback only when backend is unreachable.
5. **Auth everywhere** — JWT authentication on every protected route. No public scraper triggers.
6. **Environment-driven config** — Zero hardcoded URLs or ports. Every base URL comes from environment variables.

---

## 2. System Topology

```
┌─────────────────────────────────────────────────────────┐
│                    USER BROWSER                         │
│                                                         │
│   React/Vite SPA (Vercel)                               │
│   ├── Chat Command Interface (AIChatPanel)              │
│   ├── Agent Dashboard (AgentPage)                       │
│   ├── Task Queue (TaskQueuePage)                        │
│   ├── Scraper Results (ScraperPage)                     │
│   ├── Canvas (CanvasPage)                               │
│   ├── Code Editor (CodeEditorPage)                      │
│   ├── Sandbox Console (SandboxPage)                     │
│   ├── Settings / Token Vault (SettingsPage)             │
│   └── Leads / Pipeline / Reports                        │
└──────────┬───────────────────────────┬──────────────────┘
           │ HTTPS REST                │ WSS WebSocket
           ▼                           ▼
┌──────────────────────────────────────────────────────────┐
│           VERCEL EDGE FUNCTIONS (pages/api/)             │
│   /api/chat   → Groq LLM proxy (server-side key)        │
│   /api/agent  → Railway backend proxy                   │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTPS
                       ▼
┌──────────────────────────────────────────────────────────┐
│              RAILWAY BACKEND CLUSTER                     │
│                                                          │
│  ┌─────────────────────────────────────┐                 │
│  │  Express Gateway  (Node.js :3000)   │                 │
│  │  ├── JWT Auth middleware            │                 │
│  │  ├── CORS policy                   │                 │
│  │  ├── Rate limiting                 │                 │
│  │  ├── /api/leads       → DB         │                 │
│  │  ├── /api/scraper     → ScraperSvc │                 │
│  │  ├── /api/agents      → AgentCore  │                 │
│  │  ├── /api/chat        → LLM Router │                 │
│  │  ├── /api/settings    → Config DB  │                 │
│  │  └── /ws              → WebSocket  │                 │
│  └──────────────┬────────────────────┘                 │
│                 │ HTTP                                   │
│  ┌──────────────▼────────────────────┐                 │
│  │  Python Agent Core  (FastAPI :8000)│                 │
│  │  ├── PlannerAgent                 │                 │
│  │  ├── ResearchAgent (web search)   │                 │
│  │  ├── BuilderAgent  (code gen)     │                 │
│  │  ├── ScraperAgent  (Playwright)   │                 │
│  │  ├── ValidatorAgent               │                 │
│  │  ├── KnowledgeAgent (vector mem.) │                 │
│  │  ├── MediaAgent    (DALL-E/SD)    │                 │
│  │  ├── MetaAgent     (self-improve) │                 │
│  │  └── ... (13 agents total)        │                 │
│  └──────────────┬────────────────────┘                 │
│                 │                                        │
│  ┌──────────────▼────────────────────┐                 │
│  │  Task Queue (BullMQ + Redis)       │                 │
│  │  ├── scraper jobs                 │                 │
│  │  ├── enrichment jobs              │                 │
│  │  ├── scoring jobs                 │                 │
│  │  └── outreach jobs                │                 │
│  └──────────────┬────────────────────┘                 │
│                 │                                        │
│  ┌──────────────▼──────────────────────┐               │
│  │  PostgreSQL (Railway Postgres)       │               │
│  │  ├── leads (scored, normalized)     │               │
│  │  ├── tasks (agent task queue)       │               │
│  │  ├── memory (knowledge entries)     │               │
│  │  ├── outreach_log                   │               │
│  │  └── sessions (auth)               │               │
│  └─────────────────────────────────────┘               │
│                                                          │
│  ┌──────────────────────────────────────┐               │
│  │  Redis (BullMQ, rate limit cache)    │               │
│  └──────────────────────────────────────┘               │
└──────────────────────────────────────────────────────────┘
           │ Trigger
           ▼
┌──────────────────────────────────────────────────────────┐
│              GITHUB ACTIONS COMPUTE                      │
│  agent-scraper.yml    — Playwright lead scraping         │
│  lead_pipeline.yml    — Score + validate + export        │
│  system_validation.yml— Full test suite                  │
│  deploy.yml           — Build + push to GHCR             │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Authentication Architecture

```
User → Login → POST /api/auth/login → JWT (15min) + RefreshToken (7d)
                                          ↓
All subsequent requests → Authorization: Bearer <jwt>
                                          ↓
Express middleware → jwt.verify() → req.user
                                          ↓
Frontend → store JWT in memory (not localStorage)
         → store RefreshToken in httpOnly cookie
         → auto-refresh before expiry
```

**Roles**:
- `admin` — full access to all leads, agents, settings, scraper triggers
- `sales` — read-only access to assigned leads; can send emails
- `agent` — service account used by GitHub Actions workflows

---

## 4. Agent Execution Architecture

```
Chat UI → POST /api/agents/execute { command, agentRole }
                  ↓
          Express Gateway
                  ↓
          POST :8000/agents/execute  (Python FastAPI)
                  ↓
          AgentCore selects agent class
                  ↓
    ┌─────────────────────────────────┐
    │   Agent.execute(task, ctx)      │
    │   ├── LLM call (Groq/Gemini)    │
    │   ├── Tool calls                │
    │   │   ├── playwright_browser    │
    │   │   ├── shell_exec            │
    │   │   ├── file_read / write     │
    │   │   └── vector_search         │
    │   └── Return result             │
    └─────────────────────────────────┘
                  ↓
          POST result to WebSocket channel
                  ↓
          Frontend receives live update
```

**Key principle**: Each agent call has a **Task ID**. The frontend polls `GET /api/agents/status/{taskId}` OR subscribes to WebSocket channel `agents/{taskId}` for live log streaming.

---

## 5. Data Flow: Lead Lifecycle

```
1. DISCOVERY
   GitHub Actions (agent-scraper.yml)
   → Playwright scrapes Google Maps / Yelp / Directories
   → Raw leads written to PostgreSQL (status: raw)

2. ENRICHMENT
   Node.js worker (BullMQ)
   → Email discovery agent
   → Website reachability check
   → Phone normalization
   → Deduplication by (normalized_phone, domain)
   → Lead updated (status: enriched)

3. SCORING
   agents/scoring/scoring_pipeline.js
   → 6-factor score (website, email, phone, reviews, rating, geography)
   → Score normalized 0-100
   → Tier assignment (HOT ≥ 75, WARM 50-74, COLD < 50)
   → Lead updated (status: scored)

4. DISPLAY
   GET /api/leads?status=scored&tier=HOT
   → Frontend LeadsPage table
   → Real-time count via WebSocket

5. OUTREACH
   Triggered manually or by automation schedule
   → BusinessAgent generates email copy
   → Nodemailer / SendGrid sends
   → outreach_log entry created
   → Lead updated (last_contacted_at)
```

---

## 6. Memory Architecture

```
Short-term (session):
  Browser memory (React state, React Query cache)
  TTL: session duration

Medium-term (localStorage):
  xps_agent_memory — agent plan history
  xps_tool_registry — tool configuration
  xps-llm-last-provider — LLM preference
  TTL: indefinite (cleared on logout)

Long-term (PostgreSQL):
  knowledge table — KnowledgeAgent entries
  memory table — task execution history
  TTL: indefinite

Vector memory (pgvector extension):
  knowledge_vectors table — embedded knowledge entries
  Used for: semantic search, context retrieval by agents
```

---

## 7. Deployment Architecture

### Frontend — Vercel

```
GitHub push to main
  → GitHub Actions ci.yml (lint + typecheck + build)
  → GitHub Actions deploy.yml (upload dist → Vercel)
  → Vercel serves SPA at https://xps-intelligence.vercel.app
  → Edge functions serve /api/chat and /api/agent
```

**Required Vercel Secrets**:
```
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
AI_GROQ_API_KEY       ← server-side only, never VITE_ prefixed
BACKEND_URL           ← https://...railway.app
```

**Required Vercel Environment Variables**:
```
VITE_API_URL = https://xpsintelligencesystem-production.up.railway.app/api
VITE_WS_URL  = wss://xpsintelligencesystem-production.up.railway.app
```

### Backend — Railway

```
GitHub push to main
  → railway.json triggers build
  → Runs: npm run db:migrate && npm start
  → Express gateway starts on PORT (Railway-assigned)
  → Python FastAPI starts on :8000 (internal)
```

**Required Railway Environment Variables**:
```
DATABASE_URL         ← Railway Postgres (auto-provided)
REDIS_URL            ← Railway Redis (add Redis plugin)
JWT_SECRET           ← Random 64-char hex
AI_GROQ_API_KEY      ← For agent LLM calls
OPENAI_API_KEY       ← Optional, for GPT-4 fallback
XPS_API_TOKEN        ← Token for GitHub Actions to POST results
PORT                 ← Auto-assigned by Railway
NODE_ENV = production
```

---

## 8. Immediate Launch Steps (Vercel + Railway)

### Step 1: Fix Backend (Railway)

```bash
# 1. Fix infinity_library/__init__.py (move from __future__ to line 1)
# 2. Fix docker-compose.yml — add Redis service
# 3. Create railway.json:
cat > railway.json << 'EOF'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "npm run db:migrate && node api/gateway.js",
    "healthcheckPath": "/api/health",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
EOF

# 4. Add /api/health endpoint to gateway.js:
# app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }))

# 5. In Railway dashboard:
#    - Add Postgres plugin (DATABASE_URL auto-set)
#    - Add Redis plugin (REDIS_URL auto-set)
#    - Set JWT_SECRET, AI_GROQ_API_KEY, XPS_API_TOKEN manually
```

### Step 2: Fix Frontend (Vercel)

```bash
# 1. Fix vercel.json — add /api to VITE_API_URL
# 2. Fix Dockerfile (P1-FE-04 above)
# 3. Remove contracts symlink: git rm contracts

# In Vercel dashboard:
# Project → Settings → Environment Variables:
#   VITE_API_URL = https://[your-railway-url]/api
#   VITE_WS_URL  = wss://[your-railway-url]
#   AI_GROQ_API_KEY = gsk_...  (server-side only)
#   BACKEND_URL = https://[your-railway-url]

# In GitHub repository secrets:
#   VERCEL_TOKEN = [from Vercel Account Settings → Tokens]
#   VERCEL_ORG_ID = [from Vercel team settings]
#   VERCEL_PROJECT_ID = [from Vercel project settings]
```

### Step 3: Verify End-to-End

```bash
# 1. Open https://[your-vercel-url]
# 2. Open DevTools → Network tab
# 3. Navigate to Leads page — verify API calls go to Railway URL (not localhost)
# 4. Open Chat panel — send a message — verify Groq response
# 5. Open Settings → Integrations — verify tokens can be saved
# 6. Check Railway logs — verify no crash on startup
```

---

## 9. Revised Roadmap

### Sprint 1 (Week 1-2) — Launch Ready
- [x] Fix Buildings import (TS2304)
- [ ] Fix infinity_library SyntaxError
- [ ] Fix Docker CI (P0-BE-02)
- [ ] Fix vercel.json API URL (P1-FE-01)
- [ ] Standardize API_BASE (P1-FE-02)
- [ ] Add serverless error handling (P1-FE-03)
- [ ] Fix Dockerfile (P1-FE-04)
- [ ] Remove contracts symlink (P1-FE-05)
- [ ] Add /api/health to gateway
- [ ] Add Railway railway.json
- [ ] Add Redis to docker-compose

### Sprint 2 (Week 3-4) — Performance & Security
- [ ] Code splitting (1,447KB → ~250KB)
- [ ] Remove unused d3/three
- [ ] Remove duplicate components
- [ ] Consolidate service layer
- [ ] Add auth routing
- [ ] Connect WebSocket
- [ ] Add CORS + rate limiting
- [ ] Structured logging (pino/winston)
- [ ] JWT authentication middleware

### Sprint 3 (Month 2) — Real Agent Execution
- [ ] Connect orchestrator to backend HTTP
- [ ] Real SMTP outreach
- [ ] pgvector knowledge search
- [ ] Lead enrichment pipeline (email discovery)
- [ ] LinkedIn scraping stub
- [ ] Deprecate static HTML + Next.js dashboards

### Sprint 4 (Month 3) — Scale & Intelligence
- [ ] MetaAgent self-improvement loop
- [ ] Lead scoring ML upgrade (LightGBM)
- [ ] Push notifications for HOT leads
- [ ] SendGrid integration
- [ ] Nationwide scraping scale-out
- [ ] Multi-tenant auth (RBAC)
- [ ] API rate limiting per tenant

---

## 10. Optimizations

### Frontend
1. **Lazy load all pages** — `React.lazy` + `Suspense` → -80% initial bundle
2. **Tree-shake phosphor icons** — use `@phosphor-icons/react/dist/icons/...` individual imports
3. **Memoize expensive components** — `React.memo(MetricCard)`, `React.memo(ActivityFeed)`
4. **Virtual scroll** — `@tanstack/react-virtual` for Lead tables > 200 rows
5. **Optimistic updates** — React Query `useMutation` with `onMutate` rollback

### Backend
1. **Connection pooling** — `pg.Pool` with `max: 20` connections
2. **Query caching** — Redis cache for `GET /api/leads/metrics` (TTL: 60s)
3. **Scraper concurrency** — BullMQ with `concurrency: 5` per worker
4. **Batch DB writes** — Insert leads in batches of 100, not one by one
5. **Index optimization** — Add `CREATE INDEX leads_score_idx ON leads(score DESC)`

### Infrastructure
1. **Vercel Edge Config** — Cache API URL configuration at the edge
2. **Railway autoscale** — Enable autoscaling for the scraper worker process
3. **CDN for static assets** — Vercel automatically CDNs, but add `Cache-Control: immutable` headers

---

## 11. Hardening Checklist

- [ ] All API keys server-side only (never `VITE_` prefixed for secrets)
- [ ] JWT in memory + refresh token in httpOnly cookie
- [ ] CORS allowlist (not wildcard `*`)
- [ ] Rate limiting: 100 req/min per IP on all public endpoints
- [ ] Input validation with Zod on all API endpoints
- [ ] SQL parameterized queries only (no string interpolation)
- [ ] Content-Security-Policy header in `index.html`
- [ ] HSTS header on production domain
- [ ] Dependency audit in CI (`npm audit --audit-level=high`)
- [ ] Secrets scanning in CI (GitHub Secret Scanning enabled)
- [ ] Container resource limits in docker-compose
- [ ] Database connection over SSL (`?sslmode=require`)
- [ ] Scraper endpoints require XPS_API_TOKEN
- [ ] Outreach endpoints require admin role
