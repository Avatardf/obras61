import uuid
from datetime import date
from enum import StrEnum

from sqlalchemy import UUID, DATE, NUMERIC, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TenantMixin, TimestampMixin


class TipoLancamento(StrEnum):
    receita = "receita"
    despesa = "despesa"


class StatusLancamento(StrEnum):
    previsto  = "previsto"
    pago      = "pago"
    atrasado  = "atrasado"
    cancelado = "cancelado"


class LancamentoFinanceiro(Base, TenantMixin, TimestampMixin):
    __tablename__ = "lancamentos_financeiros"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    obra_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("obras.id"), nullable=True
    )
    tipo: Mapped[TipoLancamento] = mapped_column(Enum(TipoLancamento, native_enum=False))
    categoria: Mapped[str] = mapped_column(String(100))
    # Ex: material, mao_de_obra, equipamento, servico, administrativo,
    #     receita_venda, receita_medicao, outros
    descricao: Mapped[str] = mapped_column(String(400))
    valor: Mapped[float] = mapped_column(NUMERIC(15, 2))
    data_vencimento: Mapped[date] = mapped_column(DATE)
    data_pagamento: Mapped[date | None] = mapped_column(DATE)
    status: Mapped[StatusLancamento] = mapped_column(
        Enum(StatusLancamento, native_enum=False), default=StatusLancamento.previsto
    )
    nota_fiscal: Mapped[str | None] = mapped_column(String(50))
    fornecedor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fornecedores.id"), nullable=True
    )
    oc_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ordens_compra.id"), nullable=True
    )
    forma_pagamento: Mapped[str | None] = mapped_column(String(100))
    observacoes: Mapped[str | None] = mapped_column(Text)
