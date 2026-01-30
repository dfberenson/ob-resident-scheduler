"""add resident request approved flag

Revision ID: 0003_resident_request_approved
Revises: 0002_schedule_alerts
Create Date: 2024-01-03 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0003_resident_request_approved"
down_revision = "0002_schedule_alerts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "resident_requests",
        sa.Column("approved", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_column("resident_requests", "approved")
