"""019 – responsável customizável por documento (override do padrão do catálogo)

Revision ID: 019
Revises: 018
Create Date: 2026-06-23
"""
import sqlalchemy as sa
from alembic import op

revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("documentos_status", sa.Column("responsavel", sa.String(40), nullable=True))


def downgrade() -> None:
    op.drop_column("documentos_status", "responsavel")
