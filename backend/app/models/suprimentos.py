import uuid
from datetime import date
from enum import StrEnum

from sqlalchemy import UUID, DATE, JSON, LargeBinary, NUMERIC, Boolean, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TenantMixin, TimestampMixin


# ── Enums ─────────────────────────────────────────────────────────────────────

class StatusRequisicao(StrEnum):
    pendente    = "pendente"
    aprovada    = "aprovada"
    em_cotacao  = "em_cotacao"
    comprada    = "comprada"
    entregue    = "entregue"
    cancelada   = "cancelada"


class PrioridadeRequisicao(StrEnum):
    baixa   = "baixa"
    normal  = "normal"
    urgente = "urgente"


class StatusOC(StrEnum):
    rascunho              = "rascunho"
    aprovada              = "aprovada"
    aguardando_pagamento  = "aguardando_pagamento"
    paga                  = "paga"
    entregue              = "entregue"
    cancelada             = "cancelada"
    arquivada             = "arquivada"


class StatusRecebimento(StrEnum):
    pendente    = "pendente"
    conferido   = "conferido"
    divergencia = "divergencia"
    recusado    = "recusado"


# ── Fornecedor ────────────────────────────────────────────────────────────────

class Fornecedor(Base, TenantMixin, TimestampMixin):
    __tablename__ = "fornecedores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(300))
    cnpj: Mapped[str | None] = mapped_column(String(20))
    categoria: Mapped[str | None] = mapped_column(String(100))  # material, servico, equipamento...
    contato: Mapped[str | None] = mapped_column(String(200))
    telefone: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(200))
    cidade: Mapped[str | None] = mapped_column(String(100))
    uf: Mapped[str | None] = mapped_column(String(2))
    avaliacao: Mapped[int | None] = mapped_column(Integer)  # 1–5
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    observacoes: Mapped[str | None] = mapped_column(Text)

    ordens_compra: Mapped[list["OrdemCompra"]] = relationship(back_populates="fornecedor")


# ── Estoque ───────────────────────────────────────────────────────────────────

class EstoqueItem(Base, TenantMixin, TimestampMixin):
    __tablename__ = "estoque_itens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    obra_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("obras.id"), nullable=True)
    codigo: Mapped[str | None] = mapped_column(String(50))
    nome: Mapped[str] = mapped_column(String(300))
    categoria: Mapped[str | None] = mapped_column(String(100))
    unidade: Mapped[str] = mapped_column(String(20))
    quantidade: Mapped[float] = mapped_column(NUMERIC(12, 3), default=0)
    quantidade_minima: Mapped[float] = mapped_column(NUMERIC(12, 3), default=0)
    preco_unitario: Mapped[float | None] = mapped_column(NUMERIC(15, 2))
    fornecedor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("fornecedores.id"), nullable=True)
    localizacao: Mapped[str | None] = mapped_column(String(200))


# ── Requisição ────────────────────────────────────────────────────────────────

class Requisicao(Base, TenantMixin, TimestampMixin):
    __tablename__ = "requisicoes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    numero: Mapped[str] = mapped_column(String(20))       # REQ-0001
    obra_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("obras.id"), nullable=True)
    solicitante: Mapped[str] = mapped_column(String(200))
    data_solicitacao: Mapped[date] = mapped_column(DATE)
    data_entrega_prevista: Mapped[date | None] = mapped_column(DATE)
    status: Mapped[StatusRequisicao] = mapped_column(
        Enum(StatusRequisicao, native_enum=False), default=StatusRequisicao.pendente
    )
    prioridade: Mapped[PrioridadeRequisicao] = mapped_column(
        Enum(PrioridadeRequisicao, native_enum=False), default=PrioridadeRequisicao.normal
    )
    itens: Mapped[list] = mapped_column(JSON, default=list)
    # [{descricao, unidade, quantidade, observacao}]
    observacoes: Mapped[str | None] = mapped_column(Text)


