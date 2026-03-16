"""
admin_models.py — Extended database models for the hidden admin governance system.

Tables added:
  - AdminUser       : platform users with role / subscription / API key support
  - Feature         : toggleable features per role
  - Setting         : encrypted global key-value store
  - Promotion       : coupon / discount codes
  - Payment         : subscription invoices & refunds
  - Integration     : external API connector registry
  - AnalyticsDaily  : daily DAU, revenue, churn snapshot
  - HealthMonitor   : uptime, latency, error rate snapshots
  - AuditLog        : immutable record of every admin action
"""

from __future__ import annotations

import uuid

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255))
    role = Column(
        String(50), default="viewer", index=True
    )  # owner/admin/manager/sales/viewer
    permissions = Column(Text, default="[]")  # JSON list of permission strings
    subscription_plan = Column(
        String(50), default="free"
    )  # free/starter/pro/enterprise
    api_keys = Column(Text, default="{}")  # JSON map of service → encrypted key
    is_active = Column(Boolean, default=True)
    suspended_at = Column(DateTime(timezone=True))
    last_login = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Feature(Base):
    __tablename__ = "features"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text)
    enabled = Column(Boolean, default=True, index=True)
    role_access = Column(Text, default='["owner","admin"]')  # JSON list of roles
    position = Column(Integer, default=0)  # sidebar/menu order
    cost_monthly = Column(Float, default=0.0)
    config = Column(Text, default="{}")  # per-feature JSON config
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Setting(Base):
    __tablename__ = "settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key = Column(String(255), unique=True, nullable=False, index=True)
    value = Column(Text)
    is_encrypted = Column(Boolean, default=False)
    category = Column(
        String(100), default="general"
    )  # general/auth/email/sms/database/integrations
    description = Column(Text)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    updated_by = Column(String(255))


class Promotion(Base):
    __tablename__ = "promotions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    code = Column(String(100), unique=True, nullable=False, index=True)
    type = Column(String(50), nullable=False)  # percentage/fixed/trial_days
    discount = Column(Float, nullable=False)  # percent or dollar amount
    valid_from = Column(DateTime(timezone=True))
    valid_to = Column(DateTime(timezone=True))
    usage_count = Column(Integer, default=0)
    max_uses = Column(Integer)  # NULL = unlimited
    is_active = Column(Boolean, default=True, index=True)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(String(255))


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(String(36), index=True)
    stripe_customer_id = Column(String(255), index=True)
    stripe_subscription_id = Column(String(255), index=True)
    stripe_invoice_id = Column(String(255))
    plan = Column(String(50))  # free/starter/pro/enterprise
    amount_cents = Column(Integer, default=0)
    currency = Column(String(10), default="usd")
    status = Column(
        String(50), default="pending"
    )  # pending/active/past_due/cancelled/refunded
    period_start = Column(DateTime(timezone=True))
    period_end = Column(DateTime(timezone=True))
    refunded_at = Column(DateTime(timezone=True))
    refund_reason = Column(Text)
    metadata_json = Column(Text, default="{}")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Integration(Base):
    __tablename__ = "integrations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    api_name = Column(
        String(255), nullable=False, index=True
    )  # google/railway/vercel/github/custom
    display_name = Column(String(255))
    endpoint = Column(String(500))
    credentials_encrypted = Column(Text)  # AES-256 encrypted JSON
    sync_status = Column(
        String(50), default="disconnected"
    )  # connected/disconnected/error
    last_synced = Column(DateTime(timezone=True))
    last_error = Column(Text)
    config = Column(Text, default="{}")  # extra config JSON
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AnalyticsDaily(Base):
    __tablename__ = "analytics_daily"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date = Column(DateTime(timezone=True), nullable=False, index=True)
    dau = Column(Integer, default=0)  # daily active users
    mau = Column(Integer, default=0)  # monthly active users (rolling 30d)
    new_signups = Column(Integer, default=0)
    churned = Column(Integer, default=0)
    revenue_cents = Column(Integer, default=0)
    leads_scraped = Column(Integer, default=0)
    conversion_rate = Column(Float, default=0.0)
    nps_score = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class HealthMonitor(Base):
    __tablename__ = "health_monitor"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    service = Column(String(100), default="api")
    uptime_pct = Column(Float, default=100.0)
    latency_p50_ms = Column(Float)
    latency_p95_ms = Column(Float)
    latency_p99_ms = Column(Float)
    error_rate = Column(Float, default=0.0)
    requests_per_min = Column(Float, default=0.0)
    cost_usd = Column(Float, default=0.0)
    notes = Column(Text)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_email = Column(String(255), nullable=False, index=True)
    action = Column(String(255), nullable=False, index=True)
    resource_type = Column(String(100))
    resource_id = Column(String(255))
    details = Column(Text, default="{}")  # JSON snapshot of change
    ip_address = Column(String(50))
    user_agent = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
