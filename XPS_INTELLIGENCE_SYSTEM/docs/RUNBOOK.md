# Runbook — XPS Lead Intelligence Platform

> **Objective:** Single reference for operating the entire system via GitHub Actions + PostgreSQL.

---

## 1. Prerequisites

| Requirement | Notes |
|---|---|
| PostgreSQL 14+ | Local or managed (Supabase, Railway, Neon, etc.) |
| Node.js 20+ | For local development and tooling |
| GitHub repository secrets | See §3 |

---

## 2. Quick Start (Local)

```bash
# 1. Clone and install
git clone https://github.com/InfinityXOneSystems/LEAD_GEN_INTELLIGENCE.git
cd LEAD_GEN_INTELLIGENCE
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your DATABASE_HOST, DATABASE_USER, etc.

# 3. Initialize database schema
node -e "require('./db/db').initSchema().then(() => { console.log('Schema ready'); process.exit(0); })"

# 4. Run the full pipeline manually
npm run score       # Score leads from data/leads/leads.json
npm run export      # Export snapshots to dashboard/public/data/ + data/leads/

# 5. Validate lead data
node -e "
  const fs = require('fs');
  const { runValidationPipeline } = require('./validation/lead_validation_pipeline');
  const leads = JSON.parse(fs.readFileSync('data/leads/leads.json','utf8') || '[]');
  const r = runValidationPipeline(leads, { writeReports: true });
  console.log(r.summary);
"

# 6. Start GPT Actions API server (port 3100)
npm run gpt-actions

# 7. Update living docs
npm run docs
```

---

## 3. GitHub Repository Secrets

Configure these secrets in **Settings → Secrets and variables → Actions**:

| Secret | Description | Required |
|---|---|---|
| `DATABASE_HOST` | PostgreSQL hostname | For DB-connected pipeline |
| `DATABASE_PORT` | PostgreSQL port (default: 5432) | Optional |
| `DATABASE_NAME` | Database name | For DB-connected pipeline |
| `DATABASE_USER` | Database user | For DB-connected pipeline |
| `DATABASE_PASSWORD` | Database password | For DB-connected pipeline |
| `DATABASE_SSL` | `true` if SSL/TLS required | Optional |

> **Note:** Without DB secrets, the pipeline runs in JSON-only mode using `data/leads/leads.json` as the source of truth.

---

## 4. GitHub Actions Workflows

### 4.1 `pipeline.yml` — Full Lead Pipeline

**Triggers:** Every 4 hours (schedule) + manual dispatch

**Steps:**
1. Scrape leads (Google Maps / Bing Maps)
2. Validate leads → write `data/leads/validation_report.json`
3. Score leads → write `data/leads/scored_leads.json`
4. Export JSON snapshots → update `dashboard/public/data/`
5. Commit outputs back to repository

**Manual trigger with options:**
```
GitHub → Actions → Lead Intelligence Pipeline → Run workflow
  max_keywords: 5
  max_locations: 10
  skip_scrape: 0
  enforce_gates: 0
```

### 4.2 `lead_validation.yml` — Validation on Code Changes

**Triggers:** Push/PR affecting lead data or pipeline code

**What it does:**
- Runs unit tests
- Validates `data/leads/leads.json` against schema
- Writes validation reports
- Posts summary comment on PRs

### 4.3 `code_quality.yml` — Tests & Lint

**Triggers:** Push/PR affecting JS/TS files

**What it does:**
- Runs `npm test` (50 unit tests)
- Lints Next.js dashboard
- Validates all workflow YAML files

### 4.4 `docs_reflection.yml` — Living Docs

**Triggers:** Push to main + daily at 06:00 UTC

**What it does:**
- Regenerates `docs/REPO_MAP.md`, `docs/TODO.md`, `docs/STATUS.md`
- Creates GitHub issues from self-review recommendations

### 4.5 `pr_agent.yml` — PR Governance

**Triggers:** All pull_request events

**What it does:**
- **Policy check** (all PRs): runs tests, scans for secret patterns, flags schema changes
- **Auto-fix** (trusted branches only, same-repo PRs): runs prettier, commits style fixes

---

## 5. Database Operations

### 5.1 Initialize / Migrate Schema

```bash
node -e "require('./db/db').initSchema().then(() => { console.log('Done'); process.exit(0); })"
```

The schema is idempotent (`CREATE TABLE IF NOT EXISTS`). The `schema_version` table tracks applied migrations.

### 5.2 Check Schema Version

```sql
SELECT * FROM schema_version ORDER BY version DESC;
```

### 5.3 Backup

```bash
pg_dump $DATABASE_URL -t leads > backups/leads_$(date +%Y%m%d).sql
```

### 5.4 Restore

```bash
psql $DATABASE_URL < backups/leads_YYYYMMDD.sql
```

### 5.5 Query Top Leads

