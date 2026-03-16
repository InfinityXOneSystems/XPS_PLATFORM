# Runbooks — XPS Lead Intelligence Platform

> **Purpose:** Step-by-step operational procedures for common tasks and incident response.  
> **Audience:** Operators, maintainers, and autonomous GitHub Actions agents.  
> **Updated:** 2026-03-06

---

## Table of Contents

1. [Bootstrap the System](#1-bootstrap-the-system)
2. [Run the Lead Pipeline Manually](#2-run-the-lead-pipeline-manually)
3. [Re-Score All Leads](#3-re-score-all-leads)
4. [Add a New Scrape Target](#4-add-a-new-scrape-target)
5. [Fix UTF-16 Encoded Files](#5-fix-utf-16-encoded-files)
6. [Deploy / Redeploy the Dashboard](#6-deploy--redeploy-the-dashboard)
7. [Outreach Campaign Setup](#7-outreach-campaign-setup)
8. [Database Setup and Migration](#8-database-setup-and-migration)
9. [Troubleshoot Failing Workflows](#9-troubleshoot-failing-workflows)
10. [Reset Scraper Progress](#10-reset-scraper-progress)
11. [Rotate API Keys / Secrets](#11-rotate-api-keys--secrets)
12. [Emergency Rollback](#12-emergency-rollback)

---

## 1. Bootstrap the System

Use this runbook when setting up the platform from scratch.

### Prerequisites

- Node.js 18+ installed
- Git installed
- (Optional) PostgreSQL 14+ for production storage
- (Optional) SMTP credentials for outreach

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/InfinityXOneSystems/LEAD_GEN_INTELLIGENCE.git
cd LEAD_GEN_INTELLIGENCE

# 2. Install root dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your credentials (see .env.example for all options)

# 4. Verify the setup
npm test

# 5. Run the scoring pipeline (uses sample data on first run)
npm run score
# Output: data/leads/scored_leads.json, data/leads/scoring_report.json

# 6. Start the static dashboard (open pages/index.html in a browser)
# Or start the Next.js dashboard:
cd dashboard
npm install
npm run dev
# Open: http://localhost:3000
```

**Expected Result:** All tests pass, scoring pipeline outputs scored_leads.json.

---

## 2. Run the Lead Pipeline Manually

### Via GitHub Actions (recommended)

1. Go to **Actions** → **Lead Generation Pipeline — Full Autonomous Run**
2. Click **Run workflow**
3. Configure inputs:
   - `batch_size`: Number of cities per batch (default: 10)
   - `state_filter`: Restrict to a state, e.g. `TX` (leave blank for all)
   - `skip_scrape`: `1` to skip scraping, re-score only
   - `skip_outreach`: `1` to skip outreach step
4. Click **Run workflow**

### Via CLI (local)

```bash
# Full pipeline (local)
node scrapers/google_maps_scraper.js   # Stage 1: Scrape
node -e "
  const { runValidationPipeline } = require('./validation/lead_validation_pipeline');
  const fs = require('fs');
  const leads = JSON.parse(fs.readFileSync('data/leads/leads.json', 'utf8'));
  const r = runValidationPipeline(leads);
  fs.writeFileSync('data/leads/validated_leads.json', JSON.stringify(r.validLeads, null, 2));
  console.log(r.summary);
"                                       # Stage 2: Validate
node agents/scoring/scoring_pipeline.js # Stage 3: Score
node outreach/outreach_engine.js        # Stage 4: Outreach (needs SMTP)
```

**Expected Result:** `data/leads/scored_leads.json` and `data/leads/scoring_report.json` updated.

---

## 3. Re-Score All Leads

Use when the scoring algorithm changes or new leads are added.

```bash
# Ensure leads.json exists
ls data/leads/leads.json

# Run the scoring pipeline
node agents/scoring/scoring_pipeline.js

# Verify output
node -e "
  const r = require('./data/leads/scoring_report.json');
  console.log('Total:', r.summary?.total);
  console.log('HOT:', r.tiers?.HOT, 'WARM:', r.tiers?.WARM, 'COLD:', r.tiers?.COLD);
"
```

**Expected Result:** `scored_leads.json` contains all leads sorted by score descending.

---

## 4. Add a New Scrape Target

### Adding a new keyword

Edit `data/datasets/XPS_LEAD_INTELLIGENCE_SYSTEM/keywords.csv`:

```csv
# Add a new row:
<next_id>,Terrazzo Flooring,Flooring
```

### Adding a new location

Edit `data/datasets/XPS_LEAD_INTELLIGENCE_SYSTEM/locations.csv`:

```csv
# Add a new row:
<next_id>,Denver,CO,USA
```

### Adding a new scraper source

1. Create `scrapers/<source>_scraper.js` following the pattern in `scrapers/google_maps_scraper.js`
2. Add the scraper to `scrapers/scraper_queue.js`
3. Call it from `scrapers/engine.js`
4. Add a step to `.github/workflows/lead_pipeline.yml` Stage 1

---

## 5. Fix UTF-16 Encoded Files

Some legacy JS files may be UTF-16 encoded, which breaks Node.js execution.

### Detection

```bash
find . -name "*.js" -not -path "*/node_modules/*" | while read f; do
  file "$f" | grep -q "UTF-16" && echo "UTF-16: $f"
done
```

### Fix (single file)

```bash
iconv -f UTF-16 -t UTF-8 path/to/file.js -o /tmp/file_utf8.js
mv /tmp/file_utf8.js path/to/file.js
```

### Fix (all JS files)

```bash
find . -name "*.js" -not -path "*/node_modules/*" -print0 | while IFS= read -r -d '' f; do
  if file "$f" | grep -q "UTF-16"; then
    echo "Converting: $f"
    iconv -f UTF-16 -t UTF-8 "$f" -o "${f}.utf8" && mv "${f}.utf8" "$f"
  fi
done
```

**Note:** The Repo Guardian workflow runs this automatically.

---

## 6. Deploy / Redeploy the Dashboard

### GitHub Pages (Next.js — automatic)

The `nextjs.yml` workflow triggers automatically on push to `main` when files in `dashboard/` change.

To force redeploy:
1. Go to **Actions** → **Deploy Next.js site to Pages**
2. Click **Run workflow**

### GitHub Pages (Static HTML — pages/)

The `pages/index.html` and associated files in `pages/` are committed directly.  
GitHub Pages will serve them from the configured branch/folder.

To check Pages status:
1. Go to **Settings** → **Pages**
2. Verify source and deployment URL

### Local Preview

```bash
# Serve pages/ directory locally
npx serve pages/
# Open: http://localhost:3000

# Or use Python
cd pages && python3 -m http.server 8080
# Open: http://localhost:8080
```

---

## 7. Outreach Campaign Setup

### Prerequisites

- SMTP credentials (or SendGrid API key)
- Leads must be scored (`data/leads/scored_leads.json` must exist)

### Configure SMTP

Add to `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your_app_password
OUTREACH_FROM_EMAIL=your@email.com
OUTREACH_FROM_NAME=XPS Lead Intelligence
```

### Run outreach manually

```bash
node outreach/outreach_engine.js
# Sends to HOT leads not yet contacted
```

### Run follow-up scheduler

```bash
node outreach/follow_up_scheduler.js
# Sends follow-ups to leads contacted 3+ days ago
```

### View outreach log

```bash
cat data/outreach/outreach_log.json | node -e "
  const chunks = [];
  process.stdin.on('data', d => chunks.push(d));
  process.stdin.on('end', () => {
    const log = JSON.parse(Buffer.concat(chunks));
    console.table(log.slice(-10));
  });
"
```

---

## 8. Database Setup and Migration

### Quick start (PostgreSQL)

```bash
# Create database
createdb lead_gen_intelligence

# Set environment variable
echo "DATABASE_URL=postgresql://localhost/lead_gen_intelligence" >> .env

# Initialize schema
node -e "
  const { initSchema } = require('./db/db');
  initSchema().then(() => console.log('Schema initialized')).catch(console.error);
"
```

### Schema reference

See `db/schema.sql` for full table definitions.

Tables:
- `leads` — all scraped and enriched leads
- `scrape_history` — scraping run records
- `outreach_log` — outreach send history
- `lead_scores` — historical scores

### Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (overrides individual vars) |
| `DATABASE_HOST` | DB host (default: localhost) |
| `DATABASE_PORT` | DB port (default: 5432) |
| `DATABASE_NAME` | DB name |
| `DATABASE_USER` | DB user |
| `DATABASE_PASSWORD` | DB password |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Set `false` for self-signed certs |

---

## 9. Troubleshoot Failing Workflows

### Step 1: Check workflow logs

1. Go to **Actions** → find the failed run
2. Click the failing job to expand steps
3. Look for the first red step

### Step 2: Common failures

| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot find module` | Missing npm install | Run `npm ci` in the correct directory |
| `UTF-16 encoded` | Legacy file encoding | Run [Fix UTF-16](#5-fix-utf-16-encoded-files) |
| `YAML syntax error` | Malformed workflow file | Validate with `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/x.yml'))"` |
| `Test failed` | Regression | Run `npm test` locally to debug |
| `Playwright not found` | Missing browser | Add `npx playwright install --with-deps chromium` step |

### Step 3: Re-run failed job

1. Go to **Actions** → failed run
2. Click **Re-run failed jobs**

### Step 4: Check Repo Guardian

The Repo Guardian creates GitHub issues when health checks fail. Check **Issues** for `[Guardian]` labeled issues.

---

## 10. Reset Scraper Progress

The scraper tracks progress in `data/scraper_progress.json`. To restart from the beginning:

### Via GitHub Actions

1. Go to **Actions** → **Nationwide Lead Scraper**
2. Run workflow with `reset_progress: 1`

### Via CLI

```bash
echo '{"lastIndex":0,"processedCities":[]}' > data/scraper_progress.json
git add data/scraper_progress.json
git commit -m "chore: reset scraper progress"
git push
```

---

## 11. Rotate API Keys / Secrets

### GitHub Secrets

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click the secret name → **Update**
3. Enter new value → **Update secret**

### Required Secrets

| Secret | Purpose |
|--------|---------|
| `SMTP_HOST` | Outreach email server |
| `SMTP_PORT` | Outreach email port |
| `SMTP_USER` | Outreach email username |
| `SMTP_PASS` | Outreach email password |
| `OUTREACH_FROM_EMAIL` | Sender email address |
| `DATABASE_URL` | PostgreSQL connection (optional) |

### After Rotation

Re-run any workflow that uses the rotated credential to verify it works.

---

## 12. Emergency Rollback

### Rollback to last known good commit

```bash
# Find the last good commit
git log --oneline -20

# Create a rollback branch
git checkout -b hotfix/rollback-<date>

# Reset to the good commit
git reset --hard <commit-sha>

# Push (requires force — use with caution)
git push origin hotfix/rollback-<date>

# Open a PR to merge rollback to main
```

### Rollback data files

Data files (`data/leads/*.json`) are committed to the repository and can be reverted:

```bash
git log --oneline -- data/leads/scored_leads.json
git checkout <good-commit-sha> -- data/leads/scored_leads.json
git commit -m "revert: restore scored_leads.json to known good state"
```

### Emergency disable scraper

To stop the scraper from running:
1. Go to **Actions** → **Nationwide Lead Scraper**
2. Click **...** (three dots) → **Disable workflow**

---

_For issues not covered here, open a GitHub Issue with the label `runbook-gap`._
