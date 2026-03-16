# XPS Intelligence — Full Remediation Checklist

> **Priority**: P0 = System broken · P1 = Launch blocker · P2 = Quality/security · P3 = Enhancement  
> **Legend**: ✅ Done · 🔧 In Progress · ❌ Not Started  
> **Governed By**: Overseer-Prime / TAP Protocol  
> **Last Updated**: 2026-03-11

---

## P0 — System Broken (Fix Immediately)

These failures prevent CI from passing and the system from running at all.

### [P0-FE-01] ✅ Fix `Buildings` missing import in `Sidebar.tsx`
- **Repo**: XPS-INTELLIGENCE-FRONTEND
- **File**: `src/components/Sidebar.tsx`
- **Error**: `TS2304: Cannot find name 'Buildings'`
- **Root Cause**: Healing script removed duplicate import but removed only copy
- **Fix Applied**: Added `Buildings` back to the `@phosphor-icons/react` import block
- **Test**: `npx tsc --noEmit` exits 0 ✅

### [P0-BE-01] ❌ Fix `infinity_library/__init__.py` Python SyntaxError
- **Repo**: XPS_INTELLIGENCE_SYSTEM
- **File**: `infinity_library/__init__.py`
- **Error**: `SyntaxError: from __future__ imports must occur at the beginning of the file` (line 14)
- **Root Cause**: Two module definitions concatenated; `from __future__ import annotations` is not at line 1
- **Fix**:
  ```python
  # infinity_library/__init__.py — CORRECTED
  from __future__ import annotations
  """
  Infinity Library — Persistent knowledge repository for XPS Intelligence.
  """
  from .library import InfinityLibrary, LibraryEntry, NAMESPACES
  from .experiment_tracker import ExperimentTracker
  from .knowledge_graph import KnowledgeGraph

  __all__ = ["InfinityLibrary", "LibraryEntry", "NAMESPACES", "ExperimentTracker", "KnowledgeGraph"]
  ```
- **Test**: `python -m pytest tests/test_tier5_infrastructure.py` should pass all 8 InfinityLibrary tests

### [P0-BE-02] ❌ Fix Docker CI — No Dockerfile in `./frontend` directory
- **Repo**: XPS_INTELLIGENCE_SYSTEM
- **Workflow**: `.github/workflows/deploy.yml`
- **Error**: `failed to read dockerfile: open Dockerfile: no such file or directory`
- **Root Cause**: CI builds `./frontend` context but no Dockerfile exists there
- **Fix Option A** (recommended): Update the workflow to build from repo root using the correct Dockerfile:
  ```yaml
  # In deploy.yml, change:
  context: ./frontend
  # To:
  context: .
  file: ./Dockerfile.gateway
  tags: ghcr.io/infinityxonesystems/xps_intelligence_system/backend:main
  ```
- **Fix Option B**: Create `frontend/Dockerfile` that copies the static dashboard files
- **Test**: CI Deploy job should complete successfully

---

## P1 — Launch Blockers (Fix Before First Deploy)

### [P1-FE-01] ❌ Fix Vercel API URL — missing `/api` suffix
- **Repo**: XPS-INTELLIGENCE-FRONTEND
- **File**: `vercel.json`
- **Current**: `"VITE_API_URL": "https://xpsintelligencesystem-production.up.railway.app"`
- **Required**: `"VITE_API_URL": "https://xpsintelligencesystem-production.up.railway.app/api"`
- **Impact**: Every API call in production returns 404 or hits the wrong route
- **Fix**:
  ```json
  {
    "buildCommand": "npm run build",
    "outputDirectory": "dist",
    "env": {
      "VITE_API_URL": "https://xpsintelligencesystem-production.up.railway.app/api"
    }
  }
  ```

### [P1-FE-02] ❌ Standardize `API_BASE` default port across all services
- **Repo**: XPS-INTELLIGENCE-FRONTEND
- **Files**: `src/lib/api.ts` (uses port 5000), `src/services/*.ts` (use port 3000)
- **Fix**: Set every service to use `VITE_API_URL` env var, fall back to `http://localhost:3000/api`:
  ```typescript
  // In src/lib/api.ts, change:
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
  ```
- **Test**: Run `npm run dev`, open network tab, verify all API calls go to the same origin

### [P1-FE-03] ❌ Add error handling to Vercel serverless functions
- **Repo**: XPS-INTELLIGENCE-FRONTEND
- **Files**: `pages/api/agent.ts`, `pages/api/chat.js`
- **Fix** (`pages/api/chat.js`):
  ```javascript
  import { Groq } from 'groq-sdk'

  export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    const { message } = req.body || {}
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' })
    }
    if (!process.env.AI_GROQ_API_KEY) {
      return res.status(503).json({ error: 'LLM not configured' })
    }
    try {
      const groq = new Groq({ apiKey: process.env.AI_GROQ_API_KEY })
      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: message }],
      })
      res.json({ reply: response.choices[0].message.content })
    } catch (err) {
      console.error('Chat handler error:', err)
      res.status(500).json({ error: 'LLM request failed' })
    }
  }
  ```

