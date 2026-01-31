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


class SchedulePeriodMonthCreate(BaseModel):
    year: int
    month: int


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
    fairness_report: Optional[dict] = None
    unmet_requests: Optional[list] = None

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


class AssignmentUpdate(BaseModel):
    resident_id: Optional[int] = None
    date: Optional[date] = None
    shift_type: Optional[ShiftType] = None


class ResidentRead(BaseModel):
    id: int
    name: str
    tier: int
    ob_months_completed: int

    class Config:
        orm_mode = True


class ResidentCreate(BaseModel):
    name: str
    tier: int
    ob_months_completed: int


class ResidentUpdate(BaseModel):
    name: Optional[str] = None
    tier: Optional[int] = None
    ob_months_completed: Optional[int] = None


class ResidentRequestRead(BaseModel):
    id: int
    resident_id: int
    request_type: str
    start_date: date
    end_date: date
    approved: bool
    resident_name: str

    class Config:
        orm_mode = True


class ConflictRead(BaseModel):
    resident_id: int
    resident_name: str
    date: date
    assignment_ids: list[int]


class RequestApprovalUpdate(BaseModel):
    approved: bool


class TimeOffCreate(BaseModel):
    resident_id: int
    start_date: date
    end_date: date
    block_type: ShiftType


class TimeOffRead(TimeOffCreate):
    id: int

    class Config:
        orm_mode = True


class TimeOffUpdate(BaseModel):
    resident_id: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    block_type: Optional[ShiftType] = None


class HolidayCreate(BaseModel):
    date: date
    name: str
    hospital_holiday: Optional[bool] = None


class HolidayRead(HolidayCreate):
    id: int

    class Config:
        orm_mode = True


class HolidayUpdate(BaseModel):
    hospital_holiday: Optional[bool] = None


class SolverConstraintsRead(BaseModel):
    id: int
    config: dict
    updated_at: datetime

    class Config:
        orm_mode = True


class SolverConstraintsUpdate(BaseModel):
    config: dict


class AssignmentHistoryRead(BaseModel):
    id: int
    assignment_id: int
    changed_at: datetime
    old_resident_id: int
    new_resident_id: int
    old_date: date
    new_date: date
    old_shift_type: ShiftType
    new_shift_type: ShiftType

    class Config:
        orm_mode = True


class RequestWindow(BaseModel):
    start_date: date
    end_date: date


class RequestImportEntry(BaseModel):
    resident_name: str
    tier: Optional[int] = 0
    ob_months_completed: Optional[int] = 0
    prefer_call: list[RequestWindow] = []
    avoid_call: list[RequestWindow] = []
    weekend_off: list[RequestWindow] = []


class RequestImportPayload(BaseModel):
    requests: list[RequestImportEntry]


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
