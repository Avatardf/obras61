#!/usr/bin/env python
"""
Auditoria estática de divergência entre modelos SQLAlchemy e migrations.

Encontra colunas que existem no modelo mas nunca foram criadas em nenhuma
migration — exatamente a classe de bug que causa
`UndefinedColumnError: column X does not exist` em produção.

Uso:  python scripts/audit_schema.py
Saída: lista por tabela das colunas faltantes (e órfãs).
Exit code 1 se houver colunas faltantes.
"""
import re
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
MODELS_DIR = BACKEND / "app" / "models"
MIGRATIONS_DIR = BACKEND / "migrations" / "versions"

# Colunas injetadas por mixins
MIXIN_COLS = {
    "TenantMixin": {"tenant_id"},
    "TimestampMixin": {"criado_em", "atualizado_em"},
}


def parse_models() -> dict[str, set[str]]:
    """tabela -> conjunto de colunas esperadas (a partir dos modelos)."""
    tables: dict[str, set[str]] = {}
    for path in MODELS_DIR.glob("*.py"):
        src = path.read_text(encoding="utf-8")
        # Divide em blocos de classe
        for m in re.finditer(
            r"class\s+(\w+)\s*\(([^)]*)\):(.*?)(?=\nclass\s|\Z)", src, re.S
        ):
            _cls, bases, body = m.groups()
            tn = re.search(r'__tablename__\s*=\s*"([^"]+)"', body)
            if not tn:
                continue
            table = tn.group(1)
            cols: set[str] = set()
            # Mixins
            for mixin, mcols in MIXIN_COLS.items():
                if mixin in bases:
                    cols |= mcols
            # Colunas: linhas `nome: Mapped[...] = mapped_column(...)`
            for cm in re.finditer(
                r"^\s*(\w+):\s*Mapped\[[^\]]*\]\s*=\s*mapped_column", body, re.M
            ):
                cols.add(cm.group(1))
            tables.setdefault(table, set()).update(cols)
    return tables


def _balanced_block(src: str, open_idx: int) -> str:
    """Dado o índice do '(' que abre create_table, retorna o conteúdo
    até o ')' que o fecha, respeitando parênteses aninhados e strings."""
    depth = 0
    i = open_idx
    while i < len(src):
        ch = src[i]
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                return src[open_idx + 1 : i]
        i += 1
    return src[open_idx + 1 :]


def parse_migrations() -> dict[str, set[str]]:
    """tabela -> conjunto de colunas efetivamente criadas pelas migrations."""
    tables: dict[str, set[str]] = {}
    # Processa em ordem de revisão (nome do arquivo começa com número)
    for path in sorted(MIGRATIONS_DIR.glob("*.py")):
        src = path.read_text(encoding="utf-8")
        # Considera apenas o corpo de upgrade() — downgrade() tem drop_column
        # que não reflete o estado final do schema.
        down = re.search(r"\ndef downgrade\(", src)
        if down:
            src = src[: down.start()]

        # create_table — usa balanceamento de parênteses (colunas multi-linha)
        for ct in re.finditer(r'create_table\(', src):
            open_idx = ct.end() - 1
            block = _balanced_block(src, open_idx)
            tn = re.match(r'\s*"([^"]+)"', block)
            if not tn:
                continue
            table = tn.group(1)
            cols = set(re.findall(r'sa\.Column\(\s*"([^"]+)"', block))
            tables.setdefault(table, set()).update(cols)

        # add_column("tabela", sa.Column("col", ...))
        for ac in re.finditer(
            r'add_column\(\s*"([^"]+)"\s*,\s*sa\.Column\(\s*"([^"]+)"', src
        ):
            table, col = ac.groups()
            tables.setdefault(table, set()).add(col)

        # alter_column("tabela", "antiga", new_column_name="nova")  → renomeia
        for al in re.finditer(
            r'alter_column\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*new_column_name\s*=\s*"([^"]+)"',
            src,
        ):
            table, antiga, nova = al.groups()
            if table in tables:
                tables[table].discard(antiga)
                tables[table].add(nova)

        # drop_column("tabela", "col")
        for dc in re.finditer(
            r'drop_column\(\s*"([^"]+)"\s*,\s*"([^"]+)"', src
        ):
            table, col = dc.groups()
            if table in tables:
                tables[table].discard(col)

    return tables


def main() -> int:
    modelos = parse_models()
    migracoes = parse_migrations()

    problemas = 0
    print("=" * 70)
    print("AUDITORIA DE SCHEMA — modelos SQLAlchemy × migrations")
    print("=" * 70)

    for tabela in sorted(modelos):
        esperadas = modelos[tabela]
        criadas = migracoes.get(tabela, set())
        faltando = esperadas - criadas

        if tabela not in migracoes:
            print(f"\n❌ TABELA SEM MIGRATION: {tabela}")
            print(f"   colunas no modelo: {sorted(esperadas)}")
            problemas += len(esperadas)
            continue

        if faltando:
            print(f"\n❌ {tabela}: {len(faltando)} coluna(s) faltando na migration")
            for c in sorted(faltando):
                print(f"      - {c}")
            problemas += len(faltando)

    # Tabelas em migration mas sem modelo (informativo)
    orfas = set(migracoes) - set(modelos)
    if orfas:
        print(f"\nℹ️  Tabelas em migration sem modelo (ok se forem catálogos/RLS): {sorted(orfas)}")

    print("\n" + "=" * 70)
    if problemas == 0:
        print("✅ NENHUMA divergência — todos os modelos têm migration completa.")
    else:
        print(f"❌ {problemas} coluna(s) faltando — geram erro 500 em produção.")
    print("=" * 70)
    return 1 if problemas else 0


if __name__ == "__main__":
    sys.exit(main())
