"""
fault_tolerance/fault_tolerance.py
=====================================
Enterprise fault-tolerance layer for the XPS Intelligence Platform.

Provides:
  - CircuitBreaker   — open/half-open/closed state machine
  - RetryPolicy      — exponential back-off with jitter
  - Bulkhead         — concurrency limiter to isolate failures
  - Fallback         — static or callable fallback on failure
  - fault_tolerant() — decorator combining all of the above

Usage::

    from fault_tolerance import fault_tolerant, CircuitBreaker

    @fault_tolerant(retries=3, circuit_name="scraper", fallback={"leads": []})
    async def fetch_leads(url):
        ...

    cb = CircuitBreaker(name="db", failure_threshold=5)
    with cb:
        result = db_query()
"""

from __future__ import annotations

import asyncio
import functools
import logging
import random
import threading
import time
from enum import Enum
from typing import Any, Callable, Dict, Optional, Type, Union

from observability import record_metric

logger = logging.getLogger("fault_tolerance")


# ---------------------------------------------------------------------------
# Circuit Breaker
# ---------------------------------------------------------------------------


class CircuitState(str, Enum):
    CLOSED = "closed"        # normal operation
    OPEN = "open"            # blocking all calls
    HALF_OPEN = "half_open"  # testing recovery


class CircuitOpenError(Exception):
    """Raised when a call is attempted against an open circuit."""


_CIRCUIT_REGISTRY: Dict[str, "CircuitBreaker"] = {}
_REGISTRY_LOCK = threading.Lock()


def get_circuit(name: str) -> Optional["CircuitBreaker"]:
    return _CIRCUIT_REGISTRY.get(name)


class CircuitBreaker:
    """Thread-safe circuit breaker.

    :param name: Unique name (used for metrics and registry lookup).
    :param failure_threshold: Number of consecutive failures before opening.
    :param recovery_timeout: Seconds in OPEN state before transitioning to HALF_OPEN.
    :param success_threshold: Consecutive successes in HALF_OPEN needed to close again.
    """

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        success_threshold: int = 2,
    ) -> None:
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.success_threshold = success_threshold

        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time: Optional[float] = None
        self._lock = threading.Lock()

        with _REGISTRY_LOCK:
            _CIRCUIT_REGISTRY[name] = self

    @property
    def state(self) -> CircuitState:
        return self._state

    def _transition(self, new_state: CircuitState) -> None:
        old = self._state
        self._state = new_state
        logger.info("CircuitBreaker[%s]: %s → %s", self.name, old.value, new_state.value)
        record_metric(
            "circuit_breaker.state_change",
            tags={"circuit": self.name, "state": new_state.value},
        )

    def _check_recovery(self) -> None:
        """If OPEN and recovery_timeout has passed, switch to HALF_OPEN."""
        if (
            self._state == CircuitState.OPEN
            and self._last_failure_time is not None
            and time.monotonic() - self._last_failure_time >= self.recovery_timeout
        ):
            self._success_count = 0
            self._transition(CircuitState.HALF_OPEN)

    def record_success(self) -> None:
        with self._lock:
            self._failure_count = 0
            if self._state == CircuitState.HALF_OPEN:
                self._success_count += 1
                if self._success_count >= self.success_threshold:
                    self._transition(CircuitState.CLOSED)
            record_metric("circuit_breaker.success", tags={"circuit": self.name})

    def record_failure(self) -> None:
        with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.monotonic()
            record_metric("circuit_breaker.failure", tags={"circuit": self.name})
            if self._state in (CircuitState.CLOSED, CircuitState.HALF_OPEN):
                if self._failure_count >= self.failure_threshold:
                    self._transition(CircuitState.OPEN)

    def allow_request(self) -> bool:
        with self._lock:
            self._check_recovery()
            allowed = self._state != CircuitState.OPEN
            if not allowed:
                record_metric("circuit_breaker.blocked", tags={"circuit": self.name})
            return allowed

    def __enter__(self) -> "CircuitBreaker":
        if not self.allow_request():
            raise CircuitOpenError(
                f"Circuit '{self.name}' is OPEN — request blocked"
            )
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> bool:
        if exc_type is None:
            self.record_success()
        else:
            self.record_failure()
        return False  # do not suppress exceptions

    def status(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "name": self.name,
                "state": self._state.value,
                "failure_count": self._failure_count,
                "success_count": self._success_count,
                "last_failure_time": self._last_failure_time,
            }


