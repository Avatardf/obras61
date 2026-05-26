import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import CurrentUser
from app.models.obra import Empreendimento, EstimativaCusto, Obra
from app.schemas.empreendimento import (
    EmpreendimentoCreate,
    EmpreendimentoDetalhe,
    EmpreendimentoLista,
    EmpreendimentoResponse,
    EmpreendimentoUpdate,
    EstimativaCustoResponse,
)
from app.services.gemini import estimar_custos_empreendimento

router = APIRouter(prefix="/empreendimentos", tags=["empreendimentos"])

DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("", response_model=EmpreendimentoLista)
async def listar(
    db: DB,
    current_user: CurrentUser,
    pagina: int = Query(default=1, ge=1),
    por_pagina: int = Query(default=12, ge=1, le=100),
    status: str | None = Query(default=None),
    busca: str | None = Query(default=None),
):
    q = select(Empreendimento).where(
        Empreendimento.tenant_id == current_user.tenant_id,
        Empreendimento.deleted_at.is_(None),   # exclui soft-deleted
    )
    if status:
        q = q.where(Empreendimento.status == status)
    if busca:
        q = q.where(Empreendimento.nome.ilike(f"%{busca}%"))

    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar() or 0

    q = q.order_by(Empreendimento.criado_em.desc())
    q = q.offset((pagina - 1) * por_pagina).limit(por_pagina)

    result = await db.execute(q)
    empreendimentos = result.scalars().all()

    ids = [e.id for e in empreendimentos]
    obras_count: dict[uuid.UUID, int] = {}
    primary_obra: dict[uuid.UUID, uuid.UUID] = {}
    if ids:
        count_q = (
            select(Obra.empreendimento_id, func.count(Obra.id).label("total"))
            .where(Obra.empreendimento_id.in_(ids))
            .group_by(Obra.empreendimento_id)
        )
        count_result = await db.execute(count_q)
        obras_count = {row.empreendimento_id: row.total for row in count_result}

        # Primeira obra (mais antiga) de cada empreendimento — atalho para CC
        primary_q = (
            select(Obra.empreendimento_id, Obra.id)
            .where(Obra.empreendimento_id.in_(ids))
            .order_by(Obra.empreendimento_id, Obra.criado_em.asc())
        )
        primary_rows = (await db.execute(primary_q)).all()
        for emp_id, obra_id in primary_rows:
            if emp_id not in primary_obra:
                primary_obra[emp_id] = obra_id

    items = []
    for e in empreendimentos:
        data = EmpreendimentoResponse.model_validate(e)
        data.total_obras = obras_count.get(e.id, 0)
        data.primary_obra_id = primary_obra.get(e.id)
        items.append(data)

    return EmpreendimentoLista(items=items, total=total, pagina=pagina, por_pagina=por_pagina)


