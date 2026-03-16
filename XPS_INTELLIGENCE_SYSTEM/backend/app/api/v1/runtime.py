"""
app/api/v1/runtime.py
======================
REST endpoints for the runtime command architecture.

POST /runtime/command          — submit a command for execution
GET  /runtime/task/{task_id}   — poll task status and logs
POST /runtime/parallel         — dispatch N commands in parallel
GET  /runtime/file             — read a dashboard file (sandboxed)
POST /runtime/file             — write a dashboard file (sandboxed)
GET  /runtime/shadow/status    — list all background shadow-scrape tasks
POST /runtime/agents/run-all   — start every registered backend agent
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.runtime.command_schema import (
    RuntimeCommandRequest,
    RuntimeCommandResponse,
    TaskStatusResponse,
)
from app.runtime.error_manager import (
    CommandValidationError,
    TaskDispatchError,
    format_error,
)
from app.runtime.runtime_controller import get_runtime_controller

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/runtime", tags=["runtime"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Allowed root directories for file read/write (relative to repo root).
# Restrict to dashboard only to avoid exposing the whole filesystem.
_REPO_ROOT = Path(__file__).resolve().parents[4]  # …/XPS_INTELLIGENCE_SYSTEM
_ALLOWED_ROOTS = [
    _REPO_ROOT / "dashboard",
    _REPO_ROOT / "contracts" / "frontend",
]


def _resolve_safe_path(relative_path: str) -> Path:
    """
    Resolve *relative_path* to an absolute path inside the allowed roots.

    :raises HTTPException 400: if path traversal is attempted.
    :raises HTTPException 403: if the path falls outside allowed roots.
    """
    # Reject obvious traversal attempts before resolving
    if ".." in relative_path or relative_path.startswith("/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid path: absolute paths and '..' are not allowed.",
        )
    # Try each allowed root
    for root in _ALLOWED_ROOTS:
        candidate = (root / relative_path).resolve()
        try:
            candidate.relative_to(root.resolve())
            return candidate
        except ValueError:
            continue
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=(
            f"Path '{relative_path}' is outside the allowed directories "
            f"(dashboard/, contracts/frontend/)."
        ),
    )


# ---------------------------------------------------------------------------
# Schemas for new endpoints
# ---------------------------------------------------------------------------


class ParallelCommandItem(BaseModel):
    command: str = Field(..., min_length=1, max_length=2000)
    priority: int = Field(default=5, ge=1, le=10)


class ParallelCommandRequest(BaseModel):
    commands: List[ParallelCommandItem] = Field(
        ...,
        min_length=1,
        max_length=8,
        description="1–8 commands to dispatch in parallel",
    )


class ParallelCommandResponse(BaseModel):
    tasks: List[RuntimeCommandResponse]
    total: int


class FileReadResponse(BaseModel):
    path: str
    content: str
    size: int
    lines: int


class FileWriteRequest(BaseModel):
    path: str = Field(
        ..., description="Relative path inside dashboard/ or contracts/frontend/"
    )
    content: str = Field(..., description="Full new file content")
    message: str = Field(default="agent: live edit via runtime API")


class FileWriteResponse(BaseModel):
    path: str
    bytes_written: int
    lines_written: int
    success: bool
    message: str


class ShadowTaskSummary(BaseModel):
    task_id: str
    status: str
    command_type: Optional[str] = None
    agent: Optional[str] = None
    created_at: Optional[str] = None
    completed_at: Optional[str] = None


class ShadowStatusResponse(BaseModel):
    total: int
    running: int
    completed: int
    failed: int
    tasks: List[ShadowTaskSummary]


@router.post(
    "/command",
    response_model=RuntimeCommandResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Submit a runtime command",
    description=(
        "Receives a natural-language or structured command from the frontend LLM interface, "
        "validates it, routes it to the appropriate agent, enqueues the task, and returns "
        "a task_id and initial status."
    ),
)
def post_runtime_command(payload: RuntimeCommandRequest) -> RuntimeCommandResponse:
    controller = get_runtime_controller()
    try:
        return controller.execute(payload)
    except CommandValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=format_error(exc),
        ) from exc
    except TaskDispatchError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=format_error(exc),
        ) from exc
    except Exception as exc:
        logger.exception("runtime_command_unexpected_error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=format_error(exc),
        ) from exc


@router.get(
    "/task/{task_id}",
    response_model=TaskStatusResponse,
    summary="Get task status",
    description="Poll the current status, result, and execution logs for a submitted task.",
)
def get_task_status(task_id: str) -> TaskStatusResponse:
    controller = get_runtime_controller()
    result = controller.get_task_status(task_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "TASK_NOT_FOUND", "message": f"Task {task_id!r} not found"},
        )
    return result


# ---------------------------------------------------------------------------
# Parallel command dispatch
# ---------------------------------------------------------------------------


@router.post(
    "/parallel",
    response_model=ParallelCommandResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Dispatch multiple commands in parallel",
    description=(
        "Submit 1–8 commands simultaneously.  Each command is validated, routed, "
        "and enqueued independently.  Returns a list of task objects — one per "
        "command — in the same order as the input.  Use GET /runtime/task/{task_id} "
        "to poll each individually."
    ),
)
def post_parallel_commands(payload: ParallelCommandRequest) -> ParallelCommandResponse:
    controller = get_runtime_controller()
    results: List[RuntimeCommandResponse] = []
    for item in payload.commands:
        try:
            req = RuntimeCommandRequest(command=item.command, priority=item.priority)
            results.append(controller.execute(req))
        except (CommandValidationError, TaskDispatchError) as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=format_error(exc),
            ) from exc
        except Exception as exc:
            logger.exception(
                "parallel_command_unexpected_error command=%r", item.command
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=format_error(exc),
            ) from exc
    return ParallelCommandResponse(tasks=results, total=len(results))


# ---------------------------------------------------------------------------
# Live file read / write  (sandboxed to dashboard/ and contracts/frontend/)
# ---------------------------------------------------------------------------


@router.get(
    "/file",
    response_model=FileReadResponse,
    summary="Read a dashboard file",
    description=(
        "Read the contents of a file inside dashboard/ or contracts/frontend/. "
        "Use relative paths only (e.g. 'pages/chat.js' or 'components/RuntimeCommandChat.js'). "
        "Absolute paths and '..' traversal are rejected."
    ),
)
def read_file(
    path: str = Query(
        ..., description="Relative file path within dashboard/ or contracts/frontend/"
    )
) -> FileReadResponse:
    resolved = _resolve_safe_path(path)
    if not resolved.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File not found: {path}",
        )
    if not resolved.is_file():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Path is not a file: {path}",
        )
    content = resolved.read_text(encoding="utf-8", errors="replace")
    return FileReadResponse(
        path=path,
        content=content,
        size=len(content.encode("utf-8")),
        lines=content.count("\n") + 1,
    )


@router.post(
    "/file",
    response_model=FileWriteResponse,
    status_code=status.HTTP_200_OK,
    summary="Write / overwrite a dashboard file",
    description=(
        "Write new content to a file inside dashboard/ or contracts/frontend/. "
        "The file will be created if it does not exist.  The parent directory must "
        "already exist.  Rejects absolute paths, '..' traversal, and paths outside "
        "the allowed directories."
    ),
)
def write_file(payload: FileWriteRequest) -> FileWriteResponse:
    resolved = _resolve_safe_path(payload.path)
    if not resolved.parent.exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Parent directory does not exist for path: {payload.path}",
        )
    resolved.write_text(payload.content, encoding="utf-8")
    byte_count = len(payload.content.encode("utf-8"))
    line_count = payload.content.count("\n") + 1
    logger.info(
        "runtime_file_write path=%s bytes=%d lines=%d",
        payload.path,
        byte_count,
        line_count,
    )
    return FileWriteResponse(
        path=payload.path,
        bytes_written=byte_count,
        lines_written=line_count,
        success=True,
        message=payload.message,
    )


# ---------------------------------------------------------------------------
# Shadow scraper / background task status
# ---------------------------------------------------------------------------


@router.get(
    "/shadow/status",
    response_model=ShadowStatusResponse,
    summary="List all background (shadow) scrape tasks",
    description=(
        "Returns a summary of all tasks currently tracked by the runtime, "
        "categorised by status.  Useful for the frontend shadow-scraper indicator."
    ),
)
def shadow_status() -> ShadowStatusResponse:
    controller = get_runtime_controller()
    all_tasks: Dict[str, Any] = controller.list_tasks()
    summaries: List[ShadowTaskSummary] = []
    running = completed = failed = 0
    for tid, state in all_tasks.items():
        s = state.get("status", "unknown")
        if s == "running":
            running += 1
        elif s == "completed":
            completed += 1
        elif s == "failed":
            failed += 1
        summaries.append(
            ShadowTaskSummary(
                task_id=tid,
                status=s,
                command_type=state.get("command_type"),
                agent=state.get("agent"),
                created_at=state.get("created_at"),
                completed_at=state.get("completed_at"),
            )
        )
    # Most-recent-first
    summaries.sort(key=lambda t: t.created_at or "", reverse=True)
    return ShadowStatusResponse(
        total=len(summaries),
        running=running,
        completed=completed,
        failed=failed,
        tasks=summaries[:50],  # cap at 50 for the UI
    )


# ---------------------------------------------------------------------------
# Orchestrate ALL backend agents
# ---------------------------------------------------------------------------


@router.post(
    "/agents/run-all",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Start every registered backend agent",
    description=(
        "Dispatches a run command to every agent in the registry.  "
        "Returns a task_id per agent so the frontend can track each one."
    ),
)
def run_all_agents() -> Dict[str, Any]:
    from app.api.v1.agents import _agent_registry  # local import to avoid circular dep

    controller = get_runtime_controller()
    dispatched: List[Dict[str, str]] = []
    for name in list(_agent_registry.keys()):
        try:
            req = RuntimeCommandRequest(command=f"run agent {name}", priority=7)
            resp = controller.execute(req)
            dispatched.append(
                {"agent": name, "task_id": resp.task_id, "status": resp.status}
            )
        except Exception as exc:
            logger.warning("run_all_agents: failed to dispatch %s: %s", name, exc)
            dispatched.append(
                {
                    "agent": name,
                    "task_id": None,
                    "status": "dispatch_error",
                    "error": str(exc),
                }
            )

    return {"dispatched": dispatched, "total": len(dispatched)}
