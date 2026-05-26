from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ── Atividade ─────────────────────────────────────────────────────────────────

class AtividadeCreate(BaseModel):
    nome: str = Field(min_length=2, max_length=300)
    unidade: str = Field(max_length=20)
    quantidade_prevista: float = Field(ge=0)
    predecessoras: list[str] = []


class AtividadeUpdate(BaseModel):
    nome: str | None = None
    quantidade_realizada: float | None = Field(default=None, ge=0)
    quantidade_prevista: float | None = Field(default=None, ge=0)


class AtividadeResponse(BaseModel):
    id: UUID
    etapa_id: UUID
    nome: str
    unidade: str
    quantidade_prevista: float
    quantidade_realizada: float
    predecessoras: list[str]
    percentual: float = 0.0

    model_config = {"from_attributes": True}


# ── Etapa ─────────────────────────────────────────────────────────────────────

class EtapaCreate(BaseModel):
    nome: str = Field(min_length=2, max_length=200)
    ordem: int = Field(ge=1)
    percentual_peso: float = Field(ge=0, le=100)
    mes_inicio: int | None = Field(default=None, ge=1)
    duracao_meses: int | None = Field(default=2, ge=1)
    percentual_planejado: float = Field(default=0, ge=0, le=100)
    percentual_realizado: float = Field(default=0, ge=0, le=100)


class EtapaUpdate(BaseModel):
    nome: str | None = None
    percentual_peso: float | None = Field(default=None, ge=0, le=100)
    status: str | None = None
    mes_inicio: int | None = Field(default=None, ge=1)
    duracao_meses: int | None = Field(default=None, ge=1)
    percentual_planejado: float | None = Field(default=None, ge=0, le=100)
    percentual_realizado: float | None = Field(default=None, ge=0, le=100)


class EtapaResponse(BaseModel):
    id: UUID
    obra_id: UUID
    nome: str
    ordem: int
    percentual_peso: float
    status: str
    progresso: float = 0.0          # % calculado das atividades ou percentual_realizado
    mes_inicio: int | None = None
    duracao_meses: int | None = 2
    percentual_planejado: float = 0.0
    percentual_realizado: float = 0.0
    atividades: list[AtividadeResponse] = []

    model_config = {"from_attributes": True}


# ── Obra ──────────────────────────────────────────────────────────────────────

# nome, ordem, peso%, mes_inicio, duracao_meses — baseado no Excel de referência (12 meses)
ETAPAS_PADRAO = [
    ("Serviços Preliminares",        1,  5.0,  1, 2),
    ("Fundação e Infraestrutura",    2, 15.0,  1, 3),
    ("Estrutura — Alvenaria",        3, 20.0,  2, 5),
    ("Cobertura",                    4,  8.0,  4, 2),
    ("Instalações Hidrossanitárias", 5, 10.0,  3, 4),
    ("Instalações Elétricas",        6,  8.0,  3, 4),
    ("Revestimentos",                7, 12.0,  5, 5),
    ("Esquadrias e Vidros",          8,  5.0,  8, 3),
    ("Pintura e Acabamento",         9,  9.0,  9, 3),
    ("Áreas Comuns e Paisagismo",   10,  3.0, 10, 3),
    ("Limpeza Final e Entrega",     11,  5.0, 11, 2),
]


class ObraCreate(BaseModel):
    nome: str = Field(min_length=2, max_length=200)
    area_construida_m2: float | None = Field(default=None, ge=0)
    numero_pavimentos: int | None = Field(default=None, ge=1)
    numero_unidades: int | None = Field(default=None, ge=1)
    status: str = "planejamento"
    data_inicio: date | None = None
    data_prevista_termino: date | None = None
    usar_etapas_padrao: bool = True


class ObraUpdate(BaseModel):
    nome: str | None = None
    area_construida_m2: float | None = None
    numero_pavimentos: int | None = None
    numero_unidades: int | None = None
    status: str | None = None
    data_inicio: date | None = None
    data_prevista_termino: date | None = None


class ObraResponse(BaseModel):
    id: UUID
    empreendimento_id: UUID
    nome: str
    area_construida_m2: float | None
    numero_pavimentos: int | None
    numero_unidades: int | None
    status: str
    data_inicio: date | None = None
    data_prevista_termino: date | None = None
    criado_em: datetime
    atualizado_em: datetime
    progresso_fisico: float = 0.0

    model_config = {"from_attributes": True}


class ObraDetalhe(ObraResponse):
    etapas: list[EtapaResponse] = []
    evm: dict | None = None
