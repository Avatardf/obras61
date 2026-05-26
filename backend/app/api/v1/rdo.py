import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser
from app.models.obra import Obra
from app.models.rdo import RDO
from app.schemas.rdo import RDOCreate, RDOResumo, RDOResponse, RDOUpdate
from app.services.gemini import gerar_rdo_texto, transcrever_rdo_voz

router = APIRouter(tags=["rdo"])
DB = Annotated[AsyncSession, Depends(get_db)]


async def _get_obra(obra_id: uuid.UUID, db: AsyncSession, tenant_id: uuid.UUID) -> Obra:
    result = await db.execute(
        select(Obra).where(Obra.id == obra_id, Obra.tenant_id == tenant_id)
    )
    obra = result.scalar_one_or_none()
    if not obra:
        raise HTTPException(status_code=404, detail="Obra não encontrada")
    return obra


async def _get_rdo(rdo_id: uuid.UUID, db: AsyncSession, tenant_id: uuid.UUID) -> RDO:
    result = await db.execute(
        select(RDO).where(RDO.id == rdo_id, RDO.tenant_id == tenant_id)
    )
    rdo = result.scalar_one_or_none()
    if not rdo:
        raise HTTPException(status_code=404, detail="RDO não encontrado")
    return rdo


def _to_resumo(rdo: RDO) -> RDOResumo:
    return RDOResumo(
        id=rdo.id,
        obra_id=rdo.obra_id,
        data=rdo.data,
        clima_manha=rdo.clima_manha,
        clima_tarde=rdo.clima_tarde,
        efetivo_total=rdo.efetivo_total,
        status=rdo.status,
        tem_ia=bool(rdo.conteudo_ia),
        total_atividades=len(rdo.atividades or []),
        total_ocorrencias=len(rdo.ocorrencias or []),
        criado_em=rdo.criado_em,
    )


# ── Listagem geral (cross-obra, para /qualidade) ───────────────────────────────

@router.get("/rdos", response_model=list[RDOResumo])
async def listar_todos_rdos(db: DB, current_user: CurrentUser):
    """Lista todos os RDOs do tenant ordenados por data desc."""
    result = await db.execute(
        select(RDO)
        .where(RDO.tenant_id == current_user.tenant_id)
        .order_by(RDO.data.desc())
        .limit(100)
    )
    return [_to_resumo(r) for r in result.scalars().all()]


# ── Por obra ───────────────────────────────────────────────────────────────────

@router.get("/obras/{obra_id}/rdos", response_model=list[RDOResumo])
async def listar_rdos(obra_id: uuid.UUID, db: DB, current_user: CurrentUser):
    await _get_obra(obra_id, db, current_user.tenant_id)
    result = await db.execute(
        select(RDO)
        .where(RDO.obra_id == obra_id, RDO.tenant_id == current_user.tenant_id)
        .order_by(RDO.data.desc())
    )
    return [_to_resumo(r) for r in result.scalars().all()]


@router.post("/obras/{obra_id}/rdos", response_model=RDOResponse, status_code=status.HTTP_201_CREATED)
async def criar_rdo(obra_id: uuid.UUID, body: RDOCreate, db: DB, current_user: CurrentUser):
    await _get_obra(obra_id, db, current_user.tenant_id)

    rdo = RDO(
        id=uuid.uuid4(),
        obra_id=obra_id,
        tenant_id=current_user.tenant_id,
        data=body.data,
        clima_manha=body.clima_manha,
        clima_tarde=body.clima_tarde,
        efetivo_total=body.efetivo_total,
        equipes=[e.model_dump() for e in body.equipes],
        atividades=body.atividades,
        ocorrencias=[o.model_dump() for o in body.ocorrencias],
        observacoes=body.observacoes,
        status="rascunho",
    )
    db.add(rdo)
    await db.commit()
    await db.refresh(rdo)
    return RDOResponse.model_validate(rdo)


@router.get("/rdos/{rdo_id}", response_model=RDOResponse)
async def buscar_rdo(rdo_id: uuid.UUID, db: DB, current_user: CurrentUser):
    rdo = await _get_rdo(rdo_id, db, current_user.tenant_id)
    return RDOResponse.model_validate(rdo)


