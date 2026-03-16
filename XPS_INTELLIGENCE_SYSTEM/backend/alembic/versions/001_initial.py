"""Initial schema

Revision ID: 001_initial
Revises:
Create Date: 2024-01-01 00:00:00.000000
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "contractors",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("company_name", sa.String(255), nullable=False),
        sa.Column("owner_name", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("website", sa.String(500), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("state", sa.String(50), nullable=True),
        sa.Column("industry", sa.String(100), nullable=True),
        sa.Column("keywords", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("services", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("rating", sa.Float(), nullable=True),
        sa.Column("reviews", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(100), nullable=True),
        sa.Column("lead_score", sa.Float(), nullable=True, default=0.0),
        sa.Column("last_scraped", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_contacted", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_contractors_company_name", "contractors", ["company_name"])
    op.create_index("ix_contractors_email", "contractors", ["email"])
    op.create_index("ix_contractors_city", "contractors", ["city"])
    op.create_index("ix_contractors_state", "contractors", ["state"])
    op.create_index("ix_contractors_industry", "contractors", ["industry"])
    op.create_index("ix_contractors_lead_score", "contractors", ["lead_score"])

    op.create_table(
        "contacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("contractor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("contractors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("linkedin_url", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "industries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("keywords", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_industries_slug", "industries", ["slug"])

    op.create_table(
        "lead_scores",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("contractor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("contractors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("factors", postgresql.JSONB(), nullable=True),
        sa.Column("scored_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "scrape_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("query", sa.String(500), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("state", sa.String(50), nullable=True),
        sa.Column("industry", sa.String(100), nullable=True),
        sa.Column("status", sa.String(20), nullable=True, default="pending"),
        sa.Column("total_found", sa.Integer(), nullable=True, default=0),
        sa.Column("processed", sa.Integer(), nullable=True, default=0),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_msg", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scrape_jobs_status", "scrape_jobs", ["status"])

    op.create_table(
        "outreach_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("contractor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("contractors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("channel", sa.String(50), nullable=True),
        sa.Column("template_used", sa.String(255), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("status", sa.String(50), nullable=True, default="sent"),
        sa.Column("response_received", sa.Text(), nullable=True),
        sa.Column("response_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("outreach_logs")
    op.drop_table("scrape_jobs")
    op.drop_table("lead_scores")
    op.drop_table("industries")
    op.drop_table("contacts")
    op.drop_table("contractors")
