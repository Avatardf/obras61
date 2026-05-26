import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import CurrentUser
from app.models.obra import Atividade, Empreendimento, Etapa, Obra, StatusEtapa
from app.schemas.obra import (
    AtividadeCreate, AtividadeResponse, AtividadeUpdate,
    EtapaCreate, EtapaResponse, EtapaUpdate,
    ETAPAS_PADRAO, ObraCreate, ObraDetalhe, ObraResponse, ObraUpdate,
)
from app.services.evm import calcular_evm
from app.services.gemini import gerar_analise_empreendimento

router = APIRouter(tags=["obras"])
DB = Annotated[AsyncSession, Depends(get_db)]


def _progresso_etapa(etapa: Etapa) -> float:
    """Calcula % de progresso: usa atividades se existirem, senão percentual_realizado."""
    if etapa.atividades:
        total_prev = sum(float(a.quantidade_prevista) for a in etapa.atividades)
        if total_prev > 0:
            total_real = sum(float(a.quantidade_realizada) for a in etapa.atividades)
            return min(round(total_real / total_prev * 100, 1), 100.0)
    return float(etapa.percentual_realizado or 0)


def _progresso_obra(etapas: list[Etapa]) -> float:
    """Calcula % ponderado da obra pelas etapas."""
    peso_total = sum(float(e.percentual_peso) for e in etapas)
    if peso_total == 0:
        return 0.0
    ponderado = sum(
        _progresso_etapa(e) * float(e.percentual_peso) for e in etapas
    )
    return round(ponderado / peso_total, 1)


def _etapa_to_response(etapa: Etapa) -> EtapaResponse:
    ativs = [
        AtividadeResponse(
            id=a.id, etapa_id=a.etapa_id, nome=a.nome,
            unidade=a.unidade,
            quantidade_prevista=float(a.quantidade_prevista),
            quantidade_realizada=float(a.quantidade_realizada),
            predecessoras=a.predecessoras or [],
            percentual=min(
                round(float(a.quantidade_realizada) / float(a.quantidade_prevista) * 100, 1)
                if a.quantidade_prevista and float(a.quantidade_prevista) > 0 else 0.0,
                100.0
            ),
        )
        for a in sorted(etapa.atividades, key=lambda a: a.nome)
    ]
    return EtapaResponse(
        id=etapa.id, obra_id=etapa.obra_id,
        nome=etapa.nome, ordem=etapa.ordem,
        percentual_peso=float(etapa.percentual_peso),
        status=etapa.status.value,
        progresso=_progresso_etapa(etapa),
        mes_inicio=etapa.mes_inicio,
        duracao_meses=etapa.duracao_meses,
        percentual_planejado=float(etapa.percentual_planejado or 0),
        percentual_realizado=float(etapa.percentual_realizado or 0),
        atividades=ativs,
    )


# ── OBRAS ─────────────────────────────────────────────────────────────────────

