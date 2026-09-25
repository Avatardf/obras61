"""024 – catálogo de materiais por construtora

O catálogo deixa de ser um Excel fixo no código (igual para todos) e passa
a ser uma tabela por construtora: cada uma inclui, edita, oculta, exclui e
importa seus próprios materiais. A base padrão (5.097 itens) é copiada para
a construtora no primeiro acesso ao catálogo.

Revision ID: 024
Revises: 023
Create Date: 2026-09-25
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "024"
down_revision = "023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "materiais_catalogo",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("codigo", sa.String(50), nullable=True),
        sa.Column("descricao", sa.String(400), nullable=False),
        sa.Column("unidade", sa.String(20), nullable=False, server_default="un"),
        sa.Column("familia", sa.String(120), nullable=True),
        sa.Column("preco_referencia", sa.NUMERIC(14, 4), nullable=True),
        sa.Column("ativo", sa.Boolean, nullable=False, server_default=sa.true()),
        # padrao = veio da base do sistema; proprio = criado na tela; planilha = importado
        sa.Column("origem", sa.String(20), nullable=False, server_default="padrao"),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_materiais_catalogo_tenant_id", "materiais_catalogo", ["tenant_id"])

    op.add_column("tenants", sa.Column(
        "catalogo_inicializado", sa.Boolean, nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("tenants", "catalogo_inicializado")
    op.drop_index("ix_materiais_catalogo_tenant_id", table_name="materiais_catalogo")
    op.drop_table("materiais_catalogo")
