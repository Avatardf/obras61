"""
API do Funil de Vendas (CRM) — leads/oportunidades em etapas.
"""
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser
from app.models.lead import EtapaFunil, Lead
from app.models.unidade import StatusUnidade, Unidade

router = APIRouter(prefix="/leads", tags=["funil de vendas"])
DB = Depends(get_db)

# Etapas exibidas no quadro (ordem), exceto "perdido"
ETAPAS_QUADRO = [
    EtapaFunil.pre_atendimento, EtapaFunil.visita, EtapaFunil.atendimento,
    EtapaFunil.pasta_digital, EtapaFunil.proposta, EtapaFunil.contrato,
]


# ── Schemas ────────────────────────────────────────────────────────────────────

class LeadResponse(BaseModel):
    id: uuid.UUID
    nome_cliente: str
    telefone: str | None
    email: str | None
    empreendimento_id: uuid.UUID | None
    empreendimento_nome: str | None = None
    unidade_id: uuid.UUID | None
    unidade_label: str | None = None
    etapa: str
    valor: float | None
    responsavel: str | None
    origem: str | None
    observacoes: str | None
    data_entrada_etapa: date
    dias_na_etapa: int = 0
    motivo_perda: str | None

    model_config = {"from_attributes": True}


class LeadCreate(BaseModel):
    nome_cliente: str = Field(min_length=2, max_length=200)
    telefone: str | None = None
    email: str | None = None
    empreendimento_id: uuid.UUID | None = None
    unidade_id: uuid.UUID | None = None
    etapa: EtapaFunil = EtapaFunil.pre_atendimento
    valor: float | None = None
    responsavel: str | None = None
    origem: str | None = None
    observacoes: str | None = None


class LeadUpdate(BaseModel):
    nome_cliente: str | None = None
    telefone: str | None = None
    email: str | None = None
    empreendimento_id: uuid.UUID | None = None
    unidade_id: uuid.UUID | None = None
    etapa: EtapaFunil | None = None
    valor: float | None = None
    responsavel: str | None = None
    origem: str | None = None
    observacoes: str | None = None
    motivo_perda: str | None = None


class ColunaFunil(BaseModel):
    etapa: str
    total: int
    valor: float
    leads: list[LeadResponse]


class FunilResponse(BaseModel):
    colunas: list[ColunaFunil]
    total_leads: int
    valor_pipeline: float       # soma de valores nas etapas abertas (exceto contrato/perdido)
    valor_ganho: float          # soma de valores em contrato


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _montar_response(db: AsyncSession, lead: Lead) -> LeadResponse:
    resp = LeadResponse.model_validate(lead)
    resp.dias_na_etapa = (date.today() - lead.data_entrada_etapa).days
    if lead.empreendimento_id and lead.empreendimento:
        resp.empreendimento_nome = lead.empreendimento.nome
    if lead.unidade_id and lead.unidade:
        resp.unidade_label = f"{lead.unidade.grupo} · {lead.unidade.identificador}"
    return resp


async def _carregar(db: AsyncSession, lid: uuid.UUID, tenant_id) -> Lead:
    lead = await db.get(Lead, lid)
    if not lead or lead.tenant_id != tenant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead não encontrado")
    return lead


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/funil", response_model=FunilResponse)
async def quadro_funil(
    empreendimento_id: uuid.UUID | None = None,
    db: AsyncSession = DB, user: CurrentUser = None,
):
    """Retorna os leads agrupados por etapa para montar o Kanban."""
    stmt = select(Lead).where(Lead.tenant_id == user.tenant_id, Lead.etapa != EtapaFunil.perdido)
    if empreendimento_id:
        stmt = stmt.where(Lead.empreendimento_id == empreendimento_id)
    stmt = stmt.order_by(Lead.data_entrada_etapa)
    leads = (await db.execute(stmt)).scalars().all()

    por_etapa: dict[str, list[LeadResponse]] = {e.value: [] for e in ETAPAS_QUADRO}
    for lead in leads:
        if lead.etapa in por_etapa:
            por_etapa[lead.etapa].append(await _montar_response(db, lead))

    colunas = []
    valor_pipeline = 0.0
    valor_ganho = 0.0
    for etapa in ETAPAS_QUADRO:
        items = por_etapa[etapa.value]
        soma = sum(float(l.valor or 0) for l in items)
        colunas.append(ColunaFunil(etapa=etapa.value, total=len(items), valor=round(soma, 2), leads=items))
        if etapa == EtapaFunil.contrato:
            valor_ganho += soma
        else:
            valor_pipeline += soma

    return FunilResponse(
        colunas=colunas, total_leads=len(leads),
        valor_pipeline=round(valor_pipeline, 2), valor_ganho=round(valor_ganho, 2),
    )


@router.get("", response_model=list[LeadResponse])
async def listar_leads(
    etapa: EtapaFunil | None = None,
    db: AsyncSession = DB, user: CurrentUser = None,
):
    stmt = select(Lead).where(Lead.tenant_id == user.tenant_id)
    if etapa:
        stmt = stmt.where(Lead.etapa == etapa)
    leads = (await db.execute(stmt.order_by(Lead.criado_em.desc()))).scalars().all()
    return [await _montar_response(db, l) for l in leads]


@router.post("", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
async def criar_lead(body: LeadCreate, db: AsyncSession = DB, user: CurrentUser = None):
    lead = Lead(
        id=uuid.uuid4(), tenant_id=user.tenant_id,
        data_entrada_etapa=date.today(), **body.model_dump(),
    )
    db.add(lead)
    await db.commit()
    await db.refresh(lead)
    return await _montar_response(db, lead)


@router.patch("/{lid}", response_model=LeadResponse)
async def atualizar_lead(lid: uuid.UUID, body: LeadUpdate, db: AsyncSession = DB, user: CurrentUser = None):
    lead = await _carregar(db, lid, user.tenant_id)
    dados = body.model_dump(exclude_unset=True)

    # Mudança de etapa zera o contador de dias
    nova_etapa = dados.get("etapa")
    if nova_etapa and nova_etapa != lead.etapa:
        lead.data_entrada_etapa = date.today()

    for campo, valor in dados.items():
        setattr(lead, campo, valor)

    # Ao fechar (contrato) com unidade vinculada → marca unidade como vendida
    if nova_etapa == EtapaFunil.contrato and lead.unidade_id:
        unidade = await db.get(Unidade, lead.unidade_id)
        if unidade and unidade.tenant_id == user.tenant_id:
            unidade.status = StatusUnidade.vendido
            unidade.cliente_nome = lead.nome_cliente
            unidade.valor_venda = lead.valor or unidade.preco_tabela
            unidade.data_venda = date.today()

    await db.commit()
    await db.refresh(lead)
    return await _montar_response(db, lead)


@router.delete("/{lid}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_lead(lid: uuid.UUID, db: AsyncSession = DB, user: CurrentUser = None):
    lead = await _carregar(db, lid, user.tenant_id)
    await db.delete(lead)
    await db.commit()
