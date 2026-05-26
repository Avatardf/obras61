"""Cria módulos Suprimentos e Financeiro

Revision ID: 003
Revises: 002
Create Date: 2026-05-23
"""
from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Fornecedores ──────────────────────────────────────────────────────────
    op.create_table(
        "fornecedores",
        sa.Column("id",           sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id",    sa.UUID(as_uuid=True), nullable=False),
        sa.Column("nome",         sa.String(300),        nullable=False),
        sa.Column("cnpj",         sa.String(20),         nullable=True),
        sa.Column("categoria",    sa.String(100),        nullable=True),
        sa.Column("contato",      sa.String(200),        nullable=True),
        sa.Column("telefone",     sa.String(30),         nullable=True),
        sa.Column("email",        sa.String(200),        nullable=True),
        sa.Column("cidade",       sa.String(100),        nullable=True),
        sa.Column("uf",           sa.String(2),          nullable=True),
        sa.Column("avaliacao",    sa.Integer,            nullable=True),
        sa.Column("ativo",        sa.Boolean,            nullable=False, server_default="true"),
        sa.Column("observacoes",  sa.Text,               nullable=True),
        sa.Column("criado_em",    sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em",sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_fornecedores_tenant", "fornecedores", ["tenant_id"])
    op.execute("ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY fornecedores_tenant_isolation ON fornecedores
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
    """)

    # ── Estoque ───────────────────────────────────────────────────────────────
    op.create_table(
        "estoque_itens",
        sa.Column("id",                sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id",         sa.UUID(as_uuid=True), nullable=False),
        sa.Column("obra_id",           sa.UUID(as_uuid=True), sa.ForeignKey("obras.id"), nullable=True),
        sa.Column("codigo",            sa.String(50),  nullable=True),
        sa.Column("nome",              sa.String(300), nullable=False),
        sa.Column("categoria",         sa.String(100), nullable=True),
        sa.Column("unidade",           sa.String(20),  nullable=False),
        sa.Column("quantidade",        sa.Numeric(12,3), nullable=False, server_default="0"),
        sa.Column("quantidade_minima", sa.Numeric(12,3), nullable=False, server_default="0"),
        sa.Column("preco_unitario",    sa.Numeric(15,2), nullable=True),
        sa.Column("fornecedor_id",     sa.UUID(as_uuid=True), sa.ForeignKey("fornecedores.id"), nullable=True),
        sa.Column("localizacao",       sa.String(200), nullable=True),
        sa.Column("criado_em",         sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em",     sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_estoque_tenant", "estoque_itens", ["tenant_id"])
    op.create_index("ix_estoque_obra",   "estoque_itens", ["obra_id"])
    op.execute("ALTER TABLE estoque_itens ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY estoque_tenant_isolation ON estoque_itens
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
    """)

    # ── Requisições ───────────────────────────────────────────────────────────
    op.create_table(
        "requisicoes",
        sa.Column("id",                    sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id",             sa.UUID(as_uuid=True), nullable=False),
        sa.Column("numero",                sa.String(20),  nullable=False),
        sa.Column("obra_id",               sa.UUID(as_uuid=True), sa.ForeignKey("obras.id"), nullable=False),
        sa.Column("solicitante",           sa.String(200), nullable=False),
        sa.Column("data_solicitacao",      sa.Date,        nullable=False),
        sa.Column("data_entrega_prevista", sa.Date,        nullable=True),
        sa.Column("status",                sa.String(20),  nullable=False, server_default="pendente"),
        sa.Column("prioridade",            sa.String(20),  nullable=False, server_default="normal"),
        sa.Column("itens",                 sa.JSON,        nullable=False, server_default="[]"),
        sa.Column("observacoes",           sa.Text,        nullable=True),
        sa.Column("criado_em",             sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em",         sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_requisicoes_tenant", "requisicoes", ["tenant_id"])
    op.create_index("ix_requisicoes_obra",   "requisicoes", ["obra_id"])
    op.execute("ALTER TABLE requisicoes ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY requisicoes_tenant_isolation ON requisicoes
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
    """)

    # ── Ordens de Compra ──────────────────────────────────────────────────────
    op.create_table(
        "ordens_compra",
        sa.Column("id",                 sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id",          sa.UUID(as_uuid=True), nullable=False),
        sa.Column("numero",             sa.String(20),  nullable=False),
        sa.Column("obra_id",            sa.UUID(as_uuid=True), sa.ForeignKey("obras.id"), nullable=False),
        sa.Column("fornecedor_id",      sa.UUID(as_uuid=True), sa.ForeignKey("fornecedores.id"), nullable=True),
        sa.Column("requisicao_id",      sa.UUID(as_uuid=True), sa.ForeignKey("requisicoes.id"), nullable=True),
        sa.Column("status",             sa.String(30),  nullable=False, server_default="rascunho"),
        sa.Column("data_emissao",       sa.Date,        nullable=False),
        sa.Column("prazo_entrega",      sa.Date,        nullable=True),
        sa.Column("local_entrega",      sa.String(300), nullable=True),
        sa.Column("condicao_pagamento", sa.String(200), nullable=True),
        sa.Column("valor_total",        sa.Numeric(15,2), nullable=False, server_default="0"),
        sa.Column("observacoes",        sa.Text,        nullable=True),
        sa.Column("criado_em",          sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em",      sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_oc_tenant", "ordens_compra", ["tenant_id"])
    op.create_index("ix_oc_obra",   "ordens_compra", ["obra_id"])
    op.execute("ALTER TABLE ordens_compra ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY oc_tenant_isolation ON ordens_compra
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
    """)

    # ── Itens de OC ───────────────────────────────────────────────────────────
    op.create_table(
        "oc_itens",
        sa.Column("id",             sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("oc_id",          sa.UUID(as_uuid=True), sa.ForeignKey("ordens_compra.id", ondelete="CASCADE"), nullable=False),
        sa.Column("descricao",      sa.String(400), nullable=False),
        sa.Column("unidade",        sa.String(20),  nullable=False),
        sa.Column("quantidade",     sa.Numeric(12,3), nullable=False),
        sa.Column("preco_unitario", sa.Numeric(15,4), nullable=False),
        sa.Column("preco_total",    sa.Numeric(15,2), nullable=False),
        sa.Column("observacao",     sa.String(400), nullable=True),
        sa.Column("criado_em",      sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em",  sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_oc_itens_oc", "oc_itens", ["oc_id"])

    # ── Recebimentos ──────────────────────────────────────────────────────────
    op.create_table(
        "recebimentos",
        sa.Column("id",               sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id",        sa.UUID(as_uuid=True), nullable=False),
        sa.Column("numero",           sa.String(20),  nullable=False),
        sa.Column("obra_id",          sa.UUID(as_uuid=True), sa.ForeignKey("obras.id"), nullable=False),
        sa.Column("oc_id",            sa.UUID(as_uuid=True), sa.ForeignKey("ordens_compra.id"), nullable=True),
        sa.Column("nota_fiscal",      sa.String(50),  nullable=True),
        sa.Column("transportadora",   sa.String(200), nullable=True),
        sa.Column("recebido_por",     sa.String(200), nullable=True),
        sa.Column("data_recebimento", sa.Date,        nullable=False),
        sa.Column("status",           sa.String(20),  nullable=False, server_default="pendente"),
        sa.Column("observacoes",      sa.Text,        nullable=True),
        sa.Column("criado_em",        sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em",    sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_recebimentos_tenant", "recebimentos", ["tenant_id"])
    op.create_index("ix_recebimentos_obra",   "recebimentos", ["obra_id"])
    op.execute("ALTER TABLE recebimentos ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY recebimentos_tenant_isolation ON recebimentos
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
    """)

    # ── Itens de Recebimento ──────────────────────────────────────────────────
    op.create_table(
        "recebimento_itens",
        sa.Column("id",                   sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("recebimento_id",        sa.UUID(as_uuid=True), sa.ForeignKey("recebimentos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("oc_item_id",           sa.UUID(as_uuid=True), sa.ForeignKey("oc_itens.id"), nullable=True),
        sa.Column("descricao",            sa.String(400), nullable=False),
        sa.Column("unidade",              sa.String(20),  nullable=False),
        sa.Column("quantidade_pedida",    sa.Numeric(12,3), nullable=False, server_default="0"),
        sa.Column("quantidade_recebida",  sa.Numeric(12,3), nullable=False, server_default="0"),
        sa.Column("quantidade_recusada",  sa.Numeric(12,3), nullable=False, server_default="0"),
        sa.Column("motivo_recusa",        sa.String(400), nullable=True),
        sa.Column("criado_em",            sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em",        sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_recebimento_itens_rec", "recebimento_itens", ["recebimento_id"])

    # ── Lançamentos Financeiros ───────────────────────────────────────────────
    op.create_table(
        "lancamentos_financeiros",
        sa.Column("id",               sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id",        sa.UUID(as_uuid=True), nullable=False),
        sa.Column("obra_id",          sa.UUID(as_uuid=True), sa.ForeignKey("obras.id"), nullable=True),
        sa.Column("tipo",             sa.String(10),  nullable=False),  # receita | despesa
        sa.Column("categoria",        sa.String(100), nullable=False),
        sa.Column("descricao",        sa.String(400), nullable=False),
        sa.Column("valor",            sa.Numeric(15,2), nullable=False),
        sa.Column("data_vencimento",  sa.Date,        nullable=False),
        sa.Column("data_pagamento",   sa.Date,        nullable=True),
        sa.Column("status",           sa.String(20),  nullable=False, server_default="previsto"),
        sa.Column("nota_fiscal",      sa.String(50),  nullable=True),
        sa.Column("fornecedor_id",    sa.UUID(as_uuid=True), sa.ForeignKey("fornecedores.id"), nullable=True),
        sa.Column("observacoes",      sa.Text,        nullable=True),
        sa.Column("criado_em",        sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em",    sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_lancamentos_tenant", "lancamentos_financeiros", ["tenant_id"])
    op.create_index("ix_lancamentos_obra",   "lancamentos_financeiros", ["obra_id"])
    op.create_index("ix_lancamentos_data",   "lancamentos_financeiros", ["data_vencimento"])
    op.execute("ALTER TABLE lancamentos_financeiros ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY lancamentos_tenant_isolation ON lancamentos_financeiros
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
    """)


def downgrade() -> None:
    for table, policy in [
        ("lancamentos_financeiros", "lancamentos_tenant_isolation"),
        ("recebimentos", "recebimentos_tenant_isolation"),
        ("ordens_compra", "oc_tenant_isolation"),
        ("requisicoes", "requisicoes_tenant_isolation"),
        ("estoque_itens", "estoque_tenant_isolation"),
        ("fornecedores", "fornecedores_tenant_isolation"),
    ]:
        op.execute(f"DROP POLICY IF EXISTS {policy} ON {table};")

    op.drop_table("recebimento_itens")
    op.drop_table("recebimentos")
    op.drop_table("oc_itens")
    op.drop_table("ordens_compra")
    op.drop_table("requisicoes")
    op.drop_table("lancamentos_financeiros")
    op.drop_table("estoque_itens")
    op.drop_table("fornecedores")
