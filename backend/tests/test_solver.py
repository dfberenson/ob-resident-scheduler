from datetime import date

from solver.solver import Resident, ScheduleInput, generate_schedule


def test_solver_assigns_l3_as_oc():
    payload = ScheduleInput(
        start_date=date(2024, 1, 2),
        end_date=date(2024, 1, 2),
        residents=[
            Resident(id=1, tier=1, ob_months_completed=1),
            Resident(id=2, tier=1, ob_months_completed=1),
        ],
        requests=[],
        time_off=[],
    )

    result = generate_schedule(payload)

    shift_types = {assignment.shift_type.value for assignment in result.assignments}
    assert "OB_L3" in shift_types
    assert "OB_OC" in shift_types
    assert result.fairness["ob_oc_counts"][1] == 1
    assert result.fairness["ob_oc_counts"][2] == 1
