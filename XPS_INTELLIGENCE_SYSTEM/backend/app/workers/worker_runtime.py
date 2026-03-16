"""
app/workers/worker_runtime.py
==============================
Top-level entry point for starting and stopping the worker runtime.
"""

from __future__ import annotations

import logging
import os

from app.workers.worker_supervisor import WorkerSupervisor, get_supervisor

logger = logging.getLogger(__name__)

_NUM_WORKERS = int(os.environ.get("WORKER_COUNT", "2"))


def start_worker_runtime() -> WorkerSupervisor:
    """
    Start the worker runtime (supervisor + pool).

    This is called from application startup (lifespan hook) when
    the ENABLE_WORKERS environment variable is set.

    :returns: The running WorkerSupervisor instance.
    """
    supervisor = get_supervisor()
    supervisor.num_workers = _NUM_WORKERS
    supervisor.start()
    logger.info("worker_runtime_started", extra={"num_workers": _NUM_WORKERS})
    return supervisor


def stop_worker_runtime() -> None:
    """Stop the worker runtime gracefully."""
    get_supervisor().stop()
    logger.info("worker_runtime_stopped")


def worker_runtime_status() -> dict:
    """Return the current worker runtime status."""
    return get_supervisor().status()
