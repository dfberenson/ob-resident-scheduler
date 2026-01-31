from datetime import date
from typing import Iterable

from solver import generate_schedule
from solver.solver import Request, Resident, RequestType, ScheduleInput, TimeOff, ShiftType as SolverShiftType

from . import models


SHIFT_MAP = {
    models.ShiftType.OB_DAY: SolverShiftType.OB_DAY,
    models.ShiftType.OB_L3: SolverShiftType.OB_L3,
    models.ShiftType.OB_OC: SolverShiftType.OB_OC,
    models.ShiftType.OB_L4: SolverShiftType.OB_L4,
    models.ShiftType.OB_POSTCALL: SolverShiftType.OB_POSTCALL,
    models.ShiftType.BT_DAY: SolverShiftType.BT_DAY,
}


REQUEST_MAP = {
    models.RequestType.PREFER_CALL: RequestType.PREFER_CALL,
    models.RequestType.AVOID_CALL: RequestType.AVOID_CALL,
    models.RequestType.WEEKEND_OFF: RequestType.WEEKEND_OFF,
}


def build_schedule_input(
    start_date: date,
    end_date: date,
    residents: Iterable[models.Resident],
    requests: Iterable[models.ResidentRequest],
    time_off: Iterable[models.TimeOff],
    holidays: Iterable[models.Holiday],
    constraints: dict | None = None,
) -> ScheduleInput:
    resident_payload = [
        Resident(id=resident.id, tier=resident.tier, ob_months_completed=resident.ob_months_completed)
        for resident in residents
    ]
    request_payload = [
        Request(
            resident_id=request.resident_id,
            request_type=REQUEST_MAP[request.request_type],
            start_date=request.start_date,
            end_date=request.end_date,
        )
        for request in requests
        if request.approved
    ]
    time_off_payload = [
        TimeOff(
            resident_id=block.resident_id,
            start_date=block.start_date,
            end_date=block.end_date,
            block_type=SHIFT_MAP[block.block_type],
        )
        for block in time_off
        if block.approved
    ]
    return ScheduleInput(
        start_date=start_date,
        end_date=end_date,
        residents=resident_payload,
        requests=request_payload,
        time_off=time_off_payload,
        holidays=[holiday.date for holiday in holidays if holiday.hospital_holiday],
        constraints=constraints,
    )


def run_solver(schedule_input: ScheduleInput):
    return generate_schedule(schedule_input)
