import os

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Resident


def test_generate_schedule_creates_version_and_assignments():
    os.environ["SKIP_DB_INIT"] = "1"
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestingSessionLocal() as db:
        db.add(Resident(name="Resident A", tier=1, ob_months_completed=1))
        db.add(Resident(name="Resident B", tier=1, ob_months_completed=1))
        db.commit()

    client = TestClient(app)

    response = client.post(
        "/periods",
        json={"name": "Jan 2024", "start_date": "2024-01-02", "end_date": "2024-01-02"},
    )
    assert response.status_code == 201
    period_id = response.json()["id"]

    response = client.post(f"/periods/{period_id}/generate")
    assert response.status_code == 200
    payload = response.json()
    assert payload["version"]["id"]
    assert len(payload["assignments"]) == 2

    app.dependency_overrides.clear()
