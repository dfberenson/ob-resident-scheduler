from celery import Celery

from .config import get_settings

settings = get_settings()

celery_app = Celery(
    "ob_scheduler",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

# Ensure task modules are imported so Celery registers them.
from . import tasks  # noqa: E402,F401
