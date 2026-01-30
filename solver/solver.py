from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from enum import Enum


class ShiftType(str, Enum):
    OB_DAY = "OB_DAY"
    OB_L3 = "OB_L3"
    OB_OC = "OB_OC"
    OB_L4 = "OB_L4"
    OB_POSTCALL = "OB_POSTCALL"
    BT_V = "BT_V"
    BT_O = "BT_O"


class RequestType(str, Enum):
    PREFER_CALL = "PREFER_CALL"
    AVOID_CALL = "AVOID_CALL"
    WEEKEND_OFF = "WEEKEND_OFF"


@dataclass(frozen=True)
class Resident:
    id: int
    tier: int
    ob_months_completed: int


@dataclass(frozen=True)
class Request:
    resident_id: int
    request_type: RequestType
    start_date: date
    end_date: date


@dataclass(frozen=True)
class TimeOff:
    resident_id: int
    start_date: date
    end_date: date
    block_type: ShiftType


@dataclass
class Assignment:
    resident_id: int
    date: date
    shift_type: ShiftType


@dataclass
class GenerationOutput:
    assignments: list[Assignment]
    alerts: list[dict]
    fairness: dict
    unmet_requests: list[dict]


@dataclass(frozen=True)
class ScheduleInput:
    start_date: date
    end_date: date
    residents: list[Resident]
    requests: list[Request]
    time_off: list[TimeOff]


def _daterange(start_date: date, end_date: date):
    current = start_date
    while current <= end_date:
        yield current
        current += timedelta(days=1)


def _is_weekend(day: date) -> bool:
    return day.weekday() >= 5


def _day_type(day: date) -> str:
    if _is_weekend(day):
        return "WEEKEND"
    if day.weekday() == 4:
        return "FRIDAY"
    return "WEEKDAY"


def _is_blocked(day: date, resident_id: int, time_off: list[TimeOff]) -> bool:
    for block in time_off:
        if block.resident_id == resident_id and block.start_date <= day <= block.end_date:
            return True
    return False


def _tier0_restricted(day: date, resident: Resident) -> bool:
    return resident.ob_months_completed == 0 and day.day <= 3


def generate_schedule(payload: ScheduleInput) -> GenerationOutput:
    assignments: list[Assignment] = []
    alerts: list[dict] = []
    fairness: dict = {"ob_oc_counts": {}}
    unmet_requests: list[dict] = []

    residents = payload.residents
    if not residents:
        for day in _daterange(payload.start_date, payload.end_date):
            alerts.append({"date": day, "message": "No residents available for coverage."})
        return GenerationOutput(assignments, alerts, fairness, unmet_requests)

    ob_oc_index = 0

    assigned_by_day: dict[date, set[int]] = {}

    def is_available(day: date, resident: Resident) -> bool:
        if _is_blocked(day, resident.id, payload.time_off):
            return False
        if _tier0_restricted(day, resident):
            return False
        return resident.id not in assigned_by_day.get(day, set())

    def add_assignment(day: date, resident: Resident, shift_type: ShiftType) -> bool:
        if resident.id in assigned_by_day.get(day, set()):
            return False
        assigned_by_day.setdefault(day, set()).add(resident.id)
        assignments.append(Assignment(resident_id=resident.id, date=day, shift_type=shift_type))
        return True

    for day in _daterange(payload.start_date, payload.end_date):
        day_type = _day_type(day)
        required_ob_oc = 2
        required_ob_l4 = 1 if day_type in {"FRIDAY", "WEEKEND"} else 0
        required_ob_l3 = 1 if day_type == "WEEKDAY" else 0
        required_ob_day = 2 if day_type == "WEEKDAY" else 0

        ob_oc_assigned: list[Resident] = []
        if required_ob_l3:
            l3_assigned = False
            attempts = 0
            while not l3_assigned and attempts < len(residents) * 2:
                resident = residents[ob_oc_index % len(residents)]
                ob_oc_index += 1
                attempts += 1
                if not is_available(day, resident):
                    continue
                if add_assignment(day, resident, ShiftType.OB_L3):
                    ob_oc_assigned.append(resident)
                    l3_assigned = True
            if not l3_assigned:
                alerts.append({"date": day, "message": "Understaffed OB_L3 coverage."})

        attempts = 0
        while len(ob_oc_assigned) < required_ob_oc and attempts < len(residents) * 2:
            resident = residents[ob_oc_index % len(residents)]
            ob_oc_index += 1
            attempts += 1
            if not is_available(day, resident):
                continue
            if add_assignment(day, resident, ShiftType.OB_OC):
                ob_oc_assigned.append(resident)

        if len(ob_oc_assigned) < required_ob_oc:
            alerts.append({"date": day, "message": "Understaffed OB_OC coverage."})

        if required_ob_l4:
            l4_assigned = False
            for resident in residents:
                if is_available(day, resident) and add_assignment(day, resident, ShiftType.OB_L4):
                    l4_assigned = True
                    break
            if not l4_assigned:
                alerts.append({"date": day, "message": "Understaffed OB_L4 coverage."})

        if required_ob_day:
            ob_day_needed = required_ob_day
            for resident in residents:
                if ob_day_needed == 0:
                    break
                if is_available(day, resident) and add_assignment(day, resident, ShiftType.OB_DAY):
                    ob_day_needed -= 1
            if ob_day_needed > 0:
                alerts.append({"date": day, "message": "Understaffed OB_DAY coverage."})

    for assignment in list(assignments):
        if assignment.shift_type not in {ShiftType.OB_OC, ShiftType.OB_L4}:
            continue
        next_day = assignment.date + timedelta(days=1)
        if next_day > payload.end_date:
            continue
        resident = next(r for r in residents if r.id == assignment.resident_id)
        if is_available(next_day, resident):
            add_assignment(next_day, resident, ShiftType.OB_POSTCALL)
        else:
            alerts.append({"date": next_day, "message": "Unable to assign OB_POSTCALL."})

    for assignment in assignments:
        if assignment.shift_type in {ShiftType.OB_OC, ShiftType.OB_L3}:
            fairness["ob_oc_counts"].setdefault(assignment.resident_id, 0)
            fairness["ob_oc_counts"][assignment.resident_id] += 1

    for request in payload.requests:
        relevant_assignments = [
            assignment
            for assignment in assignments
            if assignment.resident_id == request.resident_id
            and assignment.shift_type == ShiftType.OB_OC
            and request.start_date <= assignment.date <= request.end_date
        ]
        met = True
        if request.request_type == RequestType.PREFER_CALL:
            met = bool(relevant_assignments)
        elif request.request_type == RequestType.AVOID_CALL:
            met = not bool(relevant_assignments)
        elif request.request_type == RequestType.WEEKEND_OFF:
            met = not bool(relevant_assignments)
        unmet_requests.append(
            {
                "resident_id": request.resident_id,
                "request_type": request.request_type.value,
                "start_date": request.start_date,
                "end_date": request.end_date,
                "met": met,
            }
        )

    return GenerationOutput(assignments, alerts, fairness, unmet_requests)
