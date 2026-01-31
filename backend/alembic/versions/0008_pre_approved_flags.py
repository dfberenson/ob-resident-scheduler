"""add pre_approved flags to requests and time off

Revision ID: 0008_pre_approved_flags
Revises: 0007_shift_type_bt_day
Create Date: 2026-01-31 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0008_pre_approved_flags"
down_revision = "0007_shift_type_bt_day"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "resident_requests",
        sa.Column("pre_approved", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "time_off_blocks",
        sa.Column("pre_approved", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.alter_column("resident_requests", "pre_approved", server_default=None)
    op.alter_column("time_off_blocks", "pre_approved", server_default=None)


def downgrade() -> None:
    op.drop_column("time_off_blocks", "pre_approved")
    op.drop_column("resident_requests", "pre_approved")