# ── Ordem de Compra ───────────────────────────────────────────────────────────

class OrdemCompra(Base, TenantMixin, TimestampMixin):
    __tablename__ = "ordens_compra"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    numero: Mapped[str] = mapped_column(String(20))       # OC-0001
    obra_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("obras.id"), nullable=True)
    fornecedor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("fornecedores.id"), nullable=True)
    requisicao_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("requisicoes.id"), nullable=True)
    status: Mapped[StatusOC] = mapped_column(
        Enum(StatusOC, native_enum=False), default=StatusOC.rascunho
    )
    data_emissao: Mapped[date] = mapped_column(DATE)
    prazo_entrega: Mapped[date | None] = mapped_column(DATE)
    local_entrega: Mapped[str | None] = mapped_column(String(300))
    condicao_pagamento: Mapped[str | None] = mapped_column(String(200))
    valor_total: Mapped[float] = mapped_column(NUMERIC(15, 2), default=0)
    observacoes: Mapped[str | None] = mapped_column(Text)

    fornecedor: Mapped["Fornecedor | None"] = relationship(back_populates="ordens_compra")
    itens: Mapped[list["OCItem"]] = relationship(back_populates="oc", cascade="all, delete-orphan")


class OCItem(Base, TimestampMixin):
    __tablename__ = "oc_itens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    oc_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ordens_compra.id", ondelete="CASCADE"))
    descricao: Mapped[str] = mapped_column(String(400))
    unidade: Mapped[str] = mapped_column(String(20))
    quantidade: Mapped[float] = mapped_column(NUMERIC(12, 3))
    preco_unitario: Mapped[float] = mapped_column(NUMERIC(15, 4))
    preco_total: Mapped[float] = mapped_column(NUMERIC(15, 2))
    observacao: Mapped[str | None] = mapped_column(String(400))

    oc: Mapped["OrdemCompra"] = relationship(back_populates="itens")


# ── Recebimento ───────────────────────────────────────────────────────────────

class Recebimento(Base, TenantMixin, TimestampMixin):
    __tablename__ = "recebimentos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    numero: Mapped[str] = mapped_column(String(20))       # REC-0001
    obra_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("obras.id"), nullable=True)
    oc_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("ordens_compra.id"), nullable=True)
    nota_fiscal: Mapped[str | None] = mapped_column(String(50))
    transportadora: Mapped[str | None] = mapped_column(String(200))
    recebido_por: Mapped[str | None] = mapped_column(String(200))
    data_recebimento: Mapped[date] = mapped_column(DATE)
    status: Mapped[StatusRecebimento] = mapped_column(
        Enum(StatusRecebimento, native_enum=False), default=StatusRecebimento.pendente
    )
    observacoes: Mapped[str | None] = mapped_column(Text)

    itens: Mapped[list["RecebimentoItem"]] = relationship(back_populates="recebimento", cascade="all, delete-orphan")


class RecebimentoItem(Base, TimestampMixin):
    __tablename__ = "recebimento_itens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recebimento_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("recebimentos.id", ondelete="CASCADE"))
    oc_item_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("oc_itens.id"), nullable=True)
    descricao: Mapped[str] = mapped_column(String(400))
    unidade: Mapped[str] = mapped_column(String(20))
    quantidade_pedida: Mapped[float] = mapped_column(NUMERIC(12, 3), default=0)
    quantidade_recebida: Mapped[float] = mapped_column(NUMERIC(12, 3), default=0)
    quantidade_recusada: Mapped[float] = mapped_column(NUMERIC(12, 3), default=0)
    motivo_recusa: Mapped[str | None] = mapped_column(String(400))

    recebimento: Mapped["Recebimento"] = relationship(back_populates="itens")


# ── Cotação ───────────────────────────────────────────────────────────────────

class StatusCotacao(StrEnum):
    recebida  = "recebida"
    analisada = "analisada"
    aprovada  = "aprovada"
    recusada  = "recusada"


