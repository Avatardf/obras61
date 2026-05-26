"""Modelos do Centro de Custo (CC).

Estrutura:
- cc_categorias: 14 grupos do CC (1.0 a 14.0) — catálogo global
- cc_itens_catalogo: ~65 sub-itens com mapeamento de origem — catálogo global
- cc_lancamentos_obra: lançamentos diretos por obra (para itens 'manual'
  ou ajustes de itens linkados que ainda não foram registrados na origem)
"""
import uuid
from sqlalchemy import UUID, NUMERIC, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TenantMixin, TimestampMixin


class CCCategoria(Base):
    __tablename__ = "cc_categorias"

    id:     Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    codigo: Mapped[str] = mapped_column(String(10), unique=True)   # '1.0', '2.0'
    nome:   Mapped[str] = mapped_column(String(200))
    ordem:  Mapped[int] = mapped_column(Integer)
    icone:  Mapped[str | None] = mapped_column(String(50), nullable=True)


class CCItemCatalogo(Base):
    __tablename__ = "cc_itens_catalogo"

    id:               Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    categoria_codigo: Mapped[str] = mapped_column(String(10), ForeignKey("cc_categorias.codigo"))
    codigo:           Mapped[str] = mapped_column(String(10), unique=True)  # '1.1', '1.2'
    nome:             Mapped[str] = mapped_column(String(300))
    ordem:            Mapped[int] = mapped_column(Integer)

    # Mapeamento de origem
    origem_modulo:    Mapped[str] = mapped_column(String(50), default="manual")
    origem_categoria: Mapped[str | None] = mapped_column(String(100), nullable=True)
    origem_descricao: Mapped[str | None] = mapped_column(Text, nullable=True)
    origem_rota:      Mapped[str | None] = mapped_column(String(300), nullable=True)
    origem_label:     Mapped[str | None] = mapped_column(String(100), nullable=True)


class CCLancamentoObra(Base, TenantMixin, TimestampMixin):
    __tablename__ = "cc_lancamentos_obra"
    __table_args__ = (UniqueConstraint("obra_id", "cc_item_codigo", name="uq_cc_lancamento_obra_item"),)

    id:               Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    obra_id:          Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("obras.id"))
    cc_item_codigo:   Mapped[str] = mapped_column(String(10), ForeignKey("cc_itens_catalogo.codigo"))

    valor_orcado:     Mapped[float] = mapped_column(NUMERIC(15, 2), default=0)
    valor_contratado: Mapped[float] = mapped_column(NUMERIC(15, 2), default=0)
    valor_executado:  Mapped[float] = mapped_column(NUMERIC(15, 2), default=0)

    observacao:       Mapped[str | None] = mapped_column(Text, nullable=True)
