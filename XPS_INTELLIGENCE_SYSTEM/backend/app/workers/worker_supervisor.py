"""
app/workers/worker_supervisor.py
==================================
Supervises a pool of WorkerNodes, handling restarts on failure.
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Any, Dict, List

from app.workers.worker_node import WorkerNode

logger = logging.getLogger(__name__)


class WorkerSupervisor:
    """
    Manages a pool of WorkerNode instances.

    Monitors worker health and restarts failed workers automatically.
    """

    def __init__(self, num_workers: int = 2, poll_interval: float = 5.0):
        self.num_workers = num_workers
        self._poll_interval = poll_interval
        self._workers: List[WorkerNode] = []
        self._running = False
        self._monitor_thread: threading.Thread | None = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        """Start the worker pool and supervision loop."""
        self._running = True
        for _ in range(self.num_workers):
            worker = WorkerNode()
            worker.start()
            self._workers.append(worker)

        self._monitor_thread = threading.Thread(
            target=self._monitor_loop,
            name="worker-supervisor",
            daemon=True,
        )
        self._monitor_thread.start()
        logger.info(
            "worker_supervisor_started", extra={"num_workers": self.num_workers}
        )

    def stop(self) -> None:
        """Gracefully stop all workers."""
        self._running = False
        for worker in self._workers:
            worker.stop()
        logger.info("worker_supervisor_stopped")

    # ------------------------------------------------------------------
    # Health monitoring
    # ------------------------------------------------------------------

    def _monitor_loop(self) -> None:
        while self._running:
            self._check_workers()
            time.sleep(self._poll_interval)

    def _check_workers(self) -> None:
        for i, worker in enumerate(self._workers):
            if not worker.is_alive():
                logger.warning(
                    "worker_supervisor_restart",
                    extra={"worker_id": worker.worker_id, "index": i},
                )
                new_worker = WorkerNode()
                new_worker.start()
                self._workers[i] = new_worker

    def status(self) -> Dict[str, Any]:
        """Return health status of the worker pool."""
        return {
            "total": len(self._workers),
            "alive": sum(1 for w in self._workers if w.is_alive()),
            "workers": [
                {"worker_id": w.worker_id, "alive": w.is_alive()} for w in self._workers
            ],
        }


# Shared singleton — not started automatically; call .start() explicitly.
_supervisor = WorkerSupervisor()


def get_supervisor() -> WorkerSupervisor:
    """Return the shared WorkerSupervisor instance."""
    return _supervisor
