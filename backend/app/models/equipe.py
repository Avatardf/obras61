"""Módulo de Equipes — força de trabalho de campo.

Colaborador ≠ User: colaboradores são mão de obra (pedreiro, armador,
servente...) que em geral não acessa o sistema. Usuários são logins.

Estrutura:
  - Colaborador: pessoa física, própria ou de empreiteira (fornecedor).
  - Equipe: agrupamento com encarregado; colaborador pertence a no
    máximo uma equipe por vez (FK direta).
  - EquipeAlocacao: período em que a equipe trabalhou numa obra —
    permite histórico ("quem estava na Torre A em maio?") e custo
    de mão de obra por obra.
"""
import uuid
from datetime import date
from enum import StrEnum

from sqlalchemy import DATE, NUMERIC, UUID, Boolean, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TenantMixin, TimestampMixin


class TipoVinculo(StrEnum):
    proprio      = "proprio"
    terceirizado = "terceirizado"


class Colaborador(Base, TenantMixin, TimestampMixin):
    __tablename__ = "colaboradores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(200))
    funcao: Mapped[str] = mapped_column(String(100))  # pedreiro, armador, servente...
    tipo_vinculo: Mapped[TipoVinculo] = mapped_column(
        Enum(TipoVinculo, native_enum=False), default=TipoVinculo.proprio
    )
    # Empreiteira de origem, quando terceirizado
    fornecedor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fornecedores.id"), nullable=True
    )
    equipe_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("equipes.id", use_alter=True), nullable=True
    )
    custo_diaria: Mapped[float | None] = mapped_column(NUMERIC(10, 2), nullable=True)
    telefone: Mapped[str | None] = mapped_column(String(30))
    observacoes: Mapped[str | None] = mapped_column(Text)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)

    equipe: Mapped["Equipe | None"] = relationship(
        back_populates="membros", foreign_keys=[equipe_id]
    )


class Equipe(Base, TenantMixin, TimestampMixin):
    __tablename__ = "equipes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(200))
    # Encarregado/líder — um dos colaboradores
    lider_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("colaboradores.id", use_alter=True), nullable=True
    )
    descricao: Mapped[str | None] = mapped_column(Text)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)

    membros: Mapped[list["Colaborador"]] = relationship(
        back_populates="equipe", foreign_keys="Colaborador.equipe_id"
    )
    lider: Mapped["Colaborador | None"] = relationship(foreign_keys=[lider_id])
    alocacoes: Mapped[list["EquipeAlocacao"]] = relationship(
        back_populates="equipe", cascade="all, delete-orphan"
    )


class EquipeAlocacao(Base, TenantMixin, TimestampMixin):
    __tablename__ = "equipe_alocacoes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    equipe_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("equipes.id", ondelete="CASCADE")
    )
    obra_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("obras.id"))
    data_inicio: Mapped[date] = mapped_column(DATE)
    data_fim: Mapped[date | None] = mapped_column(DATE, nullable=True)  # null = alocação atual
    observacao: Mapped[str | None] = mapped_column(Text)

    equipe: Mapped["Equipe"] = relationship(back_populates="alocacoes")
