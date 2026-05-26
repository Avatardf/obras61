"""ETL mensal dos preços SINAPI via API da Caixa Econômica Federal."""
import asyncio
from datetime import date

from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.tasks.etl_sinapi.atualizar_precos_sinapi")
def atualizar_precos_sinapi() -> dict:
    return asyncio.get_event_loop().run_until_complete(_atualizar_async())


async def _atualizar_async() -> dict:
    import httpx
    from app.config import settings
    from app.database import AsyncSessionLocal
    from app.models.custos_referencia import ComposicaoCusto, PrecoReferencia

    if not settings.sinapi_token:
        return {"aviso": "SINAPI_TOKEN não configurado — pulando atualização"}

    ano_mes = date.today().replace(day=1).isoformat()
    ufs = ["RJ", "SP", "MG", "ES", "BA", "PR", "SC", "RS", "GO", "DF"]

    atualizados = 0
    async with httpx.AsyncClient(
        base_url=settings.sinapi_api_url,
        headers={"Authorization": f"Bearer {settings.sinapi_token}"},
        timeout=60,
    ) as client:
        for uf in ufs:
            resp = await client.get(f"/v1/precos", params={"uf": uf, "competencia": ano_mes})
            if resp.status_code != 200:
                continue

            async with AsyncSessionLocal() as db:
                from sqlalchemy import select
                for item in resp.json().get("itens", []):
                    result = await db.execute(
                        select(ComposicaoCusto).where(ComposicaoCusto.codigo == item["codigo"])
                    )
                    composicao = result.scalar_one_or_none()
                    if not composicao:
                        continue

                    preco = PrecoReferencia(
                        composicao_id=composicao.id,
                        uf=uf,
                        ano_mes=ano_mes,
                        custo_sem_desoneração=item.get("precoSemDesoneracao"),
                        custo_com_desoneração=item.get("precoComDesoneracao"),
                    )
                    db.add(preco)
                    atualizados += 1

                await db.commit()

    return {"atualizados": atualizados, "competencia": ano_mes}
