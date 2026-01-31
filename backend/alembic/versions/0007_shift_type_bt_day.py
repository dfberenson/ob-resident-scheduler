"""replace BT_V/BT_O with BT_DAY

Revision ID: 0007_shift_type_bt_day
Revises: 0006_time_off_approved
Create Date: 2026-01-31 00:00:00.000000
"""

from alembic import op

revision = "0007_shift_type_bt_day"
down_revision = "0006_time_off_approved"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE shifttype RENAME TO shifttype_old")
    op.execute(
        "CREATE TYPE shifttype AS ENUM ('OB_DAY','OB_L3','OB_OC','OB_L4','OB_POSTCALL','BT_DAY')"
    )
    op.execute(
        """
        ALTER TABLE assignments
        ALTER COLUMN shift_type TYPE shifttype
        USING (
            CASE
                WHEN shift_type::text IN ('BT_V','BT_O') THEN 'BT_DAY'
                ELSE shift_type::text
            END
        )::shifttype
        """
    )
    op.execute(
        """
        ALTER TABLE assignment_history
        ALTER COLUMN old_shift_type TYPE shifttype
        USING (
            CASE
                WHEN old_shift_type::text IN ('BT_V','BT_O') THEN 'BT_DAY'
                ELSE old_shift_type::text
            END
        )::shifttype
        """
    )
    op.execute(
        """
        ALTER TABLE assignment_history
        ALTER COLUMN new_shift_type TYPE shifttype
        USING (
            CASE
                WHEN new_shift_type::text IN ('BT_V','BT_O') THEN 'BT_DAY'
                ELSE new_shift_type::text
            END
        )::shifttype
        """
    )
    op.execute(
        """
        ALTER TABLE time_off_blocks
        ALTER COLUMN block_type TYPE shifttype
        USING (
            CASE
                WHEN block_type::text IN ('BT_V','BT_O') THEN 'BT_DAY'
                ELSE block_type::text
            END
        )::shifttype
        """
    )
    op.execute("DROP TYPE shifttype_old")


def downgrade() -> None:
    op.execute("ALTER TYPE shifttype RENAME TO shifttype_new")
    op.execute(
        "CREATE TYPE shifttype AS ENUM ('OB_DAY','OB_L3','OB_OC','OB_L4','OB_POSTCALL','BT_V','BT_O')"
    )
    op.execute(
        """
        ALTER TABLE assignments
        ALTER COLUMN shift_type TYPE shifttype
        USING (
            CASE
                WHEN shift_type::text = 'BT_DAY' THEN 'BT_V'
                ELSE shift_type::text
            END
        )::shifttype
        """
    )
    op.execute(
        """
        ALTER TABLE assignment_history
        ALTER COLUMN old_shift_type TYPE shifttype
        USING (
            CASE
                WHEN old_shift_type::text = 'BT_DAY' THEN 'BT_V'
                ELSE old_shift_type::text
            END
        )::shifttype
        """
    )
    op.execute(
        """
        ALTER TABLE assignment_history
        ALTER COLUMN new_shift_type TYPE shifttype
        USING (
            CASE
                WHEN new_shift_type::text = 'BT_DAY' THEN 'BT_V'
                ELSE new_shift_type::text
            END
        )::shifttype
        """
    )
    op.execute(
        """
        ALTER TABLE time_off_blocks
        ALTER COLUMN block_type TYPE shifttype
        USING (
            CASE
                WHEN block_type::text = 'BT_DAY' THEN 'BT_V'
                ELSE block_type::text
            END
        )::shifttype
        """
    )
    op.execute("DROP TYPE shifttype_new")