@router.get("/{id}", response_model=EmpreendimentoDetalhe)
async def buscar(id: uuid.UUID, db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(Empreendimento)
        .options(selectinload(Empreendimento.obras))
        .where(
            Empreendimento.id == id,
            Empreendimento.tenant_id == current_user.tenant_id,
        )
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Empreendimento não encontrado")

    data = EmpreendimentoDetalhe.model_validate(emp)
    data.total_obras = len(emp.obras)
    if emp.obras:
        # ordena por criado_em ascendente
        obras_sorted = sorted(emp.obras, key=lambda o: o.criado_em or 0)
        data.primary_obra_id = obras_sorted[0].id
    return data


@router.post("", response_model=EmpreendimentoResponse, status_code=status.HTTP_201_CREATED)
async def criar(body: EmpreendimentoCreate, db: DB, current_user: CurrentUser):
    emp = Empreendimento(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        nome=body.nome,
        tipo=body.tipo,
        endereco=body.endereco.model_dump(),
        vgv_previsto=body.vgv_previsto,
        status=body.status,
        num_unidades=body.num_unidades,
        area_terreno_m2=body.area_terreno_m2,
        valor_terreno=body.valor_terreno,
        preco_custo_unidade=body.preco_custo_unidade,
        preco_venda_unidade=body.preco_venda_unidade,
        padrao_construtivo=body.padrao_construtivo,
        metragem_media_unidade=body.metragem_media_unidade,
        num_pavimentos_estimado=body.num_pavimentos_estimado,
        estacionamento_tipo=body.estacionamento_tipo,
        num_vagas=body.num_vagas,
        num_elevadores=body.num_elevadores,
        sistema_estrutural=body.sistema_estrutural,
        diferenciais_lazer=body.diferenciais_lazer,
        probabilidade=body.probabilidade,
        modelo_negocio=body.modelo_negocio,
        parceiro=body.parceiro,
        produto=body.produto,
    )
    db.add(emp)
    await db.commit()
    await db.refresh(emp)
    return EmpreendimentoResponse.model_validate(emp)


@router.patch("/{id}", response_model=EmpreendimentoResponse)
async def atualizar(id: uuid.UUID, body: EmpreendimentoUpdate, db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(Empreendimento).where(
            Empreendimento.id == id,
            Empreendimento.tenant_id == current_user.tenant_id,
        )
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Empreendimento não encontrado")

    dados = body.model_dump(exclude_unset=True)
    if "endereco" in dados and dados["endereco"]:
        dados["endereco"] = body.endereco.model_dump()

    for campo, valor in dados.items():
        setattr(emp, campo, valor)

    await db.commit()
    await db.refresh(emp)
    return EmpreendimentoResponse.model_validate(emp)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir(id: uuid.UUID, db: DB, current_user: CurrentUser):
    """Soft delete: marca o empreendimento como excluído (vai para a Lixeira).
    Os dados são preservados — pode ser restaurado a qualquer momento.
    """
    result = await db.execute(
        select(Empreendimento).where(
            Empreendimento.id == id,
            Empreendimento.tenant_id == current_user.tenant_id,
            Empreendimento.deleted_at.is_(None),
        )
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Empreendimento não encontrado")
    emp.deleted_at = datetime.now(timezone.utc)
    await db.commit()


# ── Lixeira ───────────────────────────────────────────────────────────────────

@router.get("/lixeira/items", response_model=list[EmpreendimentoResponse])
async def listar_lixeira(db: DB, current_user: CurrentUser):
    """Lista os empreendimentos soft-deleted (Lixeira)."""
    q = (
        select(Empreendimento)
        .where(
            Empreendimento.tenant_id == current_user.tenant_id,
            Empreendimento.deleted_at.is_not(None),
        )
        .order_by(Empreendimento.deleted_at.desc())
    )
    result = await db.execute(q)
    empreendimentos = result.scalars().all()

    ids = [e.id for e in empreendimentos]
    obras_count: dict[uuid.UUID, int] = {}
    if ids:
        count_q = (
            select(Obra.empreendimento_id, func.count(Obra.id).label("total"))
            .where(Obra.empreendimento_id.in_(ids))
            .group_by(Obra.empreendimento_id)
        )
        for row in (await db.execute(count_q)).all():
            obras_count[row.empreendimento_id] = row.total

    items = []
    for e in empreendimentos:
        data = EmpreendimentoResponse.model_validate(e)
        data.total_obras = obras_count.get(e.id, 0)
        items.append(data)
    return items


@router.post("/{id}/restaurar", response_model=EmpreendimentoResponse)
async def restaurar(id: uuid.UUID, db: DB, current_user: CurrentUser):
    """Restaura um empreendimento da Lixeira (desfaz o soft delete)."""
    result = await db.execute(
        select(Empreendimento).where(
            Empreendimento.id == id,
            Empreendimento.tenant_id == current_user.tenant_id,
            Empreendimento.deleted_at.is_not(None),
        )
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Empreendimento não encontrado na Lixeira")
    emp.deleted_at = None
    await db.commit()
    await db.refresh(emp)
    return EmpreendimentoResponse.model_validate(emp)


@router.delete("/{id}/permanente", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_permanente(id: uuid.UUID, db: DB, current_user: CurrentUser):
    """Exclui o empreendimento de forma DEFINITIVA (apaga do BD, com cascata)."""
    result = await db.execute(
        select(Empreendimento)
        .options(selectinload(Empreendimento.obras))
        .where(
            Empreendimento.id == id,
            Empreendimento.tenant_id == current_user.tenant_id,
            Empreendimento.deleted_at.is_not(None),   # só pode excluir definitivamente quem JÁ está na lixeira
        )
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(
            status_code=404,
            detail="Empreendimento não está na Lixeira. Exclua para a Lixeira primeiro.",
        )
    if emp.obras:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Empreendimento possui {len(emp.obras)} obra(s) vinculada(s). Remova-as primeiro.",
        )
    await db.delete(emp)
    await db.commit()


# ── Estimativas de Custo ──────────────────────────────────────────────────────

@router.post(
    "/{id}/estimativas",
    response_model=EstimativaCustoResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Gera estimativa paramétrica de custos via Gemini",
)
async def gerar_estimativa(id: uuid.UUID, db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(Empreendimento).where(
            Empreendimento.id == id,
            Empreendimento.tenant_id == current_user.tenant_id,
        )
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Empreendimento não encontrado")

    # Monta dict de entrada para o prompt
    end = emp.endereco or {}
    dados = {
        "nome": emp.nome,
        "cidade": end.get("cidade", ""),
        "uf": end.get("uf", "RJ"),
        "tipo": emp.tipo,
        "num_unidades": emp.num_unidades,
        "metragem_media_unidade": float(emp.metragem_media_unidade) if emp.metragem_media_unidade else None,
        "num_pavimentos_estimado": emp.num_pavimentos_estimado,
        "area_terreno_m2": float(emp.area_terreno_m2) if emp.area_terreno_m2 else None,
        "padrao_construtivo": emp.padrao_construtivo or "normal",
        "sistema_estrutural": emp.sistema_estrutural or "concreto_armado",
        "estacionamento_tipo": emp.estacionamento_tipo or "nenhum",
        "num_vagas": emp.num_vagas or 0,
        "num_elevadores": emp.num_elevadores or 0,
        "diferenciais_lazer": emp.diferenciais_lazer or [],
        "vgv_previsto": float(emp.vgv_previsto) if emp.vgv_previsto else None,
    }

    try:
        resultado = await estimar_custos_empreendimento(dados)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Erro ao chamar Gemini: {exc}",
        )

    est = EstimativaCusto(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        empreendimento_id=emp.id,
        custo_total=resultado.get("custo_total", 0),
        custo_total_min=resultado.get("custo_total_min"),
        custo_total_max=resultado.get("custo_total_max"),
        custo_por_m2_construido=resultado.get("custo_por_m2_construido"),
        area_construida_estimada_m2=resultado.get("area_construida_estimada_m2"),
        custo_por_unidade=resultado.get("custo_por_unidade"),
        confianca=resultado.get("confianca", "media"),
        referencia_cub=resultado.get("referencia_cub"),
        multiplicador_cub=resultado.get("multiplicador_cub"),
        breakdown=resultado.get("breakdown", {}),
        premissas=resultado.get("premissas", []),
        observacoes=resultado.get("observacoes"),
        parametros_entrada=dados,
    )
    db.add(est)
    await db.commit()
    await db.refresh(est)
    return EstimativaCustoResponse.model_validate(est)


@router.get(
    "/{id}/estimativas",
    response_model=list[EstimativaCustoResponse],
    summary="Lista estimativas de custo do empreendimento",
)
async def listar_estimativas(id: uuid.UUID, db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(EstimativaCusto)
        .where(
            EstimativaCusto.empreendimento_id == id,
            EstimativaCusto.tenant_id == current_user.tenant_id,
        )
        .order_by(EstimativaCusto.gerado_em.desc())
    )
    return [EstimativaCustoResponse.model_validate(e) for e in result.scalars().all()]


@router.delete(
    "/{id}/estimativas/{est_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove uma estimativa",
)
async def excluir_estimativa(
    id: uuid.UUID, est_id: uuid.UUID, db: DB, current_user: CurrentUser
):
    result = await db.execute(
        select(EstimativaCusto).where(
            EstimativaCusto.id == est_id,
            EstimativaCusto.empreendimento_id == id,
            EstimativaCusto.tenant_id == current_user.tenant_id,
        )
    )
    est = result.scalar_one_or_none()
    if not est:
        raise HTTPException(status_code=404)
    await db.delete(est)
    await db.commit()
