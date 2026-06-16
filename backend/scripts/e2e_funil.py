#!/usr/bin/env python
"""Smoke test do Funil de Vendas — lead percorre etapas; ao fechar, vende unidade."""
import random, sys, time
from datetime import date
import requests

BASE = "https://app.61brasil.com.br/api/v1"
_s = int(time.time())
_d = lambda: random.randint(0, 9)
CNPJ = f"{_d()}{_d()}.{_d()}{_d()}{_d()}.{_d()}{_d()}{_d()}/0001-{_d()}{_d()}"
sess = requests.Session()


def main() -> int:
    r = sess.post(f"{BASE}/auth/registrar", json={
        "nome": "[E2E] Funil", "cnpj": CNPJ, "nome_admin": "Bot",
        "email_admin": f"funil.{_s}@example.com", "senha_admin": "funil-1234",
    }, timeout=60)
    if r.status_code != 201:
        print("❌ registrar", r.status_code, r.text[:200]); return 1
    sess.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    print("✅ tenant registrado")

    emp = sess.post(f"{BASE}/empreendimentos", json={
        "nome": "[E2E] Funil Empreend", "tipo": "residencial_vertical",
        "endereco": {"cidade": "Águas Lindas", "uf": "GO"},
    }, timeout=60).json()
    emp_id = emp["id"]

    unidades = sess.post(f"{BASE}/empreendimentos/{emp_id}/unidades/gerar", json={
        "grupo": "Torre A", "tipo": "apartamento", "quantidade": 4, "inicio": 101, "preco_tabela": 300000,
    }, timeout=60).json()
    unid = unidades[0]
    print(f"✅ {len(unidades)} unidades, vinculando {unid['identificador']}")

    # Cria lead
    lead = sess.post(f"{BASE}/leads", json={
        "nome_cliente": "Maria E2E", "empreendimento_id": emp_id, "unidade_id": unid["id"],
        "valor": 310000, "responsavel": "Corretor Bot", "origem": "site", "etapa": "pre_atendimento",
    }, timeout=60).json()
    print("✅ lead criado em pré-atendimento")

    # Avança etapas até contrato
    for etapa in ["visita", "proposta", "contrato"]:
        sess.patch(f"{BASE}/leads/{lead['id']}", json={"etapa": etapa}, timeout=60)
    print("✅ lead avançado até contrato")

    # Verifica funil
    funil = sess.get(f"{BASE}/leads/funil", timeout=60).json()
    col_contrato = next(c for c in funil["colunas"] if c["etapa"] == "contrato")
    ok_funil = col_contrato["total"] == 1 and funil["valor_ganho"] == 310000.0
    print(f"📊 funil: contrato={col_contrato['total']} valor_ganho={funil['valor_ganho']}",
          "✅" if ok_funil else "❌")

    # Verifica que a unidade foi vendida automaticamente
    us = sess.get(f"{BASE}/empreendimentos/{emp_id}/unidades", timeout=60).json()
    u = next(x for x in us if x["id"] == unid["id"])
    ok_venda = u["status"] == "vendido" and u["cliente_nome"] == "Maria E2E" and float(u["valor_venda"]) == 310000.0
    print(f"📊 unidade {u['identificador']}: status={u['status']} cliente={u['cliente_nome']} valor={u['valor_venda']}",
          "✅" if ok_venda else "❌")

    # Distrato: volta o lead para "proposta" → unidade deve voltar a reservado
    sess.patch(f"{BASE}/leads/{lead['id']}", json={"etapa": "proposta"}, timeout=60)
    us2 = sess.get(f"{BASE}/empreendimentos/{emp_id}/unidades", timeout=60).json()
    u2 = next(x for x in us2 if x["id"] == unid["id"])
    ok_distrato = u2["status"] == "reservado" and u2["cliente_nome"] is None
    print(f"📊 distrato → unidade {u2['identificador']}: status={u2['status']}",
          "✅" if ok_distrato else "❌")

    sess.delete(f"{BASE}/empreendimentos/{emp_id}", timeout=60)
    print("✅ limpeza")
    return 0 if (ok_funil and ok_venda and ok_distrato) else 1


if __name__ == "__main__":
    sys.exit(main())
