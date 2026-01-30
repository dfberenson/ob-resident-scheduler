import os
from datetime import date, timedelta

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from celery.result import AsyncResult
from sqlalchemy.orm import Session

from . import crud, models, schemas
from .database import Base, SessionLocal, get_db, get_engine
from .database import Base, get_db, get_engine
from .solver_client import build_schedule_input, run_solver
from .celery_app import celery_app
from .tasks import generate_schedule_for_period

app = FastAPI(title="OB Resident Scheduler")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    if os.getenv("SKIP_DB_INIT") == "1":
        return
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    if os.getenv("AUTO_SEED") == "1":
        db = SessionLocal()
        try:
            seed_demo_data_for_startup(db)
        finally:
            db.close()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/periods", response_model=list[schemas.SchedulePeriodRead])
def list_periods(db: Session = Depends(get_db)):
    return crud.list_periods(db)


@app.get("/periods/{period_id}/versions", response_model=list[schemas.ScheduleVersionRead])
def list_versions(period_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.ScheduleVersion)
        .filter(models.ScheduleVersion.period_id == period_id)
        .order_by(models.ScheduleVersion.created_at.desc())
        .all()
    )


@app.get("/residents", response_model=list[schemas.ResidentRead])
def list_residents(db: Session = Depends(get_db)):
    return db.query(models.Resident).order_by(models.Resident.name).all()


@app.post("/residents", response_model=schemas.ResidentRead, status_code=201)
def create_resident(payload: schemas.ResidentCreate, db: Session = Depends(get_db)):
    resident = models.Resident(
        name=payload.name,
        tier=payload.tier,
        ob_months_completed=payload.ob_months_completed,
    )
    db.add(resident)
    db.commit()
    db.refresh(resident)
    return resident


@app.patch("/residents/{resident_id}", response_model=schemas.ResidentRead)
def update_resident(resident_id: int, payload: schemas.ResidentUpdate, db: Session = Depends(get_db)):
    resident = db.query(models.Resident).filter(models.Resident.id == resident_id).first()
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")
    if payload.name is not None:
        resident.name = payload.name
    if payload.tier is not None:
        resident.tier = payload.tier
    if payload.ob_months_completed is not None:
        resident.ob_months_completed = payload.ob_months_completed
    db.commit()
    db.refresh(resident)
    return resident


@app.delete("/residents/{resident_id}", status_code=204)
def delete_resident(resident_id: int, db: Session = Depends(get_db)):
    resident = db.query(models.Resident).filter(models.Resident.id == resident_id).first()
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")
    db.delete(resident)
    db.commit()
    return None


@app.get("/requests", response_model=list[schemas.ResidentRequestRead])
def list_requests(db: Session = Depends(get_db)):
    requests = db.query(models.ResidentRequest, models.Resident).join(models.Resident).all()
    return [
        schemas.ResidentRequestRead(
            id=request.id,
            resident_id=request.resident_id,
            request_type=request.request_type.value,
            start_date=request.start_date,
            end_date=request.end_date,
            approved=request.approved,
            resident_name=resident.name,
        )
        for request, resident in requests
    ]


