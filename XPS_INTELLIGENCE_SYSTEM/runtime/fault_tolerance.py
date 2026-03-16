"""
runtime/fault_tolerance.py
============================
Fault-tolerance primitives for the XPS Intelligence Platform.

Provides:
  - CircuitBreaker  – protect downstream calls from cascading failures
  - RetryPolicy     – configurable back-off retry wrapper
  - WorkerRecovery  – detect and restart failed workers

Usage::

    from runtime.fault_tolerance import CircuitBreaker, RetryPolicy

    cb = CircuitBreaker(name="my_service", failure_threshold=5, recovery_timeout=30)

    @RetryPolicy(max_retries=3, delay=1.0, backoff=2.0)
    async def call_service():
        ...
"""

from __future__ import annotations

import asyncio
import functools
import logging
import time
from typing import Any, Callable

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# CircuitBreaker
# ---------------------------------------------------------------------------

CIRCUIT_CLOSED = "closed"    # normal operation
CIRCUIT_OPEN = "open"        # blocking requests
CIRCUIT_HALF_OPEN = "half_open"  # testing recovery


class CircuitBreaker:
    """
    Three-state circuit breaker.

    States:
      CLOSED    – requests pass through; failures are counted
      OPEN      – requests are rejected immediately
      HALF_OPEN – one probe request is allowed; if it succeeds, circuit closes

    :param name: Descriptive name for logging.
    :param failure_threshold: Number of consecutive failures before opening.
    :param recovery_timeout: Seconds to wait before entering HALF_OPEN.
    :param success_threshold: Successes in HALF_OPEN before closing again.
    """

    def __init__(
        self,
        name: str = "default",
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        success_threshold: int = 1,
    ) -> None:
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.success_threshold = success_threshold

        self._state: str = CIRCUIT_CLOSED
        self._failure_count: int = 0
        self._success_count: int = 0
        self._last_failure_time: float = 0.0

    # ------------------------------------------------------------------

    def allow_request(self) -> bool:
        """Return True if the request should be allowed through."""
        if self._state == CIRCUIT_CLOSED:
            return True
        if self._state == CIRCUIT_OPEN:
            if time.time() - self._last_failure_time >= self.recovery_timeout:
                self._state = CIRCUIT_HALF_OPEN
                self._success_count = 0
                logger.info("[CircuitBreaker:%s] → HALF_OPEN (probing)", self.name)
                return True  # let one probe through
            return False
        # HALF_OPEN – allow only one probe at a time
        return True

    def record_success(self) -> None:
        """Record a successful call."""
        if self._state == CIRCUIT_HALF_OPEN:
            self._success_count += 1
            if self._success_count >= self.success_threshold:
                self._state = CIRCUIT_CLOSED
                self._failure_count = 0
                logger.info("[CircuitBreaker:%s] → CLOSED (recovered)", self.name)
        elif self._state == CIRCUIT_CLOSED:
            self._failure_count = max(0, self._failure_count - 1)

    def record_failure(self) -> None:
        """Record a failed call."""
        self._failure_count += 1
        self._last_failure_time = time.time()
        if self._state == CIRCUIT_HALF_OPEN:
            self._state = CIRCUIT_OPEN
            logger.warning("[CircuitBreaker:%s] → OPEN (probe failed)", self.name)
        elif self._failure_count >= self.failure_threshold:
            self._state = CIRCUIT_OPEN
            logger.warning(
                "[CircuitBreaker:%s] → OPEN after %d failures",
                self.name,
                self._failure_count,
            )

    def status(self) -> dict[str, Any]:
        """Return the current state as a dict."""
        return {
            "name": self.name,
            "state": self._state,
            "failure_count": self._failure_count,
            "last_failure_age": round(time.time() - self._last_failure_time, 1)
            if self._last_failure_time
            else None,
        }


# ---------------------------------------------------------------------------
# RetryPolicy decorator
# ---------------------------------------------------------------------------


class RetryPolicy:
    """
    Decorator that retries an async coroutine with configurable back-off.

    :param max_retries: Maximum number of retries (0 = no retry).
    :param delay: Initial delay in seconds.
    :param backoff: Multiplier applied to *delay* on each retry.
    :param exceptions: Tuple of exception types to catch (default: Exception).

    Example::

        @RetryPolicy(max_retries=3, delay=0.5, backoff=2.0)
        async def fetch():
            ...
    """

    def __init__(
        self,
        max_retries: int = 3,
        delay: float = 1.0,
        backoff: float = 2.0,
        max_delay: float = 60.0,
        exceptions: tuple[type[BaseException], ...] = (Exception,),
    ) -> None:
        self.max_retries = max_retries
        self.delay = delay
        self.backoff = backoff
        self.max_delay = max_delay
        self.exceptions = exceptions

    def __call__(self, fn: Callable) -> Callable:
        @functools.wraps(fn)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            attempt = 0
            current_delay = self.delay
            while True:
                try:
                    return await fn(*args, **kwargs)
                except self.exceptions as exc:
                    attempt += 1
                    if attempt > self.max_retries:
                        logger.error(
                            "[RetryPolicy] %s failed after %d attempts: %s",
                            fn.__name__,
                            attempt,
                            exc,
                        )
                        raise
                    logger.warning(
                        "[RetryPolicy] %s attempt %d/%d failed: %s – retrying in %.1fs",
                        fn.__name__,
                        attempt,
                        self.max_retries,
                        exc,
                        current_delay,
                    )
                    await asyncio.sleep(current_delay)
                    current_delay = min(current_delay * self.backoff, self.max_delay)

        return wrapper


# ---------------------------------------------------------------------------
# WorkerRecovery
# ---------------------------------------------------------------------------


class WorkerRecovery:
    """
    Monitors a set of async worker coroutines and restarts them if they crash.

    Usage::

        async def my_worker():
            while True:
                await process_task()

        recovery = WorkerRecovery(factory=my_worker, n_workers=3)
        await recovery.start()   # blocks until cancelled
    """

    def __init__(
        self,
        factory: Callable[[], Any],
        n_workers: int = 3,
        restart_delay: float = 2.0,
        max_restarts: int = 10,
    ) -> None:
        self.factory = factory
        self.n_workers = n_workers
        self.restart_delay = restart_delay
        self.max_restarts = max_restarts
        self._tasks: list[asyncio.Task] = []
        self._restart_counts: dict[int, int] = {}

    async def start(self) -> None:
        """Start workers and monitor them for restarts."""
        async with asyncio.TaskGroup() as tg:
            for i in range(self.n_workers):
                tg.create_task(self._supervised(i))

    async def _supervised(self, worker_id: int) -> None:
        """Run a single supervised worker, restarting on crash."""
        restarts = 0
        while True:
            try:
                logger.info("[WorkerRecovery] Worker %d starting (restart #%d)", worker_id, restarts)
                await self.factory()
                logger.info("[WorkerRecovery] Worker %d exited cleanly", worker_id)
                return
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                restarts += 1
                if restarts > self.max_restarts:
                    logger.error(
                        "[WorkerRecovery] Worker %d exceeded max restarts (%d). Giving up.",
                        worker_id,
                        self.max_restarts,
                    )
                    raise
                logger.warning(
                    "[WorkerRecovery] Worker %d crashed (restart %d/%d): %s – restarting in %.1fs",
                    worker_id,
                    restarts,
                    self.max_restarts,
                    exc,
                    self.restart_delay,
                )
                await asyncio.sleep(self.restart_delay)
