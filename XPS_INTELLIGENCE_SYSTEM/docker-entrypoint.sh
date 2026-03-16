#!/usr/bin/env sh
# docker-entrypoint.sh — Backend startup script for Railway / Docker
# Runs Alembic migrations then starts the uvicorn server.
# Called by CMD in Dockerfile.backend and by startCommand in railway.json.

set -e

PORT="${PORT:-8000}"

echo "[entrypoint] Running database migrations..."
if ! alembic upgrade head; then
  echo "[entrypoint] ERROR: Alembic migrations failed — aborting startup." >&2
  exit 1
fi
echo "[entrypoint] Migrations complete. Starting uvicorn on port $PORT..."

exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