@router.patch("/rdos/{rdo_id}", response_model=RDOResponse)
async def atualizar_rdo(rdo_id: uuid.UUID, body: RDOUpdate, db: DB, current_user: CurrentUser):
    rdo = await _get_rdo(rdo_id, db, current_user.tenant_id)

    dados = body.model_dump(exclude_unset=True)
    if "equipes" in dados and dados["equipes"] is not None:
        dados["equipes"] = [e.model_dump() if hasattr(e, "model_dump") else e for e in dados["equipes"]]
    if "ocorrencias" in dados and dados["ocorrencias"] is not None:
        dados["ocorrencias"] = [o.model_dump() if hasattr(o, "model_dump") else o for o in dados["ocorrencias"]]

    for campo, valor in dados.items():
        setattr(rdo, campo, valor)

    await db.commit()
    await db.refresh(rdo)
    return RDOResponse.model_validate(rdo)


@router.delete("/rdos/{rdo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_rdo(rdo_id: uuid.UUID, db: DB, current_user: CurrentUser):
    rdo = await _get_rdo(rdo_id, db, current_user.tenant_id)
    await db.delete(rdo)
    await db.commit()


# ── Transcrição de Voz ─────────────────────────────────────────────────────────

class TranscricaoVozResponse(BaseModel):
    transcricao: str
    clima_manha: str | None = None
    clima_tarde: str | None = None
    efetivo_total: int | None = None
    equipes: list[dict] = []
    atividades: list[str] = []
    ocorrencias: list[dict] = []
    observacoes: str | None = None


@router.post(
    "/rdos/transcrever-voz",
    response_model=TranscricaoVozResponse,
    summary="Transcreve um áudio de relato e extrai os campos estruturados do RDO",
)
async def transcrever_voz(
    current_user: CurrentUser,
    audio: UploadFile = File(..., description="Arquivo de áudio (webm/ogg/mp3/wav/m4a)"),
):
    """Recebe um arquivo de áudio (relato do responsável), transcreve via Gemini
    e devolve os campos estruturados prontos para preencher o formulário do RDO.

    O frontend pode então mostrar os campos preenchidos para o usuário revisar
    antes de salvar via POST /obras/{obra_id}/rdos.
    """
    if not audio.content_type or not audio.content_type.startswith("audio/"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Tipo de arquivo inválido: {audio.content_type}. Envie um áudio.",
        )

    audio_bytes = await audio.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Arquivo de áudio vazio.")
    if len(audio_bytes) > 30 * 1024 * 1024:  # 30 MB
        raise HTTPException(status_code=413, detail="Áudio muito grande (máximo 30 MB).")

    try:
        dados = await transcrever_rdo_voz(audio_bytes, mime_type=audio.content_type)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Erro ao transcrever via Gemini: {exc}",
        )

    return TranscricaoVozResponse(**dados)


# ── Geração IA ─────────────────────────────────────────────────────────────────

@router.post("/rdos/{rdo_id}/gerar-ia", response_model=RDOResponse)
async def gerar_ia(rdo_id: uuid.UUID, db: DB, current_user: CurrentUser):
    """Gera o texto formal do RDO via Gemini e salva em conteudo_ia."""
    rdo = await _get_rdo(rdo_id, db, current_user.tenant_id)

    # Busca nome da obra
    obra_result = await db.execute(select(Obra).where(Obra.id == rdo.obra_id))
    obra = obra_result.scalar_one_or_none()
    obra_nome = obra.nome if obra else "Obra"

    dados = {
        "obra_nome": obra_nome,
        "data": str(rdo.data),
        "clima_manha": rdo.clima_manha,
        "clima_tarde": rdo.clima_tarde,
        "efetivo_total": rdo.efetivo_total,
        "equipes": rdo.equipes or [],
        "atividades": rdo.atividades or [],
        "ocorrencias": rdo.ocorrencias or [],
        "observacoes": rdo.observacoes,
    }

    try:
        texto = await gerar_rdo_texto(dados)
        rdo.conteudo_ia = texto
        await db.commit()
        await db.refresh(rdo)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Gemini indisponível: {str(e)}",
        )

    return RDOResponse.model_validate(rdo)
