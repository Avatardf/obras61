"""API Centro de Custo: visão consolidada por obra.

Endpoint:
- GET   /obras/{obra_id}/centro-custo   → estrutura completa do CC + DRE
- PUT   /obras/{obra_id}/centro-custo/{cc_item_codigo} → upsert lançamento manual
- DELETE /obras/{obra_id}/centro-custo/{cc_item_codigo} → remove lançamento manual

A lógica de agregação:
- Para cada item do catálogo, busca os valores na origem definida:
  - 'empreendimento' → empreendimento.valor_terreno (somente 1.1)
  - 'orcamento'      → soma de itens_orcamento (por categoria_filtro) + custos_realizados
  - 'financeiro'     → soma de lancamentos_financeiros (por categoria)
  - 'suprimentos'    → soma de OCs/recebimentos (por categoria)
  - 'manual'         → cc_lancamentos_obra
"""
import uuid
from collections import defaultdict
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser
from app.models.centro_custo import CCCategoria, CCItemCatalogo, CCLancamentoObra
from app.models.financeiro import LancamentoFinanceiro, StatusLancamento, TipoLancamento
from app.models.obra import Empreendimento, Obra
from app.models.orcamento import CustoRealizado, ItemOrcamento, Orcamento
from app.schemas.centro_custo import (
    CCCategoriaRead, CCItemRead, CCLancamentoUpdate, CCOrigem,
    CCResumoDRE, CentroCustoResponse,
)

router = APIRouter(tags=["centro-custo"])
DB = Annotated[AsyncSession, Depends(get_db)]


def _f(v) -> float:
    """Converte Decimal/None em float seguro."""
    if v is None:
        return 0.0
    if isinstance(v, Decimal):
        return float(v)
    return float(v)


def _format_route(rota: str | None, *, obra_id, empreendimento_id,
                  categoria: str | None = None) -> str | None:
    if not rota:
        return None
    return (rota
            .replace("{obra_id}",          str(obra_id))
            .replace("{empreendimento_id}", str(empreendimento_id))
            .replace("{categoria}",        categoria or ""))


