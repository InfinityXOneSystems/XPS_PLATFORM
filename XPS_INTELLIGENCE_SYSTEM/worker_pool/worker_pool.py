"""
worker_pool/worker_pool.py
============================
Distributed async worker pool for the XPS Intelligence Platform.

Features:
  - Configurable concurrency (min/max workers)
  - Priority queue (lower number = higher priority)
  - Task deduplication by idempotency key
  - Per-task timeout enforcement
  - Dead-letter queue (DLQ) for tasks that exhaust retries
  - Live metrics via observability module

Usage::

    from worker_pool import get_pool, Task

    pool = get_pool()
    await pool.start()

    task = Task(task_id="t1", fn=my_coroutine, args=(), kwargs={}, priority=1)
    result = await pool.submit(task)
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Coroutine, Dict, List, Optional

from observability import record_metric, start_span

logger = logging.getLogger("worker_pool")


# ---------------------------------------------------------------------------
# Task model
# ---------------------------------------------------------------------------


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    DEAD = "dead"           # exhausted all retries → DLQ


@dataclass
class Task:
    """A unit of work submitted to the worker pool."""

    fn: Callable[..., Coroutine[Any, Any, Any]]
    args: tuple = field(default_factory=tuple)
    kwargs: dict = field(default_factory=dict)
    task_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    priority: int = 5        # 1 = highest, 10 = lowest
    timeout: float = 60.0    # seconds
    max_retries: int = 2
    idempotency_key: Optional[str] = None
    tags: Dict[str, str] = field(default_factory=dict)

    # Runtime state (not set by caller)
    status: TaskStatus = TaskStatus.PENDING
    attempt: int = 0
    result: Any = None
    error: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    finished_at: Optional[float] = None

    def __lt__(self, other: "Task") -> bool:
        return self.priority < other.priority

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "status": self.status.value,
            "priority": self.priority,
            "attempt": self.attempt,
            "error": self.error,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
        }


# ---------------------------------------------------------------------------
# Worker pool config
# ---------------------------------------------------------------------------


@dataclass
class WorkerPoolConfig:
    min_workers: int = 2
    max_workers: int = 10
    queue_size: int = 500
    default_timeout: float = 60.0
    default_max_retries: int = 2
    scale_up_threshold: int = 5     # queue depth that triggers scale-up
    scale_down_idle_seconds: float = 30.0


# ---------------------------------------------------------------------------
# WorkerPool
# ---------------------------------------------------------------------------


class WorkerPool:
    """Async priority worker pool with auto-scaling."""

    def __init__(self, config: Optional[WorkerPoolConfig] = None) -> None:
        self._cfg = config or WorkerPoolConfig()
        self._queue: asyncio.PriorityQueue = asyncio.PriorityQueue(
            maxsize=self._cfg.queue_size
        )
        self._workers: List[asyncio.Task] = []
        self._running = False
        self._completed: Dict[str, Task] = {}   # task_id → Task
        self._dlq: List[Task] = []
        self._seen_keys: Dict[str, str] = {}    # idempotency_key → task_id
        self._active_count = 0

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        for _ in range(self._cfg.min_workers):
            await self._spawn_worker()
        asyncio.create_task(self._auto_scaler())
        logger.info(
            "WorkerPool started (%d workers, max=%d)",
            self._cfg.min_workers,
            self._cfg.max_workers,
        )

    async def stop(self, drain: bool = True) -> None:
        self._running = False
        if drain:
            await self._queue.join()
        for w in self._workers:
            w.cancel()
        self._workers.clear()
        logger.info("WorkerPool stopped")

    # ------------------------------------------------------------------
    # Submission
    # ------------------------------------------------------------------

    async def submit(self, task: Task) -> Task:
        """Enqueue *task* and return a reference to it."""
        # Deduplication
        if task.idempotency_key:
            existing_id = self._seen_keys.get(task.idempotency_key)
            if existing_id and existing_id in self._completed:
                logger.debug(
                    "WorkerPool: dedup hit for key='%s'", task.idempotency_key
                )
                return self._completed[existing_id]
            self._seen_keys[task.idempotency_key] = task.task_id

        await self._queue.put((task.priority, task))
        record_metric(
            "worker_pool.task.queued",
            tags={"priority": str(task.priority)},
        )
        logger.debug("WorkerPool: task %s queued (priority=%d)", task.task_id, task.priority)
        return task

    def submit_nowait(self, task: Task) -> Task:
        """Non-blocking submit — raises QueueFull if at capacity."""
        self._queue.put_nowait((task.priority, task))
        return task

    # ------------------------------------------------------------------
    # Workers
    # ------------------------------------------------------------------

    async def _spawn_worker(self) -> None:
        t = asyncio.create_task(self._worker_loop())
        self._workers.append(t)

    async def _worker_loop(self) -> None:
        idle_since = time.monotonic()
        while self._running:
            try:
                priority, task = await asyncio.wait_for(
                    self._queue.get(), timeout=1.0
                )
            except asyncio.TimeoutError:
                # Check if we should scale down
                idle_secs = time.monotonic() - idle_since
                if (
                    len(self._workers) > self._cfg.min_workers
                    and idle_secs >= self._cfg.scale_down_idle_seconds
                ):
                    logger.debug("WorkerPool: scaling down idle worker")
                    break
                continue

            idle_since = time.monotonic()
            self._active_count += 1
            record_metric("worker_pool.active", self._active_count, metric_type="gauge")

            try:
                await self._execute(task)
            finally:
                self._active_count -= 1
                record_metric("worker_pool.active", self._active_count, metric_type="gauge")
                self._queue.task_done()

    async def _execute(self, task: Task) -> None:
        task.status = TaskStatus.RUNNING
        task.started_at = time.time()
        task.attempt += 1
        operation = f"worker_pool.task.{task.tags.get('type', 'generic')}"

        with start_span(operation, tags={"task_id": task.task_id}) as span:
            try:
                result = await asyncio.wait_for(
                    task.fn(*task.args, **task.kwargs),
                    timeout=task.timeout,
                )
                task.status = TaskStatus.COMPLETED
                task.result = result
                task.finished_at = time.time()
                span.set_tag("result", "ok")
                record_metric("worker_pool.task.completed")
                logger.debug("WorkerPool: task %s completed", task.task_id)

            except asyncio.TimeoutError as exc:
                task.error = f"Timeout after {task.timeout}s"
                await self._handle_failure(task, exc, span)

            except Exception as exc:
                task.error = str(exc)
                await self._handle_failure(task, exc, span)

        self._completed[task.task_id] = task

    async def _handle_failure(self, task: Task, exc: Exception, span: Any) -> None:
        span.set_tag("error", str(exc))
        record_metric("worker_pool.task.failed")
        # max_retries = number of *extra* attempts after the first;
        # total attempts = max_retries + 1 (one initial + N retries)
        total_attempts = task.max_retries + 1
        logger.warning(
            "WorkerPool: task %s failed (attempt %d/%d): %s",
            task.task_id,
            task.attempt,
            total_attempts,
            exc,
        )
        if task.attempt < total_attempts:
            # Requeue with exponential back-off (capped at 30 s)
            delay = min(0.5 * (2 ** (task.attempt - 1)), 30.0)
            task.status = TaskStatus.PENDING
            task.error = None
            await asyncio.sleep(delay)
            await self._queue.put((task.priority, task))
        else:
            task.status = TaskStatus.DEAD
            task.finished_at = time.time()
            self._dlq.append(task)
            record_metric("worker_pool.task.dead_letter")
            logger.error("WorkerPool: task %s sent to DLQ", task.task_id)

    # ------------------------------------------------------------------
    # Auto-scaler
    # ------------------------------------------------------------------

    async def _auto_scaler(self) -> None:
        while self._running:
            await asyncio.sleep(2.0)
            depth = self._queue.qsize()
            if (
                depth >= self._cfg.scale_up_threshold
                and len(self._workers) < self._cfg.max_workers
            ):
                await self._spawn_worker()
                logger.info(
                    "WorkerPool: scaled up to %d workers (queue depth=%d)",
                    len(self._workers),
                    depth,
                )
                record_metric("worker_pool.scale_up")
            record_metric("worker_pool.queue_depth", depth, metric_type="gauge")

    # ------------------------------------------------------------------
    # Introspection
    # ------------------------------------------------------------------

    def stats(self) -> Dict[str, Any]:
        dead = len(self._dlq)
        completed = len([t for t in self._completed.values() if t.status == TaskStatus.COMPLETED])
        return {
            "workers": len(self._workers),
            "active": self._active_count,
            "queue_depth": self._queue.qsize(),
            "completed": completed,
            "dead_letter": dead,
        }

    @property
    def dlq(self) -> List[Task]:
        return list(self._dlq)


# ---------------------------------------------------------------------------
# Global singleton
# ---------------------------------------------------------------------------

_pool: Optional[WorkerPool] = None


def get_pool(config: Optional[WorkerPoolConfig] = None) -> WorkerPool:
    global _pool
    if _pool is None:
        _pool = WorkerPool(config)
    return _pool
