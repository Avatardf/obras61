"""Módulo de Funil de Vendas (CRM).

Cada Lead é uma oportunidade de venda que percorre as etapas do funil,
do primeiro contato ao contrato assinado. Quando fecha (etapa=contrato)
e há unidade vinculada, a unidade vira "vendido" no espelho digital —
fechando o ciclo comercial.
"""
import uuid
from datetime import date
from enum import StrEnum

from sqlalchemy import DATE, NUMERIC, UUID, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TenantMixin, TimestampMixin


class EtapaFunil(StrEnum):
    pre_atendimento = "pre_atendimento"
    visita          = "visita"
    atendimento     = "atendimento"
    pasta_digital   = "pasta_digital"
    proposta        = "proposta"
    contrato        = "contrato"      # ganho / fechado
    perdido         = "perdido"


class Lead(Base, TenantMixin, TimestampMixin):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome_cliente: Mapped[str] = mapped_column(String(200))
    telefone: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(200))

    empreendimento_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("empreendimentos.id", ondelete="SET NULL"), nullable=True
    )
    unidade_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("unidades.id", ondelete="SET NULL"), nullable=True
    )

    etapa: Mapped[EtapaFunil] = mapped_column(
        Enum(EtapaFunil, native_enum=False), default=EtapaFunil.pre_atendimento, index=True
    )
    valor: Mapped[float | None] = mapped_column(NUMERIC(15, 2), nullable=True)
    responsavel: Mapped[str | None] = mapped_column(String(120))
    origem: Mapped[str | None] = mapped_column(String(40))   # site, indicacao, portal, whatsapp, telefone
    observacoes: Mapped[str | None] = mapped_column(Text)

    # Data em que entrou na etapa atual — base para "dias na etapa"
    data_entrada_etapa: Mapped[date] = mapped_column(DATE, default=date.today)
    motivo_perda: Mapped[str | None] = mapped_column(String(200))

    empreendimento = relationship("Empreendimento")
    unidade = relationship("Unidade")
