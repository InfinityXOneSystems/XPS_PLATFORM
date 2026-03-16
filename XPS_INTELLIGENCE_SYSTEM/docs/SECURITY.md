# Security Policy — XPS Lead Intelligence Platform

> **Last updated:** _auto-updated by evolve_docs.js_

---

## Supported Versions

| Version | Supported |
|---|---|
| Current `main` branch | ✅ |
| Feature branches | Partial |

---

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not open a public GitHub issue**.

Instead, email: `security@infinityxonesystems.com` (or open a private security advisory via GitHub).

We will respond within 48 hours.

---

## Threat Model

### Assets at Risk

| Asset | Sensitivity | Notes |
|---|---|---|
| Lead database (PII) | HIGH | Company names, phone, email, address |
| SMTP credentials | CRITICAL | Could be used to send spam |
| Database credentials | CRITICAL | Full data access |
| GitHub token | HIGH | Repository write access |
| Scraped contact data | MEDIUM | Public data, but aggregated |

### Threat Actors

| Actor | Likelihood | Impact |
|---|---|---|
| Credential theft (secrets in repo) | Medium | Critical |
| Supply chain attack (npm) | Low | High |
| Scraper detection / IP ban | Medium | Medium |
| Data exfiltration via exposed API | Low | High |
| Spam/abuse of email system | Medium | Medium |

### Attack Vectors

1. **Secrets committed to repository** — Most common risk. Mitigated by `.gitignore` and GitHub secret scanning.
2. **Vulnerable dependencies** — Mitigated by `npm audit` and Dependabot.
3. **API endpoint abuse** — GPT Actions server exposed without authentication.
4. **Data scraping of our own system** — Dashboard exposes scored leads publicly.

---

## Secrets Handling

### Rules

1. **Never commit secrets** to the repository (API keys, passwords, tokens)
2. Use **GitHub Actions Secrets** for all CI/CD credentials
3. Use **`.env` file** locally (`.env` is in `.gitignore`)
4. **Rotate secrets immediately** if exposed
5. Use **environment-specific secrets** (dev/staging/prod separation)

### Required Secrets (GitHub Actions)

| Secret Name | Purpose | Required For |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Scraper, scoring |
| `SMTP_HOST` | Email server host | Outreach |
| `SMTP_USER` | Email username | Outreach |
| `SMTP_PASS` | Email password | Outreach |
| `OPENAI_API_KEY` | AI enrichment | Optional |
| `GITHUB_TOKEN` | Auto-provided by Actions | Docs workflow, issue creation |

### .env Template

See `.env.example` for the full list of environment variables.

---

## Database Security

- SSL enforced by default (`rejectUnauthorized: true`)
- Override via `DATABASE_SSL_REJECT_UNAUTHORIZED=false` only for local dev
- Connection pool limited to prevent resource exhaustion
- Parameterized queries used throughout (no raw string interpolation)

---

## API Security

The GPT Actions server (`agents/gpt_actions/server.js`) should:

- Run behind a reverse proxy (nginx) in production
- Use HTTPS in production
- Implement rate limiting
- Validate all input parameters
- Log all requests for audit

> ⚠️ **Current Status:** API runs without authentication in development mode. Authentication must be added before any production deployment.

---

## Scraper Ethics & Legal

- All scraping targets **publicly available** business listing data
- Scrapers respect rate limits to avoid overloading target servers
- No scraping of private, login-protected, or personally sensitive pages
- Compliance with target site Terms of Service is the responsibility of the operator
- No scraping of EU resident personal data without appropriate GDPR compliance

---

## Data Retention

| Data Type | Retention | Notes |
|---|---|---|
| Scored leads | 90 days rolling | Archive older data |
| Outreach log | 1 year | Regulatory record |
| Scraper progress | 30 days | Operational only |
| Raw scraped data | 7 days | Derive scored leads, then discard |

---

## Permissions Model

### GitHub Repository

| Role | Permissions |
|---|---|
| Owner | Full access |
| Maintainer | Write + merge PRs |
| Contributor | Fork + PR only |
| `GITHUB_TOKEN` (Actions) | Write to repo, create issues |

### Database

| Role | Permissions |
|---|---|
| App user | SELECT, INSERT, UPDATE on `leads`, `outreach_log` |
| Admin | Full DDL access |
| Backup user | SELECT only |

---

## Dependency Security

Run regularly:

```bash
npm audit
npm audit fix
```

Review critical and high severity alerts before each release.

---

## Incident Response

See [OPERATIONS.md](./OPERATIONS.md) for full incident response runbook.

**Quick reference:**
1. Detect → Alert via GitHub issue labeled `incident`
2. Contain → Revoke credentials, disable workflows
3. Eradicate → Patch vulnerability, rotate secrets
4. Recover → Re-enable with new credentials
5. Post-mortem → Document in [DECISIONS.md](./DECISIONS.md)

---

_See also: [DATA_GOVERNANCE.md](./DATA_GOVERNANCE.md) · [OPERATIONS.md](./OPERATIONS.md) · [SOP.md](./SOP.md)_
