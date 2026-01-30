from sqlalchemy.orm import Session

from . import models


def create_period(db: Session, name: str, start_date, end_date) -> models.SchedulePeriod:
    period = models.SchedulePeriod(name=name, start_date=start_date, end_date=end_date)
    db.add(period)
    db.commit()
    db.refresh(period)
    return period


def list_periods(db: Session) -> list[models.SchedulePeriod]:
    return db.query(models.SchedulePeriod).order_by(models.SchedulePeriod.start_date).all()


def get_period(db: Session, period_id: int) -> models.SchedulePeriod | None:
    return db.query(models.SchedulePeriod).filter(models.SchedulePeriod.id == period_id).first()


def create_version(db: Session, period: models.SchedulePeriod) -> models.ScheduleVersion:
    version = models.ScheduleVersion(period=period)
    db.add(version)
    db.commit()
    db.refresh(version)
    return version


def add_assignments(db: Session, version: models.ScheduleVersion, assignments: list[models.Assignment]):
    version.assignments.extend(assignments)
    db.add(version)
    db.commit()
    db.refresh(version)
    return version
