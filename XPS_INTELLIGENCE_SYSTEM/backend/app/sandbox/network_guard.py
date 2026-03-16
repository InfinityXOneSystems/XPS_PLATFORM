"""
app/sandbox/network_guard.py
==============================
Guards network access within the sandbox.
"""

from __future__ import annotations

import re
from typing import List, Optional

from app.runtime.error_manager import SandboxViolationError

_BLOCKED_CODE_PATTERNS = [
    re.compile(r"\bsocket\b", re.I),
    re.compile(r"\burllib\b", re.I),
    re.compile(r"\bhttpx\b", re.I),
    re.compile(r"\brequests\b", re.I),
]

_DEFAULT_BLOCKED_DOMAINS: List[str] = []


class NetworkGuard:
    """Restricts outbound network access inside the sandbox."""

    def __init__(
        self,
        network_allowed: bool = True,
        blocked_domains: Optional[List[str]] = None,
    ):
        self._network_allowed = network_allowed
        self._blocked_domains: List[str] = blocked_domains or _DEFAULT_BLOCKED_DOMAINS

    def is_host_allowed(self, host: str) -> bool:
        """Return False if the host is blocked or network is disabled."""
        if not self._network_allowed:
            return False
        return host not in self._blocked_domains

    def assert_host_allowed(self, host: str) -> None:
        """Raise SandboxViolationError if host access is denied."""
        if not self.is_host_allowed(host):
            raise SandboxViolationError(
                f"Network access denied for host: {host!r}",
                violation_type="network",
            )

    def check_code(self, code: str) -> None:
        """Scan code string for disallowed network patterns when network is off."""
        if self._network_allowed:
            return
        for pattern in _BLOCKED_CODE_PATTERNS:
            if pattern.search(code):
                raise SandboxViolationError(
                    f"Code contains disallowed network pattern: {pattern.pattern!r}",
                    violation_type="network_code",
                )