```bash
node -e "
  require('dotenv').config();
  const { getTopLeads } = require('./db/leadStore');
  getTopLeads(20).then(rows => { console.table(rows); process.exit(0); });
"
```

---

## 6. GPT Actions / Copilot Mobile Command Surface

### 6.1 Start the API Server

```bash
npm run gpt-actions
# Server running on http://localhost:3100
```

### 6.2 Available Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/status` | System health + lead count |
| GET | `/leads?limit=N` | List leads |
| POST | `/leads` | Add/update a lead |
| POST | `/score` | Score a single lead object |
| GET | `/tasks?status=pending` | List TODO tasks |
| POST | `/scrape` | Trigger scraper |
| GET | `/outreach/templates` | List outreach templates |
| POST | `/outreach/send` | Record outreach action |
| GET | `/openapi.json` | OpenAPI 3.1 spec |
| POST | `/pipeline/run` | Run scoring + export pipeline |
| POST | `/validate` | Run validation pipeline |
| GET | `/export` | Trigger snapshot export |

### 6.3 Using with Copilot Mobile

1. Deploy the GPT Actions server (Railway, Render, or self-hosted via GitHub Actions)
2. In GitHub Copilot → Extensions → Add custom GPT Action
3. Point to `https://your-server/openapi.json`
4. Natural language commands:
   - `"Show me the top 10 leads"` → GET /leads?limit=10
   - `"What's the system status?"` → GET /status
   - `"Run the pipeline"` → POST /pipeline/run
   - `"Validate leads"` → POST /validate

### 6.4 cURL Examples

```bash
# Check status
curl http://localhost:3100/status

# Get top 5 leads
curl "http://localhost:3100/leads?limit=5"

# Run full pipeline
curl -X POST http://localhost:3100/pipeline/run

# Validate leads
curl -X POST http://localhost:3100/validate

# Score a lead
curl -X POST http://localhost:3100/score \
  -H "Content-Type: application/json" \
  -d '{"company":"Acme Flooring","website":"https://acme.com","email":"info@acme.com","phone":"614-555-0000","reviews":15,"rating":4.5}'
```

---

## 7. Dashboard

### 7.1 Updating Dashboard Data

```bash
# Export latest data from DB (or JSON fallback)
npm run export

# This writes to:
#   dashboard/public/data/scored_leads.json
#   dashboard/public/data/scoring_report.json
```

### 7.2 Run Dashboard Locally

```bash
cd dashboard
npm install
npm run dev
# Open http://localhost:3000
```

### 7.3 Deploy to GitHub Pages

The `nextjs.yml` workflow automatically deploys the dashboard on push to `main`.

---

## 8. Lead Data Quality

### 8.1 View Validation Report

```bash
cat data/leads/validation_report.json | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.table(d.summary);
"
```

### 8.2 View Duplicates

```bash
cat data/leads/duplicates.json
```

### 8.3 View Invalid Leads

```bash
cat data/leads/invalid_leads.json
```

### 8.4 Quality Gate Thresholds (Environment Variables)

| Variable | Default | Description |
|---|---|---|
| `VALIDATION_MAX_INVALID_RATE` | `0.5` | Max fraction of invalid leads before gate fails |
| `VALIDATION_MAX_DUPLICATE_RATE` | `0.5` | Max fraction of duplicates before gate fails |

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot connect to PostgreSQL` | Missing DB secrets | Check GitHub Secrets / `.env` |
| `No leads.json found` | No scrape run yet | Run `pipeline.yml` dispatch |
| `Schema already exists` | Normal — schema is idempotent | No action needed |
| Dashboard shows old data | Export not run | `npm run export` or trigger `pipeline.yml` |
| Tests fail | Dependency issue | `npm ci` then `npm test` |
| Workflow YAML syntax error | Encoding issue | Ensure UTF-8 encoding |

---

## 10. Architecture Overview

```
GitHub Actions (pipeline.yml, every 4h)
  │
  ├─► Scrapers (scrapers/engine.js)
  │     ├─ Google Maps scraper
  │     └─ Bing Maps scraper
  │
  ├─► Validation (validation/lead_validation_pipeline.js)
  │     ├─ Field validation
  │     ├─ Deduplication
  │     └─ Report files
  │
  ├─► Scoring (agents/scoring/scoring_pipeline.js)
  │     └─ 100-pt scale: completeness + quality + industry + geo
  │
  ├─► PostgreSQL (db/leadStore.js)
  │     └─ Upsert leads (ON CONFLICT DO UPDATE)
  │
  └─► Export (tools/export_snapshot.js)
        ├─ dashboard/public/data/scored_leads.json
        ├─ dashboard/public/data/scoring_report.json
        └─ data/leads/scored_leads.json
              │
              └─► Next.js Dashboard (GitHub Pages)
```

---

*Last updated: auto-generated. See `docs/` for full documentation suite.*
