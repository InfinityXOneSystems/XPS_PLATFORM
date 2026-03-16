# System Blueprint — XPS Lead Intelligence Platform

> **Last updated:** _auto-updated by evolve_docs.js_

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATOR                             │
│              agents/orchestrator/orchestrator.js                │
└────────────────────────┬────────────────────────────────────────┘
                         │
              ┌──────────▼──────────┐
              │     TASK QUEUE      │
              │   (BullMQ / Redis)  │
              └──────────┬──────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
   ┌──────────┐   ┌──────────┐   ┌──────────────┐
   │ Google   │   │  Bing    │   │  Yelp /      │
   │  Maps    │   │  Maps    │   │ Directories  │
   │ Scraper  │   │ Scraper  │   │  Scraper     │
   └────┬─────┘   └────┬─────┘   └──────┬───────┘
        └──────────────┴─────────────────┘
                         │
              ┌──────────▼──────────┐
              │  RAW LEAD DATABASE  │
              │   PostgreSQL / JSON │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │  VALIDATION ENGINE  │
              │  validators/        │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │ ENRICHMENT ENGINE   │
              │  agents/email/      │
              │  agents/crawler/    │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │   LEAD SCORING      │
              │ agents/scoring/     │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │ OUTREACH AUTOMATION │
              │    outreach/        │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │  DASHBOARD + API    │
              │ dashboard/ pages/   │
              └─────────────────────┘
```

---

## Component Inventory

### Scrapers (`scrapers/`)

| File | Description |
|---|---|
| `google_maps_scraper.js` | Crawlee/Playwright-based Google Maps crawler |
| `bing_maps_scraper.js` | Bing Maps scraper |
| `engine.js` | Scraper engine dispatcher |
| `scraper_queue.js` | Queue management for scraping jobs |
| `maps/` | Map-specific scraper modules |

### Agents (`agents/`)

| Directory | Description |
|---|---|
| `orchestrator/` | Master pipeline controller |
| `scoring/` | Lead scoring engine (0–100 pts) |
| `crawler/` | General-purpose web crawler |
| `dedupe/` | Duplicate detection and removal |
| `discovery/` | National lead discovery pipeline |
| `email/` | Email discovery and extraction |
| `exporter/` | Lead export (CSV, JSON, database) |
| `gpt_actions/` | GPT Actions API server |
| `monitor/` | Pipeline health monitoring |
| `outreach/` | Outreach agent |
| `parser/` | HTML/data parsing utilities |
| `task_agent.js` | Autonomous task runner |
| `scheduler.js` | Cron-based scheduling |

### Outreach (`outreach/`)

| File | Description |
|---|---|
| `outreach_engine.js` | Email campaign engine (Nodemailer) |
| `follow_up_scheduler.js` | Automated follow-up sequencing |
| `outreach_log.js` | Outreach activity log |
| `templates/` | Email templates (CSV) |

### Database (`db/`, `database/`)

| File | Description |
|---|---|
| `db/db.js` | PostgreSQL connection pool |
| `db/leadStore.js` | Lead CRUD operations |
| `db/schema.sql` | Database schema DDL |
| `database/database.js` | SQLite fallback database |

### Dashboard

| Directory | Description |
|---|---|
| `dashboard/` | Next.js 16 + Tailwind PWA dashboard |
| `pages/` | Static HTML dashboard (GitHub Pages fallback) |

### Data (`data/`)

| Path | Description |
|---|---|
| `data/leads/` | Scored lead JSON files |
| `data/datasets/` | Keyword and location datasets |
| `data/national/` | National discovery outputs |
| `data/outreach/` | Outreach log JSON |

---

## Data Flow

```
[Scraper Jobs]
     │
     ▼
[Raw Lead Record] ──► { company_name, phone, website, rating,
                         review_count, address, city, state, category }
     │
     ▼
[Validation]
  ├── phone format check
  ├── website reachability
  ├── duplicate fingerprint hash
  └── output: valid / invalid
     │
     ▼
[Enrichment]
  ├── email discovery (website crawl + pattern match)
  ├── LinkedIn profile search
  └── output: enriched lead record
     │
     ▼
[Scoring Engine]
  ├── +10 website present
  ├── +15 email discovered
  ├── +10 phone present
  ├── +5  reviews > 10
  ├── +10 rating > 4
  ├── +40 completeness score
  └── output: score 0–100, tier HOT/WARM/COLD
     │
     ▼
[Storage]
  ├── data/leads/scored_leads.json
  ├── data/leads/scoring_report.json
  └── PostgreSQL leads table
     │
     ▼
[Outreach]
  ├── Email campaign (Nodemailer)
  ├── Follow-up scheduler (node-cron)
  └── Log: data/outreach/outreach_log.json
     │
     ▼
[Dashboard]
  ├── Next.js PWA: dashboard/
  └── Static HTML: pages/index.html
```

---

## GitHub Actions Automation

| Workflow | Trigger | Purpose |
|---|---|---|
| `lead_scraper.yml` | Schedule / manual | Run scraping pipeline |
| `national_discovery.yml` | Schedule | Nationwide lead discovery |
| `system_validation.yml` | Push / PR | Validate system health |
| `docs_reflection.yml` | Push / Schedule | Generate living docs, self-review, create issues |

---

_See also: [ARCHITECTURE.md](./ARCHITECTURE.md) · [VISION.md](./VISION.md) · [OPERATIONS.md](./OPERATIONS.md)_
