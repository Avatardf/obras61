import uuid
from datetime import date
from typing import Any
from pydantic import BaseModel, ConfigDict

from app.models.suprimentos import (
    PrioridadeRequisicao, StatusCotacao, StatusOC, StatusRecebimento,
    StatusRequisicao, StatusTransferencia,
)


# ── Fornecedor ────────────────────────────────────────────────────────────────

class FornecedorCreate(BaseModel):
    nome: str
    cnpj: str | None = None
    categoria: str | None = None
    contato: str | None = None
    telefone: str | None = None
    email: str | None = None
    cidade: str | None = None
    uf: str | None = None
    avaliacao: int | None = None
    ativo: bool = True
    observacoes: str | None = None


class FornecedorUpdate(BaseModel):
    nome: str | None = None
    cnpj: str | None = None
    categoria: str | None = None
    contato: str | None = None
    telefone: str | None = None
    email: str | None = None
    cidade: str | None = None
    uf: str | None = None
    avaliacao: int | None = None
    ativo: bool | None = None
    observacoes: str | None = None


class FornecedorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    nome: str
    cnpj: str | None
    categoria: str | None
    contato: str | None
    telefone: str | None
    email: str | None
    cidade: str | None
    uf: str | None
    avaliacao: int | None
    ativo: bool
    observacoes: str | None


# ── Estoque ───────────────────────────────────────────────────────────────────

class EstoqueItemCreate(BaseModel):
    obra_id: uuid.UUID | None = None
    codigo: str | None = None
    nome: str
    categoria: str | None = None
    unidade: str
    quantidade: float = 0
    quantidade_minima: float = 0
    preco_unitario: float | None = None
    fornecedor_id: uuid.UUID | None = None
    localizacao: str | None = None


class EstoqueItemUpdate(BaseModel):
    nome: str | None = None
    categoria: str | None = None
    unidade: str | None = None
    quantidade: float | None = None
    quantidade_minima: float | None = None
    preco_unitario: float | None = None
    fornecedor_id: uuid.UUID | None = None
    localizacao: str | None = None


class EstoqueItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    obra_id: uuid.UUID | None
    codigo: str | None
    nome: str
    categoria: str | None
    unidade: str
    quantidade: float
    quantidade_minima: float
    preco_unitario: float | None
    fornecedor_id: uuid.UUID | None
    localizacao: str | None
    alerta_reposicao: bool = False

    @classmethod
    def from_orm_with_alerta(cls, obj: Any) -> "EstoqueItemResponse":
        r = cls.model_validate(obj)
        r.alerta_reposicao = obj.quantidade <= obj.quantidade_minima
        return r


# ── Requisição ────────────────────────────────────────────────────────────────

class RequisicaoCreate(BaseModel):
    obra_id: uuid.UUID | None = None
    solicitante: str
    data_solicitacao: date
    data_entrega_prevista: date | None = None
    prioridade: PrioridadeRequisicao = PrioridadeRequisicao.normal
    itens: list[dict] = []
    observacoes: str | None = None


class RequisicaoUpdate(BaseModel):
    solicitante: str | None = None
    data_entrega_prevista: date | None = None
    status: StatusRequisicao | None = None
    prioridade: PrioridadeRequisicao | None = None
    itens: list[dict] | None = None
    observacoes: str | None = None


class RequisicaoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    numero: str
    obra_id: uuid.UUID | None
    solicitante: str
    data_solicitacao: date
    data_entrega_prevista: date | None
    status: str
    prioridade: str
    itens: list
    observacoes: str | None


# ── Ordem de Compra ───────────────────────────────────────────────────────────

class OCItemCreate(BaseModel):
    descricao: str
    unidade: str
    quantidade: float
    preco_unitario: float
    observacao: str | None = None


class OCItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    descricao: str
    unidade: str
    quantidade: float
    preco_unitario: float
    preco_total: float
    observacao: str | None


class OrdemCompraCreate(BaseModel):
    obra_id: uuid.UUID | None = None
    fornecedor_id: uuid.UUID | None = None
    requisicao_id: uuid.UUID | None = None
    data_emissao: date
    prazo_entrega: date | None = None
    local_entrega: str | None = None
    condicao_pagamento: str | None = None
    observacoes: str | None = None
    itens: list[OCItemCreate] = []


class OrdemCompraUpdate(BaseModel):
    fornecedor_id: uuid.UUID | None = None
    status: StatusOC | None = None
    prazo_entrega: date | None = None
    local_entrega: str | None = None
    condicao_pagamento: str | None = None
    observacoes: str | None = None


class OrdemCompraResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    numero: str
    obra_id: uuid.UUID | None
    fornecedor_id: uuid.UUID | None
    requisicao_id: uuid.UUID | None
    status: str
    data_emissao: date
    prazo_entrega: date | None
    local_entrega: str | None
    condicao_pagamento: str | None
    valor_total: float
    observacoes: str | None
    itens: list[OCItemResponse] = []
    fornecedor_nome: str | None = None


# ── Recebimento ───────────────────────────────────────────────────────────────

class RecebimentoItemCreate(BaseModel):
    oc_item_id: uuid.UUID | None = None
    descricao: str
    unidade: str
    quantidade_pedida: float = 0
    quantidade_recebida: float = 0
    quantidade_recusada: float = 0
    motivo_recusa: str | None = None


class RecebimentoItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    descricao: str
    unidade: str
    quantidade_pedida: float
    quantidade_recebida: float
    quantidade_recusada: float
    motivo_recusa: str | None


