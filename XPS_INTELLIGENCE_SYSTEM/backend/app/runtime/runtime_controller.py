"""
app/runtime/runtime_controller.py
===================================
Central controller for the POST /runtime/command endpoint.

Orchestrates: validate → route → dispatch → return task info.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from app.queue.task_state_store import get_task_state_store
from app.runtime.command_router import route
from app.runtime.command_schema import (
    CommandType,
    RuntimeCommandRequest,
    RuntimeCommandResponse,
    TaskStatus,
    TaskStatusResponse,
)
from app.runtime.command_validator import validate_command, validate_params
from app.runtime.error_manager import CommandValidationError
from app.runtime.task_dispatcher import get_dispatcher

logger = logging.getLogger(__name__)


class RuntimeController:
    """
    Entry point for all runtime commands.

    Typical call flow::

        controller = RuntimeController()
        response = controller.execute(request)
    """

    def __init__(self):
        self._dispatcher = get_dispatcher()
        self._state_store = get_task_state_store()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def execute(self, request: RuntimeCommandRequest) -> RuntimeCommandResponse:
        """
        Validate, route and dispatch a command.

        :raises: CommandValidationError, TaskDispatchError
        """
        # 1. Validate raw command text
        validation = validate_command(request.command, request.params)
        if not validation.valid:
            raise CommandValidationError(
                "Command validation failed",
                errors=validation.errors,
            )

        # 2. Route the command
        routing = route(request.command)
        command_type: CommandType = (
            request.command_type if request.command_type else routing["command_type"]
        )
        agent: str = routing["agent"]
        merged_params: Dict[str, Any] = {**routing["params"], **(request.params or {})}

        # 3. Validate params for the resolved command type
        params_ok, param_errors = validate_params(command_type.value, merged_params)
        if not params_ok:
            raise CommandValidationError(
                "Parameter validation failed",
                errors=param_errors,
            )

        # 4. Dispatch to queue
        task_id = self._dispatcher.dispatch(
            command=request.command,
            command_type=command_type,
            agent=agent,
            params=merged_params,
            priority=request.priority,
            timeout_seconds=request.timeout_seconds,
        )

        logger.info(
            "runtime_command_accepted",
            extra={
                "task_id": task_id,
                "command_type": command_type.value,
                "agent": agent,
            },
        )

        return RuntimeCommandResponse(
            task_id=task_id,
            status=TaskStatus.QUEUED,
            command_type=command_type,
            agent=agent,
            message=f"Task {task_id} enqueued for agent {agent!r}",
            params=merged_params,
        )

    def get_task_status(self, task_id: str) -> Optional[TaskStatusResponse]:
        """
        Retrieve the current status of a previously submitted task.

        :returns: TaskStatusResponse or None if task_id is unknown.
        """
        state = self._state_store.get(task_id)
        if state is None:
            return None

        return TaskStatusResponse(
            task_id=task_id,
            status=TaskStatus(state.get("status", TaskStatus.PENDING.value)),
            command_type=(
                CommandType(state["command_type"])
                if state.get("command_type")
                else None
            ),
            agent=state.get("agent"),
            created_at=state.get("created_at"),
            started_at=state.get("started_at"),
            completed_at=state.get("completed_at"),
            result=state.get("result"),
            error=state.get("error"),
            logs=state.get("logs", []),
            retries=state.get("retries", 0),
        )

    def list_tasks(self) -> Dict[str, Any]:
        """Return all task states (debug / observability endpoint)."""
        return self._state_store.list_all()


# Shared singleton
_controller = RuntimeController()


def get_runtime_controller() -> RuntimeController:
    """Return the shared RuntimeController instance."""
    return _controller
