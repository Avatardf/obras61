#!/usr/bin/env python
"""
Teste E2E (smoke) contra a API de produção — exercita o ciclo completo
de um empreendimento, do cadastro à conclusão e venda, tocando cada módulo.

Cria dados com prefixo [E2E] e faz soft-delete no final.
Uso:  python scripts/e2e_smoke.py
"""
import random
import sys
import time
from datetime import date, timedelta

import requests

BASE = "https://app.61brasil.com.br/api/v1"

# Tenant isolado e descartável criado via signup público — não toca dados reais.
_sufixo = int(time.time())
_d = lambda: random.randint(0, 9)
CNPJ = f"{_d()}{_d()}.{_d()}{_d()}{_d()}.{_d()}{_d()}{_d()}/0001-{_d()}{_d()}"
EMAIL = f"e2e.{_sufixo}@example.com"
SENHA = "e2e-teste-1234"

sess = requests.Session()
resultados: list[tuple[str, bool, str]] = []


def passo(nome: str, ok: bool, detalhe: str = "") -> None:
    resultados.append((nome, ok, detalhe))
    icone = "✅" if ok else "❌"
    print(f"{icone} {nome}" + (f"  → {detalhe}" if detalhe else ""))


def req(metodo: str, caminho: str, esperado=(200, 201), **kw):
    url = f"{BASE}{caminho}"
    try:
        r = sess.request(metodo, url, timeout=60, **kw)
    except Exception as e:
        return None, f"EXCEÇÃO {type(e).__name__}: {e}"
    if r.status_code not in esperado:
        corpo = r.text[:160].replace("\n", " ")
        return None, f"HTTP {r.status_code}: {corpo}"
    try:
        return r.json(), ""
    except Exception:
        return {}, ""


