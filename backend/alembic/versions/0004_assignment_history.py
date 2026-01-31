"""add assignment history

Revision ID: 0004_assignment_history
Revises: 0003_resident_request_approved
Create Date: 2024-01-04 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0004_assignment_history"
down_revision = "0003_resident_request_approved"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "assignment_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("assignment_id", sa.Integer(), nullable=False),
        sa.Column("changed_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("old_resident_id", sa.Integer(), nullable=False),
        sa.Column("new_resident_id", sa.Integer(), nullable=False),
        sa.Column("old_date", sa.Date(), nullable=False),
        sa.Column("new_date", sa.Date(), nullable=False),
        sa.Column(
            "old_shift_type",
            sa.Enum(
                "OB_DAY",
                "OB_L3",
                "OB_OC",
                "OB_L4",
                "OB_POSTCALL",
                "BT_DAY",
                name="shifttype",
            ),
            nullable=False,
        ),
        sa.Column(
            "new_shift_type",
            sa.Enum(
                "OB_DAY",
                "OB_L3",
                "OB_OC",
                "OB_L4",
                "OB_POSTCALL",
                "BT_DAY",
                name="shifttype",
            ),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["assignment_id"], ["assignments.id"]),
    )
    op.create_index("ix_assignment_history_id", "assignment_history", ["id"])


def downgrade() -> None:
    op.drop_index("ix_assignment_history_id", table_name="assignment_history")
    op.drop_table("assignment_history")
