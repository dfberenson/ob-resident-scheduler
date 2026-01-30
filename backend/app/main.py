import os

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy.orm import Session

from . import crud, models, schemas
from .database import Base, get_db, get_engine
from .solver_client import build_schedule_input, run_solver

app = FastAPI(title="OB Resident Scheduler")


@app.on_event("startup")
def startup():
    if os.getenv("SKIP_DB_INIT") == "1":
        return
    engine = get_engine()
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/periods", response_model=list[schemas.SchedulePeriodRead])
def list_periods(db: Session = Depends(get_db)):
    return crud.list_periods(db)


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
    requests = db.query(models.ResidentRequest).all()
    time_off = db.query(models.TimeOff).all()

    solver_input = build_schedule_input(period.start_date, period.end_date, residents, requests, time_off)
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

    return schemas.GenerationResult(
        version=version,
        assignments=version.assignments,
        alerts=result.alerts,
        fairness=result.fairness,
        unmet_requests=result.unmet_requests,
    )


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
