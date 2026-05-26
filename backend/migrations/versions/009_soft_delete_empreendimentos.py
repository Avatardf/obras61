"""009 – adiciona coluna deleted_at em empreendimentos (soft delete + lixeira)

Revision ID: 009
Revises: 008
Create Date: 2026-05-25
"""
from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Soft delete: marca o registro como excluído sem removê-lo do BD.
    # Empreendimentos com deleted_at != NULL vão para a Lixeira.
    op.add_column(
        "empreendimentos",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_empreendimentos_deleted_at",
        "empreendimentos",
        ["deleted_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_empreendimentos_deleted_at", table_name="empreendimentos")
    op.drop_column("empreendimentos", "deleted_at")
