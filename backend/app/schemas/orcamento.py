from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ── Item de Orçamento ──────────────────────────────────────────────────────────

class ItemOrcamentoCreate(BaseModel):
    etapa_id: UUID | None = None
    codigo_composicao: str | None = Field(default=None, max_length=50)
    descricao: str = Field(min_length=2, max_length=400)
    unidade: str = Field(max_length=20)
    quantidade: float = Field(ge=0)
    custo_unitario: float = Field(ge=0)
    origem_preco: str = "sinapi"


class ItemOrcamentoUpdate(BaseModel):
    descricao: str | None = None
    quantidade: float | None = Field(default=None, ge=0)
    custo_unitario: float | None = Field(default=None, ge=0)
    origem_preco: str | None = None


class ItemOrcamentoResponse(BaseModel):
    id: UUID
    orcamento_id: UUID
    etapa_id: UUID | None
    codigo_composicao: str | None
    descricao: str
    unidade: str
    quantidade: float
    custo_unitario: float
    custo_total: float
    origem_preco: str

    model_config = {"from_attributes": True}


# ── Orçamento ──────────────────────────────────────────────────────────────────

class OrcamentoCreate(BaseModel):
    descricao: str | None = Field(default=None, max_length=300)
    bdi_percentual: float = Field(default=0.0, ge=0, le=100)
    data_referencia: date | None = None
    base_referencia: str = "sinapi"
    uf_referencia: str | None = Field(default=None, max_length=2)


class OrcamentoUpdate(BaseModel):
    descricao: str | None = None
    bdi_percentual: float | None = Field(default=None, ge=0, le=100)
    data_referencia: date | None = None
    uf_referencia: str | None = None
    status: str | None = None


class OrcamentoResponse(BaseModel):
    id: UUID
    obra_id: UUID
    versao: int
    descricao: str | None
    valor_total: float
    bdi_percentual: float
    data_referencia: date | None
    base_referencia: str
    uf_referencia: str | None
    status: str
    criado_em: datetime
    atualizado_em: datetime
    total_itens: int = 0

    model_config = {"from_attributes": True}


class OrcamentoDetalhe(OrcamentoResponse):
    itens: list[ItemOrcamentoResponse] = []


class OrcamentoResumo(OrcamentoResponse):
    """Orçamento com nome da obra — usado no overview geral."""
    obra_nome: str = ""


# ── Custo Realizado ────────────────────────────────────────────────────────────

class CustoRealizadoCreate(BaseModel):
    etapa_id: UUID | None = None
    tipo: str
    descricao: str = Field(min_length=2, max_length=400)
    data_lancamento: date
    valor: float = Field(ge=0)
    nota_fiscal: str | None = Field(default=None, max_length=50)


class CustoRealizadoResponse(BaseModel):
    id: UUID
    obra_id: UUID
    etapa_id: UUID | None
    tipo: str
    descricao: str
    data_lancamento: date
    valor: float
    nota_fiscal: str | None
    criado_em: datetime

    model_config = {"from_attributes": True}
