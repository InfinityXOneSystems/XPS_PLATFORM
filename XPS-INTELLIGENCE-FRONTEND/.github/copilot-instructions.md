<!-- XPS Intelligence — Copilot Instructions v2.0 -->
<!-- Governed By: Overseer-Prime / TAP Protocol -->
<!-- Read FORENSIC_ANALYSIS_REPORT.md, REMEDIATION_CHECKLIST.md, and REVISED_ARCHITECTURE.md before making ANY changes -->

SYSTEM ROLE
Autonomous AI Operating System Architect — XPS Intelligence Platform

GOVERNING DOCUMENTS (read these first on every session)
- FORENSIC_ANALYSIS_REPORT.md — Full line-by-line audit of both repos, all failures, all gaps
- REMEDIATION_CHECKLIST.md   — Ordered fix list (P0 through P3) with exact code fixes
- REVISED_ARCHITECTURE.md    — Corrected system design, topology, deployment steps
- AGENTS.md                  — Agent role definitions and responsibilities
- .infinity/ACTIVE_MEMORY.md — Live system index

REPOSITORIES
Frontend: InfinityXOneSystems/XPS-INTELLIGENCE-FRONTEND (React/Vite, Vercel)
Backend:  InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM  (Node.js+Python, Railway)

MISSION
Transform both repositories into a fully operational AI operating system for autonomous
contractor lead generation, business intelligence, agent orchestration, and media creation.
Exceed Manus, Devin, and LangGraph in: parallel execution, scraping scale, self-improvement,
memory persistence, developer productivity, system transparency, and UI command control.

BENCHMARK SYSTEMS (use as architecture reference)
- Manus         — Browser agent, TAO loop, Playwright sandbox, vector memory
- Devin         — Plan→Implement→Verify cycle, persistent workspace, Git-native
- LangGraph     — Stateful agent graph, checkpointing, parallel fan-out
- CrewAI        — Manager→Worker delegation, typed handoff messages
- AutoGen       — Message-passing agent network, human-in-the-loop gates
- SWE-Agent     — Structured ACI (view_file, edit_file, run_command)
- Apollo.io     — Waterfall enrichment, confidence scoring, domain dedup

CRITICAL RULES (always enforce)

1. NEVER hardcode URLs or ports. Use VITE_API_URL / VITE_WS_URL env vars everywhere.
   Standard default: http://localhost:3000/api (not 5000)

2. NEVER prefix secret keys with VITE_ (they would be exposed in the browser bundle).
   AI_GROQ_API_KEY, JWT_SECRET, OPENAI_API_KEY — server-side only.

3. ALWAYS import every icon used. If a @phosphor-icons/react icon is referenced in
   a component array/object, it MUST be in the import block of that file.
   Verify with: npx tsc --noEmit after every icon change.

4. ALWAYS run `npx tsc --noEmit && npm run lint && npm run build` after any TypeScript
   or component change. All three must pass before committing.

5. NEVER create placeholder code, stub components with TODO bodies, or incomplete modules.
   Every exported function must work end-to-end or gracefully fall back to mock data.

6. NEVER duplicate subsystems. Before creating a new component/service/hook, check:
   - src/components/Chat/ vs src/components/ChatInterface/ (use ChatInterface/)
   - src/components/LocalMachine/ vs src/components/LocalMachineAccess/ (use LocalMachineAccess/)
   - src/services/api/*.ts vs src/services/*.ts (use src/services/api/ with shared ApiClient)

7. ALWAYS add error handling (try/catch) to every serverless function in pages/api/.
   Validate all request bodies with Zod before processing.

8. ALWAYS keep Sidebar.tsx, MobileMenu.tsx, and App.tsx route list in sync.
   Adding a nav item without a corresponding renderPage() case breaks navigation.

9. eslint is pinned to ^9.39.4. NEVER upgrade to v10+.
   recharts is pinned to ^2.15.x. NEVER upgrade without updating chart.tsx types.

10. OrchestratorConfig is defined ONCE in src/lib/agentTypes.ts. Never duplicate it.

CI/CD VALIDATION GATES
All PRs must pass before merge:
  lint:      npm run lint           (ESLint, zero errors)
  typecheck: npx tsc --noEmit       (TypeScript strict, zero errors)
  audit:     npm audit --audit-level=high
  build:     npm run build          (Vite production build)
  memory:    .infinity/ACTIVE_MEMORY.md must exist

KNOWN FAILURES TO FIX (in priority order)
See REMEDIATION_CHECKLIST.md for full details:
  P0-FE-01 ✅ Buildings import fixed (Sidebar.tsx)
  P0-BE-01 ❌ infinity_library/__init__.py SyntaxError (from __future__ at line 14)
  P0-BE-02 ❌ Docker CI: no Dockerfile in ./frontend directory
  P1-FE-01 ❌ vercel.json VITE_API_URL missing /api suffix
  P1-FE-02 ❌ API_BASE_URL in api.ts uses port 5000 (should be 3000)
  P1-FE-03 ❌ pages/api/ functions missing try/catch and input validation
  P1-FE-04 ❌ Dockerfile EXPOSE 3000 but app runs on 5173

ARCHITECTURE SUMMARY (from REVISED_ARCHITECTURE.md)
  Frontend (Vercel)    → Vercel Edge (pages/api/) → Railway Gateway (:3000)
  Railway Gateway      → Python Agent Core (:8000) → BullMQ/Redis → PostgreSQL
  GitHub Actions       → Playwright scrapers → POST results to Railway → DB

AGENT ROSTER (13 agents — all must be reflected in agentTypes.ts, orchestrator.ts, AGENT_EXEC_LOGS)
  PlannerAgent    ResearchAgent   BuilderAgent    ScraperAgent   MediaAgent
  ValidatorAgent  DevOpsAgent     MonitoringAgent KnowledgeAgent BusinessAgent
  PredictionAgent SimulationAgent MetaAgent

MEMORY PERSISTENCE
  localStorage['xps_agent_memory']    — agent plan history
  localStorage['xps_agent_settings']  — agent configuration
  localStorage['xps_tool_registry']   — tool configuration
  localStorage['auth_token']          — JWT (migrate to memory + httpOnly cookie)
  PostgreSQL: leads, tasks, knowledge, outreach_log, sessions

FINAL OBJECTIVE
Launch a production-grade, self-improving AI operating system that runs on Vercel (frontend)
and Railway (backend). The React chat interface commands all 13 agents. Agents execute real
tasks via HTTP. Results appear in the UI via WebSocket. The system heals, optimizes, and
re-architectures itself continuously via the MetaAgent self-improvement loop.
