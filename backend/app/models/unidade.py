"""Módulo de Unidades — espelho digital de venda.

Cada empreendimento tem N unidades individuais (apartamentos, lotes,
salas), agrupadas por bloco/quadra/torre. O status de cada unidade
alimenta o "espelho digital" — a visão comercial de disponibilidade.

Substitui o campo agregado `num_unidades` por controle unidade a unidade,
base para funil de vendas, recebíveis e pós-venda.
"""
import uuid
from datetime import date
from enum import StrEnum

from sqlalchemy import DATE, NUMERIC, UUID, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TenantMixin, TimestampMixin


class StatusUnidade(StrEnum):
    disponivel   = "disponivel"
    pre_reserva  = "pre_reserva"
    reservado    = "reservado"
    vendido      = "vendido"
    permuta      = "permuta"
    indisponivel = "indisponivel"


class Unidade(Base, TenantMixin, TimestampMixin):
    __tablename__ = "unidades"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    empreendimento_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("empreendimentos.id", ondelete="CASCADE"), index=True
    )

    grupo: Mapped[str] = mapped_column(String(60))          # "Quadra 1", "Torre A", "Bloco 2"
    identificador: Mapped[str] = mapped_column(String(40))  # "101", "Lote 12"
    tipo: Mapped[str | None] = mapped_column(String(30))    # apartamento, lote, casa, sala
    pavimento: Mapped[int | None] = mapped_column(Integer, nullable=True)

    area_privativa_m2: Mapped[float | None] = mapped_column(NUMERIC(10, 2), nullable=True)
    area_total_m2: Mapped[float | None] = mapped_column(NUMERIC(10, 2), nullable=True)
    fracao_ideal: Mapped[float | None] = mapped_column(NUMERIC(8, 6), nullable=True)
    preco_tabela: Mapped[float | None] = mapped_column(NUMERIC(15, 2), nullable=True)

    status: Mapped[StatusUnidade] = mapped_column(
        Enum(StatusUnidade, native_enum=False), default=StatusUnidade.disponivel, index=True
    )

    # Dados da venda — preenchidos quando reservado/vendido
    cliente_nome: Mapped[str | None] = mapped_column(String(200), nullable=True)
    valor_venda: Mapped[float | None] = mapped_column(NUMERIC(15, 2), nullable=True)
    data_venda: Mapped[date | None] = mapped_column(DATE, nullable=True)

    observacao: Mapped[str | None] = mapped_column(Text, nullable=True)

    empreendimento = relationship("Empreendimento")
