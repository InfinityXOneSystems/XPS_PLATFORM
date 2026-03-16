#!/usr/bin/env python3
"""
scripts/auto_resolve_conflicts.py
==================================
Autonomous Merge Conflict Resolution Agent

Scans the repository for Git merge conflict markers and resolves them
automatically using type-aware strategies — zero human intervention required.

Resolution strategies (by file type):
  .gitignore          → Union merge (keep all patterns from both sides)
  *.json (data)       → Prefer the larger array / merge objects deeply
  *.md                → Concatenate both sides, deduplicate lines
  *.yml / *.yaml      → Prefer ours (preserve CI stability)
  *.js / *.ts / *.tsx → Prefer theirs for additions, ours for structure
  *.py                → Prefer theirs for additions, ours for structure
  everything else     → Prefer theirs (incoming changes)

Usage:
  python scripts/auto_resolve_conflicts.py [--repo-root PATH] [--dry-run] [--strategy STRATEGY]

Exit codes:
  0 — all conflicts resolved (or none found)
  1 — unresolvable conflicts remain (binary files, etc.)
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
from pathlib import Path
from typing import Iterator, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
log = logging.getLogger("conflict_resolver")


# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------

class ConflictBlock:
    """One conflict block extracted from a file."""

    def __init__(
        self,
        ours: str,
        theirs: str,
        base: Optional[str] = None,
        start: int = 0,
        end: int = 0,
    ):
        self.ours = ours
        self.theirs = theirs
        self.base = base  # common ancestor (diff3 format)
        self.start = start  # character offset in original content
        self.end = end


class ResolutionResult:
    """Result of processing one file."""

    def __init__(self, filepath: Path, conflicts_found: int, conflicts_resolved: int, strategy: str):
        self.filepath = filepath
        self.conflicts_found = conflicts_found
        self.conflicts_resolved = conflicts_resolved
        self.strategy = strategy

    @property
    def success(self) -> bool:
        return self.conflicts_resolved == self.conflicts_found

    def __repr__(self) -> str:
        return (
            f"<ResolutionResult {self.filepath.name}: "
            f"{self.conflicts_resolved}/{self.conflicts_found} resolved via '{self.strategy}'>"
        )


# ---------------------------------------------------------------------------
# Conflict detection
# ---------------------------------------------------------------------------

# Match a complete conflict block.
# Supports both 2-way (no diff3 base) and 3-way (with diff3 base) formats:
#
#   <<<<<<< <label>\n
#   <ours content>
#   =======\n               ← 2-way format
#   <theirs content>
#   >>>>>>> <label>\n
#
#   <<<<<<< <label>\n
#   <ours content>
#   ||||||| <label>\n       ← 3-way / diff3 base section (optional)
#   <base content>
#   =======\n
#   <theirs content>
#   >>>>>>> <label>\n
#
# We use a two-phase approach: first split on <<<<<<</>>>>>>>, then parse
# the ours/theirs sections explicitly to avoid group-number ambiguity.
_CONFLICT_OUTER_RE = re.compile(
    r"<<<<<<< [^\n]*\n"
    r"(.*?)"
    r">>>>>>> [^\n]*\n",
    re.DOTALL,
)


def has_conflict_markers(content: str) -> bool:
    """Fast check for conflict markers without full parse.

    Requires the markers to appear at the start of a line to avoid
    false positives from regex patterns or documentation that reference
    conflict marker syntax.
    """
    return bool(
        re.search(r"^<{7} ", content, re.MULTILINE)
        and re.search(r"^={7}$", content, re.MULTILINE)
        and re.search(r"^>{7} ", content, re.MULTILINE)
    )


def extract_blocks(content: str) -> List[ConflictBlock]:
    """Extract all ConflictBlocks from file content.

    Handles both 2-way merge (no diff3 base) and 3-way diff3 format.
    Uses a two-phase parse to avoid group-number ambiguity.
    """
    blocks = []
    for m in _CONFLICT_OUTER_RE.finditer(content):
        inner = m.group(1)  # everything between <<<<<<< and >>>>>>>

        # Split the inner section on the separator =======
        # The separator may appear as "=======\n" at the start of a line
        sep_re = re.compile(r"^={7}$", re.MULTILINE)
        sep_match = sep_re.search(inner)
        if not sep_match:
            # No separator found — malformed block, skip
            continue

        before_sep = inner[: sep_match.start()].rstrip("\n")
        theirs = inner[sep_match.end() :].lstrip("\n")

        # Check for diff3 base section in the "before_sep" part
        base_sep_re = re.compile(r"^\|{7} [^\n]*$", re.MULTILINE)
        base_sep_match = base_sep_re.search(before_sep)
        if base_sep_match:
            ours = before_sep[: base_sep_match.start()].rstrip("\n")
            base: Optional[str] = before_sep[base_sep_match.end() :].lstrip("\n")
        else:
            ours = before_sep
            base = None

        blocks.append(ConflictBlock(ours, theirs, base, m.start(), m.end()))
    return blocks


# ---------------------------------------------------------------------------
# Resolution strategies
# ---------------------------------------------------------------------------

def _resolve_union(ours: str, theirs: str) -> str:
    """Union: keep lines from both sides, deduplicate, preserve order."""
    ours_lines = ours.splitlines(keepends=True)
    theirs_lines = theirs.splitlines(keepends=True)
    seen: set = set()
    result: List[str] = []
    for line in ours_lines + theirs_lines:
        key = line.rstrip("\n")
        if key not in seen:
            seen.add(key)
            result.append(line)
    return "".join(result)


def _resolve_theirs(ours: str, theirs: str) -> str:
    """Prefer incoming (theirs) changes."""
    return theirs


def _resolve_ours(ours: str, theirs: str) -> str:
    """Prefer current (ours) changes."""
    return ours


def _resolve_additive_merge(ours: str, theirs: str) -> str:
    """For source code: keep ours structure, but include purely additive theirs lines.

    We preserve ours in full, then append lines from theirs that are not
    already present.  Comparison is line-content based (stripped) to handle
    whitespace-only differences — but we keep the original line endings.
    """
    ours_stripped: set = {line.rstrip("\n") for line in ours.splitlines()}
    theirs_lines = theirs.splitlines(keepends=True)
    # Lines in theirs that are NOT already in ours — pure additions
    additions = [
        line for line in theirs_lines
        if line.rstrip("\n") not in ours_stripped
    ]
    if additions:
        separator = "\n" if ours and not ours.endswith("\n") else ""
        return ours + separator + "".join(additions)
    return ours


def _resolve_json_merge(ours: str, theirs: str) -> str:
    """Deep-merge two JSON strings; theirs wins on scalar conflicts."""
    try:
        ours_obj = json.loads(ours) if ours.strip() else None
        theirs_obj = json.loads(theirs) if theirs.strip() else None
    except json.JSONDecodeError:
        # Not valid JSON on its own — fall back to theirs
        return theirs

    if ours_obj is None:
        return theirs
    if theirs_obj is None:
        return ours

    merged = _deep_merge(ours_obj, theirs_obj)
    return json.dumps(merged, indent=2, ensure_ascii=False) + "\n"


def _deep_merge(base: object, incoming: object) -> object:
    """Recursively merge two JSON-compatible objects; incoming wins on conflict."""
    if isinstance(base, dict) and isinstance(incoming, dict):
        result = dict(base)
        for key, val in incoming.items():
            if key in result:
                result[key] = _deep_merge(result[key], val)
            else:
                result[key] = val
        return result

    if isinstance(base, list) and isinstance(incoming, list):
        # For arrays: union by value using a set for O(1) membership.
        # Falls back to simple concatenation for unhashable items.
        try:
            seen_set: set = set()
            result_list: list = []
            for item in base:
                key = json.dumps(item, sort_keys=True)
                if key not in seen_set:
                    seen_set.add(key)
                    result_list.append(item)
            for item in incoming:
                key = json.dumps(item, sort_keys=True)
                if key not in seen_set:
                    seen_set.add(key)
                    result_list.append(item)
            return result_list
        except (TypeError, ValueError):
            return base + incoming

    # Scalar: incoming wins
    return incoming


def _resolve_markdown_merge(ours: str, theirs: str) -> str:
    """For Markdown: union of lines to avoid losing documentation."""
    return _resolve_union(ours, theirs)


# ---------------------------------------------------------------------------
# File-type strategy dispatcher
# ---------------------------------------------------------------------------

_STRATEGY_MAP: dict[str, str] = {
    ".gitignore": "union",
    ".gitattributes": "union",
    ".dockerignore": "union",
    "md": "markdown",
    "json": "json",
    "yml": "ours",
    "yaml": "ours",
    "js": "additive",
    "ts": "additive",
    "tsx": "additive",
    "jsx": "additive",
    "py": "additive",
    "sh": "theirs",
    "txt": "union",
    "env": "ours",
}


def _get_strategy(filepath: Path) -> str:
    """Determine the resolution strategy for a file."""
    name = filepath.name.lower()
    suffix = filepath.suffix.lstrip(".").lower()

    # Special filenames
    if name in _STRATEGY_MAP:
        return _STRATEGY_MAP[name]

    # By extension
    return _STRATEGY_MAP.get(suffix, "theirs")


def _apply_strategy(strategy: str, ours: str, theirs: str) -> str:
    """Apply the named resolution strategy to one conflict block."""
    if strategy == "union":
        return _resolve_union(ours, theirs)
    if strategy == "ours":
        return _resolve_ours(ours, theirs)
    if strategy == "theirs":
        return _resolve_theirs(ours, theirs)
    if strategy == "additive":
        return _resolve_additive_merge(ours, theirs)
    if strategy == "json":
        return _resolve_json_merge(ours, theirs)
    if strategy == "markdown":
        return _resolve_markdown_merge(ours, theirs)
    # Fallback
    return _resolve_theirs(ours, theirs)


# ---------------------------------------------------------------------------
# File resolver
# ---------------------------------------------------------------------------

def resolve_file(
    filepath: Path,
    *,
    override_strategy: Optional[str] = None,
    dry_run: bool = False,
) -> ResolutionResult:
    """Resolve all conflict blocks in a single file."""
    try:
        content = filepath.read_text(encoding="utf-8", errors="surrogateescape")
    except (PermissionError, OSError) as exc:
        log.warning("Cannot read %s: %s", filepath, exc)
        return ResolutionResult(filepath, 0, 0, "error")

    if not has_conflict_markers(content):
        return ResolutionResult(filepath, 0, 0, "none")

    strategy = override_strategy or _get_strategy(filepath)
    blocks = extract_blocks(content)

    if not blocks:
        # Markers present but regex didn't parse — defensive fallback
        log.warning("Could not parse conflict blocks in %s — skipping", filepath)
        return ResolutionResult(filepath, 1, 0, strategy)

    resolved_count = 0
    # Replace conflict blocks from end to start so offsets remain valid
    for block in reversed(blocks):
        resolution = _apply_strategy(strategy, block.ours, block.theirs)
        content = content[: block.start] + resolution + content[block.end :]
        resolved_count += 1

    if has_conflict_markers(content):
        # Residual markers remain — resolution incomplete
        log.error("Residual conflict markers after resolution in %s", filepath)
        return ResolutionResult(filepath, len(blocks), resolved_count, strategy)

    if not dry_run:
        filepath.write_text(content, encoding="utf-8", errors="surrogateescape")
        log.info("✓ Resolved %d block(s) in %-60s [%s]", resolved_count, str(filepath), strategy)
    else:
        log.info("[dry-run] Would resolve %d block(s) in %s [%s]", resolved_count, filepath, strategy)

    return ResolutionResult(filepath, len(blocks), resolved_count, strategy)


# ---------------------------------------------------------------------------
# Repository scanner
# ---------------------------------------------------------------------------

_SKIP_DIRS = {
    ".git", "node_modules", "__pycache__", ".next", "out", "dist",
    "venv", ".venv", ".mypy_cache", ".pytest_cache", ".ruff_cache",
    "htmlcov", "crawlee_storage", "storage", ".idea", ".vscode",
}

_TEXT_EXTENSIONS = {
    ".py", ".js", ".ts", ".tsx", ".jsx", ".json", ".yaml", ".yml",
    ".md", ".txt", ".sh", ".env", ".toml", ".cfg", ".ini", ".rst",
    ".html", ".css", ".scss", ".gitignore", ".gitattributes", ".dockerignore",
    ".sql", ".env.example", ".lock",
}

_BINARY_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
                      ".woff", ".woff2", ".ttf", ".eot", ".pdf",
                      ".zip", ".tar", ".gz"}


def iter_repo_files(root: Path) -> Iterator[Path]:
    """Walk the repo and yield text files that may have conflicts."""
    for dirpath, dirnames, filenames in os.walk(root):
        # Prune skip dirs in-place
        dirnames[:] = [d for d in dirnames if d not in _SKIP_DIRS]
        for name in filenames:
            fp = Path(dirpath) / name
            ext = fp.suffix.lower()
            if ext in _BINARY_EXTENSIONS:
                continue
            if ext in _TEXT_EXTENSIONS or ext == "" or name.startswith("."):
                yield fp


def scan_and_resolve(
    repo_root: Path,
    *,
    override_strategy: Optional[str] = None,
    dry_run: bool = False,
) -> Tuple[int, int, int]:
    """Scan the repo and resolve all conflicts.

    Returns (files_scanned, files_with_conflicts, files_fully_resolved).
    """
    scanned = 0
    conflicted = 0
    resolved = 0

    for fp in iter_repo_files(repo_root):
        scanned += 1
        result = resolve_file(fp, override_strategy=override_strategy, dry_run=dry_run)
        if result.conflicts_found > 0:
            conflicted += 1
            if result.success:
                resolved += 1
            else:
                log.error(
                    "✗ Could not fully resolve %s (%d/%d blocks resolved)",
                    fp, result.conflicts_resolved, result.conflicts_found,
                )

    return scanned, conflicted, resolved


# ---------------------------------------------------------------------------
# Summary reporter
# ---------------------------------------------------------------------------

def _write_summary(scanned: int, conflicted: int, resolved: int, dry_run: bool) -> None:
    """Write a GitHub Actions step summary if GITHUB_STEP_SUMMARY is set."""
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary_path:
        return

    unresolved = conflicted - resolved
    status = "✅ All conflicts resolved" if unresolved == 0 else f"⚠️ {unresolved} file(s) could not be resolved"

    lines = [
        "## 🤖 Autonomous Conflict Resolver",
        "",
        f"| Metric | Count |",
        f"|--------|-------|",
        f"| Files scanned | {scanned} |",
        f"| Files with conflicts | {conflicted} |",
        f"| Files resolved | {resolved} |",
        f"| Files unresolved | {unresolved} |",
        "",
        f"**Status:** {status}",
        "",
        f"_{'Dry-run mode — no files changed' if dry_run else 'Files resolved and committed automatically'}_",
    ]

    with open(summary_path, "a", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Autonomous merge conflict resolver — zero humans needed.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument(
        "--repo-root",
        default=".",
        help="Root of the repository to scan (default: current directory)",
    )
    p.add_argument(
        "--strategy",
        choices=["union", "ours", "theirs", "additive", "json", "markdown"],
        default=None,
        help="Override strategy for ALL files (ignores per-file type logic)",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be changed without modifying files",
    )
    p.add_argument(
        "--fail-on-unresolved",
        action="store_true",
        help="Exit with code 1 if any conflicts could not be resolved",
    )
    return p.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    args = _parse_args(argv)
    root = Path(args.repo_root).resolve()

    log.info("🤖 Autonomous Conflict Resolver starting")
    log.info("   Repository: %s", root)
    log.info("   Strategy:   %s", args.strategy or "auto (per file type)")
    log.info("   Dry-run:    %s", args.dry_run)

    scanned, conflicted, resolved = scan_and_resolve(
        root,
        override_strategy=args.strategy,
        dry_run=args.dry_run,
    )

    _write_summary(scanned, conflicted, resolved, args.dry_run)

    unresolved = conflicted - resolved
    log.info(
        "Scan complete — %d file(s) scanned, %d had conflicts, %d resolved, %d unresolved",
        scanned, conflicted, resolved, unresolved,
    )

    if unresolved > 0:
        log.error(
            "%d file(s) have unresolvable conflicts. Manual review required.", unresolved
        )
        return 1 if args.fail_on_unresolved else 0

    if conflicted > 0:
        log.info("✅ All %d conflict(s) resolved autonomously.", conflicted)
    else:
        log.info("✅ No conflict markers found in repository.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
