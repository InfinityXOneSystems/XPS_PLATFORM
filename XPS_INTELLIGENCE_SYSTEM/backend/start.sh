#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# start.sh — XPS Intelligence Backend Startup Orchestration
#
# Responsibilities:
#   1. Wait until PostgreSQL is ready (no race conditions)
#   2. Run Alembic database migrations
#   3. Start Uvicorn (FastAPI)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PORT="${PORT:-8000}"
MAX_RETRIES=30
RETRY_INTERVAL=2

echo "[start.sh] XPS Intelligence Backend — starting up"
echo "[start.sh] PORT=${PORT}"

# ── 1. Wait for PostgreSQL ────────────────────────────────────────────────────
if [ -n "${DATABASE_URL:-}" ]; then
  echo "[start.sh] Waiting for PostgreSQL to be ready..."
  ATTEMPT=0
  until python -c "
import sys, os
try:
    import psycopg2
    conn = psycopg2.connect(os.environ['DATABASE_URL'], connect_timeout=3)
    conn.close()
    sys.exit(0)
except Exception as e:
    print(f'  Not ready: {e}', file=sys.stderr)
    sys.exit(1)
" 2>&1; do
    ATTEMPT=$((ATTEMPT + 1))
    if [ "$ATTEMPT" -ge "$MAX_RETRIES" ]; then
      echo "[start.sh] ERROR: PostgreSQL did not become ready after ${MAX_RETRIES} attempts. Aborting."
      exit 1
    fi
    echo "[start.sh] PostgreSQL not ready (attempt ${ATTEMPT}/${MAX_RETRIES}) — retrying in ${RETRY_INTERVAL}s..."
    sleep "$RETRY_INTERVAL"
  done
  echo "[start.sh] PostgreSQL is ready."
else
  echo "[start.sh] WARNING: DATABASE_URL not set — skipping PostgreSQL readiness check."
fi

# ── 2. Run Alembic migrations ─────────────────────────────────────────────────
echo "[start.sh] Running database migrations..."
ALEMBIC_EXIT=0
alembic upgrade head 2>&1 || ALEMBIC_EXIT=$?

if [ "$ALEMBIC_EXIT" -eq 0 ]; then
  echo "[start.sh] Migrations complete."
elif [ "${SKIP_MIGRATIONS_ON_ERROR:-false}" = "true" ]; then
  echo "[start.sh] WARNING: Migrations failed (exit ${ALEMBIC_EXIT}) — SKIP_MIGRATIONS_ON_ERROR=true, continuing."
else
  echo "[start.sh] ERROR: Migrations failed (exit ${ALEMBIC_EXIT}). Aborting startup."
  echo "[start.sh]        Set SKIP_MIGRATIONS_ON_ERROR=true to bypass this check."
  exit "$ALEMBIC_EXIT"
fi

# ── 3. Start Uvicorn ──────────────────────────────────────────────────────────
echo "[start.sh] Starting Uvicorn on port ${PORT}..."
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT}" \
  --workers "${UVICORN_WORKERS:-1}" \
  --log-level "${LOG_LEVEL:-info}"
