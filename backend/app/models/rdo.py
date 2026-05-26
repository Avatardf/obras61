import uuid

from sqlalchemy import DATE, JSON, UUID, Integer, String, Text, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TenantMixin, TimestampMixin


class RDO(Base, TenantMixin, TimestampMixin):
    """Relatório Diário de Obra."""

    __tablename__ = "rdos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    obra_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("obras.id"))

    data: Mapped[str] = mapped_column(DATE)

    # Clima
    clima_manha: Mapped[str | None] = mapped_column(String(20))   # ensolarado|nublado|chuvoso|tempestade
    clima_tarde: Mapped[str | None] = mapped_column(String(20))

    # Efetivo
    efetivo_total: Mapped[int | None] = mapped_column(Integer)
    equipes: Mapped[list] = mapped_column(JSON, default=list)
    # [{funcao: str, quantidade: int}]

    # Atividades e ocorrências
    atividades: Mapped[list] = mapped_column(JSON, default=list)
    # [str]

    ocorrencias: Mapped[list] = mapped_column(JSON, default=list)
    # [{tipo: str, descricao: str, criticidade: str}]

    # Texto livre + gerado por IA
    observacoes: Mapped[str | None] = mapped_column(Text)
    conteudo_ia: Mapped[str | None] = mapped_column(Text)

    status: Mapped[str] = mapped_column(String(20), default="rascunho")
    # rascunho | finalizado
