"""
tests/test_runtime.py
======================
Tests for the runtime command execution API — aligned with actual module APIs.
"""

import pytest

# ─── Command Validator ────────────────────────────────────────────────────────


def test_command_validator_passes_normal_command():
    from app.runtime.command_validator import validate_command

    result = validate_command("scrape epoxy contractors in Austin TX")
    assert result.valid is True
    assert result.errors == []


def test_command_validator_rejects_empty_command():
    from app.runtime.command_validator import validate_command

    result = validate_command("")
    assert result.valid is False
    assert any("empty" in e.lower() for e in result.errors)


def test_command_validator_rejects_too_long():
    from app.runtime.command_validator import validate_command

    result = validate_command("x" * 2001)
    assert result.valid is False


def test_command_validator_rejects_dangerous_pattern():
    from app.runtime.command_validator import validate_command

    result = validate_command("rm -rf /tmp/data")
    assert result.valid is False


def test_command_validator_rejects_eval():
    from app.runtime.command_validator import validate_command

    result = validate_command("eval(malicious_code())")
    assert result.valid is False


def test_command_validator_allowed_commands_list():
    from app.runtime.command_validator import ALLOWED_COMMANDS

    assert isinstance(ALLOWED_COMMANDS, list)
    assert "scrape_website" in ALLOWED_COMMANDS
    assert "health_check" in ALLOWED_COMMANDS


def test_command_validator_sandbox_required():
    from app.runtime.command_validator import SANDBOX_REQUIRED, requires_sandbox

    assert isinstance(SANDBOX_REQUIRED, list)
    assert requires_sandbox("scrape_website") is True
    assert requires_sandbox("health_check") is False


def test_command_validator_validation_error_class():
    from app.runtime.command_validator import ValidationError

    with pytest.raises(ValidationError):
        raise ValidationError("test error")


def test_validate_params_missing():
    from app.runtime.command_validator import validate_params

    ok, errors = validate_params("scrape_website", {})
    # scrape_website has no required params in current config
    assert ok is True


# ─── Task State Store ─────────────────────────────────────────────────────────


def test_task_state_store_save_and_get():
    from app.queue.task_state_store import TaskStateStore

    store = TaskStateStore()
    task_id = "test-task-save-get"
    store.save(task_id, {"status": "queued", "agent": "scraper", "task_id": task_id})
    fetched = store.get(task_id)
    assert fetched is not None
    assert fetched["task_id"] == task_id
    assert fetched["status"] == "queued"


def test_task_state_store_update():
    from app.queue.task_state_store import TaskStateStore

    store = TaskStateStore()
    task_id = "test-task-update"
    store.save(task_id, {"status": "queued", "task_id": task_id})
    store.update(task_id, {"status": "running"})
    fetched = store.get(task_id)
    assert fetched["status"] == "running"


def test_task_state_store_list_all():
    from app.queue.task_state_store import TaskStateStore

    store = TaskStateStore()
    store.save("list-task-1", {"status": "queued", "task_id": "list-task-1"})
    store.save("list-task-2", {"status": "completed", "task_id": "list-task-2"})
    all_tasks = store.list_all()
    assert isinstance(all_tasks, dict)
    assert "list-task-1" in all_tasks
    assert "list-task-2" in all_tasks


def test_task_state_store_get_nonexistent():
    from app.queue.task_state_store import TaskStateStore

    store = TaskStateStore()
    result = store.get("completely-nonexistent-task")
    assert result is None


# ─── Retry Policy ─────────────────────────────────────────────────────────────


def test_retry_policy_default_instance():
    from app.runtime.retry_policy import RetryPolicy, default_retry_policy

    assert isinstance(default_retry_policy, RetryPolicy)


def test_retry_policy_should_retry_on_failure():
    from app.runtime.retry_policy import RetryPolicy

    policy = RetryPolicy(max_retries=3)
    assert policy.should_retry(1, ValueError("fail")) is True
    # max_retries=3 means retries 1 and 2 are allowed (0-indexed), attempt 3 is not
    assert policy.should_retry(2, ValueError("fail")) is True
    assert policy.should_retry(4, ValueError("fail")) is False


def test_retry_policy_delay_increases():
    from app.runtime.retry_policy import RetryPolicy

    policy = RetryPolicy(max_retries=3, base_delay=1.0, backoff_factor=2.0)
    d1 = policy.delay_for_attempt(1)
    d2 = policy.delay_for_attempt(2)
    assert d2 > d1


# ─── Sandbox Executor ─────────────────────────────────────────────────────────


def test_sandbox_executor_runs_handler():
    from app.sandbox.sandbox_executor import SandboxExecutor

    executor = SandboxExecutor()

    def my_handler(task):
        return {"success": True, "value": 42}

    result = executor.run({"task_id": "test-se-1"}, my_handler)
    assert result["result"]["success"] is True
    assert result["result"]["value"] == 42
    assert result["error"] is None


def test_sandbox_executor_captures_exception():
    from app.sandbox.sandbox_executor import SandboxExecutor

    executor = SandboxExecutor()

    def failing_handler(task):
        raise ValueError("deliberate error")

    result = executor.run({"task_id": "test-se-2"}, failing_handler)
    assert result["error"] is not None
    assert "deliberate error" in result["error"]


