# Operations Runbook — XPS Lead Intelligence Platform

> **Last updated:** _auto-updated by evolve_docs.js_

---

## Overview

This runbook covers routine operations, incident response, and escalation procedures for the XPS Lead Intelligence Platform.

---

## Health Checks

### Pipeline Health

```bash
# Check GitHub Actions status
gh run list --limit 5

# Check data freshness
node -e "
  const fs = require('fs');
  const stat = fs.statSync('data/leads/scored_leads.json');
  const ageHours = (Date.now() - stat.mtimeMs) / 3600000;
  console.log('Leads age:', ageHours.toFixed(1), 'hours');
  if (ageHours > 24) console.warn('WARNING: Leads may be stale');
"
```

### Database Health

```bash
# Test database connection
node -e "
  require('dotenv').config();
  const { pool } = require('./db/db');
  pool.query('SELECT NOW()').then(r => { console.log('DB OK:', r.rows[0].now); pool.end(); })
    .catch(e => { console.error('DB ERROR:', e.message); process.exit(1); });
"
```

### Dashboard Health

- Static: Visit `https://infinityxonesystems.github.io/LEAD_GEN_INTELLIGENCE/`
- Local: `cd dashboard && npm run dev`

---

## Incident Response

### SEV-1: Pipeline Completely Down

**Symptoms:** No scraper runs in >24 hours, no new leads.

**Response:**
1. Check GitHub Actions logs for the `lead_scraper.yml` workflow
2. Check for Node.js version mismatch (`node --version` should be 18+)
3. Check environment variables are set (GitHub Secrets)
4. Re-trigger workflow manually from Actions tab
5. If issue persists, check `data/scraper_progress.json` for error details

**Escalation:** Open a GitHub issue with label `incident` and tag `@InfinityXOneSystems`

---

### SEV-2: Scraper Running But No Leads

**Symptoms:** Workflow succeeds but `scored_leads.json` is empty or stale.

**Response:**
1. Check `data/scraper_progress.json` for last successful run
2. Verify keywords and locations datasets are populated:
   ```bash
   wc -l data/datasets/XPS_LEAD_INTELLIGENCE_SYSTEM/keywords.csv
   wc -l data/datasets/XPS_LEAD_INTELLIGENCE_SYSTEM/locations.csv
   ```
3. Run scoring pipeline manually:
   ```bash
   npm run score
   ```
4. Check for scraper block (rate limiting, captcha): review scraper logs
5. Consider rotating User-Agent strings in scraper configuration

---

### SEV-3: Outreach Failures

**Symptoms:** Outreach log shows `status: "failed"` entries.

**Response:**
1. Check SMTP credentials in environment
2. Verify nodemailer configuration in `outreach/outreach_engine.js`
3. Check email sending limits (avoid spam filters)
4. Review `data/outreach/outreach_log.json` for error messages:
   ```bash
   node -e "
     const log = require('./data/outreach/outreach_log.json');
     log.filter(e => e.status === 'failed').slice(0,5).forEach(e => console.log(e));
   "
   ```

---

### SEV-4: Dashboard Not Loading

**Symptoms:** GitHub Pages shows 404 or blank page.

**Response:**
1. Check that `gh-pages` branch exists and has content
2. Verify GitHub Pages is configured to serve from `gh-pages` branch
3. Check `dashboard/next.config.ts` for correct `basePath`
4. Rebuild and redeploy:
   ```bash
   cd dashboard && npm run build
   ```
5. Check for broken data file paths (`data/scored_leads.json`)

---

## Routine Maintenance

### Weekly

- [ ] Review GitHub Actions run history
- [ ] Check lead data freshness
- [ ] Review outreach campaign metrics
- [ ] Update keywords/locations if needed
- [ ] Run `node tools/docs/evolve_docs.js` to update living docs

### Monthly

- [ ] Rotate API keys and SMTP credentials
- [ ] Review and close stale GitHub issues
- [ ] Update dependencies (`npm audit fix`)
- [ ] Archive old lead data files
- [ ] Review scoring model performance

### Quarterly

- [ ] Benchmark scraper throughput
- [ ] Review and update email templates
- [ ] Reassess target keyword and location lists
- [ ] Architecture review — compare current vs. target state (see [ARCHITECTURE.md](./ARCHITECTURE.md))

---

## Monitoring Alerts

Configure these alerts in your monitoring system of choice:

| Alert | Condition | Severity |
|---|---|---|
| No new leads | `scored_leads.json` not updated in 24h | SEV-2 |
| Workflow failure | Any GitHub Actions workflow fails | SEV-1/2 |
| Database connection error | `pg` connection fails | SEV-1 |
| Outreach failure rate | >20% emails failing | SEV-3 |
| Disk space | Data directory >1GB | Warning |

---

## Key File Locations

| File | Purpose |
|---|---|
| `data/scraper_progress.json` | Last scraper run status |
| `data/leads/scored_leads.json` | Current scored leads |
| `data/leads/scoring_report.json` | Scoring summary |
| `data/outreach/outreach_log.json` | Outreach history |
| `docs/STATUS.md` | Auto-generated system status |
| `docs/SELF_REVIEW.md` | Auto-generated repo review |

---

_See also: [SOP.md](./SOP.md) · [SECURITY.md](./SECURITY.md) · [ARCHITECTURE.md](./ARCHITECTURE.md)_
