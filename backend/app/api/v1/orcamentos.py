import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import CurrentUser
from app.models.obra import Obra
from app.models.orcamento import CustoRealizado, ItemOrcamento, Orcamento
from app.schemas.orcamento import (
    CustoRealizadoCreate, CustoRealizadoResponse,
    ItemOrcamentoCreate, ItemOrcamentoResponse, ItemOrcamentoUpdate,
    OrcamentoCreate, OrcamentoDetalhe, OrcamentoResponse, OrcamentoResumo, OrcamentoUpdate,
)

router = APIRouter(tags=["orcamentos"])
DB = Annotated[AsyncSession, Depends(get_db)]


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _get_obra(obra_id: uuid.UUID, db: AsyncSession, tenant_id: uuid.UUID) -> Obra:
    result = await db.execute(
        select(Obra).where(Obra.id == obra_id, Obra.tenant_id == tenant_id)
    )
    obra = result.scalar_one_or_none()
    if not obra:
        raise HTTPException(status_code=404, detail="Obra não encontrada")
    return obra


async def _get_orcamento(orc_id: uuid.UUID, db: AsyncSession, tenant_id: uuid.UUID) -> Orcamento:
    result = await db.execute(
        select(Orcamento).where(
            Orcamento.id == orc_id,
            Orcamento.tenant_id == tenant_id,
        )
    )
    orc = result.scalar_one_or_none()
    if not orc:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    return orc


async def _total_itens(orc_id: uuid.UUID, db: AsyncSession) -> int:
    r = await db.execute(
        select(func.count(ItemOrcamento.id)).where(ItemOrcamento.orcamento_id == orc_id)
    )
    return r.scalar() or 0


# ── ORÇAMENTOS — visão geral do tenant ────────────────────────────────────────

@router.get("/orcamentos", response_model=list[OrcamentoResumo])
async def listar_todos_orcamentos(db: DB, current_user: CurrentUser):
    """Lista todos os orçamentos do tenant com nome da obra."""
    rows = await db.execute(
        select(Orcamento, Obra.nome.label("obra_nome"))
        .join(Obra, Obra.id == Orcamento.obra_id)
        .where(Orcamento.tenant_id == current_user.tenant_id)
        .order_by(Orcamento.criado_em.desc())
    )
    result = rows.all()

    if not result:
        return []

    orc_ids = [row[0].id for row in result]
    count_rows = await db.execute(
        select(ItemOrcamento.orcamento_id, func.count(ItemOrcamento.id).label("total"))
        .where(ItemOrcamento.orcamento_id.in_(orc_ids))
        .group_by(ItemOrcamento.orcamento_id)
    )
    count_map = {r.orcamento_id: r.total for r in count_rows}

    items = []
    for orc, obra_nome in result:
        resp = OrcamentoResumo.model_validate(orc)
        resp.total_itens = count_map.get(orc.id, 0)
        resp.obra_nome = obra_nome
        items.append(resp)
    return items


# ── ORÇAMENTOS — por obra ──────────────────────────────────────────────────────

@router.get("/obras/{obra_id}/orcamentos", response_model=list[OrcamentoResponse])
async def listar_orcamentos(obra_id: uuid.UUID, db: DB, current_user: CurrentUser):
    await _get_obra(obra_id, db, current_user.tenant_id)

    result = await db.execute(
        select(Orcamento)
        .where(Orcamento.obra_id == obra_id, Orcamento.tenant_id == current_user.tenant_id)
        .order_by(Orcamento.versao.desc())
    )
    orcamentos = result.scalars().all()

    if not orcamentos:
        return []

    orc_ids = [o.id for o in orcamentos]
    count_result = await db.execute(
        select(ItemOrcamento.orcamento_id, func.count(ItemOrcamento.id).label("total"))
        .where(ItemOrcamento.orcamento_id.in_(orc_ids))
        .group_by(ItemOrcamento.orcamento_id)
    )
    count_map = {r.orcamento_id: r.total for r in count_result}

    items = []
    for o in orcamentos:
        resp = OrcamentoResponse.model_validate(o)
        resp.total_itens = count_map.get(o.id, 0)
        items.append(resp)
    return items


