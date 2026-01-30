"""add holidays and version reports

Revision ID: 0005_holidays_and_reports
Revises: 0004_assignment_history
Create Date: 2024-01-05 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0005_holidays_and_reports"
down_revision = "0004_assignment_history"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("schedule_versions", sa.Column("fairness_report", sa.JSON(), nullable=True))
    op.add_column("schedule_versions", sa.Column("unmet_requests", sa.JSON(), nullable=True))
    op.create_table(
        "holidays",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("date", sa.Date(), nullable=False, unique=True),
        sa.Column("name", sa.String(), nullable=False),
    )
    op.create_index("ix_holidays_id", "holidays", ["id"])


def downgrade() -> None:
    op.drop_index("ix_holidays_id", table_name="holidays")
    op.drop_table("holidays")
    op.drop_column("schedule_versions", "unmet_requests")
    op.drop_column("schedule_versions", "fairness_report")
