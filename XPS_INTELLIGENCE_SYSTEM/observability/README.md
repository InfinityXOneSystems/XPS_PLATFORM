# observability/

Observability architecture directory.

The production implementation lives in `backend/app/observability/`.

## Modules

- `metrics.py` — In-process counter/gauge/histogram metrics
- `tracing.py` — Lightweight request tracing
- `agent_logs.py` — Structured agent activity logging
- `system_health.py` — Dependency health aggregation

## Endpoints

- `GET /system/health`
- `GET /system/metrics`
- `GET /system/tasks`
