"""007 – cria tabelas do Centro de Custo (catálogo + lançamentos por obra)

Revision ID: 007
Revises: 006
Create Date: 2026-05-25
"""
from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── cc_categorias ─────────────────────────────────────────────────────────
    # Catálogo global das 14 categorias do CC (sem tenant)
    op.create_table(
        "cc_categorias",
        sa.Column("id",     sa.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("codigo", sa.String(10), nullable=False, unique=True),  # '1.0', '2.0'
        sa.Column("nome",   sa.String(200), nullable=False),
        sa.Column("ordem",  sa.Integer(), nullable=False),
        sa.Column("icone",  sa.String(50), nullable=True),
    )
    op.create_index("ix_cc_categorias_ordem", "cc_categorias", ["ordem"])

    # ── cc_itens_catalogo ─────────────────────────────────────────────────────
    # Catálogo global dos ~50 sub-itens, com mapeamento de origem
    op.create_table(
        "cc_itens_catalogo",
        sa.Column("id",                sa.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("categoria_codigo",  sa.String(10), nullable=False),
        sa.Column("codigo",            sa.String(10), nullable=False, unique=True),  # '1.1', '1.2'
        sa.Column("nome",              sa.String(300), nullable=False),
        sa.Column("ordem",             sa.Integer(), nullable=False),

        # Origem dos dados
        # 'empreendimento' | 'orcamento' | 'financeiro' | 'suprimentos' | 'manual'
        sa.Column("origem_modulo",     sa.String(50), nullable=False, server_default="manual"),
        # Para filtrar na origem (ex: categoria do lançamento financeiro)
        sa.Column("origem_categoria",  sa.String(100), nullable=True),
        # Texto do disclaimer mostrado no modal
        sa.Column("origem_descricao",  sa.Text(), nullable=True),
        # Rota relativa pra navegar (ex: '/empreendimentos/{empreendimento_id}')
        sa.Column("origem_rota",       sa.String(300), nullable=True),
        # Rótulo do botão de redirect ('Ir para Empreendimento', 'Ir para Financeiro')
        sa.Column("origem_label",      sa.String(100), nullable=True),

        sa.ForeignKeyConstraint(["categoria_codigo"], ["cc_categorias.codigo"]),
    )
    op.create_index("ix_cc_itens_categoria", "cc_itens_catalogo", ["categoria_codigo"])
    op.create_index("ix_cc_itens_ordem",     "cc_itens_catalogo", ["ordem"])

    # ── cc_lancamentos_obra ──────────────────────────────────────────────────
    # Lançamentos diretos por obra (para itens com origem='manual' ou ajustes
    # explícitos de itens linkados que ainda não foram registrados na origem)
    op.create_table(
        "cc_lancamentos_obra",
        sa.Column("id",                sa.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id",         sa.UUID(as_uuid=True), nullable=False),
        sa.Column("obra_id",           sa.UUID(as_uuid=True), nullable=False),
        sa.Column("cc_item_codigo",    sa.String(10), nullable=False),

        sa.Column("valor_orcado",      sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("valor_contratado",  sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("valor_executado",   sa.Numeric(15, 2), nullable=False, server_default="0"),

        sa.Column("observacao",        sa.Text(), nullable=True),

        sa.Column("criado_em",         sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("atualizado_em",     sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),

        sa.ForeignKeyConstraint(["tenant_id"],      ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["obra_id"],        ["obras.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["cc_item_codigo"], ["cc_itens_catalogo.codigo"]),
        sa.UniqueConstraint("obra_id", "cc_item_codigo", name="uq_cc_lancamento_obra_item"),
    )
    op.create_index("ix_cc_lancamentos_tenant", "cc_lancamentos_obra", ["tenant_id"])
    op.create_index("ix_cc_lancamentos_obra",   "cc_lancamentos_obra", ["obra_id"])

    op.execute("ALTER TABLE cc_lancamentos_obra ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY cc_lancamentos_tenant ON cc_lancamentos_obra
            USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS cc_lancamentos_tenant ON cc_lancamentos_obra")
    op.drop_table("cc_lancamentos_obra")
    op.drop_table("cc_itens_catalogo")
    op.drop_table("cc_categorias")