# ---------------------------------------------------------------------------
# Retry policy
# ---------------------------------------------------------------------------


class RetryExhausted(Exception):
    """Raised when all retry attempts have been consumed."""


class RetryPolicy:
    """Exponential back-off with jitter.

    :param max_retries: Maximum number of attempts (0 = no retry).
    :param base_delay: Initial delay in seconds.
    :param max_delay: Cap on delay growth.
    :param backoff_factor: Multiplier applied per attempt.
    :param jitter: Whether to add random jitter (±25 % of delay).
    :param retryable_exceptions: Tuple of exception types that trigger retry.
    """

    def __init__(
        self,
        max_retries: int = 3,
        base_delay: float = 0.5,
        max_delay: float = 30.0,
        backoff_factor: float = 2.0,
        jitter: bool = True,
        retryable_exceptions: tuple[Type[Exception], ...] = (Exception,),
    ) -> None:
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.backoff_factor = backoff_factor
        self.jitter = jitter
        self.retryable_exceptions = retryable_exceptions

    def _delay(self, attempt: int) -> float:
        delay = min(self.base_delay * (self.backoff_factor ** attempt), self.max_delay)
        if self.jitter:
            delay *= (0.75 + random.random() * 0.5)
        return delay

    def execute(self, fn: Callable[[], Any]) -> Any:
        """Synchronously execute *fn* with retry."""
        last_exc: Optional[Exception] = None
        for attempt in range(self.max_retries + 1):
            try:
                result = fn()
                if attempt > 0:
                    record_metric(
                        "retry_policy.recovered",
                        tags={"attempt": str(attempt)},
                    )
                return result
            except self.retryable_exceptions as exc:
                last_exc = exc
                record_metric(
                    "retry_policy.attempt",
                    tags={"attempt": str(attempt), "error": type(exc).__name__},
                )
                if attempt < self.max_retries:
                    delay = self._delay(attempt)
                    logger.warning(
                        "RetryPolicy: attempt %d/%d failed (%s), retrying in %.2fs",
                        attempt + 1,
                        self.max_retries + 1,
                        exc,
                        delay,
                    )
                    time.sleep(delay)
        record_metric("retry_policy.exhausted")
        raise RetryExhausted(f"All {self.max_retries + 1} attempts failed") from last_exc

    async def execute_async(self, fn: Callable[[], Any]) -> Any:
        """Asynchronously execute *fn* (coroutine-returning callable) with retry."""
        last_exc: Optional[Exception] = None
        for attempt in range(self.max_retries + 1):
            try:
                result = await fn()
                if attempt > 0:
                    record_metric(
                        "retry_policy.recovered",
                        tags={"attempt": str(attempt)},
                    )
                return result
            except self.retryable_exceptions as exc:
                last_exc = exc
                record_metric(
                    "retry_policy.attempt",
                    tags={"attempt": str(attempt), "error": type(exc).__name__},
                )
                if attempt < self.max_retries:
                    delay = self._delay(attempt)
                    logger.warning(
                        "RetryPolicy async: attempt %d/%d failed (%s), retrying in %.2fs",
                        attempt + 1,
                        self.max_retries + 1,
                        exc,
                        delay,
                    )
                    await asyncio.sleep(delay)
        record_metric("retry_policy.exhausted")
        raise RetryExhausted(f"All {self.max_retries + 1} attempts failed") from last_exc


# ---------------------------------------------------------------------------
# Bulkhead
# ---------------------------------------------------------------------------


class BulkheadFullError(Exception):
    """Raised when the bulkhead concurrency limit is exceeded."""


