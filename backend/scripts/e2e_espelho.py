#!/usr/bin/env python
"""Smoke test do módulo Espelho Digital — gera unidades, vende e confere resumo."""
import random
import sys
import time
from datetime import date

import requests

BASE = "https://app.61brasil.com.br/api/v1"
_s = int(time.time())
_d = lambda: random.randint(0, 9)
CNPJ = f"{_d()}{_d()}.{_d()}{_d()}{_d()}.{_d()}{_d()}{_d()}/0001-{_d()}{_d()}"
sess = requests.Session()


def main() -> int:
    r = sess.post(f"{BASE}/auth/registrar", json={
        "nome": "[E2E] Espelho", "cnpj": CNPJ, "nome_admin": "Bot",
        "email_admin": f"espelho.{_s}@example.com", "senha_admin": "espelho-1234",
    }, timeout=60)
    if r.status_code != 201:
        print("❌ registrar", r.status_code, r.text[:200]); return 1
    sess.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    print("✅ tenant registrado")

    emp = sess.post(f"{BASE}/empreendimentos", json={
        "nome": "[E2E] Loteamento Espelho", "tipo": "residencial_horizontal",
        "endereco": {"cidade": "Águas Lindas", "uf": "GO"}, "status": "viabilidade",
    }, timeout=60).json()
    emp_id = emp["id"]
    print(f"✅ empreendimento {emp_id[:8]}")

    # Gera 2 quadras
    g1 = sess.post(f"{BASE}/empreendimentos/{emp_id}/unidades/gerar", json={
        "grupo": "Quadra 1", "tipo": "lote", "quantidade": 12, "inicio": 1, "preco_tabela": 180000,
    }, timeout=60).json()
    g2 = sess.post(f"{BASE}/empreendimentos/{emp_id}/unidades/gerar", json={
        "grupo": "Quadra 2", "tipo": "lote", "quantidade": 8, "inicio": 1, "preco_tabela": 200000,
    }, timeout=60).json()
    print(f"✅ geradas {len(g1)+len(g2)} unidades (2 quadras)")

    # Vende 3, reserva 2
    for u in g1[:3]:
        sess.patch(f"{BASE}/unidades/{u['id']}", json={"status": "vendido", "valor_venda": 185000, "cliente_nome": "Cliente Teste"}, timeout=60)
    for u in g1[3:5]:
        sess.patch(f"{BASE}/unidades/{u['id']}", json={"status": "reservado"}, timeout=60)
    print("✅ 3 vendidas, 2 reservadas")

    # Resumo
    resumo = sess.get(f"{BASE}/empreendimentos/{emp_id}/unidades/resumo", timeout=60).json()
    print("📊 resumo:", resumo["por_status"], "| VGV vendido:", resumo["vgv_vendido"])
    ok = (resumo["total"] == 20 and resumo["por_status"]["vendido"] == 3
          and resumo["por_status"]["reservado"] == 2 and resumo["vgv_vendido"] == 555000.0)
    print("✅ resumo correto" if ok else "❌ resumo divergente")

    # Limpeza
    sess.delete(f"{BASE}/empreendimentos/{emp_id}", timeout=60)
    print("✅ limpeza (soft-delete)")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