def main() -> int:
    # ── 1. Registrar tenant de teste isolado ───────────────────────────────────
    data, err = req("POST", "/auth/registrar", json={
        "nome": "[E2E] Construtora Teste",
        "cnpj": CNPJ,
        "nome_admin": "E2E Bot",
        "email_admin": EMAIL,
        "senha_admin": SENHA,
    })
    if not data:
        passo("Registrar tenant isolado", False, err)
        return 1
    token = data["access_token"]
    sess.headers["Authorization"] = f"Bearer {token}"
    passo("Registrar tenant isolado (signup)", True, f"papel={data['user']['papel']}")

    # ── 2. Dashboard ───────────────────────────────────────────────────────────
    _, err = req("GET", "/dashboard")
    passo("Dashboard", not err, err)

    # ── 3. Criar empreendimento ────────────────────────────────────────────────
    emp_payload = {
        "nome": "[E2E] Residencial Teste Automatizado",
        "tipo": "residencial_vertical",
        "endereco": {"cidade": "Águas Lindas", "uf": "GO", "bairro": "Centro"},
        "vgv_previsto": 12_000_000,
        "status": "estudo",
        "num_unidades": 8,
        "area_terreno_m2": 400,
        "valor_terreno": 800_000,
        "padrao_construtivo": "normal",
        "metragem_media_unidade": 50,
        "num_pavimentos_estimado": 2,
    }
    emp, err = req("POST", "/empreendimentos", json=emp_payload)
    if not emp:
        passo("Criar empreendimento", False, err)
        return 1
    emp_id = emp["id"]
    passo("Criar empreendimento", True, f"id={emp_id[:8]}")

    # ── 4. Estimativa de custos IA (tabela estimativas_custo da migration 015) ──
    est, err = req("POST", f"/empreendimentos/{emp_id}/estimativas", esperado=(200, 201, 500, 502, 504))
    if est and "id" in est:
        passo("Estimativa de Custos IA", True, f"custo_total={est.get('custo_total')}")
    else:
        # Pode falhar por timeout do Gemini — registra mas não bloqueia
        passo("Estimativa de Custos IA", False, err or "sem retorno (timeout Gemini?)")

    # ── 5. Criar obra com etapas padrão ────────────────────────────────────────
    obra_payload = {
        "nome": "[E2E] Torre Única",
        "area_construida_m2": 1200,
        "numero_pavimentos": 2,
        "numero_unidades": 8,
        "status": "planejamento",
        "data_inicio": str(date.today()),
        "data_prevista_termino": str(date.today() + timedelta(days=540)),
        "usar_etapas_padrao": True,
    }
    obra, err = req("POST", f"/empreendimentos/{emp_id}/obras", json=obra_payload)
    if not obra:
        passo("Criar obra (+ etapas padrão)", False, err)
        return 1
    obra_id = obra["id"]
    passo("Criar obra (+ etapas padrão)", True, f"id={obra_id[:8]}")

    # ── 6. Listar etapas e avançar uma ─────────────────────────────────────────
    detalhe, err = req("GET", f"/obras/{obra_id}")
    etapas = (detalhe or {}).get("etapas", [])
    passo("Obra tem etapas padrão", len(etapas) > 0, f"{len(etapas)} etapas")
    if etapas:
        et_id = etapas[0]["id"]
        _, err = req("PATCH", f"/etapas/{et_id}", json={"percentual_realizado": 100, "status": "concluida"})
        passo("Avançar etapa (Fundação 100%)", not err, err)

    # ── 7. Orçamento + item ─────────────────────────────────────────────────────
    orc, err = req("POST", f"/obras/{obra_id}/orcamentos",
                   json={"descricao": "[E2E] Orçamento base", "bdi_percentual": 25, "base_referencia": "sinapi", "uf_referencia": "GO"})
    if orc:
        orc_id = orc["id"]
        passo("Criar orçamento", True, f"id={orc_id[:8]}")
        _, err = req("POST", f"/orcamentos/{orc_id}/itens",
                     json={"descricao": "Concreto usinado fck 25", "unidade": "m3", "quantidade": 80, "custo_unitario": 420, "origem_preco": "sinapi"})
        passo("Adicionar item ao orçamento", not err, err)
    else:
        passo("Criar orçamento", False, err)

    # ── 8. RDO ──────────────────────────────────────────────────────────────────
    rdo, err = req("POST", f"/obras/{obra_id}/rdos",
                   json={"data": str(date.today()), "clima_manha": "ensolarado", "clima_tarde": "nublado",
                         "efetivo_total": 12, "equipes": [{"funcao": "Pedreiro", "quantidade": 6}],
                         "atividades": ["Concretagem da fundação"], "observacoes": "[E2E] teste"})
    passo("Criar RDO", bool(rdo), err)

    # ── 9. Financeiro: despesa (com forma_pagamento) + receita de venda ────────
    desp, err = req("POST", "/financeiro",
                    json={"obra_id": obra_id, "tipo": "despesa", "categoria": "material",
                          "descricao": "[E2E] Compra de cimento", "valor": 33_600,
                          "data_vencimento": str(date.today()), "status": "pago",
                          "forma_pagamento": "PIX"})
    passo("Lançamento despesa (forma_pagamento)", bool(desp), err)
    rec, err = req("POST", "/financeiro",
                   json={"obra_id": obra_id, "tipo": "receita", "categoria": "receita_venda",
                         "descricao": "[E2E] Venda unidade 101", "valor": 1_500_000,
                         "data_vencimento": str(date.today()), "status": "previsto"})
    passo("Lançamento receita de venda", bool(rec), err)

    # ── 10. Suprimentos: fornecedor + requisição ───────────────────────────────
    forn, err = req("POST", "/fornecedores",
                    json={"nome": "[E2E] Fornecedor Materiais Ltda", "categoria": "material", "uf": "GO"})
    passo("Criar fornecedor", bool(forn), err)
    rq, err = req("POST", "/requisicoes",
                  json={"obra_id": obra_id, "solicitante": "E2E Bot", "data_solicitacao": str(date.today()),
                        "prioridade": "normal", "observacoes": "[E2E] Requisição de aço",
                        "itens": [{"descricao": "Aço CA-50 10mm", "unidade": "kg", "quantidade": 500}]})
    passo("Criar requisição", bool(rq and "id" in rq), err)

    # ── 11. Equipes: colaborador + equipe ──────────────────────────────────────
    colab, err = req("POST", "/colaboradores",
                     json={"nome": "[E2E] José Pereira", "funcao": "Pedreiro", "tipo_vinculo": "proprio", "custo_diaria": 180})
    passo("Criar colaborador", bool(colab), err)
    eq, err = req("POST", "/equipes", json={"nome": "[E2E] Equipe Estrutura"})
    passo("Criar equipe", bool(eq), err)
    if eq and colab:
        _, err = req("POST", f"/equipes/{eq['id']}/alocacoes",
                     json={"obra_id": obra_id, "data_inicio": str(date.today())})
        passo("Alocar equipe à obra", not err, err)

    # ── 12. Documentos: atualizar status de um doc ─────────────────────────────
    _, err = req("PUT", f"/empreendimentos/{emp_id}/documentos/alvara_construcao",
                 json={"status": "concluido"})
    passo("Atualizar status documental", not err, err)

    # ── 13. Centro de custo ────────────────────────────────────────────────────
    _, err = req("GET", f"/obras/{obra_id}/centro-custo")
    passo("Consultar centro de custo", not err, err)

    # ── 14. Conclusão e venda ──────────────────────────────────────────────────
    _, err = req("PATCH", f"/obras/{obra_id}", json={"status": "concluida"})
    passo("Concluir obra", not err, err)
    _, err = req("PATCH", f"/empreendimentos/{emp_id}", json={"status": "entregue"})
    passo("Empreendimento → entregue (venda)", not err, err)

    # ── 15. Limpeza (soft delete) ──────────────────────────────────────────────
    _, err = req("DELETE", f"/empreendimentos/{emp_id}", esperado=(200, 204))
    passo("Soft-delete do empreendimento de teste", not err, err)

    # ── Resumo ──────────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    ok = sum(1 for _, o, _ in resultados if o)
    print(f"RESULTADO: {ok}/{len(resultados)} passos OK")
    falhas = [n for n, o, _ in resultados if not o]
    if falhas:
        print("Falhas:", ", ".join(falhas))
    print("=" * 60)
    return 0 if ok == len(resultados) else 1


if __name__ == "__main__":
    sys.exit(main())
