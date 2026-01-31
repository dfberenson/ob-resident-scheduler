from datetime import date, datetime
from enum import Enum

from sqlalchemy import Boolean, Date, DateTime, Enum as SAEnum, ForeignKey, Integer, String
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class ShiftType(str, Enum):
    OB_DAY = "OB_DAY"
    OB_L3 = "OB_L3"
    OB_OC = "OB_OC"
    OB_L4 = "OB_L4"
    OB_POSTCALL = "OB_POSTCALL"
    BT_DAY = "BT_DAY"


class VersionStatus(str, Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"


class SchedulePeriod(Base):
    __tablename__ = "schedule_periods"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    versions: Mapped[list["ScheduleVersion"]] = relationship(
        "ScheduleVersion", back_populates="period", cascade="all, delete-orphan"
    )


class ScheduleVersion(Base):
    __tablename__ = "schedule_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    period_id: Mapped[int] = mapped_column(ForeignKey("schedule_periods.id"))
    status: Mapped[VersionStatus] = mapped_column(
        SAEnum(VersionStatus), default=VersionStatus.DRAFT, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    fairness_report: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    unmet_requests: Mapped[list | None] = mapped_column(JSON, nullable=True)

    period: Mapped[SchedulePeriod] = relationship("SchedulePeriod", back_populates="versions")
    assignments: Mapped[list["Assignment"]] = relationship(
        "Assignment", back_populates="version", cascade="all, delete-orphan"
    )
    alerts: Mapped[list["ScheduleAlert"]] = relationship(
        "ScheduleAlert", back_populates="version", cascade="all, delete-orphan"
    )


class Resident(Base):
    __tablename__ = "residents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    tier: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ob_months_completed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    assignments: Mapped[list["Assignment"]] = relationship("Assignment", back_populates="resident")
    requests: Mapped[list["ResidentRequest"]] = relationship(
        "ResidentRequest", back_populates="resident", cascade="all, delete-orphan"
    )
    time_off_blocks: Mapped[list["TimeOff"]] = relationship(
        "TimeOff", back_populates="resident", cascade="all, delete-orphan"
    )


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    version_id: Mapped[int] = mapped_column(ForeignKey("schedule_versions.id"))
    resident_id: Mapped[int] = mapped_column(ForeignKey("residents.id"))
    date: Mapped[date] = mapped_column(Date, nullable=False)
    shift_type: Mapped[ShiftType] = mapped_column(SAEnum(ShiftType), nullable=False)

    version: Mapped[ScheduleVersion] = relationship("ScheduleVersion", back_populates="assignments")
    resident: Mapped[Resident] = relationship("Resident", back_populates="assignments")
    history: Mapped[list["AssignmentHistory"]] = relationship(
        "AssignmentHistory", back_populates="assignment", cascade="all, delete-orphan"
    )


class ScheduleAlert(Base):
    __tablename__ = "schedule_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    version_id: Mapped[int] = mapped_column(ForeignKey("schedule_versions.id"))
    date: Mapped[date] = mapped_column(Date, nullable=False)
    message: Mapped[str] = mapped_column(String, nullable=False)
    severity: Mapped[str] = mapped_column(String, nullable=False, default="HIGH")

    version: Mapped[ScheduleVersion] = relationship("ScheduleVersion", back_populates="alerts")


class Holiday(Base):
    __tablename__ = "holidays"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    hospital_holiday: Mapped[bool | None] = mapped_column(Boolean, nullable=True)


class SolverConstraints(Base):
    __tablename__ = "solver_constraints"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    config: Mapped[dict] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AssignmentHistory(Base):
    __tablename__ = "assignment_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("assignments.id"))
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    old_resident_id: Mapped[int] = mapped_column(Integer, nullable=False)
    new_resident_id: Mapped[int] = mapped_column(Integer, nullable=False)
    old_date: Mapped[date] = mapped_column(Date, nullable=False)
    new_date: Mapped[date] = mapped_column(Date, nullable=False)
    old_shift_type: Mapped[ShiftType] = mapped_column(SAEnum(ShiftType), nullable=False)
    new_shift_type: Mapped[ShiftType] = mapped_column(SAEnum(ShiftType), nullable=False)

    assignment: Mapped[Assignment] = relationship("Assignment", back_populates="history")


class RequestType(str, Enum):
    PREFER_CALL = "PREFER_CALL"
    AVOID_CALL = "AVOID_CALL"
    WEEKEND_OFF = "WEEKEND_OFF"


class ResidentRequest(Base):
    __tablename__ = "resident_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    resident_id: Mapped[int] = mapped_column(ForeignKey("residents.id"))
    request_type: Mapped[RequestType] = mapped_column(SAEnum(RequestType), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    approved: Mapped[bool] = mapped_column(default=True, nullable=False)
    pre_approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    resident: Mapped[Resident] = relationship("Resident", back_populates="requests")


class TimeOff(Base):
    __tablename__ = "time_off_blocks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    resident_id: Mapped[int] = mapped_column(ForeignKey("residents.id"))
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    block_type: Mapped[ShiftType] = mapped_column(SAEnum(ShiftType), nullable=False)
    approved: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    pre_approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    resident: Mapped[Resident] = relationship("Resident", back_populates="time_off_blocks")