### [P1-FE-04] ❌ Fix Dockerfile — wrong port
- **Repo**: XPS-INTELLIGENCE-FRONTEND
- **File**: `Dockerfile`
- **Current**: `EXPOSE 3000`, runs `npm run dev` which starts on 5173
- **Fix**:
  ```dockerfile
  FROM node:20-alpine AS builder
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  RUN npm run build

  FROM node:20-alpine
  WORKDIR /app
  RUN npm install -g serve
  COPY --from=builder /app/dist ./dist
  EXPOSE 3000
  CMD ["serve", "-s", "dist", "-l", "3000"]
  ```

### [P1-FE-05] ❌ Remove broken Windows symlink
- **Repo**: XPS-INTELLIGENCE-FRONTEND
- **File**: `contracts` (symlink to `C:/XPS_INTELLIGENCE_SYSTEM/contracts`)
- **Fix**: `git rm contracts` then commit. If contracts are needed, copy them or use a git submodule.

### [P1-BE-03] ❌ Add Railway start command for DB migration + API server
- **Repo**: XPS_INTELLIGENCE_SYSTEM
- **File**: `railway.json` or `Procfile`
- **Current `Procfile`**: Check that it runs migrations before starting
- **Recommended `Procfile`**:
  ```
  web: npm run db:migrate && npm start
  worker: npm run start:worker
  ```

### [P1-BE-04] ❌ Add authentication middleware to Express gateway
- **Repo**: XPS_INTELLIGENCE_SYSTEM
- **File**: `api/gateway.js`
- **Fix**: Add JWT middleware:
  ```javascript
  import jwt from 'jsonwebtoken'

  function requireAuth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET)
      next()
    } catch {
      return res.status(401).json({ error: 'Invalid token' })
    }
  }

  // Apply to protected routes:
  app.use('/api/scraper', requireAuth)
  app.use('/api/agents', requireAuth)
  ```

### [P1-BE-05] ❌ Add Redis to `docker-compose.yml` for BullMQ queue
- **Repo**: XPS_INTELLIGENCE_SYSTEM
- **File**: `docker-compose.yml`
- **Fix**: Add Redis service:
  ```yaml
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
  ```

---

## P2 — Quality & Security (Fix Before Production)

### [P2-FE-01] ❌ Add code splitting for all page components
- **File**: `src/App.tsx` + `vite.config.ts`
- **Impact**: Reduces initial bundle from 1,447 KB to ~250 KB
- **Fix in `src/App.tsx`**: Use `React.lazy` for all page imports:
  ```typescript
  const HomePage = lazy(() => import('@/pages/HomePage').then(m => ({ default: m.HomePage })))
  const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
  // ... repeat for all 19 pages
  ```
- **Fix in `vite.config.ts`**:
  ```typescript
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'framer-motion'],
          charts: ['recharts'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-select'],
        }
      }
    }
  }
  ```

### [P2-FE-02] ❌ Remove `d3` and `three` if unused
- Verify usage with `grep -r "from 'd3'" src/` and `grep -r "from 'three'" src/`
- If unused, remove from `package.json` to save ~780 KB

### [P2-FE-03] ❌ Remove duplicate component directories
- Delete `src/components/Chat/` (keep `src/components/ChatInterface/`)
- Delete `src/components/LocalMachine/` (keep `src/components/LocalMachineAccess/`)
- Update all imports after deletion

### [P2-FE-04] ❌ Consolidate service layer to single `ApiClient` pattern
- Move all `src/services/*.ts` functions to use `src/lib/api.ts` `ApiClient`
- Remove raw `fetch` calls with hardcoded `API_BASE` strings

### [P2-FE-05] ❌ Add input validation to all serverless functions
- Use `zod` (already in dependencies) for request body validation

### [P2-FE-06] ❌ Move `API_BASE` defaults to a single constants file
- Create `src/lib/config.ts`:
  ```typescript
  export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
  export const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:3000'
  ```

### [P2-FE-07] ❌ Remove duplicate `OrchestratorConfig` interface
- **File**: `src/lib/agentTypes.ts` — defined at ~line 113 and again at ~line 178
- Keep one definition, remove the second

### [P2-FE-08] ❌ Add `team` route to `App.tsx` or remove from MobileMenu
- `MobileMenu.tsx` has a `team` nav item but `App.tsx` has no `team` case in `renderPage()`
- Either add `<TeamPage />` or remove the menu item

### [P2-FE-09] ❌ Add auth routing (protect all pages except Login)
- Wrap `renderPage()` in an auth check:
  ```typescript
  const isAuthenticated = Boolean(localStorage.getItem('auth_token'))
  if (!isAuthenticated && currentPage !== 'login') return <LoginPage onNavigate={setCurrentPage} />
  ```

### [P2-FE-10] ❌ Call `wsClient.connect()` in App.tsx
- **File**: `src/App.tsx`
- After auth check, call `wsClient.connect()` to enable real-time updates

