"""006 – cria tabelas cotacoes e cotacao_itens

Revision ID: 006
Revises: 005
Create Date: 2026-05-23
"""
from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── cotacoes ──────────────────────────────────────────────────────────────
    op.create_table(
        "cotacoes",
        sa.Column("id",                sa.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id",         sa.UUID(as_uuid=True), nullable=False),
        sa.Column("numero",            sa.String(20),  nullable=False),
        sa.Column("requisicao_id",     sa.UUID(as_uuid=True), nullable=True),
        sa.Column("fornecedor_id",     sa.UUID(as_uuid=True), nullable=True),
        sa.Column("data_cotacao",      sa.Date(), nullable=False),
        sa.Column("validade",          sa.Date(), nullable=True),
        sa.Column("prazo_entrega",     sa.String(200), nullable=True),
        sa.Column("condicao_pagamento",sa.String(200), nullable=True),
        sa.Column("frete",             sa.String(100), nullable=True),
        sa.Column("status",            sa.String(20), nullable=False, server_default="recebida"),
        sa.Column("valor_total",       sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("observacoes",       sa.Text(), nullable=True),
        sa.Column("criado_em",         sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("atualizado_em",     sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"],     ["tenants.id"]),
        sa.ForeignKeyConstraint(["requisicao_id"], ["requisicoes.id"]),
        sa.ForeignKeyConstraint(["fornecedor_id"], ["fornecedores.id"]),
    )
    op.create_index("ix_cotacoes_tenant",     "cotacoes", ["tenant_id"])
    op.create_index("ix_cotacoes_requisicao", "cotacoes", ["requisicao_id"])

    op.execute("ALTER TABLE cotacoes ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY cotacoes_tenant ON cotacoes
            USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    """)

    # ── cotacao_itens ──────────────────────────────────────────────────────────
    op.create_table(
        "cotacao_itens",
        sa.Column("id",             sa.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("cotacao_id",     sa.UUID(as_uuid=True), nullable=False),
        sa.Column("descricao",      sa.String(400), nullable=False),
        sa.Column("unidade",        sa.String(20),  nullable=False),
        sa.Column("quantidade",     sa.Numeric(12, 3), nullable=False),
        sa.Column("preco_unitario", sa.Numeric(15, 4), nullable=False),
        sa.Column("preco_total",    sa.Numeric(15, 2), nullable=False),
        sa.Column("observacao",     sa.String(400), nullable=True),
        sa.Column("criado_em",      sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("atualizado_em",  sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["cotacao_id"], ["cotacoes.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_cotacao_itens_cotacao", "cotacao_itens", ["cotacao_id"])


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS cotacoes_tenant ON cotacoes")
    op.drop_table("cotacao_itens")
    op.drop_table("cotacoes")
