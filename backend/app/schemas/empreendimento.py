from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Endereco(BaseModel):
    rua: str | None = None
    numero: str | None = None
    bairro: str | None = None
    cidade: str
    uf: str = Field(min_length=2, max_length=2)
    cep: str | None = None
    lat: float | None = None
    lng: float | None = None


# ── Requests ──────────────────────────────────────────────────────────────────

class EmpreendimentoCreate(BaseModel):
    nome: str = Field(min_length=2, max_length=200)
    tipo: str
    endereco: Endereco
    vgv_previsto: float | None = Field(default=None, ge=0)
    status: str = "estudo"
    num_unidades: int | None = Field(default=None, ge=1)
    area_terreno_m2: float | None = Field(default=None, ge=0)
    valor_terreno: float | None = Field(default=None, ge=0)
    preco_custo_unidade: float | None = Field(default=None, ge=0)
    preco_venda_unidade: float | None = Field(default=None, ge=0)
    # Campos para estimativa de custos
    padrao_construtivo: str | None = None
    metragem_media_unidade: float | None = Field(default=None, ge=10)
    num_pavimentos_estimado: int | None = Field(default=None, ge=1)
    estacionamento_tipo: str | None = None
    num_vagas: int | None = Field(default=None, ge=0)
    num_elevadores: int | None = Field(default=None, ge=0)
    sistema_estrutural: str | None = None
    diferenciais_lazer: list[str] | None = None
    # Pipeline
    probabilidade: int | None = Field(default=None, ge=0, le=100)
    modelo_negocio: str | None = None   # propria / parceria
    parceiro: str | None = None
    produto: str | None = None

    @field_validator("tipo")
    @classmethod
    def tipo_valido(cls, v: str) -> str:
        validos = {
            "residencial_vertical", "residencial_horizontal",
            "comercial", "misto", "infraestrutura",
        }
        if v not in validos:
            raise ValueError(f"Tipo inválido. Use: {validos}")
        return v

    @field_validator("status")
    @classmethod
    def status_valido(cls, v: str) -> str:
        validos = {"estudo", "viabilidade", "aprovacao", "em_obras", "entregue", "cancelado"}
        if v not in validos:
            raise ValueError(f"Status inválido. Use: {validos}")
        return v


class EmpreendimentoUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=200)
    tipo: str | None = None
    endereco: Endereco | None = None
    vgv_previsto: float | None = None
    status: str | None = None
    num_unidades: int | None = None
    area_terreno_m2: float | None = None
    valor_terreno: float | None = None
    preco_custo_unidade: float | None = None
    preco_venda_unidade: float | None = None
    padrao_construtivo: str | None = None
    metragem_media_unidade: float | None = None
    num_pavimentos_estimado: int | None = None
    estacionamento_tipo: str | None = None
    num_vagas: int | None = None
    num_elevadores: int | None = None
    sistema_estrutural: str | None = None
    diferenciais_lazer: list[str] | None = None
    # Pipeline
    probabilidade: int | None = None
    modelo_negocio: str | None = None
    parceiro: str | None = None
    produto: str | None = None


# ── Responses ─────────────────────────────────────────────────────────────────

class ObraResumo(BaseModel):
    id: UUID
    nome: str
    status: str
    area_construida_m2: float | None

    model_config = {"from_attributes": True}


class EmpreendimentoResponse(BaseModel):
    id: UUID
    nome: str
    tipo: str
    endereco: dict
    vgv_previsto: float | None
    status: str
    criado_em: datetime
    atualizado_em: datetime
    total_obras: int = 0
    primary_obra_id: UUID | None = None    # ID da 1ª obra (atalho para CC, Cronograma, etc)
    num_unidades: int | None = None
    area_terreno_m2: float | None = None
    valor_terreno: float | None = None
    preco_custo_unidade: float | None = None
    preco_venda_unidade: float | None = None
    padrao_construtivo: str | None = None
    metragem_media_unidade: float | None = None
    num_pavimentos_estimado: int | None = None
    estacionamento_tipo: str | None = None
    num_vagas: int | None = None
    num_elevadores: int | None = None
    sistema_estrutural: str | None = None
    diferenciais_lazer: list[str] | None = None
    # Pipeline
    probabilidade: int | None = None
    modelo_negocio: str | None = None
    parceiro: str | None = None
    produto: str | None = None

    model_config = {"from_attributes": True}


# ── Estimativa de Custos ───────────────────────────────────────────────────────

class EstimativaBreakdown(BaseModel):
    fundacao: float = 0
    estrutura: float = 0
    vedacao_alvenaria: float = 0
    cobertura: float = 0
    instalacoes_eletricas: float = 0
    instalacoes_hidraulicas: float = 0
    instalacoes_especiais: float = 0
    revestimentos: float = 0
    esquadrias_vidros: float = 0
    pintura: float = 0
    acabamentos_metais: float = 0
    elevadores: float = 0
    estacionamento: float = 0
    areas_lazer: float = 0
    areas_comuns_circulacao: float = 0
    bdi_indiretos: float = 0


class EstimativaCustoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    empreendimento_id: UUID
    gerado_em: datetime
    modelo_ia: str
    custo_total: float
    custo_total_min: float | None
    custo_total_max: float | None
    custo_por_m2_construido: float | None
    area_construida_estimada_m2: float | None
    custo_por_unidade: float | None
    confianca: str
    referencia_cub: str | None
    multiplicador_cub: float | None
    breakdown: Any
    premissas: Any
    observacoes: str | None
    parametros_entrada: Any


class EmpreendimentoDetalhe(EmpreendimentoResponse):
    obras: list[ObraResumo] = []


class EmpreendimentoLista(BaseModel):
    items: list[EmpreendimentoResponse]
    total: int
    pagina: int
    por_pagina: int
