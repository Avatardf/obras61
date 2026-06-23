/**
 * Catálogo de gestão documental da incorporação — 6 fases sequenciais, 52
 * documentos, na ordem da planilha "Construtora — Gestão Documental":
 *   01 Aquisição do Lote · 02 Alvarás e Licenças · 03 Incorporação ·
 *   04 Documentação da Obra · 05 Venda · 06 Entrega e Pós-Obra
 *
 * Cada documento traz responsável e indicação de taxa/emolumento.
 * Os statuses e datas ficam no banco (por empreendimento); rótulos,
 * responsável e ordem são fixos aqui.
 */

export type StatusDoc =
  | "pendente"
  | "em_andamento"
  | "concluido"
  | "nao_se_aplica"
  | "urgente";

export type Responsavel =
  | "Isabel" | "Engenheiro" | "Prefeitura" | "Correspondente" | "Cartório" | "Contador";

export interface DocItem {
  tipo: string;            // chave única (snake_case)
  label: string;           // nome exibido
  responsavel: Responsavel;
  taxa: boolean;           // exige pagamento de taxa/emolumento
  dica?: string;           // observação-guia da planilha
}

export interface DocCategoria {
  id: string;
  fase: number;            // 1..6
  label: string;
  subtitulo: string;
  icon: string;            // emoji
  docs: DocItem[];
}

// Responsáveis — rótulo + cor do badge + atribuição (aba Instruções da planilha)
export const RESPONSAVEIS: Record<Responsavel, { cor: string; papel: string }> = {
  Isabel:         { cor: "bg-violet-100 text-violet-700", papel: "Documentos internos, certidões e gestão" },
  Engenheiro:     { cor: "bg-blue-100 text-blue-700",     papel: "Projetos, memoriais, licenças técnicas e ART/RRT" },
  Prefeitura:     { cor: "bg-amber-100 text-amber-700",   papel: "Alvarás e certidões municipais" },
  Correspondente: { cor: "bg-emerald-100 text-emerald-700", papel: "Aprovação do cliente na instituição financeira" },
  Cartório:       { cor: "bg-rose-100 text-rose-700",     papel: "Escrituras e registros notariais" },
  Contador:       { cor: "bg-cyan-100 text-cyan-700",     papel: "RET e obrigações fiscais" },
};

