from .celery_app import celery_app
from .database import SessionLocal
from . import models
from .solver_client import build_schedule_input, run_solver


@celery_app.task
def ping() -> str:
    return "pong"


@celery_app.task
def generate_schedule_for_period(period_id: int) -> dict:
    db = SessionLocal()
    try:
        period = (
            db.query(models.SchedulePeriod)
            .filter(models.SchedulePeriod.id == period_id)
            .first()
        )
        if not period:
            return {"status": "not_found", "period_id": period_id}

        version = models.ScheduleVersion(period_id=period.id, status=models.VersionStatus.DRAFT)
        db.add(version)
        db.flush()

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
        alerts = [
            models.ScheduleAlert(
                version_id=version.id,
                date=alert["date"],
                message=alert["message"],
                severity=alert.get("severity", "HIGH"),
            )
            for alert in result.alerts
        ]

        version.assignments.extend(assignments)
        version.alerts.extend(alerts)
        version.fairness_report = result.fairness
        version.unmet_requests = result.unmet_requests
        db.add(version)
        db.commit()

        return {
            "status": "ok",
            "version_id": version.id,
            "assignment_count": len(assignments),
            "alert_count": len(alerts),
        }
    finally:
        db.close()
