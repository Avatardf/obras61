import uuid
from enum import StrEnum

from datetime import date, datetime

from sqlalchemy import UUID, Date, DATE, JSON, NUMERIC, Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TenantMixin, TimestampMixin


class TipoEmpreendimento(StrEnum):
    residencial_vertical = "residencial_vertical"
    residencial_horizontal = "residencial_horizontal"
    comercial = "comercial"
    misto = "misto"
    infraestrutura = "infraestrutura"


class StatusEmpreendimento(StrEnum):
    estudo = "estudo"
    viabilidade = "viabilidade"
    aprovacao = "aprovacao"
    em_obras = "em_obras"
    entregue = "entregue"
    cancelado = "cancelado"


class StatusObra(StrEnum):
    planejamento = "planejamento"
    em_execucao = "em_execucao"
    paralisada = "paralisada"
    concluida = "concluida"
    cancelada = "cancelada"


class StatusEtapa(StrEnum):
    pendente = "pendente"
    em_execucao = "em_execucao"
    concluida = "concluida"
    atrasada = "atrasada"


class Empreendimento(Base, TenantMixin, TimestampMixin):
    __tablename__ = "empreendimentos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(200))
    tipo: Mapped[TipoEmpreendimento] = mapped_column(Enum(TipoEmpreendimento, native_enum=False))
    endereco: Mapped[dict] = mapped_column(JSON)
    vgv_previsto: Mapped[float | None] = mapped_column(NUMERIC(15, 2))
    status: Mapped[StatusEmpreendimento] = mapped_column(
        Enum(StatusEmpreendimento, native_enum=False), default=StatusEmpreendimento.estudo
    )
    # Dados quantitativos do empreendimento
    num_unidades: Mapped[int | None] = mapped_column(Integer, nullable=True)
    area_terreno_m2: Mapped[float | None] = mapped_column(NUMERIC(12, 2), nullable=True)
    valor_terreno: Mapped[float | None] = mapped_column(NUMERIC(15, 2), nullable=True)
    preco_custo_unidade: Mapped[float | None] = mapped_column(NUMERIC(15, 2), nullable=True)
    preco_venda_unidade: Mapped[float | None] = mapped_column(NUMERIC(15, 2), nullable=True)
    # Dados para estimativa de custos (viabilidade)
    padrao_construtivo: Mapped[str | None] = mapped_column(String(20), nullable=True)   # economico/normal/alto/luxo
    metragem_media_unidade: Mapped[float | None] = mapped_column(NUMERIC(8, 2), nullable=True)
    num_pavimentos_estimado: Mapped[int | None] = mapped_column(Integer, nullable=True)
    estacionamento_tipo: Mapped[str | None] = mapped_column(String(30), nullable=True)
    num_vagas: Mapped[int | None] = mapped_column(Integer, nullable=True)
    num_elevadores: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sistema_estrutural: Mapped[str | None] = mapped_column(String(30), nullable=True)
    diferenciais_lazer: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Pipeline
    probabilidade: Mapped[int | None] = mapped_column(Integer, nullable=True)         # 0-100%
    modelo_negocio: Mapped[str | None] = mapped_column(String(20), nullable=True)     # propria/parceria
    parceiro: Mapped[str | None] = mapped_column(String(100), nullable=True)
    produto: Mapped[str | None] = mapped_column(String(50), nullable=True)            # MCMV Fx1/Fx2/Médio/Alto

    # Soft delete: registro vai para a Lixeira (não some do BD)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    obras: Mapped[list["Obra"]] = relationship(back_populates="empreendimento")
    estimativas: Mapped[list["EstimativaCusto"]] = relationship(
        back_populates="empreendimento", order_by="EstimativaCusto.gerado_em.desc()"
    )


