"""Catálogo de materiais da construtora.

Cada construtora tem a sua cópia: a base padrão do sistema é copiada no
primeiro acesso e, a partir daí, a construtora inclui, edita, oculta,
exclui e importa itens livremente, sem afetar as outras.
"""
import uuid

from sqlalchemy import NUMERIC, UUID, Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TenantMixin, TimestampMixin


class MaterialCatalogo(Base, TenantMixin, TimestampMixin):
    __tablename__ = "materiais_catalogo"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    codigo: Mapped[str | None] = mapped_column(String(50), nullable=True)
    descricao: Mapped[str] = mapped_column(String(400))
    unidade: Mapped[str] = mapped_column(String(20), default="un")
    familia: Mapped[str | None] = mapped_column(String(120), nullable=True)
    preco_referencia: Mapped[float | None] = mapped_column(NUMERIC(14, 4), nullable=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)   # False = oculto
    origem: Mapped[str] = mapped_column(String(20), default="padrao")  # padrao | proprio | planilha
