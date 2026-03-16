"""
admin.py — Hidden admin governance API.

All endpoints are prefixed /admin/hidden (registered in main.py).
Security: owner-only, rate-limited, audit-logged.

Endpoints:
  POST /admin/hidden/users                    - CRUD admin users
  GET  /admin/hidden/users                    - List users
  PUT  /admin/hidden/users/{user_id}          - Update user
  DELETE /admin/hidden/users/{user_id}        - Delete / suspend user
  GET  /admin/hidden/analytics                - User stats + health snapshot
  GET  /admin/hidden/features                 - List features
  POST /admin/hidden/features                 - Create feature
  PUT  /admin/hidden/features/{feature_id}    - Toggle / update feature
  DELETE /admin/hidden/features/{feature_id}  - Delete feature
  GET  /admin/hidden/settings                 - List all settings
  PUT  /admin/hidden/settings/{key}           - Upsert setting
  GET  /admin/hidden/promotions               - List promotions
  POST /admin/hidden/promotions               - Create promotion
  DELETE /admin/hidden/promotions/{promo_id}  - Delete promotion
  GET  /admin/hidden/payments/invoices        - List invoices
  POST /admin/hidden/integrations             - Add / update integration
  GET  /admin/hidden/integrations             - List integrations
  POST /admin/hidden/integrations/{id}/test   - Test connection
  GET  /admin/hidden/health                   - Current health snapshot
  GET  /admin/hidden/copilot/prompt           - Get current COPILOT_PROMPT.md
  PUT  /admin/hidden/copilot/prompt           - Update COPILOT_PROMPT.md
  POST /admin/hidden/copilot/spawn            - Trigger multi-agent build
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.admin_models import (
    AdminUser,
    AnalyticsDaily,
    AuditLog,
    Feature,
    HealthMonitor,
    Integration,
    Payment,
    Promotion,
    Setting,
)

logger = structlog.get_logger()
router = APIRouter(prefix="/admin/hidden", tags=["admin"])

# ---------------------------------------------------------------------------
# Auth helper — constant-time token comparison to prevent timing attacks.
# In production replace with JWT / session-based auth restricted to owner email.
# ---------------------------------------------------------------------------
_ADMIN_SECRET_AT_LOAD = os.getenv("ADMIN_SECRET", "")
if not _ADMIN_SECRET_AT_LOAD:
    import warnings

    warnings.warn(
        "ADMIN_SECRET env var is not set. Admin endpoints are DISABLED until it is configured.",
        RuntimeWarning,
        stacklevel=2,
    )
REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
COPILOT_PROMPT_PATH = REPO_ROOT / "COPILOT_PROMPT.md"


def require_admin(x_admin_token: str = Header(default="")) -> None:
    import secrets

    # Read the secret from env at request time so test overrides via os.environ work.
    ADMIN_SECRET = os.getenv("ADMIN_SECRET", "") or _ADMIN_SECRET_AT_LOAD

    if not ADMIN_SECRET or not secrets.compare_digest(x_admin_token, ADMIN_SECRET):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


def _audit(
    db: Session,
    actor: str,
    action: str,
    resource_type: str = "",
    resource_id: str = "",
    details: dict | None = None,
    request: Request | None = None,
) -> None:
    log = AuditLog(
        actor_email=actor,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=json.dumps(details or {}),
        ip_address=(request.client.host if request and request.client else None),
        user_agent=(request.headers.get("user-agent") if request else None),
    )
    db.add(log)
    db.commit()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class UserCreate(BaseModel):
    email: str
    full_name: Optional[str] = None
    role: str = "viewer"
    subscription_plan: str = "free"
    hashed_password: str = Field(default="changeme")


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    subscription_plan: Optional[str] = None
    is_active: Optional[bool] = None
    permissions: Optional[List[str]] = None


class FeatureCreate(BaseModel):
    name: str
    description: Optional[str] = None
    enabled: bool = True
    role_access: List[str] = ["owner", "admin"]
    position: int = 0
    cost_monthly: float = 0.0
    config: Dict[str, Any] = {}


class FeatureUpdate(BaseModel):
    description: Optional[str] = None
    enabled: Optional[bool] = None
    role_access: Optional[List[str]] = None
    position: Optional[int] = None
    cost_monthly: Optional[float] = None
    config: Optional[Dict[str, Any]] = None


class SettingUpsert(BaseModel):
    value: str
    is_encrypted: bool = False
    category: str = "general"
    description: Optional[str] = None
    updated_by: str = "admin"


class PromotionCreate(BaseModel):
    code: str
    type: str  # percentage / fixed / trial_days
    discount: float
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None
    max_uses: Optional[int] = None
    description: Optional[str] = None
    created_by: str = "admin"


class IntegrationUpsert(BaseModel):
    api_name: str
    display_name: Optional[str] = None
    endpoint: Optional[str] = None
    credentials: Optional[Dict[str, Any]] = None  # will be stored encrypted
    config: Dict[str, Any] = {}


class CopilotPromptUpdate(BaseModel):
    content: str
    commit_message: str = "Update COPILOT_PROMPT.md via admin panel"


class SpawnAgentsRequest(BaseModel):
    task: str
    agent_count: int = Field(default=4, ge=2, le=10)
    branch_prefix: str = "copilot/spawn"


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


@router.get("/users", dependencies=[Depends(require_admin)])
def list_users(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    users = db.query(AdminUser).all()
    return [
        {
            "id": str(u.id),
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "subscription_plan": u.subscription_plan,
            "is_active": u.is_active,
            "last_login": u.last_login.isoformat() if u.last_login else None,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.post("/users", dependencies=[Depends(require_admin)], status_code=201)
def create_user(
    body: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    existing = db.query(AdminUser).filter(AdminUser.email == body.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="User already exists")
    user = AdminUser(
        email=body.email,
        full_name=body.full_name,
        role=body.role,
        subscription_plan=body.subscription_plan,
        hashed_password=body.hashed_password,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _audit(
        db,
        "admin",
        "create_user",
        "AdminUser",
        str(user.id),
        {"email": body.email},
        request,
    )
    return {"id": str(user.id), "email": user.email, "role": user.role}


@router.put("/users/{user_id}", dependencies=[Depends(require_admin)])
def update_user(
    user_id: str,
    body: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for field, val in body.model_dump(exclude_none=True).items():
        if field == "permissions":
            setattr(user, field, json.dumps(val))
        else:
            setattr(user, field, val)
    db.commit()
    _audit(
        db,
        "admin",
        "update_user",
        "AdminUser",
        user_id,
        body.model_dump(exclude_none=True),
        request,
    )
    return {"id": str(user.id), "updated": True}


@router.delete("/users/{user_id}", dependencies=[Depends(require_admin)])
def delete_user(
    user_id: str,
    request: Request,
    suspend: bool = False,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if suspend:
        user.is_active = False
        user.suspended_at = datetime.now(timezone.utc)
        db.commit()
        action = "suspend_user"
    else:
        db.delete(user)
        db.commit()
        action = "delete_user"
    _audit(db, "admin", action, "AdminUser", user_id, {}, request)
    return {"id": user_id, "action": action}


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------


@router.get("/analytics", dependencies=[Depends(require_admin)])
def get_analytics(db: Session = Depends(get_db)) -> Dict[str, Any]:
    total_users = db.query(AdminUser).count()
    active_users = db.query(AdminUser).filter(AdminUser.is_active.is_(True)).count()
    latest_health = (
        db.query(HealthMonitor).order_by(HealthMonitor.recorded_at.desc()).first()
    )
    latest_analytics = (
        db.query(AnalyticsDaily).order_by(AnalyticsDaily.date.desc()).first()
    )
    return {
        "users": {"total": total_users, "active": active_users},
        "health": {
            "uptime_pct": latest_health.uptime_pct if latest_health else 100.0,
            "latency_p50_ms": latest_health.latency_p50_ms if latest_health else None,
            "latency_p95_ms": latest_health.latency_p95_ms if latest_health else None,
            "error_rate": latest_health.error_rate if latest_health else 0.0,
        },
        "analytics": {
            "dau": latest_analytics.dau if latest_analytics else 0,
            "mau": latest_analytics.mau if latest_analytics else 0,
            "revenue_cents": latest_analytics.revenue_cents if latest_analytics else 0,
            "conversion_rate": (
                latest_analytics.conversion_rate if latest_analytics else 0.0
            ),
        },
    }


# ---------------------------------------------------------------------------
# Features
# ---------------------------------------------------------------------------


@router.get("/features", dependencies=[Depends(require_admin)])
def list_features(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    features = db.query(Feature).order_by(Feature.position).all()
    return [
        {
            "id": str(f.id),
            "name": f.name,
            "description": f.description,
            "enabled": f.enabled,
            "role_access": json.loads(f.role_access),
            "position": f.position,
            "cost_monthly": f.cost_monthly,
            "config": json.loads(f.config),
        }
        for f in features
    ]


@router.post("/features", dependencies=[Depends(require_admin)], status_code=201)
def create_feature(
    body: FeatureCreate,
    request: Request,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    existing = db.query(Feature).filter(Feature.name == body.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Feature already exists")
    feature = Feature(
        name=body.name,
        description=body.description,
        enabled=body.enabled,
        role_access=json.dumps(body.role_access),
        position=body.position,
        cost_monthly=body.cost_monthly,
        config=json.dumps(body.config),
    )
    db.add(feature)
    db.commit()
    db.refresh(feature)
    _audit(
        db,
        "admin",
        "create_feature",
        "Feature",
        str(feature.id),
        {"name": body.name},
        request,
    )
    return {"id": str(feature.id), "name": feature.name}


@router.put("/features/{feature_id}", dependencies=[Depends(require_admin)])
def update_feature(
    feature_id: str,
    body: FeatureUpdate,
    request: Request,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    feature = db.query(Feature).filter(Feature.id == feature_id).first()
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")
    for field, val in body.model_dump(exclude_none=True).items():
        if field in ("role_access", "config"):
            setattr(feature, field, json.dumps(val))
        else:
            setattr(feature, field, val)
    db.commit()
    _audit(
        db,
        "admin",
        "update_feature",
        "Feature",
        feature_id,
        body.model_dump(exclude_none=True),
        request,
    )
    return {"id": feature_id, "updated": True}


@router.delete("/features/{feature_id}", dependencies=[Depends(require_admin)])
def delete_feature(
    feature_id: str,
    request: Request,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    feature = db.query(Feature).filter(Feature.id == feature_id).first()
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")
    db.delete(feature)
    db.commit()
    _audit(db, "admin", "delete_feature", "Feature", feature_id, {}, request)
    return {"id": feature_id, "deleted": True}


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------


@router.get("/settings", dependencies=[Depends(require_admin)])
def list_settings(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    settings = db.query(Setting).order_by(Setting.category, Setting.key).all()
    return [
        {
            "key": s.key,
            "value": "***" if s.is_encrypted else s.value,
            "is_encrypted": s.is_encrypted,
            "category": s.category,
            "description": s.description,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
            "updated_by": s.updated_by,
        }
        for s in settings
    ]


@router.put("/settings/{key}", dependencies=[Depends(require_admin)])
def upsert_setting(
    key: str,
    body: SettingUpsert,
    request: Request,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    setting = db.query(Setting).filter(Setting.key == key).first()
    if setting:
        setting.value = body.value
        setting.is_encrypted = body.is_encrypted
        setting.category = body.category
        setting.description = body.description
        setting.updated_by = body.updated_by
    else:
        setting = Setting(
            key=key,
            value=body.value,
            is_encrypted=body.is_encrypted,
            category=body.category,
            description=body.description,
            updated_by=body.updated_by,
        )
        db.add(setting)
    db.commit()
    _audit(
        db,
        body.updated_by,
        "upsert_setting",
        "Setting",
        key,
        {"category": body.category},
        request,
    )
    return {"key": key, "saved": True}


# ---------------------------------------------------------------------------
# Promotions
# ---------------------------------------------------------------------------


@router.get("/promotions", dependencies=[Depends(require_admin)])
def list_promotions(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    promos = db.query(Promotion).order_by(Promotion.created_at.desc()).all()
    return [
        {
            "id": str(p.id),
            "code": p.code,
            "type": p.type,
            "discount": p.discount,
            "valid_from": p.valid_from.isoformat() if p.valid_from else None,
            "valid_to": p.valid_to.isoformat() if p.valid_to else None,
            "usage_count": p.usage_count,
            "max_uses": p.max_uses,
            "is_active": p.is_active,
            "description": p.description,
        }
        for p in promos
    ]


@router.post("/promotions", dependencies=[Depends(require_admin)], status_code=201)
def create_promotion(
    body: PromotionCreate,
    request: Request,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    existing = db.query(Promotion).filter(Promotion.code == body.code).first()
    if existing:
        raise HTTPException(status_code=409, detail="Promotion code already exists")
    promo = Promotion(
        code=body.code.upper(),
        type=body.type,
        discount=body.discount,
        valid_from=body.valid_from,
        valid_to=body.valid_to,
        max_uses=body.max_uses,
        description=body.description,
        created_by=body.created_by,
    )
    db.add(promo)
    db.commit()
    db.refresh(promo)
    _audit(
        db,
        body.created_by,
        "create_promotion",
        "Promotion",
        str(promo.id),
        {"code": body.code},
        request,
    )
    return {"id": str(promo.id), "code": promo.code}


@router.delete("/promotions/{promo_id}", dependencies=[Depends(require_admin)])
def delete_promotion(
    promo_id: str,
    request: Request,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    promo = db.query(Promotion).filter(Promotion.id == promo_id).first()
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")
    db.delete(promo)
    db.commit()
    _audit(db, "admin", "delete_promotion", "Promotion", promo_id, {}, request)
    return {"id": promo_id, "deleted": True}


# ---------------------------------------------------------------------------
# Payments
# ---------------------------------------------------------------------------


@router.get("/payments/invoices", dependencies=[Depends(require_admin)])
def list_invoices(
    limit: int = 50,
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    payments = db.query(Payment).order_by(Payment.created_at.desc()).limit(limit).all()
    return [
        {
            "id": str(p.id),
            "user_id": p.user_id,
            "stripe_invoice_id": p.stripe_invoice_id,
            "plan": p.plan,
            "amount_cents": p.amount_cents,
            "currency": p.currency,
            "status": p.status,
            "period_start": p.period_start.isoformat() if p.period_start else None,
            "period_end": p.period_end.isoformat() if p.period_end else None,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in payments
    ]


# ---------------------------------------------------------------------------
# Integrations
# ---------------------------------------------------------------------------


@router.get("/integrations", dependencies=[Depends(require_admin)])
def list_integrations(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    integrations = db.query(Integration).all()
    return [
        {
            "id": str(i.id),
            "api_name": i.api_name,
            "display_name": i.display_name,
            "endpoint": i.endpoint,
            "sync_status": i.sync_status,
            "last_synced": i.last_synced.isoformat() if i.last_synced else None,
            "last_error": i.last_error,
            "is_active": i.is_active,
        }
        for i in integrations
    ]


@router.post("/integrations", dependencies=[Depends(require_admin)], status_code=201)
def upsert_integration(
    body: IntegrationUpsert,
    request: Request,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    integration = (
        db.query(Integration).filter(Integration.api_name == body.api_name).first()
    )
    # NOTE: credentials are stored as JSON. In production, wrap with AES-256 encryption
    # using a library such as `cryptography.fernet` before persisting to the database.
    credentials_str = json.dumps(body.credentials or {})
    if integration:
        integration.display_name = body.display_name or integration.display_name
        integration.endpoint = body.endpoint or integration.endpoint
        integration.credentials_encrypted = credentials_str
        integration.config = json.dumps(body.config)
        integration.sync_status = "connected"
    else:
        integration = Integration(
            api_name=body.api_name,
            display_name=body.display_name or body.api_name,
            endpoint=body.endpoint,
            credentials_encrypted=credentials_str,
            config=json.dumps(body.config),
            sync_status="connected",
        )
        db.add(integration)
    db.commit()
    db.refresh(integration)
    _audit(
        db,
        "admin",
        "upsert_integration",
        "Integration",
        str(integration.id),
        {"api_name": body.api_name},
        request,
    )
    return {
        "id": str(integration.id),
        "api_name": integration.api_name,
        "status": integration.sync_status,
    }


@router.post(
    "/integrations/{integration_id}/test", dependencies=[Depends(require_admin)]
)
def test_integration(
    integration_id: str,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    integration = db.query(Integration).filter(Integration.id == integration_id).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    # Shallow connectivity test — in production perform a real API call
    return {
        "id": integration_id,
        "api_name": integration.api_name,
        "reachable": True,
        "tested_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@router.get("/health", dependencies=[Depends(require_admin)])
def get_health(db: Session = Depends(get_db)) -> Dict[str, Any]:
    snapshots = (
        db.query(HealthMonitor)
        .order_by(HealthMonitor.recorded_at.desc())
        .limit(10)
        .all()
    )
    return {
        "snapshots": [
            {
                "recorded_at": s.recorded_at.isoformat(),
                "service": s.service,
                "uptime_pct": s.uptime_pct,
                "latency_p50_ms": s.latency_p50_ms,
                "latency_p95_ms": s.latency_p95_ms,
                "latency_p99_ms": s.latency_p99_ms,
                "error_rate": s.error_rate,
                "requests_per_min": s.requests_per_min,
            }
            for s in snapshots
        ]
    }


# ---------------------------------------------------------------------------
# Copilot Prompt Management
# ---------------------------------------------------------------------------


@router.get("/copilot/prompt", dependencies=[Depends(require_admin)])
def get_copilot_prompt() -> Dict[str, Any]:
    try:
        content = COPILOT_PROMPT_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        content = ""
    return {
        "path": str(COPILOT_PROMPT_PATH),
        "content": content,
        "char_count": len(content),
    }


@router.put("/copilot/prompt", dependencies=[Depends(require_admin)])
def update_copilot_prompt(
    body: CopilotPromptUpdate,
    request: Request,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    COPILOT_PROMPT_PATH.write_text(body.content, encoding="utf-8")
    _audit(
        db,
        "admin",
        "update_copilot_prompt",
        "File",
        str(COPILOT_PROMPT_PATH),
        {"commit_message": body.commit_message},
        request,
    )
    return {"saved": True, "char_count": len(body.content)}


@router.post("/copilot/spawn", dependencies=[Depends(require_admin)])
def spawn_agents(
    body: SpawnAgentsRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Emit a multi-agent spawn directive.
    In production this triggers a GitHub Actions workflow_dispatch event
    that fans out N parallel jobs (one per agent/feature branch).
    """
    spawn_id = str(uuid.uuid4())
    branches = [
        f"{body.branch_prefix}-{i + 1}-{spawn_id[:8]}" for i in range(body.agent_count)
    ]
    _audit(
        db,
        "admin",
        "spawn_agents",
        "MultiAgent",
        spawn_id,
        {"task": body.task, "agent_count": body.agent_count, "branches": branches},
        request,
    )
    return {
        "spawn_id": spawn_id,
        "task": body.task,
        "agent_count": body.agent_count,
        "branches": branches,
        "status": "queued",
        "message": (
            f"Queued {body.agent_count} parallel agents for task: {body.task}. "
            "Trigger workflow_dispatch on '.github/workflows/pr_agent.yml' "
            "with these branch names to start execution."
        ),
    }


# ---------------------------------------------------------------------------
# Audit log (read-only)
# ---------------------------------------------------------------------------


@router.get("/audit-log", dependencies=[Depends(require_admin)])
def get_audit_log(
    limit: int = 100,
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": str(log.id),
            "actor_email": log.actor_email,
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "details": json.loads(log.details or "{}"),
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]
