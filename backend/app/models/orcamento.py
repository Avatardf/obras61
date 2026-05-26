import uuid
from enum import StrEnum

from sqlalchemy import UUID, DATE, NUMERIC, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TenantMixin, TimestampMixin


class BaseReferencia(StrEnum):
    sinapi = "sinapi"
    sicro = "sicro"
    cub = "cub"
    tcpo = "tcpo"
    propria = "propria"


class OrigemPreco(StrEnum):
    sinapi = "sinapi"
    sicro = "sicro"
    cub = "cub"
    cotacao = "cotacao"
    proprio = "proprio"


class TipoCusto(StrEnum):
    material = "material"
    mao_de_obra = "mao_de_obra"
    equipamento = "equipamento"
    servico = "servico"
    administrativo = "administrativo"


class Orcamento(Base, TenantMixin, TimestampMixin):
    __tablename__ = "orcamentos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    obra_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("obras.id"))
    versao: Mapped[int] = mapped_column(Integer, default=1)
    descricao: Mapped[str | None] = mapped_column(String(300))
    valor_total: Mapped[float] = mapped_column(NUMERIC(15, 2), default=0)
    bdi_percentual: Mapped[float] = mapped_column(NUMERIC(5, 2), default=0)
    data_referencia: Mapped[str | None] = mapped_column(DATE)
    base_referencia: Mapped[BaseReferencia] = mapped_column(
        Enum(BaseReferencia, native_enum=False), default=BaseReferencia.sinapi
    )
    uf_referencia: Mapped[str | None] = mapped_column(String(2))
    status: Mapped[str] = mapped_column(String(20), default="rascunho")

    itens: Mapped[list["ItemOrcamento"]] = relationship(back_populates="orcamento")


class ItemOrcamento(Base, TimestampMixin):
    __tablename__ = "itens_orcamento"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    orcamento_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("orcamentos.id"))
    etapa_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("etapas.id"))
    codigo_composicao: Mapped[str | None] = mapped_column(String(50))  # ex: SINAPI 74209/001
    descricao: Mapped[str] = mapped_column(String(400))
    unidade: Mapped[str] = mapped_column(String(20))
    quantidade: Mapped[float] = mapped_column(NUMERIC(12, 3))
    custo_unitario: Mapped[float] = mapped_column(NUMERIC(12, 4))
    custo_total: Mapped[float] = mapped_column(NUMERIC(15, 2))
    origem_preco: Mapped[OrigemPreco] = mapped_column(Enum(OrigemPreco, native_enum=False), default=OrigemPreco.sinapi)

    orcamento: Mapped["Orcamento"] = relationship(back_populates="itens")


class CustoRealizado(Base, TenantMixin, TimestampMixin):
    __tablename__ = "custos_realizados"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    obra_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("obras.id"))
    etapa_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("etapas.id"))
    tipo: Mapped[TipoCusto] = mapped_column(Enum(TipoCusto, native_enum=False))
    descricao: Mapped[str] = mapped_column(String(400))
    data_lancamento: Mapped[str] = mapped_column(DATE)
    valor: Mapped[float] = mapped_column(NUMERIC(15, 2))
    nota_fiscal: Mapped[str | None] = mapped_column(String(50))
    documento_url: Mapped[str | None] = mapped_column(Text)
