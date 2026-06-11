"""013 – módulo de equipes: colaboradores, equipes e alocações por obra

Revision ID: 013
Revises: 012
Create Date: 2026-06-11
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # equipes primeiro (sem FK para colaboradores ainda)
    op.create_table(
        "equipes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nome", sa.String(200), nullable=False),
        sa.Column("lider_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "colaboradores",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nome", sa.String(200), nullable=False),
        sa.Column("funcao", sa.String(100), nullable=False),
        sa.Column("tipo_vinculo", sa.String(20), nullable=False, server_default="proprio"),
        sa.Column("fornecedor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("equipe_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("custo_diaria", sa.Numeric(10, 2), nullable=True),
        sa.Column("telefone", sa.String(30), nullable=True),
        sa.Column("observacoes", sa.Text(), nullable=True),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["fornecedor_id"], ["fornecedores.id"]),
        sa.ForeignKeyConstraint(["equipe_id"], ["equipes.id"]),
    )

    # FK circular: equipes.lider_id → colaboradores.id (criada depois)
    op.create_foreign_key(
        "fk_equipes_lider", "equipes", "colaboradores", ["lider_id"], ["id"]
    )

    op.create_table(
        "equipe_alocacoes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("equipe_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("obra_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("data_inicio", sa.Date(), nullable=False),
        sa.Column("data_fim", sa.Date(), nullable=True),
        sa.Column("observacao", sa.Text(), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["equipe_id"], ["equipes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["obra_id"], ["obras.id"]),
    )


def downgrade() -> None:
    op.drop_table("equipe_alocacoes")
    op.drop_constraint("fk_equipes_lider", "equipes", type_="foreignkey")
    op.drop_table("colaboradores")
    op.drop_table("equipes")