@router.post(
    "/obras/{obra_id}/orcamentos",
    response_model=OrcamentoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def criar_orcamento(
    obra_id: uuid.UUID, body: OrcamentoCreate, db: DB, current_user: CurrentUser
):
    await _get_obra(obra_id, db, current_user.tenant_id)

    versao_result = await db.execute(
        select(func.max(Orcamento.versao)).where(Orcamento.obra_id == obra_id)
    )
    proxima_versao = (versao_result.scalar() or 0) + 1

    orc = Orcamento(
        id=uuid.uuid4(),
        obra_id=obra_id,
        tenant_id=current_user.tenant_id,
        versao=proxima_versao,
        descricao=body.descricao,
        bdi_percentual=body.bdi_percentual,
        data_referencia=body.data_referencia,
        base_referencia=body.base_referencia,
        uf_referencia=body.uf_referencia,
        valor_total=0.0,
        status="rascunho",
    )
    db.add(orc)
    await db.commit()
    await db.refresh(orc)

    resp = OrcamentoResponse.model_validate(orc)
    resp.total_itens = 0
    return resp


@router.get("/orcamentos/{orc_id}", response_model=OrcamentoDetalhe)
async def buscar_orcamento(orc_id: uuid.UUID, db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(Orcamento)
        .options(selectinload(Orcamento.itens))
        .where(Orcamento.id == orc_id, Orcamento.tenant_id == current_user.tenant_id)
    )
    orc = result.scalar_one_or_none()
    if not orc:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")

    resp = OrcamentoDetalhe.model_validate(orc)
    resp.total_itens = len(orc.itens)
    resp.itens = [ItemOrcamentoResponse.model_validate(i) for i in orc.itens]
    return resp


@router.patch("/orcamentos/{orc_id}", response_model=OrcamentoResponse)
async def atualizar_orcamento(
    orc_id: uuid.UUID, body: OrcamentoUpdate, db: DB, current_user: CurrentUser
):
    orc = await _get_orcamento(orc_id, db, current_user.tenant_id)

    # Só pode ativar um orçamento se não houver outro vigente na mesma obra
    if body.status == "vigente":
        vigente = await db.execute(
            select(Orcamento.id).where(
                Orcamento.obra_id == orc.obra_id,
                Orcamento.status == "vigente",
                Orcamento.id != orc_id,
            )
        )
        if vigente.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail="Já existe um orçamento vigente para esta obra. Arquive-o primeiro.",
            )

    dados = body.model_dump(exclude_unset=True)
    for campo, valor in dados.items():
        setattr(orc, campo, valor)

    await db.commit()
    await db.refresh(orc)

    resp = OrcamentoResponse.model_validate(orc)
    resp.total_itens = await _total_itens(orc_id, db)
    return resp


