"""011 – renomeia created_at/updated_at para criado_em/atualizado_em em documentos_status

Revision ID: 011
Revises: 010
Create Date: 2026-06-02
"""
from alembic import op

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("documentos_status", "created_at", new_column_name="criado_em")
    op.alter_column("documentos_status", "updated_at", new_column_name="atualizado_em")


def downgrade() -> None:
    op.alter_column("documentos_status", "criado_em",    new_column_name="created_at")
    op.alter_column("documentos_status", "atualizado_em", new_column_name="updated_at")
