import uuid
from enum import StrEnum

from sqlalchemy import UUID, Boolean, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin


class Plano(StrEnum):
    starter = "starter"
    professional = "professional"
    enterprise = "enterprise"


class Papel(StrEnum):
    admin = "admin"
    engenheiro = "engenheiro"
    mestre = "mestre"
    comprador = "comprador"
    financeiro = "financeiro"
    viewer = "viewer"


class Tenant(Base, TimestampMixin):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(200))
    cnpj: Mapped[str] = mapped_column(String(18), unique=True)
    plano: Mapped[Plano] = mapped_column(Enum(Plano, native_enum=False), default=Plano.starter)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)

    users: Mapped[list["User"]] = relationship(back_populates="tenant")


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    nome: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    senha_hash: Mapped[str] = mapped_column(String(200))
    papel: Mapped[Papel] = mapped_column(Enum(Papel, native_enum=False), default=Papel.viewer)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)

    tenant: Mapped["Tenant"] = relationship(back_populates="users")
