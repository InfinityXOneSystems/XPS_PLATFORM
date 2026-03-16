# queue/

Task queue architecture directory.

The production implementation lives in `backend/app/queue/`.

## Modules

- `redis_queue.py` — Redis-backed FIFO queue with in-memory fallback
- `queue_manager.py` — Named queue registry and distribution
- `task_state_store.py` — Persistent task state (Redis / in-memory)
