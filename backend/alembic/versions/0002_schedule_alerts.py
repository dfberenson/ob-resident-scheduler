"""add schedule alerts

Revision ID: 0002_schedule_alerts
Revises: 0001_initial
Create Date: 2024-01-02 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_schedule_alerts"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "schedule_alerts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("version_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("message", sa.String(), nullable=False),
        sa.Column("severity", sa.String(), nullable=False, server_default="HIGH"),
        sa.ForeignKeyConstraint(["version_id"], ["schedule_versions.id"]),
    )
    op.create_index("ix_schedule_alerts_id", "schedule_alerts", ["id"])


def downgrade() -> None:
    op.drop_index("ix_schedule_alerts_id", table_name="schedule_alerts")
    op.drop_table("schedule_alerts")
