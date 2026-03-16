"""
app/api/v1/system.py
======================
System observability endpoints.

GET /system/health   — dependency health check
GET /system/metrics  — runtime metrics snapshot
GET /system/tasks    — list all tracked tasks
"""

from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter

from app.observability import metrics as metrics_store
from app.observability.system_health import get_health
from app.queue.queue_manager import get_queue_manager
from app.runtime.runtime_controller import get_runtime_controller
from app.workers.worker_runtime import worker_runtime_status

router = APIRouter(prefix="/system", tags=["system"])


@router.get(
    "/health",
    summary="System health check",
    description="Returns the health status of all platform dependencies.",
)
def system_health() -> Dict[str, Any]:
    return get_health()


@router.get(
    "/metrics",
    summary="Runtime metrics",
    description="Returns a snapshot of worker, queue, and agent metrics.",
)
def system_metrics() -> Dict[str, Any]:
    queue_sizes = get_queue_manager().queue_sizes()
    worker_status = worker_runtime_status()
    app_metrics = metrics_store.get_all()

    return {
        "workers": worker_status,
        "queue": {
            "queues": queue_sizes,
            "total": sum(queue_sizes.values()),
        },
        "application": app_metrics,
    }


@router.get(
    "/tasks",
    summary="List all tasks",
    description="Returns all tracked task states (debug / observability).",
)
def system_tasks() -> Dict[str, Any]:
    controller = get_runtime_controller()
    tasks = controller.list_tasks()
    return {
        "total": len(tasks),
        "tasks": tasks,
    }
