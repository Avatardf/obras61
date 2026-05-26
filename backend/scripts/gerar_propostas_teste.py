"""
Script: gerar_propostas_teste.py
Gera 3 PDFs de propostas de cotação de empresas fictícias para teste.
Os PDFs ficam em: backend/data/propostas_teste/

Uso: docker exec obras-backend-1 python scripts/gerar_propostas_teste.py
"""
from __future__ import annotations
import os
import sys
from pathlib import Path
from fpdf import FPDF
from fpdf.enums import XPos, YPos
import datetime

OUT_DIR = Path(__file__).parent.parent / "data" / "propostas_teste"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Itens da requisição REQ-0001 (subconjunto representativo) ─────────────────
# Cada fornecedor cotará um subconjunto diferente, com preços distintos
TODOS_ITENS = [
    {"descricao": 'Abraçadeira econômica 2"',        "unidade": "un",  "quantidade": 100},
    {"descricao": 'Abraçadeira econômica 3/4"',       "unidade": "un",  "quantidade": 200},
    {"descricao": 'Abraçadeira econômica 1 1/2"',     "unidade": "un",  "quantidade": 150},
    {"descricao": 'Abraçadeira econômica 1/2"',       "unidade": "un",  "quantidade": 300},
    {"descricao": 'Abraçadeira econômica 1"',         "unidade": "un",  "quantidade": 250},
    {"descricao": "Cano PVC rígido 100mm x 6m",       "unidade": "barra","quantidade": 40},
    {"descricao": "Cano PVC rígido 75mm x 6m",        "unidade": "barra","quantidade": 30},
    {"descricao": "Cano PVC rígido 50mm x 6m",        "unidade": "barra","quantidade": 25},
    {"descricao": "Joelho PVC 90° 100mm",              "unidade": "un",  "quantidade": 20},
    {"descricao": "Joelho PVC 90° 75mm",               "unidade": "un",  "quantidade": 15},
    {"descricao": "Luva de correr PVC 100mm",          "unidade": "un",  "quantidade": 10},
    {"descricao": "Luva de correr PVC 75mm",           "unidade": "un",  "quantidade": 8},
    {"descricao": "Registro gaveta bronze 1\"",        "unidade": "un",  "quantidade": 5},
    {"descricao": "Registro gaveta bronze 3/4\"",      "unidade": "un",  "quantidade": 8},
    {"descricao": "Fita veda-rosca 18mm x 50m",        "unidade": "rl",  "quantidade": 20},
    {"descricao": "Selante de silicone incolor 280ml", "unidade": "cx",  "quantidade": 12},
    {"descricao": "Parafuso sextavado M8x50 zincado",  "unidade": "cx",  "quantidade": 10},
    {"descricao": "Parafuso sextavado M6x30 zincado",  "unidade": "cx",  "quantidade": 15},
    {"descricao": "Porca sextavada M8 zincada",        "unidade": "cx",  "quantidade": 10},
    {"descricao": "Arruela lisa M8 zincada",           "unidade": "cx",  "quantidade": 10},
]

