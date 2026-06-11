"""012 – adiciona colunas extras a empreendimentos (viabilidade, produto, lazer)

Revision ID: 012
Revises: 011
Create Date: 2026-06-11
"""
import sqlalchemy as sa
from alembic import op

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("empreendimentos", sa.Column("num_unidades",             sa.Integer(),       nullable=True))
    op.add_column("empreendimentos", sa.Column("area_terreno_m2",          sa.Numeric(12, 2),  nullable=True))
    op.add_column("empreendimentos", sa.Column("valor_terreno",            sa.Numeric(15, 2),  nullable=True))
    op.add_column("empreendimentos", sa.Column("preco_custo_unidade",      sa.Numeric(15, 2),  nullable=True))
    op.add_column("empreendimentos", sa.Column("preco_venda_unidade",      sa.Numeric(15, 2),  nullable=True))
    op.add_column("empreendimentos", sa.Column("padrao_construtivo",       sa.String(20),      nullable=True))
    op.add_column("empreendimentos", sa.Column("metragem_media_unidade",   sa.Numeric(8, 2),   nullable=True))
    op.add_column("empreendimentos", sa.Column("num_pavimentos_estimado",  sa.Integer(),       nullable=True))
    op.add_column("empreendimentos", sa.Column("estacionamento_tipo",      sa.String(30),      nullable=True))
    op.add_column("empreendimentos", sa.Column("num_vagas",                sa.Integer(),       nullable=True))
    op.add_column("empreendimentos", sa.Column("num_elevadores",           sa.Integer(),       nullable=True))
    op.add_column("empreendimentos", sa.Column("sistema_estrutural",       sa.String(30),      nullable=True))
    op.add_column("empreendimentos", sa.Column("diferenciais_lazer",       sa.JSON(),          nullable=True))
    op.add_column("empreendimentos", sa.Column("probabilidade",            sa.Integer(),       nullable=True))
    op.add_column("empreendimentos", sa.Column("modelo_negocio",           sa.String(20),      nullable=True))
    op.add_column("empreendimentos", sa.Column("parceiro",                 sa.String(100),     nullable=True))
    op.add_column("empreendimentos", sa.Column("produto",                  sa.String(50),      nullable=True))


def downgrade() -> None:
    for col in [
        "num_unidades", "area_terreno_m2", "valor_terreno",
        "preco_custo_unidade", "preco_venda_unidade", "padrao_construtivo",
        "metragem_media_unidade", "num_pavimentos_estimado", "estacionamento_tipo",
        "num_vagas", "num_elevadores", "sistema_estrutural", "diferenciais_lazer",
        "probabilidade", "modelo_negocio", "parceiro", "produto",
    ]:
        op.drop_column("empreendimentos", col)
