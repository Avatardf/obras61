"""
Simulação de cotação: REQ-0003 + 3 cotações (COT-0004/0005/0006)
com preços diferenciados por fornecedor para análise de melhor preço.
"""
import asyncio
import uuid
from datetime import date
from app.database import AsyncSessionLocal
from app.models.suprimentos import (
    Requisicao, StatusRequisicao, PrioridadeRequisicao,
    Cotacao, CotacaoItem, StatusCotacao,
)

TENANT = uuid.UUID("d646d8d5-f3ba-4564-ae0d-881a9a4f4eed")
FORN_CONSTRUFORT = uuid.UUID("19d5db9a-6a39-413b-8cc2-e13011ec5c42")
FORN_TOTAL       = uuid.UUID("f1eab022-a9fd-46c9-b94a-b8c03d6066cd")
FORN_HIDRO       = uuid.UUID("8bb46178-e8d5-4c10-a724-c6310b092197")

# 7 itens da requisicao
ITENS_REQ = [
    {"descricao": "Cimento CP II-E 50 kg",             "unidade": "SC",  "quantidade": 500},
    {"descricao": "Areia lavada media",                 "unidade": "M3",  "quantidade": 30},
    {"descricao": "Brita 1 (granulometria 9,5-25 mm)", "unidade": "M3",  "quantidade": 20},
    {"descricao": "Tijolo ceramico furado 9x14x19 cm", "unidade": "UN",  "quantidade": 5000},
    {"descricao": "Vergalhao CA-50 O10 mm",            "unidade": "KG",  "quantidade": 500},
    {"descricao": "Tela soldada Q-92",                  "unidade": "M2",  "quantidade": 50},
    {"descricao": "Cal hidratada CH-III 20 kg",        "unidade": "SC",  "quantidade": 100},
]

# Precos por fornecedor (None = nao cotou)
#
#  Item                    Construfort   Total Supr.   Hidrotecnica
#  -----------------------------------------------------------------
#  Cimento 50 kg SC         28,90 BEST    30,50         29,80
#  Areia media M3           89,00 BEST    95,00         92,00
#  Brita 1 M3              110,00        108,50        105,00 BEST
#  Tijolo 9x14x19 UN          0,65 BEST    0,72         (nao cota)
#  Vergalhao CA-50 KG         6,80          6,45 BEST    6,90
#  Tela soldada Q-92 M2      18,50         17,20 BEST   (nao cota)
#  Cal hidratada SC          15,90         16,50         14,80 BEST

PRECOS = {
    FORN_CONSTRUFORT: [28.90, 89.00, 110.00, 0.65, 6.80, 18.50, 15.90],
    FORN_TOTAL:       [30.50, 95.00, 108.50, 0.72, 6.45, 17.20, 16.50],
    FORN_HIDRO:       [29.80, 92.00, 105.00, None, 6.90, None,  14.80],
}

OBS_FORN = {
    FORN_CONSTRUFORT: (
        "Entrega inclusa para compras acima de R$ 5.000. "
        "Prazo de 5 dias uteis apos aprovacao. "
        "Cimento apenas marcas Votoran, Itambe e Caue."
    ),
    FORN_TOTAL: (
        "Frete por conta do comprador (FOB). "
        "Desconto de 2% para pagamento a vista. "
        "Vergalhao e tela soldada com certificado de qualidade."
    ),
    FORN_HIDRO: (
        "Cotamos apenas materiais da nossa linha (hidraulico/estrutural). "
        "Nao trabalhamos com tijolo ceramico nem tela soldada. "
        "Estoque disponivel — entrega em 3 dias uteis."
    ),
}

OBS_ITEM_HIDRO = {
    3: "Item nao disponivel em nosso catalogo (fora da linha de fornecimento)",
    5: "Item fora da linha de fornecimento — sugerimos consultar fornecedor especializado",
}


