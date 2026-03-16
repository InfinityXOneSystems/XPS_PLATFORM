# GitHub ↔ Docker Bidirectional Sync

> XPS Intelligence — TAP Governance | Auto-integration guide

## Overview

This document describes the full bidirectional sync architecture between the
GitHub repository and any Docker environment running XPS Intelligence.

```
GitHub ──push──► GitHub Actions ──webhook──► Docker Webhook Receiver
                                              │
                                              ▼
                                   docker-webhook-handler.sh
                                              │
                                    ┌─────────┴──────────┐
                                    │  git pull + rebuild  │
                                    └─────────┬──────────┘
                                              │
                                    report-to-github.js
                                              │
                                              ▼
                                    GitHub Deployments API
                                    GitHub Commit Status API
```

---

## Files Created

| File | Purpose |
|------|---------|
| `.github/apps/github-app-manifest.json` | GitHub App definition (permissions + events) |
| `docker/webhook-receiver/index.js` | Express-less Node.js HTTP webhook receiver |
| `docker/webhook-receiver/Dockerfile` | Container image for the webhook receiver |
| `docker/webhook-receiver/package.json` | Webhook receiver dependencies |
| `docker-compose.yml` | Multi-service orchestration (frontend + webhook receiver) |
| `scripts/docker-webhook-handler.sh` | Git pull + conditional rebuild + rollback |
| `scripts/report-to-github.js` | Report build/deploy results to GitHub APIs |
| `.github/workflows/docker-sync.yml` | GitHub Actions workflow for push events |
| `src/lib/github-integration.ts` | Frontend TypeScript GitHub API client |

---

## Direction 1: GitHub → Docker (Code Propagates)

### Flow

1. Developer pushes to `main`, `master`, or `develop`
2. `.github/workflows/docker-sync.yml` triggers
3. The workflow signs a synthetic push payload with the `GITHUB_WEBHOOK_SECRET`
   and POSTs it to `$DOCKER_WEBHOOK_URL/webhook`
4. The Docker webhook receiver (`docker/webhook-receiver/index.js`) verifies the
   HMAC-SHA256 signature and processes the event
5. `scripts/docker-webhook-handler.sh` runs:
   - `git fetch && git reset --hard origin/<branch>`
   - Conditional `npm ci` (only if `package.json` or `package-lock.json` changed)
   - `npm run build`
   - Rollback to previous commit on failure
6. `scripts/report-to-github.js` posts `deployment_status` and `commit_status`
   back to GitHub

### Environment Variables Required

| Variable | Where | Description |
|----------|-------|-------------|
| `DOCKER_WEBHOOK_URL` | GitHub Actions variable | Public URL of the webhook receiver (e.g. `https://your-server:3001`) |
| `GITHUB_WEBHOOK_SECRET` | GitHub Actions secret + Docker env | HMAC secret shared between GitHub and Docker |
| `GITHUB_TOKEN` | Docker env | PAT or App token with `deployments:write`, `statuses:write` |
| `GITHUB_REPO_OWNER` | Docker env | Repository owner (e.g. `InfinityXOneSystems`) |
| `GITHUB_REPO_NAME` | Docker env | Repository name (e.g. `XPS-INTELLIGENCE-FRONTEND`) |

---

## Direction 2: Docker → GitHub (Telemetry & State)

The `scripts/report-to-github.js` script posts:

- **Commit status** (`/repos/:owner/:repo/statuses/:sha`) — shows ✅/❌ on commit
- **Deployment record** (`/repos/:owner/:repo/deployments`) — tracks env lifecycle
- **Deployment status** — `pending → in_progress → success|failure`
- **Issue creation** — automatic crash report issue when container fails

### Calling the reporter directly

```bash
# Mark a commit as successful
GITHUB_TOKEN=ghp_... GITHUB_REPO_OWNER=InfinityXOneSystems GITHUB_REPO_NAME=XPS-INTELLIGENCE-FRONTEND \
  GIT_SHA=abc123 node scripts/report-to-github.js commit_status success

# Create a deployment and mark it successful
node scripts/report-to-github.js deployment_status success abc123sha

# Open a crash report issue
node scripts/report-to-github.js open_issue error abc123sha
```

---

## Running with Docker Compose

```bash
# 1. Copy and populate environment
cp .env.production .env
# Edit .env and add:
#   GITHUB_WEBHOOK_SECRET=<random 32+ char secret>
#   GITHUB_APP_ID=<your app id>
#   GITHUB_APP_PRIVATE_KEY=<PEM key>
#   GITHUB_REPO_OWNER=InfinityXOneSystems
#   GITHUB_REPO_NAME=XPS-INTELLIGENCE-FRONTEND

# 2. Start all services
docker compose up --build -d

# 3. Verify webhook receiver health
curl http://localhost:3001/health
# → {"status":"ok","service":"xps-webhook-receiver"}

# 4. Register the webhook in GitHub
# Settings → Webhooks → Add webhook
#   Payload URL: http://<your-server>:3001/webhook
#   Content type: application/json
#   Secret: <same as GITHUB_WEBHOOK_SECRET>
#   Events: push, workflow_run, deployment_status
```

---

## Frontend Integration

The `src/lib/github-integration.ts` TypeScript client can be used in any React
component to display sync status:

```typescript
import { createGitHubIntegration } from '@/lib/github-integration'

const gh = createGitHubIntegration(
  import.meta.env.VITE_GITHUB_TOKEN,
  'InfinityXOneSystems',
  'XPS-INTELLIGENCE-FRONTEND',
  'http://localhost:3001',
)

// Get combined sync status for dashboard display
const status = await gh.getSyncStatus()
console.log(status.deploymentState) // 'success' | 'failure' | 'pending' | null
console.log(status.webhookReachable) // true | false
```

---

## Security

| Measure | Implementation |
|---------|---------------|
| HMAC-SHA256 verification | Every webhook validated via `X-Hub-Signature-256` header |
| Rate limiting | 30 requests/minute per IP (sliding window) |
| Payload size cap | 25 MB maximum (GitHub limit) |
| Idempotency | Delivery IDs tracked to prevent duplicate processing |
| Non-root container | Webhook receiver runs as `webhook` user |
| Secrets never logged | Token values are not included in any log output |
| Minimum permissions | GitHub App scoped to `contents`, `deployments`, `checks`, `statuses` only |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `401` from webhook receiver | Wrong `GITHUB_WEBHOOK_SECRET` | Verify secret matches in both GitHub and Docker |
| `429` from webhook receiver | Too many events | Wait 60 seconds; check for replay loops |
| Push not triggering rebuild | `DOCKER_WEBHOOK_URL` not set | Set the variable in GitHub Actions → Variables |
| Commit status not updating | Missing `GITHUB_TOKEN` | Add token with `statuses:write` scope |
| Build rollback triggered | Compile error in new code | Fix the error and push again |
