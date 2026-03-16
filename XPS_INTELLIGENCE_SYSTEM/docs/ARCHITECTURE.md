# Technical Architecture — XPS Lead Intelligence Platform

> **Last updated:** 2026-03-10 — Updated by Copilot governance system
> **Build:** [![CI](https://github.com/InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM/actions/workflows/ci.yml/badge.svg)](https://github.com/InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM/actions/workflows/ci.yml)
> **Deployment:** Railway (backend) · Vercel / GitHub Pages (frontend)

---

## Technology Stack

### Backend (Node.js)

| Technology | Version | Purpose |
|---|---|---|
| Node.js | 18+ | Runtime |
| Crawlee | ^3.x | Web crawling framework |
| Playwright | ^1.x | Browser automation |
| Express | ^5.x | GPT Actions API server |
| PostgreSQL (`pg`) | ^8.x | Primary database |
| SQLite3 | ^5.x | Local/fallback database |
| BullMQ / node-cron | ^4.x | Task queue / scheduling |
| Nodemailer | ^8.x | Email delivery |
| Axios | ^1.x | HTTP client |
| Cheerio | ^1.x | HTML parsing |
| OpenAI | ^6.x | AI enrichment (optional) |

### Frontend / Dashboard

| Technology | Purpose |
|---|---|
| Next.js 16 | React framework with static export |
| Tailwind CSS | Utility-first CSS |
| TypeScript | Type safety |
| PWA (SW + Manifest) | Offline support, installability |

### CI/CD

| Technology | Purpose |
|---|---|
| GitHub Actions | Workflow automation |
| GitHub Pages | Static dashboard hosting |
| GitHub CLI (`gh`) | Issue creation from workflows |

---

## Current State vs. Target State

### Current State (Phase 7 — Governance System Active)

```
✅ Lead scoring engine             agents/scoring/
✅ Scraper framework               scrapers/
✅ Outreach engine                 outreach/
✅ PostgreSQL schema               db/
✅ Next.js dashboard               dashboard/
✅ Static HTML dashboard           pages/
✅ GPT Actions server              agents/gpt_actions/
✅ Orchestrator                    agents/orchestrator/
✅ National discovery              .github/workflows/national_discovery.yml
✅ GitHub Actions pipelines        .github/workflows/
✅ PWA support                     dashboard/public/, pages/
✅ Unit tests                      tests/
✅ FastAPI backend                 backend/
✅ Hidden admin panel              dashboard/pages/admin/hidden/
✅ Admin governance API            backend/app/api/v1/admin.py
✅ Admin DB models                 backend/app/models/admin_models.py
✅ Multi-agent spawner             /admin/hidden/copilot
✅ Universal API connector         /admin/hidden/integrations
✅ Quality gate CI workflow        .github/workflows/ci.yml
```

### Target State (Phase 8–12 — Full Enterprise Platform)

```
Phase 8  — Sales Staff Portal (Auth + role-based lead dashboard)
Phase 9  — Epoxy Domain LLM (fine-tuned industry advisor)
Phase 10 — Social Media Agent (multi-platform post orchestrator)
Phase 11 — Mobile Showroom (React Native + offline-first)
Phase 12 — AI Phone Coach (Twilio + real-time objection rebuttal)
```

---

## Project Phases Roadmap

| Phase | Name | Status | Key Deliverables |
|-------|------|--------|-----------------|
| 1 | System Architecture | ✅ Done | Repo structure, DB schema, CI |
| 2 | Scrapers | ✅ Done | Google Maps, Bing, Yelp, Directory |
| 3 | Validation + Enrichment | ✅ Done | Dedup, validation, email discovery |
| 4 | Lead Scoring | ✅ Done | Scoring engine, tiers, industry detection |
| 5 | Outreach Automation | ✅ Done | Nodemailer integration, follow-up scheduler |
| 6 | Dashboard + PWA | ✅ Done | Next.js, GitHub Pages, service worker |
| 7 | Autonomous Orchestration | ✅ Done | GitHub Actions cron pipelines |
| 8 | Admin Governance System | ✅ Done | Hidden admin, multi-agent spawn, API connector |
| 9 | Sales Staff Portal | 🔄 Next | Auth, role-based dashboards, lead assignment |
| 10 | Industry LLM | 🔄 Planned | Epoxy domain expert chat, RAG, lead enrichment |
| 11 | Social Media Agent | 🔄 Planned | Multi-platform posts, scheduling, ad creation |
| 12 | Mobile Showroom | 🔄 Planned | React Native, offline-first, AR gallery |
| 13 | AI Phone Coach | 🔄 Planned | Twilio, real-time transcription, rebuttal UI |
| 14 | Nationwide Discovery | 🔄 Active | Multi-source aggregation, progress tracking |

---

## TODO List

### High Priority (Next Sprint)
- [ ] **Sales Staff Portal** — NextAuth.js + Prisma, role hierarchy (owner/manager/sales/viewer)
- [ ] **Lead Assignment** — Assign leads to specific sales reps via admin panel
- [ ] **Stripe Integration** — Webhook handler, subscription upgrade/downgrade
- [ ] **Twilio Integration** — Voice call routing, SMS notifications
- [ ] **Admin Token Rotation** — Implement session-based hash rotation for admin URL
- [ ] **Rate Limiting** — Add slowapi middleware to backend (100 req/min per IP)
- [ ] **CORS Hardening** — Restrict origins to authorized domains only

### Medium Priority
- [ ] **Epoxy Domain LLM** — GPT-4 custom instructions + Pinecone RAG for industry knowledge
- [ ] **Social Media Scheduler** — Celery/BullMQ job for Instagram/Facebook/TikTok posts
- [ ] **Email Templates** — Industry-specific outreach templates for decorative concrete
- [ ] **Lead Deduplication** — Cross-source fingerprint matching
- [ ] **Analytics Pipeline** — Daily cron to populate analytics_daily table
- [ ] **Health Monitor Cron** — Periodic health snapshots to health_monitor table

### Low Priority / Future
- [ ] **Mobile Showroom** — React Native + Expo, offline-first, AR floor overlay
- [ ] **AI Phone Coach** — Live transcription + objection classification
- [ ] **AR Integration** — Place epoxy floor overlays in customer's space
- [ ] **Video Auto-Gen** — Mux + ffmpeg for short-form social content

---

## Copilot Orchestration Commands

```bash
# Deploy backend to Railway
railway up

# Deploy frontend to Vercel
vercel --prod

# Spawn 4 parallel agents for a feature
curl -X POST https://your-api.railway.app/api/v1/admin/hidden/copilot/spawn \
  -H "X-Admin-Token: $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"task": "Build Stripe webhook handler", "agent_count": 4}'

# Run full CI locally
cd backend && pytest tests/ -v --cov=app --cov-report=term-missing
cd dashboard && npm run lint && npm run build

# Update COPILOT_PROMPT.md via API
curl -X PUT https://your-api.railway.app/api/v1/admin/hidden/copilot/prompt \
  -H "X-Admin-Token: $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"content": "...", "commit_message": "Update orchestration prompt"}'
```

---

## Health Dashboard

| Metric | Target | Monitor |
|--------|--------|---------|
| API Uptime | > 99.9% | /admin/hidden/health |
| P50 Latency | < 100ms | /admin/hidden/health |
| P95 Latency | < 500ms | /admin/hidden/health |
| Error Rate | < 0.1% | /admin/hidden/health |
| Test Coverage | > 80% | CI badge |
| Lead Scrape Rate | > 300/min | Prometheus metrics |
| Lighthouse Score | > 90 | CI lighthouse audit |

---

## Database Schema

```sql
-- PostgreSQL schema (db/schema.sql)
CREATE TABLE IF NOT EXISTS leads (
  id          SERIAL PRIMARY KEY,
  company     TEXT NOT NULL,
  phone       TEXT NOT NULL DEFAULT '',
  website     TEXT NOT NULL DEFAULT '',
  email       TEXT,
  address     TEXT,
  city        TEXT NOT NULL DEFAULT '',
  state       TEXT NOT NULL DEFAULT '',
  rating      NUMERIC(3,1),
  reviews     INTEGER,
  category    TEXT,
  score       INTEGER,
  tier        TEXT,
  source      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scrape_history ( ... );
CREATE TABLE IF NOT EXISTS outreach_log ( ... );
CREATE TABLE IF NOT EXISTS lead_scores ( ... );
```

---

## Lead Scoring Model

```
Score = completeness (40) + quality (30) + industry (20) + geo (10)

Completeness sub-score:
  +10  website present
  +10  phone present
  +15  email discovered
  +5   address complete

Quality sub-score:
  +10  rating > 4.0
  +5   reviews > 10
  +15  website reachable

Industry sub-score:
  +20  category matches target industries

Geo sub-score:
  +10  city/state present

Tiers:
  HOT   ≥ 75
  WARM  50–74
  COLD  < 50
```

---

## Deployment Architecture

### GitHub Pages (Static Dashboard)

```
Repository main branch
       │
       ▼
GitHub Actions: build dashboard
       │
       ▼
dashboard/out/ → gh-pages branch
       │
       ▼
https://infinityxonesystems.github.io/LEAD_GEN_INTELLIGENCE/
```

### Backend (Self-hosted / Cloud)

```
GitHub Actions (cron)
       │
       ▼
Node.js scraper workers
       │
       ▼
PostgreSQL (Supabase / Railway / self-hosted)
       │
       ▼
REST API (agents/gpt_actions/server.js)
       │
       ▼
Dashboard data files (data/leads/*.json)
```

---

## Security Architecture

See [SECURITY.md](./SECURITY.md) for full threat model.

Key controls:
- Secrets managed via GitHub Actions secrets (never committed)
- Database SSL enforced by default (`rejectUnauthorized: true`)
- API server uses Express with input validation
- Scraper respects `robots.txt` and rate limits

---

## Performance Targets

| Metric | Target |
|---|---|
| Scraper throughput | 100 leads/minute |
| Scoring pipeline | <5s for 10,000 leads |
| Dashboard load | <2s TTI |
| Outreach queue | 500 emails/hour |
| Database upsert | 100 records/batch |

---

_See also: [BLUEPRINT.md](./BLUEPRINT.md) · [SECURITY.md](./SECURITY.md) · [OPERATIONS.md](./OPERATIONS.md)_