# ── Definição dos fornecedores e suas coberturas ───────────────────────────────
FORNECEDORES = [
    {
        "nome":     "Hidrotécnica Norte Ltda.",
        "cnpj":     "12.345.678/0001-90",
        "endereco": "Rua das Indústrias, 450 - Galpão 7 - Belém / PA",
        "fone":     "(91) 3245-6789",
        "email":    "comercial@hidrotecnicanorte.com.br",
        "vendedor": "Carlos Mendonça",
        "cor":      (0, 82, 165),      # azul marinho
        "validade": "30 dias",
        "pagamento":"30 dias após entrega",
        "frete":    "CIF para pedidos acima de R$ 2.000",
        "prazo":    "10 dias úteis",
        # Cobre itens 0-11 (abraçadeiras + canos + conexões PVC)
        "itens_idx": list(range(12)),
        "precos": {
            0: 1.18, 1: 0.72, 2: 0.95, 3: 0.58, 4: 0.82,
            5: 48.50, 6: 38.90, 7: 29.70,
            8: 3.20, 9: 2.80, 10: 4.90, 11: 3.60,
        },
        "arquivo": "proposta_hidrotecnica_norte.pdf",
    },
    {
        "nome":     "Construfort Materiais S.A.",
        "cnpj":     "56.789.012/0001-34",
        "endereco": "Av. Paulista, 2100 - Conj. 82 - São Paulo / SP",
        "fone":     "(11) 4002-8922",
        "email":    "cotacoes@construfort.com.br",
        "vendedor": "Priscila Andrade",
        "cor":      (34, 139, 34),     # verde
        "validade": "15 dias",
        "pagamento":"À vista com 3% de desconto ou 30/60 dias",
        "frete":    "FOB - frete por conta do comprador",
        "prazo":    "7 dias úteis",
        # Cobre itens 5-19 (canos, conexões, registros, fixação, vedação)
        "itens_idx": list(range(5, 20)),
        "precos": {
            5: 51.20, 6: 41.00, 7: 31.50,
            8: 3.10, 9: 2.70, 10: 5.20, 11: 3.90,
            12: 89.00, 13: 62.00, 14: 4.50,
            15: 7.80, 16: 15.90, 17: 12.40, 18: 8.20, 19: 5.60,
        },
        "arquivo": "proposta_construfort.pdf",
    },
    {
        "nome":     "Total Suprimentos e Distribuição Ltda.",
        "cnpj":     "98.765.432/0001-11",
        "endereco": "Rodovia BR-101 km 235, Galpão Industrial 3 - Vitória / ES",
        "fone":     "(27) 3388-5500",
        "email":    "vendas@totalsuprimentos.ind.br",
        "vendedor": "Roberto Figueiredo",
        "cor":      (153, 0, 51),      # vermelho escuro
        "validade": "45 dias",
        "pagamento":"28/56/84 dias (boleto bancário)",
        "frete":    "CIF para todo o Brasil",
        "prazo":    "14 dias úteis",
        # Cobre TODOS os itens (fornecedor completo - preços ligeiramente superiores)
        "itens_idx": list(range(20)),
        "precos": {
            0: 1.25, 1: 0.78, 2: 1.02, 3: 0.62, 4: 0.88,
            5: 52.90, 6: 42.50, 7: 32.80,
            8: 3.35, 9: 2.95, 10: 5.10, 11: 3.75,
            12: 91.50, 13: 64.00, 14: 4.70,
            15: 8.20, 16: 16.50, 17: 12.90, 18: 8.70, 19: 5.90,
        },
        "arquivo": "proposta_total_suprimentos.pdf",
    },
]


def cor_hex(rgb: tuple) -> str:
    return "#{:02X}{:02X}{:02X}".format(*rgb)


