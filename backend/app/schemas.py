from datetime import date, datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class ShiftType(str, Enum):
    OB_DAY = "OB_DAY"
    OB_L3 = "OB_L3"
    OB_OC = "OB_OC"
    OB_L4 = "OB_L4"
    OB_POSTCALL = "OB_POSTCALL"
    BT_V = "BT_V"
    BT_O = "BT_O"


class VersionStatus(str, Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"


class SchedulePeriodCreate(BaseModel):
    name: str
    start_date: date
    end_date: date


class SchedulePeriodRead(SchedulePeriodCreate):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


class ScheduleVersionRead(BaseModel):
    id: int
    period_id: int
    status: VersionStatus
    created_at: datetime

    class Config:
        orm_mode = True


class AssignmentRead(BaseModel):
    id: int
    version_id: int
    resident_id: int
    date: date
    shift_type: ShiftType

    class Config:
        orm_mode = True


class GenerationAlert(BaseModel):
    date: date
    message: str
    severity: str = Field("HIGH")


class GenerationResult(BaseModel):
    version: ScheduleVersionRead
    assignments: List[AssignmentRead]
    alerts: List[GenerationAlert]
    fairness: dict
    unmet_requests: list


class ValidationResult(BaseModel):
    hard_violations: list
    alerts: list
    fairness: dict
    unmet_requests: list
