import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import CurrentUser
from app.models.obra import Empreendimento, Etapa, Obra, StatusObra
from app.models.orcamento import CustoRealizado, ItemOrcamento, Orcamento
from app.models.unidade import StatusUnidade, Unidade
from app.models.lead import EtapaFunil, Lead

router = APIRouter(tags=["dashboard"])
DB = Annotated[AsyncSession, Depends(get_db)]


# ── Schemas ────────────────────────────────────────────────────────────────────

class ObraResumoDashboard(BaseModel):
    id: uuid.UUID
    nome: str
    status: str
    progresso_fisico: float
    empreendimento_nome: str
    cpi: float | None = None


class EmpreendimentoProgresso(BaseModel):
    nome: str
    progresso_medio: float
    total_obras: int


class ComercialResumo(BaseModel):
    total_unidades: int
    unidades_vendidas: int
    unidades_disponiveis: int
    unidades_reservadas: int
    vgv_estoque: float          # VGV de tabela de todas as unidades
    vgv_vendido: float          # soma das vendas (unidades vendidas)
    percentual_vendido: float   # % do VGV vendido sobre o de tabela
    leads_ativos: int           # leads fora de "contrato"/"perdido"
    pipeline_valor: float       # valor em negociação (leads abertos)


class DashboardStats(BaseModel):
    total_empreendimentos: int
    obras_ativas: int
    obras_concluidas: int
    obras_com_alerta: int
    vgv_total: float
    obras_recentes: list[ObraResumoDashboard]
    empreendimentos_progresso: list[EmpreendimentoProgresso]
    comercial: ComercialResumo


# ── Helpers de progresso (replicados aqui para evitar import circular) ─────────

def _prog_etapa(etapa: Etapa) -> float:
    # Usa atividades quando existirem; senão cai para percentual_realizado
    # (mesma regra de obras.py — mantém Dashboard e Detalhe consistentes).
    if etapa.atividades:
        total_prev = sum(float(a.quantidade_prevista) for a in etapa.atividades)
        if total_prev > 0:
            total_real = sum(float(a.quantidade_realizada) for a in etapa.atividades)
            return min(total_real / total_prev * 100, 100.0)
    return float(etapa.percentual_realizado or 0)


def _prog_obra(etapas: list) -> float:
    peso_total = sum(float(e.percentual_peso) for e in etapas)
    if peso_total == 0:
        return 0.0
    ponderado = sum(_prog_etapa(e) * float(e.percentual_peso) for e in etapas)
    return round(ponderado / peso_total, 1)


