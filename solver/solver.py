from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from enum import Enum
from typing import Iterable

from ortools.sat.python import cp_model


class ShiftType(str, Enum):
    OB_DAY = "OB_DAY"
    OB_L3 = "OB_L3"
    OB_OC = "OB_OC"
    OB_L4 = "OB_L4"
    OB_POSTCALL = "OB_POSTCALL"
    BT_DAY = "BT_DAY"


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
    holidays: list[date] = None
    constraints: dict | None = None


DEFAULT_CONSTRAINTS = {
    "coverage": {
        "weekday": {"ob_oc": 2, "ob_l3": 1, "ob_l4": 0, "ob_day_min": 2, "ob_day_max": 4},
        "friday": {"ob_oc": 2, "ob_l3": 0, "ob_l4": 1, "ob_day_min": 2, "ob_day_max": 4},
        "weekend_or_holiday": {"ob_oc": 2, "ob_l3": 0, "ob_l4": 1, "ob_day_min": 0, "ob_day_max": 0},
    },
    "tier0_call_prohibition": {"days": [1, 2, 3]},
    "call_targets": {
        "tier0": [6, 7],
        "tier1": [6, 7],
        "tier2": [5, 6],
        "tier3": None,
    },
    "weights": {"understaff": 1000, "call": 20, "weekend": 5, "request": 10},
}


SHIFT_TYPES = [
    ShiftType.OB_DAY,
    ShiftType.OB_L3,
    ShiftType.OB_OC,
    ShiftType.OB_L4,
    ShiftType.OB_POSTCALL,
]


def _daterange(start_date: date, end_date: date) -> Iterable[date]:
    current = start_date
    while current <= end_date:
        yield current
        current += timedelta(days=1)


def _is_weekend(day: date) -> bool:
    return day.weekday() >= 5


def _is_friday(day: date) -> bool:
    return day.weekday() == 4


def _coverage_requirements(day: date, holidays: set[date], constraints: dict) -> dict[str, int]:
    coverage = constraints.get("coverage", {})
    if _is_weekend(day) or day in holidays:
        return coverage.get(
            "weekend_or_holiday",
            {"ob_oc": 2, "ob_l4": 1, "ob_l3": 0, "ob_day_min": 0, "ob_day_max": 0},
        )
    if _is_friday(day):
        return coverage.get(
            "friday",
            {"ob_oc": 2, "ob_l4": 1, "ob_l3": 0, "ob_day_min": 2, "ob_day_max": 4},
        )
    return coverage.get(
        "weekday",
        {"ob_oc": 2, "ob_l4": 0, "ob_l3": 1, "ob_day_min": 2, "ob_day_max": 4},
    )


def _is_tier0_restricted(day: date, resident: Resident, constraints: dict) -> bool:
    restricted_days = set((constraints.get("tier0_call_prohibition") or {}).get("days", [1, 2, 3]))
    return resident.ob_months_completed == 0 and day.day in restricted_days


def _is_time_off(day: date, resident_id: int, time_off: list[TimeOff]) -> ShiftType | None:
    for block in time_off:
        if block.resident_id == resident_id and block.start_date <= day <= block.end_date:
            return block.block_type
    return None


