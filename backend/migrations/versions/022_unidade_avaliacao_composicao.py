"""022 – valor de avaliação e composição de pagamento da unidade

valor_avaliacao: avaliação do banco (ex: Caixa), distinta do custo.
subsidio, fgts, recurso_proprio, valor_financiado: composição do pagamento
do comprador (bloco de negociação).

Revision ID: 022
Revises: 021
Create Date: 2026-09-25
"""
import sqlalchemy as sa
from alembic import op

revision = "022"
down_revision = "021"
branch_labels = None
depends_on = None

COLUNAS = ("valor_avaliacao", "subsidio", "fgts", "recurso_proprio", "valor_financiado")


def upgrade() -> None:
    for c in COLUNAS:
        op.add_column("unidades", sa.Column(c, sa.NUMERIC(15, 2), nullable=True))


def downgrade() -> None:
    for c in COLUNAS:
        op.drop_column("unidades", c)
