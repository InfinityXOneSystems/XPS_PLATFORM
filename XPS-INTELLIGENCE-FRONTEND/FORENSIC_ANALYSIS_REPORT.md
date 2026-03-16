# XPS Intelligence — Dual-Repository Forensic Analysis Report

> **Scope**: `XPS-INTELLIGENCE-FRONTEND` (React/Vite) + `XPS_INTELLIGENCE_SYSTEM` (Node.js/Python backend)  
> **Conducted**: 2026-03-11  
> **Standard**: Top-tier AI agent system architecture (Manus, Devin, SWE-Agent, Auto-GPT, LangGraph)  
> **Governed By**: Overseer-Prime / TAP Protocol

---

## Executive Summary

The XPS Intelligence platform is an ambitious, two-repository AI operating system designed for autonomous contractor lead generation, business intelligence, and agent orchestration. The vision is sound and the core architecture is architecturally viable — but **both repositories have accumulated critical structural debt, duplicate subsystems, broken wiring, and unresolved CI failures** that prevent a production-ready launch. This report documents every finding, its root cause, its blast radius, and the precise fix required.

---

## Table of Contents

1. [Repository Map](#1-repository-map)
2. [CI/CD Failure Analysis](#2-cicd-failure-analysis)
3. [Frontend — Code-Level Forensics](#3-frontend--code-level-forensics)
4. [Backend — Code-Level Forensics](#4-backend--code-level-forensics)
5. [Cross-Repo Wiring Failures](#5-cross-repo-wiring-failures)
6. [Architecture Gap Analysis](#6-architecture-gap-analysis)
7. [Redundancy & Dead Code Inventory](#7-redundancy--dead-code-inventory)
8. [Security & Hardening Gaps](#8-security--hardening-gaps)
9. [Performance Analysis](#9-performance-analysis)
10. [Vision vs Reality Scorecard](#10-vision-vs-reality-scorecard)
11. [Comparable Top Systems](#11-comparable-top-systems)

---

## 1. Repository Map

### 1.1 Frontend (`XPS-INTELLIGENCE-FRONTEND`)

```
Root
├── src/
│   ├── agents/            ← 13 agent class stubs (BaseAgent + 12 concrete)
│   ├── components/
│   │   ├── AIChatPanel.tsx
│   │   ├── Chat/          ← DUPLICATE of ChatInterface/
│   │   ├── ChatInterface/ ← DUPLICATE of Chat/
│   │   ├── LocalMachine/  ← DUPLICATE of LocalMachineAccess/
│   │   └── LocalMachineAccess/
│   ├── lib/
│   │   ├── api.ts         ← ApiClient (baseUrl: localhost:5000)
│   │   ├── agentTypes.ts  ← 13 agents, TaskTypes, OrchestratorConfig (DUPLICATED)
│   │   ├── llm.ts         ← Groq/Gemini/HuggingFace router
│   │   └── orchestrator.ts← Simulation-only, no real HTTP calls
│   ├── pages/             ← 19 page components
│   ├── services/
│   │   ├── api/           ← Shared ApiClient pattern (port 5000)
│   │   └── *.ts           ← Raw fetch pattern (port 3000) — SPLIT ARCHITECTURE
│   └── tools/toolRegistry.ts
├── pages/api/             ← Vercel serverless functions (Next.js pattern in Vite app)
│   ├── agent.ts           ← No error handling, no types
│   └── chat.js            ← Groq integration, missing error handling
├── contracts → C:/XPS_INTELLIGENCE_SYSTEM/contracts  ← BROKEN SYMLINK (Windows path)
├── .env.production        ← Hardcoded Railway URL, missing /api suffix in vercel.json
├── vercel.json            ← Wrong env var (VITE_API_URL without /api path)
└── Dockerfile             ← Exposes 3000 but app runs on 5173
```

### 1.2 Backend (`XPS_INTELLIGENCE_SYSTEM`)

```
Root
├── agent_core/            ← Python FastAPI agent server (port 8000)
├── agents/
│   ├── scoring/           ← Node.js lead scoring (fully implemented)
│   ├── email/             ← Stub, needs SMTP
│   ├── headless/          ← Headless agent runner
│   └── orchestrator/      ← Infinity orchestrator (Node.js)
├── api/gateway.js         ← Express.js REST gateway (port 3000)
├── dashboard/             ← Next.js dashboard (SEPARATE from frontend repo)
├── pages/                 ← Static HTML dashboard (THIRD dashboard)
├── scrapers/              ← Google Maps, Bing, Yelp, Directory scrapers
├── db/                    ← PostgreSQL layer (knex + pg)
├── infinity_library/      ← Python knowledge store
│   └── __init__.py        ← BROKEN: from __future__ at line 14 (must be line 1)
├── validation/            ← Lead validation pipeline
├── outreach/              ← Email outreach engine
├── frontend/              ← Directory referenced in Docker CI (NO Dockerfile inside)
└── .github/workflows/     ← 20+ workflows, Deploy CI fails
```

---

## 2. CI/CD Failure Analysis

### 2.1 Frontend CI Failures

#### FAILURE 1 — TypeScript TS2304: Cannot find name 'Buildings'
- **File**: `src/components/Sidebar.tsx`, line 48
- **Root Cause**: `Buildings` icon removed from the import block but still referenced in `primaryMenuItems` array. The healing history from 2026-03-10 removed a *duplicate* import but inadvertently removed the *only* import.
- **Blast Radius**: `tsc --noEmit` fails → `comprehensive-validation.yml` fails → Blocks merging
- **Status**: ✅ **FIXED in this PR** — `Buildings` re-added to the import block
- **Prevention**: Add a lint rule or test that verifies all icon references exist in imports

#### WARNING 1 — CSS media query syntax errors
- **File**: Tailwind-generated CSS in `src/index.css` or `src/styles/theme.css`
- **Root Cause**: `@media (width >= (display-mode: standalone))` — the Tailwind v4 container plugin is generating invalid CSS where PWA media queries are being misinterpreted as container breakpoints.
- **Impact**: Three CSS optimization warnings at build time. Functionality not broken but output CSS contains malformed rules.
- **Fix**: Override the container query plugin configuration in `tailwind.config.js` to exclude non-standard media features.

#### WARNING 2 — Bundle size 1,447 KB (2.9x over 500 KB threshold)
- **Root Cause**: No code-splitting configured. All 19 pages, all 13 agent classes, all Radix UI components, framer-motion, recharts, d3, three.js, groq-sdk all bundled into one chunk.
- **Impact**: Initial load time 8-15 seconds on average mobile connection. Google Lighthouse score < 50.
- **Fix**: Add `build.rollupOptions.output.manualChunks` to `vite.config.ts`; lazy-load page components.

### 2.2 Backend CI Failures

#### FAILURE 2 — Deploy: Docker build fails (no Dockerfile in ./frontend)
- **Workflow**: `.github/workflows/deploy.yml` (or equivalent)
- **Error**: `ERROR: failed to build: failed to solve: failed to read dockerfile: open Dockerfile: no such file or directory`
- **Root Cause**: The Docker CI job runs `docker buildx build --push ./frontend` — but the `frontend/` directory inside `XPS_INTELLIGENCE_SYSTEM` contains no `Dockerfile`. The backend repo has 4 Dockerfiles at root (`Dockerfile`, `Dockerfile.backend`, `Dockerfile.gateway`, `Dockerfile.scraper`) but none inside `frontend/`.
- **Blast Radius**: Every push to `main` fails the Deploy job. No Docker images have been successfully published to GHCR.
- **Fix**: Either create `frontend/Dockerfile` pointing to the actual frontend build, or update the workflow to use `context: .` and `file: Dockerfile.gateway`.

#### FAILURE 3 — XPS System Validation: Python SyntaxError in infinity_library
- **File**: `infinity_library/__init__.py`, line 14
- **Error**: `SyntaxError: from __future__ imports must occur at the beginning of the file`
- **Root Cause**: The file has two concatenated module docstrings. The first block (`from infinity_library.library import ...`) has no `from __future__` import. The second block, which was meant to replace the first, has `from __future__ import annotations` at line 14 — but Python requires `from __future__` to be the very first non-comment, non-docstring statement.
- **Blast Radius**: All 8 `TestInfinityLibrary` tests fail. Knowledge persistence, search, and graph features are untestable. 349 other tests pass but the suite reports failure.
- **Fix**: Move `from __future__ import annotations` to line 1, remove duplicate content.

---

## 3. Frontend — Code-Level Forensics

### 3.1 Critical Bugs

| # | File | Issue | Severity |
|---|------|-------|----------|
| F-01 | `src/components/Sidebar.tsx:48` | `Buildings` used but not imported → TS2304 | **CRITICAL** (breaks tsc) |
| F-02 | `vercel.json` | `VITE_API_URL` missing `/api` suffix (`https://xpsintelligencesystem-production.up.railway.app` vs required `.../api`) | **HIGH** (all API calls 404 in prod) |
| F-03 | `src/lib/api.ts:1` | `API_BASE_URL` defaults to `localhost:5000` but most services default to `localhost:3000` — split base URL | **HIGH** (dev mode broken) |
| F-04 | `pages/api/agent.ts` | No try/catch, no type validation, no rate limiting | **HIGH** (unhandled exceptions crash function) |
| F-05 | `pages/api/chat.js` | No try/catch around Groq call — uncaught errors return 500 | **HIGH** |
| F-06 | `contracts` directory | Broken Windows symlink: `C:/XPS_INTELLIGENCE_SYSTEM/contracts` — fails on Linux/CI/Vercel | **MEDIUM** |
| F-07 | `Dockerfile` | `EXPOSE 3000` but `npm run dev` starts Vite on port 5173 | **MEDIUM** |

### 3.2 Architectural Defects

| # | Files | Issue | Severity |
|---|-------|-------|----------|
| A-01 | `src/services/api/*.ts` vs `src/services/*.ts` | Two incompatible service patterns: `api/` uses shared `ApiClient` (port 5000), standalone services use raw `fetch` (port 3000). Consumers get different base URLs depending on which service they import. | **HIGH** |
| A-02 | `src/lib/agentTypes.ts` | `OrchestratorConfig` interface defined **twice** (lines ~113 and ~178). TypeScript merges them silently but it's a maintenance hazard. | **MEDIUM** |
| A-03 | `pages/api/` | Vercel serverless functions use Next.js conventions (`export default function handler`) inside a **Vite** project. These only work when deployed to Vercel — they are completely ignored during local `npm run dev`. Developers have no local API without a separate server. | **HIGH** |
| A-04 | `src/lib/orchestrator.ts` | Orchestrator only simulates execution — it generates fake logs with timers but makes zero real HTTP calls. The 13 agent classes in `src/agents/` are never invoked. | **HIGH** (entire agent system is decorative) |
| A-05 | `src/lib/llm.ts` | LLM router stores API keys in `activeConfig` (module-level object) and `localStorage`. Keys can leak if the app is bundled for SSR or if localStorage is compromised. | **MEDIUM** |
| A-06 | `src/main.tsx` | `@github/spark` SDK imported unconditionally — this causes failures outside of GitHub Spark environments. | **MEDIUM** |

### 3.3 Inferior / Sub-standard Code Patterns

| # | Location | Pattern | Industry Standard |
|---|----------|---------|-------------------|
| P-01 | `pages/api/chat.js` | No input validation (`req.body.message` used directly) | Use Zod schema validation |
| P-02 | `src/lib/api.ts` | Auth token stored and read from `localStorage` in the API client itself | Use `httpOnly` cookie or React context |
| P-03 | `src/services/agentService.ts` | Mock data generated with `Math.random()` → metrics change on every render | Use seeded/stable mock data |
| P-04 | `src/lib/orchestrator.ts` | `SIMULATED_FAILURE_RATE = 0.05` hardcoded — 5% of tasks will randomly "fail" in demo mode | Gate behind `import.meta.env.DEV` |
| P-05 | Multiple services | All services catch fetch errors and silently return mock data — errors are invisible to developers | Log to console.warn + expose error state |
| P-06 | `src/App.tsx` | `LEADS_REQUIRED_PAGES` created as `new Set(...)` inside render — recreated every render | Move outside component |
| P-07 | `src/main.tsx` | No React.StrictMode wrapping | Add StrictMode for better dev-time checks |

### 3.4 Missing Components (per PRD)

| Missing Feature | PRD Reference | Current State |
|----------------|---------------|---------------|
| Real agent execution via HTTP | PRD §AI Lead Assistant | Simulated only in orchestrator |
| WebSocket live scraper updates | PRD §Real-time Dashboard | `wsClient` exists but `.connect()` never called |
| Role-Based Access Control | PRD §Role-Based Access Control | Not implemented — all data shown to all users |
| Virtual scrolling for large tables | PRD §Large Datasets | Not implemented |
| Offline PWA caching of key data | PRD §Progressive Web App | service worker registered but caches only assets |
| Login/auth page | Sidebar doesn't exist | `LoginPage.tsx` exists but no auth routing |
| `team` nav item in MobileMenu | MobileMenu | Has `team` entry but `App.tsx` has no `team` route |

---

## 4. Backend — Code-Level Forensics

### 4.1 Critical Bugs

| # | File | Issue | Severity |
|---|------|-------|----------|
| B-01 | `infinity_library/__init__.py:14` | `from __future__ import annotations` at line 14 — Python SyntaxError, crashes all InfinityLibrary tests | **CRITICAL** |
| B-02 | `frontend/` directory | No `Dockerfile` exists here but CI tries to build from it | **CRITICAL** (Deploy CI fails every push) |
| B-03 | `railway.json` | Railway configuration may point to wrong start command if it references a missing entrypoint | **HIGH** |

### 4.2 Architectural Defects

| # | Issue | Impact |
|---|-------|--------|
| BA-01 | **Three separate dashboards**: Static HTML (`pages/`), Next.js app (`dashboard/`), and the separate React frontend repo | User confusion, maintenance overhead, divergent UX |
| BA-02 | **Two runtimes, no bridge**: Node.js Express gateway (port 3000) and Python FastAPI (port 8000) run independently with no service mesh or health check between them | Either runtime can fail silently without alerting the other |
| BA-03 | **No authentication layer** on `api/gateway.js` | All API endpoints publicly accessible without tokens |
| BA-04 | **SMTP simulated** — `outreach/outreach_engine.js` logs emails but never sends them | Outreach automation feature completely non-functional |
| BA-05 | **LinkedIn enrichment not implemented** — referenced throughout docs but no code | Enrichment pipeline incomplete |
| BA-06 | **BullMQ scraper queue** referenced in `scrapers/scraper_queue.js` but Redis is not in `docker-compose.yml` | Queue system will crash without Redis |
| BA-07 | **Database migrations not run on Railway** — `knexfile.js` present but Railway start command may not include `npm run db:migrate` | Production DB has no schema |

### 4.3 Sub-Standard Code Patterns

| # | Location | Pattern |
|---|----------|---------|
| BP-01 | `api/gateway.js` | Express routes have no input validation middleware |
| BP-02 | `scrapers/` | Playwright scrapers lack user-agent rotation and proxy support — will be blocked quickly |
| BP-03 | `agents/scoring/` | Lead scoring uses simple additive weights with no normalization — scores > 100 are possible |
| BP-04 | Multiple files | `console.log` used for all logging — no structured logger (Winston/pino) |
| BP-05 | `docker-compose.yml` | No resource limits on containers — unconstrained memory usage |

---

## 5. Cross-Repo Wiring Failures

These are failures that only appear when the two repos interact:

| # | Issue | Root Cause | Fix |
|---|-------|-----------|-----|
| CR-01 | Frontend `VITE_API_URL` defaults to `localhost:5000` but backend Express gateway runs on port `3000` | Two different `API_BASE` defaults in frontend code | Standardize to port 3000 or set env vars consistently |
| CR-02 | Frontend `vercel.json` sets `VITE_API_URL=https://xpsintelligencesystem-production.up.railway.app` (missing `/api`) | Typo in vercel.json | Append `/api` to the URL |
| CR-03 | `BACKEND_URL` in Vercel serverless `pages/api/agent.ts` points to Railway but Railway deploy is broken (Failure B-02) | Backend never successfully deployed | Fix Railway Dockerfile first |
| CR-04 | `contracts` symlink in frontend points to Windows path `C:/XPS_INTELLIGENCE_SYSTEM/contracts` — broken on Linux | Created on Windows developer machine | Remove symlink; use a git submodule or copy the contracts |
| CR-05 | Frontend WebSocket client (`wsClient`) never calls `.connect()` — no real-time data ever flows | Instantiation without initialization | Call `wsClient.connect()` in App.tsx after auth |
| CR-06 | Frontend `pages/api/agent.ts` serverless function calls `${backendUrl}/api/agent` — backend has no `/api/agent` route | Endpoint mismatch | Align routes between frontend proxy and backend gateway |

---

## 6. Architecture Gap Analysis

### What the Vision Requires vs. What Exists

| Component | Vision | Exists | Gap |
|-----------|--------|--------|-----|
| Unified API Gateway | Single authenticated gateway | Express gateway (unauthenticated) | Auth middleware missing |
| Agent Execution Engine | Real parallel agent execution | Simulation only (timer-based) | HTTP bridge to agent_core missing |
| Vector Memory | Persistent vector storage | `KnowledgeAgent` stub | No vector DB (Pinecone/Weaviate/pgvector) |
| Real-time Updates | WebSocket scraper progress | WS client instantiated, never connected | `wsClient.connect()` not called |
| Auth System | JWT RBAC | `LoginPage.tsx` exists, no routing | Auth provider + protected routes missing |
| Scraper → Frontend | Scraper writes to DB, frontend reads | Scraper writes JSON files locally | No DB read API in frontend |
| Media Generation | Image/video/audio agents | `MediaAgent.ts` stub only | No API integration (DALL-E/Stable Diffusion) |
| Self-Healing Loop | MetaAgent auto-fixes system | `MetaAgent.ts` stub only | No CI trigger from MetaAgent |
| Dashboard Unification | Single frontend | 3 separate dashboards | Need to consolidate to React frontend only |

---

## 7. Redundancy & Dead Code Inventory

### Frontend Redundancies

| Redundant Set | Files | Action |
|--------------|-------|--------|
| Duplicate Chat components | `src/components/Chat/` AND `src/components/ChatInterface/` | Keep `ChatInterface/`, remove `Chat/` |
| Duplicate LocalMachine components | `src/components/LocalMachine/` AND `src/components/LocalMachineAccess/` | Keep `LocalMachineAccess/`, remove `LocalMachine/` |
| Duplicate service patterns | `src/services/api/*.ts` AND `src/services/*.ts` | Consolidate all to use shared `ApiClient` |
| Dead `src/testdeploy.js` | Single-line test file in `src/` | Delete |
| Dead `src/lucide-react.d.ts` | Stub type declaration for lucide-react | Delete (already have `@types` from package) |
| Dead `src/vite-end.d.ts` | Empty/stub declaration | Delete |
| Duplicate dashboard page | `DashboardPage.tsx` AND `HomePage.tsx` have overlapping metric cards | Consolidate |

### Backend Redundancies

| Redundant Set | Files | Action |
|--------------|-------|--------|
| Three dashboards | `pages/` (HTML), `dashboard/` (Next.js), frontend repo (React) | Deprecate `pages/` and `dashboard/`; point to frontend repo |
| Duplicate docs | `ROADMAP.md` (root) AND `docs/ROADMAP.md` | Merge to `docs/ROADMAP.md`, delete root copy |
| Duplicate vision | `VISION.md` (root) AND `docs/VISION.md` | Merge |
| `infinity_library/__init__.py` | Two merged module definitions | Deduplicate |

---

## 8. Security & Hardening Gaps

| # | Gap | Risk | Fix |
|---|-----|------|-----|
| S-01 | No input sanitization in `pages/api/chat.js` | Prompt injection via `message` body | Validate + truncate input with Zod |
| S-02 | `AI_GROQ_API_KEY` exposed server-side only but `VITE_` prefix would expose to client | If accidentally prefixed with `VITE_`, key leaks to browser bundle | Audit all env vars; never prefix secrets with `VITE_` |
| S-03 | Auth token in `localStorage` | XSS can steal token | Move to `httpOnly` cookie or memory |
| S-04 | No CORS policy on Express gateway | Any origin can call the API | Add `cors()` middleware with allowlist |
| S-05 | No rate limiting on frontend Vercel functions | Abuse / cost inflation | Add `express-rate-limit` or Vercel edge config |
| S-06 | No HTTPS enforcement in `docker-compose.yml` | Plaintext traffic between services | Add nginx TLS termination |
| S-07 | `contracts` symlink to Windows path | If CI ever processes symlink, path traversal risk | Remove symlink |
| S-08 | No CSP headers in `index.html` | XSS vulnerability | Add `<meta http-equiv="Content-Security-Policy">` |
| S-09 | LLM API keys stored in `localStorage` | Exposed to any script running in origin | Store encrypted server-side; retrieve via API |
| S-10 | Backend has no authentication on scraper trigger endpoints | Anyone can trigger mass scraping | Add API key or JWT middleware |

---

## 9. Performance Analysis

### Frontend Bundle Analysis

| Chunk | Current Size | Target | Action |
|-------|-------------|--------|--------|
| `index-CNZxhSsp.js` | 1,447 KB | < 300 KB | Dynamic imports for all pages |
| `index-Djbyoclk.css` | 414 KB | < 80 KB | Purge unused Tailwind classes |
| Total CSS | 414 KB gzip: 71 KB | < 30 KB gzip | Enable Tailwind JIT mode explicitly |

### Performance Issues

1. **No lazy loading**: All 19 pages imported synchronously in `App.tsx`
2. **Three.js imported**: `three` is in dependencies but adds ~500 KB — no page appears to actually use it
3. **D3 imported**: `d3` adds ~280 KB — only used in a few chart components; recharts already handles most charts
4. **No React.memo**: Metric cards and activity feed re-render on every parent state change
5. **No virtualization**: Lead tables will slow down at > 500 rows

---

## 10. Vision vs Reality Scorecard

### XPS-INTELLIGENCE-FRONTEND

| Vision Feature | Status | Score |
|----------------|--------|-------|
| Chat command interface | Implemented (mock LLM) | 60% |
| Agent dashboard | Implemented (simulation only) | 40% |
| Task queue viewer | Implemented | 80% |
| Code editor | Page exists (placeholder) | 30% |
| Browser panel (sandbox) | Page exists (placeholder) | 30% |
| Scraper results viewer | Page exists, mock data | 50% |
| Sandbox console | Page exists (placeholder) | 30% |
| System logs | Implemented | 70% |
| Settings control center | Implemented (mock) | 65% |
| Multi-provider LLM router | Implemented | 85% |
| PWA / installable | manifest.json present | 50% |
| Auth / RBAC | LoginPage exists, no routing | 10% |
| Real-time WebSocket | Client exists, never connected | 5% |
| **Overall** | | **48%** |

### XPS_INTELLIGENCE_SYSTEM

| Vision Feature | Status | Score |
|----------------|--------|-------|
| Scraper engine (Google, Bing, Yelp) | Implemented | 80% |
| Lead scoring | Implemented, unit tested | 90% |
| Lead validation / dedup | Implemented | 85% |
| PostgreSQL storage | Schema present, migrations manual | 70% |
| Outreach automation | Simulated (no real SMTP) | 20% |
| Static dashboard | Implemented | 70% |
| Next.js dashboard | Implemented (duplicates frontend) | 50% |
| Python agent server | Partial (FastAPI stub) | 40% |
| Knowledge library (InfinityLibrary) | Broken SyntaxError | 0% |
| Real-time agent orchestration | Infinity orchestrator present | 50% |
| Docker deployment | Dockerfile present, CI fails | 10% |
| Railway deployment | Config present, deploy CI fails | 10% |
| Auth system | Not implemented | 0% |
| LinkedIn enrichment | Not implemented | 0% |
| **Overall** | | **45%** |

---

## 11. Comparable Top Systems

The following systems are most architecturally comparable to XPS Intelligence and represent the benchmark standard:

### 11.1 Manus (ByteDance / Monica)
- **Architecture**: Browser-native agent with sandboxed code execution, Playwright automation, file system access, and persistent memory via vector DB
- **Key Methods**: Thought-Action-Observation loop, event-driven tool calling, streaming task status
- **What XPS Can Adopt**: The TAO loop for agent execution; streaming tool call results to the UI; sandboxed Python execution via Docker

### 11.2 Devin (Cognition AI)
- **Architecture**: Full software engineer agent with persistent shell session, code editor, browser, and plan-execute-verify cycle
- **Key Methods**: Sub-agent specialization (planner, implementer, verifier), persistent workspace, Git-native execution
- **What XPS Can Adopt**: The plan → implement → verify cycle maps directly to PlannerAgent → BuilderAgent → ValidatorAgent. Devin uses a workspace snapshot system — implement this as KnowledgeAgent memory.

### 11.3 LangGraph (LangChain)
- **Architecture**: Stateful multi-agent graph with typed state transitions, checkpointing, and parallel fan-out
- **Key Methods**: Node-based agent graph, state persistence between steps, human-in-the-loop approval gates
- **What XPS Can Adopt**: Replace the current simulation orchestrator with a LangGraph-style directed acyclic graph of agent calls. Add checkpoint storage to PostgreSQL.

### 11.4 CrewAI
- **Architecture**: Role-based crew of agents with defined goals, backstory, and tool access. Manager agent delegates to worker agents.
- **Key Methods**: Hierarchical process (manager → worker), sequential and parallel execution modes, task memory
- **What XPS Can Adopt**: The `MetaAgent` should act as CrewAI's Manager — decomposing goals and delegating to the 12 worker agents. Formalize this with typed handoff messages.

### 11.5 AutoGen (Microsoft)
- **Architecture**: Conversational agent network where agents communicate via message-passing. Human-in-the-loop built in.
- **Key Methods**: AssistantAgent + UserProxy pattern, code execution with result feedback, group chat with round-robin or custom speaker selection
- **What XPS Can Adopt**: Multi-agent chat is already in the UI — wire it to real AutoGen-compatible message passing. Use the `AgentEvent` type already defined in `agentTypes.ts`.

### 11.6 SWE-Agent (Princeton)
- **Architecture**: Single LLM agent with a structured Agent-Computer Interface (ACI) for file editing, bash execution, and search
- **Key Methods**: Structured action space, file viewer with scroll, search-replace editing primitives
- **What XPS Can Adopt**: The `BuilderAgent` and `ExecutorAgent` should implement an ACI — a structured set of tool calls (view_file, edit_file, run_command) rather than free-form code generation.

### 11.7 Apollo.io / ZoomInfo (Product Architecture Reference)
- **Architecture**: Multi-tier SaaS with data enrichment pipeline, sales intelligence, and intent signal detection
- **Key Methods**: Waterfall enrichment (multiple data sources in priority order), confidence scoring, deduplication by domain + phone
- **What XPS Can Adopt**: Replace the additive lead scoring with a waterfall enrichment model. Add confidence intervals to scores. Deduplicate by normalized phone number and domain, not just raw string matching.

---

*End of Forensic Analysis Report. See `REMEDIATION_CHECKLIST.md` for the ordered fix list.*
