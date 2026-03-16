"""
test_admin_api.py — Tests for the hidden admin governance API.

Exercises:
  - User CRUD (create, list, update, delete/suspend)
  - Feature management (create, toggle, delete)
  - Settings upsert + masking of encrypted values
  - Promotion lifecycle
  - Invoice listing
  - Integration upsert + connection test
  - Health snapshot listing
  - Copilot prompt read + write
  - Multi-agent spawn
  - Audit log
  - Auth enforcement (missing / wrong token → 403)
"""

import json
import os

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_admin.db")
os.environ.setdefault("ADMIN_SECRET", "test-admin-secret")

# Patch PostgreSQL-specific types for SQLite compatibility (same as conftest).
import sqlalchemy  # noqa: E402
from sqlalchemy.dialects import postgresql as _pg  # noqa: E402
from sqlalchemy.types import Text, TypeDecorator  # noqa: E402


class _JSONArray(TypeDecorator):
    impl = Text
    cache_ok = True

    def __init__(self, *args, **kwargs):
        TypeDecorator.__init__(self)

    def process_bind_param(self, value, dialect):
        return json.dumps(value) if value is not None else None

    def process_result_value(self, value, dialect):
        return json.loads(value) if value is not None else []


class _StringUUID(TypeDecorator):
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return str(value) if value is not None else None

    def process_result_value(self, value, dialect):
        return value


sqlalchemy.ARRAY = _JSONArray
_pg.ARRAY = lambda *a, **kw: _JSONArray()
_pg.UUID = lambda *a, **kw: _StringUUID()
_pg.JSONB = lambda *a, **kw: Text()

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402

ADMIN_HEADERS = {"X-Admin-Token": "test-admin-secret"}

TEST_DATABASE_URL = "sqlite:///./test_admin.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Auth enforcement
# ---------------------------------------------------------------------------


def test_auth_required_no_token(client):
    resp = client.get("/api/v1/admin/hidden/users")
    assert resp.status_code == 403


def test_auth_required_wrong_token(client):
    resp = client.get("/api/v1/admin/hidden/users", headers={"X-Admin-Token": "wrong"})
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