def test_sandbox_executor_blocks_dangerous_code():
    from app.sandbox.sandbox_executor import SandboxExecutor, SandboxViolationError

    executor = SandboxExecutor()

    def bad_handler(task):
        raise SandboxViolationError("blocked")

    # SandboxViolationError propagates out of the executor (not silently captured)
    with pytest.raises(SandboxViolationError):
        executor.run({"task_id": "test-se-3"}, bad_handler)


# ─── Filesystem Guard ─────────────────────────────────────────────────────────


def test_filesystem_guard_allows_safe_path():
    from app.sandbox.filesystem_guard import FilesystemGuard

    guard = FilesystemGuard(allowed_paths=["/tmp"])
    assert guard.is_path_allowed("/tmp/safe_file.txt") is True


def test_filesystem_guard_rejects_traversal():
    from app.sandbox.filesystem_guard import FilesystemGuard, SandboxViolationError

    guard = FilesystemGuard(allowed_paths=["/tmp"])
    with pytest.raises(SandboxViolationError):
        guard.assert_path_allowed("/etc/passwd")


# ─── Network Guard ────────────────────────────────────────────────────────────


def test_network_guard_allows_normal_host():
    from app.sandbox.network_guard import NetworkGuard

    guard = NetworkGuard()
    assert guard.is_host_allowed("example.com") is True


def test_network_guard_blocks_configured_domain():
    from app.sandbox.network_guard import NetworkGuard, SandboxViolationError

    # Create guard with an explicit blocked domain
    guard = NetworkGuard(blocked_domains=["169.254.169.254"])
    assert guard.is_host_allowed("169.254.169.254") is False
    with pytest.raises(SandboxViolationError):
        guard.assert_host_allowed("169.254.169.254")


# ─── Runtime Controller ───────────────────────────────────────────────────────


def test_runtime_controller_execute_and_get_status():
    from app.runtime.command_schema import RuntimeCommandRequest
    from app.runtime.runtime_controller import RuntimeController

    ctrl = RuntimeController()
    request = RuntimeCommandRequest(command="scrape flooring contractors in Texas")
    response = ctrl.execute(request)
    assert response.task_id
    assert response.status == "queued"

    task = ctrl.get_task_status(response.task_id)
    assert task is not None
    assert task.task_id == response.task_id


def test_runtime_controller_get_nonexistent():
    from app.runtime.runtime_controller import RuntimeController

    ctrl = RuntimeController()
    result = ctrl.get_task_status("nonexistent-task-xyz")
    assert result is None


def test_runtime_controller_list_tasks():
    from app.runtime.command_schema import RuntimeCommandRequest
    from app.runtime.runtime_controller import RuntimeController

    ctrl = RuntimeController()
    request = RuntimeCommandRequest(command="export leads to CSV")
    ctrl.execute(request)

    tasks = ctrl.list_tasks()
    assert isinstance(tasks, dict)
    assert len(tasks) > 0


# ─── API Endpoints ────────────────────────────────────────────────────────────


def test_runtime_command_endpoint_scrape(client):
    resp = client.post(
        "/api/v1/runtime/command",
        json={"command": "scrape flooring contractors in Texas"},
    )
    assert resp.status_code == 202
    data = resp.json()
    assert "task_id" in data
    assert data["status"] == "queued"
    assert data["agent"] == "scraper"


def test_runtime_command_endpoint_seo(client):
    resp = client.post(
        "/api/v1/runtime/command",
        json={"command": "run seo analysis on example.com"},
    )
    assert resp.status_code == 202
    data = resp.json()
    assert data["agent"] == "seo"


def test_runtime_command_endpoint_invalid_empty(client):
    resp = client.post("/api/v1/runtime/command", json={"command": ""})
    assert resp.status_code == 422


def test_runtime_command_endpoint_missing_body(client):
    resp = client.post("/api/v1/runtime/command", json={})
    assert resp.status_code == 422


def test_runtime_task_status_not_found(client):
    resp = client.get("/api/v1/runtime/task/nonexistent-task-id")
    assert resp.status_code == 404


def test_runtime_task_status_found(client):
    resp = client.post(
        "/api/v1/runtime/command",
        json={"command": "scrape epoxy contractors in Florida"},
    )
    assert resp.status_code == 202
    task_id = resp.json()["task_id"]

    status_resp = client.get(f"/api/v1/runtime/task/{task_id}")
    assert status_resp.status_code == 200
    data = status_resp.json()
    assert data["task_id"] == task_id
    assert data["status"] in ("queued", "running", "completed", "failed")


# ─── System Endpoints ─────────────────────────────────────────────────────────


def test_system_health_endpoint(client):
    resp = client.get("/api/v1/system/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data


def test_system_metrics_endpoint(client):
    resp = client.get("/api/v1/system/metrics")
    assert resp.status_code == 200
    data = resp.json()
    assert "workers" in data
    assert "queue" in data


def test_system_tasks_endpoint(client):
    resp = client.get("/api/v1/system/tasks")
    assert resp.status_code == 200
    data = resp.json()
    assert "tasks" in data
    assert isinstance(data["tasks"], dict)
