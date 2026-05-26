#!/usr/bin/env python
"""
Seed do catálogo do Centro de Custo (CC):
- 14 categorias principais (1.0 a 14.0)
- ~50 sub-itens com mapeamento de origem para os módulos correspondentes
"""
import asyncio
import uuid
from sqlalchemy import text
from app.database import AsyncSessionLocal


# ── Origens predefinidas ────────────────────────────────────────────────────
# Cada item do CC tem uma origem, indicando de onde o sistema deve buscar
# os valores (orçado, contratado, executado) e para onde o usuário deve ir
# se quiser EDITAR o dado original.

EMPREENDIMENTO  = ("empreendimento", "Editar no Empreendimento",
                   "/empreendimentos/{empreendimento_id}")
ORCAMENTO       = ("orcamento", "Abrir Orçamento da obra",
                   "/obras/{obra_id}?tab=orcamento")
FINANCEIRO      = ("financeiro", "Lançar no Financeiro",
                   "/financeiro?obra_id={obra_id}&categoria={categoria}&novo=1")
SUPRIMENTOS     = ("suprimentos", "Abrir Suprimentos",
                   "/suprimentos?obra_id={obra_id}")
MANUAL          = ("manual", None, None)


# ── 14 Categorias ───────────────────────────────────────────────────────────

CATEGORIAS = [
    ("1.0",  "AQUISIÇÃO E LEGALIZAÇÃO",                  "📄"),
    ("2.0",  "PROJETOS E APROVAÇÕES",                    "📐"),
    ("3.0",  "FUNDAÇÃO E INFRAESTRUTURA",                "🏗️"),
    ("4.0",  "ESTRUTURA",                                "🧱"),
    ("5.0",  "ALVENARIA E VEDAÇÃO",                      "🔲"),
    ("6.0",  "INSTALAÇÕES HIDROSSANITÁRIAS",             "🚿"),
    ("7.0",  "INSTALAÇÕES ELÉTRICAS",                    "⚡"),
    ("8.0",  "REVESTIMENTOS E ACABAMENTO",               "🎨"),
    ("9.0",  "ESQUADRIAS E COBERTURA",                   "🪟"),
    ("10.0", "MÃO DE OBRA SUBEMPREITADA",                "👷"),
    ("11.0", "CUSTOS OPERACIONAIS DO CANTEIRO",          "🏭"),
    ("12.0", "DESPESAS COMERCIAIS",                      "🏪"),
    ("13.0", "ENCERRAMENTO E ENTREGA",                   "✅"),
    ("14.0", "IMPOSTOS DIRETOS DA OBRA",                 "💰"),
]


# ── 50+ Sub-itens com mapeamento de origem ─────────────────────────────────
# Estrutura: (codigo, categoria, nome, origem, categoria_filtro)

