"""
tests/test_runtime_command.py
===============================
Tests for the runtime command API endpoints and supporting modules.
"""

import pytest

# ---------------------------------------------------------------------------
# POST /runtime/command
# ---------------------------------------------------------------------------


def test_runtime_command_scrape(client):
    """Happy path: scrape command returns 202 with task_id."""
    resp = client.post(
        "/api/v1/runtime/command",
        json={"command": "scrape epoxy contractors in Texas"},
    )
    assert resp.status_code == 202
    data = resp.json()
    assert "task_id" in data
    assert data["status"] == "queued"
    assert data["command_type"] == "scrape_website"
    assert data["agent"] == "scraper"
    assert data["task_id"] != ""


def test_runtime_command_generate_code(client):
    resp = client.post(
        "/api/v1/runtime/command",
        json={"command": "generate code for a lead scoring function"},
    )
    assert resp.status_code == 202
    data = resp.json()
    assert data["command_type"] == "generate_code"
    assert data["agent"] == "code"


def test_runtime_command_seo(client):
    resp = client.post(
        "/api/v1/runtime/command",
        json={"command": "run seo analysis on the website"},
    )
    assert resp.status_code == 202
    data = resp.json()
    assert data["command_type"] == "seo_analysis"


def test_runtime_command_export(client):
    resp = client.post(
        "/api/v1/runtime/command",
        json={"command": "export leads to CSV"},
    )
    assert resp.status_code == 202
    data = resp.json()
    assert data["command_type"] == "export"


def test_runtime_command_outreach(client):
    resp = client.post(
        "/api/v1/runtime/command",
        json={"command": "run outreach campaign"},
    )
    assert resp.status_code == 202
    data = resp.json()
    assert data["command_type"] == "outreach"


def test_runtime_command_empty_fails(client):
    """Empty command should return 422."""
    resp = client.post("/api/v1/runtime/command", json={"command": "   "})
    assert resp.status_code == 422


def test_runtime_command_too_long_fails(client):
    """Command exceeding 2000 chars should fail validation."""
    resp = client.post("/api/v1/runtime/command", json={"command": "x" * 2001})
    assert resp.status_code == 422


def test_runtime_command_missing_body_fails(client):
    resp = client.post("/api/v1/runtime/command", json={})
    assert resp.status_code == 422


def test_runtime_command_explicit_type(client):
    """Caller can override auto-detected command type."""
    resp = client.post(
        "/api/v1/runtime/command",
        json={
            "command": "scrape contractors ohio",
            "command_type": "seo_analysis",
        },
    )
    assert resp.status_code == 202
    data = resp.json()
    assert data["command_type"] == "seo_analysis"


def test_runtime_command_with_extra_params(client):
    resp = client.post(
        "/api/v1/runtime/command",
        json={
            "command": "scrape flooring contractors in Ohio",
            "params": {"max_results": 50},
        },
    )
    assert resp.status_code == 202
    data = resp.json()
    assert data["params"].get("max_results") == 50


def test_runtime_command_priority_range(client):
    """Priority must be 1-10."""
    resp = client.post(
        "/api/v1/runtime/command",
        json={"command": "scrape contractors", "priority": 11},
    )
    assert resp.status_code == 422


