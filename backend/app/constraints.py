from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from . import models


DEFAULT_CONSTRAINTS: dict = {
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


def ensure_constraints(db: Session) -> models.SolverConstraints:
    constraints = db.query(models.SolverConstraints).first()
    if constraints:
        return constraints
    constraints = models.SolverConstraints(config=DEFAULT_CONSTRAINTS, updated_at=datetime.utcnow())
    db.add(constraints)
    db.commit()
    db.refresh(constraints)
    return constraints


def get_constraints(db: Session) -> dict:
    constraints = ensure_constraints(db)
    return constraints.config or DEFAULT_CONSTRAINTS
