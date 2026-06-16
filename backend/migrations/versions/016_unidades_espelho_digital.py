"""016 – módulo de Unidades (espelho digital de venda)

Revision ID: 016
Revises: 015
Create Date: 2026-06-16
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "unidades",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("empreendimento_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("grupo", sa.String(60), nullable=False),
        sa.Column("identificador", sa.String(40), nullable=False),
        sa.Column("tipo", sa.String(30), nullable=True),
        sa.Column("pavimento", sa.Integer(), nullable=True),
        sa.Column("area_privativa_m2", sa.Numeric(10, 2), nullable=True),
        sa.Column("area_total_m2", sa.Numeric(10, 2), nullable=True),
        sa.Column("fracao_ideal", sa.Numeric(8, 6), nullable=True),
        sa.Column("preco_tabela", sa.Numeric(15, 2), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="disponivel", index=True),
        sa.Column("cliente_nome", sa.String(200), nullable=True),
        sa.Column("valor_venda", sa.Numeric(15, 2), nullable=True),
        sa.Column("data_venda", sa.Date(), nullable=True),
        sa.Column("observacao", sa.Text(), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["empreendimento_id"], ["empreendimentos.id"], ondelete="CASCADE"),
    )


def downgrade() -> None:
    op.drop_table("unidades")