def test_runtime_command_blocked_pattern(client):
    """Commands with unsafe patterns should be rejected."""
    resp = client.post(
        "/api/v1/runtime/command",
        json={"command": "run rm -rf /etc now"},
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /runtime/task/{task_id}
# ---------------------------------------------------------------------------


def test_get_task_not_found(client):
    resp = client.get("/api/v1/runtime/task/nonexistent-task-id")
    assert resp.status_code == 404


def test_get_task_after_submit(client):
    """A submitted task should be retrievable by task_id."""
    post_resp = client.post(
        "/api/v1/runtime/command",
        json={"command": "scrape roofing contractors in Florida"},
    )
    assert post_resp.status_code == 202
    task_id = post_resp.json()["task_id"]

    get_resp = client.get(f"/api/v1/runtime/task/{task_id}")
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert data["task_id"] == task_id
    assert data["status"] in ("queued", "pending", "running", "completed")
    assert "created_at" in data


# ---------------------------------------------------------------------------
# GET /system/health
# ---------------------------------------------------------------------------


def test_system_health(client):
    resp = client.get("/api/v1/system/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert data["status"] in ("healthy", "degraded")
    assert "dependencies" in data
    assert "uptime_seconds" in data


# ---------------------------------------------------------------------------
# GET /system/metrics
# ---------------------------------------------------------------------------


def test_system_metrics(client):
    resp = client.get("/api/v1/system/metrics")
    assert resp.status_code == 200
    data = resp.json()
    assert "workers" in data
    assert "queue" in data
    assert "application" in data


# ---------------------------------------------------------------------------
# GET /system/tasks
# ---------------------------------------------------------------------------


def test_system_tasks(client):
    resp = client.get("/api/v1/system/tasks")
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data
    assert "tasks" in data
    assert isinstance(data["total"], int)


def test_system_tasks_includes_submitted(client):
    """A submitted task should appear in /system/tasks."""
    post_resp = client.post(
        "/api/v1/runtime/command",
        json={"command": "scrape contractors Texas"},
    )
    task_id = post_resp.json()["task_id"]

    tasks_resp = client.get("/api/v1/system/tasks")
    data = tasks_resp.json()
    assert task_id in data["tasks"]


# ---------------------------------------------------------------------------
# Unit: command_router
# ---------------------------------------------------------------------------


def test_command_router_scrape():
    from app.runtime.command_router import route

    result = route("scrape epoxy contractors in Ohio")
    assert result["agent"] == "scraper"
    assert result["command_type"].value == "scrape_website"


def test_command_router_seo():
    from app.runtime.command_router import route

    result = route("seo analysis for my website")
    assert result["agent"] == "seo"


def test_command_router_code():
    from app.runtime.command_router import route

    result = route("generate code for a new function")
    assert result["agent"] == "code"


def test_command_router_social():
    from app.runtime.command_router import route

    result = route("post social media update about our services")
    assert result["agent"] == "media"


def test_command_router_unknown():
    from app.runtime.command_router import route

    result = route("this is an unrecognised command xyz")
    assert result["command_type"].value == "unknown"


# ---------------------------------------------------------------------------
# Unit: command_validator
# ---------------------------------------------------------------------------


def test_validator_passes_normal_command():
    from app.runtime.command_validator import validate_command

    result = validate_command("scrape contractors in Texas")
    assert result.valid is True
    assert result.errors == []


def test_validator_blocks_empty_command():
    from app.runtime.command_validator import validate_command

    result = validate_command("")
    assert result.valid is False


def test_validator_blocks_rm_rf():
    from app.runtime.command_validator import validate_command

    result = validate_command("please run rm -rf /")
    assert result.valid is False


def test_validator_blocks_eval():
    from app.runtime.command_validator import validate_command

    result = validate_command("eval(malicious_code)")
    assert result.valid is False


def test_validator_blocks_too_long():
    from app.runtime.command_validator import validate_command

    result = validate_command("x" * 2001)
    assert result.valid is False


# ---------------------------------------------------------------------------
# Unit: retry_policy
# ---------------------------------------------------------------------------


def test_retry_policy_success_first_try():
    from app.runtime.retry_policy import RetryPolicy

    policy = RetryPolicy(max_retries=3)
    calls = []

    def success(*_):
        calls.append(1)
        return "ok"

    result = policy.execute(success)
    assert result == "ok"
    assert len(calls) == 1


def test_retry_policy_retries_on_failure():
    from app.runtime.retry_policy import RetryPolicy

    policy = RetryPolicy(max_retries=3, base_delay=0, backoff_factor=1)
    attempts = []

    def flaky():
        attempts.append(1)
        if len(attempts) < 3:
            raise ValueError("temporary failure")
        return "recovered"

    result = policy.execute(flaky)
    assert result == "recovered"
    assert len(attempts) == 3


def test_retry_policy_exhausted():
    from app.runtime.retry_policy import RetryPolicy

    policy = RetryPolicy(max_retries=2, base_delay=0, backoff_factor=1)

    def always_fails():
        raise RuntimeError("always fails")

    with pytest.raises(RuntimeError, match="always fails"):
        policy.execute(always_fails)


def test_retry_delay_increases():
    from app.runtime.retry_policy import RetryPolicy

    policy = RetryPolicy(base_delay=1.0, backoff_factor=2.0, max_delay=100.0)
    assert policy.delay_for_attempt(1) == 1.0
    assert policy.delay_for_attempt(2) == 2.0
    assert policy.delay_for_attempt(3) == 4.0


# ---------------------------------------------------------------------------
# Unit: task_state_store
# ---------------------------------------------------------------------------


def test_task_state_store_save_and_get():
    from app.queue.task_state_store import TaskStateStore

    store = TaskStateStore(prefix="test:")
    store.save("task-001", {"status": "queued", "command": "test"})
    state = store.get("task-001")
    assert state is not None
    assert state["status"] == "queued"


def test_task_state_store_update():
    from app.queue.task_state_store import TaskStateStore

    store = TaskStateStore(prefix="test:")
    store.save("task-002", {"status": "queued"})
    store.update("task-002", {"status": "running"})
    state = store.get("task-002")
    assert state["status"] == "running"


def test_task_state_store_not_found():
    from app.queue.task_state_store import TaskStateStore

    store = TaskStateStore(prefix="test:")
    assert store.get("nonexistent") is None


# ---------------------------------------------------------------------------
# Unit: sandbox
# ---------------------------------------------------------------------------


def test_sandbox_filesystem_guard_allows_tmp():
    from app.sandbox.filesystem_guard import FilesystemGuard

    guard = FilesystemGuard(allowed_paths=["/tmp"])
    assert guard.is_path_allowed("/tmp/output.txt") is True


def test_sandbox_filesystem_guard_blocks_etc():
    from app.sandbox.filesystem_guard import FilesystemGuard

    guard = FilesystemGuard(allowed_paths=["/tmp"])
    assert guard.is_path_allowed("/etc/passwd") is False


def test_sandbox_network_guard_allows_when_enabled():
    from app.sandbox.network_guard import NetworkGuard

    guard = NetworkGuard(network_allowed=True)
    assert guard.is_host_allowed("example.com") is True


def test_sandbox_network_guard_blocks_when_disabled():
    from app.sandbox.network_guard import NetworkGuard

    guard = NetworkGuard(network_allowed=False)
    assert guard.is_host_allowed("example.com") is False


def test_sandbox_executor_runs_handler():
    from app.sandbox.sandbox_executor import SandboxExecutor

    executor = SandboxExecutor()
    task = {"task_id": "sandbox-test"}

    def handler(t):
        return {"ok": True}

    result = executor.run(task, handler)
    assert result["error"] is None
    assert result["result"]["ok"] is True


def test_sandbox_executor_captures_error():
    from app.sandbox.sandbox_executor import SandboxExecutor

    executor = SandboxExecutor()
    task = {"task_id": "sandbox-fail"}

    def bad_handler(t):
        raise ValueError("intentional failure")

    result = executor.run(task, bad_handler)
    assert result["error"] is not None
    assert "intentional failure" in result["error"]
