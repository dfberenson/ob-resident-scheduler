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
- Admin dashboard: http://localhost:3000/admin

## Local backend tests

```bash
cd backend
pytest
```

## Database migrations (Alembic)

```bash
cd backend
alembic upgrade head
```

## Seed demo data

```bash
curl -X POST http://localhost:8000/seed
```

## Import resident requests

```bash
curl -X POST http://localhost:8000/requests/import \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [
      {
        "resident_name": "Alex Rivera",
        "tier": 1,
        "ob_months_completed": 1,
        "prefer_call": [{"start_date": "2024-01-08", "end_date": "2024-01-09"}],
        "avoid_call": [{"start_date": "2024-01-12", "end_date": "2024-01-13"}],
        "weekend_off": [{"start_date": "2024-01-20", "end_date": "2024-01-21"}]
      }
    ]
  }'
```

## Review/approve requests

```bash
curl -X PATCH http://localhost:8000/requests/1 \
  -H "Content-Type: application/json" \
  -d '{"approved": false}'
```

## Manage time off

```bash
curl -X POST http://localhost:8000/time-off \
  -H "Content-Type: application/json" \
  -d '{"resident_id": 1, "start_date": "2024-01-15", "end_date": "2024-01-19", "block_type": "BT_V"}'
```

```bash
curl -X DELETE http://localhost:8000/time-off/1
```

## Manage residents

```bash
curl -X POST http://localhost:8000/residents \
  -H "Content-Type: application/json" \
  -d '{"name": "Taylor Kim", "tier": 1, "ob_months_completed": 1}'
```

## Manage holidays

```bash
curl -X POST http://localhost:8000/holidays \
  -H "Content-Type: application/json" \
  -d '{"date": "2024-01-15", "name": "MLK Day"}'
```

## Generate schedule via background job

```bash
curl -X POST http://localhost:8000/schedule-periods/1/generate
curl http://localhost:8000/jobs/<job_id>
```

## Validate and publish a schedule version

```bash
curl http://localhost:8000/schedule-versions/1/validate
curl -X POST http://localhost:8000/schedule-versions/1/publish
```

## Assignment history

```bash
curl http://localhost:8000/assignments/1/history
```
