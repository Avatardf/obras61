"""010 – tabela documentos_status (status documental por empreendimento)

Revision ID: 010
Revises: 009
Create Date: 2026-06-02
"""
from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "documentos_status",
        sa.Column("id",                 sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id",          sa.UUID(as_uuid=True), nullable=False),
        sa.Column("empreendimento_id",  sa.UUID(as_uuid=True), nullable=False),
        sa.Column("doc_tipo",           sa.String(80),         nullable=False),
        sa.Column("status",             sa.String(20),         nullable=False, server_default="pendente"),
        sa.Column("observacoes",        sa.Text,               nullable=True),
        sa.Column("created_at",         sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",         sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(["empreendimento_id"], ["empreendimentos.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("tenant_id", "empreendimento_id", "doc_tipo", name="uq_doc_status_emp_tipo"),
    )
    op.create_index("ix_doc_status_emp", "documentos_status", ["empreendimento_id"])


def downgrade() -> None:
    op.drop_index("ix_doc_status_emp", table_name="documentos_status")
    op.drop_table("documentos_status")
