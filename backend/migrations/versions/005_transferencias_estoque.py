"""005 – cria tabela transferencias_estoque

Revision ID: 005
Revises: 004
Create Date: 2026-05-23
"""
from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "transferencias_estoque",
        sa.Column("id",                 sa.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id",          sa.UUID(as_uuid=True), nullable=False),
        sa.Column("numero",             sa.String(20),  nullable=False),
        # NULL = almoxarifado geral
        sa.Column("origem_obra_id",     sa.UUID(as_uuid=True), nullable=True),
        sa.Column("destino_obra_id",    sa.UUID(as_uuid=True), nullable=True),
        # Item de origem para movimentação automática
        sa.Column("estoque_item_id",    sa.UUID(as_uuid=True), nullable=True),
        sa.Column("material",           sa.String(300), nullable=False),
        sa.Column("unidade",            sa.String(20),  nullable=False),
        sa.Column("quantidade",         sa.Numeric(12, 3), nullable=False),
        sa.Column("valor_unitario",     sa.Numeric(15, 4), nullable=True),
        sa.Column("valor_total",        sa.Numeric(15, 2), nullable=True),
        sa.Column("data_transferencia", sa.Date(), nullable=False),
        sa.Column("status",             sa.String(20), nullable=False, server_default="pendente"),
        sa.Column("solicitante",        sa.String(200), nullable=True),
        sa.Column("observacoes",        sa.Text(), nullable=True),
        sa.Column("criado_em",          sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("atualizado_em",      sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"],       ["tenants.id"]),
        sa.ForeignKeyConstraint(["origem_obra_id"],  ["obras.id"]),
        sa.ForeignKeyConstraint(["destino_obra_id"], ["obras.id"]),
        sa.ForeignKeyConstraint(["estoque_item_id"], ["estoque_itens.id"]),
    )
    op.create_index("ix_transferencias_tenant", "transferencias_estoque", ["tenant_id"])
    op.create_index("ix_transferencias_obras",  "transferencias_estoque",
                    ["origem_obra_id", "destino_obra_id"])

    # RLS
    op.execute("ALTER TABLE transferencias_estoque ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY transferencias_estoque_tenant ON transferencias_estoque
            USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS transferencias_estoque_tenant ON transferencias_estoque")
    op.drop_table("transferencias_estoque")
