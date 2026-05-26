from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ── Sub-tipos ──────────────────────────────────────────────────────────────────

class EquipeRDO(BaseModel):
    funcao: str = Field(min_length=1, max_length=100)
    quantidade: int = Field(ge=1)


class OcorrenciaRDO(BaseModel):
    tipo: str          # seguranca | qualidade | ambiental | geral
    descricao: str
    criticidade: str   # baixa | media | alta


# ── Schemas principais ─────────────────────────────────────────────────────────

class RDOCreate(BaseModel):
    data: date
    clima_manha: str | None = None
    clima_tarde: str | None = None
    efetivo_total: int | None = Field(default=None, ge=0)
    equipes: list[EquipeRDO] = []
    atividades: list[str] = []
    ocorrencias: list[OcorrenciaRDO] = []
    observacoes: str | None = None


class RDOUpdate(BaseModel):
    data: date | None = None
    clima_manha: str | None = None
    clima_tarde: str | None = None
    efetivo_total: int | None = None
    equipes: list[EquipeRDO] | None = None
    atividades: list[str] | None = None
    ocorrencias: list[OcorrenciaRDO] | None = None
    observacoes: str | None = None
    status: str | None = None


class RDOResponse(BaseModel):
    id: UUID
    obra_id: UUID
    data: date
    clima_manha: str | None
    clima_tarde: str | None
    efetivo_total: int | None
    equipes: list[dict]
    atividades: list[str]
    ocorrencias: list[dict]
    observacoes: str | None
    conteudo_ia: str | None
    status: str
    criado_em: datetime
    atualizado_em: datetime

    model_config = {"from_attributes": True}


class RDOResumo(BaseModel):
    """Versão compacta para listagem."""
    id: UUID
    obra_id: UUID
    data: date
    clima_manha: str | None
    clima_tarde: str | None
    efetivo_total: int | None
    status: str
    tem_ia: bool = False
    total_atividades: int = 0
    total_ocorrencias: int = 0
    criado_em: datetime

    model_config = {"from_attributes": True}
