import uuid
from enum import StrEnum

from sqlalchemy import UUID, DATE, NUMERIC, Boolean, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin


class TipoBase(StrEnum):
    publica = "publica"
    privada = "privada"


class EscopoBase(StrEnum):
    nacional = "nacional"
    estadual = "estadual"
    municipal = "municipal"


class FrequenciaAtualizacao(StrEnum):
    mensal = "mensal"
    trimestral = "trimestral"
    anual = "anual"


class IndiceInflacao(StrEnum):
    incc = "incc"
    incc_m = "incc_m"
    cub_nacional = "cub_nacional"
    cub_sp = "cub_sp"
    ipca = "ipca"
    igpm = "igpm"


class BaseReferenciaCusto(Base, TimestampMixin):
    __tablename__ = "bases_referencia"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    codigo: Mapped[str] = mapped_column(String(20), unique=True)  # 'SINAPI', 'SICRO', 'CUB_SP'
    nome: Mapped[str] = mapped_column(String(200))
    orgao: Mapped[str] = mapped_column(String(200))
    tipo: Mapped[TipoBase] = mapped_column(Enum(TipoBase))
    escopo: Mapped[EscopoBase] = mapped_column(Enum(EscopoBase))
    url_fonte: Mapped[str | None] = mapped_column(Text)
    frequencia_atualizacao: Mapped[FrequenciaAtualizacao] = mapped_column(
        Enum(FrequenciaAtualizacao)
    )
    ultima_atualizacao: Mapped[str | None] = mapped_column(DATE)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)

    composicoes: Mapped[list["ComposicaoCusto"]] = relationship(back_populates="base")


class ComposicaoCusto(Base, TimestampMixin):
    __tablename__ = "composicoes_custo"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    base_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bases_referencia.id")
    )
    codigo: Mapped[str] = mapped_column(String(50), index=True)
    descricao: Mapped[str] = mapped_column(Text)
    unidade: Mapped[str] = mapped_column(String(20))
    grupo: Mapped[str | None] = mapped_column(String(200))
    subgrupo: Mapped[str | None] = mapped_column(String(200))

    base: Mapped["BaseReferenciaCusto"] = relationship(back_populates="composicoes")
    precos: Mapped[list["PrecoReferencia"]] = relationship(back_populates="composicao")


class PrecoReferencia(Base):
    __tablename__ = "precos_referencia"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    composicao_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("composicoes_custo.id"), index=True
    )
    uf: Mapped[str] = mapped_column(String(2), index=True)
    ano_mes: Mapped[str] = mapped_column(DATE, index=True)
    custo_sem_desoneração: Mapped[float | None] = mapped_column(NUMERIC(12, 4))
    custo_com_desoneração: Mapped[float | None] = mapped_column(NUMERIC(12, 4))
    variacao_mensal: Mapped[float | None] = mapped_column(NUMERIC(6, 4))

    composicao: Mapped["ComposicaoCusto"] = relationship(back_populates="precos")


class IndiceInflacaoHistorico(Base):
    __tablename__ = "indices_inflacao"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    indice: Mapped[IndiceInflacao] = mapped_column(Enum(IndiceInflacao), index=True)
    ano_mes: Mapped[str] = mapped_column(DATE, index=True)
    valor_mensal: Mapped[float] = mapped_column(NUMERIC(8, 4))
    valor_acumulado_ano: Mapped[float] = mapped_column(NUMERIC(8, 4))
