"""add approved flag to time off blocks

Revision ID: 0006_time_off_approved
Revises: 0005_holidays_and_reports
Create Date: 2026-01-31 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0006_time_off_approved"
down_revision = "0005_holidays_and_reports"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "time_off_blocks",
        sa.Column("approved", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.alter_column("time_off_blocks", "approved", server_default=None)


def downgrade() -> None:
    op.drop_column("time_off_blocks", "approved")
