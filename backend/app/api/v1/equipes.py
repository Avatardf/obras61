"""
API do módulo de Equipes — colaboradores, equipes e alocação por obra.
"""
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import CurrentUser
from app.models.equipe import Colaborador, Equipe, EquipeAlocacao, TipoVinculo
from app.models.obra import Obra

router = APIRouter(tags=["equipes"])
DB = Depends(get_db)


# ── Schemas ────────────────────────────────────────────────────────────────────

class ColaboradorResponse(BaseModel):
    id: uuid.UUID
    nome: str
    funcao: str
    tipo_vinculo: str
    fornecedor_id: uuid.UUID | None
    equipe_id: uuid.UUID | None
    custo_diaria: float | None
    telefone: str | None
    observacoes: str | None
    ativo: bool

    model_config = {"from_attributes": True}


class ColaboradorCreate(BaseModel):
    nome: str
    funcao: str
    tipo_vinculo: TipoVinculo = TipoVinculo.proprio
    fornecedor_id: uuid.UUID | None = None
    equipe_id: uuid.UUID | None = None
    custo_diaria: float | None = None
    telefone: str | None = None
    observacoes: str | None = None


class ColaboradorUpdate(BaseModel):
    nome: str | None = None
    funcao: str | None = None
    tipo_vinculo: TipoVinculo | None = None
    fornecedor_id: uuid.UUID | None = None
    equipe_id: uuid.UUID | None = None
    custo_diaria: float | None = None
    telefone: str | None = None
    observacoes: str | None = None
    ativo: bool | None = None

    # distingue "não enviado" de "enviado como null" para equipe_id/fornecedor_id
    model_config = {"extra": "ignore"}


class AlocacaoResponse(BaseModel):
    id: uuid.UUID
    equipe_id: uuid.UUID
    obra_id: uuid.UUID
    obra_nome: str | None = None
    data_inicio: date
    data_fim: date | None
    observacao: str | None

    model_config = {"from_attributes": True}


class AlocacaoCreate(BaseModel):
    obra_id: uuid.UUID
    data_inicio: date
    data_fim: date | None = None
    observacao: str | None = None


class AlocacaoUpdate(BaseModel):
    data_inicio: date | None = None
    data_fim: date | None = None
    observacao: str | None = None


class EquipeResponse(BaseModel):
    id: uuid.UUID
    nome: str
    lider_id: uuid.UUID | None
    descricao: str | None
    ativo: bool
    membros: list[ColaboradorResponse] = []
    alocacao_atual: AlocacaoResponse | None = None

    model_config = {"from_attributes": True}


class EquipeCreate(BaseModel):
    nome: str
    lider_id: uuid.UUID | None = None
    descricao: str | None = None


class EquipeUpdate(BaseModel):
    nome: str | None = None
    lider_id: uuid.UUID | None = None
    descricao: str | None = None
    ativo: bool | None = None


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _get_equipe(db: AsyncSession, equipe_id: uuid.UUID, tenant_id) -> Equipe:
    stmt = (
        select(Equipe)
        .options(selectinload(Equipe.membros), selectinload(Equipe.alocacoes))
        .where(Equipe.id == equipe_id, Equipe.tenant_id == tenant_id)
    )
    equipe = (await db.execute(stmt)).scalar_one_or_none()
    if not equipe:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Equipe não encontrada")
    return equipe


async def _equipe_response(db: AsyncSession, equipe: Equipe) -> EquipeResponse:
    resp = EquipeResponse.model_validate(equipe)
    atual = next((a for a in equipe.alocacoes if a.data_fim is None), None)
    if atual:
        obra = await db.get(Obra, atual.obra_id)
        resp.alocacao_atual = AlocacaoResponse.model_validate(atual)
        resp.alocacao_atual.obra_nome = obra.nome if obra else None
    return resp


# ── Colaboradores ──────────────────────────────────────────────────────────────

@router.get("/colaboradores", response_model=list[ColaboradorResponse])
async def listar_colaboradores(
    ativo: bool | None = None,
    equipe_id: uuid.UUID | None = None,
    db: AsyncSession = DB,
    user: CurrentUser = None,
):
    stmt = select(Colaborador).where(Colaborador.tenant_id == user.tenant_id)
    if ativo is not None:
        stmt = stmt.where(Colaborador.ativo == ativo)
    if equipe_id is not None:
        stmt = stmt.where(Colaborador.equipe_id == equipe_id)
    result = await db.execute(stmt.order_by(Colaborador.nome))
    return result.scalars().all()


@router.post("/colaboradores", response_model=ColaboradorResponse, status_code=status.HTTP_201_CREATED)
async def criar_colaborador(body: ColaboradorCreate, db: AsyncSession = DB, user: CurrentUser = None):
    novo = Colaborador(id=uuid.uuid4(), tenant_id=user.tenant_id, **body.model_dump())
    db.add(novo)
    await db.commit()
    await db.refresh(novo)
    return novo


@router.patch("/colaboradores/{cid}", response_model=ColaboradorResponse)
async def atualizar_colaborador(
    cid: uuid.UUID, body: ColaboradorUpdate, db: AsyncSession = DB, user: CurrentUser = None
):
    alvo = await db.get(Colaborador, cid)
    if not alvo or alvo.tenant_id != user.tenant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Colaborador não encontrado")
    for campo, valor in body.model_dump(exclude_unset=True).items():
        setattr(alvo, campo, valor)
    await db.commit()
    await db.refresh(alvo)
    return alvo


