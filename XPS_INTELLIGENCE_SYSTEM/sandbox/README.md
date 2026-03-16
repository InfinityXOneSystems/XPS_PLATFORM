# Sandbox System — Headless REST API Agent

Provides an **isolated execution environment** for the Headless REST API Agent and related automation services.

## Services

| Service | Port | Description |
|---|---|---|
| `headless-node` | 3200 | Node.js Playwright headless agent |
| `headless-python` | 3201 | Python asyncio + pyppeteer headless agent |
| `infinity-orchestrator` | 3300 | GitHub App webhook handler |

## Quick Start

```bash
cd sandbox
cp ../.env.example .env   # configure secrets
docker compose up -d
```

## Sandbox Features

- **Network isolation** — services run on a private bridge network (`172.30.0.0/24`)
- **Resource limits** — per-container memory and CPU caps prevent runaway processes
- **Ad/tracker blocking** — `sandbox_manager.js` blocks known ad/analytics domains
- **Request logging** — all HTTP requests inside a sandbox are logged for audit
- **Mock routes** — inject fake responses for testing without hitting real servers
- **Idle cleanup** — sessions auto-close after 5 minutes of inactivity (configurable)
- **Graceful shutdown** — `SIGTERM`/`SIGINT` cleanly closes all browser contexts

## Programmatic Usage

```js
const sandbox = require('./sandbox/sandbox_manager');

const { sandboxId, page } = await sandbox.createSandbox({ blockAds: true });
await page.goto('https://example.com');
const log = sandbox.getSandboxLog(sandboxId);
await sandbox.destroySandbox(sandboxId);
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `HEADLESS_PORT` | 3200 | Node headless agent port |
| `HEADLESS_PYTHON_PORT` | 3201 | Python agent port |
| `ORCHESTRATOR_PORT` | 3300 | Infinity Orchestrator port |
| `HEADLESS_MAX_SESSIONS` | 10 | Max concurrent browser sessions |
| `HEADLESS_IDLE_TIMEOUT_MS` | 300000 | Auto-close idle sessions (ms) |
| `SANDBOX_TIMEOUT_MS` | 600000 | Max sandbox lifetime (ms) |
| `HEADLESS_API_KEY` | _(empty)_ | Optional bearer token |
| `GITHUB_WEBHOOK_SECRET` | _(empty)_ | GitHub App HMAC secret |