class EstimativaCusto(Base, TenantMixin):
    """Estimativa paramétrica de custo gerada pela IA."""
    __tablename__ = "estimativas_custo"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    empreendimento_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("empreendimentos.id", ondelete="CASCADE")
    )
    gerado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    modelo_ia: Mapped[str] = mapped_column(String(50), default="gemini-2.5-flash")
    # Resultados financeiros
    custo_total: Mapped[float] = mapped_column(NUMERIC(18, 2))
    custo_total_min: Mapped[float | None] = mapped_column(NUMERIC(18, 2), nullable=True)
    custo_total_max: Mapped[float | None] = mapped_column(NUMERIC(18, 2), nullable=True)
    custo_por_m2_construido: Mapped[float | None] = mapped_column(NUMERIC(10, 2), nullable=True)
    area_construida_estimada_m2: Mapped[float | None] = mapped_column(NUMERIC(12, 2), nullable=True)
    custo_por_unidade: Mapped[float | None] = mapped_column(NUMERIC(15, 2), nullable=True)
    confianca: Mapped[str] = mapped_column(String(10), default="media")  # baixa/media/alta
    referencia_cub: Mapped[str | None] = mapped_column(String(200), nullable=True)
    multiplicador_cub: Mapped[float | None] = mapped_column(NUMERIC(5, 3), nullable=True)
    # Detalhamento
    breakdown: Mapped[dict] = mapped_column(JSON, default=dict)
    premissas: Mapped[list] = mapped_column(JSON, default=list)
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    parametros_entrada: Mapped[dict] = mapped_column(JSON, default=dict)

    empreendimento: Mapped["Empreendimento"] = relationship(back_populates="estimativas")


class Obra(Base, TenantMixin, TimestampMixin):
    __tablename__ = "obras"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    empreendimento_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("empreendimentos.id")
    )
    nome: Mapped[str] = mapped_column(String(200))
    area_construida_m2: Mapped[float | None] = mapped_column(NUMERIC(10, 2))
    numero_pavimentos: Mapped[int | None] = mapped_column(Integer)
    numero_unidades: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[StatusObra] = mapped_column(Enum(StatusObra, native_enum=False), default=StatusObra.planejamento)
    data_inicio: Mapped[date | None] = mapped_column(Date, nullable=True)
    data_prevista_termino: Mapped[date | None] = mapped_column(Date, nullable=True)

    empreendimento: Mapped["Empreendimento"] = relationship(back_populates="obras")
    etapas: Mapped[list["Etapa"]] = relationship(back_populates="obra", order_by="Etapa.ordem")


class Etapa(Base, TimestampMixin):
    __tablename__ = "etapas"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    obra_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("obras.id"))
    nome: Mapped[str] = mapped_column(String(200))
    ordem: Mapped[int] = mapped_column(Integer)
    percentual_peso: Mapped[float] = mapped_column(NUMERIC(5, 2), default=0)
    status: Mapped[StatusEtapa] = mapped_column(Enum(StatusEtapa, native_enum=False), default=StatusEtapa.pendente)
    mes_inicio: Mapped[int | None] = mapped_column(Integer, nullable=True)       # mês 1-based a partir da data_inicio da obra
    duracao_meses: Mapped[int | None] = mapped_column(Integer, nullable=True, default=2)
    percentual_planejado: Mapped[float] = mapped_column(NUMERIC(5, 2), default=0)
    percentual_realizado: Mapped[float] = mapped_column(NUMERIC(5, 2), default=0)

    obra: Mapped["Obra"] = relationship(back_populates="etapas")
    atividades: Mapped[list["Atividade"]] = relationship(back_populates="etapa")


class Atividade(Base, TimestampMixin):
    __tablename__ = "atividades"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    etapa_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("etapas.id"))
    nome: Mapped[str] = mapped_column(String(300))
    unidade: Mapped[str] = mapped_column(String(20))
    quantidade_prevista: Mapped[float] = mapped_column(NUMERIC(12, 3), default=0)
    quantidade_realizada: Mapped[float] = mapped_column(NUMERIC(12, 3), default=0)
    predecessoras: Mapped[list[str]] = mapped_column(JSON, default=list)

    etapa: Mapped["Etapa"] = relationship(back_populates="atividades")
