# API Integration Guide

## Base Configuration

Set `VITE_API_URL` in your `.env` file:
```
VITE_API_URL=http://localhost:3000/api
```

## Authentication
The API client uses JWT Bearer tokens. Set via `api.setToken(token)`.

## Available Services

### Contractors API
- `GET /contractors/list` — List with filters
- `POST /contractors/create` — Create contractor
- `PUT /contractors/:id` — Update contractor
- `DELETE /contractors/:id` — Delete contractor

### Scraping API
- `POST /scraping/start` — Start scrape job
- `POST /scraping/:id/stop` — Stop job
- `GET /scraping/:id/status` — Job status
- `GET /scraping/:id/results` — Job results

### Agent Orchestration API
- `POST /orchestrator/execute-command` — Execute agent command
- `POST /orchestrator/execute-parallel` — Parallel execution
- `GET /orchestrator/status/:id` — Task status

### Automation API
- `GET /automation/workflows/list` — List workflows
- `POST /automation/workflows/create` — Create workflow
- `POST /automation/workflows/:id/execute` — Run workflow

### Vault API
- `GET /vault/tokens/list` — List tokens
- `POST /vault/tokens/add` — Add token
- `POST /vault/tokens/:id/test` — Test token

## Error Handling
All API methods throw on HTTP errors. Components handle errors gracefully with fallback to empty/demo state when backend is not connected.
