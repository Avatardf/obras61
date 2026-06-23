"""Modelo de controle de status documental por empreendimento."""
import uuid
from datetime import date
from enum import StrEnum

from sqlalchemy import DATE, UUID, Enum, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TenantMixin, TimestampMixin


class StatusDoc(StrEnum):
    pendente      = "pendente"
    em_andamento  = "em_andamento"
    concluido     = "concluido"
    nao_se_aplica = "nao_se_aplica"
    urgente       = "urgente"


class DocumentoStatus(Base, TenantMixin, TimestampMixin):
    """Um registro por (tenant, empreendimento, doc_tipo)."""
    __tablename__ = "documentos_status"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    empreendimento_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("empreendimentos.id", ondelete="CASCADE"),
    )
    doc_tipo: Mapped[str] = mapped_column(String(80))
    status: Mapped[StatusDoc] = mapped_column(
        Enum(StatusDoc, native_enum=False), default=StatusDoc.pendente
    )
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    data_inicio: Mapped[date | None] = mapped_column(DATE, nullable=True)
    data_prazo: Mapped[date | None] = mapped_column(DATE, nullable=True)
    data_conclusao: Mapped[date | None] = mapped_column(DATE, nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "empreendimento_id", "doc_tipo",
            name="uq_doc_status_emp_tipo",
        ),
    )
