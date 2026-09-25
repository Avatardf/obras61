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
from app.dependencies import CurrentUser, NaoCorretor, is_corretor
from app.models.lead import EtapaFunil, Lead
from app.models.obra import Empreendimento
from app.models.tenant import Papel, User
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
    responsavel_id: uuid.UUID | None = None
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
    responsavel_id: uuid.UUID | None = None
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
    responsavel_id: uuid.UUID | None = None
    origem: str | None = None
    observacoes: str | None = None
    motivo_perda: str | None = None


class ResponsavelOpcao(BaseModel):
    id: uuid.UUID
    nome: str
    papel: str


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
    # Busca explícita (db.get) — evita lazy-load de relationship em contexto async
    if lead.empreendimento_id:
        emp = await db.get(Empreendimento, lead.empreendimento_id)
        resp.empreendimento_nome = emp.nome if emp else None
    if lead.unidade_id:
        un = await db.get(Unidade, lead.unidade_id)
        resp.unidade_label = f"{un.grupo} · {un.identificador}" if un else None
    return resp


def _escopo(stmt, user: User):
    """Corretor só enxerga os próprios leads; admin e demais papéis veem todos."""
    if is_corretor(user):
        return stmt.where(Lead.responsavel_id == user.id)
    return stmt


async def _carregar(db: AsyncSession, lid: uuid.UUID, user: User) -> Lead:
    lead = await db.get(Lead, lid)
    if (not lead or lead.tenant_id != user.tenant_id
            or (is_corretor(user) and lead.responsavel_id != user.id)):
        # 404 também para lead de outro corretor: não revela que ele existe
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead não encontrado")
    return lead


async def _definir_responsavel(db: AsyncSession, lead: Lead, responsavel_id: uuid.UUID, user: User) -> None:
    alvo = await db.get(User, responsavel_id)
    if not alvo or alvo.tenant_id != user.tenant_id or not alvo.ativo:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Responsável inválido")
    lead.responsavel_id = alvo.id
    lead.responsavel = alvo.nome


async def _validar_unidade(db: AsyncSession, unidade_id: uuid.UUID | None, user: User) -> None:
    """Corretor só vincula unidade disponível ou que ele mesmo está negociando."""
    if not unidade_id or not is_corretor(user):
        return
    un = await db.get(Unidade, unidade_id)
    if not un or un.tenant_id != user.tenant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unidade não encontrada")
    if un.corretor_id == user.id or (un.corretor_id is None and un.status == StatusUnidade.disponivel):
        return
    raise HTTPException(
        status.HTTP_409_CONFLICT,
        f"A unidade {un.grupo} · {un.identificador} está em negociação com outro corretor.",
    )


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/funil", response_model=FunilResponse)
async def quadro_funil(
    empreendimento_id: uuid.UUID | None = None,
    responsavel_id: uuid.UUID | None = None,
    db: AsyncSession = DB, user: CurrentUser = None,
):
    """Retorna os leads agrupados por etapa para montar o Kanban."""
    stmt = select(Lead).where(Lead.tenant_id == user.tenant_id, Lead.etapa != EtapaFunil.perdido)
    stmt = _escopo(stmt, user)
    if responsavel_id and not is_corretor(user):
        stmt = stmt.where(Lead.responsavel_id == responsavel_id)
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
    stmt = _escopo(select(Lead).where(Lead.tenant_id == user.tenant_id), user)
    if etapa:
        stmt = stmt.where(Lead.etapa == etapa)
    leads = (await db.execute(stmt.order_by(Lead.criado_em.desc()))).scalars().all()
    return [await _montar_response(db, l) for l in leads]