def test_list_users_empty(client):
    resp = client.get("/api/v1/admin/hidden/users", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_create_user(client):
    payload = {
        "email": "sales@xps.ai",
        "full_name": "Sales Rep",
        "role": "sales",
        "subscription_plan": "pro",
        "hashed_password": "hashed123",
    }
    resp = client.post(
        "/api/v1/admin/hidden/users", json=payload, headers=ADMIN_HEADERS
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "sales@xps.ai"
    assert "id" in data


def test_create_user_duplicate(client):
    payload = {
        "email": "dup@xps.ai",
        "hashed_password": "x",
    }
    client.post("/api/v1/admin/hidden/users", json=payload, headers=ADMIN_HEADERS)
    resp = client.post(
        "/api/v1/admin/hidden/users", json=payload, headers=ADMIN_HEADERS
    )
    assert resp.status_code == 409


def test_update_user(client):
    create_resp = client.post(
        "/api/v1/admin/hidden/users",
        json={"email": "update@xps.ai", "hashed_password": "x"},
        headers=ADMIN_HEADERS,
    )
    user_id = create_resp.json()["id"]
    resp = client.put(
        f"/api/v1/admin/hidden/users/{user_id}",
        json={"role": "admin", "is_active": True},
        headers=ADMIN_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["updated"] is True


def test_suspend_user(client):
    create_resp = client.post(
        "/api/v1/admin/hidden/users",
        json={"email": "suspend@xps.ai", "hashed_password": "x"},
        headers=ADMIN_HEADERS,
    )
    user_id = create_resp.json()["id"]
    resp = client.delete(
        f"/api/v1/admin/hidden/users/{user_id}?suspend=true",
        headers=ADMIN_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["action"] == "suspend_user"


def test_delete_user(client):
    create_resp = client.post(
        "/api/v1/admin/hidden/users",
        json={"email": "delete@xps.ai", "hashed_password": "x"},
        headers=ADMIN_HEADERS,
    )
    user_id = create_resp.json()["id"]
    resp = client.delete(
        f"/api/v1/admin/hidden/users/{user_id}",
        headers=ADMIN_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["action"] == "delete_user"


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------


def test_get_analytics(client):
    resp = client.get("/api/v1/admin/hidden/analytics", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert "users" in data
    assert "health" in data
    assert "analytics" in data


# ---------------------------------------------------------------------------
# Features
# ---------------------------------------------------------------------------


def test_create_and_list_features(client):
    payload = {
        "name": "lead-scoring",
        "description": "Score all incoming leads",
        "enabled": True,
        "role_access": ["owner", "admin", "sales"],
        "position": 1,
        "cost_monthly": 0.0,
    }
    resp = client.post(
        "/api/v1/admin/hidden/features", json=payload, headers=ADMIN_HEADERS
    )
    assert resp.status_code == 201

    list_resp = client.get("/api/v1/admin/hidden/features", headers=ADMIN_HEADERS)
    assert list_resp.status_code == 200
    names = [f["name"] for f in list_resp.json()]
    assert "lead-scoring" in names


def test_toggle_feature(client):
    create_resp = client.post(
        "/api/v1/admin/hidden/features",
        json={"name": "social-agent", "enabled": True},
        headers=ADMIN_HEADERS,
    )
    feature_id = create_resp.json()["id"]
    resp = client.put(
        f"/api/v1/admin/hidden/features/{feature_id}",
        json={"enabled": False},
        headers=ADMIN_HEADERS,
    )
    assert resp.status_code == 200


def test_delete_feature(client):
    create_resp = client.post(
        "/api/v1/admin/hidden/features",
        json={"name": "temp-feature"},
        headers=ADMIN_HEADERS,
    )
    feature_id = create_resp.json()["id"]
    resp = client.delete(
        f"/api/v1/admin/hidden/features/{feature_id}", headers=ADMIN_HEADERS
    )
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------


def test_upsert_and_list_settings(client):
    resp = client.put(
        "/api/v1/admin/hidden/settings/stripe_public_key",
        json={
            "value": "pk_test_123",
            "category": "payments",
            "updated_by": "owner@xps.ai",
        },
        headers=ADMIN_HEADERS,
    )
    assert resp.status_code == 200

    list_resp = client.get("/api/v1/admin/hidden/settings", headers=ADMIN_HEADERS)
    assert list_resp.status_code == 200
    keys = [s["key"] for s in list_resp.json()]
    assert "stripe_public_key" in keys


def test_encrypted_setting_masked(client):
    client.put(
        "/api/v1/admin/hidden/settings/secret_key",
        json={"value": "super-secret", "is_encrypted": True, "updated_by": "owner"},
        headers=ADMIN_HEADERS,
    )
    list_resp = client.get("/api/v1/admin/hidden/settings", headers=ADMIN_HEADERS)
    for s in list_resp.json():
        if s["key"] == "secret_key":
            assert s["value"] == "***"


# ---------------------------------------------------------------------------
# Promotions
# ---------------------------------------------------------------------------


def test_create_and_list_promotions(client):
    payload = {
        "code": "EPOXY20",
        "type": "percentage",
        "discount": 20.0,
        "description": "20% off for epoxy partners",
        "created_by": "admin",
    }
    resp = client.post(
        "/api/v1/admin/hidden/promotions", json=payload, headers=ADMIN_HEADERS
    )
    assert resp.status_code == 201
    assert resp.json()["code"] == "EPOXY20"

    list_resp = client.get("/api/v1/admin/hidden/promotions", headers=ADMIN_HEADERS)
    codes = [p["code"] for p in list_resp.json()]
    assert "EPOXY20" in codes


def test_delete_promotion(client):
    create_resp = client.post(
        "/api/v1/admin/hidden/promotions",
        json={
            "code": "DELTEST",
            "type": "fixed",
            "discount": 10.0,
            "created_by": "admin",
        },
        headers=ADMIN_HEADERS,
    )
    promo_id = create_resp.json()["id"]
    resp = client.delete(
        f"/api/v1/admin/hidden/promotions/{promo_id}", headers=ADMIN_HEADERS
    )
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True


# ---------------------------------------------------------------------------
# Payments
# ---------------------------------------------------------------------------


def test_list_invoices_empty(client):
    resp = client.get("/api/v1/admin/hidden/payments/invoices", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ---------------------------------------------------------------------------
# Integrations
# ---------------------------------------------------------------------------


def test_upsert_and_list_integrations(client):
    payload = {
        "api_name": "google",
        "display_name": "Google Maps API",
        "endpoint": "https://maps.googleapis.com/maps/api/place",
        "credentials": {"api_key": "AIza_test"},
    }
    resp = client.post(
        "/api/v1/admin/hidden/integrations", json=payload, headers=ADMIN_HEADERS
    )
    assert resp.status_code == 201
    assert resp.json()["api_name"] == "google"

    list_resp = client.get("/api/v1/admin/hidden/integrations", headers=ADMIN_HEADERS)
    api_names = [i["api_name"] for i in list_resp.json()]
    assert "google" in api_names


def test_test_integration(client):
    create_resp = client.post(
        "/api/v1/admin/hidden/integrations",
        json={"api_name": "vercel", "display_name": "Vercel Deployments"},
        headers=ADMIN_HEADERS,
    )
    integration_id = create_resp.json()["id"]
    resp = client.post(
        f"/api/v1/admin/hidden/integrations/{integration_id}/test",
        headers=ADMIN_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["reachable"] is True


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


def test_get_health(client):
    resp = client.get("/api/v1/admin/hidden/health", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    assert "snapshots" in resp.json()


# ---------------------------------------------------------------------------
# Copilot prompt
# ---------------------------------------------------------------------------


def test_get_copilot_prompt(client):
    resp = client.get("/api/v1/admin/hidden/copilot/prompt", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    assert "content" in resp.json()


def test_update_copilot_prompt(client, tmp_path, monkeypatch):
    import app.api.v1.admin as admin_module

    tmp_prompt = tmp_path / "COPILOT_PROMPT.md"
    tmp_prompt.write_text("# Old content", encoding="utf-8")
    monkeypatch.setattr(admin_module, "COPILOT_PROMPT_PATH", tmp_prompt)

    resp = client.put(
        "/api/v1/admin/hidden/copilot/prompt",
        json={"content": "# New content", "commit_message": "test update"},
        headers=ADMIN_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["saved"] is True
    assert tmp_prompt.read_text() == "# New content"


# ---------------------------------------------------------------------------
# Multi-agent spawn
# ---------------------------------------------------------------------------


def test_spawn_agents(client):
    payload = {
        "task": "build payment module",
        "agent_count": 3,
        "branch_prefix": "copilot/payment",
    }
    resp = client.post(
        "/api/v1/admin/hidden/copilot/spawn", json=payload, headers=ADMIN_HEADERS
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["agent_count"] == 3
    assert len(data["branches"]) == 3
    assert data["status"] == "queued"


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------


def test_audit_log_populated(client):
    # Perform an action that writes to audit log
    client.post(
        "/api/v1/admin/hidden/users",
        json={"email": "audit@xps.ai", "hashed_password": "x"},
        headers=ADMIN_HEADERS,
    )
    resp = client.get("/api/v1/admin/hidden/audit-log", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    logs = resp.json()
    assert len(logs) > 0
    assert "action" in logs[0]
    assert "actor_email" in logs[0]