@router.delete("/orcamentos/{orc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_orcamento(orc_id: uuid.UUID, db: DB, current_user: CurrentUser):
    orc = await _get_orcamento(orc_id, db, current_user.tenant_id)
    if orc.status == "vigente":
        raise HTTPException(
            status_code=409,
            detail="Não é possível excluir um orçamento vigente. Arquive-o primeiro.",
        )
    await db.delete(orc)
    await db.commit()


# ── ITENS ──────────────────────────────────────────────────────────────────────

@router.post(
    "/orcamentos/{orc_id}/itens",
    response_model=ItemOrcamentoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def adicionar_item(
    orc_id: uuid.UUID, body: ItemOrcamentoCreate, db: DB, current_user: CurrentUser
):
    orc = await _get_orcamento(orc_id, db, current_user.tenant_id)

    custo_total = round(body.quantidade * body.custo_unitario, 2)
    item = ItemOrcamento(
        id=uuid.uuid4(),
        orcamento_id=orc_id,
        etapa_id=body.etapa_id,
        codigo_composicao=body.codigo_composicao,
        descricao=body.descricao,
        unidade=body.unidade,
        quantidade=body.quantidade,
        custo_unitario=body.custo_unitario,
        custo_total=custo_total,
        origem_preco=body.origem_preco,
    )
    db.add(item)

    orc.valor_total = round(float(orc.valor_total or 0) + custo_total, 2)
    await db.commit()
    await db.refresh(item)
    return ItemOrcamentoResponse.model_validate(item)


@router.patch("/itens-orcamento/{item_id}", response_model=ItemOrcamentoResponse)
async def atualizar_item(
    item_id: uuid.UUID, body: ItemOrcamentoUpdate, db: DB, current_user: CurrentUser
):
    result = await db.execute(
        select(ItemOrcamento)
        .join(Orcamento, Orcamento.id == ItemOrcamento.orcamento_id)
        .where(
            ItemOrcamento.id == item_id,
            Orcamento.tenant_id == current_user.tenant_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")

    custo_antigo = float(item.custo_total)

    dados = body.model_dump(exclude_unset=True)
    for campo, valor in dados.items():
        setattr(item, campo, valor)

    item.custo_total = round(float(item.quantidade) * float(item.custo_unitario), 2)

    orc_result = await db.execute(
        select(Orcamento).where(Orcamento.id == item.orcamento_id)
    )
    orc = orc_result.scalar_one_or_none()
    if orc:
        orc.valor_total = round(
            max(0.0, float(orc.valor_total or 0) - custo_antigo + float(item.custo_total)), 2
        )

    await db.commit()
    await db.refresh(item)
    return ItemOrcamentoResponse.model_validate(item)


@router.delete("/itens-orcamento/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_item(item_id: uuid.UUID, db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(ItemOrcamento)
        .join(Orcamento, Orcamento.id == ItemOrcamento.orcamento_id)
        .where(
            ItemOrcamento.id == item_id,
            Orcamento.tenant_id == current_user.tenant_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")

    orc_result = await db.execute(
        select(Orcamento).where(Orcamento.id == item.orcamento_id)
    )
    orc = orc_result.scalar_one_or_none()
    if orc:
        orc.valor_total = round(
            max(0.0, float(orc.valor_total or 0) - float(item.custo_total)), 2
        )

    await db.delete(item)
    await db.commit()


# ── CUSTOS REALIZADOS ──────────────────────────────────────────────────────────

@router.get("/obras/{obra_id}/custos", response_model=list[CustoRealizadoResponse])
async def listar_custos(obra_id: uuid.UUID, db: DB, current_user: CurrentUser):
    await _get_obra(obra_id, db, current_user.tenant_id)
    result = await db.execute(
        select(CustoRealizado)
        .where(
            CustoRealizado.obra_id == obra_id,
            CustoRealizado.tenant_id == current_user.tenant_id,
        )
        .order_by(CustoRealizado.data_lancamento.desc())
    )
    return [CustoRealizadoResponse.model_validate(c) for c in result.scalars().all()]


@router.post(
    "/obras/{obra_id}/custos",
    response_model=CustoRealizadoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def registrar_custo(
    obra_id: uuid.UUID, body: CustoRealizadoCreate, db: DB, current_user: CurrentUser
):
    await _get_obra(obra_id, db, current_user.tenant_id)

    custo = CustoRealizado(
        id=uuid.uuid4(),
        obra_id=obra_id,
        tenant_id=current_user.tenant_id,
        etapa_id=body.etapa_id,
        tipo=body.tipo,
        descricao=body.descricao,
        data_lancamento=body.data_lancamento,
        valor=body.valor,
        nota_fiscal=body.nota_fiscal,
    )
    db.add(custo)
    await db.commit()
    await db.refresh(custo)
    return CustoRealizadoResponse.model_validate(custo)


@router.delete("/custos/{custo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_custo(custo_id: uuid.UUID, db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(CustoRealizado).where(
            CustoRealizado.id == custo_id,
            CustoRealizado.tenant_id == current_user.tenant_id,
        )
    )
    custo = result.scalar_one_or_none()
    if not custo:
        raise HTTPException(status_code=404, detail="Custo não encontrado")
    await db.delete(custo)
    await db.commit()
