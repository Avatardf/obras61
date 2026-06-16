"""014 – colunas de datas em obras e campos de Gantt em etapas

Revision ID: 014
Revises: 013
Create Date: 2026-06-12
"""
import sqlalchemy as sa
from alembic import op

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("obras", sa.Column("data_inicio", sa.Date(), nullable=True))
    op.add_column("obras", sa.Column("data_prevista_termino", sa.Date(), nullable=True))

    op.add_column("etapas", sa.Column("mes_inicio", sa.Integer(), nullable=True))
    op.add_column("etapas", sa.Column("duracao_meses", sa.Integer(), nullable=True, server_default="2"))
    op.add_column("etapas", sa.Column("percentual_planejado", sa.Numeric(5, 2), nullable=False, server_default="0"))
    op.add_column("etapas", sa.Column("percentual_realizado", sa.Numeric(5, 2), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("etapas", "percentual_realizado")
    op.drop_column("etapas", "percentual_planejado")
    op.drop_column("etapas", "duracao_meses")
    op.drop_column("etapas", "mes_inicio")
    op.drop_column("obras", "data_prevista_termino")
    op.drop_column("obras", "data_inicio")