export const CATALOGO: DocCategoria[] = [
  {
    id: "aquisicao_lote", fase: 1,
    label: "Aquisição do Lote",
    subtitulo: "Compra, escritura e registro do terreno",
    icon: "🏗️",
    docs: [
      { tipo: "f1_escritura_compra_venda",    label: "Escritura de Compra e Venda",       responsavel: "Cartório",   taxa: true,  dica: "Lavrada em cartório de notas" },
      { tipo: "f1_registro_escritura_cri",     label: "Registro da Escritura no CRI",      responsavel: "Isabel",     taxa: true,  dica: "Cartório de Registro de Imóveis" },
      { tipo: "f1_matricula_atualizada",       label: "Certidão de Matrícula Atualizada",  responsavel: "Isabel",     taxa: true,  dica: "Após registro, confirmar titularidade" },
      { tipo: "f1_projetos",                   label: "Projetos",                          responsavel: "Engenheiro", taxa: false, dica: "Projetos arquitetônicos e complementares" },
    ],
  },
  {
    id: "alvaras_licencas", fase: 2,
    label: "Alvarás e Licenças",
    subtitulo: "Autorizações municipais e ambientais para construção",
    icon: "📋",
    docs: [
      { tipo: "f2_uso_do_solo",         label: "Certidão de Uso do Solo",        responsavel: "Prefeitura", taxa: false, dica: "CEMA — uso e ocupação do solo" },
      { tipo: "f2_licenca_ambiental",   label: "Licença Ambiental",              responsavel: "Engenheiro", taxa: false },
      { tipo: "f2_licenca_bombeiros",   label: "Licença do Corpo de Bombeiros",  responsavel: "Engenheiro", taxa: true,  dica: "AVCB ou CLCB conforme metragem" },
      { tipo: "f2_alvara_construcao",   label: "Alvará de Construção",           responsavel: "Prefeitura", taxa: true,  dica: "Aprovação do projeto pela municipalidade" },
    ],
  },
  {
    id: "incorporacao", fase: 3,
    label: "Incorporação",
    subtitulo: "Registro de incorporação e documentação legal do empreendimento",
    icon: "📜",
    docs: [
      { tipo: "f3_requerimento_incorporacao",  label: "Requerimento de Incorporação",                responsavel: "Isabel",     taxa: false },
      { tipo: "f3_documentos_incorporadora",   label: "Documentos da Incorporadora",                 responsavel: "Isabel",     taxa: false, dica: "Contrato social, simplificada, CNPJ, doc sócios" },
      { tipo: "f3_memorial_incorporacao",      label: "Memorial de Incorporação",                    responsavel: "Engenheiro", taxa: false },
      { tipo: "f3_cert_receita_federal",       label: "Certidão — Receita Federal",                  responsavel: "Isabel",     taxa: false },
      { tipo: "f3_cert_tst",                   label: "Certidão — TST",                              responsavel: "Isabel",     taxa: false },
      { tipo: "f3_cert_trt",                   label: "Certidão — TRT",                              responsavel: "Isabel",     taxa: false },
      { tipo: "f3_cert_trf",                   label: "Certidão — TRF",                              responsavel: "Isabel",     taxa: false },
      { tipo: "f3_cert_sefaz",                 label: "Certidão — SEFAZ",                            responsavel: "Isabel",     taxa: false },
      { tipo: "f3_cert_tjdft",                 label: "Certidão — TJDFT",                            responsavel: "Isabel",     taxa: false },
      { tipo: "f3_cert_civel_estadual",        label: "Certidão — Justiça Cível Estadual",           responsavel: "Isabel",     taxa: true },
      { tipo: "f3_cert_protesto",              label: "Certidão — Negativa de Protesto de Títulos",  responsavel: "Isabel",     taxa: true },
      { tipo: "f3_cert_iptu",                  label: "Certidão — IPTU",                             responsavel: "Isabel",     taxa: false },
      { tipo: "f3_cert_municipal_tributos",    label: "Certidão — Municipal demais tributos",        responsavel: "Isabel",     taxa: false },
      { tipo: "f3_historico_vintenario",       label: "Histórico Vintenário do Imóvel",              responsavel: "Isabel",     taxa: true,  dica: "Certidão paga" },
      { tipo: "f3_projeto_implantacao",        label: "Projeto de Implantação / Urbanismo",          responsavel: "Engenheiro", taxa: false, dica: "Situação das unidades, quadro de áreas" },
      { tipo: "f3_projeto_arquitetura_unid",   label: "Projeto de Arquitetura das Unidades",         responsavel: "Engenheiro", taxa: false, dica: "Geral ou individual conforme municipalidade" },
      { tipo: "f3_calculo_areas",              label: "Cálculo de Áreas (Quadros)",                  responsavel: "Engenheiro", taxa: false },
      { tipo: "f3_memorial_descritivo",        label: "Memorial Descritivo das Especificações",      responsavel: "Engenheiro", taxa: false },
      { tipo: "f3_minuta_convencao_condominio",label: "Minuta da Convenção de Condomínio",           responsavel: "Engenheiro", taxa: false },
      { tipo: "f3_decl_pmcmv_cef",             label: "Declaração de Enquadramento PMCMV (CEF)",     responsavel: "Isabel",     taxa: false, dica: "Firma reconhecida + procurações do gerente" },
      { tipo: "f3_decl_parcela_preco",         label: "Declaração — Parcela do Preço",               responsavel: "Isabel",     taxa: false },
      { tipo: "f3_decl_mandato",               label: "Declaração — Instrumento Público de Mandato", responsavel: "Isabel",     taxa: false },
      { tipo: "f3_decl_prazo_carencia",        label: "Declaração — Prazo de Carência",              responsavel: "Isabel",     taxa: false },
      { tipo: "f3_decl_planta_garagem",        label: "Declaração — Planta de Garagem",              responsavel: "Isabel",     taxa: false },
      { tipo: "f3_decl_contrato_padrao",       label: "Declaração de Contrato-Padrão",               responsavel: "Isabel",     taxa: false },
      { tipo: "f3_art_rrt",                    label: "ART / RRT — Responsabilidade Técnica",        responsavel: "Engenheiro", taxa: true,  dica: "CREA" },
      { tipo: "f3_ret",                        label: "RET — Regime Especial de Tributação",         responsavel: "Contador",   taxa: false, dica: "Adesão ao RET junto à Receita Federal" },
      { tipo: "f3_registro_incorporacao_cri",  label: "Registro de Incorporação no CRI",             responsavel: "Isabel",     taxa: true,  dica: "Cartório de Registro de Imóveis" },
    ],
  },
  {
    id: "documentacao_obra", fase: 4,
    label: "Documentação da Obra",
    subtitulo: "Licenças técnicas e aprovações durante a construção",
    icon: "🔨",
    docs: [
      { tipo: "f4_avto_saneago",            label: "AVTO — Saneago",                    responsavel: "Isabel",     taxa: false, dica: "Autorização de Viabilidade Técnica de Obra" },
      { tipo: "f4_individualizacao_hidro",  label: "Individualização de Hidrômetros",   responsavel: "Engenheiro", taxa: true,  dica: "Projeto e aprovação junto à Saneago" },
      { tipo: "f4_habite_se",               label: "Habite-se (Carta de Habitação)",    responsavel: "Engenheiro", taxa: false, dica: "Emitido pela prefeitura ao final da obra" },
      { tipo: "f4_averbacao_construcao_cri",label: "Averbação da Construção no CRI",     responsavel: "Isabel",     taxa: true,  dica: "Após Habite-se, averbar na matrícula" },
      { tipo: "f4_cnd",                     label: "CND — Certidão Negativa de Débitos",responsavel: "Isabel",     taxa: false, dica: "Receita Federal — pós obra · Levar ao cartório" },
      { tipo: "f4_declaracao_saneago",      label: "Declaração Saneago",                responsavel: "Isabel",     taxa: false, dica: "Confirmação de ligação de água regularizada" },
      { tipo: "f4_ata_eleicao_sindico",     label: "Atas de Eleição de Síndico",        responsavel: "Isabel",     taxa: true,  dica: "Registrar em cartório" },
    ],
  },
  {
    id: "venda", fase: 5,
    label: "Venda",
    subtitulo: "Avaliação, financiamento e formalização da venda",
    icon: "🤝",
    docs: [
      { tipo: "f5_vistoria_avaliacao_cef",  label: "Vistoria e Avaliação CEF",                       responsavel: "Isabel",         taxa: false, dica: "Laudo de avaliação junto à Caixa Econômica Federal" },
      { tipo: "f5_aprovacao_cliente",       label: "Aprovação do Cliente — Instituição Financeira",  responsavel: "Correspondente", taxa: false, dica: "Análise de crédito e documentação do comprador" },
      { tipo: "f5_contrato_compra_venda",   label: "Contrato de Compra e Venda / Financiamento",     responsavel: "Isabel",         taxa: false },
    ],
  },
  {
    id: "entrega_pos_obra", fase: 6,
    label: "Entrega e Pós-Obra",
    subtitulo: "Entrega das unidades, condomínio e transferências",
    icon: "🔑",
    docs: [
      { tipo: "f6_vistoria_entrega_unidades", label: "Vistoria e Entrega das Unidades",          responsavel: "Isabel", taxa: false, dica: "Termo de entrega, chaves, leitura de medidores" },
      { tipo: "f6_transferencia_agua",        label: "Transferência de Água — Saneago",          responsavel: "Isabel", taxa: true,  dica: "Migração das ligações para cada unidade" },
      { tipo: "f6_transferencia_energia",     label: "Transferência de Energia Elétrica",        responsavel: "Isabel", taxa: true,  dica: "Migração das ligações para cada unidade" },
      { tipo: "f6_constituicao_condominio",   label: "Constituição de Condomínio",               responsavel: "Isabel", taxa: true,  dica: "Convenção e regimento interno registrados" },
      { tipo: "f6_reuniao_condominio",        label: "Reunião de Condomínio e Entrega da Gestão",responsavel: "Isabel", taxa: false, dica: "Assembleia de instalação, eleição e repasse ao síndico" },
      { tipo: "f6_entrega_chaves_manual",     label: "Entrega das Chaves e Manual de Garantias", responsavel: "Isabel", taxa: false, dica: "Chave individual + manual de uso e garantias" },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export const TODOS_DOCS: DocItem[] = CATALOGO.flatMap(c => c.docs);

export const STATUS_CONFIG: Record<StatusDoc, { label: string; icon: string; cls: string; dot: string }> = {
  pendente:      { label: "Pendente",       icon: "⬜", cls: "bg-slate-100 text-slate-500 border-slate-200",      dot: "bg-slate-400"   },
  em_andamento:  { label: "Em andamento",   icon: "🔄", cls: "bg-blue-50 text-blue-600 border-blue-200",          dot: "bg-blue-500"    },
  concluido:     { label: "Concluído",      icon: "✅", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  nao_se_aplica: { label: "N/A",            icon: "➖", cls: "bg-slate-50 text-slate-400 border-slate-150",       dot: "bg-slate-300"   },
  urgente:       { label: "Urgente",        icon: "⚠️", cls: "bg-amber-50 text-amber-700 border-amber-200",       dot: "bg-amber-500"   },
};

export const STATUS_CICLO: StatusDoc[] = [
  "pendente", "em_andamento", "concluido", "nao_se_aplica", "urgente",
];

export function proximoStatus(atual: string): StatusDoc {
  const idx = STATUS_CICLO.indexOf(atual as StatusDoc);
  return idx >= 0 ? STATUS_CICLO[(idx + 1) % STATUS_CICLO.length] : "em_andamento";
}

/** Calcula % de conclusão de um conjunto de statuses. Exclui N/A do denominador. */
export function calcProgresso(statuses: Record<string, string>, tipos: string[]): number {
  const validos = tipos.filter(t => statuses[t] !== "nao_se_aplica");
  if (validos.length === 0) return 100;
  const concluidos = validos.filter(t => statuses[t] === "concluido");
  return Math.round((concluidos.length / validos.length) * 100);
}
