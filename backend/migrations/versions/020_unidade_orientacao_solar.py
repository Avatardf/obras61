"""020 – orientação solar da unidade (nascente/poente/ambas)

Revision ID: 020
Revises: 019
Create Date: 2026-06-25
"""
import sqlalchemy as sa
from alembic import op

revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("unidades", sa.Column("orientacao_solar", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("unidades", "orientacao_solar")
