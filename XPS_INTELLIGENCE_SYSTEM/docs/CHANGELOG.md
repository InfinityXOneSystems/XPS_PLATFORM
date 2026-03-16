# Changelog — XPS Lead Intelligence Platform

> This file is auto-updated by `tools/docs/evolve_docs.js`.  
> Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]
## [Unreleased — Recent Commits]

_Auto-detected at Fri, 06 Mar 2026 02:16:46 GMT_

- 797c729 Initial plan
- d395964 Merge pull request #23 from InfinityXOneSystems/copilot/resolve-merge-conflicts


### Added
- Enterprise documentation suite (`docs/`)
- Living documents automation (`tools/docs/evolve_docs.js`)
- Self-reflection GitHub Actions workflow (`docs_reflection.yml`)
- Interactive TODO dashboard (`docs/todo.html`)
- Machine-readable TODO format (`docs/TODO.json`)

---

## [0.6.0] — Phase 6: Dashboard + PWA

### Added
- Next.js 16 dashboard with Tailwind CSS (`dashboard/`)
- Dark/light theme toggle
- Lead viewer with HOT/WARM/COLD filtering
- Analytics stats cards
- PWA manifest + service worker
- Static HTML fallback dashboard (`pages/`)
- GitHub Pages deployment support

---

## [0.5.0] — Phase 5: Outreach Automation

### Added
- Outreach engine with Nodemailer scaffolding (`outreach/outreach_engine.js`)
- Email templates CSV (`outreach/templates/outreach_templates.csv`)
- Follow-up scheduler with node-cron (`outreach/follow_up_scheduler.js`)
- Outreach log (`outreach/outreach_log.js`)
- Google Calendar integration stub

---

## [0.4.0] — Phase 4: Lead Scoring Engine

### Added
- Lead scoring model (0–100 points) (`agents/scoring/lead_scoring.js`)
- Scoring pipeline (`agents/scoring/scoring_pipeline.js`)
- HOT/WARM/COLD tier assignment
- Unit tests (31 tests) (`tests/lead_scoring.test.js`)
- Scoring report generation (`data/leads/scoring_report.json`)

---

## [0.3.0] — Phase 3: Validation + Enrichment

### Added
- Phone number validation
- Website reachability checker
- Deduplication engine (`agents/dedupe/`)
- Email discovery agent (`agents/email/`)
- System validator (`validators/`)

---

## [0.2.0] — Phase 2: Scraper Development

### Added
- Google Maps scraper with Crawlee/Playwright (`scrapers/google_maps_scraper.js`)
- Bing Maps scraper (`scrapers/bing_maps_scraper.js`)
- Scraper engine dispatcher (`scrapers/engine.js`)
- Scraper queue management (`scrapers/scraper_queue.js`)
- Map-specific scraper modules (`scrapers/maps/`)
- GitHub Actions workflow for lead scraping

---

## [0.1.0] — Phase 1: System Architecture

### Added
- Repository structure established
- Lead schema contract (`contracts/lead_schema.json`)
- Keyword dataset (`data/datasets/XPS_LEAD_INTELLIGENCE_SYSTEM/keywords.csv`)
- Location dataset (`data/datasets/XPS_LEAD_INTELLIGENCE_SYSTEM/locations.csv`)
- PostgreSQL schema (`db/schema.sql`)
- Database layer (`db/db.js`, `db/leadStore.js`)
- Environment configuration (`.env.example`)
- Orchestrator agent (`agents/orchestrator/orchestrator.js`)
- Task agent (`agents/task_agent.js`)
- GPT Actions server (`agents/gpt_actions/server.js`)

---

_This file is partially auto-generated. Commit messages and PR titles are used to populate entries._
