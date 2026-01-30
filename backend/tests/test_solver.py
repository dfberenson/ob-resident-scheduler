from datetime import date

from solver.solver import Resident, ScheduleInput, TimeOff, ShiftType, generate_schedule


def test_solver_assigns_postcall_after_call():
    payload = ScheduleInput(
        start_date=date(2024, 1, 2),
        end_date=date(2024, 1, 3),
        residents=[
            Resident(id=1, tier=1, ob_months_completed=1),
            Resident(id=2, tier=1, ob_months_completed=1),
            Resident(id=3, tier=1, ob_months_completed=1),
            Resident(id=4, tier=1, ob_months_completed=1),
            Resident(id=5, tier=1, ob_months_completed=1),
            Resident(id=6, tier=1, ob_months_completed=1),
        ],
        requests=[],
        time_off=[],
    )

    result = generate_schedule(payload)

    day_one_calls = [
        assignment
        for assignment in result.assignments
        if assignment.date == date(2024, 1, 2)
        and assignment.shift_type in {ShiftType.OB_OC, ShiftType.OB_L3, ShiftType.OB_L4}
    ]
    assert day_one_calls

    for assignment in day_one_calls:
        assert any(
            postcall.resident_id == assignment.resident_id
            and postcall.date == date(2024, 1, 3)
            and postcall.shift_type == ShiftType.OB_POSTCALL
            for postcall in result.assignments
        )


def test_solver_requires_l3_also_has_oc():
    payload = ScheduleInput(
        start_date=date(2024, 1, 2),
        end_date=date(2024, 1, 2),
        residents=[
            Resident(id=1, tier=1, ob_months_completed=1),
            Resident(id=2, tier=1, ob_months_completed=1),
            Resident(id=3, tier=1, ob_months_completed=1),
            Resident(id=4, tier=1, ob_months_completed=1),
            Resident(id=5, tier=1, ob_months_completed=1),
        ],
        requests=[],
        time_off=[],
    )

    result = generate_schedule(payload)

    l3_assignments = [
        assignment
        for assignment in result.assignments
        if assignment.shift_type == ShiftType.OB_L3
    ]
    assert l3_assignments
    for assignment in l3_assignments:
        assert any(
            other.shift_type == ShiftType.OB_OC
            and other.resident_id == assignment.resident_id
            and other.date == assignment.date
            for other in result.assignments
        )


def test_solver_respects_time_off_blocks():
    payload = ScheduleInput(
        start_date=date(2024, 1, 6),
        end_date=date(2024, 1, 6),
        residents=[Resident(id=1, tier=1, ob_months_completed=1)],
        requests=[],
        time_off=[
            TimeOff(
                resident_id=1,
                start_date=date(2024, 1, 6),
                end_date=date(2024, 1, 6),
                block_type=ShiftType.BT_V,
            )
        ],
    )

    result = generate_schedule(payload)

    assert any(
        assignment.resident_id == 1 and assignment.shift_type == ShiftType.BT_V
        for assignment in result.assignments
    )


def test_solver_treats_holiday_as_weekend():
    payload = ScheduleInput(
        start_date=date(2024, 1, 15),
        end_date=date(2024, 1, 15),
        residents=[
            Resident(id=1, tier=1, ob_months_completed=1),
            Resident(id=2, tier=1, ob_months_completed=1),
            Resident(id=3, tier=1, ob_months_completed=1),
        ],
        requests=[],
        time_off=[],
        holidays=[date(2024, 1, 15)],
    )

    result = generate_schedule(payload)

    assert any(
        assignment.shift_type == ShiftType.OB_L4
        for assignment in result.assignments
    )