class RecebimentoCreate(BaseModel):
    obra_id: uuid.UUID | None = None
    oc_id: uuid.UUID | None = None
    nota_fiscal: str | None = None
    transportadora: str | None = None
    recebido_por: str | None = None
    data_recebimento: date
    observacoes: str | None = None
    itens: list[RecebimentoItemCreate] = []


class RecebimentoItemUpdate(BaseModel):
    id: uuid.UUID
    quantidade_recebida: float | None = None
    quantidade_recusada: float | None = None
    motivo_recusa: str | None = None


class RecebimentoUpdate(BaseModel):
    status: StatusRecebimento | None = None
    nota_fiscal: str | None = None
    transportadora: str | None = None
    recebido_por: str | None = None
    observacoes: str | None = None
    itens: list[RecebimentoItemUpdate] | None = None


class RecebimentoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    numero: str
    obra_id: uuid.UUID | None
    oc_id: uuid.UUID | None
    nota_fiscal: str | None
    transportadora: str | None
    recebido_por: str | None
    data_recebimento: date
    status: str
    observacoes: str | None
    itens: list[RecebimentoItemResponse] = []


# ── Transferência de Estoque ──────────────────────────────────────────────────

class TransferenciaCreate(BaseModel):
    """Solicita transferência de material entre almoxarifado e/ou obra.

    origem_obra_id = None  → saída do Almoxarifado Geral
    destino_obra_id = None → entrada no Almoxarifado Geral
    """
    origem_obra_id: uuid.UUID | None = None
    destino_obra_id: uuid.UUID | None = None
    estoque_item_id: uuid.UUID | None = None   # item de origem para movimentação automática
    material: str
    unidade: str
    quantidade: float
    valor_unitario: float | None = None
    data_transferencia: date
    solicitante: str | None = None
    observacoes: str | None = None


class TransferenciaUpdate(BaseModel):
    status: StatusTransferencia | None = None
    observacoes: str | None = None


class TransferenciaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    numero: str
    origem_obra_id: uuid.UUID | None
    destino_obra_id: uuid.UUID | None
    estoque_item_id: uuid.UUID | None
    material: str
    unidade: str
    quantidade: float
    valor_unitario: float | None
    valor_total: float | None
    data_transferencia: date
    status: str
    solicitante: str | None
    observacoes: str | None
    # Labels enriquecidos pelo endpoint
    origem_label: str = "Almoxarifado Geral"
    destino_label: str = "Almoxarifado Geral"


# ── Cotação ───────────────────────────────────────────────────────────────────

class CotacaoItemCreate(BaseModel):
    descricao: str
    unidade: str
    quantidade: float
    preco_unitario: float
    marca_modelo: str | None = None
    observacao: str | None = None


class CotacaoItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    descricao: str
    unidade: str
    quantidade: float
    preco_unitario: float
    preco_total: float
    marca_modelo: str | None = None
    observacao: str | None


class CotacaoCreate(BaseModel):
    requisicao_id: uuid.UUID | None = None
    fornecedor_id: uuid.UUID | None = None
    data_cotacao: date
    validade: date | None = None
    prazo_entrega: str | None = None
    condicao_pagamento: str | None = None
    frete: str | None = None
    observacoes: str | None = None
    itens: list[CotacaoItemCreate] = []


class CotacaoUpdate(BaseModel):
    fornecedor_id: uuid.UUID | None = None
    status: StatusCotacao | None = None
    validade: date | None = None
    prazo_entrega: str | None = None
    condicao_pagamento: str | None = None
    frete: str | None = None
    observacoes: str | None = None


class CotacaoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    numero: str
    requisicao_id: uuid.UUID | None
    fornecedor_id: uuid.UUID | None
    fornecedor_nome: str | None = None
    data_cotacao: date
    validade: date | None
    prazo_entrega: str | None
    condicao_pagamento: str | None
    frete: str | None
    status: str
    valor_total: float
    observacoes: str | None
    itens: list[CotacaoItemResponse] = []
    criado_em: Any
    arquivo_nome: str | None = None


# ── Comparativo ───────────────────────────────────────────────────────────────

class ComparativoPreco(BaseModel):
    cotacao_id: uuid.UUID
    cotacao_numero: str
    fornecedor_id: uuid.UUID | None
    fornecedor_nome: str
    preco_unitario: float
    preco_total: float
    marca_modelo: str | None = None
    observacao: str | None = None
    melhor: bool = False   # menor preço para este item


class ComparativoItemRow(BaseModel):
    descricao: str
    unidade: str
    quantidade: float
    cotacoes: list[ComparativoPreco]
    menor_preco: float | None


class ComparativoFornecedor(BaseModel):
    cotacao_id: uuid.UUID
    cotacao_numero: str
    fornecedor_id: uuid.UUID | None
    fornecedor_nome: str
    total_geral: float
    validade: date | None
    prazo_entrega: str | None
    condicao_pagamento: str | None
    frete: str | None


class ComparativoResponse(BaseModel):
    requisicao_id: uuid.UUID
    fornecedores: list[ComparativoFornecedor]
    itens: list[ComparativoItemRow]


# ── Geração de OCs a partir do comparativo ────────────────────────────────────

class GerarOCSelecao(BaseModel):
    cotacao_id: uuid.UUID
    descricao: str
    unidade: str
    quantidade: float
    preco_unitario: float


class GerarOCsBody(BaseModel):
    selecoes: list[GerarOCSelecao]
    data_emissao: date


# ── Sobras ────────────────────────────────────────────────────────────────────

class SobrasResponse(BaseModel):
    obra_id: uuid.UUID
    itens: list[EstoqueItemResponse]
    valor_total: float
    quantidade_itens: int


# ── Lista de obras (para selectbox em transferências) ─────────────────────────

class ObraResumida(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    nome: str
    codigo: str | None = None
