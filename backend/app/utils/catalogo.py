"""Carrega o catálogo de materiais (Excel) em memória com cache."""
from functools import lru_cache
from pathlib import Path

import openpyxl

CATALOGO_PATH = Path(__file__).parent.parent.parent / "data" / "catalogo_materiais.xlsx"


@lru_cache(maxsize=1)
def carregar_catalogo() -> list[dict]:
    """Lê o arquivo xlsx e devolve lista de dicts {codigo, descricao, unidade, familia}.
    Usa lru_cache para carregar apenas uma vez por processo."""
    if not CATALOGO_PATH.exists():
        return []

    wb = openpyxl.load_workbook(CATALOGO_PATH, data_only=True, read_only=True)
    ws = wb.active
    materiais: list[dict] = []

    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or len(row) < 2:
            continue
        codigo  = row[0]
        descricao = row[1]
        unidade = row[2] if len(row) > 2 else None
        familia = row[3] if len(row) > 3 else None

        if not descricao:
            continue

        materiais.append({
            "codigo":   str(codigo).strip()  if codigo   else None,
            "descricao": str(descricao).strip(),
            "unidade":  str(unidade).strip() if unidade  else "un",
            "familia":  str(familia).strip() if familia  else None,
        })

    wb.close()
    return materiais


def listar_familias() -> list[str]:
    """Retorna lista ordenada de famílias únicas."""
    catalogo = carregar_catalogo()
    familias = sorted({m["familia"] for m in catalogo if m["familia"]})
    return familias
