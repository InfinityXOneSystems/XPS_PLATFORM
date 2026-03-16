# Architecture Decision Records — XPS Lead Intelligence Platform

> **ADR-lite log** — Records key decisions made during platform development.  
> **Last updated:** _auto-updated by evolve_docs.js_

---

## ADR-001: Node.js as Primary Backend Runtime

**Date:** 2026-01  
**Status:** Accepted  
**Decision:** Use Node.js (CommonJS) as the primary backend runtime.

**Context:** The platform requires async web scraping, job queuing, and API serving. Multiple options were considered (Python, Go, Node.js).

**Rationale:**
- Crawlee and Playwright have excellent Node.js support
- npm ecosystem provides BullMQ, Nodemailer, Express, pg, etc.
- Team familiarity with JavaScript/Node
- Consistency between backend and dashboard (JavaScript stack)

**Consequences:** All backend code uses CommonJS (`require`). TypeScript optional for new modules.

---

## ADR-002: Static Export Dashboard for GitHub Pages

**Date:** 2026-01  
**Status:** Accepted  
**Decision:** Use Next.js with static export (`output: 'export'`) for the dashboard.

**Context:** Dashboard needs to be hosted on GitHub Pages (free, no server required). Next.js was chosen for its React ecosystem and Tailwind integration.

**Rationale:**
- GitHub Pages serves static files only — no Node.js server available
- Next.js static export produces a fully static `out/` directory
- `basePath` and `assetPrefix` support GitHub Pages subpath routing
- PWA features work with static deployment

**Consequences:** No server-side rendering or API routes in dashboard. Data loaded from static JSON files.

---

## ADR-003: PostgreSQL as Primary Database with SQLite Fallback

**Date:** 2026-01  
**Status:** Accepted  
**Decision:** Use PostgreSQL as the production database, with SQLite as a local development fallback.

**Context:** Need durable, queryable storage for lead records with upsert/deduplication support.

**Rationale:**
- PostgreSQL supports `ON CONFLICT DO UPDATE` (upsert) for idempotent lead insertion
- `pg` npm package is mature and battle-tested
- SQLite (`sqlite3`) provides zero-configuration local development
- Both support the same SQL schema

**Consequences:** Database connection layer (`db/db.js`) must handle both. SSL required in production.

---

## ADR-004: GitHub Actions for Autonomous Operation

**Date:** 2026-01  
**Status:** Accepted  
**Decision:** Use GitHub Actions as the primary automation platform for scheduled pipeline runs.

**Context:** Platform must operate autonomously without dedicated infrastructure.

**Rationale:**
- Free for public repositories
- Cron scheduling support
- Access to `GITHUB_TOKEN` for issue creation and PR management
- Native integration with repository events
- No additional infrastructure required

**Consequences:** Pipeline runs are limited by GitHub Actions free tier minutes. Complex long-running jobs may need optimization.

---

## ADR-005: JSON Files as Primary Data Format for Pipeline Outputs

**Date:** 2026-01  
**Status:** Accepted  
**Decision:** Store pipeline outputs (scored leads, reports) as JSON files in `data/leads/`.

**Context:** Dashboard needs to read lead data. GitHub Actions cannot easily serve a database connection from Pages.

**Rationale:**
- JSON files can be served directly from GitHub Pages
- Dashboard reads `data/scored_leads.json` directly (no API call needed)
- Easy to version control and inspect
- Can be synchronized to PostgreSQL for production use

**Consequences:** JSON files are committed to the repository, increasing repo size over time. Rotation/archival policy needed.

---

## ADR-006: CommonJS Modules (not ESM) for Root Package

**Date:** 2026-01  
**Status:** Accepted  
**Decision:** Root `package.json` uses `"type": "commonjs"`.

**Context:** Mixed codebase with some UTF-16 encoded legacy files and newer UTF-8 modules.

**Rationale:**
- Some legacy files were written before ESM adoption
- CommonJS has better compatibility with older tooling
- Consistent with most npm packages (pg, crawlee, nodemailer)

**Consequences:** Cannot use `import`/`export` syntax in root-level `.js` files. Dashboard (Next.js) uses TypeScript/ESM separately.

---

## ADR-007: Living Documentation via Node.js Script

**Date:** 2026-03  
**Status:** Accepted  
**Decision:** Implement documentation generation via `tools/docs/evolve_docs.js` (Node.js, built-ins only).

**Context:** Need automated, idempotent, deterministic generation of living docs (REPO_MAP, TODO, STATUS, SELF_REVIEW).

**Rationale:**
- Node.js is already the primary runtime — no additional tooling
- Built-in modules only (`fs`, `path`, `child_process`) — zero dependencies
- CommonJS for consistency with root package
- Single file, easy to audit and modify

**Consequences:** Script must be run after every significant change. Integrated into GitHub Actions workflow.

---

_Add new ADRs above this line. Format: `## ADR-NNN: Title`_