async def main():
    async with AsyncSessionLocal() as db:

        # ── 1. Cria REQ-0003 ──────────────────────────────────────────────────
        req = Requisicao(
            tenant_id=TENANT,
            numero="REQ-0003",
            obra_id=None,
            solicitante="Eng. Carlos Menezes",
            data_solicitacao=date(2025, 5, 20),
            data_entrega_prevista=date(2025, 6, 10),
            status=StatusRequisicao.em_cotacao,
            prioridade=PrioridadeRequisicao.normal,
            itens=ITENS_REQ,
            observacoes=(
                "Materiais necessarios para fundacao e alvenaria do Bloco B. "
                "Verificar qualidade do cimento (marcas aprovadas: Votoran, Itambe ou Caue). "
                "Brita deve ser de origem certificada. Entrega fracionada aceita."
            ),
        )
        db.add(req)
        await db.flush()
        print(f"REQ criada: {req.id} | {req.numero}")

        # ── 2. Cria as 3 cotacoes ──────────────────────────────────────────────
        cot_config = [
            (FORN_CONSTRUFORT, "COT-0004", "5 dias uteis apos aprovacao",      "30/60 dias",                         "CIF (incluso)"),
            (FORN_TOTAL,       "COT-0005", "7 a 10 dias uteis",                "A vista (2% desc.) ou 28 dias",      "FOB (por conta do comprador)"),
            (FORN_HIDRO,       "COT-0006", "3 dias uteis (estoque disponivel)", "A vista ou 30 dias",                 "CIF acima de R$ 3.000"),
        ]

        for forn_id, num, prazo, cond, frete in cot_config:
            precos = PRECOS[forn_id]
            itens_cot = []
            total = 0.0
            for idx, item_req in enumerate(ITENS_REQ):
                pu = precos[idx]
                if pu is None:
                    continue
                pt = round(pu * item_req["quantidade"], 2)
                total += pt
                obs_item = None
                if forn_id == FORN_HIDRO and idx in OBS_ITEM_HIDRO:
                    obs_item = OBS_ITEM_HIDRO[idx]
                itens_cot.append(CotacaoItem(
                    descricao=item_req["descricao"],
                    unidade=item_req["unidade"],
                    quantidade=item_req["quantidade"],
                    preco_unitario=pu,
                    preco_total=pt,
                    observacao=obs_item,
                ))

            cot = Cotacao(
                tenant_id=TENANT,
                numero=num,
                requisicao_id=req.id,
                fornecedor_id=forn_id,
                data_cotacao=date(2025, 5, 22),
                validade=date(2025, 6, 5),
                prazo_entrega=prazo,
                condicao_pagamento=cond,
                frete=frete,
                status=StatusCotacao.recebida,
                valor_total=round(total, 2),
                observacoes=OBS_FORN[forn_id],
            )
            for it in itens_cot:
                cot.itens.append(it)
            db.add(cot)
            print(f"COT criada: {num} | forn_id={forn_id} | {len(itens_cot)} itens | total=R$ {total:,.2f}")

        await db.commit()
        print("\n Simulacao inserida com sucesso!\n")

        # ── 3. Exibe comparativo ───────────────────────────────────────────────
        print("── COMPARATIVO DE PRECOS (R$/unidade) ────────────────────────────────────────")
        print(f"{'Item':<42} {'Un':>4} {'Construfort':>12} {'Total Supr.':>12} {'Hidrotecnica':>13}")
        print("-" * 85)
        for idx, item in enumerate(ITENS_REQ):
            c = PRECOS[FORN_CONSTRUFORT][idx]
            t = PRECOS[FORN_TOTAL][idx]
            h = PRECOS[FORN_HIDRO][idx]
            validos = [x for x in [c, t, h] if x is not None]
            melhor = min(validos)

            def fmt(v):
                if v is None:
                    return "       —    "
                tag = " *" if v == melhor else "  "
                return f"  {v:>8.2f}{tag}"

            print(f"  {item['descricao'][:40]:<40} {item['unidade']:>4} {fmt(c)} {fmt(t)} {fmt(h)}")

        total_c = sum(PRECOS[FORN_CONSTRUFORT][i] * ITENS_REQ[i]["quantidade"] for i in range(7))
        total_t = sum(PRECOS[FORN_TOTAL][i] * ITENS_REQ[i]["quantidade"] for i in range(7))
        total_h = sum(PRECOS[FORN_HIDRO][i] * ITENS_REQ[i]["quantidade"] for i in range(7) if PRECOS[FORN_HIDRO][i])

        otimo = (
            500 * 28.90 +   # cimento  -> Construfort
            30  * 89.00 +   # areia    -> Construfort
            20  * 105.00 +  # brita    -> Hidrotecnica
            5000 * 0.65 +   # tijolo   -> Construfort
            500 * 6.45  +   # vergalh  -> Total Suprimentos
            50  * 17.20 +   # tela     -> Total Suprimentos
            100 * 14.80     # cal      -> Hidrotecnica
        )

        print("-" * 85)
        print(f"\n  Total fornecedor unico:")
        print(f"    Construfort (7 itens):           R$ {total_c:>10,.2f}")
        print(f"    Total Suprimentos (7 itens):     R$ {total_t:>10,.2f}")
        print(f"    Hidrotecnica (5 itens apenas):   R$ {total_h:>10,.2f}")
        print(f"\n  Compra otima (melhor item a item): R$ {otimo:>10,.2f}")
        print(f"  Economia vs. tudo na Construfort:  R$ {total_c - otimo:>10,.2f}  ({(total_c-otimo)/total_c*100:.1f}%)")
        print(f"\n  Divisao otima:")
        print(f"    Construfort:      cimento + areia + tijolo")
        print(f"    Total Suprimentos: vergalhao + tela")
        print(f"    Hidrotecnica:      brita + cal")

asyncio.run(main())
