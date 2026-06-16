"""017 – módulo de Funil de Vendas (CRM / leads)

Revision ID: 017
Revises: 016
Create Date: 2026-06-16
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "leads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nome_cliente", sa.String(200), nullable=False),
        sa.Column("telefone", sa.String(30), nullable=True),
        sa.Column("email", sa.String(200), nullable=True),
        sa.Column("empreendimento_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("unidade_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("etapa", sa.String(20), nullable=False, server_default="pre_atendimento", index=True),
        sa.Column("valor", sa.Numeric(15, 2), nullable=True),
        sa.Column("responsavel", sa.String(120), nullable=True),
        sa.Column("origem", sa.String(40), nullable=True),
        sa.Column("observacoes", sa.Text(), nullable=True),
        sa.Column("data_entrada_etapa", sa.Date(), nullable=False, server_default=sa.func.current_date()),
        sa.Column("motivo_perda", sa.String(200), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["empreendimento_id"], ["empreendimentos.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["unidade_id"], ["unidades.id"], ondelete="SET NULL"),
    )


def downgrade() -> None:
    op.drop_table("leads")