# ───────────────────────────────────────────────────────────────────────────
# GET /obras/{obra_id}/centro-custo
# ───────────────────────────────────────────────────────────────────────────
@router.get("/obras/{obra_id}/centro-custo", response_model=CentroCustoResponse)
async def obter_centro_custo(obra_id: uuid.UUID, db: DB, user: CurrentUser):
    # Obra + empreendimento
    obra = (await db.execute(
        select(Obra).where(Obra.id == obra_id, Obra.tenant_id == user.tenant_id)
    )).scalar_one_or_none()
    if not obra:
        raise HTTPException(status_code=404, detail="Obra não encontrada")

    emp = (await db.execute(
        select(Empreendimento).where(Empreendimento.id == obra.empreendimento_id)
    )).scalar_one()

    tipo_obra = "parceria" if emp.parceiro and emp.parceiro != "61 Brasil" else "propria"

    # ── 1. Carrega catálogo ──────────────────────────────────────────────
    cats = (await db.execute(
        select(CCCategoria).order_by(CCCategoria.ordem)
    )).scalars().all()

    itens_cat = (await db.execute(
        select(CCItemCatalogo).order_by(CCItemCatalogo.ordem)
    )).scalars().all()

    # ── 2. Agrega dados das origens ──────────────────────────────────────

    # 2.1 — Lançamentos manuais (cc_lancamentos_obra) para esta obra
    manuais = (await db.execute(
        select(CCLancamentoObra).where(
            CCLancamentoObra.tenant_id == user.tenant_id,
            CCLancamentoObra.obra_id == obra_id,
        )
    )).scalars().all()
    manuais_por_codigo = {m.cc_item_codigo: m for m in manuais}

    # 2.2 — Financeiro: soma por categoria para esta obra
    fin_orcado:    dict[str, float] = defaultdict(float)
    fin_executado: dict[str, float] = defaultdict(float)
    fin_rows = (await db.execute(
        select(LancamentoFinanceiro.categoria,
               LancamentoFinanceiro.status,
               LancamentoFinanceiro.valor)
        .where(LancamentoFinanceiro.tenant_id == user.tenant_id,
               LancamentoFinanceiro.obra_id == obra_id,
               LancamentoFinanceiro.tipo == TipoLancamento.despesa)
    )).all()
    for cat, st, valor in fin_rows:
        v = _f(valor)
        fin_orcado[cat] += v                        # qualquer lançamento conta como orçado
        if st == StatusLancamento.pago:
            fin_executado[cat] += v

    # 2.3 — Orçamento: soma por categoria (codigo_composicao começa com prefix)
    # Convenção: itens_orcamento.codigo_composicao pode conter um tag
    # 'cc:<cc_item_codigo>' ou tag de categoria_filtro
    orc_orcado:    dict[str, float] = defaultdict(float)
    orc_realizado: dict[str, float] = defaultdict(float)
    orc_rows = (await db.execute(
        select(ItemOrcamento.codigo_composicao, ItemOrcamento.custo_total)
        .join(Orcamento, Orcamento.id == ItemOrcamento.orcamento_id)
        .where(Orcamento.obra_id == obra_id,
               Orcamento.tenant_id == user.tenant_id)
    )).all()
    for cod, total in orc_rows:
        if not cod:
            continue
        orc_orcado[cod] += _f(total)

    cr_rows = (await db.execute(
        select(CustoRealizado.tipo, CustoRealizado.valor)
        .where(CustoRealizado.tenant_id == user.tenant_id,
               CustoRealizado.obra_id == obra_id)
    )).all()
    for tipo_, valor in cr_rows:
        orc_realizado[tipo_] += _f(valor)

    # 2.4 — Receita (VGV pago/medido) - para DRE
    vgv_total       = _f(emp.vgv_previsto)
    receita_paga    = (await db.execute(
        select(func.coalesce(func.sum(LancamentoFinanceiro.valor), 0))
        .where(LancamentoFinanceiro.tenant_id == user.tenant_id,
               LancamentoFinanceiro.obra_id == obra_id,
               LancamentoFinanceiro.tipo == TipoLancamento.receita,
               LancamentoFinanceiro.status == StatusLancamento.pago)
    )).scalar()
    receita_paga = _f(receita_paga)

    # ── 3. Monta itens ──────────────────────────────────────────────────
    cat_map: dict[str, list[CCItemRead]] = defaultdict(list)
    custo_orcado_total = 0.0

    for item in itens_cat:
        # Origem
        rota = _format_route(item.origem_rota,
                             obra_id=obra_id,
                             empreendimento_id=emp.id,
                             categoria=item.origem_categoria)
        origem = CCOrigem(
            modulo    = item.origem_modulo,
            categoria = item.origem_categoria,
            descricao = item.origem_descricao,
            rota      = rota,
            label     = item.origem_label,
        )
        editavel = item.origem_modulo == "manual"

        # Valores conforme a origem
        v_orcado = v_contratado = v_executado = 0.0
        observacao = None

        if item.origem_modulo == "empreendimento":
            # Atualmente só 1.1 — valor_terreno
            if item.origem_categoria == "valor_terreno":
                v_orcado = v_contratado = v_executado = _f(emp.valor_terreno)
        elif item.origem_modulo == "financeiro":
            cat = item.origem_categoria or item.codigo
            v_orcado    = fin_orcado.get(cat, 0)
            v_contratado = v_orcado    # no financeiro, lançamento = contratado
            v_executado = fin_executado.get(cat, 0)
        elif item.origem_modulo == "orcamento":
            # Tag pode estar no codigo_composicao como 'cc:1.1' ou apenas '1.1'
            for tag in (f"cc:{item.codigo}", item.codigo):
                if tag in orc_orcado:
                    v_orcado = orc_orcado[tag]
                    v_contratado = v_orcado
                    break
            v_executado = orc_realizado.get(item.origem_categoria or "", 0)
        elif item.origem_modulo == "suprimentos":
            # Por enquanto, mesma lógica do financeiro
            cat = item.origem_categoria or item.codigo
            v_orcado    = fin_orcado.get(cat, 0)
            v_contratado = v_orcado
            v_executado = fin_executado.get(cat, 0)

        # Override / complemento: lançamento manual sempre vence
        manual = manuais_por_codigo.get(item.codigo)
        if manual:
            v_orcado     = _f(manual.valor_orcado)     or v_orcado
            v_contratado = _f(manual.valor_contratado) or v_contratado
            v_executado  = _f(manual.valor_executado)  or v_executado
            observacao   = manual.observacao

        saldo = v_orcado - v_executado
        perc_exec = (v_executado / v_orcado * 100) if v_orcado > 0 else 0
        perc_vgv  = (v_executado / vgv_total * 100) if vgv_total > 0 else 0

        custo_orcado_total += v_orcado

        cat_map[item.categoria_codigo].append(CCItemRead(
            codigo=item.codigo, nome=item.nome,
            origem=origem, editavel_inline=editavel,
            valor_orcado=v_orcado, valor_contratado=v_contratado,
            valor_executado=v_executado, saldo=saldo,
            perc_executado=perc_exec, perc_vgv=perc_vgv,
            observacao=observacao,
        ))

    # ── 4. Monta categorias com totais ──────────────────────────────────
    categorias_out: list[CCCategoriaRead] = []
    for cat in cats:
        itens = cat_map.get(cat.codigo, [])
        categorias_out.append(CCCategoriaRead(
            codigo=cat.codigo, nome=cat.nome, icone=cat.icone, itens=itens,
            total_orcado     = sum(i.valor_orcado    for i in itens),
            total_contratado = sum(i.valor_contratado for i in itens),
            total_executado  = sum(i.valor_executado  for i in itens),
            total_saldo      = sum(i.saldo            for i in itens),
        ))

    # ── 5. DRE da SPE ────────────────────────────────────────────────────
    impostos = sum(c.total_executado for c in categorias_out if c.codigo == "14.0")
    custos_diretos = sum(c.total_executado for c in categorias_out)
    receita_liquida = vgv_total - impostos
    lucro_bruto = receita_liquida - custos_diretos

    perc_61 = 100.0
    if tipo_obra == "parceria":
        # Convencional: 50% para Meeiro (MK), valor a refinar pelo cadastro
        perc_61 = 50.0

    dre = CCResumoDRE(
        vgv_total            = vgv_total,
        impostos_total       = impostos,
        receita_liquida      = receita_liquida,
        custos_diretos_total = custos_diretos,
        lucro_bruto_spe      = lucro_bruto,
        percentual_61_brasil = perc_61,
        resultado_61_brasil  = lucro_bruto * perc_61 / 100,
        margem_bruta_spe     = (lucro_bruto / vgv_total * 100) if vgv_total > 0 else 0,
        resultado_sobre_vgv  = (lucro_bruto * perc_61 / 100 / vgv_total * 100)
                                  if vgv_total > 0 else 0,
    )

    return CentroCustoResponse(
        obra_id=obra.id,
        obra_nome=obra.nome,
        empreendimento_id=emp.id,
        empreendimento_nome=emp.nome,
        tipo_obra=tipo_obra,
        parceiro=emp.parceiro,
        vgv_estimado=vgv_total or None,
        custo_orcado_total=custo_orcado_total,
        categorias=categorias_out,
        dre=dre,
    )