@app.patch("/requests/{request_id}", response_model=schemas.ResidentRequestRead)
def update_request(request_id: int, payload: schemas.RequestApprovalUpdate, db: Session = Depends(get_db)):
    request = db.query(models.ResidentRequest).filter(models.ResidentRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    request.approved = payload.approved
    db.commit()
    db.refresh(request)
    resident = db.query(models.Resident).filter(models.Resident.id == request.resident_id).first()
    return schemas.ResidentRequestRead(
        id=request.id,
        resident_id=request.resident_id,
        request_type=request.request_type.value,
        start_date=request.start_date,
        end_date=request.end_date,
        approved=request.approved,
        resident_name=resident.name if resident else "",
    )


@app.get("/time-off", response_model=list[schemas.TimeOffRead])
def list_time_off(db: Session = Depends(get_db)):
    return db.query(models.TimeOff).order_by(models.TimeOff.start_date).all()


@app.post("/time-off", response_model=schemas.TimeOffRead, status_code=201)
def create_time_off(payload: schemas.TimeOffCreate, db: Session = Depends(get_db)):
    block = models.TimeOff(
        resident_id=payload.resident_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        block_type=payload.block_type,
    )
    db.add(block)
    db.commit()
    db.refresh(block)
    return block


@app.patch("/time-off/{block_id}", response_model=schemas.TimeOffRead)
def update_time_off(block_id: int, payload: schemas.TimeOffUpdate, db: Session = Depends(get_db)):
    block = db.query(models.TimeOff).filter(models.TimeOff.id == block_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="Time off block not found")
    if payload.resident_id is not None:
        block.resident_id = payload.resident_id
    if payload.start_date is not None:
        block.start_date = payload.start_date
    if payload.end_date is not None:
        block.end_date = payload.end_date
    if payload.block_type is not None:
        block.block_type = payload.block_type
    db.commit()
    db.refresh(block)
    return block


@app.delete("/time-off/{block_id}", status_code=204)
def delete_time_off(block_id: int, db: Session = Depends(get_db)):
    block = db.query(models.TimeOff).filter(models.TimeOff.id == block_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="Time off block not found")
    db.delete(block)
    db.commit()
    return None


@app.get("/holidays", response_model=list[schemas.HolidayRead])
def list_holidays(db: Session = Depends(get_db)):
    return db.query(models.Holiday).order_by(models.Holiday.date).all()


@app.post("/holidays", response_model=schemas.HolidayRead, status_code=201)
def create_holiday(payload: schemas.HolidayCreate, db: Session = Depends(get_db)):
    holiday = models.Holiday(date=payload.date, name=payload.name)
    db.add(holiday)
    db.commit()
    db.refresh(holiday)
    return holiday

@app.post("/requests/import")
def import_requests(payload: schemas.RequestImportPayload, db: Session = Depends(get_db)):
    imported = 0
    for entry in payload.requests:
        resident = db.query(models.Resident).filter(models.Resident.name == entry.resident_name).first()
        if not resident:
            resident = models.Resident(
                name=entry.resident_name,
                tier=entry.tier or 0,
                ob_months_completed=entry.ob_months_completed or 0,
            )
            db.add(resident)
            db.flush()

        def add_requests(request_type: models.RequestType, windows: list[schemas.RequestWindow]):
            nonlocal imported
            for window in windows:
                db.add(
                    models.ResidentRequest(
                        resident_id=resident.id,
                        request_type=request_type,
                        start_date=window.start_date,
                        end_date=window.end_date,
                        approved=True,
                    )
                )
                imported += 1

        add_requests(models.RequestType.PREFER_CALL, entry.prefer_call)
        add_requests(models.RequestType.AVOID_CALL, entry.avoid_call)
        add_requests(models.RequestType.WEEKEND_OFF, entry.weekend_off)

    db.commit()
    return {"status": "ok", "imported": imported}


@app.post("/periods", response_model=schemas.SchedulePeriodRead, status_code=201)
def create_period(payload: schemas.SchedulePeriodCreate, db: Session = Depends(get_db)):
    return crud.create_period(db, payload.name, payload.start_date, payload.end_date)


@app.post("/periods/{period_id}/generate", response_model=schemas.GenerationResult)
def generate_schedule(period_id: int, db: Session = Depends(get_db)):
    period = crud.get_period(db, period_id)
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")

    version = crud.create_version(db, period)
    residents = db.query(models.Resident).all()
    requests = db.query(models.ResidentRequest).filter(models.ResidentRequest.approved.is_(True)).all()
    time_off = db.query(models.TimeOff).all()
    holidays = db.query(models.Holiday).all()

    solver_input = build_schedule_input(
        period.start_date, period.end_date, residents, requests, time_off, holidays
    )
    result = run_solver(solver_input)

    assignments = [
        models.Assignment(
            version_id=version.id,
            resident_id=assignment.resident_id,
            date=assignment.date,
            shift_type=models.ShiftType(assignment.shift_type.value),
        )
        for assignment in result.assignments
    ]
    crud.add_assignments(db, version, assignments)

    version.fairness_report = result.fairness
    version.unmet_requests = result.unmet_requests
    db.commit()
    db.refresh(version)

    return schemas.GenerationResult(
        version=version,
        assignments=version.assignments,
        alerts=result.alerts,
        fairness=result.fairness,
        unmet_requests=result.unmet_requests,
    )


@app.post("/schedule-periods/{period_id}/generate")
def generate_schedule_async(period_id: int):
    job = generate_schedule_for_period.delay(period_id)
    return {"job_id": job.id}


@app.get("/jobs/{job_id}")
def get_job_status(job_id: str):
    result = AsyncResult(job_id, app=celery_app)
    payload = {"job_id": job_id, "status": result.status}
    if result.ready():
        payload["result"] = result.result
    return payload


@app.get("/schedule-periods/{period_id}/draft", response_model=schemas.ScheduleVersionRead | None)
def get_latest_draft(period_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.ScheduleVersion)
        .filter(models.ScheduleVersion.period_id == period_id)
        .order_by(models.ScheduleVersion.created_at.desc())
        .first()
    )


