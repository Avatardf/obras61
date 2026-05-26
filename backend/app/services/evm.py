from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.obra import Atividade, Etapa
from app.models.orcamento import CustoRealizado, ItemOrcamento, Orcamento


@dataclass
class MetricasEVM:
    obra_id: UUID
    pv: float   # Planned Value — valor do trabalho planejado até hoje
    ev: float   # Earned Value — valor do trabalho efetivamente concluído
    ac: float   # Actual Cost — custo real gasto até hoje
    cpi: float  # Cost Performance Index = EV / AC
    spi: float  # Schedule Performance Index = EV / PV
    eac: float  # Estimate at Completion = BAC / CPI
    bac: float  # Budget at Completion — orçamento total
    vac: float  # Variance at Completion = BAC - EAC
    interpretacao: str


async def calcular_evm(db: AsyncSession, obra_id: UUID) -> MetricasEVM:
    """Calcula métricas EVM para uma obra a partir dos dados do sistema."""

    # BAC: orçamento total vigente
    result = await db.execute(
        select(func.sum(ItemOrcamento.custo_total))
        .join(Orcamento)
        .where(Orcamento.obra_id == obra_id, Orcamento.status == "vigente")
    )
    bac = float(result.scalar() or 0)

    # AC: custos realizados acumulados
    result = await db.execute(
        select(func.sum(CustoRealizado.valor)).where(CustoRealizado.obra_id == obra_id)
    )
    ac = float(result.scalar() or 0)

    # EV: valor ganho = BAC × % físico concluído
    result = await db.execute(
        select(Etapa.percentual_peso, Atividade.quantidade_prevista, Atividade.quantidade_realizada)
        .join(Atividade, Atividade.etapa_id == Etapa.id)
        .where(Etapa.obra_id == obra_id)
    )
    rows = result.all()

    progresso_ponderado = 0.0
    peso_total = 0.0
    for peso, previsto, realizado in rows:
        if previsto and previsto > 0:
            progresso_item = min(realizado / previsto, 1.0)
            progresso_ponderado += progresso_item * float(peso)
            peso_total += float(peso)

    percentual_fisico = (progresso_ponderado / peso_total) if peso_total > 0 else 0
    ev = bac * percentual_fisico

    # PV: valor planejado (simplificado — assume progresso linear por enquanto)
    pv = ev  # TODO: calcular com cronograma baseline

    cpi = ev / ac if ac > 0 else 1.0
    spi = ev / pv if pv > 0 else 1.0
    eac = bac / cpi if cpi > 0 else bac
    vac = bac - eac

    interpretacao = _interpretar_evm(cpi, spi)

    return MetricasEVM(
        obra_id=obra_id, pv=pv, ev=ev, ac=ac,
        cpi=round(cpi, 4), spi=round(spi, 4),
        eac=round(eac, 2), bac=round(bac, 2), vac=round(vac, 2),
        interpretacao=interpretacao,
    )


def _interpretar_evm(cpi: float, spi: float) -> str:
    status_custo = "dentro do orçamento" if cpi >= 1 else f"acima do orçamento ({(1-cpi)*100:.1f}% de estouro)"
    status_prazo = "dentro do prazo" if spi >= 1 else f"atrasada ({(1-spi)*100:.1f}% de atraso)"
    return f"Obra {status_custo} e {status_prazo}. CPI={cpi:.2f}, SPI={spi:.2f}."
