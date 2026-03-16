# Changelog

All notable changes to XPS Intelligence System are documented here.

---

## [Unreleased]

### Root Causes Addressed

| Problem | Root Cause | Fix |
|---------|-----------|-----|
| `pytest: command not found` | `pytest` not listed in `requirements.txt` | Added `pytest>=8.0.0` and `pytest-asyncio>=0.23.0` |
| Node.js code untested in CI | `system_validation.yml` only ran Python jobs | Added dedicated `validate-node` job |
| Frontend blocked by CORS | CORS middleware did not support wildcard Vercel preview domains | Updated CORS helper to support `*` wildcard patterns |
| No root-level `/health` endpoint | Frontend/Railway health probes had no standard path | Added `GET /health` endpoint to `api/gateway.js` |
| CORS variables undocumented | `.env.railway.template` lacked Vercel-specific variables | Added `CORS_ALLOWED_ORIGINS` and `FRONTEND_URL` with correct values |

---

### Changed

#### `requirements.txt`
- Added `pytest>=8.0.0` — test runner required by CI (`validate-python` job).
- Added `pytest-asyncio>=0.23.0` — required for async test functions in the agent core.

#### `.github/workflows/system_validation.yml` (complete rewrite)
- **Triggers:** `push` on `main`, `develop`, `copilot/**` branches, and all pull requests.
- **`validate-python` job** — sets up Python 3.11 with pip cache, installs dependencies, runs `pytest`.  Gracefully skips when no tests are collected.
- **`validate-node` job** — sets up Node.js 20 with npm cache, runs `npm ci` then `npm test`.
- **`repo-guardian` job** — fans in on both validation jobs; checks critical repository paths exist and emits `[OK]`/`[WARN]`/`[ERROR]` log lines.

#### `api/gateway.js`
- Replaced simple CORS origin lookup with `isCorsAllowed()` helper that supports wildcard `*` patterns (e.g. `https://xps-intelligence-*.vercel.app` for Vercel preview deployments).
- Added `Access-Control-Allow-Credentials: true` header so the browser sends cookies/auth tokens cross-origin.
- Added `GET /health` — lightweight public endpoint returning `{ status: "OK", timestamp }`.  Used by Railway health probes, Vercel integration checks, and monitoring.
- Updated `GET /api/status` to include `service`, `version`, and `environment` fields matching the frontend's expected contract.

#### `.env.railway.template`
- Set `CORS_ALLOWED_ORIGINS` to `https://xps-intelligence.vercel.app,https://xps-intelligence-*.vercel.app,http://localhost:3000`.
- Added `FRONTEND_URL=https://xps-intelligence.vercel.app` for redirect/link generation.

---

### Deployment Instructions

#### Railway (backend)
1. In Railway Dashboard → Project → Variables, set:
   ```
   CORS_ALLOWED_ORIGINS=https://xps-intelligence.vercel.app,https://xps-intelligence-*.vercel.app,http://localhost:3000
   FRONTEND_URL=https://xps-intelligence.vercel.app
   NODE_ENV=production
   PORT=8000
   ```
2. Merge this PR — Railway auto-deploys from `main`.
3. Verify: `curl https://xpsintelligencesystem-production.up.railway.app/health` → `{"status":"OK",...}`.

#### Vercel (frontend)
1. In Vercel Dashboard → Project → Settings → Environment Variables, add:
   ```
   VITE_BACKEND_URL=https://xpsintelligencesystem-production.up.railway.app
   VITE_API_BASE_URL=https://xpsintelligencesystem-production.up.railway.app
   ```
2. Redeploy (or push to trigger auto-deploy).
3. Open DevTools Console and verify:
   ```js
   fetch('/api/status').then(r => r.json()).then(console.log)
   ```

---

### Self-Healing Properties

- CORS middleware falls back to `*` (allow all) when `CORS_ALLOWED_ORIGINS` is not set, so local development works without additional configuration.
- `validate-python` step exits with `0` when no tests are collected, preventing the job from blocking unrelated changes.
- `repo-guardian` emits `[WARN]` (not `[ERROR]`) for missing optional paths, so warnings don't fail the pipeline.
