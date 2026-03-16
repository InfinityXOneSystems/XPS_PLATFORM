# XPS Intelligence — System Wiring Map

**Generated:** 2026-03-10  
**Status:** ✅ VALIDATED  

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    XPS INTELLIGENCE PLATFORM                        │
├─────────────────────┬───────────────────────┬───────────────────────┤
│  NEXT.JS DASHBOARD  │   EXPRESS GATEWAY      │  FASTAPI BACKEND      │
│  dashboard/         │   api/gateway.js       │  backend/app/         │
│  Port: 3000         │   Port: 3000           │  Port: 8000           │
│  Vercel Deploy      │   Railway Deploy       │  Railway Deploy       │
└─────────────────────┴───────────────────────┴───────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
              ┌─────┴─────┐         ┌────┴──────┐
              │ PostgreSQL │         │   Redis   │
              │   Port:    │         │  Port:    │
              │   5432     │         │   6379    │
              └───────────┘         └───────────┘
```

---

## Backend API Routes → Frontend Consumers

| Endpoint | Method | Frontend Consumer | Agent Consumer | Status |
|----------|--------|-------------------|----------------|--------|
| `/api/v1/leads` | GET | `dashboard/pages/leads.js` | None | ✅ WIRED |
| `/api/v1/leads` | POST | `dashboard/pages/leads.js` | ScraperAgent | ✅ WIRED |
| `/api/v1/leads/{id}` | GET,PUT,DELETE | `dashboard/pages/leads.js` | None | ✅ WIRED |
| `/api/v1/leads/stats` | GET | `dashboard/pages/analytics.js` | None | ✅ WIRED |
| `/api/v1/leads/export` | GET | `dashboard/pages/leads.js` | ExporterAgent | ✅ WIRED |
| `/api/v1/scrapers/run` | POST | `chat.js (RuntimeCommandChat)` | ScraperAgent | ✅ WIRED |
| `/api/v1/scrapers/status` | GET | `dashboard/pages/leads.js` | MonitorAgent | ✅ WIRED |
| `/api/v1/agents/run` | POST | `RuntimeCommandChat` | Orchestrator | ✅ WIRED |
| `/api/v1/agents/status` | GET | `RuntimeCommandChat` | Orchestrator | ✅ WIRED |
| `/api/v1/runtime/command` | POST | `RuntimeCommandChat` | SandboxExecutor | ✅ WIRED |
| `/api/v1/runtime/task/{id}` | GET | `RuntimeCommandChat` | TaskStateStore | ✅ WIRED |
| `/api/v1/runtime/parallel` | POST | `RuntimeCommandChat` | WorkerPool | ✅ WIRED |
| `/api/v1/runtime/file` | GET,POST | `workspace.js` | SandboxExecutor | ✅ WIRED |
| `/api/v1/runtime/shadow/status` | GET | `RuntimeCommandChat` | ShadowScraper | ✅ WIRED |
| `/api/v1/runtime/agents/run-all` | POST | `RuntimeCommandChat` | Orchestrator | ✅ WIRED |
| `/api/v1/outreach/send` | POST | `RuntimeCommandChat` | OutreachAgent | ✅ WIRED |
| `/api/v1/outreach/schedule` | POST | `RuntimeCommandChat` | OutreachAgent | ✅ WIRED |
| `/api/v1/commands/execute` | POST | `RuntimeCommandChat` | CommandRouter | ✅ WIRED |
| `/api/v1/system/health` | GET | `guardian.js` | HealthMonitor | ✅ WIRED |
| `/api/v1/system/metrics` | GET | `guardian.js` | MonitorAgent | ✅ WIRED |
| `/api/v1/admin/users` | GET,POST | `pages/admin` | AdminAgent | ✅ WIRED |
| `/api/v1/admin/features` | GET,POST | `pages/admin` | AdminAgent | ✅ WIRED |
| `/api/v1/admin/settings` | GET,POST | `settings.js` | AdminAgent | ✅ WIRED |
| `/api/v1/connectors` | GET | `connectors.js` | ConnectorAgent | ✅ WIRED |
| `/api/v1/connectors/{id}/test` | POST | `connectors.js` | ConnectorAgent | ✅ WIRED |
| `/api/v1/crm/contacts` | GET,POST | `crm.js` | CRMAgent | ✅ WIRED |
| `/api/v1/crm/contacts/{id}` | GET,PUT,DELETE | `crm.js` | CRMAgent | ✅ WIRED |
| `/api/v1/crm/pipeline` | GET | `crm.js` | CRMAgent | ✅ WIRED |
| `/api/v1/multi-agent/sessions` | POST | `chat.js` | MultiAgentOrch | ✅ WIRED |
| `/api/v1/multi-agent/sessions/{id}/message` | POST | `chat.js` | MultiAgentOrch | ✅ WIRED |
| `/api/v1/intelligence/discovery` | GET | `trends.js` | DiscoveryEngine | ✅ WIRED |
| `/api/v1/intelligence/trends` | GET | `trends.js` | TrendAnalyzer | ✅ WIRED |
| `/api/v1/intelligence/niches` | GET | `trends.js, invention-lab.js` | NicheDetector | ✅ WIRED |
| `/api/v1/intelligence/briefing` | GET | `intelligence.js` | DailyBriefing | ✅ WIRED |
| `/api/v1/intelligence/vision-cortex/status` | GET | `intelligence.js` | VisionCortex | ✅ WIRED |
| `/api/v1/intelligence/vision-cortex/run` | POST | `intelligence.js` | ShadowScraper | ✅ WIRED |
| `/api/v1/intelligence/predictions/{sector}` | GET | `RuntimeCommandChat` | PredictionAgent | ✅ WIRED |
| `/api/v1/intelligence/invention/run` | POST | `invention-lab.js` | InventionFactory | ✅ WIRED |
| `/api/v1/intelligence/hypotheses/generate` | GET | `invention-lab.js` | HypothesisGen | ✅ WIRED |
| `/api/v1/intelligence/experiment/design` | GET | `invention-lab.js` | ExpDesigner | ✅ WIRED |

---

## Dashboard Pages → API Consumers

| Page Route | File | Primary API | Status |
|------------|------|-------------|--------|
| `/` | `index.js` | Static + nav | ✅ |
| `/leads` | `leads.js` | `/api/v1/leads` | ✅ |
| `/analytics` | `analytics.js` | `/api/v1/leads/stats` | ✅ |
| `/chat` | `chat.js` | `/api/v1/multi-agent/*`, `/api/v1/runtime/*` | ✅ |
| `/crm` | `crm.js` | `/api/v1/crm/*` | ✅ |
| `/connectors` | `connectors.js` | `/api/v1/connectors` | ✅ |
| `/settings` | `settings.js` | `/api/v1/admin/settings` | ✅ |
| `/studio` | `studio.js` | `/api/v1/runtime/file` | ✅ |
| `/workspace` | `workspace.js` | `/api/v1/runtime/file` | ✅ |
| `/intelligence` | `intelligence.js` | `/api/v1/intelligence/*` | ✅ |
| `/invention-lab` | `invention-lab.js` | `/api/v1/intelligence/invention/*` | ✅ |
| `/trends` | `trends.js` | `/api/v1/intelligence/trends` | ✅ |
| `/guardian` | `guardian.js` | `/api/v1/system/*` | ✅ |

---

## Agent Communication Map

```
RuntimeController
       │
       ├── CommandRouter
       │       ├── ScraperAgent       (scrapers/google_maps, yelp, bing, directory)
       │       ├── ScoringAgent       (agents/scoring/)
       │       ├── EnrichmentAgent    (agents/enrichment/)
       │       ├── SEOAgent           (agents/seo/)
       │       ├── SocialAgent        (agents/social/)
       │       ├── BrowserAgent       (agents/browser/)
       │       ├── OutreachAgent      (outreach/)
       │       └── CRMAgent           (agents/crm)
       │
       ├── TaskDispatcher
       │       ├── WorkerPool (6 workers)
       │       └── SandboxExecutor
       │
       └── TaskStateStore (in-memory)
```

---

## Validation Result

- **Total backend API endpoints:** 38+
- **Total frontend pages:** 13
- **Total agents:** 20+
- **Frontend↔Backend wiring:** ✅ Complete
- **Agent↔Runtime wiring:** ✅ Complete
- **Database↔API wiring:** ✅ Complete (SQLite fallback verified in tests)
