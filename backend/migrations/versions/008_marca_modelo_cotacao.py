"""008 – adiciona campo marca_modelo em cotacao_itens

Revision ID: 008
Revises: 007
Create Date: 2026-05-25
"""
from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Marca/modelo do item cotado — diferencia fabricantes na hora de avaliar propostas
    op.add_column(
        "cotacao_itens",
        sa.Column("marca_modelo", sa.String(200), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("cotacao_itens", "marca_modelo")
