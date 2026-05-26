"""Schemas Pydantic do Centro de Custo."""
from __future__ import annotations
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


# ── Origem ─────────────────────────────────────────────────────────────────

class CCOrigem(BaseModel):
    """Descreve de onde os dados de um item vêm.

    Se modulo == 'manual' → o item é editável inline na aba CC.
    Caso contrário → ao clicar no campo, mostra disclaimer e link para a origem.
    """
    modulo:     str                # 'empreendimento' | 'orcamento' | 'financeiro' | 'suprimentos' | 'manual'
    categoria:  str | None = None  # tag de filtragem na origem (ex: 'tributo', 'projeto')
    descricao:  str | None = None  # texto do disclaimer
    rota:       str | None = None  # rota relativa (já com IDs substituídos)
    label:      str | None = None  # rótulo do botão de redirect


# ── Item do CC (saída) ─────────────────────────────────────────────────────

class CCItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    codigo:           str                # '1.1', '1.2', ...
    nome:             str
    origem:           CCOrigem
    editavel_inline:  bool                # True se origem.modulo == 'manual'

    valor_orcado:     float = 0
    valor_contratado: float = 0
    valor_executado:  float = 0
    saldo:            float = 0           # orcado − executado
    perc_executado:   float = 0           # 0–100
    perc_vgv:         float = 0           # 0–100 (executado / vgv)
    observacao:       str | None = None


class CCCategoriaRead(BaseModel):
    codigo:    str
    nome:      str
    icone:     str | None = None
    itens:     list[CCItemRead]
    # Totais agregados da categoria
    total_orcado:     float = 0
    total_contratado: float = 0
    total_executado:  float = 0
    total_saldo:      float = 0


class CCResumoDRE(BaseModel):
    """Parte 3 da planilha: DRE da SPE/Parceria."""
    vgv_total:                  float = 0
    impostos_total:             float = 0
    receita_liquida:            float = 0
    custos_diretos_total:       float = 0
    lucro_bruto_spe:            float = 0
    percentual_61_brasil:       float = 100   # % da 61 Brasil na parceria (100 para obras próprias)
    resultado_61_brasil:        float = 0
    margem_bruta_spe:           float = 0     # %
    resultado_sobre_vgv:        float = 0     # %


class CentroCustoResponse(BaseModel):
    """Resposta completa do CC de uma obra."""
    obra_id:               UUID
    obra_nome:             str
    empreendimento_id:     UUID
    empreendimento_nome:   str
    tipo_obra:             str        # 'propria' | 'parceria'
    parceiro:              str | None = None
    vgv_estimado:          float | None = None
    custo_orcado_total:    float = 0

    categorias:            list[CCCategoriaRead]
    dre:                   CCResumoDRE


# ── Update de lançamento manual ─────────────────────────────────────────────

class CCLancamentoUpdate(BaseModel):
    """Payload para criar/atualizar um lançamento manual de CC."""
    valor_orcado:     float = Field(default=0, ge=0)
    valor_contratado: float = Field(default=0, ge=0)
    valor_executado:  float = Field(default=0, ge=0)
    observacao:       str | None = None
