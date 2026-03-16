# Vercel Deployment Setup

Connect the Vercel frontend (`xps-intelligence.vercel.app`) to the Railway backend (`xpsintelligencesystem-production.up.railway.app`).

---

## Prerequisites

| Requirement | Value |
|-------------|-------|
| Backend URL | `https://xpsintelligencesystem-production.up.railway.app` |
| Frontend URL | `https://xps-intelligence.vercel.app` |
| Vercel project | `xps-intelligence` |
| Railway project | `xpsintelligencesystem-production` |

---

## Step 1 – Set Environment Variables in Vercel

Vercel does **not** read `.env.production` files automatically. You must add variables through the dashboard.

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard) and open your **xps-intelligence** project.
2. Click **Settings → Environment Variables**.
3. Add each variable below (set Environment to **Production**, **Preview**, and **Development**):

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://xpsintelligencesystem-production.up.railway.app` |
| `VITE_BACKEND_URL` | `https://xpsintelligencesystem-production.up.railway.app` |
| `VITE_API_BASE_URL` | `https://xpsintelligencesystem-production.up.railway.app` |

> **Why three variables?** Different parts of the frontend reference different variable names.
> Set all three to the same Railway URL to cover every case.

4. Click **Save** after adding each variable.

---

## Step 2 – Verify Railway CORS Configuration

The Railway backend must allow requests from your Vercel domains.  
In the Railway dashboard → **Project → Variables**, confirm these values are set:

```
CORS_ALLOWED_ORIGINS=https://xps-intelligence.vercel.app,https://xps-intelligence-*.vercel.app,http://localhost:3000
FRONTEND_URL=https://xps-intelligence.vercel.app
NODE_ENV=production
```

These are already in `.env.railway.template` in this repository.  
If Railway was deployed before these were added, update the variables in the Railway dashboard and Railway will restart automatically.

---

## Step 3 – Redeploy the Frontend

After saving environment variables in Vercel, trigger a new deployment:

- **Option A** – Push any commit to the connected branch (Vercel auto-deploys).
- **Option B** – Go to **Deployments** → click the latest deployment → **Redeploy**.

> Vercel only injects environment variables at build time. A redeploy is required after any variable change.

---

## Step 4 – Test the Connection

### Quick browser test

Open `https://xps-intelligence.vercel.app`, press **F12** to open DevTools, go to the **Console** tab, and run:

```js
fetch('https://xpsintelligencesystem-production.up.railway.app/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

Expected response:

```json
{ "status": "OK", "timestamp": "2026-03-10T..." }
```

### Test the runtime API

```js
fetch('https://xpsintelligencesystem-production.up.railway.app/api/v1/runtime/command', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ command: 'status', priority: 5 })
})
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

Expected response:

```json
{
  "task_id": "...",
  "status": "queued",
  "command_type": "...",
  "agent": "...",
  "message": "Task queued successfully",
  "params": {}
}
```

### Test from the command line

```bash
# Health check
curl https://xpsintelligencesystem-production.up.railway.app/health

# CORS preflight (replace with your Vercel domain)
curl -I -X OPTIONS \
  -H "Origin: https://xps-intelligence.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  https://xpsintelligencesystem-production.up.railway.app/api/v1/runtime/command
# Access-Control-Allow-Origin header should be present in the response
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `TypeError: Failed to fetch` | Backend is down or wrong URL | Check `VITE_API_URL` value; restart Railway service |
| `CORS policy` error in console | Vercel domain not in `CORS_ALLOWED_ORIGINS` | Update Railway variable and redeploy backend |
| `404 /health` | Backend not running or wrong base URL | Verify Railway service is deployed and `PORT` is correct |
| Variables not taking effect | Vercel hasn't redeployed since variables were saved | Trigger a new deployment in Vercel dashboard |
| `401 Unauthorized` | Auth header missing | Ensure `VITE_API_URL` does not have a trailing `/api` path |

---

## File Reference

```
XPS_INTELLIGENCE_SYSTEM/                    ← this repo (Railway backend)
├── .env.railway.template                   ← copy values to Railway dashboard
├── api/gateway.js                          ← CORS middleware (isCorsAllowed)
├── backend/app/main.py                     ← FastAPI app with CORS middleware
└── VERCEL_DEPLOYMENT_SETUP.md              ← this file

XPS-INTELLIGENCE-FRONTEND/                 ← separate repo (Vercel frontend)
├── .env.production                         ← local reference only; Vercel ignores this
└── .env.example                            ← documents all required variables
```

---

*Last updated: 2026-03-10 — URLs: Railway `xpsintelligencesystem-production.up.railway.app` · Vercel `xps-intelligence.vercel.app`*
