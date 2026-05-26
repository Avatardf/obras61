"""Cria tabela rdos

Revision ID: 002
Revises: 001
Create Date: 2025-05-22
"""
from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "rdos",
        sa.Column("id",            sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id",     sa.UUID(as_uuid=True), nullable=False),
        sa.Column("obra_id",       sa.UUID(as_uuid=True), sa.ForeignKey("obras.id"), nullable=False),
        sa.Column("data",          sa.Date,               nullable=False),
        sa.Column("clima_manha",   sa.String(20),         nullable=True),
        sa.Column("clima_tarde",   sa.String(20),         nullable=True),
        sa.Column("efetivo_total", sa.Integer,            nullable=True),
        sa.Column("equipes",       sa.JSON,               nullable=False, server_default="[]"),
        sa.Column("atividades",    sa.JSON,               nullable=False, server_default="[]"),
        sa.Column("ocorrencias",   sa.JSON,               nullable=False, server_default="[]"),
        sa.Column("observacoes",   sa.Text,               nullable=True),
        sa.Column("conteudo_ia",   sa.Text,               nullable=True),
        sa.Column("status",        sa.String(20),         nullable=False, server_default="rascunho"),
        sa.Column("criado_em",     sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now(),
                  onupdate=sa.func.now()),
    )

    op.create_index("ix_rdos_obra_id", "rdos", ["obra_id"])
    op.create_index("ix_rdos_data",    "rdos", ["data"])
    op.create_index("ix_rdos_tenant",  "rdos", ["tenant_id"])

    # Habilita RLS
    op.execute("ALTER TABLE rdos ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY rdos_tenant_isolation ON rdos
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS rdos_tenant_isolation ON rdos;")
    op.drop_table("rdos")
