"""018 – datas de acompanhamento em documentos_status (início, prazo, conclusão)

Revision ID: 018
Revises: 017
Create Date: 2026-06-16
"""
import sqlalchemy as sa
from alembic import op

revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("documentos_status", sa.Column("data_inicio", sa.Date(), nullable=True))
    op.add_column("documentos_status", sa.Column("data_prazo", sa.Date(), nullable=True))
    op.add_column("documentos_status", sa.Column("data_conclusao", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("documentos_status", "data_conclusao")
    op.drop_column("documentos_status", "data_prazo")
    op.drop_column("documentos_status", "data_inicio")
