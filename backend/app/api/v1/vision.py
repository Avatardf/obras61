from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.vision import Captura360, PontoCaptura, StatusProcessamento
from app.workers.tasks.vision_analysis import processar_captura

router = APIRouter(prefix="/vision", tags=["vision360"])


@router.get("/pontos/{obra_id}")
async def listar_pontos(obra_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PontoCaptura).where(PontoCaptura.obra_id == obra_id, PontoCaptura.ativo == True)
    )
    return result.scalars().all()


@router.post("/capturas/{ponto_id}")
async def upload_captura(
    ponto_id: UUID,
    arquivo: UploadFile,
    db: AsyncSession = Depends(get_db),
):
    """Recebe imagem 360°, salva no storage e enfileira análise IA."""
    ponto = await db.get(PontoCaptura, ponto_id)
    if not ponto:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ponto não encontrado")

    # TODO: upload para S3-compatible storage e obter URL
    arquivo_url = f"placeholder/{ponto_id}/{arquivo.filename}"

    captura = Captura360(
        ponto_id=ponto_id,
        arquivo_url=arquivo_url,
        tamanho_bytes=arquivo.size,
        dispositivo=arquivo.headers.get("X-Device", "desconhecido"),
    )
    db.add(captura)
    await db.commit()
    await db.refresh(captura)

    # Enfileira processamento assíncrono
    processar_captura.apply_async(args=[str(captura.id)], queue="vision")

    return {"id": captura.id, "status": StatusProcessamento.pendente}


@router.get("/capturas/{captura_id}/analise")
async def buscar_analise(captura_id: UUID, db: AsyncSession = Depends(get_db)):
    captura = await db.get(Captura360, captura_id)
    if not captura:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Captura não encontrada")
    return {"status": captura.status_processamento, "analise": captura.analise}
