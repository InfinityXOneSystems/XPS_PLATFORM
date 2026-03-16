# Roadmap — XPS Lead Intelligence Platform

> **Last updated:** _auto-updated by evolve_docs.js_

---

## Phase Overview

| Phase | Name | Status |
|---|---|---|
| 1 | System Architecture & Infrastructure | ✅ Complete |
| 2 | Scraper Development | ✅ Complete |
| 3 | Validation + Enrichment | ✅ Complete |
| 4 | Lead Scoring Engine | ✅ Complete |
| 5 | Outreach Automation | ✅ Complete |
| 6 | Dashboard + PWA | ✅ Complete |
| 7 | Autonomous Orchestration | 🔄 In Progress |
| 8 | Nationwide Lead Discovery | 🔲 Planned |

---

## Phase 1 — System Architecture

**Status:** ✅ Complete

- [x] Repository structure established
- [x] Data schemas defined (`contracts/lead_schema.json`)
- [x] Keyword and location datasets loaded
- [x] GitHub Actions skeleton
- [x] Environment configuration (`.env.example`)

---

## Phase 2 — Scraper Development

**Status:** ✅ Complete

- [x] Google Maps scraper (Crawlee + Playwright)
- [x] Bing Maps scraper
- [x] Scraper engine dispatcher
- [x] Scraper queue management
- [x] Maps-specific scraper modules

---

## Phase 3 — Validation + Enrichment

**Status:** ✅ Complete

- [x] Phone number validation
- [x] Website reachability check
- [x] Duplicate detection and deduplication
- [x] Email discovery agent
- [x] LinkedIn profile lookup
- [x] System validator

---

## Phase 4 — Lead Scoring Engine

**Status:** ✅ Complete

- [x] Scoring model (0–100 points)
- [x] Completeness sub-score
- [x] Quality sub-score (rating, reviews)
- [x] Industry and geo signals
- [x] Tier assignment (HOT / WARM / COLD)
- [x] Scoring pipeline
- [x] Unit tests (31 tests)
- [x] Scoring report generation

---

## Phase 5 — Outreach Automation

**Status:** ✅ Complete

- [x] Outreach engine (Nodemailer scaffolding)
- [x] Email templates (CSV)
- [x] Follow-up scheduler (node-cron)
- [x] Outreach log
- [x] Google Calendar integration stub

---

## Phase 6 — Dashboard + PWA

**Status:** ✅ Complete

- [x] Next.js 16 dashboard
- [x] Tailwind CSS dark/light theme
- [x] Lead viewer with filtering
- [x] Analytics / stats cards
- [x] HOT/WARM/COLD tier visualization
- [x] PWA manifest + service worker
- [x] Mobile responsive
- [x] Static HTML fallback dashboard
- [x] GitHub Pages deployment

---

## Phase 7 — Autonomous Orchestration

**Status:** 🔄 In Progress

- [x] Orchestrator agent
- [x] Task agent
- [x] GPT Actions server
- [x] National discovery workflow
- [ ] Redis/BullMQ task queue integration
- [ ] Real-time pipeline monitoring
- [ ] Automated self-review + living docs
- [ ] Issue auto-creation from recommendations
- [ ] Real email delivery (production Nodemailer)
- [ ] Webhook triggers for external integrations

---

## Phase 8 — Nationwide Lead Discovery

**Status:** 🔲 Planned

- [ ] All 50 states coverage
- [ ] 500+ leads/day throughput
- [ ] Multi-keyword, multi-location batching
- [ ] AI-powered lead quality analysis (OpenAI)
- [ ] Automated A/B testing for outreach
- [ ] CRM integration (HubSpot / Salesforce export)
- [ ] Multi-tenant per-client campaigns
- [ ] Revenue attribution tracking

---

## Milestones

| Milestone | Target Date | Status |
|---|---|---|
| MVP Scraper + Dashboard live | Q1 2026 | ✅ |
| Scoring engine production-ready | Q1 2026 | ✅ |
| Outreach campaigns running | Q2 2026 | 🔄 |
| Living docs + self-review system | Q2 2026 | 🔄 |
| Nationwide 500 leads/day | Q3 2026 | 🔲 |
| 1,000 active leads in pipeline | Q3 2026 | 🔲 |
| First paying client pipeline | Q4 2026 | 🔲 |

---

_See also: [VISION.md](./VISION.md) · [DECISIONS.md](./DECISIONS.md) · [CHANGELOG.md](./CHANGELOG.md)_
