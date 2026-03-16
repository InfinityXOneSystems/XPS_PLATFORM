# runtime/

Top-level runtime architecture directory.

The production implementation lives in `backend/app/runtime/`.
This directory provides the architectural specification entry point.

## Modules

- `runtime_controller.py` — Central command orchestration
- `command_router.py` — Command-to-agent routing
- `command_schema.py` — Request/response Pydantic models
- `command_validator.py` — Input validation
- `task_dispatcher.py` — Task enqueue and dispatch
- `retry_policy.py` — Retry and back-off configuration
- `error_manager.py` — Centralised error handling

## Primary Endpoint

```
POST /runtime/command
```

See `backend/app/api/v1/runtime.py` for the FastAPI implementation.
