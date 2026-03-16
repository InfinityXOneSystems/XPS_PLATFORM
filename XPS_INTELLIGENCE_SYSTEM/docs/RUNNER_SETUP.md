# Self-Hosted Runner Setup Guide

GitHub provides **GitHub-hosted runners** (Ubuntu, Windows, macOS) at no extra cost for public repos.
This guide also explains how to add a self-hosted runner for private infrastructure.

---

## Option 1 — GitHub-Hosted Runners (Recommended)

All workflows in this repository are already configured to use `runs-on: ubuntu-latest`, which maps to
GitHub's hosted Ubuntu runners.  No extra setup required.

Capabilities available on GitHub-hosted runners:
- Node.js, Python, Docker pre-installed
- 2-core CPU, 7 GB RAM, 14 GB SSD
- Playwright / Chromium supported via `npx playwright install`
- 6 hours max job duration

---

## Option 2 — Self-Hosted Runner (On-Premise / Cloud VM)

### Prerequisites
- A Linux/macOS/Windows machine with internet access
- Node.js 20+, Python 3.11+, Docker (optional)
- GitHub repo access (Personal Access Token or GitHub App)

### Setup Steps

1. **Go to repo Settings → Actions → Runners → New self-hosted runner**

2. **Follow the GitHub-generated commands** (they include your unique token):
   ```bash
   # Download
   mkdir actions-runner && cd actions-runner
   curl -o actions-runner-linux-x64-2.317.0.tar.gz -L \
     https://github.com/actions/runner/releases/download/v2.317.0/actions-runner-linux-x64-2.317.0.tar.gz
   tar xzf ./actions-runner-linux-x64-2.317.0.tar.gz

   # Configure (token is shown in GitHub Settings UI)
   ./config.sh --url https://github.com/InfinityXOneSystems/LEAD_GEN_INTELLIGENCE \
               --token YOUR_TOKEN_FROM_GITHUB

   # Install as a service
   sudo ./svc.sh install
   sudo ./svc.sh start
   ```

3. **Install Playwright dependencies** on the runner:
   ```bash
   npx playwright install --with-deps chromium
   ```

4. **To use the self-hosted runner** in a workflow, change `runs-on`:
   ```yaml
   runs-on: self-hosted
   # or with labels:
   runs-on: [self-hosted, linux, x64]
   ```

### Security Notes
- Self-hosted runners have access to your system — only use on private or trusted repos.
- Use ephemeral runners (JIT tokens) for better isolation.
- Consider running the runner inside Docker for sandbox isolation.

---

## Docker-based Self-Hosted Runner

```bash
docker run -d \
  -e REPO_URL=https://github.com/InfinityXOneSystems/LEAD_GEN_INTELLIGENCE \
  -e RUNNER_TOKEN=YOUR_TOKEN \
  -e RUNNER_NAME=docker-runner-1 \
  myoung34/github-runner:latest
```

---

## Related Workflows

| Workflow | Trigger | Description |
|---|---|---|
| `runner_health.yml` | Every 30 min | Validates runner health and module syntax |
| `headless_agent.yml` | Push / cron | Tests headless agent on GitHub runner |
| `social_scraper.yml` | Daily / manual | Runs social scraper on GitHub runner |
| `infinity_orchestrator.yml` | Dispatch / comment | Runs pipeline stages on GitHub runner |