# ───────────────────────────────────────────────────────────────────────────
# PUT /obras/{obra_id}/centro-custo/{cc_item_codigo}
# ───────────────────────────────────────────────────────────────────────────
@router.put("/obras/{obra_id}/centro-custo/{cc_item_codigo}",
            status_code=status.HTTP_200_OK)
async def upsert_lancamento_manual(
    obra_id: uuid.UUID,
    cc_item_codigo: str,
    payload: CCLancamentoUpdate,
    db: DB, user: CurrentUser,
):
    """Upsert de um lançamento manual (somente itens com origem='manual'
    ou ajustes de itens linkados que ainda não foram registrados na origem)."""
    # Valida que o item existe no catálogo
    item = (await db.execute(
        select(CCItemCatalogo).where(CCItemCatalogo.codigo == cc_item_codigo)
    )).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail=f"Item CC {cc_item_codigo} não existe")

    # Valida obra
    obra = (await db.execute(
        select(Obra).where(Obra.id == obra_id, Obra.tenant_id == user.tenant_id)
    )).scalar_one_or_none()
    if not obra:
        raise HTTPException(status_code=404, detail="Obra não encontrada")

    # Upsert
    existing = (await db.execute(
        select(CCLancamentoObra).where(
            CCLancamentoObra.tenant_id == user.tenant_id,
            CCLancamentoObra.obra_id == obra_id,
            CCLancamentoObra.cc_item_codigo == cc_item_codigo,
        )
    )).scalar_one_or_none()

    if existing:
        existing.valor_orcado     = payload.valor_orcado
        existing.valor_contratado = payload.valor_contratado
        existing.valor_executado  = payload.valor_executado
        existing.observacao       = payload.observacao
    else:
        db.add(CCLancamentoObra(
            tenant_id=user.tenant_id,
            obra_id=obra_id,
            cc_item_codigo=cc_item_codigo,
            valor_orcado=payload.valor_orcado,
            valor_contratado=payload.valor_contratado,
            valor_executado=payload.valor_executado,
            observacao=payload.observacao,
        ))

    await db.commit()
    return {"ok": True, "cc_item_codigo": cc_item_codigo}


# ───────────────────────────────────────────────────────────────────────────
# DELETE /obras/{obra_id}/centro-custo/{cc_item_codigo}
# ───────────────────────────────────────────────────────────────────────────
@router.delete("/obras/{obra_id}/centro-custo/{cc_item_codigo}",
               status_code=status.HTTP_204_NO_CONTENT)
async def remover_lancamento_manual(
    obra_id: uuid.UUID, cc_item_codigo: str,
    db: DB, user: CurrentUser,
):
    row = (await db.execute(
        select(CCLancamentoObra).where(
            CCLancamentoObra.tenant_id == user.tenant_id,
            CCLancamentoObra.obra_id == obra_id,
            CCLancamentoObra.cc_item_codigo == cc_item_codigo,
        )
    )).scalar_one_or_none()
    if row:
        await db.delete(row)
        await db.commit()
