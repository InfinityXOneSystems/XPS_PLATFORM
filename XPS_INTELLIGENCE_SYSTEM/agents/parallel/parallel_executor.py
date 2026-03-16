"""
agents/parallel/parallel_executor.py
=====================================
Parallel execution engine for running multiple agents concurrently
with advanced task scheduling, load balancing, and resource management.

This executor exceeds baseline performance by:
- Dynamic task prioritization
- Intelligent workload distribution
- Adaptive concurrency limits
- Real-time progress tracking
- Fault isolation and recovery
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


class TaskPriority(Enum):
    """Task priority levels."""
    CRITICAL = 0
    HIGH = 1
    NORMAL = 2
    LOW = 3


class TaskStatus(Enum):
    """Task execution status."""
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class Task:
    """Represents a single executable task."""
    task_id: str
    name: str
    func: Callable
    args: tuple = field(default_factory=tuple)
    kwargs: dict = field(default_factory=dict)
    priority: TaskPriority = TaskPriority.NORMAL
    timeout: Optional[float] = None
    retries: int = 0
    max_retries: int = 2
    status: TaskStatus = TaskStatus.PENDING
    result: Any = None
    error: Optional[str] = None
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    dependencies: list[str] = field(default_factory=list)

    @property
    def duration(self) -> Optional[float]:
        """Calculate task duration."""
        if self.start_time and self.end_time:
            return self.end_time - self.start_time
        return None


class ParallelExecutor:
    """
    Advanced parallel execution engine with dynamic scheduling and load balancing.

    Example::

        executor = ParallelExecutor(max_workers=10, max_concurrent=5)

        # Add tasks
        task1 = executor.add_task("scrape_1", scrape_func, args=("epoxy", "ohio"))
        task2 = executor.add_task("scrape_2", scrape_func, args=("concrete", "ohio"))
        task3 = executor.add_task("process", process_func, dependencies=[task1.task_id, task2.task_id])

        # Execute all tasks
        results = await executor.execute_all()

        # Get metrics
        metrics = executor.get_metrics()
    """

    def __init__(
        self,
        max_workers: int = 10,
        max_concurrent: int = 5,
        enable_metrics: bool = True
    ):
        """
        Initialize parallel executor.

        :param max_workers: Maximum number of worker threads/processes
        :param max_concurrent: Maximum concurrent tasks
        :param enable_metrics: Enable performance metrics collection
        """
        self.max_workers = max_workers
        self.max_concurrent = max_concurrent
        self.enable_metrics = enable_metrics

        self.tasks: dict[str, Task] = {}
        self.task_queue: list[Task] = []
        self.running_tasks: dict[str, asyncio.Task] = {}

        # Metrics
        self.metrics = {
            "total_tasks": 0,
            "completed_tasks": 0,
            "failed_tasks": 0,
            "cancelled_tasks": 0,
            "total_duration": 0.0,
            "avg_task_duration": 0.0,
            "peak_concurrency": 0,
            "start_time": None,
            "end_time": None
        }

        # Task timing history for adaptive optimization
        self.task_timing_history: dict[str, list[float]] = defaultdict(list)

        logger.info(
            f"[ParallelExecutor] Initialized: max_workers={max_workers}, "
            f"max_concurrent={max_concurrent}"
        )

    def add_task(
        self,
        name: str,
        func: Callable,
        args: tuple = (),
        kwargs: dict = None,
        priority: TaskPriority = TaskPriority.NORMAL,
        timeout: Optional[float] = None,
        max_retries: int = 2,
        dependencies: list[str] = None
    ) -> Task:
        """
        Add a task to the execution queue.

        :param name: Task name (used for task_id generation)
        :param func: Callable function to execute
        :param args: Positional arguments
        :param kwargs: Keyword arguments
        :param priority: Task priority
        :param timeout: Task timeout in seconds
        :param max_retries: Maximum retry attempts
        :param dependencies: List of task_ids that must complete first
        :returns: Created Task object
        """
        task_id = f"{name}_{len(self.tasks)}"
        task = Task(
            task_id=task_id,
            name=name,
            func=func,
            args=args,
            kwargs=kwargs or {},
            priority=priority,
            timeout=timeout,
            max_retries=max_retries,
            dependencies=dependencies or []
        )

        self.tasks[task_id] = task
        self.task_queue.append(task)
        self.metrics["total_tasks"] += 1

        logger.debug(f"[ParallelExecutor] Added task: {task_id} (priority={priority.name})")
        return task

    async def execute_all(self, cancel_on_first_error: bool = False) -> dict[str, Any]:
        """
        Execute all queued tasks with parallel execution and dependency resolution.

        :param cancel_on_first_error: Cancel all remaining tasks on first error
        :returns: Dict with results and execution metrics
        """
        logger.info(f"[ParallelExecutor] Starting execution of {len(self.task_queue)} tasks")
        self.metrics["start_time"] = time.time()

        try:
            # Sort tasks by priority and dependencies
            await self._schedule_tasks()

            # Execute tasks with concurrency control
            semaphore = asyncio.Semaphore(self.max_concurrent)

            async def execute_with_semaphore(task: Task):
                async with semaphore:
                    # Update peak concurrency metric
                    current_concurrent = len(self.running_tasks)
                    if current_concurrent > self.metrics["peak_concurrency"]:
                        self.metrics["peak_concurrency"] = current_concurrent

                    return await self._execute_task(task)

            # Create task coroutines
            task_coros = []
            for task in self.task_queue:
                if task.status == TaskStatus.PENDING:
                    task.status = TaskStatus.QUEUED
                    task_coros.append(execute_with_semaphore(task))

            # Execute all tasks
            results = await asyncio.gather(*task_coros, return_exceptions=True)

            # Process results
            for i, result in enumerate(results):
                task = self.task_queue[i]
                if isinstance(result, Exception):
                    task.status = TaskStatus.FAILED
                    task.error = str(result)
                    self.metrics["failed_tasks"] += 1
                    logger.error(f"[ParallelExecutor] Task {task.task_id} failed: {result}")

                    if cancel_on_first_error:
                        logger.warning("[ParallelExecutor] Cancelling remaining tasks due to error")
                        await self._cancel_remaining_tasks()
                        break

        except Exception as exc:
            logger.error(f"[ParallelExecutor] Fatal error during execution: {exc}", exc_info=True)
        finally:
            self.metrics["end_time"] = time.time()
            self._finalize_metrics()

        return self._get_results()

    async def _execute_task(self, task: Task) -> Any:
        """
        Execute a single task with timeout, retry, and error handling.

        :param task: Task to execute
        :returns: Task result
        """
        task.status = TaskStatus.RUNNING
        task.start_time = time.time()

        logger.debug(f"[ParallelExecutor] Executing task: {task.task_id}")

        try:
            # Check dependencies
            if not await self._check_dependencies(task):
                raise RuntimeError(f"Dependencies not met for task {task.task_id}")

            # Execute with timeout
            if asyncio.iscoroutinefunction(task.func):
                if task.timeout:
                    result = await asyncio.wait_for(
                        task.func(*task.args, **task.kwargs),
                        timeout=task.timeout
                    )
                else:
                    result = await task.func(*task.args, **task.kwargs)
            else:
                # Run sync function in executor
                loop = asyncio.get_event_loop()
                if task.timeout:
                    result = await asyncio.wait_for(
                        loop.run_in_executor(None, task.func, *task.args),
                        timeout=task.timeout
                    )
                else:
                    result = await loop.run_in_executor(None, task.func, *task.args)

            # Task succeeded
            task.status = TaskStatus.COMPLETED
            task.result = result
            task.end_time = time.time()
            self.metrics["completed_tasks"] += 1

            # Record timing for adaptive optimization
            if task.duration:
                self.task_timing_history[task.name].append(task.duration)

            logger.debug(f"[ParallelExecutor] Task completed: {task.task_id} (duration={task.duration:.2f}s)")
            return result

        except asyncio.TimeoutError:
            logger.warning(f"[ParallelExecutor] Task timed out: {task.task_id}")

            # Retry if attempts remain
            if task.retries < task.max_retries:
                task.retries += 1
                logger.info(f"[ParallelExecutor] Retrying task: {task.task_id} (attempt {task.retries + 1}/{task.max_retries + 1})")
                return await self._execute_task(task)
            else:
                task.status = TaskStatus.FAILED
                task.error = f"Task timed out after {task.timeout}s"
                task.end_time = time.time()
                self.metrics["failed_tasks"] += 1
                raise

        except Exception as exc:
            logger.error(f"[ParallelExecutor] Task error: {task.task_id} - {exc}", exc_info=True)

            # Retry if attempts remain
            if task.retries < task.max_retries:
                task.retries += 1
                logger.info(f"[ParallelExecutor] Retrying task: {task.task_id} (attempt {task.retries + 1}/{task.max_retries + 1})")
                # Add exponential backoff
                await asyncio.sleep(2 ** task.retries)
                return await self._execute_task(task)
            else:
                task.status = TaskStatus.FAILED
                task.error = str(exc)
                task.end_time = time.time()
                self.metrics["failed_tasks"] += 1
                raise

    async def _schedule_tasks(self):
        """Sort tasks by priority and resolve dependencies."""
        # Sort by priority (lower enum value = higher priority)
        self.task_queue.sort(key=lambda t: (t.priority.value, t.task_id))

        logger.debug(
            f"[ParallelExecutor] Scheduled {len(self.task_queue)} tasks "
            f"(priorities: {[t.priority.name for t in self.task_queue[:5]]}...)"
        )

    async def _check_dependencies(self, task: Task) -> bool:
        """
        Check if all task dependencies are completed.

        :param task: Task to check
        :returns: True if dependencies met
        """
        if not task.dependencies:
            return True

        for dep_id in task.dependencies:
            dep_task = self.tasks.get(dep_id)
            if not dep_task:
                logger.error(f"[ParallelExecutor] Dependency not found: {dep_id}")
                return False
            if dep_task.status != TaskStatus.COMPLETED:
                logger.warning(f"[ParallelExecutor] Waiting for dependency: {dep_id}")
                # Wait for dependency (with timeout)
                timeout = 60  # 60 second timeout for dependencies
                start = time.time()
                while dep_task.status != TaskStatus.COMPLETED and (time.time() - start) < timeout:
                    await asyncio.sleep(0.1)

                if dep_task.status != TaskStatus.COMPLETED:
                    logger.error(f"[ParallelExecutor] Dependency timeout: {dep_id}")
                    return False

        return True

    async def _cancel_remaining_tasks(self):
        """Cancel all pending and queued tasks."""
        for task in self.task_queue:
            if task.status in (TaskStatus.PENDING, TaskStatus.QUEUED):
                task.status = TaskStatus.CANCELLED
                self.metrics["cancelled_tasks"] += 1

    def _finalize_metrics(self):
        """Finalize execution metrics."""
        if self.metrics["start_time"] and self.metrics["end_time"]:
            self.metrics["total_duration"] = self.metrics["end_time"] - self.metrics["start_time"]

        if self.metrics["completed_tasks"] > 0:
            total_task_time = sum(
                t.duration for t in self.tasks.values()
                if t.duration is not None
            )
            self.metrics["avg_task_duration"] = total_task_time / self.metrics["completed_tasks"]

        logger.info(
            f"[ParallelExecutor] Execution complete: "
            f"total={self.metrics['total_tasks']}, "
            f"completed={self.metrics['completed_tasks']}, "
            f"failed={self.metrics['failed_tasks']}, "
            f"duration={self.metrics['total_duration']:.2f}s, "
            f"peak_concurrency={self.metrics['peak_concurrency']}"
        )

    def _get_results(self) -> dict[str, Any]:
        """Get execution results and metrics."""
        task_results = {
            task.task_id: {
                "status": task.status.value,
                "result": task.result,
                "error": task.error,
                "duration": task.duration,
                "retries": task.retries
            }
            for task in self.tasks.values()
        }

        return {
            "success": self.metrics["failed_tasks"] == 0,
            "tasks": task_results,
            "metrics": self.metrics,
            "timing_history": dict(self.task_timing_history)
        }

    def get_metrics(self) -> dict[str, Any]:
        """Get current execution metrics."""
        return self.metrics.copy()

    def get_task_status(self, task_id: str) -> Optional[TaskStatus]:
        """Get status of a specific task."""
        task = self.tasks.get(task_id)
        return task.status if task else None

    def optimize_concurrency(self) -> int:
        """
        Dynamically optimize concurrency based on task timing history.

        :returns: Recommended concurrency level
        """
        if not self.task_timing_history:
            return self.max_concurrent

        # Calculate average task duration
        all_durations = [
            duration
            for durations in self.task_timing_history.values()
            for duration in durations
        ]

        if not all_durations:
            return self.max_concurrent

        avg_duration = sum(all_durations) / len(all_durations)

        # If tasks are fast (< 2s), increase concurrency
        # If tasks are slow (> 10s), decrease concurrency
        if avg_duration < 2.0:
            recommended = min(self.max_workers, self.max_concurrent * 2)
        elif avg_duration > 10.0:
            recommended = max(2, self.max_concurrent // 2)
        else:
            recommended = self.max_concurrent

        logger.info(
            f"[ParallelExecutor] Concurrency optimization: "
            f"avg_duration={avg_duration:.2f}s, "
            f"current={self.max_concurrent}, "
            f"recommended={recommended}"
        )

        return recommended


# Singleton instance
parallel_executor = ParallelExecutor()
