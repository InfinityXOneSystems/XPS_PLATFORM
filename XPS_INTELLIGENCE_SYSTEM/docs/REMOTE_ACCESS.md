# Remote Access Architecture

## Overview

XPS Intelligence supports remote access from the Vercel-hosted frontend to
local infrastructure without exposing router ports.

```
Vercel Frontend (xps-intelligence.vercel.app)
        │
        │ HTTPS API calls
        ▼
Cloudflare Tunnel (vizual-x.com)
        │
        │ Encrypted tunnel (no open ports)
        ▼
Local Machine
  ├── Express Gateway     :3200
  ├── FastAPI Backend     :8000
  ├── MCP Gateway         :4000
  └── Dashboard (dev)     :3000
```

## Cloudflare Tunnel Setup

### 1. Install cloudflared

```bash
# macOS
brew install cloudflare/cloudflare/cloudflared

# Linux
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
```

### 2. Authenticate

```bash
cloudflared tunnel login
```

### 3. Create tunnel

```bash
cloudflared tunnel create xps-intelligence
```

### 4. Configure tunnel

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: ~/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: api.vizual-x.com
    service: http://localhost:3200
  - hostname: backend.vizual-x.com
    service: http://localhost:8000
  - hostname: mcp.vizual-x.com
    service: http://localhost:4000
  - service: http_status:404
```

### 5. Run tunnel

```bash
cloudflared tunnel run xps-intelligence
```

### 6. Configure DNS (in Cloudflare dashboard)

Add CNAME records:
- `api.vizual-x.com` → `<TUNNEL_ID>.cfargotunnel.com`
- `backend.vizual-x.com` → `<TUNNEL_ID>.cfargotunnel.com`

---

## ngrok Alternative

For quick development/demo access:

```bash
# Install
npm install -g ngrok

# Start tunnel to Express gateway
ngrok http 3200

# Start tunnel to FastAPI backend
ngrok http 8000
```

Update `VITE_API_URL` in the frontend to the ngrok URL.

---

## Vercel Frontend Configuration

Set environment variables in Vercel dashboard:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://api.vizual-x.com` |
| `VITE_BACKEND_URL` | `https://backend.vizual-x.com` |
| `VITE_MCP_URL` | `https://mcp.vizual-x.com` |

---

## Railway Deployment (Production)

For production, deploy services to Railway:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy backend
cd backend && railway up

# Deploy gateway
railway up --service gateway
```

Railway automatically provisions:
- Redis (add Redis plugin)
- PostgreSQL (add PostgreSQL plugin)
- Custom domain with HTTPS

---

## Security Notes

1. **Never expose ports directly** — always use Cloudflare Tunnel or Railway
2. **Rotate credentials** — use Railway/Vercel secret management
3. **Monitor tunnel access** — Cloudflare dashboard shows all requests
4. **CORS** — gateway only allows requests from `xps-intelligence.vercel.app` in production
5. **Rate limiting** — implemented in Express gateway middleware
