# Glossary — XPS Lead Intelligence Platform

> **Last updated:** _auto-updated by evolve_docs.js_

---

## A

**ADR (Architecture Decision Record)**  
A document that captures an important architectural decision made along with its context and consequences. See [DECISIONS.md](./DECISIONS.md).

**Autonomous Pipeline**  
A workflow that runs without human intervention, scheduled via GitHub Actions to scrape, validate, enrich, score, and store leads.

---

## B

**B2B (Business-to-Business)**  
Commercial transactions between businesses. This platform targets B2B contractor sales outreach.

**BullMQ**  
A Node.js job queue library built on Redis, used for managing scraping and processing tasks asynchronously.

---

## C

**CASL**  
Canadian Anti-Spam Legislation. Governs commercial electronic messages in Canada.

**CAN-SPAM**  
U.S. law establishing rules for commercial email. Requires opt-out mechanisms, accurate sender identification, and physical addresses.

**Crawlee**  
An open-source web scraping and browser automation library for Node.js, used for building reliable scrapers.

**COLD Lead**  
A lead with a quality score below 50. Requires significant additional validation before outreach.

---

## D

**Dashboard**  
The real-time web interface for viewing, filtering, and acting on scored leads. Available as a Next.js PWA (`dashboard/`) and static HTML (`pages/`).

**Data Enrichment**  
The process of augmenting raw lead records with additional data points such as email addresses, LinkedIn profiles, and secondary contacts.

**Deduplication**  
The process of identifying and removing duplicate lead records, using hash-based fingerprinting.

---

## E

**Enrichment Agent**  
An automated component that discovers additional contact information for a lead record.

**Epoxy Contractor**  
A business specializing in epoxy floor coatings — a primary target industry for this platform.

---

## G

**GitHub Actions**  
A CI/CD and automation platform built into GitHub, used to run the lead pipeline on a schedule.

**GitHub Pages**  
GitHub's free static site hosting, used to serve the lead intelligence dashboard.

**GPT Actions**  
OpenAI's plugin/action framework, integrated via `agents/gpt_actions/server.js` to allow AI assistants to interact with the lead system.

**GDPR**  
General Data Protection Regulation (EU). Governs processing of personal data of EU residents.

---

## H

**HOT Lead**  
A lead with a quality score of 75 or higher — complete contact information, high-rated business, ready for immediate outreach.

---

## I

**Idempotent**  
A property of an operation that can be applied multiple times without changing the result beyond the initial application. All automation scripts in this platform are designed to be idempotent.

---

## L

**Lead**  
A business record representing a potential contractor client, including contact information, location, industry category, and quality score.

**Lead Score**  
A numerical value (0–100) representing the quality and completeness of a lead record.

**Lead Schema**  
The data contract defining the structure of a lead record. See `contracts/lead_schema.json`.

**Living Document**  
A document that is automatically updated by tooling as the repository evolves. Examples: `docs/TODO.md`, `docs/STATUS.md`, `docs/REPO_MAP.md`.

---

## N

**Nodemailer**  
A Node.js library for sending emails, used in the outreach automation module.

**node-cron**  
A Node.js library for scheduling tasks using cron syntax, used in the follow-up scheduler.

---

## O

**Orchestrator**  
The master controller agent (`agents/orchestrator/orchestrator.js`) that coordinates the full lead pipeline.

**Outreach**  
The process of sending personalized email communications to scored leads.

---

## P

**Pipeline**  
The end-to-end automated process: Scrape → Validate → Enrich → Score → Outreach → Dashboard.

**Playwright**  
A browser automation library used by scrapers to interact with JavaScript-heavy web pages.

**PostgreSQL**  
The primary relational database for storing lead records, scrape history, and outreach logs.

**PWA (Progressive Web App)**  
A web application that can be installed on mobile devices and works offline. The dashboard is a PWA.

---

## R

**Rate Limiting**  
Controlling the speed of scraping requests to avoid overloading target websites and getting blocked.

**Redis**  
An in-memory data store used for the task queue (BullMQ) and caching.

**robots.txt**  
A standard file that websites use to indicate which pages scrapers are allowed to crawl.

---

## S

**Scraper**  
An automated agent that extracts lead data from web sources (Google Maps, Bing, Yelp, etc.).

**Scoring Model**  
The algorithm that calculates a 0–100 quality score for each lead. See [ARCHITECTURE.md](./ARCHITECTURE.md).

**Self-Review**  
An automated analysis of the repository state that produces recommendations and GitHub issues. See `docs/SELF_REVIEW.md`.

**SOP (Standard Operating Procedure)**  
A documented process for performing routine operational tasks. See [SOP.md](./SOP.md).

**SQLite**  
A file-based relational database used as a local fallback in development.

---

## T

**TAM (Total Addressable Market)**  
The total revenue opportunity for a product or service.

**Tier**  
Lead quality classification: HOT (≥75), WARM (50–74), COLD (<50).

---

## W

**WARM Lead**  
A lead with a quality score between 50 and 74. Good candidate for outreach with some additional qualification.

**Workflow**  
A GitHub Actions YAML file defining automated jobs that run on triggers (push, schedule, etc.).

---

_See also: [BLUEPRINT.md](./BLUEPRINT.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [SOP.md](./SOP.md)_
