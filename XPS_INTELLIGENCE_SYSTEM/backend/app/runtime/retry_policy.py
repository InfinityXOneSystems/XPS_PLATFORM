"""
app/runtime/retry_policy.py
============================
Retry policies for failed tasks.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Callable, Optional, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")

# ---------------------------------------------------------------------------
# Policy configuration
# ---------------------------------------------------------------------------

DEFAULT_MAX_RETRIES = 3
DEFAULT_BASE_DELAY = 1.0  # seconds
DEFAULT_MAX_DELAY = 60.0  # seconds
DEFAULT_BACKOFF_FACTOR = 2.0


class RetryPolicy:
    """Configurable retry policy with exponential back-off."""

    def __init__(
        self,
        max_retries: int = DEFAULT_MAX_RETRIES,
        base_delay: float = DEFAULT_BASE_DELAY,
        max_delay: float = DEFAULT_MAX_DELAY,
        backoff_factor: float = DEFAULT_BACKOFF_FACTOR,
        exceptions: tuple = (Exception,),
    ):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.backoff_factor = backoff_factor
        self.exceptions = exceptions

    def delay_for_attempt(self, attempt: int) -> float:
        """Calculate delay (in seconds) for the given attempt number (1-based)."""
        delay = self.base_delay * (self.backoff_factor ** (attempt - 1))
        return min(delay, self.max_delay)

    def should_retry(self, attempt: int, exc: Exception) -> bool:
        """Return True if the task should be retried."""
        if attempt >= self.max_retries:
            return False
        return isinstance(exc, self.exceptions)

    def execute(self, func: Callable[..., T], *args: Any, **kwargs: Any) -> T:
        """Execute *func* with retry logic."""
        last_exc: Optional[Exception] = None
        for attempt in range(1, self.max_retries + 2):
            try:
                return func(*args, **kwargs)
            except self.exceptions as exc:
                last_exc = exc
                if not self.should_retry(attempt, exc):
                    logger.error(
                        "retry_policy_exhausted",
                        extra={
                            "attempt": attempt,
                            "max_retries": self.max_retries,
                            "error": str(exc),
                        },
                    )
                    raise
                delay = self.delay_for_attempt(attempt)
                logger.warning(
                    "retry_policy_retrying",
                    extra={
                        "attempt": attempt,
                        "delay_seconds": delay,
                        "error": str(exc),
                    },
                )
                time.sleep(delay)
        raise RuntimeError("Retry loop exited unexpectedly") from last_exc


# Shared default policy instance
default_retry_policy = RetryPolicy()

# Aggressive policy for critical tasks
critical_retry_policy = RetryPolicy(
    max_retries=5,
    base_delay=0.5,
    max_delay=30.0,
)

# Fast-fail policy for low-priority tasks
fast_fail_policy = RetryPolicy(
    max_retries=1,
    base_delay=0.5,
    max_delay=5.0,
)