# ── Endpoint ───────────────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=DashboardStats)
async def resumo_dashboard(db: DB, current_user: CurrentUser):
    """Retorna métricas consolidadas para o Dashboard principal."""

    # 1. Empreendimentos ativos do tenant (exclui os que estão na Lixeira)
    emp_result = await db.execute(
        select(Empreendimento)
        .where(
            Empreendimento.tenant_id == current_user.tenant_id,
            Empreendimento.deleted_at.is_(None),
        )
        .order_by(Empreendimento.nome)
    )
    empreendimentos = emp_result.scalars().all()
    emp_ids = [e.id for e in empreendimentos]
    vgv_total = sum(float(e.vgv_previsto or 0) for e in empreendimentos)
    emp_map = {e.id: e.nome for e in empreendimentos}

    # ── Resumo comercial (espelho digital + funil de vendas) ───────────────────
    comercial = ComercialResumo(
        total_unidades=0, unidades_vendidas=0, unidades_disponiveis=0,
        unidades_reservadas=0, vgv_estoque=0.0, vgv_vendido=0.0,
        percentual_vendido=0.0, leads_ativos=0, pipeline_valor=0.0,
    )
    if emp_ids:
        unidades = (await db.execute(
            select(Unidade).where(
                Unidade.tenant_id == current_user.tenant_id,
                Unidade.empreendimento_id.in_(emp_ids),
            )
        )).scalars().all()
        for u in unidades:
            comercial.total_unidades += 1
            comercial.vgv_estoque += float(u.preco_tabela or 0)
            if u.status == StatusUnidade.vendido:
                comercial.unidades_vendidas += 1
                comercial.vgv_vendido += float(u.valor_venda or u.preco_tabela or 0)
            elif u.status == StatusUnidade.disponivel:
                comercial.unidades_disponiveis += 1
            elif u.status in (StatusUnidade.reservado, StatusUnidade.pre_reserva):
                comercial.unidades_reservadas += 1
        if comercial.vgv_estoque > 0:
            comercial.percentual_vendido = round(comercial.vgv_vendido / comercial.vgv_estoque * 100, 1)

        leads = (await db.execute(
            select(Lead).where(
                Lead.tenant_id == current_user.tenant_id,
                Lead.etapa.notin_([EtapaFunil.contrato, EtapaFunil.perdido]),
                # leads sem empreendimento OU de empreendimento ativo
                (Lead.empreendimento_id.is_(None)) | (Lead.empreendimento_id.in_(emp_ids)),
            )
        )).scalars().all()
        comercial.leads_ativos = len(leads)
        comercial.pipeline_valor = round(sum(float(l.valor or 0) for l in leads), 2)

    comercial.vgv_estoque = round(comercial.vgv_estoque, 2)
    comercial.vgv_vendido = round(comercial.vgv_vendido, 2)

    # Resposta vazia reutilizável
    def _empty_resp(obras_recentes=None, emp_prog=None) -> DashboardStats:
        return DashboardStats(
            total_empreendimentos=len(empreendimentos),
            obras_ativas=0, obras_concluidas=0, obras_com_alerta=0,
            vgv_total=round(vgv_total, 2),
            obras_recentes=obras_recentes or [],
            empreendimentos_progresso=emp_prog or [
                EmpreendimentoProgresso(
                    nome=(e.nome[:22] + "…") if len(e.nome) > 22 else e.nome,
                    progresso_medio=0.0, total_obras=0
                )
                for e in empreendimentos
            ],
            comercial=comercial,
        )

    if not emp_ids:
        return _empty_resp()

    # 2. Obras com etapas + atividades (eager load em uma query)
    obras_result = await db.execute(
        select(Obra)
        .options(selectinload(Obra.etapas).selectinload(Etapa.atividades))
        .where(Obra.empreendimento_id.in_(emp_ids))
        .order_by(Obra.criado_em.desc())
    )
    obras = obras_result.scalars().all()

    if not obras:
        return _empty_resp()

    obra_ids = [o.id for o in obras]

    # 3. BAC por obra (orçamento vigente) — query única
    bac_rows = await db.execute(
        select(Orcamento.obra_id, func.sum(ItemOrcamento.custo_total).label("bac"))
        .join(ItemOrcamento, ItemOrcamento.orcamento_id == Orcamento.id)
        .where(
            Orcamento.obra_id.in_(obra_ids),
            Orcamento.status == "vigente",
        )
        .group_by(Orcamento.obra_id)
    )
    bac_map: dict[uuid.UUID, float] = {r.obra_id: float(r.bac) for r in bac_rows}

    # 4. AC por obra (custos realizados) — query única
    ac_rows = await db.execute(
        select(CustoRealizado.obra_id, func.sum(CustoRealizado.valor).label("ac"))
        .where(CustoRealizado.obra_id.in_(obra_ids))
        .group_by(CustoRealizado.obra_id)
    )
    ac_map: dict[uuid.UUID, float] = {r.obra_id: float(r.ac) for r in ac_rows}

    # 5. Computar métricas
    obras_ativas = 0
    obras_concluidas = 0
    obras_com_alerta = 0
    obras_resumo: list[ObraResumoDashboard] = []
    emp_progs: dict[uuid.UUID, list[float]] = {}

    for obra in obras:
        prog = _prog_obra(obra.etapas)

        if obra.status == StatusObra.em_execucao:
            obras_ativas += 1
        elif obra.status == StatusObra.concluida:
            obras_concluidas += 1

        bac = bac_map.get(obra.id, 0.0)
        ac = ac_map.get(obra.id, 0.0)
        cpi: float | None = None
        if bac > 0 and ac > 0:
            ev = bac * (prog / 100.0)
            cpi = round(ev / ac, 4)
            if cpi < 0.9:
                obras_com_alerta += 1

        if len(obras_resumo) < 10:
            obras_resumo.append(ObraResumoDashboard(
                id=obra.id,
                nome=obra.nome,
                status=obra.status.value,
                progresso_fisico=prog,
                empreendimento_nome=emp_map.get(obra.empreendimento_id, ""),
                cpi=cpi,
            ))

        emp_progs.setdefault(obra.empreendimento_id, []).append(prog)

    # 6. Progresso médio por empreendimento (para o gráfico de barras)
    emp_progresso = []
    for e in empreendimentos:
        progs = emp_progs.get(e.id, [])
        avg = round(sum(progs) / len(progs), 1) if progs else 0.0
        nome_curto = (e.nome[:22] + "…") if len(e.nome) > 22 else e.nome
        emp_progresso.append(EmpreendimentoProgresso(
            nome=nome_curto,
            progresso_medio=avg,
            total_obras=len(progs),
        ))

    return DashboardStats(
        total_empreendimentos=len(empreendimentos),
        obras_ativas=obras_ativas,
        obras_concluidas=obras_concluidas,
        obras_com_alerta=obras_com_alerta,
        vgv_total=round(vgv_total, 2),
        obras_recentes=obras_resumo,
        empreendimentos_progresso=emp_progresso,
        comercial=comercial,
    )
