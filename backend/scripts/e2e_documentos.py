#!/usr/bin/env python
"""Smoke test do módulo Documentos reformulado — status, prazo e conclusão automática."""
import random, sys, time
from datetime import date
import requests

BASE = "https://app.61brasil.com.br/api/v1"
_s = int(time.time()); _d = lambda: random.randint(0, 9)
CNPJ = f"{_d()}{_d()}.{_d()}{_d()}{_d()}.{_d()}{_d()}{_d()}/0001-{_d()}{_d()}"
sess = requests.Session()


def main() -> int:
    r = sess.post(f"{BASE}/auth/registrar", json={
        "nome": "[E2E] Docs", "cnpj": CNPJ, "nome_admin": "Bot",
        "email_admin": f"docs.{_s}@example.com", "senha_admin": "docs-1234"}, timeout=60)
    if r.status_code != 201:
        print("❌ registrar", r.status_code, r.text[:200]); return 1
    sess.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    emp = sess.post(f"{BASE}/empreendimentos", json={
        "nome": "[E2E] Docs", "tipo": "residencial_vertical",
        "endereco": {"cidade": "X", "uf": "GO"}}, timeout=60).json()
    eid = emp["id"]
    print("✅ tenant + empreendimento")

    # Doc com prazo no passado (deve permitir; frontend marca vencido)
    sess.put(f"{BASE}/empreendimentos/{eid}/documentos/f1_escritura_compra_venda",
             json={"status": "em_andamento", "data_prazo": "2020-01-01", "observacoes": "protocolo 123"}, timeout=60)
    # Doc concluído sem data → backend registra hoje
    sess.put(f"{BASE}/empreendimentos/{eid}/documentos/f1_projetos",
             json={"status": "concluido"}, timeout=60)

    # Override de responsável (padrão da escritura é Cartório → muda p/ Isabel)
    sess.put(f"{BASE}/empreendimentos/{eid}/documentos/f1_escritura_compra_venda",
             json={"status": "em_andamento", "data_prazo": "2020-01-01", "responsavel": "Isabel"}, timeout=60)

    docs = sess.get(f"{BASE}/empreendimentos/{eid}/documentos", timeout=60).json()
    by = {d["doc_tipo"]: d for d in docs}
    d1 = by.get("f1_escritura_compra_venda", {})
    d2 = by.get("f1_projetos", {})
    ok_prazo = d1.get("data_prazo") == "2020-01-01" and d1.get("status") == "em_andamento"
    ok_resp = d1.get("responsavel") == "Isabel"
    ok_concl = d2.get("status") == "concluido" and d2.get("data_conclusao") == str(date.today())
    print(f"📄 escritura: status={d1.get('status')} prazo={d1.get('data_prazo')} resp={d1.get('responsavel')}", "✅" if (ok_prazo and ok_resp) else "❌")
    print(f"📄 projetos: status={d2.get('status')} conclusao={d2.get('data_conclusao')}", "✅" if ok_concl else "❌")

    sess.delete(f"{BASE}/empreendimentos/{eid}", timeout=60)
    print("✅ limpeza")
    return 0 if (ok_prazo and ok_resp and ok_concl) else 1


if __name__ == "__main__":
    sys.exit(main())
