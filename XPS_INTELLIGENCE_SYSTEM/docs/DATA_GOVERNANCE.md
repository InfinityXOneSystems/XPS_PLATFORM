# Data Governance Policy — XPS Lead Intelligence Platform

> **Last updated:** _auto-updated by evolve_docs.js_

---

## Purpose

This document defines how the XPS Lead Intelligence Platform collects, processes, stores, and manages data — including business contact data scraped from public directories.

---

## Data Sources

| Source | Type | Basis for Collection |
|---|---|---|
| Google Maps | Public business listings | Publicly available |
| Bing Maps | Public business listings | Publicly available |
| Yelp | Public business listings | Publicly available |
| Contractor directories | Public business listings | Publicly available |
| Business websites | Contact page data | Publicly available |
| LinkedIn | Public company profiles | Publicly available |

**All data collected is limited to publicly available business information.** No private, login-protected, or consumer personal data is collected.

---

## Data Types Collected

| Field | Classification | Notes |
|---|---|---|
| Company name | Public | Business entity |
| Phone number | Semi-public | Business phone only |
| Website URL | Public | Business website |
| Email address | Semi-public | Business contact email |
| Physical address | Public | Business address |
| City / State | Public | Business location |
| Star rating | Public | User-generated review data |
| Review count | Public | Aggregated count only |
| Industry category | Public | Directory classification |

**We do not collect:**
- Consumer personal data
- Home addresses
- Social Security Numbers or government IDs
- Financial information
- Health data

---

## Data Processing

### Purpose Limitation

Data is collected and processed **only** for:
1. B2B contractor outreach by authorized operators (XPS Xpress / Xtreme Polishing Systems)
2. Lead scoring and qualification
3. Sales pipeline management

Data is **not** sold, shared with third parties, or used for advertising targeting.

### Data Minimization

Only fields necessary for lead qualification and outreach are stored. Raw scraped HTML is discarded after extraction (7-day retention maximum).

---

## Data Retention

| Data Type | Retention Period | Disposal Method |
|---|---|---|
| Scored leads | 90 days rolling | Delete from database |
| Outreach log | 1 year | Archive then delete |
| Raw scraped data | 7 days max | Automated deletion |
| Scoring reports | 90 days | Overwrite on next run |
| Scraper progress | 30 days | Automated cleanup |

---

## Data Quality

The platform implements automated data quality controls:

1. **Deduplication** — Hash-based fingerprint prevents duplicate lead records
2. **Validation** — Phone format, website reachability checks
3. **Scoring** — Quality score penalizes incomplete records
4. **Freshness** — Data older than 90 days is flagged for review

---

## Compliance Notes

### United States

- Data collected is **business contact information** and generally not subject to consumer privacy laws (CCPA, state privacy acts apply to consumers, not B2B contacts)
- CAN-SPAM Act applies to commercial email outreach — all emails must include:
  - Physical mailing address
  - Opt-out mechanism
  - Accurate sender identification
  - Non-deceptive subject lines

### Canada

- CASL (Canadian Anti-Spam Law) requires express or implied consent for commercial electronic messages
- Implied consent applies to businesses with existing relationships or whose contact info is publicly listed for business purposes

### European Union

- GDPR considerations: We **do not** collect EU consumer personal data
- B2B email outreach to EU businesses may be subject to ePrivacy Directive — obtain legal advice before EU outreach campaigns

---

## Data Breach Response

In the event of unauthorized access to lead data:

1. Immediately revoke database credentials (see [SECURITY.md](./SECURITY.md))
2. Assess scope of exposure
3. If business contact PII was exposed, consider notifying affected businesses
4. Document incident in [DECISIONS.md](./DECISIONS.md)
5. Review and strengthen access controls

---

## Operator Responsibilities

Users of this platform are responsible for:

1. Using collected data only for legitimate B2B sales outreach
2. Honoring opt-out requests promptly (within 10 business days)
3. Complying with applicable laws in their jurisdiction
4. Not sharing or reselling collected lead data
5. Maintaining accurate records of outreach for compliance

---

## Data Access Controls

| Role | Access Level |
|---|---|
| Platform operator | Full read/write |
| Developer | Development data only |
| GitHub Actions (automated) | Write to `leads`, `outreach_log` tables |
| Unauthenticated | Dashboard (read-only, public scores) |

---

## Audit Trail

The following activities are logged:

| Activity | Log Location |
|---|---|
| Lead scraping | `data/scraper_progress.json` |
| Lead scoring | `data/leads/scoring_report.json` |
| Outreach sent | `data/outreach/outreach_log.json` |
| Workflow runs | GitHub Actions audit log |
| Issue creation | GitHub Issues |

---

_See also: [SECURITY.md](./SECURITY.md) · [SOP.md](./SOP.md) · [OPERATIONS.md](./OPERATIONS.md)_
