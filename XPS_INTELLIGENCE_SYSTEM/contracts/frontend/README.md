# Frontend Integration Contracts

## What is this?

This directory contains ready-to-use TypeScript components and services that wire the
[XPS-INTELLIGENCE-FRONTEND](https://github.com/InfinityXOneSystems/XPS-INTELLIGENCE-FRONTEND)
app to the XPS backend runtime API **and real scraped lead data**.

Files here are automatically pushed to the frontend repo by
`scripts/publish_leads_to_repos.py` on every enterprise lead pipeline run.

## Files

| File | Target location in frontend repo | Purpose |
|------|-----------------------------------|---------|
| `src/lib/leadsApi.ts` | `src/lib/leadsApi.ts` | Unwraps `{leads:[]}` envelope, normalises scraper schema → frontend Lead type, adds static fallback |
| `src/pages/ContractorsPage.tsx` | `src/pages/ContractorsPage.tsx` | Replaces MOCK_CONTRACTORS with live `useContractors()` hook |
| `public/data/leads.json` | `public/data/leads.json` | 1,059+ real scraped leads in frontend Lead type — offline fallback |
| `src/services/runtimeService.ts` | `src/services/runtimeService.ts` | Typed API client for runtime endpoints |
| `src/components/RuntimeCommandChat.tsx` | `src/components/RuntimeCommandChat.tsx` | Chat UI with live task polling |

## Data Flow

```
Shadow Scraper → leads/scored_leads.json (1,059 leads)
                          │
                          ▼
scripts/publish_leads_to_repos.py
  ├── Push normalized leads.json → XPS-INTELLIGENCE-FRONTEND/public/data/leads.json
  ├── Push leadsApi.ts contract  → XPS-INTELLIGENCE-FRONTEND/src/lib/leadsApi.ts
  ├── Push ContractorsPage.tsx   → XPS-INTELLIGENCE-FRONTEND/src/pages/ContractorsPage.tsx
  └── Fix .env.production        → .env.production (VITE_API_URL → xps-intelligence.up.railway.app)
                          │
                          ▼
Frontend (Vercel) auto-deploys on push → shows 1,059 real leads
```

## Lead Schema Normalization

The shadow scraper produces:
```json
{ "company": "...", "tier": "hot", "lead_score": 95, "industry": "Epoxy", "date_scraped": "..." }
```

The frontend `Lead` type expects:
```json
{ "company": "...", "rating": "A+", "opportunityScore": 95, "category": "Epoxy", "createdAt": "..." }
```

| Scraper field | Frontend field | Mapping |
|---|---|---|
| `lead_score` / `score` | `opportunityScore` | direct |
| `tier` + `lead_score` | `rating` | `hot/≥85→A+`, `≥70→A`, `warm/≥55→B+`, `≥40→B`, `≥25→C`, else `D` |
| `industry` / `category` | `category` | direct |
| `date_scraped` / `scrapedAt` | `createdAt` | direct |
| `id` (number) | `id` (string) | `String(id)` |
| `status: "hot"` | `status: "new"` | fresh scraped leads start as `new` |

## Triggering a Publish

```bash
# Via GitHub Actions
GitHub → Actions → Enterprise Lead Intelligence Pipeline → Run workflow

# Or locally (requires GH_APP_ID + GH_APP_PRIVATE_KEY)
python3 scripts/publish_leads_to_repos.py
```

## Required Secrets

| Secret | Purpose |
|---|---|
| `GH_APP_ID` | Infinity Orchestrator GitHub App numeric ID |
| `GH_APP_PRIVATE_KEY` | App private key (PEM) — enables cross-repo push |

## Environment Variables (XPS-INTELLIGENCE-FRONTEND)

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://xps-intelligence.up.railway.app/api` |
| `VITE_WS_URL` | `wss://xps-intelligence.up.railway.app` |


## Files

| File | Target location in frontend repo | Purpose |
|------|-----------------------------------|---------|
| `src/services/runtimeService.ts` | `src/services/runtimeService.ts` | Typed API client for runtime endpoints |
| `src/components/RuntimeCommandChat.tsx` | `src/components/RuntimeCommandChat.tsx` | Chat UI with live task polling |

## Installation Steps

### 1. Copy the files

```bash
# From the XPS-INTELLIGENCE-FRONTEND repo root:
curl -o src/services/runtimeService.ts \
  https://raw.githubusercontent.com/InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM/main/contracts/frontend/src/services/runtimeService.ts

curl -o src/components/RuntimeCommandChat.tsx \
  https://raw.githubusercontent.com/InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM/main/contracts/frontend/src/components/RuntimeCommandChat.tsx
```

### 2. Set the environment variable

In your Vercel project settings (or `.env.local`):

```bash
VITE_API_URL=https://your-railway-backend.up.railway.app
```

### 3. Wire into a page

The simplest way: replace the mock `AIChatPanel` in `AgentPage.tsx` with `RuntimeCommandChat`:

```tsx
// src/pages/AgentPage.tsx  (or wherever the chat lives)
import { RuntimeCommandChat } from '@/components/RuntimeCommandChat'

// Inside your JSX:
<div className="h-[calc(100vh-8rem)]">
  <RuntimeCommandChat />
</div>
```

Or add it to the `DashboardPage.tsx`:

```tsx
import { RuntimeCommandChat } from '@/components/RuntimeCommandChat'

// Inside a grid column:
<div className="col-span-2 h-[600px]">
  <RuntimeCommandChat />
</div>
```

### 4. Verify the integration

1. Open the frontend in your browser
2. Type: `scrape epoxy contractors in Tampa FL`
3. You should see:
   - ✅ A success toast: "Queued: Web Scrape"
   - ✅ An assistant message showing the task ID
   - ✅ A task status panel that polls every 1.5 seconds
   - ✅ Status progresses: `QUEUED → RUNNING → COMPLETED`
   - ✅ Logs and result appear when complete

## API Contract

See `DEPLOYMENT.md` in the root of `XPS_INTELLIGENCE_SYSTEM` for the full API contract
documentation including request/response schemas.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | ✅ Yes | Full URL to Railway backend, e.g. `https://xps-api.up.railway.app` |

> **Note**: The existing `VITE_API_URL` in `chatService.ts` defaults to `http://localhost:3000/api`.
> The new `runtimeService.ts` uses `http://localhost:8000` as default (the FastAPI backend port).
> Set `VITE_API_URL` to your Railway URL in production to make both work correctly.
