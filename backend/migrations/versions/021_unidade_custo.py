"""021 – custo da unidade (preço de custo individual, distinto de tabela e venda)

Revision ID: 021
Revises: 020
Create Date: 2026-06-25
"""
import sqlalchemy as sa
from alembic import op

revision = "021"
down_revision = "020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("unidades", sa.Column("custo", sa.NUMERIC(15, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("unidades", "custo")