@router.delete("/colaboradores/{cid}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_colaborador(cid: uuid.UUID, db: AsyncSession = DB, user: CurrentUser = None):
    alvo = await db.get(Colaborador, cid)
    if not alvo or alvo.tenant_id != user.tenant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Colaborador não encontrado")
    # Se for líder de alguma equipe, desvincula antes
    equipes_lideradas = await db.execute(
        select(Equipe).where(Equipe.lider_id == cid)
    )
    for eq in equipes_lideradas.scalars():
        eq.lider_id = None
    await db.delete(alvo)
    await db.commit()


# ── Equipes ────────────────────────────────────────────────────────────────────

@router.get("/equipes", response_model=list[EquipeResponse])
async def listar_equipes(ativo: bool | None = None, db: AsyncSession = DB, user: CurrentUser = None):
    stmt = (
        select(Equipe)
        .options(selectinload(Equipe.membros), selectinload(Equipe.alocacoes))
        .where(Equipe.tenant_id == user.tenant_id)
    )
    if ativo is not None:
        stmt = stmt.where(Equipe.ativo == ativo)
    equipes = (await db.execute(stmt.order_by(Equipe.nome))).scalars().all()
    return [await _equipe_response(db, e) for e in equipes]


@router.post("/equipes", response_model=EquipeResponse, status_code=status.HTTP_201_CREATED)
async def criar_equipe(body: EquipeCreate, db: AsyncSession = DB, user: CurrentUser = None):
    nova = Equipe(id=uuid.uuid4(), tenant_id=user.tenant_id, **body.model_dump())
    db.add(nova)
    await db.commit()
    return await _equipe_response(db, await _get_equipe(db, nova.id, user.tenant_id))


@router.patch("/equipes/{eid}", response_model=EquipeResponse)
async def atualizar_equipe(
    eid: uuid.UUID, body: EquipeUpdate, db: AsyncSession = DB, user: CurrentUser = None
):
    equipe = await _get_equipe(db, eid, user.tenant_id)
    for campo, valor in body.model_dump(exclude_unset=True).items():
        setattr(equipe, campo, valor)
    await db.commit()
    return await _equipe_response(db, await _get_equipe(db, eid, user.tenant_id))


@router.delete("/equipes/{eid}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_equipe(eid: uuid.UUID, db: AsyncSession = DB, user: CurrentUser = None):
    equipe = await _get_equipe(db, eid, user.tenant_id)
    # Desvincula membros antes de excluir
    for membro in equipe.membros:
        membro.equipe_id = None
    await db.delete(equipe)
    await db.commit()


# ── Alocações ──────────────────────────────────────────────────────────────────

@router.get("/equipes/{eid}/alocacoes", response_model=list[AlocacaoResponse])
async def listar_alocacoes(eid: uuid.UUID, db: AsyncSession = DB, user: CurrentUser = None):
    await _get_equipe(db, eid, user.tenant_id)
    stmt = (
        select(EquipeAlocacao, Obra.nome)
        .join(Obra, Obra.id == EquipeAlocacao.obra_id)
        .where(EquipeAlocacao.equipe_id == eid)
        .order_by(EquipeAlocacao.data_inicio.desc())
    )
    rows = (await db.execute(stmt)).all()
    out = []
    for aloc, obra_nome in rows:
        item = AlocacaoResponse.model_validate(aloc)
        item.obra_nome = obra_nome
        out.append(item)
    return out


@router.post("/equipes/{eid}/alocacoes", response_model=AlocacaoResponse, status_code=status.HTTP_201_CREATED)
async def criar_alocacao(
    eid: uuid.UUID, body: AlocacaoCreate, db: AsyncSession = DB, user: CurrentUser = None
):
    equipe = await _get_equipe(db, eid, user.tenant_id)
    obra = await db.get(Obra, body.obra_id)
    if not obra or obra.tenant_id != user.tenant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Obra não encontrada")

    # Encerra alocação atual em aberto (uma equipe fica em uma obra por vez)
    aberta = next((a for a in equipe.alocacoes if a.data_fim is None), None)
    if aberta:
        aberta.data_fim = body.data_inicio

    nova = EquipeAlocacao(
        id=uuid.uuid4(), tenant_id=user.tenant_id, equipe_id=eid, **body.model_dump()
    )
    db.add(nova)
    await db.commit()
    await db.refresh(nova)
    resp = AlocacaoResponse.model_validate(nova)
    resp.obra_nome = obra.nome
    return resp


@router.patch("/alocacoes/{aid}", response_model=AlocacaoResponse)
async def atualizar_alocacao(
    aid: uuid.UUID, body: AlocacaoUpdate, db: AsyncSession = DB, user: CurrentUser = None
):
    aloc = await db.get(EquipeAlocacao, aid)
    if not aloc or aloc.tenant_id != user.tenant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alocação não encontrada")
    for campo, valor in body.model_dump(exclude_unset=True).items():
        setattr(aloc, campo, valor)
    await db.commit()
    await db.refresh(aloc)
    obra = await db.get(Obra, aloc.obra_id)
    resp = AlocacaoResponse.model_validate(aloc)
    resp.obra_nome = obra.nome if obra else None
    return resp


@router.delete("/alocacoes/{aid}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_alocacao(aid: uuid.UUID, db: AsyncSession = DB, user: CurrentUser = None):
    aloc = await db.get(EquipeAlocacao, aid)
    if not aloc or aloc.tenant_id != user.tenant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alocação não encontrada")
    await db.delete(aloc)
    await db.commit()
