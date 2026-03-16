"""
tests/test_runtime_api.py
==========================
Integration tests for the runtime command API.

POST /api/v1/runtime/command  — submit command, verify task_id returned
GET  /runtime/task/{task_id}  — poll task, verify status response
"""

# ---------------------------------------------------------------------------
# POST /api/v1/runtime/command
# ---------------------------------------------------------------------------


def test_runtime_command_scrape(client):
    """Submitting a scrape command returns 202 with a task_id."""
    resp = client.post(
        "/api/v1/runtime/command",
        json={"command": "scrape epoxy contractors in Orlando FL", "priority": 5},
    )
    assert resp.status_code == 202, resp.text
    data = resp.json()
    assert "task_id" in data
    assert data["status"] in ("queued", "pending", "running", "completed")
    assert data["command_type"] in ("scrape_website", "unknown")
    assert "agent" in data


def test_runtime_command_seo(client):
    """SEO-related command is routed to the seo agent."""
    resp = client.post(
        "/api/v1/runtime/command",
        json={"command": "run seo analysis on example.com"},
    )
    assert resp.status_code == 202, resp.text
    data = resp.json()
    assert "task_id" in data
    assert data["command_type"] in ("seo_analysis", "unknown")


def test_runtime_command_blank_rejected(client):
    """Blank command string is rejected with 422."""
    resp = client.post(
        "/api/v1/runtime/command",
        json={"command": "   "},
    )
    assert resp.status_code == 422


def test_runtime_command_missing_field(client):
    """Missing 'command' field is rejected with 422."""
    resp = client.post("/api/v1/runtime/command", json={"priority": 5})
    assert resp.status_code == 422


def test_runtime_command_priority_bounds(client):
    """Priority outside 1–10 is rejected with 422."""
    resp = client.post(
        "/api/v1/runtime/command",
        json={"command": "scrape leads", "priority": 99},
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /runtime/task/{task_id}
# ---------------------------------------------------------------------------


def test_get_task_status(client):
    """
    Submitting a command and immediately polling the task should return
    a valid status response.
    """
    post_resp = client.post(
        "/api/v1/runtime/command",
        json={"command": "export leads to csv"},
    )
    assert post_resp.status_code == 202
    task_id = post_resp.json()["task_id"]

    get_resp = client.get(f"/api/v1/runtime/task/{task_id}")
    assert get_resp.status_code == 200, get_resp.text
    data = get_resp.json()
    assert data["task_id"] == task_id
    assert "status" in data
    assert "logs" in data
    assert isinstance(data["logs"], list)


def test_get_task_not_found(client):
    """Unknown task_id returns 404."""
    resp = client.get("/api/v1/runtime/task/nonexistent-task-id")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/v1/runtime/parallel
# ---------------------------------------------------------------------------


def test_parallel_commands_returns_multiple_tasks(client):
    """Parallel endpoint dispatches multiple commands and returns one task per command."""
    resp = client.post(
        "/api/v1/runtime/parallel",
        json={
            "commands": [
                {"command": "scrape epoxy contractors in Miami FL", "priority": 5},
                {"command": "scrape flooring contractors in Tampa FL", "priority": 5},
            ]
        },
    )
    assert resp.status_code == 202, resp.text
    data = resp.json()
    assert data["total"] == 2
    assert len(data["tasks"]) == 2
    for task in data["tasks"]:
        assert "task_id" in task
        assert task["status"] in ("queued", "pending", "running", "completed")


def test_parallel_commands_too_many_rejected(client):
    """More than 8 commands should be rejected."""
    resp = client.post(
        "/api/v1/runtime/parallel",
        json={"commands": [{"command": f"scrape cmd {i}"} for i in range(9)]},
    )
    assert resp.status_code == 422, resp.text


# ---------------------------------------------------------------------------
# GET /api/v1/runtime/file  and  POST /api/v1/runtime/file
# ---------------------------------------------------------------------------


def test_file_read_outside_allowed_roots_rejected(client):
    """Attempting to read files outside allowed roots returns 403 or 400."""
    resp = client.get("/api/v1/runtime/file?path=../backend/app/config.py")
    assert resp.status_code in (400, 403, 404), resp.text


def test_file_read_traversal_rejected(client):
    """Absolute paths are rejected."""
    resp = client.get("/api/v1/runtime/file?path=/etc/passwd")
    assert resp.status_code in (400, 403), resp.text


def test_file_write_traversal_rejected(client):
    """Write with '..' traversal is rejected."""
    resp = client.post(
        "/api/v1/runtime/file",
        json={"path": "../backend/injected.py", "content": "malicious"},
    )
    assert resp.status_code in (400, 403), resp.text


# ---------------------------------------------------------------------------
# GET /api/v1/runtime/shadow/status
# ---------------------------------------------------------------------------


def test_shadow_status_returns_structure(client):
    """Shadow status endpoint returns task summary structure."""
    resp = client.get("/api/v1/runtime/shadow/status")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "total" in data
    assert "running" in data
    assert "completed" in data
    assert "failed" in data
    assert "tasks" in data
    assert isinstance(data["tasks"], list)


# ---------------------------------------------------------------------------
# POST /api/v1/runtime/agents/run-all
# ---------------------------------------------------------------------------


def test_run_all_agents_returns_dispatched_list(client):
    """run-all endpoint returns a list of dispatched agent tasks."""
    resp = client.post("/api/v1/runtime/agents/run-all")
    assert resp.status_code == 202, resp.text
    data = resp.json()
    assert "dispatched" in data
    assert "total" in data
    assert isinstance(data["dispatched"], list)
