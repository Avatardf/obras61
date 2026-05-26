import asyncio
from uuid import UUID

from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.tasks.vision_analysis.processar_captura", bind=True, max_retries=3)
def processar_captura(self, captura_id: str) -> dict:
    """Processa uma captura 360° com Gemini Vision."""
    return asyncio.get_event_loop().run_until_complete(_processar_captura_async(UUID(captura_id)))


async def _processar_captura_async(captura_id: UUID) -> dict:
    from app.database import AsyncSessionLocal
    from app.models.vision import Captura360, StatusProcessamento, AnaliseIA
    from app.services.gemini import analisar_imagem_360
    import httpx

    async with AsyncSessionLocal() as db:
        from sqlalchemy import select
        result = await db.execute(
            select(Captura360).where(Captura360.id == captura_id)
        )
        captura = result.scalar_one_or_none()
        if not captura:
            return {"erro": "Captura não encontrada"}

        captura.status_processamento = StatusProcessamento.processando
        await db.commit()

        try:
            # Baixa imagem do storage
            async with httpx.AsyncClient() as client:
                resp = await client.get(captura.arquivo_url)
                imagem_bytes = resp.content

            # Busca etapa para contexto
            from app.models.obra import Etapa
            from app.models.vision import PontoCaptura
            ponto = await db.get(PontoCaptura, captura.ponto_id)
            etapa_nome = "Não especificada"
            if ponto and ponto.etapa_id:
                etapa = await db.get(Etapa, ponto.etapa_id)
                if etapa:
                    etapa_nome = etapa.nome

            resultado = await analisar_imagem_360(imagem_bytes, etapa_nome)

            analise = AnaliseIA(
                captura_id=captura_id,
                modelo_ia="gemini-2.5-flash",
                progresso_estimado=resultado.get("progresso_estimado"),
                anomalias_detectadas=resultado.get("anomalias", []),
                sugestao_rdo=resultado.get("sugestao_rdo"),
                confianca=resultado.get("confianca"),
            )
            db.add(analise)
            captura.status_processamento = StatusProcessamento.concluido
            await db.commit()

            return {"status": "ok", "progresso": resultado.get("progresso_estimado")}

        except Exception as exc:
            captura.status_processamento = StatusProcessamento.erro
            await db.commit()
            raise
