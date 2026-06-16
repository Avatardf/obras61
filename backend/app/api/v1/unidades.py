"""
API do módulo de Unidades — espelho digital de venda.
"""
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser
from app.models.obra import Empreendimento
from app.models.unidade import StatusUnidade, Unidade

router = APIRouter(tags=["unidades"])
DB = Depends(get_db)


# ── Schemas ────────────────────────────────────────────────────────────────────

class UnidadeResponse(BaseModel):
    id: uuid.UUID
    empreendimento_id: uuid.UUID
    grupo: str
    identificador: str
    tipo: str | None
    pavimento: int | None
    area_privativa_m2: float | None
    area_total_m2: float | None
    fracao_ideal: float | None
    preco_tabela: float | None
    status: str
    cliente_nome: str | None
    valor_venda: float | None
    data_venda: date | None
    observacao: str | None

    model_config = {"from_attributes": True}


class UnidadeCreate(BaseModel):
    grupo: str = Field(min_length=1, max_length=60)
    identificador: str = Field(min_length=1, max_length=40)
    tipo: str | None = None
    pavimento: int | None = None
    area_privativa_m2: float | None = None
    area_total_m2: float | None = None
    fracao_ideal: float | None = None
    preco_tabela: float | None = None
    status: StatusUnidade = StatusUnidade.disponivel


class UnidadeUpdate(BaseModel):
    grupo: str | None = None
    identificador: str | None = None
    tipo: str | None = None
    pavimento: int | None = None
    area_privativa_m2: float | None = None
    area_total_m2: float | None = None
    fracao_ideal: float | None = None
    preco_tabela: float | None = None
    status: StatusUnidade | None = None
    cliente_nome: str | None = None
    valor_venda: float | None = None
    data_venda: date | None = None
    observacao: str | None = None


class GerarUnidades(BaseModel):
    grupo: str = Field(min_length=1, max_length=60)
    tipo: str | None = None
    quantidade: int = Field(ge=1, le=500)
    inicio: int = Field(default=1, ge=0)        # número inicial (ex: 101)
    prefixo: str = ""                           # ex: "Apto " → "Apto 101"
    area_privativa_m2: float | None = None
    preco_tabela: float | None = None


class ResumoEspelho(BaseModel):
    total: int
    por_status: dict[str, int]
    vgv_tabela: float        # soma dos preços de tabela
    vgv_vendido: float       # soma dos valores de venda das unidades vendidas


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _empreendimento(db: AsyncSession, emp_id: uuid.UUID, tenant_id) -> Empreendimento:
    emp = await db.get(Empreendimento, emp_id)
    if not emp or emp.tenant_id != tenant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Empreendimento não encontrado")
    return emp


async def _unidade(db: AsyncSession, uid: uuid.UUID, tenant_id) -> Unidade:
    u = await db.get(Unidade, uid)
    if not u or u.tenant_id != tenant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unidade não encontrada")
    return u


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/empreendimentos/{emp_id}/unidades", response_model=list[UnidadeResponse])
async def listar_unidades(emp_id: uuid.UUID, db: AsyncSession = DB, user: CurrentUser = None):
    await _empreendimento(db, emp_id, user.tenant_id)
    stmt = (
        select(Unidade)
        .where(Unidade.empreendimento_id == emp_id, Unidade.tenant_id == user.tenant_id)
        .order_by(Unidade.grupo, Unidade.identificador)
    )
    return (await db.execute(stmt)).scalars().all()


@router.get("/empreendimentos/{emp_id}/unidades/resumo", response_model=ResumoEspelho)
async def resumo_espelho(emp_id: uuid.UUID, db: AsyncSession = DB, user: CurrentUser = None):
    await _empreendimento(db, emp_id, user.tenant_id)
    base = (
        select(Unidade)
        .where(Unidade.empreendimento_id == emp_id, Unidade.tenant_id == user.tenant_id)
    )
    unidades = (await db.execute(base)).scalars().all()
    por_status: dict[str, int] = {s.value: 0 for s in StatusUnidade}
    vgv_tabela = 0.0
    vgv_vendido = 0.0
    for u in unidades:
        por_status[u.status] = por_status.get(u.status, 0) + 1
        vgv_tabela += float(u.preco_tabela or 0)
        if u.status == StatusUnidade.vendido:
            vgv_vendido += float(u.valor_venda or u.preco_tabela or 0)
    return ResumoEspelho(
        total=len(unidades), por_status=por_status,
        vgv_tabela=round(vgv_tabela, 2), vgv_vendido=round(vgv_vendido, 2),
    )


@router.post("/empreendimentos/{emp_id}/unidades", response_model=UnidadeResponse, status_code=status.HTTP_201_CREATED)
async def criar_unidade(emp_id: uuid.UUID, body: UnidadeCreate, db: AsyncSession = DB, user: CurrentUser = None):
    await _empreendimento(db, emp_id, user.tenant_id)
    u = Unidade(id=uuid.uuid4(), tenant_id=user.tenant_id, empreendimento_id=emp_id, **body.model_dump())
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


@router.post("/empreendimentos/{emp_id}/unidades/gerar", response_model=list[UnidadeResponse], status_code=status.HTTP_201_CREATED)
async def gerar_unidades(emp_id: uuid.UUID, body: GerarUnidades, db: AsyncSession = DB, user: CurrentUser = None):
    """Gera N unidades sequenciais de um grupo (ex: Quadra 1, lotes 1..20)."""
    await _empreendimento(db, emp_id, user.tenant_id)
    # Evita duplicar identificadores já existentes no mesmo grupo
    existentes = (await db.execute(
        select(Unidade.identificador).where(
            Unidade.empreendimento_id == emp_id, Unidade.grupo == body.grupo
        )
    )).scalars().all()
    existentes_set = set(existentes)

    novas: list[Unidade] = []
    for i in range(body.quantidade):
        ident = f"{body.prefixo}{body.inicio + i}".strip()
        if ident in existentes_set:
            continue
        novas.append(Unidade(
            id=uuid.uuid4(), tenant_id=user.tenant_id, empreendimento_id=emp_id,
            grupo=body.grupo, identificador=ident, tipo=body.tipo,
            area_privativa_m2=body.area_privativa_m2, preco_tabela=body.preco_tabela,
            status=StatusUnidade.disponivel,
        ))
    db.add_all(novas)
    await db.commit()
    for u in novas:
        await db.refresh(u)
    return novas


@router.patch("/unidades/{uid}", response_model=UnidadeResponse)
async def atualizar_unidade(uid: uuid.UUID, body: UnidadeUpdate, db: AsyncSession = DB, user: CurrentUser = None):
    u = await _unidade(db, uid, user.tenant_id)
    dados = body.model_dump(exclude_unset=True)
    # Ao marcar como vendido sem data, assume hoje
    if dados.get("status") == StatusUnidade.vendido and not u.data_venda and "data_venda" not in dados:
        dados["data_venda"] = date.today()
    for campo, valor in dados.items():
        setattr(u, campo, valor)
    await db.commit()
    await db.refresh(u)
    return u


@router.delete("/unidades/{uid}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_unidade(uid: uuid.UUID, db: AsyncSession = DB, user: CurrentUser = None):
    u = await _unidade(db, uid, user.tenant_id)
    await db.delete(u)
    await db.commit()