def generate_schedule(payload: ScheduleInput) -> GenerationOutput:
    assignments: list[Assignment] = []
    alerts: list[dict] = []
    fairness: dict = {"ob_oc_counts": {}, "weekend_ob_oc_spread": 0}
    unmet_requests: list[dict] = []

    residents = payload.residents
    if not residents:
        for day in _daterange(payload.start_date, payload.end_date):
            alerts.append({"date": day, "message": "No residents available for coverage.", "severity": "HIGH"})
        return GenerationOutput(assignments, alerts, fairness, unmet_requests)

    model = cp_model.CpModel()

    days = list(_daterange(payload.start_date, payload.end_date))
    holiday_set = set(payload.holidays or [])
    constraints = payload.constraints or DEFAULT_CONSTRAINTS
    resident_ids = [resident.id for resident in residents]

    assign: dict[tuple[int, date, ShiftType], cp_model.IntVar] = {}
    for resident in residents:
        for day in days:
            for shift in SHIFT_TYPES:
                assign[(resident.id, day, shift)] = model.NewBoolVar(
                    f"assign_{resident.id}_{day.isoformat()}_{shift.value}"
                )

    # Hard constraints: one shift per day and time off blocks
    for resident in residents:
        for day in days:
            model.Add(
                assign[(resident.id, day, ShiftType.OB_DAY)]
                + assign[(resident.id, day, ShiftType.OB_L4)]
                + assign[(resident.id, day, ShiftType.OB_POSTCALL)]
                + assign[(resident.id, day, ShiftType.OB_OC)]
                + assign[(resident.id, day, ShiftType.OB_L3)]
                <= 1
            )
            next_day = day + timedelta(days=1)
            if next_day in days:
                # OB_L3 is the day before an OB_OC shift for the same resident.
                model.Add(
                    assign[(resident.id, day, ShiftType.OB_L3)]
                    <= assign[(resident.id, next_day, ShiftType.OB_OC)]
                )
            else:
                model.Add(assign[(resident.id, day, ShiftType.OB_L3)] == 0)

            time_off_type = _is_time_off(day, resident.id, payload.time_off)
            if time_off_type:
                if _is_tier0_restricted(day, resident, constraints):
                    alerts.append(
                        {
                            "date": day,
                            "message": "Tier0 resident cannot be assigned BT shifts on days 1-3.",
                            "severity": "HIGH",
                        }
                    )
                else:
                    day_vars = [assign[(resident.id, day, shift)] for shift in SHIFT_TYPES]
                    model.Add(sum(day_vars) == 0)
                    assignments.append(Assignment(resident_id=resident.id, date=day, shift_type=time_off_type))

            if _is_tier0_restricted(day, resident, constraints):
                model.Add(assign[(resident.id, day, ShiftType.OB_L3)] == 0)
                model.Add(assign[(resident.id, day, ShiftType.OB_OC)] == 0)
                model.Add(assign[(resident.id, day, ShiftType.OB_L4)] == 0)
                model.Add(assign[(resident.id, day, ShiftType.OB_POSTCALL)] == 0)

    # Coverage requirements with understaffing slack
    understaff_slack: list[cp_model.IntVar] = []
    for day in days:
        requirements = _coverage_requirements(day, holiday_set, constraints)

        ob_oc_vars = [assign[(resident_id, day, ShiftType.OB_OC)] for resident_id in resident_ids]
        ob_l3_vars = [assign[(resident_id, day, ShiftType.OB_L3)] for resident_id in resident_ids]
        ob_l4_vars = [assign[(resident_id, day, ShiftType.OB_L4)] for resident_id in resident_ids]
        ob_day_vars = [assign[(resident_id, day, ShiftType.OB_DAY)] for resident_id in resident_ids]

        slack_oc = model.NewIntVar(0, requirements["ob_oc"], f"slack_oc_{day}")
        model.Add(sum(ob_oc_vars) + slack_oc == requirements["ob_oc"])
        understaff_slack.append(slack_oc)

        if requirements["ob_l3"]:
            slack_l3 = model.NewIntVar(0, requirements["ob_l3"], f"slack_l3_{day}")
            model.Add(sum(ob_l3_vars) + slack_l3 == requirements["ob_l3"])
            understaff_slack.append(slack_l3)
        else:
            model.Add(sum(ob_l3_vars) == 0)

        if requirements["ob_l4"]:
            slack_l4 = model.NewIntVar(0, requirements["ob_l4"], f"slack_l4_{day}")
            model.Add(sum(ob_l4_vars) + slack_l4 == requirements["ob_l4"])
            understaff_slack.append(slack_l4)
        else:
            model.Add(sum(ob_l4_vars) == 0)

        if requirements["ob_day_min"]:
            slack_day = model.NewIntVar(0, requirements["ob_day_min"], f"slack_day_{day}")
            model.Add(sum(ob_day_vars) + slack_day == requirements["ob_day_min"])
            model.Add(sum(ob_day_vars) <= requirements["ob_day_max"])
            understaff_slack.append(slack_day)
        else:
            model.Add(sum(ob_day_vars) == 0)

    # Postcall linkage
    for day in days:
        next_day = day + timedelta(days=1)
        if next_day not in days:
            continue
        for resident_id in resident_ids:
            trigger = assign[(resident_id, day, ShiftType.OB_OC)] + assign[
                (resident_id, day, ShiftType.OB_L4)
            ]
            model.Add(assign[(resident_id, next_day, ShiftType.OB_POSTCALL)] == trigger)

    # Soft objectives: call targets
    penalty_terms: list[cp_model.IntVar] = []
    call_target_penalties: list[cp_model.IntVar] = []
    for resident in residents:
        call_vars = [assign[(resident.id, day, ShiftType.OB_OC)] for day in days]
        call_count = model.NewIntVar(0, len(days), f"call_count_{resident.id}")
        model.Add(call_count == sum(call_vars))

        call_targets = constraints.get("call_targets", {})
        tier_key = f"tier{resident.tier}"
        target = call_targets.get(tier_key)
        if not target:
            continue
        low, high = target

        under = model.NewIntVar(0, len(days), f"call_under_{resident.id}")
        over = model.NewIntVar(0, len(days), f"call_over_{resident.id}")
        model.AddMaxEquality(under, [0, low - call_count])
        model.AddMaxEquality(over, [0, call_count - high])
        penalty_terms.extend([under, over])
        call_target_penalties.extend([under, over])

    # Soft objectives: weekend balance
    weekend_counts = []
    for resident in residents:
        weekend_vars = [
            assign[(resident.id, day, ShiftType.OB_OC)] for day in days if _is_weekend(day)
        ]
        count = model.NewIntVar(0, len(days), f"weekend_oc_{resident.id}")
        model.Add(count == sum(weekend_vars))
        weekend_counts.append(count)

    if weekend_counts:
        weekend_max = model.NewIntVar(0, len(days), "weekend_max")
        weekend_min = model.NewIntVar(0, len(days), "weekend_min")
        model.AddMaxEquality(weekend_max, weekend_counts)
        model.AddMinEquality(weekend_min, weekend_counts)
        weekend_spread = model.NewIntVar(0, len(days), "weekend_spread")
        model.Add(weekend_spread == weekend_max - weekend_min)
        penalty_terms.append(weekend_spread)
    else:
        weekend_spread = None

    # Soft objectives: requests
    request_penalties: list[cp_model.IntVar] = []
    for index, request in enumerate(payload.requests):
        request_days = [
            day
            for day in days
            if request.start_date <= day <= request.end_date
        ]
        call_in_range = [
            assign[(request.resident_id, day, ShiftType.OB_OC)] for day in request_days
        ]
        if not call_in_range:
            continue

        if request.request_type == RequestType.PREFER_CALL:
            met = model.NewBoolVar(f"prefer_met_{index}")
            model.Add(sum(call_in_range) >= 1).OnlyEnforceIf(met)
            model.Add(sum(call_in_range) == 0).OnlyEnforceIf(met.Not())
            penalty = model.NewIntVar(0, 1, f"prefer_penalty_{index}")
            model.Add(penalty == 1 - met)
        else:
            violation = model.NewBoolVar(f"avoid_violation_{index}")
            model.Add(sum(call_in_range) >= 1).OnlyEnforceIf(violation)
            model.Add(sum(call_in_range) == 0).OnlyEnforceIf(violation.Not())
            penalty = model.NewIntVar(0, 1, f"avoid_penalty_{index}")
            model.Add(penalty == violation)

        request_penalties.append(penalty)
        penalty_terms.append(penalty)

    # Objective weights
    weights = constraints.get("weights", {})
    slack_weight = int(weights.get("understaff", 1000))
    call_weight = int(weights.get("call", 20))
    weekend_weight = int(weights.get("weekend", 5))
    request_weight = int(weights.get("request", 10))

    objective_terms = []
    for slack in understaff_slack:
        objective_terms.append(slack_weight * slack)
    for penalty in call_target_penalties:
        objective_terms.append(call_weight * penalty)
    if weekend_spread is not None:
        objective_terms.append(weekend_weight * weekend_spread)
    for penalty in request_penalties:
        objective_terms.append(request_weight * penalty)

    model.Minimize(sum(objective_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10
    status = solver.Solve(model)

    if status not in {cp_model.OPTIMAL, cp_model.FEASIBLE}:
        alerts.append({"date": payload.start_date, "message": "Solver infeasible", "severity": "HIGH"})
        return GenerationOutput(assignments, alerts, fairness, unmet_requests)

    for resident in residents:
        fairness["ob_oc_counts"][resident.id] = 0

    for resident in residents:
        for day in days:
            for shift in SHIFT_TYPES:
                if solver.Value(assign[(resident.id, day, shift)]) == 1:
                    assignments.append(Assignment(resident_id=resident.id, date=day, shift_type=shift))
                    if shift == ShiftType.OB_OC:
                        fairness["ob_oc_counts"][resident.id] += 1

    if weekend_spread is not None:
        fairness["weekend_ob_oc_spread"] = solver.Value(weekend_spread)

    for day in days:
        requirements = _coverage_requirements(day, holiday_set, constraints)
        coverage = {
            "ob_oc": 0,
            "ob_l3": 0,
            "ob_l4": 0,
            "ob_day": 0,
        }
        for resident_id in resident_ids:
            if solver.Value(assign[(resident_id, day, ShiftType.OB_OC)]) == 1:
                coverage["ob_oc"] += 1
            if solver.Value(assign[(resident_id, day, ShiftType.OB_L3)]) == 1:
                coverage["ob_l3"] += 1
            if solver.Value(assign[(resident_id, day, ShiftType.OB_L4)]) == 1:
                coverage["ob_l4"] += 1
            if solver.Value(assign[(resident_id, day, ShiftType.OB_DAY)]) == 1:
                coverage["ob_day"] += 1

        if coverage["ob_oc"] < requirements["ob_oc"]:
            alerts.append({"date": day, "message": "Understaffed OB_OC coverage.", "severity": "HIGH"})
        if requirements["ob_l3"] and coverage["ob_l3"] < requirements["ob_l3"]:
            alerts.append({"date": day, "message": "Understaffed OB_L3 coverage.", "severity": "HIGH"})
        if requirements["ob_l4"] and coverage["ob_l4"] < requirements["ob_l4"]:
            alerts.append({"date": day, "message": "Understaffed OB_L4 coverage.", "severity": "HIGH"})
        if requirements["ob_day_min"] and coverage["ob_day"] < requirements["ob_day_min"]:
            alerts.append({"date": day, "message": "Understaffed OB_DAY coverage.", "severity": "HIGH"})

    for request in payload.requests:
        request_days = [
            day
            for day in days
            if request.start_date <= day <= request.end_date
        ]
        call_assignments = [
            assignment
            for assignment in assignments
            if assignment.resident_id == request.resident_id
            and assignment.shift_type == ShiftType.OB_OC
            and assignment.date in request_days
        ]
        if request.request_type == RequestType.PREFER_CALL:
            met = bool(call_assignments)
        else:
            met = not bool(call_assignments)
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
