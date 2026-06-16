"""015 – corrige drift de schema: estimativas_custo (tabela), arquivo em
cotacoes e forma_pagamento/oc_id em lancamentos_financeiros

Detectado por scripts/audit_schema.py — colunas/tabelas presentes nos
modelos mas ausentes das migrations (causavam 500 em produção).

Revision ID: 015
Revises: 014
Create Date: 2026-06-16
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1) Tabela estimativas_custo (Estimativa de Custos IA) ──────────────────
    op.create_table(
        "estimativas_custo",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("empreendimento_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("gerado_em", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("modelo_ia", sa.String(50), server_default="gemini-2.5-flash"),
        sa.Column("custo_total", sa.Numeric(18, 2), nullable=False),
        sa.Column("custo_total_min", sa.Numeric(18, 2), nullable=True),
        sa.Column("custo_total_max", sa.Numeric(18, 2), nullable=True),
        sa.Column("custo_por_m2_construido", sa.Numeric(10, 2), nullable=True),
        sa.Column("area_construida_estimada_m2", sa.Numeric(12, 2), nullable=True),
        sa.Column("custo_por_unidade", sa.Numeric(15, 2), nullable=True),
        sa.Column("confianca", sa.String(10), server_default="media"),
        sa.Column("referencia_cub", sa.String(200), nullable=True),
        sa.Column("multiplicador_cub", sa.Numeric(5, 3), nullable=True),
        sa.Column("breakdown", sa.JSON(), nullable=True),
        sa.Column("premissas", sa.JSON(), nullable=True),
        sa.Column("observacoes", sa.Text(), nullable=True),
        sa.Column("parametros_entrada", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["empreendimento_id"], ["empreendimentos.id"], ondelete="CASCADE"),
    )

    # ── 2) Anexo de arquivo em cotacoes ────────────────────────────────────────
    op.add_column("cotacoes", sa.Column("arquivo_nome", sa.String(300), nullable=True))
    op.add_column("cotacoes", sa.Column("arquivo_mime", sa.String(100), nullable=True))
    op.add_column("cotacoes", sa.Column("arquivo_bytes", sa.LargeBinary(), nullable=True))

    # ── 3) Lançamento financeiro: forma de pagamento e vínculo com OC ──────────
    op.add_column("lancamentos_financeiros", sa.Column("forma_pagamento", sa.String(100), nullable=True))
    op.add_column("lancamentos_financeiros", sa.Column("oc_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_lancamentos_oc", "lancamentos_financeiros", "ordens_compra", ["oc_id"], ["id"]
    )


def downgrade() -> None:
    op.drop_constraint("fk_lancamentos_oc", "lancamentos_financeiros", type_="foreignkey")
    op.drop_column("lancamentos_financeiros", "oc_id")
    op.drop_column("lancamentos_financeiros", "forma_pagamento")
    op.drop_column("cotacoes", "arquivo_bytes")
    op.drop_column("cotacoes", "arquivo_mime")
    op.drop_column("cotacoes", "arquivo_nome")
    op.drop_table("estimativas_custo")
