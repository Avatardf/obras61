"""023 – perfil de corretor

- papel_enum ganha o valor 'corretor'
- leads.responsavel_id: dono do lead (funil individual por corretor)
- unidades.corretor_id: quem está negociando a unidade (espelho coletivo,
  mas só o dono ou um admin altera)

Revision ID: 023
Revises: 022
Create Date: 2026-09-25
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "023"
down_revision = "022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE não pode rodar no meio de outra transação
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE papel_enum ADD VALUE IF NOT EXISTS 'corretor'")

    op.add_column("leads", sa.Column(
        "responsavel_id", postgresql.UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True))
    op.create_index("ix_leads_responsavel_id", "leads", ["responsavel_id"])

    op.add_column("unidades", sa.Column(
        "corretor_id", postgresql.UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True))


def downgrade() -> None:
    op.drop_column("unidades", "corretor_id")
    op.drop_index("ix_leads_responsavel_id", table_name="leads")
    op.drop_column("leads", "responsavel_id")
    # Remover valor de enum no Postgres exige recriar o tipo; mantido de propósito.
