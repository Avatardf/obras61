import uuid
from datetime import date
from pydantic import BaseModel, ConfigDict

from app.models.financeiro import StatusLancamento, TipoLancamento


class LancamentoCreate(BaseModel):
    obra_id: uuid.UUID | None = None
    tipo: TipoLancamento
    categoria: str
    descricao: str
    valor: float
    data_vencimento: date
    data_pagamento: date | None = None
    status: StatusLancamento = StatusLancamento.previsto
    nota_fiscal: str | None = None
    fornecedor_id: uuid.UUID | None = None
    oc_id: uuid.UUID | None = None
    forma_pagamento: str | None = None
    observacoes: str | None = None


class LancamentoUpdate(BaseModel):
    tipo: TipoLancamento | None = None
    categoria: str | None = None
    descricao: str | None = None
    valor: float | None = None
    data_vencimento: date | None = None
    data_pagamento: date | None = None
    status: StatusLancamento | None = None
    nota_fiscal: str | None = None
    fornecedor_id: uuid.UUID | None = None
    oc_id: uuid.UUID | None = None
    forma_pagamento: str | None = None
    observacoes: str | None = None


class LancamentoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    obra_id: uuid.UUID | None
    tipo: str
    categoria: str
    descricao: str
    valor: float
    data_vencimento: date
    data_pagamento: date | None
    status: str
    nota_fiscal: str | None
    fornecedor_id: uuid.UUID | None
    oc_id: uuid.UUID | None
    forma_pagamento: str | None
    observacoes: str | None


class ResumoFinanceiro(BaseModel):
    total_receitas: float
    total_despesas: float
    saldo: float
    a_vencer: float       # despesas previstas ainda não pagas
    em_atraso: float      # despesas atrasadas


class FluxoCaixaMes(BaseModel):
    mes: str              # "2025-01"
    receitas: float
    despesas: float
    saldo: float
