# Standard Operating Procedure — XPS Lead Intelligence Platform

> **Version:** 1.0  
> **Last updated:** _auto-updated by evolve_docs.js_  
> **Owner:** InfinityXOne Systems

---

## Purpose

This SOP defines operational procedures for running, maintaining, and troubleshooting the XPS Lead Intelligence Platform. All operators should read this document before interacting with production systems.

---

## 1. Daily Operations

### 1.1 Check Pipeline Status

```bash
# View recent GitHub Actions runs
gh run list --limit 10

# Check last scrape output
cat data/scraper_progress.json

# Check scored leads
cat data/leads/scoring_report.json | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log('Total:', d.total);
  console.log('HOT:', d.tiers?.HOT);
  console.log('WARM:', d.tiers?.WARM);
  console.log('COLD:', d.tiers?.COLD);
"
```

### 1.2 Review Outreach Log

```bash
cat data/outreach/outreach_log.json | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log('Outreach records:', d.length);
"
```

### 1.3 Run Living Docs Update

```bash
node tools/docs/evolve_docs.js
```

---

## 2. Running the Scraper Pipeline

### 2.1 Manual Trigger via GitHub Actions

1. Go to [Actions tab](https://github.com/InfinityXOneSystems/LEAD_GEN_INTELLIGENCE/actions)
2. Select `Lead Scraper Pipeline`
3. Click **Run workflow**

### 2.2 Local Run

```bash
# Ensure .env is configured
cp .env.example .env
# Edit .env with your DATABASE_URL

# Run scoring pipeline
npm run score

# Run orchestrator
node agents/orchestrator/orchestrator.js
```

### 2.3 Scheduled Runs

The pipeline runs automatically via GitHub Actions every **2 hours**:
- **Lead scraper** (`lead_scraper.yml`): every 2 hours, `cron: '0 */2 * * *'`
- **Full pipeline** (`pipeline.yml` / `lead_pipeline.yml`): every 2 hours, `cron: '0 */2 * * *'`
- **National discovery**: daily (see `.github/workflows/national_discovery.yml`)
- **Docs reflection**: daily + on push (see `.github/workflows/docs_reflection.yml`)

All three pipeline workflows also support **manual trigger via `workflow_dispatch`** — navigate to
**GitHub → Actions → [workflow name] → Run workflow** and click **Run workflow** to start
an immediate run with optional parameters.

---

## 3. Adding New Leads

### 3.1 Via Scraper

1. Edit `data/datasets/XPS_LEAD_INTELLIGENCE_SYSTEM/keywords.csv` to add new keywords
2. Edit `data/datasets/XPS_LEAD_INTELLIGENCE_SYSTEM/locations.csv` to add new locations
   - Currently tracked cities include: **Columbus, OH**; **Tempe, AZ**; **Rockford, IL** (and many more)
3. Trigger the scraper pipeline (Section 2.1)

### 3.2 Manually

Add records to `data/leads/scored_leads.json` following the schema in `contracts/lead_schema.json`.

---

## 3.5 City-Specific CSV/Markdown Exports

After each pipeline run, city-specific exports are automatically generated into `data/exports/`.

Supported cities: **Columbus, OH** · **Tempe, AZ** · **Rockford, IL**

| File pattern | Description |
|---|---|
| `data/exports/leads_<city>_<state>_<date>.csv` | All leads for that city on that run date |
| `data/exports/summary_<city>_<state>.md` | Markdown summary with tier breakdown and top leads |

To run exports manually:

```bash
node tools/city_export.js
```

---

## 4. Running Outreach Campaigns

### 4.1 Prerequisites

- Configure `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` in `.env`
- Confirm email templates in `outreach/templates/outreach_templates.csv`

### 4.2 Launch Campaign

```bash
node outreach/outreach_engine.js
```

### 4.3 Check Results

```bash
node -e "
  const log = require('./outreach/outreach_log');
  const entries = log.readLog();
  console.log('Sent:', entries.filter(e => e.status === 'sent').length);
  console.log('Failed:', entries.filter(e => e.status === 'failed').length);
"
```

---

## 5. Dashboard Operations

### 5.1 Local Development

```bash
cd dashboard
npm install
npm run dev
# Open http://localhost:3000
```

### 5.2 Production Build

```bash
cd dashboard
npm run build
# Output: dashboard/out/
```

### 5.3 Deploy to GitHub Pages

1. Build dashboard (Section 5.2)
2. GitHub Actions `gh-pages` workflow deploys automatically on push to `main`

---

## 6. Database Operations

### 6.1 Initialize Schema

```bash
# Ensure DATABASE_URL is set in .env
node -e "require('./db/db').initSchema().then(() => { console.log('Schema ready'); process.exit(0); })"
```

### 6.2 Backup Leads

```bash
pg_dump $DATABASE_URL -t leads > backups/leads_$(date +%Y%m%d).sql
```

### 6.3 Restore from Backup

```bash
psql $DATABASE_URL < backups/leads_YYYYMMDD.sql
```

---

## 7. Updating Datasets

Never modify datasets directly in production. Always:

1. Create a new CSV in `data/datasets/`
2. Test locally
3. Open a PR
4. Merge after review

---

## 8. Adding New Scrapers

1. Create a new file in `scrapers/` following the pattern of `scrapers/bing_maps_scraper.js`
2. Export a `scrape(keyword, location)` function
3. Register in `scrapers/engine.js`
4. Add unit tests in `tests/`

---

## 9. Secrets Management

- **Never commit secrets to the repository**
- Use GitHub Actions Secrets for all credentials
- Use `.env` locally (file is gitignored)
- Rotate secrets immediately if exposed

See [SECURITY.md](./SECURITY.md) for full policy.

---

## 10. Incident Response

See [OPERATIONS.md](./OPERATIONS.md) for incident runbooks.

---

_See also: [OPERATIONS.md](./OPERATIONS.md) · [SECURITY.md](./SECURITY.md) · [ARCHITECTURE.md](./ARCHITECTURE.md)_
