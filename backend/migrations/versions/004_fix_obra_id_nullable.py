"""004 – torna obra_id nullable em requisicoes, ordens_compra, recebimentos

Revision ID: 004
Revises: 003
Create Date: 2026-05-23
"""
from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("requisicoes",   "obra_id", nullable=True, existing_type=sa.UUID(as_uuid=True))
    op.alter_column("ordens_compra", "obra_id", nullable=True, existing_type=sa.UUID(as_uuid=True))
    op.alter_column("recebimentos",  "obra_id", nullable=True, existing_type=sa.UUID(as_uuid=True))


def downgrade() -> None:
    op.alter_column("requisicoes",   "obra_id", nullable=False, existing_type=sa.UUID(as_uuid=True))
    op.alter_column("ordens_compra", "obra_id", nullable=False, existing_type=sa.UUID(as_uuid=True))
    op.alter_column("recebimentos",  "obra_id", nullable=False, existing_type=sa.UUID(as_uuid=True))
