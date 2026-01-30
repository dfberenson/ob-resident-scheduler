"""initial tables

Revision ID: 0001_initial
Revises: 
Create Date: 2024-01-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


shift_type_enum = sa.Enum(
    "OB_DAY",
    "OB_L3",
    "OB_OC",
    "OB_L4",
    "OB_POSTCALL",
    "BT_V",
    "BT_O",
    name="shifttype",
)

version_status_enum = sa.Enum("DRAFT", "PUBLISHED", name="versionstatus")

request_type_enum = sa.Enum("PREFER_CALL", "AVOID_CALL", "WEEKEND_OFF", name="requesttype")


def upgrade() -> None:
    op.create_table(
        "schedule_periods",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_schedule_periods_id", "schedule_periods", ["id"])

    op.create_table(
        "schedule_versions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("period_id", sa.Integer(), nullable=False),
        sa.Column("status", version_status_enum, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["period_id"], ["schedule_periods.id"]),
    )
    op.create_index("ix_schedule_versions_id", "schedule_versions", ["id"])

    op.create_table(
        "residents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("tier", sa.Integer(), nullable=False),
        sa.Column("ob_months_completed", sa.Integer(), nullable=False),
    )
    op.create_index("ix_residents_id", "residents", ["id"])

    op.create_table(
        "resident_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("resident_id", sa.Integer(), nullable=False),
        sa.Column("request_type", request_type_enum, nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.ForeignKeyConstraint(["resident_id"], ["residents.id"]),
    )
    op.create_index("ix_resident_requests_id", "resident_requests", ["id"])

    op.create_table(
        "time_off_blocks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("resident_id", sa.Integer(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("block_type", shift_type_enum, nullable=False),
        sa.ForeignKeyConstraint(["resident_id"], ["residents.id"]),
    )
    op.create_index("ix_time_off_blocks_id", "time_off_blocks", ["id"])

    op.create_table(
        "assignments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("version_id", sa.Integer(), nullable=False),
        sa.Column("resident_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("shift_type", shift_type_enum, nullable=False),
        sa.ForeignKeyConstraint(["version_id"], ["schedule_versions.id"]),
        sa.ForeignKeyConstraint(["resident_id"], ["residents.id"]),
    )
    op.create_index("ix_assignments_id", "assignments", ["id"])


def downgrade() -> None:
    op.drop_index("ix_assignments_id", table_name="assignments")
    op.drop_table("assignments")

    op.drop_index("ix_time_off_blocks_id", table_name="time_off_blocks")
    op.drop_table("time_off_blocks")

    op.drop_index("ix_resident_requests_id", table_name="resident_requests")
    op.drop_table("resident_requests")

    op.drop_index("ix_residents_id", table_name="residents")
    op.drop_table("residents")

    op.drop_index("ix_schedule_versions_id", table_name="schedule_versions")
    op.drop_table("schedule_versions")

    op.drop_index("ix_schedule_periods_id", table_name="schedule_periods")
    op.drop_table("schedule_periods")

    request_type_enum.drop(op.get_bind(), checkfirst=True)
    version_status_enum.drop(op.get_bind(), checkfirst=True)
    shift_type_enum.drop(op.get_bind(), checkfirst=True)