class Bulkhead:
    """Concurrency limiter to isolate failures between subsystems.

    :param name: Unique name.
    :param max_concurrent: Maximum number of simultaneous executions.
    :param timeout: How long to wait for a slot before raising BulkheadFullError.
    """

    def __init__(self, name: str, max_concurrent: int = 10, timeout: float = 5.0) -> None:
        self.name = name
        self._semaphore = threading.Semaphore(max_concurrent)
        self._timeout = timeout

    def __enter__(self) -> "Bulkhead":
        acquired = self._semaphore.acquire(timeout=self._timeout)
        if not acquired:
            record_metric("bulkhead.rejected", tags={"bulkhead": self.name})
            raise BulkheadFullError(f"Bulkhead '{self.name}' is full")
        return self

    def __exit__(self, *_) -> bool:
        self._semaphore.release()
        return False

    async def __aenter__(self) -> "Bulkhead":
        loop = asyncio.get_event_loop()
        acquired = await loop.run_in_executor(
            None, lambda: self._semaphore.acquire(timeout=self._timeout)
        )
        if not acquired:
            record_metric("bulkhead.rejected", tags={"bulkhead": self.name})
            raise BulkheadFullError(f"Bulkhead '{self.name}' is full")
        return self

    async def __aexit__(self, *_) -> bool:
        self._semaphore.release()
        return False


# ---------------------------------------------------------------------------
# fault_tolerant decorator
# ---------------------------------------------------------------------------


def fault_tolerant(
    retries: int = 3,
    circuit_name: Optional[str] = None,
    failure_threshold: int = 5,
    recovery_timeout: float = 30.0,
    base_delay: float = 0.5,
    max_delay: float = 30.0,
    fallback: Any = None,
    bulkhead_name: Optional[str] = None,
    max_concurrent: int = 20,
) -> Callable:
    """
    Decorator that applies retry, circuit-breaker, bulkhead and fallback.

    Can decorate both sync and async functions.
    """
    circuit: Optional[CircuitBreaker] = None
    if circuit_name:
        circuit = CircuitBreaker(circuit_name, failure_threshold, recovery_timeout)

    bulkhead: Optional[Bulkhead] = None
    if bulkhead_name:
        bulkhead = Bulkhead(bulkhead_name, max_concurrent)

    retry_policy = RetryPolicy(max_retries=retries, base_delay=base_delay, max_delay=max_delay)

    def _apply_fallback(exc: Exception) -> Any:
        logger.warning("fault_tolerant: using fallback due to %s", exc)
        record_metric("fault_tolerant.fallback")
        if callable(fallback):
            return fallback()
        return fallback

    def decorator(fn: Callable) -> Callable:
        if asyncio.iscoroutinefunction(fn):
            @functools.wraps(fn)
            async def async_wrapper(*args, **kwargs):
                if circuit and not circuit.allow_request():
                    exc = CircuitOpenError(f"Circuit '{circuit_name}' is OPEN")
                    if fallback is not None:
                        return _apply_fallback(exc)
                    raise exc

                async def _call():
                    if bulkhead:
                        async with bulkhead:
                            return await fn(*args, **kwargs)
                    return await fn(*args, **kwargs)

                try:
                    result = await retry_policy.execute_async(_call)
                    if circuit:
                        circuit.record_success()
                    return result
                except Exception as exc:
                    if circuit:
                        circuit.record_failure()
                    if fallback is not None:
                        return _apply_fallback(exc)
                    raise

            return async_wrapper
        else:
            @functools.wraps(fn)
            def sync_wrapper(*args, **kwargs):
                if circuit and not circuit.allow_request():
                    exc = CircuitOpenError(f"Circuit '{circuit_name}' is OPEN")
                    if fallback is not None:
                        return _apply_fallback(exc)
                    raise exc

                def _call():
                    if bulkhead:
                        with bulkhead:
                            return fn(*args, **kwargs)
                    return fn(*args, **kwargs)

                try:
                    result = retry_policy.execute(_call)
                    if circuit:
                        circuit.record_success()
                    return result
                except Exception as exc:
                    if circuit:
                        circuit.record_failure()
                    if fallback is not None:
                        return _apply_fallback(exc)
                    raise

            return sync_wrapper

    return decorator
