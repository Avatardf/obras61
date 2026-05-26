import uuid
from enum import StrEnum

from sqlalchemy import UUID, JSON, NUMERIC, BigInteger, Boolean, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin


class StatusProcessamento(StrEnum):
    pendente = "pendente"
    processando = "processando"
    concluido = "concluido"
    erro = "erro"


class PontoCaptura(Base, TimestampMixin):
    __tablename__ = "pontos_captura"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    obra_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("obras.id"))
    etapa_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("etapas.id"))
    nome: Mapped[str] = mapped_column(String(200))
    coordenadas_planta: Mapped[dict | None] = mapped_column(JSON)  # { x, y } relativo à planta
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)

    capturas: Mapped[list["Captura360"]] = relationship(back_populates="ponto")


class Captura360(Base, TimestampMixin):
    __tablename__ = "capturas_360"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ponto_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pontos_captura.id")
    )
    arquivo_url: Mapped[str] = mapped_column(Text)
    tamanho_bytes: Mapped[int | None] = mapped_column(BigInteger)
    dispositivo: Mapped[str | None] = mapped_column(String(100))
    status_processamento: Mapped[StatusProcessamento] = mapped_column(
        Enum(StatusProcessamento, native_enum=False), default=StatusProcessamento.pendente
    )

    ponto: Mapped["PontoCaptura"] = relationship(back_populates="capturas")
    analise: Mapped["AnaliseIA | None"] = relationship(
        back_populates="captura", uselist=False,
        foreign_keys="AnaliseIA.captura_id",
    )


class AnaliseIA(Base, TimestampMixin):
    __tablename__ = "analises_ia"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    captura_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("capturas_360.id"), unique=True
    )
    captura_anterior_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("capturas_360.id")
    )
    modelo_ia: Mapped[str] = mapped_column(String(100))
    progresso_estimado: Mapped[float | None] = mapped_column(NUMERIC(5, 2))
    anomalias_detectadas: Mapped[list | None] = mapped_column(JSON)
    sugestao_rdo: Mapped[str | None] = mapped_column(Text)
    confianca: Mapped[float | None] = mapped_column(NUMERIC(4, 3))
    tokens_consumidos: Mapped[int | None] = mapped_column(Integer)
    custo_usd: Mapped[float | None] = mapped_column(NUMERIC(8, 6))

    captura: Mapped["Captura360"] = relationship(
        back_populates="analise", foreign_keys=[captura_id]
    )
