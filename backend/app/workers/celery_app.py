from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery_app = Celery(
    "obras",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.workers.tasks.vision_analysis",
        "app.workers.tasks.evm_calculation",
        "app.workers.tasks.etl_sinapi",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="America/Sao_Paulo",
    enable_utc=True,
    task_routes={
        "app.workers.tasks.vision_analysis.*": {"queue": "vision"},
        "app.workers.tasks.etl_sinapi.*": {"queue": "etl"},
        "app.workers.tasks.evm_calculation.*": {"queue": "default"},
    },
    beat_schedule={
        # Recalcula EVM de todas as obras ativas toda noite às 2h
        "recalcular-evm-diario": {
            "task": "app.workers.tasks.evm_calculation.recalcular_evm_todas_obras",
            "schedule": crontab(hour=2, minute=0),
        },
        # Atualiza SINAPI todo dia 15 (mês de referência)
        "atualizar-sinapi-mensal": {
            "task": "app.workers.tasks.etl_sinapi.atualizar_precos_sinapi",
            "schedule": crontab(day_of_month=15, hour=3, minute=0),
        },
    },
)