def gerar_pdf_proposta(forn: dict) -> bytes:
    """Gera um PDF realista de proposta comercial para o fornecedor dado."""
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()
    pdf.set_margins(left=15, top=15, right=15)

    hoje = datetime.date.today().strftime("%d/%m/%Y")
    r, g, b = forn["cor"]

    # ── Cabeçalho ────────────────────────────────────────────────────────────
    # Barra colorida superior
    pdf.set_fill_color(r, g, b)
    pdf.rect(0, 0, 210, 22, "F")

    pdf.set_xy(15, 5)
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(130, 10, forn["nome"].upper(), new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.set_xy(15, 14)
    pdf.set_font("Helvetica", "", 8)
    pdf.cell(130, 5, f"CNPJ: {forn['cnpj']}   |   {forn['endereco']}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    # Caixa "PROPOSTA COMERCIAL"
    pdf.set_xy(150, 6)
    pdf.set_fill_color(255, 255, 255)
    pdf.set_text_color(r, g, b)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(45, 8, "PROPOSTA COMERCIAL", border=0, align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    # Linha de informações de contato
    pdf.set_xy(0, 22)
    pdf.set_fill_color(r, g, b)
    r2, g2, b2 = min(r+40,255), min(g+40,255), min(b+40,255)
    pdf.set_fill_color(r2, g2, b2)
    pdf.rect(0, 22, 210, 8, "F")
    pdf.set_xy(15, 24)
    pdf.set_font("Helvetica", "", 7.5)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(90, 4, f"Fone: {forn['fone']}   |   E-mail: {forn['email']}", new_x=XPos.RIGHT, new_y=YPos.TOP)
    pdf.cell(90, 4, f"Vendedor: {forn['vendedor']}", align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.set_text_color(0, 0, 0)
    pdf.set_xy(15, 34)

    # ── Dados da proposta ─────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(240, 240, 240)
    pdf.cell(180, 7, " DADOS DA PROPOSTA", border=1, fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("Helvetica", "", 8.5)

    dados = [
        ("Data de Emissão:", hoje, "Validade da Proposta:", forn["validade"]),
        ("Condição de Pagamento:", forn["pagamento"], "Prazo de Entrega:", forn["prazo"]),
        ("Frete:", forn["frete"], "", ""),
    ]
    for row in dados:
        pdf.set_x(15)
        pdf.set_font("Helvetica", "B", 8.5)
        pdf.cell(35, 6, row[0], new_x=XPos.RIGHT, new_y=YPos.TOP)
        pdf.set_font("Helvetica", "", 8.5)
        pdf.cell(55, 6, row[1], new_x=XPos.RIGHT, new_y=YPos.TOP)
        pdf.set_font("Helvetica", "B", 8.5)
        pdf.cell(35, 6, row[2], new_x=XPos.RIGHT, new_y=YPos.TOP)
        pdf.set_font("Helvetica", "", 8.5)
        pdf.cell(55, 6, row[3], new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.ln(3)

    # ── Título tabela ──────────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(r, g, b)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(180, 7, "  ITENS COTADOS", border=0, fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(0, 0, 0)

    # Cabeçalho da tabela
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_fill_color(230, 230, 230)
    col_w = [8, 85, 15, 22, 25, 25]
    headers = ["#", "DESCRIÇÃO DO MATERIAL / SERVIÇO", "UN", "QTD", "VL. UNIT. (R$)", "VL. TOTAL (R$)"]
    aligns = ["C", "L", "C", "C", "R", "R"]
    for w, h, a in zip(col_w, headers, aligns):
        pdf.cell(w, 6, h, border=1, align=a, fill=True, new_x=XPos.RIGHT, new_y=YPos.TOP)
    pdf.ln()

    # Linhas
    pdf.set_font("Helvetica", "", 8)
    total_geral = 0.0
    for num, idx in enumerate(forn["itens_idx"], start=1):
        item = TODOS_ITENS[idx]
        preco = forn["precos"].get(idx, 0.0)
        total = item["quantidade"] * preco
        total_geral += total

        fill = (num % 2 == 0)
        bg = (248, 248, 248) if fill else (255, 255, 255)
        pdf.set_fill_color(*bg)

        pdf.cell(col_w[0], 5.5, str(num), border=1, align="C", fill=fill, new_x=XPos.RIGHT, new_y=YPos.TOP)
        pdf.cell(col_w[1], 5.5, item["descricao"][:55], border=1, align="L", fill=fill, new_x=XPos.RIGHT, new_y=YPos.TOP)
        pdf.cell(col_w[2], 5.5, item["unidade"], border=1, align="C", fill=fill, new_x=XPos.RIGHT, new_y=YPos.TOP)
        pdf.cell(col_w[3], 5.5, f"{item['quantidade']:,.0f}".replace(",","."), border=1, align="C", fill=fill, new_x=XPos.RIGHT, new_y=YPos.TOP)
        pdf.cell(col_w[4], 5.5, f"{preco:,.2f}".replace(",","X").replace(".",",").replace("X","."), border=1, align="R", fill=fill, new_x=XPos.RIGHT, new_y=YPos.TOP)
        pdf.cell(col_w[5], 5.5, f"{total:,.2f}".replace(",","X").replace(".",",").replace("X","."), border=1, align="R", fill=fill, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    # Linha de total
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(r, g, b)
    pdf.set_text_color(255, 255, 255)
    subtotal_w = sum(col_w[:5])
    pdf.cell(subtotal_w, 7, "VALOR TOTAL DA PROPOSTA", border=1, align="R", fill=True, new_x=XPos.RIGHT, new_y=YPos.TOP)
    pdf.cell(col_w[5], 7, f"R$ {total_geral:,.2f}".replace(",","X").replace(".",",").replace("X","."), border=1, align="R", fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(0, 0, 0)

    pdf.ln(5)

    # ── Observações ────────────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 8.5)
    pdf.set_fill_color(240, 240, 240)
    pdf.cell(180, 6, " OBSERVAÇÕES E CONDIÇÕES GERAIS", border=1, fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("Helvetica", "", 7.5)
    obs_lines = [
        f"* Os preços acima são válidos por {forn['validade']} a partir da data de emissão.",
        f"* Frete: {forn['frete']}.",
        f"* Prazo de entrega: {forn['prazo']} após confirmação do pedido.",
        f"* Condição de pagamento: {forn['pagamento']}.",
        "* Em caso de divergência entre quantidade solicitada e disponível em estoque, entraremos em contato.",
        "* Preços sujeitos a alteração sem aviso prévio após o prazo de validade.",
    ]
    for obs in obs_lines:
        pdf.set_x(15)
        pdf.multi_cell(180, 4.5, obs, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    # ── Assinatura ─────────────────────────────────────────────────────────────
    pdf.ln(8)
    pdf.set_x(15)
    pdf.set_draw_color(r, g, b)
    pdf.set_line_width(0.5)
    pdf.line(15, pdf.get_y(), 90, pdf.get_y())
    pdf.line(120, pdf.get_y(), 195, pdf.get_y())
    pdf.ln(2)
    pdf.set_font("Helvetica", "", 7.5)
    pdf.set_x(15)
    pdf.cell(75, 4, f"Assinatura - {forn['vendedor']}", align="C", new_x=XPos.RIGHT, new_y=YPos.TOP)
    pdf.set_x(120)
    pdf.cell(75, 4, "Carimbo da Empresa", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    # ── Rodapé ─────────────────────────────────────────────────────────────────
    pdf.set_y(-18)
    pdf.set_fill_color(r, g, b)
    pdf.set_draw_color(r, g, b)
    pdf.rect(0, pdf.get_y(), 210, 18, "F")
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(255, 255, 255)
    pdf.set_x(15)
    pdf.cell(180, 6, f"{forn['nome']}  |  CNPJ: {forn['cnpj']}  |  {forn['email']}  |  Emitido em: {hoje}", align="C")

    return pdf.output()


def main():
    print("=" * 60)
    print("Gerando propostas de teste...")
    print("=" * 60)
    for forn in FORNECEDORES:
        path = OUT_DIR / forn["arquivo"]
        pdf_bytes = gerar_pdf_proposta(forn)
        path.write_bytes(pdf_bytes)
        n_itens = len(forn["itens_idx"])
        total = sum(
            TODOS_ITENS[idx]["quantidade"] * forn["precos"].get(idx, 0)
            for idx in forn["itens_idx"]
        )
        print(f"✅  {forn['arquivo']}")
        print(f"    Empresa : {forn['nome']}")
        print(f"    Itens   : {n_itens} de {len(TODOS_ITENS)}")
        print(f"    Total   : R$ {total:,.2f}")
        print()

    print(f"PDFs salvos em: {OUT_DIR}")
    print()
    print("Para usar no teste:")
    print("  1. Faça login em http://localhost:5173")
    print("  2. Vá em Suprimentos → Cotações → Nova Cotação")
    print("  3. Faça upload de um dos PDFs gerados")
    print("  4. Clique em 'Extrair Itens' e revise os dados")
    print()
    print("Fornecedores a cadastrar no sistema:")
    for f in FORNECEDORES:
        print(f"  * {f['nome']} - {f['cnpj']} - {f['email']}")


if __name__ == "__main__":
    main()
