# Security Architecture

## Overview

XPS Intelligence security is built around four pillars:

1. **Container Isolation** — All agent code runs in isolated containers
2. **Credential Vault** — Secrets managed via environment variables
3. **Audit Logs** — Every tool call and agent action is logged
4. **Rate Limiting** — API endpoints are rate-limited to prevent abuse

---

## Container Isolation

### Sandbox Execution

All agent-generated code executes inside the `SandboxExecutor` which:

- Runs code in a subprocess with a clean environment
- Strips all host credentials from the process environment
- Enforces a hard timeout (default: 30s)
- Prevents dangerous imports via static analysis

```python
from sandbox.sandbox_executor import SandboxExecutor

executor = SandboxExecutor(timeout_s=10)
result = executor.run_python("print('hello')")
```

### Docker Network Isolation

| Network | Services | External Access |
|---------|----------|----------------|
| `xps_net` | Backend, Gateway, Redis, Postgres | Through gateway only |
| `scrape_net` | Scraper workers | Internal only (via proxy) |
| `sandbox_net` | Sandbox executor | None |
| `monitor_net` | Prometheus, Grafana | Restricted |

---

## Credential Management

### Environment Variables

Never hardcode credentials. Use environment variables:

```bash
# Required
SECRET_KEY=<random-32-char-string>
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Optional
OPENAI_API_KEY=sk-...
SMTP_HOST=smtp.example.com
SMTP_USER=...
SMTP_PASS=...
```

### Secrets in Production

For Railway, Vercel, or Docker Swarm, use their native secret management:

- Railway: Project Settings → Variables
- Vercel: Project Settings → Environment Variables
- Docker: `docker secret create`

---

## Audit Logs

All tool calls through the MCP Gateway are logged to the audit log:

```python
from infrastructure.mcp.gateway.mcp_gateway import MCPGateway

gateway = MCPGateway()
audit = gateway.get_audit_log(limit=100)
```

Agent actions emit events via the event bus:

```python
from agents.base_agent import subscribe

def on_agent_event(event):
    print(f"Agent event: {event}")

subscribe("objective_set", on_agent_event)
```

---

## Rate Limiting

The Express gateway implements rate limiting per IP:

```javascript
// api/gateway.js
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                   // limit each IP to 100 requests per window
});
app.use('/api/', limiter);
```

---

## Security Checklist

Before deploying to production:

- [ ] `SECRET_KEY` is a cryptographically random 32+ character string
- [ ] Database credentials are not default values
- [ ] `DEBUG=false` in production
- [ ] CORS origin is set to specific domains (not `*`)
- [ ] Rate limiting is enabled
- [ ] Sandbox timeout is set to ≤ 30s
- [ ] Docker containers run as non-root user
- [ ] `no-new-privileges` security option is set on containers
- [ ] Cloudflare Tunnel is used (not direct port exposure)
- [ ] All secrets are in environment variables, not in code

---

## Vulnerability Reporting

If you discover a security vulnerability, please open a GitHub issue marked
**[SECURITY]** and the maintainers will respond within 48 hours.