@router.post("", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
async def criar_lead(body: LeadCreate, db: AsyncSession = DB, user: CurrentUser = None):
    lead = Lead(
        id=uuid.uuid4(), tenant_id=user.tenant_id,
        data_entrada_etapa=date.today(), **body.model_dump(exclude={"responsavel_id"}),
    )
    dono = user.id if is_corretor(user) else (body.responsavel_id or user.id)
    await _definir_responsavel(db, lead, dono, user)
    await _validar_unidade(db, lead.unidade_id, user)
    db.add(lead)
    await db.commit()
    await db.refresh(lead)
    return await _montar_response(db, lead)


@router.patch("/{lid}", response_model=LeadResponse)
async def atualizar_lead(lid: uuid.UUID, body: LeadUpdate, db: AsyncSession = DB, user: CurrentUser = None):
    lead = await _carregar(db, lid, user)
    etapa_anterior = lead.etapa
    dados = body.model_dump(exclude_unset=True)
    dados.pop("responsavel", None)   # o nome vem sempre do usuário responsável

    if "responsavel_id" in dados:
        novo_dono = dados.pop("responsavel_id")
        if is_corretor(user):
            if novo_dono != user.id:
                raise HTTPException(status.HTTP_403_FORBIDDEN, "Só um administrador pode transferir leads.")
        elif novo_dono:
            await _definir_responsavel(db, lead, novo_dono, user)
        else:
            lead.responsavel_id = None
            lead.responsavel = None

    if "unidade_id" in dados and dados["unidade_id"] != lead.unidade_id:
        await _validar_unidade(db, dados["unidade_id"], user)

    # Mudança de etapa zera o contador de dias
    nova_etapa = dados.get("etapa")
    mudou_etapa = nova_etapa is not None and nova_etapa != etapa_anterior
    if mudou_etapa:
        lead.data_entrada_etapa = date.today()

    for campo, valor in dados.items():
        setattr(lead, campo, valor)

    # ── Sincronização com o espelho digital ───────────────────────────────────
    if mudou_etapa and lead.unidade_id:
        unidade = await db.get(Unidade, lead.unidade_id)
        if unidade and unidade.tenant_id == user.tenant_id:
            # Entrando em "contrato" → vende a unidade (com trava de venda dupla)
            if nova_etapa == EtapaFunil.contrato:
                if unidade.status == StatusUnidade.vendido and unidade.cliente_nome != lead.nome_cliente:
                    raise HTTPException(
                        status.HTTP_409_CONFLICT,
                        f"A unidade {unidade.grupo} · {unidade.identificador} já está vendida para outro cliente.",
                    )
                if (is_corretor(user) and unidade.corretor_id is not None
                        and unidade.corretor_id != user.id):
                    raise HTTPException(
                        status.HTTP_409_CONFLICT,
                        f"A unidade {unidade.grupo} · {unidade.identificador} está em negociação com outro corretor.",
                    )
                unidade.corretor_id = lead.responsavel_id or unidade.corretor_id
                unidade.status = StatusUnidade.vendido
                unidade.cliente_nome = lead.nome_cliente
                unidade.valor_venda = lead.valor or unidade.preco_tabela
                unidade.data_venda = date.today()
            # Saindo de "contrato" (distrato/recuo) → devolve a unidade ao estoque
            elif etapa_anterior == EtapaFunil.contrato and unidade.cliente_nome == lead.nome_cliente:
                unidade.status = (StatusUnidade.indisponivel if nova_etapa == EtapaFunil.perdido
                                  else StatusUnidade.reservado)
                if unidade.status == StatusUnidade.indisponivel:
                    unidade.corretor_id = None
                unidade.cliente_nome = None
                unidade.valor_venda = None
                unidade.data_venda = None
                unidade.subsidio = None
                unidade.fgts = None
                unidade.recurso_proprio = None
                unidade.valor_financiado = None

    await db.commit()
    await db.refresh(lead)
    return await _montar_response(db, lead)


@router.delete("/{lid}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_lead(lid: uuid.UUID, db: AsyncSession = DB, user: CurrentUser = None):
    lead = await _carregar(db, lid, user)
    await db.delete(lead)
    await db.commit()


@router.get("/responsaveis", response_model=list[ResponsavelOpcao])
async def listar_responsaveis(db: AsyncSession = DB, user: NaoCorretor = None):
    """Usuários que podem ser donos de leads (corretores e administradores)."""
    stmt = (
        select(User)
        .where(User.tenant_id == user.tenant_id, User.ativo == True)  # noqa: E712
        .order_by(User.nome)
    )
    usuarios = (await db.execute(stmt)).scalars().all()
    # Filtro em Python: poucos usuários por construtora e evita comparar o enum nativo no SQL
    return [ResponsavelOpcao(id=u.id, nome=u.nome, papel=u.papel)
            for u in usuarios if u.papel in (Papel.corretor, Papel.admin)]
