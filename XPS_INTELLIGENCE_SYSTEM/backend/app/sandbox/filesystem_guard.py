"""
app/sandbox/filesystem_guard.py
================================
Guards filesystem access within the sandbox.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import List, Optional

from app.runtime.error_manager import SandboxViolationError

_BLOCKED_CODE_PATTERNS = [
    re.compile(r"\bopen\s*\(", re.I),
    re.compile(r"\bos\.remove\b", re.I),
    re.compile(r"\bshutil\b", re.I),
    re.compile(r"\bpathlib\b", re.I),
]

_DEFAULT_ALLOWED_PATHS: List[str] = [
    "/tmp",
    os.environ.get("LEADS_DIR", "leads"),
    os.environ.get("DATA_DIR", "data"),
]


class FilesystemGuard:
    """Restricts filesystem access to a whitelist of allowed paths."""

    def __init__(self, allowed_paths: Optional[List[str]] = None):
        self._allowed = [
            Path(p).resolve() for p in (allowed_paths or _DEFAULT_ALLOWED_PATHS)
        ]

    def is_path_allowed(self, path: str) -> bool:
        """Return True if *path* is within an allowed directory."""
        resolved = Path(path).resolve()
        return any(
            resolved == allowed or str(resolved).startswith(str(allowed) + os.sep)
            for allowed in self._allowed
        )

    def assert_path_allowed(self, path: str) -> None:
        """Raise SandboxViolationError if *path* is not allowed."""
        if not self.is_path_allowed(path):
            raise SandboxViolationError(
                f"Filesystem access denied for path: {path!r}",
                violation_type="filesystem",
            )

    def check_code(self, code: str) -> None:
        """Scan code string for disallowed filesystem patterns."""
        for pattern in _BLOCKED_CODE_PATTERNS:
            if pattern.search(code):
                raise SandboxViolationError(
                    f"Code contains disallowed filesystem pattern: {pattern.pattern!r}",
                    violation_type="filesystem_code",
                )