ITENS = [
    # 1.0 — Aquisição e Legalização
    ("1.1", "1.0", "Custo do terreno (proporcional à obra)",        EMPREENDIMENTO, "valor_terreno"),
    ("1.2", "1.0", "ITBI e registro do imóvel",                     FINANCEIRO,     "tributo_aquisicao"),
    ("1.3", "1.0", "Due diligence jurídica",                        FINANCEIRO,     "juridico"),
    ("1.4", "1.0", "Abertura SPE/SCP (custos diretos)",             FINANCEIRO,     "societario"),
    ("1.5", "1.0", "RET — registro na Receita Federal",             FINANCEIRO,     "tributo"),
    ("1.6", "1.0", "Memorial de incorporação — cartório",           FINANCEIRO,     "cartorio"),
    ("1.7", "1.0", "Alvará de construção — taxas",                  FINANCEIRO,     "licenca"),

    # 2.0 — Projetos e Aprovações
    ("2.1", "2.0", "Projeto arquitetônico",                         FINANCEIRO,     "projeto_arquitetonico"),
    ("2.2", "2.0", "Projeto estrutural",                            FINANCEIRO,     "projeto_estrutural"),
    ("2.3", "2.0", "Projetos complementares (hidro/elet.)",         FINANCEIRO,     "projeto_complementar"),
    ("2.4", "2.0", "ART/RRT — CREA/CAU",                            FINANCEIRO,     "art_rrt"),
    ("2.5", "2.0", "Aprovações concessionárias (ANEEL/Saneago/Bombeiros)", FINANCEIRO, "aprovacao_concessionaria"),

    # 3.0 — Fundação e Infraestrutura
    ("3.1", "3.0", "Sondagem SPT",                                  ORCAMENTO,      "fundacao"),
    ("3.2", "3.0", "Escavação e terraplenagem",                     ORCAMENTO,      "fundacao"),
    ("3.3", "3.0", "Fundação (estacas, blocos, baldrame)",          ORCAMENTO,      "fundacao"),
    ("3.4", "3.0", "Impermeabilização de fundação",                 ORCAMENTO,      "fundacao"),

    # 4.0 — Estrutura
    ("4.1", "4.0", "Formas (madeira ou metálica)",                  ORCAMENTO,      "estrutura"),
    ("4.2", "4.0", "Armação — aço CA-50/CA-60",                     ORCAMENTO,      "estrutura"),
    ("4.3", "4.0", "Concreto usinado",                              ORCAMENTO,      "estrutura"),
    ("4.4", "4.0", "Lajes pré-moldadas",                            ORCAMENTO,      "estrutura"),
    ("4.5", "4.0", "Escadas e rampas",                              ORCAMENTO,      "estrutura"),

    # 5.0 — Alvenaria
    ("5.1", "5.0", "Bloco cerâmico / concreto estrutural",          ORCAMENTO,      "alvenaria"),
    ("5.2", "5.0", "Argamassa de assentamento",                     ORCAMENTO,      "alvenaria"),
    ("5.3", "5.0", "Vergas e contravergas",                         ORCAMENTO,      "alvenaria"),

    # 6.0 — Hidrossanitárias
    ("6.1", "6.0", "Tubulação hidráulica (água fria/quente)",       ORCAMENTO,      "hidraulica"),
    ("6.2", "6.0", "Tubulação de esgoto e pluvial",                 ORCAMENTO,      "hidraulica"),
    ("6.3", "6.0", "Louças sanitárias",                             ORCAMENTO,      "hidraulica"),
    ("6.4", "6.0", "Metais (torneiras, chuveiros, registros)",      ORCAMENTO,      "hidraulica"),
    ("6.5", "6.0", "Caixa d'água e reservatório",                   ORCAMENTO,      "hidraulica"),
    ("6.6", "6.0", "Sistema de gás",                                ORCAMENTO,      "hidraulica"),

    # 7.0 — Elétricas
    ("7.1", "7.0", "Eletrodutos, cabos e quadros",                  ORCAMENTO,      "eletrica"),
    ("7.2", "7.0", "Tomadas, interruptores e pontos de luz",        ORCAMENTO,      "eletrica"),
    ("7.3", "7.0", "SPDA (para-raios)",                             ORCAMENTO,      "eletrica"),
    ("7.4", "7.0", "CFTV, interfone e dados",                       ORCAMENTO,      "eletrica"),

    # 8.0 — Revestimentos e Acabamento
    ("8.1", "8.0", "Contrapiso e regularização",                    ORCAMENTO,      "acabamento"),
    ("8.2", "8.0", "Revestimento cerâmico / porcelanato",           ORCAMENTO,      "acabamento"),
    ("8.3", "8.0", "Revestimento de fachada",                       ORCAMENTO,      "acabamento"),
    ("8.4", "8.0", "Pintura interna e externa",                     ORCAMENTO,      "acabamento"),
    ("8.5", "8.0", "Gesso e drywall",                               ORCAMENTO,      "acabamento"),

    # 9.0 — Esquadrias e Cobertura
    ("9.1", "9.0", "Portas internas e externas",                    ORCAMENTO,      "esquadrias"),
    ("9.2", "9.0", "Janelas e vidros",                              ORCAMENTO,      "esquadrias"),
    ("9.3", "9.0", "Cobertura / telhamento",                        ORCAMENTO,      "cobertura"),
    ("9.4", "9.0", "Impermeabilização geral",                       ORCAMENTO,      "cobertura"),

    # 10.0 — Mão de Obra Subempreitada
    ("10.1", "10.0", "Mestre de Obras — contrato desta obra",       FINANCEIRO,     "mao_de_obra"),
    ("10.2", "10.0", "Armador (subempreiteiro)",                    FINANCEIRO,     "mao_de_obra"),
    ("10.3", "10.0", "Carpinteiro (subempreiteiro)",                FINANCEIRO,     "mao_de_obra"),
    ("10.4", "10.0", "Eletricista (subempreiteiro)",                FINANCEIRO,     "mao_de_obra"),
    ("10.5", "10.0", "Encanador (subempreiteiro)",                  FINANCEIRO,     "mao_de_obra"),
    ("10.6", "10.0", "Pintor (subempreiteiro)",                     FINANCEIRO,     "mao_de_obra"),
    ("10.7", "10.0", "Outros subempreiteiros",                      FINANCEIRO,     "mao_de_obra"),

    # 11.0 — Operacionais do Canteiro
    ("11.1", "11.0", "Instalações provisórias (água, luz, tapume)", FINANCEIRO,     "canteiro"),
    ("11.2", "11.0", "Aluguel de equipamentos / andaimes",          SUPRIMENTOS,    "equipamento_aluguel"),
    ("11.3", "11.0", "Energia e água do canteiro",                  FINANCEIRO,     "utilidades_canteiro"),
    ("11.4", "11.0", "EPI e segurança do trabalho",                 SUPRIMENTOS,    "epi"),
    ("11.5", "11.0", "Transporte e frete de materiais",             FINANCEIRO,     "frete"),

    # 12.0 — Comerciais (manual: ainda não há módulo CRM)
    ("12.1", "12.0", "Corretagem e comissão de vendas (% VGV)",     MANUAL,         None),
    ("12.2", "12.0", "Marketing e publicidade do empreendimento",   MANUAL,         None),
    ("12.3", "12.0", "Stand de vendas",                             MANUAL,         None),

    # 13.0 — Encerramento e Entrega
    ("13.1", "13.0", "Habite-se e taxas de encerramento",           FINANCEIRO,     "habite_se"),
    ("13.2", "13.0", "Averbação e individualização de matrículas",  FINANCEIRO,     "cartorio"),
    ("13.3", "13.0", "Convenção de condomínio — cartório",          FINANCEIRO,     "cartorio"),
    ("13.4", "13.0", "Limpeza final e vistoria",                    FINANCEIRO,     "limpeza"),

    # 14.0 — Impostos
    ("14.1", "14.0", "RET — 2% sobre receita bruta da SPE",         FINANCEIRO,     "tributo_ret"),
    ("14.2", "14.0", "ISS sobre serviços",                          FINANCEIRO,     "tributo_iss"),
    ("14.3", "14.0", "INSS/FGTS sobre folha da obra",               FINANCEIRO,     "tributo_inss"),
]