@app.get("/schedule-versions/{version_id}/assignments", response_model=list[schemas.AssignmentRead])
def list_assignments(version_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.Assignment)
        .filter(models.Assignment.version_id == version_id)
        .order_by(models.Assignment.date)
        .all()
    )


@app.get("/schedule-versions/{version_id}/alerts", response_model=list[schemas.GenerationAlert])
def list_alerts(version_id: int, db: Session = Depends(get_db)):
    alerts = (
        db.query(models.ScheduleAlert)
        .filter(models.ScheduleAlert.version_id == version_id)
        .order_by(models.ScheduleAlert.date)
        .all()
    )
    return [
        schemas.GenerationAlert(date=alert.date, message=alert.message, severity=alert.severity)
        for alert in alerts
    ]


@app.post("/schedule-versions/{version_id}/publish", response_model=schemas.ScheduleVersionRead)
def publish_version(version_id: int, db: Session = Depends(get_db)):
    version = db.query(models.ScheduleVersion).filter(models.ScheduleVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    version.status = models.VersionStatus.PUBLISHED
    db.commit()
    db.refresh(version)
    return version


@app.get("/schedule-versions/{version_id}/validate", response_model=schemas.ValidationResult)
def validate_version(version_id: int, db: Session = Depends(get_db)):
    version = db.query(models.ScheduleVersion).filter(models.ScheduleVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    period = version.period
    assignments = (
        db.query(models.Assignment, models.Resident)
        .join(models.Resident)
        .filter(models.Assignment.version_id == version_id)
        .all()
    )
    if not assignments:
        raise HTTPException(status_code=404, detail="Version not found or no assignments")

    holidays = {holiday.date for holiday in db.query(models.Holiday).all()}

    def coverage_requirements(day: date):
        is_weekend = day.weekday() >= 5 or day in holidays
        if is_weekend:
            return {"ob_oc": 2, "ob_l3": 0, "ob_l4": 1, "ob_day_min": 0, "ob_day_max": 0}
        if day.weekday() == 4:
            return {"ob_oc": 2, "ob_l3": 0, "ob_l4": 1, "ob_day_min": 2, "ob_day_max": 4}
        return {"ob_oc": 2, "ob_l3": 1, "ob_l4": 0, "ob_day_min": 2, "ob_day_max": 4}

    violations: list[dict] = []
    alerts: list[dict] = []
    assignments_by_day: dict[date, list[models.Assignment]] = {}
    assignments_by_key: dict[tuple[int, date], list[models.Assignment]] = {}

    for assignment, resident in assignments:
        assignments_by_day.setdefault(assignment.date, []).append(assignment)
        assignments_by_key.setdefault((assignment.resident_id, assignment.date), []).append(assignment)

    for (resident_id, day), resident_assignments in assignments_by_key.items():
        if len(resident_assignments) > 1:
            violations.append(
                {
                    "resident_id": resident_id,
                    "date": day,
                    "assignment_ids": [assignment.id for assignment in resident_assignments],
                    "message": "More than one assignment for resident on this date.",
                }
            )

        resident = next(
            resident for assignment, resident in assignments if assignment.resident_id == resident_id
        )
        if resident.ob_months_completed == 0 and day.day <= 3:
            for assignment in resident_assignments:
                if assignment.shift_type != models.ShiftType.OB_DAY:
                    violations.append(
                        {
                            "resident_id": resident_id,
                            "date": day,
                            "assignment_ids": [assignment.id for assignment in resident_assignments],
                            "message": "Tier0 resident restricted to OB_DAY on days 1-3.",
                        }
                    )
                    break

        has_l3 = any(assignment.shift_type == models.ShiftType.OB_L3 for assignment in resident_assignments)
        has_oc = any(assignment.shift_type == models.ShiftType.OB_OC for assignment in resident_assignments)
        if has_l3 and not has_oc:
            violations.append(
                {
                    "resident_id": resident_id,
                    "date": day,
                    "assignment_ids": [assignment.id for assignment in resident_assignments],
                    "message": "OB_L3 assignment requires OB_OC on same day.",
                }
            )

    for day, day_assignments in assignments_by_day.items():
        requirements = coverage_requirements(day)
        counts = {
            "ob_oc": 0,
            "ob_l3": 0,
            "ob_l4": 0,
            "ob_day": 0,
        }
        for assignment in day_assignments:
            if assignment.shift_type == models.ShiftType.OB_OC:
                counts["ob_oc"] += 1
            elif assignment.shift_type == models.ShiftType.OB_L3:
                counts["ob_l3"] += 1
            elif assignment.shift_type == models.ShiftType.OB_L4:
                counts["ob_l4"] += 1
            elif assignment.shift_type == models.ShiftType.OB_DAY:
                counts["ob_day"] += 1

        if counts["ob_oc"] < requirements["ob_oc"]:
            alerts.append(
                {"date": day, "message": "Understaffed OB_OC coverage.", "severity": "HIGH"}
            )
        if requirements["ob_l3"] and counts["ob_l3"] < requirements["ob_l3"]:
            alerts.append(
                {"date": day, "message": "Understaffed OB_L3 coverage.", "severity": "HIGH"}
            )
        if requirements["ob_l4"] and counts["ob_l4"] < requirements["ob_l4"]:
            alerts.append(
                {"date": day, "message": "Understaffed OB_L4 coverage.", "severity": "HIGH"}
            )
        if requirements["ob_day_min"] and counts["ob_day"] < requirements["ob_day_min"]:
            alerts.append(
                {"date": day, "message": "Understaffed OB_DAY coverage.", "severity": "HIGH"}
            )
        if requirements["ob_day_max"] and counts["ob_day"] > requirements["ob_day_max"]:
            violations.append(
                {
                    "date": day,
                    "assignment_ids": [assignment.id for assignment in day_assignments],
                    "message": "OB_DAY coverage exceeds maximum.",
                }
            )

    for (resident_id, day), resident_assignments in assignments_by_key.items():
        has_call = any(
            assignment.shift_type in {models.ShiftType.OB_OC, models.ShiftType.OB_L4}
            for assignment in resident_assignments
        )
        if not has_call:
            continue
        next_day = day + timedelta(days=1)
        next_assignments = assignments_by_key.get((resident_id, next_day), [])
        has_postcall = any(
            assignment.shift_type == models.ShiftType.OB_POSTCALL for assignment in next_assignments
        )
        if not has_postcall and period and next_day <= period.end_date:
            violations.append(
                {
                    "resident_id": resident_id,
                    "date": next_day,
                    "assignment_ids": [assignment.id for assignment in next_assignments],
                    "message": "Missing OB_POSTCALL after OB_OC/OB_L4.",
                }
            )

    stored_alerts = (
        db.query(models.ScheduleAlert)
        .filter(models.ScheduleAlert.version_id == version_id)
        .order_by(models.ScheduleAlert.date)
        .all()
    )
    alert_payload = [
        {"date": alert.date, "message": alert.message, "severity": alert.severity} for alert in stored_alerts
    ] + alerts

    return schemas.ValidationResult(
        hard_violations=violations,
        alerts=alert_payload,
        fairness=version.fairness_report or {},
        unmet_requests=version.unmet_requests or [],
    )

@app.patch("/assignments/{assignment_id}", response_model=schemas.AssignmentRead)
def update_assignment(assignment_id: int, payload: schemas.AssignmentUpdate, db: Session = Depends(get_db)):
    assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    history = models.AssignmentHistory(
        assignment_id=assignment.id,
        old_resident_id=assignment.resident_id,
        new_resident_id=payload.resident_id if payload.resident_id is not None else assignment.resident_id,
        old_date=assignment.date,
        new_date=payload.date if payload.date is not None else assignment.date,
        old_shift_type=assignment.shift_type,
        new_shift_type=payload.shift_type if payload.shift_type is not None else assignment.shift_type,
    )

    if payload.resident_id is not None:
        assignment.resident_id = payload.resident_id
    if payload.date is not None:
        assignment.date = payload.date
    if payload.shift_type is not None:
        assignment.shift_type = payload.shift_type

    db.add(history)
    db.commit()
    db.refresh(assignment)
    return assignment


@app.get("/assignments/{assignment_id}/history", response_model=list[schemas.AssignmentHistoryRead])
def list_assignment_history(assignment_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.AssignmentHistory)
        .filter(models.AssignmentHistory.assignment_id == assignment_id)
        .order_by(models.AssignmentHistory.changed_at.desc())
        .all()
    )


@app.get("/schedule-versions/{version_id}/conflicts", response_model=list[schemas.ConflictRead])
def list_conflicts(version_id: int, db: Session = Depends(get_db)):
    assignments = (
        db.query(models.Assignment, models.Resident)
        .join(models.Resident)
        .filter(models.Assignment.version_id == version_id)
        .all()
    )
    conflicts: dict[tuple[int, date], schemas.ConflictRead] = {}
    for assignment, resident in assignments:
        key = (assignment.resident_id, assignment.date)
        if key not in conflicts:
            conflicts[key] = schemas.ConflictRead(
                resident_id=assignment.resident_id,
                resident_name=resident.name,
                date=assignment.date,
                assignment_ids=[assignment.id],
            )
        else:
            conflicts[key].assignment_ids.append(assignment.id)
    return [conflict for conflict in conflicts.values() if len(conflict.assignment_ids) > 1]


@app.get("/periods/{period_id}/validate", response_model=schemas.ValidationResult)
def validate_schedule(period_id: int, db: Session = Depends(get_db)):
    period = crud.get_period(db, period_id)
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")

    return schemas.ValidationResult(
        hard_violations=[],
        alerts=[],
        fairness={},
        unmet_requests=[],
    )


def seed_demo_data_for_startup(db: Session) -> dict:
@app.post("/seed")
def seed_demo_data(db: Session = Depends(get_db)):
    existing = db.query(models.Resident).count()
    if existing > 0:
        return {"status": "skipped", "reason": "demo data already present"}

    residents = [
        models.Resident(name="Alex Rivera", tier=1, ob_months_completed=1),
        models.Resident(name="Jordan Lee", tier=2, ob_months_completed=2),
        models.Resident(name="Morgan Patel", tier=0, ob_months_completed=0),
    ]
    db.add_all(residents)
    db.flush()

    period = models.SchedulePeriod(
        name="January 2024",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 7),
    )
    db.add(period)
    db.flush()

    version = models.ScheduleVersion(period_id=period.id, status=models.VersionStatus.DRAFT)
    db.add(version)
    db.flush()

    assignment = models.Assignment(
        version_id=version.id,
        resident_id=residents[0].id,
        date=date(2024, 1, 2),
        shift_type=models.ShiftType.OB_OC,
    )
    request = models.ResidentRequest(
        resident_id=residents[1].id,
        request_type=models.RequestType.AVOID_CALL,
        start_date=date(2024, 1, 3),
        end_date=date(2024, 1, 4),
    )
    time_off = models.TimeOff(
        resident_id=residents[2].id,
        start_date=date(2024, 1, 5),
        end_date=date(2024, 1, 7),
        block_type=models.ShiftType.BT_V,
    )
    db.add_all([assignment, request, time_off])
    db.commit()

    return {"status": "ok", "period_id": period.id}


@app.post("/seed")
def seed_demo_data(db: Session = Depends(get_db)):
    return seed_demo_data_for_startup(db)
