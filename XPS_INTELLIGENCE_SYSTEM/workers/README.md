# workers/

Worker runtime architecture directory.

The production implementation lives in `backend/app/workers/`.

## Modules

- `worker_runtime.py` — Top-level runtime start/stop
- `worker_node.py` — Individual task-processing worker
- `worker_supervisor.py` — Worker pool supervisor with auto-restart