# ── Disclaimers por módulo ───────────────────────────────────────────────────

DISCLAIMERS = {
    "empreendimento":
        "Este valor é cadastrado na ficha do Empreendimento. "
        "Para editá-lo, navegue até a página do empreendimento.",
    "orcamento":
        "Os custos físicos da obra (materiais e serviços) são gerenciados pelo "
        "módulo de Orçamentos. Os valores Orçado/Contratado vêm do orçamento "
        "vigente; o Executado é alimentado pelos custos realizados.",
    "financeiro":
        "Este custo é lançado no módulo Financeiro como despesa categorizada. "
        "Para editar ou adicionar novos lançamentos, vá até Financeiro filtrando "
        "por esta obra.",
    "suprimentos":
        "Aluguéis e EPI são gerenciados no módulo de Suprimentos (Ordens de Compra "
        "e Recebimentos). Para alterar, registre lá uma nova OC ou recebimento.",
    "manual": None,
}

ORIGEM_LABELS = {
    "empreendimento": "Ir para Empreendimento",
    "orcamento":      "Ir para Orçamentos",
    "financeiro":     "Ir para Financeiro",
    "suprimentos":    "Ir para Suprimentos",
}


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        # Upsert das categorias
        for ordem, (codigo, nome, icone) in enumerate(CATEGORIAS, start=1):
            await db.execute(text("""
                INSERT INTO cc_categorias (id, codigo, nome, ordem, icone)
                VALUES (:id, :codigo, :nome, :ordem, :icone)
                ON CONFLICT (codigo) DO UPDATE
                    SET nome = EXCLUDED.nome,
                        ordem = EXCLUDED.ordem,
                        icone = EXCLUDED.icone
            """), {
                "id":     str(uuid.uuid4()),
                "codigo": codigo, "nome": nome, "ordem": ordem, "icone": icone,
            })

        # Upsert dos itens
        for ordem, (codigo, cat, nome, (modulo, label, rota), filtro) in enumerate(ITENS, start=1):
            await db.execute(text("""
                INSERT INTO cc_itens_catalogo
                    (id, categoria_codigo, codigo, nome, ordem,
                     origem_modulo, origem_categoria,
                     origem_descricao, origem_rota, origem_label)
                VALUES
                    (:id, :cat, :codigo, :nome, :ordem,
                     :modulo, :filtro,
                     :desc, :rota, :label)
                ON CONFLICT (codigo) DO UPDATE
                    SET categoria_codigo = EXCLUDED.categoria_codigo,
                        nome             = EXCLUDED.nome,
                        ordem            = EXCLUDED.ordem,
                        origem_modulo    = EXCLUDED.origem_modulo,
                        origem_categoria = EXCLUDED.origem_categoria,
                        origem_descricao = EXCLUDED.origem_descricao,
                        origem_rota      = EXCLUDED.origem_rota,
                        origem_label     = EXCLUDED.origem_label
            """), {
                "id":     str(uuid.uuid4()),
                "cat":    cat,
                "codigo": codigo,
                "nome":   nome,
                "ordem":  ordem,
                "modulo": modulo,
                "filtro": filtro,
                "desc":   DISCLAIMERS.get(modulo),
                "rota":   rota,
                "label":  ORIGEM_LABELS.get(modulo),
            })

        await db.commit()

        cat_count = (await db.execute(text("SELECT COUNT(*) FROM cc_categorias"))).scalar()
        item_count = (await db.execute(text("SELECT COUNT(*) FROM cc_itens_catalogo"))).scalar()
        print(f"✓ Seed CC: {cat_count} categorias, {item_count} itens.")


if __name__ == "__main__":
    asyncio.run(seed())