### [P2-BE-06] ❌ Add CORS policy to Express gateway
- ```javascript
  import cors from 'cors'
  app.use(cors({ origin: ['https://your-vercel-url.vercel.app', 'http://localhost:5173'] }))
  ```

### [P2-BE-07] ❌ Replace console.log with structured logger
- Install `pino` or `winston`
- Replace all `console.log` / `console.error` calls

### [P2-BE-08] ❌ Fix lead scoring to prevent scores > 100
- Add normalization: `Math.min(score, 100)` in `agents/scoring/lead_scoring.js`

### [P2-BE-09] ❌ Add Playwright user-agent rotation to scrapers
- Maintain a pool of 10+ real browser user agents
- Rotate on each request to avoid bot detection

### [P2-BE-10] ❌ Deprecate `pages/` static HTML dashboard
- Archive `pages/` directory
- Update `.github/workflows/nextjs.yml` to point to frontend React app instead
- Document migration path for existing users

### [P2-BE-11] ❌ Fix infinity_library duplicate definitions
- See P0-BE-01 fix above

---

## P3 — Enhancements (Post-Launch)

### [P3-FE-01] ❌ Add React.memo to MetricCard, ActivityFeed
- Prevents unnecessary re-renders on unrelated state changes

### [P3-FE-02] ❌ Add React.StrictMode to `src/main.tsx`
- Helps identify side effects and deprecated API usage in development

### [P3-FE-03] ❌ Virtual scrolling for LeadsPage table
- Use `@tanstack/react-virtual` for tables with > 200 rows

### [P3-FE-04] ❌ Connect orchestrator to real backend HTTP calls
- Replace simulated execution in `orchestrator.ts` with calls to `agentsApi.execute()`
- Keep simulation as fallback when backend is unreachable

### [P3-FE-05] ❌ Replace localStorage LLM key storage with server-side vault
- Move key storage to backend `/api/settings/vault` endpoint
- Retrieve keys per-request via authenticated API call

### [P3-BE-12] ❌ Implement SMTP for outreach engine
- Add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` to `.env.railway.example`
- Wire up `nodemailer.createTransport()` in `outreach/outreach_engine.js`

### [P3-BE-13] ❌ Add vector database for KnowledgeAgent
- Install `pgvector` extension on Railway PostgreSQL
- Add embedding column to knowledge table
- Implement similarity search in `agents/knowledge/`

### [P3-BE-14] ❌ Implement LinkedIn enrichment
- Use Playwright to scrape LinkedIn company pages for contacts
- Add to enrichment pipeline after Google Maps scraping

### [P3-BE-15] ❌ Add unsubscribe handling for outreach
- Track email addresses that unsubscribed
- Filter from all future outreach pipelines
- Required for CAN-SPAM / GDPR compliance

### [P3-BE-16] ❌ Add SendGrid as outreach alternative
- Provides better deliverability, analytics, and bounce handling than raw SMTP

### [P3-INFRA-01] ❌ Add nginx TLS termination to docker-compose.yml
- All inter-service traffic should be encrypted in production

### [P3-INFRA-02] ❌ Add container resource limits
- Prevent runaway scrapers from consuming all memory:
  ```yaml
  deploy:
    resources:
      limits:
        memory: 512m
        cpus: '0.5'
  ```

### [P3-INFRA-03] ❌ Implement Dependabot auto-merge for backend
- Mirror the frontend's `dependabot-auto-merge.yml` in the backend repo

---

## Summary: Fix Priority Order

```
Week 1 — Get CI green and both repos deployable:
  P0-FE-01 ✅ (done)
  P0-BE-01 ❌ → Fix infinity_library/__init__.py
  P0-BE-02 ❌ → Fix Docker CI workflow
  P1-FE-01 ❌ → Fix vercel.json API URL
  P1-FE-02 ❌ → Standardize API_BASE port
  P1-FE-03 ❌ → Add error handling to serverless functions
  P1-FE-04 ❌ → Fix Dockerfile
  P1-FE-05 ❌ → Remove broken symlink
  P1-BE-03 ❌ → Fix Railway Procfile
  P1-BE-04 ❌ → Add auth middleware

Week 2 — Performance and reliability:
  P2-FE-01 ❌ → Code splitting (1,447 KB → ~250 KB)
  P2-FE-02 ❌ → Remove unused d3/three
  P2-FE-03 ❌ → Remove duplicate components
  P2-FE-04 ❌ → Consolidate service layer
  P2-FE-09 ❌ → Add auth routing
  P2-FE-10 ❌ → Connect WebSocket
  P2-BE-06 ❌ → Add CORS
  P2-BE-07 ❌ → Structured logging

Week 3 — Real agent execution:
  P3-FE-04 ❌ → Connect orchestrator to real backend
  P3-BE-12 ❌ → Real SMTP outreach
  P3-BE-13 ❌ → Vector database
  P3-BE-10 ❌ → Deprecate static dashboard

Month 2 — Advanced features:
  LinkedIn enrichment, push notifications, SendGrid, pgvector similarity search
```