class Cotacao(Base, TenantMixin, TimestampMixin):
    """Resposta de um fornecedor a um pedido de cotação (pode ou não ter requisicao)."""
    __tablename__ = "cotacoes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    numero: Mapped[str] = mapped_column(String(20))          # COT-0001
    requisicao_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("requisicoes.id"), nullable=True
    )
    fornecedor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fornecedores.id"), nullable=True
    )
    data_cotacao: Mapped[date] = mapped_column(DATE)
    validade: Mapped[date | None] = mapped_column(DATE)
    prazo_entrega: Mapped[str | None] = mapped_column(String(200))
    condicao_pagamento: Mapped[str | None] = mapped_column(String(200))
    frete: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[StatusCotacao] = mapped_column(
        Enum(StatusCotacao, native_enum=False), default=StatusCotacao.recebida
    )
    valor_total: Mapped[float] = mapped_column(NUMERIC(15, 2), default=0)
    observacoes: Mapped[str | None] = mapped_column(Text)

    # Arquivo da proposta recebida (PDF/XLSX/DOCX)
    arquivo_nome: Mapped[str | None] = mapped_column(String(300), nullable=True)
    arquivo_mime: Mapped[str | None] = mapped_column(String(100), nullable=True)
    arquivo_bytes: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)

    fornecedor: Mapped["Fornecedor | None"] = relationship()
    itens: Mapped[list["CotacaoItem"]] = relationship(
        back_populates="cotacao", cascade="all, delete-orphan"
    )


class CotacaoItem(Base, TimestampMixin):
    __tablename__ = "cotacao_itens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cotacao_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cotacoes.id", ondelete="CASCADE")
    )
    descricao: Mapped[str] = mapped_column(String(400))
    unidade: Mapped[str] = mapped_column(String(20))
    quantidade: Mapped[float] = mapped_column(NUMERIC(12, 3))
    preco_unitario: Mapped[float] = mapped_column(NUMERIC(15, 4))
    preco_total: Mapped[float] = mapped_column(NUMERIC(15, 2))
    marca_modelo: Mapped[str | None] = mapped_column(String(200), nullable=True)
    observacao: Mapped[str | None] = mapped_column(String(400))

    cotacao: Mapped["Cotacao"] = relationship(back_populates="itens")


# ── Transferência de Estoque ──────────────────────────────────────────────────

class StatusTransferencia(StrEnum):
    pendente  = "pendente"
    concluida = "concluida"
    cancelada = "cancelada"


class TransferenciaEstoque(Base, TenantMixin, TimestampMixin):
    """Movimentação de material entre almoxarifado geral ↔ obra ↔ obra.

    origem_obra_id = NULL  → Almoxarifado Geral (empresa)
    destino_obra_id = NULL → Almoxarifado Geral (empresa)
    """
    __tablename__ = "transferencias_estoque"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    numero: Mapped[str] = mapped_column(String(20))

    # Origem: NULL = almoxarifado geral
    origem_obra_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("obras.id"), nullable=True
    )
    # Destino: NULL = almoxarifado geral
    destino_obra_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("obras.id"), nullable=True
    )
    # Item de origem (para movimentação automática de quantidade)
    estoque_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("estoque_itens.id"), nullable=True
    )
    material: Mapped[str] = mapped_column(String(300))
    unidade: Mapped[str] = mapped_column(String(20))
    quantidade: Mapped[float] = mapped_column(NUMERIC(12, 3))
    valor_unitario: Mapped[float | None] = mapped_column(NUMERIC(15, 4))
    valor_total: Mapped[float | None] = mapped_column(NUMERIC(15, 2))
    data_transferencia: Mapped[date] = mapped_column(DATE)
    status: Mapped[StatusTransferencia] = mapped_column(
        Enum(StatusTransferencia, native_enum=False), default=StatusTransferencia.pendente
    )
    solicitante: Mapped[str | None] = mapped_column(String(200))
    observacoes: Mapped[str | None] = mapped_column(Text)
