"""API Financeiro: Lançamentos · Resumo · Fluxo de Caixa"""
import uuid
from collections import defaultdict
from datetime import date as _date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import extract, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import CurrentUser
from app.models.financeiro import LancamentoFinanceiro, StatusLancamento, TipoLancamento
from app.models.suprimentos import OrdemCompra, Recebimento, RecebimentoItem, StatusOC, StatusRecebimento
from app.schemas.financeiro import (
    FluxoCaixaMes, LancamentoCreate, LancamentoResponse,
    LancamentoUpdate, ResumoFinanceiro,
)

router = APIRouter(tags=["financeiro"])
DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("/financeiro", response_model=list[LancamentoResponse])
async def listar_lancamentos(
    db: DB, user: CurrentUser,
    obra_id: uuid.UUID | None = Query(None),
    tipo: str | None = Query(None),
    status_: str | None = Query(None, alias="status"),
    ano: int | None = Query(None),
):
    stmt = select(LancamentoFinanceiro).where(
        LancamentoFinanceiro.tenant_id == user.tenant_id
    )
    if obra_id:
        stmt = stmt.where(LancamentoFinanceiro.obra_id == obra_id)
    if tipo:
        stmt = stmt.where(LancamentoFinanceiro.tipo == tipo)
    if status_:
        stmt = stmt.where(LancamentoFinanceiro.status == status_)
    if ano:
        stmt = stmt.where(extract("year", LancamentoFinanceiro.data_vencimento) == ano)
    stmt = stmt.order_by(LancamentoFinanceiro.data_vencimento.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/obras/{obra_id}/financeiro", response_model=list[LancamentoResponse])
async def listar_lancamentos_obra(obra_id: uuid.UUID, db: DB, user: CurrentUser):
    stmt = select(LancamentoFinanceiro).where(
        LancamentoFinanceiro.tenant_id == user.tenant_id,
        LancamentoFinanceiro.obra_id == obra_id,
    ).order_by(LancamentoFinanceiro.data_vencimento.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/financeiro", response_model=LancamentoResponse, status_code=status.HTTP_201_CREATED)
async def criar_lancamento(body: LancamentoCreate, db: DB, user: CurrentUser):
    lanc = LancamentoFinanceiro(**body.model_dump(), tenant_id=user.tenant_id)
    db.add(lanc)
    await db.commit()
    await db.refresh(lanc)
    return lanc


@router.patch("/financeiro/{lanc_id}", response_model=LancamentoResponse)
async def atualizar_lancamento(lanc_id: uuid.UUID, body: LancamentoUpdate, db: DB, user: CurrentUser):
    lanc = await db.get(LancamentoFinanceiro, lanc_id)
    if not lanc or lanc.tenant_id != user.tenant_id:
        raise HTTPException(404)

    status_anterior = lanc.status
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(lanc, k, v)

    # ── Quando pagamento confirmado → atualiza OC vinculada ───────────────────
    if body.status == StatusLancamento.pago and status_anterior != StatusLancamento.pago and lanc.oc_id:
        oc_stmt = (
            select(OrdemCompra)
            .options(selectinload(OrdemCompra.itens))
            .where(OrdemCompra.id == lanc.oc_id)
        )
        oc_res = await db.execute(oc_stmt)
        oc = oc_res.scalar_one_or_none()
        if oc and oc.tenant_id == user.tenant_id and oc.status not in (
            StatusOC.cancelada, StatusOC.arquivada, StatusOC.entregue, StatusOC.paga
        ):
            oc.status = StatusOC.paga

            # Auto-cria Recebimento pendente se ainda não existir
            existing_rec_stmt = select(Recebimento).where(
                Recebimento.oc_id == oc.id,
                Recebimento.tenant_id == user.tenant_id,
            )
            existing_res = await db.execute(existing_rec_stmt)
            if not existing_res.scalar_one_or_none():
                from sqlalchemy import func, select as sa_select
                count_stmt = sa_select(func.count()).select_from(Recebimento).where(
                    Recebimento.tenant_id == user.tenant_id
                )
                count = (await db.execute(count_stmt)).scalar_one()
                rec_numero = f"REC-{str(count + 1).zfill(4)}"
                novo_rec = Recebimento(
                    tenant_id=user.tenant_id,
                    numero=rec_numero,
                    obra_id=oc.obra_id,
                    oc_id=oc.id,
                    data_recebimento=_date.today(),
                    status=StatusRecebimento.pendente,
                )
                db.add(novo_rec)
                for oc_item in oc.itens:
                    qtd = float(oc_item.quantidade)
                    db.add(RecebimentoItem(
                        oc_item_id=oc_item.id,
                        descricao=oc_item.descricao,
                        unidade=oc_item.unidade,
                        quantidade_pedida=qtd,
                        quantidade_recebida=qtd,
                        quantidade_recusada=0,
                        recebimento=novo_rec,
                    ))

    await db.commit()
    await db.refresh(lanc)
    return lanc


@router.delete("/financeiro/{lanc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_lancamento(lanc_id: uuid.UUID, db: DB, user: CurrentUser):
    lanc = await db.get(LancamentoFinanceiro, lanc_id)
    if not lanc or lanc.tenant_id != user.tenant_id:
        raise HTTPException(404)
    await db.delete(lanc)
    await db.commit()


@router.get("/financeiro/resumo", response_model=ResumoFinanceiro)
async def resumo_financeiro(
    db: DB, user: CurrentUser,
    obra_id: uuid.UUID | None = Query(None),
    ano: int | None = Query(None),
):
    stmt = select(LancamentoFinanceiro).where(
        LancamentoFinanceiro.tenant_id == user.tenant_id
    )
    if obra_id:
        stmt = stmt.where(LancamentoFinanceiro.obra_id == obra_id)
    if ano:
        stmt = stmt.where(extract("year", LancamentoFinanceiro.data_vencimento) == ano)
    result = await db.execute(stmt)
    lancamentos = result.scalars().all()

    total_receitas = sum(
        float(l.valor) for l in lancamentos
        if l.tipo == TipoLancamento.receita and l.status != StatusLancamento.cancelado
    )
    total_despesas = sum(
        float(l.valor) for l in lancamentos
        if l.tipo == TipoLancamento.despesa and l.status != StatusLancamento.cancelado
    )
    a_vencer = sum(
        float(l.valor) for l in lancamentos
        if l.tipo == TipoLancamento.despesa and l.status == StatusLancamento.previsto
    )
    em_atraso = sum(
        float(l.valor) for l in lancamentos
        if l.tipo == TipoLancamento.despesa and l.status == StatusLancamento.atrasado
    )

    return ResumoFinanceiro(
        total_receitas=round(total_receitas, 2),
        total_despesas=round(total_despesas, 2),
        saldo=round(total_receitas - total_despesas, 2),
        a_vencer=round(a_vencer, 2),
        em_atraso=round(em_atraso, 2),
    )


@router.get("/financeiro/fluxo-caixa", response_model=list[FluxoCaixaMes])
async def fluxo_caixa(
    db: DB, user: CurrentUser,
    obra_id: uuid.UUID | None = Query(None),
    ano: int | None = Query(None),
):
    stmt = select(LancamentoFinanceiro).where(
        LancamentoFinanceiro.tenant_id == user.tenant_id,
        LancamentoFinanceiro.status != StatusLancamento.cancelado,
    )
    if obra_id:
        stmt = stmt.where(LancamentoFinanceiro.obra_id == obra_id)
    if ano:
        stmt = stmt.where(extract("year", LancamentoFinanceiro.data_vencimento) == ano)

    result = await db.execute(stmt)
    lancamentos = result.scalars().all()

    meses: dict[str, dict] = defaultdict(lambda: {"receitas": 0.0, "despesas": 0.0})
    for l in lancamentos:
        mes = str(l.data_vencimento)[:7]  # "YYYY-MM"
        if l.tipo == TipoLancamento.receita:
            meses[mes]["receitas"] += float(l.valor)
        else:
            meses[mes]["despesas"] += float(l.valor)

    return [
        FluxoCaixaMes(
            mes=mes,
            receitas=round(v["receitas"], 2),
            despesas=round(v["despesas"], 2),
            saldo=round(v["receitas"] - v["despesas"], 2),
        )
        for mes, v in sorted(meses.items())
    ]
