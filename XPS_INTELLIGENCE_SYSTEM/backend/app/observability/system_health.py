"""
app/observability/system_health.py
====================================
Aggregates system health information for the /system/health endpoint.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict

from sqlalchemy import text

_START_TIME = datetime.now(timezone.utc)


def _check_redis() -> Dict[str, Any]:
    try:
        import redis

        url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        client = redis.from_url(url, socket_connect_timeout=1, socket_timeout=1)
        client.ping()
        return {"status": "ok"}
    except Exception as exc:
        return {"status": "unavailable", "error": str(exc)}


def _check_database() -> Dict[str, Any]:
    try:
        from app.database import engine

        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception as exc:
        return {"status": "unavailable", "error": str(exc)}


def _uptime_seconds() -> float:
    delta = datetime.now(timezone.utc) - _START_TIME
    return round(delta.total_seconds(), 1)


def get_health() -> Dict[str, Any]:
    """
    Return a health-check payload suitable for the /system/health endpoint.
    """
    redis_status = _check_redis()
    db_status = _check_database()

    all_ok = redis_status["status"] == "ok" and db_status["status"] == "ok"

    return {
        "status": "healthy" if all_ok else "degraded",
        "uptime_seconds": _uptime_seconds(),
        "started_at": _START_TIME.isoformat(),
        "dependencies": {
            "redis": redis_status,
            "database": db_status,
        },
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