@router.get("/empreendimentos/{emp_id}/obras", response_model=list[ObraResponse])
async def listar_obras(emp_id: uuid.UUID, db: DB, current_user: CurrentUser):
    """Lista obras de um empreendimento."""
    result = await db.execute(
        select(Empreendimento).where(
            Empreendimento.id == emp_id,
            Empreendimento.tenant_id == current_user.tenant_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Empreendimento não encontrado")

    result = await db.execute(
        select(Obra)
        .options(selectinload(Obra.etapas).selectinload(Etapa.atividades))
        .where(Obra.empreendimento_id == emp_id)
        .order_by(Obra.criado_em)
    )
    obras = result.scalars().all()
    _OBRA_FIELDS = ["id","empreendimento_id","nome","area_construida_m2",
                    "numero_pavimentos","numero_unidades","status",
                    "data_inicio","data_prevista_termino","criado_em","atualizado_em"]
    return [
        ObraResponse(
            **{c: getattr(o, c) for c in _OBRA_FIELDS},
            progresso_fisico=_progresso_obra(o.etapas),
        )
        for o in obras
    ]


@router.post("/empreendimentos/{emp_id}/obras",
             response_model=ObraDetalhe, status_code=status.HTTP_201_CREATED)
async def criar_obra(emp_id: uuid.UUID, body: ObraCreate, db: DB, current_user: CurrentUser):
    """Cria obra vinculada a um empreendimento, opcionalmente com etapas padrão."""
    result = await db.execute(
        select(Empreendimento).where(
            Empreendimento.id == emp_id,
            Empreendimento.tenant_id == current_user.tenant_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Empreendimento não encontrado")

    obra = Obra(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        empreendimento_id=emp_id,
        nome=body.nome,
        area_construida_m2=body.area_construida_m2,
        numero_pavimentos=body.numero_pavimentos,
        numero_unidades=body.numero_unidades,
        status=body.status,
        data_inicio=body.data_inicio,
        data_prevista_termino=body.data_prevista_termino,
    )
    db.add(obra)
    await db.flush()

    if body.usar_etapas_padrao:
        for nome, ordem, peso, mes_ini, dur in ETAPAS_PADRAO:
            db.add(Etapa(
                id=uuid.uuid4(), obra_id=obra.id,
                nome=nome, ordem=ordem, percentual_peso=peso,
                mes_inicio=mes_ini, duracao_meses=dur,
            ))

    await db.commit()

    result = await db.execute(
        select(Obra)
        .options(selectinload(Obra.etapas).selectinload(Etapa.atividades))
        .where(Obra.id == obra.id)
    )
    obra = result.scalar_one()
    _F = ["id","empreendimento_id","nome","area_construida_m2","numero_pavimentos",
          "numero_unidades","status","data_inicio","data_prevista_termino","criado_em","atualizado_em"]
    return ObraDetalhe(
        **{c: getattr(obra, c) for c in _F},
        progresso_fisico=_progresso_obra(obra.etapas),
        etapas=[_etapa_to_response(e) for e in sorted(obra.etapas, key=lambda e: e.ordem)],
    )


@router.get("/obras/{obra_id}", response_model=ObraDetalhe)
async def buscar_obra(obra_id: uuid.UUID, db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(Obra)
        .options(selectinload(Obra.etapas).selectinload(Etapa.atividades))
        .where(Obra.id == obra_id, Obra.tenant_id == current_user.tenant_id)
    )
    obra = result.scalar_one_or_none()
    if not obra:
        raise HTTPException(status_code=404, detail="Obra não encontrada")

    metricas = await calcular_evm(db, obra_id)

    _F = ["id","empreendimento_id","nome","area_construida_m2","numero_pavimentos",
          "numero_unidades","status","data_inicio","data_prevista_termino","criado_em","atualizado_em"]
    return ObraDetalhe(
        **{c: getattr(obra, c) for c in _F},
        progresso_fisico=_progresso_obra(obra.etapas),
        etapas=[_etapa_to_response(e) for e in sorted(obra.etapas, key=lambda e: e.ordem)],
        evm=metricas.__dict__,
    )


@router.patch("/obras/{obra_id}", response_model=ObraResponse)
async def atualizar_obra(obra_id: uuid.UUID, body: ObraUpdate, db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(Obra).where(Obra.id == obra_id, Obra.tenant_id == current_user.tenant_id)
    )
    obra = result.scalar_one_or_none()
    if not obra:
        raise HTTPException(status_code=404, detail="Obra não encontrada")
    for campo, valor in body.model_dump(exclude_unset=True).items():
        setattr(obra, campo, valor)
    await db.commit()
    await db.refresh(obra)
    return ObraResponse.model_validate(obra)


@router.delete("/obras/{obra_id}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_obra(obra_id: uuid.UUID, db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(Obra).where(Obra.id == obra_id, Obra.tenant_id == current_user.tenant_id)
    )
    obra = result.scalar_one_or_none()
    if not obra:
        raise HTTPException(status_code=404, detail="Obra não encontrada")
    await db.delete(obra)
    await db.commit()


# ── ETAPAS ────────────────────────────────────────────────────────────────────

@router.patch("/etapas/{etapa_id}", response_model=EtapaResponse)
async def atualizar_etapa(etapa_id: uuid.UUID, body: EtapaUpdate, db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(Etapa)
        .options(selectinload(Etapa.atividades))
        .join(Obra, Obra.id == Etapa.obra_id)
        .where(Etapa.id == etapa_id, Obra.tenant_id == current_user.tenant_id)
    )
    etapa = result.scalar_one_or_none()
    if not etapa:
        raise HTTPException(status_code=404, detail="Etapa não encontrada")
    for campo, valor in body.model_dump(exclude_unset=True).items():
        setattr(etapa, campo, valor)
    await db.commit()
    await db.refresh(etapa)
    return _etapa_to_response(etapa)


# ── ATIVIDADES ────────────────────────────────────────────────────────────────

@router.post("/etapas/{etapa_id}/atividades",
             response_model=AtividadeResponse, status_code=status.HTTP_201_CREATED)
async def criar_atividade(etapa_id: uuid.UUID, body: AtividadeCreate, db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(Etapa)
        .join(Obra, Obra.id == Etapa.obra_id)
        .where(Etapa.id == etapa_id, Obra.tenant_id == current_user.tenant_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Etapa não encontrada")

    ativ = Atividade(
        id=uuid.uuid4(), etapa_id=etapa_id,
        nome=body.nome, unidade=body.unidade,
        quantidade_prevista=body.quantidade_prevista,
        quantidade_realizada=0,
        predecessoras=body.predecessoras,
    )
    db.add(ativ)
    await db.commit()
    await db.refresh(ativ)
    return AtividadeResponse(
        id=ativ.id, etapa_id=ativ.etapa_id, nome=ativ.nome,
        unidade=ativ.unidade,
        quantidade_prevista=float(ativ.quantidade_prevista),
        quantidade_realizada=float(ativ.quantidade_realizada),
        predecessoras=ativ.predecessoras or [], percentual=0.0,
    )


@router.patch("/atividades/{ativ_id}", response_model=AtividadeResponse)
async def atualizar_atividade(ativ_id: uuid.UUID, body: AtividadeUpdate, db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(Atividade)
        .join(Etapa, Etapa.id == Atividade.etapa_id)
        .join(Obra, Obra.id == Etapa.obra_id)
        .where(Atividade.id == ativ_id, Obra.tenant_id == current_user.tenant_id)
    )
    ativ = result.scalar_one_or_none()
    if not ativ:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")
    for campo, valor in body.model_dump(exclude_unset=True).items():
        setattr(ativ, campo, valor)
    await db.commit()
    await db.refresh(ativ)
    perc = (
        min(float(ativ.quantidade_realizada) / float(ativ.quantidade_prevista) * 100, 100.0)
        if ativ.quantidade_prevista and float(ativ.quantidade_prevista) > 0 else 0.0
    )
    return AtividadeResponse(
        id=ativ.id, etapa_id=ativ.etapa_id, nome=ativ.nome,
        unidade=ativ.unidade,
        quantidade_prevista=float(ativ.quantidade_prevista),
        quantidade_realizada=float(ativ.quantidade_realizada),
        predecessoras=ativ.predecessoras or [], percentual=perc,
    )


# ── ANÁLISE IA ────────────────────────────────────────────────────────────────

@router.get("/obras/{obra_id}/analise-ia")
async def analise_ia(obra_id: uuid.UUID, db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(Obra).where(Obra.id == obra_id, Obra.tenant_id == current_user.tenant_id)
    )
    obra = result.scalar_one_or_none()
    if not obra:
        raise HTTPException(status_code=404, detail="Obra não encontrada")
    metricas = await calcular_evm(db, obra_id)
    dados = {
        "obra": obra.nome, "status": obra.status,
        "cpi": metricas.cpi, "spi": metricas.spi,
        "bac": metricas.bac, "eac": metricas.eac, "vac": metricas.vac,
        "interpretacao": metricas.interpretacao,
    }
    analise = await gerar_analise_empreendimento(dados)
    return {"metricas": metricas.__dict__, "analise_ia": analise}
