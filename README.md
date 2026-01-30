# OB Resident Scheduler

Monorepo for the OB anesthesia rotation scheduling app.

## Quickstart (Codespaces + Docker Compose)

```bash
cd /workspace/ob-resident-scheduler
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- OpenAPI docs: http://localhost:8000/docs

## Local backend tests

```bash
cd backend
pytest
```
