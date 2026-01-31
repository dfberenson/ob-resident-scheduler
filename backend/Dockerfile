FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend/alembic.ini /app/alembic.ini
COPY backend/alembic /app/alembic
COPY backend/app /app/app
COPY solver /app/solver

ENV PYTHONPATH=/app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
