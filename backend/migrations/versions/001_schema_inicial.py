"""schema inicial

Revision ID: 001
Revises:
Create Date: 2026-05-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:

    # ── TENANTS E USUÁRIOS ────────────────────────────────────────────────────

    op.create_table(
        "tenants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("nome", sa.String(200), nullable=False),
        sa.Column("cnpj", sa.String(18), nullable=False, unique=True),
        sa.Column(
            "plano",
            sa.Enum("starter", "professional", "enterprise", name="plano_enum"),
            nullable=False,
            server_default="starter",
        ),
        sa.Column("ativo", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nome", sa.String(200), nullable=False),
        sa.Column("email", sa.String(254), nullable=False, unique=True),
        sa.Column("senha_hash", sa.String(200), nullable=False),
        sa.Column(
            "papel",
            sa.Enum("admin", "engenheiro", "mestre", "comprador", "financeiro", "viewer",
                    name="papel_enum"),
            nullable=False,
            server_default="viewer",
        ),
        sa.Column("ativo", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
    )

    # ── EMPREENDIMENTOS E OBRAS ───────────────────────────────────────────────

    op.create_table(
        "empreendimentos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nome", sa.String(200), nullable=False),
        sa.Column(
            "tipo",
            sa.Enum("residencial_vertical", "residencial_horizontal", "comercial",
                    "misto", "infraestrutura", name="tipo_empreendimento_enum"),
            nullable=False,
        ),
        sa.Column("endereco", postgresql.JSONB, nullable=True),
        sa.Column("vgv_previsto", sa.Numeric(15, 2), nullable=True),
        sa.Column(
            "status",
            sa.Enum("estudo", "viabilidade", "aprovacao", "em_obras", "entregue", "cancelado",
                    name="status_empreendimento_enum"),
            nullable=False,
            server_default="estudo",
        ),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "obras",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("empreendimento_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nome", sa.String(200), nullable=False),
        sa.Column("area_construida_m2", sa.Numeric(10, 2), nullable=True),
        sa.Column("numero_pavimentos", sa.Integer, nullable=True),
        sa.Column("numero_unidades", sa.Integer, nullable=True),
        sa.Column(
            "status",
            sa.Enum("planejamento", "em_execucao", "paralisada", "concluida", "cancelada",
                    name="status_obra_enum"),
            nullable=False,
            server_default="planejamento",
        ),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["empreendimento_id"], ["empreendimentos.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "etapas",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("obra_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nome", sa.String(200), nullable=False),
        sa.Column("ordem", sa.Integer, nullable=False),
        sa.Column("percentual_peso", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column(
            "status",
            sa.Enum("pendente", "em_execucao", "concluida", "atrasada", name="status_etapa_enum"),
            nullable=False,
            server_default="pendente",
        ),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["obra_id"], ["obras.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "atividades",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("etapa_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nome", sa.String(300), nullable=False),
        sa.Column("unidade", sa.String(20), nullable=False),
        sa.Column("quantidade_prevista", sa.Numeric(12, 3), nullable=False, server_default="0"),
        sa.Column("quantidade_realizada", sa.Numeric(12, 3), nullable=False, server_default="0"),
        sa.Column("predecessoras", postgresql.JSONB, nullable=True, server_default="[]"),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["etapa_id"], ["etapas.id"], ondelete="CASCADE"),
    )

    # ── ORÇAMENTO E CUSTOS ────────────────────────────────────────────────────

    op.create_table(
        "orcamentos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("obra_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("versao", sa.Integer, nullable=False, server_default="1"),
        sa.Column("descricao", sa.String(300), nullable=True),
        sa.Column("valor_total", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("bdi_percentual", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("data_referencia", sa.Date, nullable=True),
        sa.Column(
            "base_referencia",
            sa.Enum("sinapi", "sicro", "cub", "tcpo", "propria", name="base_referencia_enum"),
            nullable=False,
            server_default="sinapi",
        ),
        sa.Column("uf_referencia", sa.String(2), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="rascunho"),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["obra_id"], ["obras.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "itens_orcamento",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("orcamento_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("etapa_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("codigo_composicao", sa.String(50), nullable=True),
        sa.Column("descricao", sa.String(400), nullable=False),
        sa.Column("unidade", sa.String(20), nullable=False),
        sa.Column("quantidade", sa.Numeric(12, 3), nullable=False),
        sa.Column("custo_unitario", sa.Numeric(12, 4), nullable=False),
        sa.Column("custo_total", sa.Numeric(15, 2), nullable=False),
        sa.Column(
            "origem_preco",
            sa.Enum("sinapi", "sicro", "cub", "cotacao", "proprio", name="origem_preco_enum"),
            nullable=False,
            server_default="sinapi",
        ),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["orcamento_id"], ["orcamentos.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["etapa_id"], ["etapas.id"], ondelete="SET NULL"),
    )

    op.create_table(
        "custos_realizados",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("obra_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("etapa_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "tipo",
            sa.Enum("material", "mao_de_obra", "equipamento", "servico", "administrativo",
                    name="tipo_custo_enum"),
            nullable=False,
        ),
        sa.Column("descricao", sa.String(400), nullable=False),
        sa.Column("data_lancamento", sa.Date, nullable=False),
        sa.Column("valor", sa.Numeric(15, 2), nullable=False),
        sa.Column("nota_fiscal", sa.String(50), nullable=True),
        sa.Column("documento_url", sa.Text, nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["obra_id"], ["obras.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["etapa_id"], ["etapas.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
    )

    # ── BASES DE CUSTO DE REFERÊNCIA ──────────────────────────────────────────

    op.create_table(
        "bases_referencia",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("codigo", sa.String(20), nullable=False, unique=True),
        sa.Column("nome", sa.String(200), nullable=False),
        sa.Column("orgao", sa.String(200), nullable=False),
        sa.Column(
            "tipo",
            sa.Enum("publica", "privada", name="tipo_base_enum"),
            nullable=False,
        ),
        sa.Column(
            "escopo",
            sa.Enum("nacional", "estadual", "municipal", name="escopo_base_enum"),
            nullable=False,
        ),
        sa.Column("url_fonte", sa.Text, nullable=True),
        sa.Column(
            "frequencia_atualizacao",
            sa.Enum("mensal", "trimestral", "anual", name="frequencia_enum"),
            nullable=False,
        ),
        sa.Column("ultima_atualizacao", sa.Date, nullable=True),
        sa.Column("ativo", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "composicoes_custo",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("base_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("codigo", sa.String(50), nullable=False, index=True),
        sa.Column("descricao", sa.Text, nullable=False),
        sa.Column("unidade", sa.String(20), nullable=False),
        sa.Column("grupo", sa.String(200), nullable=True),
        sa.Column("subgrupo", sa.String(200), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["base_id"], ["bases_referencia.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "precos_referencia",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("composicao_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("uf", sa.String(2), nullable=False, index=True),
        sa.Column("ano_mes", sa.Date, nullable=False, index=True),
        sa.Column("custo_sem_desoneração", sa.Numeric(12, 4), nullable=True),
        sa.Column("custo_com_desoneração", sa.Numeric(12, 4), nullable=True),
        sa.Column("variacao_mensal", sa.Numeric(6, 4), nullable=True),
        sa.ForeignKeyConstraint(["composicao_id"], ["composicoes_custo.id"], ondelete="CASCADE"),
    )
    # Índice composto para buscas por composição + UF + mês
    op.create_index(
        "ix_precos_composicao_uf_mes",
        "precos_referencia",
        ["composicao_id", "uf", "ano_mes"],
        unique=True,
    )

    op.create_table(
        "indices_inflacao",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "indice",
            sa.Enum("incc", "incc_m", "cub_nacional", "cub_sp", "ipca", "igpm",
                    name="indice_inflacao_enum"),
            nullable=False,
            index=True,
        ),
        sa.Column("ano_mes", sa.Date, nullable=False, index=True),
        sa.Column("valor_mensal", sa.Numeric(8, 4), nullable=False),
        sa.Column("valor_acumulado_ano", sa.Numeric(8, 4), nullable=False),
    )
    op.create_index(
        "ix_indices_inflacao_indice_mes",
        "indices_inflacao",
        ["indice", "ano_mes"],
        unique=True,
    )

    # ── VISION 360° ───────────────────────────────────────────────────────────

    op.create_table(
        "pontos_captura",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("obra_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("etapa_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("nome", sa.String(200), nullable=False),
        sa.Column("coordenadas_planta", postgresql.JSONB, nullable=True),
        sa.Column("ativo", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["obra_id"], ["obras.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["etapa_id"], ["etapas.id"], ondelete="SET NULL"),
    )

    op.create_table(
        "capturas_360",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("ponto_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("arquivo_url", sa.Text, nullable=False),
        sa.Column("tamanho_bytes", sa.BigInteger, nullable=True),
        sa.Column("dispositivo", sa.String(100), nullable=True),
        sa.Column(
            "status_processamento",
            sa.Enum("pendente", "processando", "concluido", "erro",
                    name="status_processamento_enum"),
            nullable=False,
            server_default="pendente",
        ),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["ponto_id"], ["pontos_captura.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "analises_ia",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("captura_id", postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column("captura_anterior_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("modelo_ia", sa.String(100), nullable=False),
        sa.Column("progresso_estimado", sa.Numeric(5, 2), nullable=True),
        sa.Column("anomalias_detectadas", postgresql.JSONB, nullable=True),
        sa.Column("sugestao_rdo", sa.Text, nullable=True),
        sa.Column("confianca", sa.Numeric(4, 3), nullable=True),
        sa.Column("tokens_consumidos", sa.Integer, nullable=True),
        sa.Column("custo_usd", sa.Numeric(8, 6), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["captura_id"], ["capturas_360.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["captura_anterior_id"], ["capturas_360.id"], ondelete="SET NULL"),
    )

    # ── ROW-LEVEL SECURITY ────────────────────────────────────────────────────

    tabelas_rls = [
        "empreendimentos", "obras", "orcamentos",
        "custos_realizados", "users",
    ]
    for tabela in tabelas_rls:
        op.execute(f"ALTER TABLE {tabela} ENABLE ROW LEVEL SECURITY")
        op.execute(f"""
            CREATE POLICY tenant_isolation ON {tabela}
            USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
        """)

    # ── DADOS INICIAIS — Bases de referência ─────────────────────────────────

    op.execute("""
        INSERT INTO bases_referencia (id, codigo, nome, orgao, tipo, escopo,
                                      url_fonte, frequencia_atualizacao, ativo)
        VALUES
          (gen_random_uuid(), 'SINAPI', 'Sistema Nacional de Pesquisa de Custos e Índices',
           'Caixa Econômica Federal / IBGE', 'publica', 'estadual',
           'https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi', 'mensal', true),

          (gen_random_uuid(), 'SICRO', 'Sistema de Custos Referenciais de Obras',
           'DNIT', 'publica', 'nacional',
           'https://www.gov.br/dnit/pt-br/assuntos/planejamento-e-pesquisa/custos-e-pagamentos/custos-e-pagamentos-dnit/sistemas-de-custos',
           'trimestral', true),

          (gen_random_uuid(), 'CUB_NACIONAL', 'Custo Unitário Básico Nacional',
           'CBIC / SINDUSCON', 'publica', 'estadual',
           'https://www.cbicdados.com.br/menu/custo-de-construcao/cub-medio-brasil',
           'mensal', true),

          (gen_random_uuid(), 'TCPO', 'Tabela de Composições de Preços para Orçamentos',
           'PINI', 'privada', 'nacional', null, 'anual', true)
    """)


def downgrade() -> None:
    # Remove RLS antes de dropar as tabelas
    tabelas_rls = [
        "empreendimentos", "obras", "orcamentos",
        "custos_realizados", "users",
    ]
    for tabela in tabelas_rls:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {tabela}")
        op.execute(f"ALTER TABLE {tabela} DISABLE ROW LEVEL SECURITY")

    # Remove tabelas na ordem inversa (respeita foreign keys)
    for tabela in [
        "analises_ia", "capturas_360", "pontos_captura",
        "indices_inflacao", "precos_referencia", "composicoes_custo", "bases_referencia",
        "custos_realizados", "itens_orcamento", "orcamentos",
        "atividades", "etapas", "obras", "empreendimentos",
        "users", "tenants",
    ]:
        op.drop_table(tabela)

    # Remove enums
    for enum in [
        "plano_enum", "papel_enum", "tipo_empreendimento_enum", "status_empreendimento_enum",
        "status_obra_enum", "status_etapa_enum", "base_referencia_enum", "origem_preco_enum",
        "tipo_custo_enum", "tipo_base_enum", "escopo_base_enum", "frequencia_enum",
        "indice_inflacao_enum", "status_processamento_enum",
    ]:
        op.execute(f"DROP TYPE IF EXISTS {enum}")
