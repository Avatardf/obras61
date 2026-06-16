export type TipoEmpreendimento =
  | "residencial_vertical" | "residencial_horizontal"
  | "comercial" | "misto" | "infraestrutura";

export type StatusEmpreendimento =
  | "estudo" | "viabilidade" | "aprovacao" | "em_obras" | "entregue" | "cancelado";

export type StatusObra =
  | "planejamento" | "em_execucao" | "paralisada" | "concluida" | "cancelada";

export interface Endereco {
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade: string;
  uf: string;
  cep?: string;
  lat?: number;
  lng?: number;
}

export type PadraoConstrutivo = "economico" | "normal" | "alto" | "luxo";
export type EstacionamentoTipo = "nenhum" | "superficie" | "semi_enterrado" | "subsolo_1" | "subsolo_2" | "subsolo_3";
export type SistemaEstrutural = "concreto_armado" | "alvenaria_estrutural" | "steel_frame" | "pre_moldado";

export interface EmpreendimentoResponse {
  id: string;
  nome: string;
  tipo: TipoEmpreendimento;
  endereco: Endereco;
  vgv_previsto: number | null;
  status: StatusEmpreendimento;
  criado_em: string;
  atualizado_em: string;
  total_obras: number;
  primary_obra_id?: string | null;
  deleted_at?: string | null;
  num_unidades: number | null;
  area_terreno_m2: number | null;
  valor_terreno: number | null;
  preco_custo_unidade: number | null;
  preco_venda_unidade: number | null;
  padrao_construtivo: PadraoConstrutivo | null;
  metragem_media_unidade: number | null;
  num_pavimentos_estimado: number | null;
  estacionamento_tipo: EstacionamentoTipo | null;
  num_vagas: number | null;
  num_elevadores: number | null;
  sistema_estrutural: SistemaEstrutural | null;
  diferenciais_lazer: string[] | null;
  // Pipeline
  probabilidade: number | null;
  modelo_negocio: string | null;
  parceiro: string | null;
  produto: string | null;
}

export interface EmpreendimentoLista {
  items: EmpreendimentoResponse[];
  total: number;
  pagina: number;
  por_pagina: number;
}

export interface EmpreendimentoCreate {
  nome: string;
  tipo: TipoEmpreendimento;
  endereco: Endereco;
  vgv_previsto?: number | null;
  status: StatusEmpreendimento;
  num_unidades?: number | null;
  area_terreno_m2?: number | null;
  valor_terreno?: number | null;
  preco_custo_unidade?: number | null;
  preco_venda_unidade?: number | null;
  padrao_construtivo?: PadraoConstrutivo | null;
  metragem_media_unidade?: number | null;
  num_pavimentos_estimado?: number | null;
  estacionamento_tipo?: EstacionamentoTipo | null;
  num_vagas?: number | null;
  num_elevadores?: number | null;
  sistema_estrutural?: SistemaEstrutural | null;
  diferenciais_lazer?: string[] | null;
  probabilidade?: number | null;
  modelo_negocio?: string | null;
  parceiro?: string | null;
  produto?: string | null;
}

// ── Estimativa de Custos IA ───────────────────────────────────────────────────

export interface EstimativaBreakdown {
  fundacao: number;
  estrutura: number;
  vedacao_alvenaria: number;
  cobertura: number;
  instalacoes_eletricas: number;
  instalacoes_hidraulicas: number;
  instalacoes_especiais: number;
  revestimentos: number;
  esquadrias_vidros: number;
  pintura: number;
  acabamentos_metais: number;
  elevadores: number;
  estacionamento: number;
  areas_lazer: number;
  areas_comuns_circulacao: number;
  bdi_indiretos: number;
}

export interface EstimativaCusto {
  id: string;
  empreendimento_id: string;
  gerado_em: string;
  modelo_ia: string;
  custo_total: number;
  custo_total_min: number | null;
  custo_total_max: number | null;
  custo_por_m2_construido: number | null;
  area_construida_estimada_m2: number | null;
  custo_por_unidade: number | null;
  confianca: "baixa" | "media" | "alta";
  referencia_cub: string | null;
  multiplicador_cub: number | null;
  breakdown: EstimativaBreakdown;
  premissas: string[];
  observacoes: string | null;
  parametros_entrada: Record<string, unknown>;
}

export type StatusEtapa =
  | "pendente" | "em_execucao" | "concluida" | "atrasada";

export interface Empreendimento {
  id: string;
  nome: string;
  tipo: string;
  endereco: { cidade: string; uf: string };
  vgv_previsto: number | null;
  status: string;
}

export interface Obra {
  id: string;
  empreendimento_id: string;
  nome: string;
  area_construida_m2: number | null;
  numero_pavimentos: number | null;
  status: StatusObra;
}

export interface Atividade {
  id: string;
  etapa_id: string;
  nome: string;
  unidade: string;
  quantidade_prevista: number;
  quantidade_realizada: number;
  predecessoras: string[];
  percentual: number;
}

export interface Etapa {
  id: string;
  obra_id: string;
  nome: string;
  ordem: number;
  percentual_peso: number;
  status: StatusEtapa;
  progresso: number;
  mes_inicio: number | null;
  duracao_meses: number | null;
  percentual_planejado: number;
  percentual_realizado: number;
  atividades: Atividade[];
}

export interface ObraResponse {
  id: string;
  empreendimento_id: string;
  nome: string;
  area_construida_m2: number | null;
  numero_pavimentos: number | null;
  numero_unidades: number | null;
  status: StatusObra;
  data_inicio: string | null;
  data_prevista_termino: string | null;
  criado_em: string;
  atualizado_em: string;
  progresso_fisico: number;
}

export interface ObraDetalhe extends ObraResponse {
  etapas: Etapa[];
  evm: MetricasEVM | null;
}

export interface MetricasEVM {
  obra_id: string;
  pv: number;
  ev: number;
  ac: number;
  cpi: number;
  spi: number;
  eac: number;
  bac: number;
  vac: number;
  interpretacao: string;
}

export interface ObraCreate {
  nome: string;
  area_construida_m2?: number | null;
  numero_pavimentos?: number | null;
  numero_unidades?: number | null;
  status: StatusObra;
  data_inicio?: string | null;
  data_prevista_termino?: string | null;
  usar_etapas_padrao: boolean;
}

export interface AnaliseIA {
  metricas: MetricasEVM;
  analise_ia: string;
}

// ── Orçamentos ─────────────────────────────────────────────────────────────────

export type OrigemPreco = "sinapi" | "sicro" | "cub" | "cotacao" | "proprio";
export type TipoCusto = "material" | "mao_de_obra" | "equipamento" | "servico" | "administrativo";
export type StatusOrcamento = "rascunho" | "vigente" | "arquivado";

export interface ItemOrcamento {
  id: string;
  orcamento_id: string;
  etapa_id: string | null;
  codigo_composicao: string | null;
  descricao: string;
  unidade: string;
  quantidade: number;
  custo_unitario: number;
  custo_total: number;
  origem_preco: OrigemPreco;
}

export interface ItemOrcamentoCreate {
  etapa_id?: string | null;
  codigo_composicao?: string | null;
  descricao: string;
  unidade: string;
  quantidade: number;
  custo_unitario: number;
  origem_preco: OrigemPreco;
}

export interface OrcamentoResponse {
  id: string;
  obra_id: string;
  versao: number;
  descricao: string | null;
  valor_total: number;
  bdi_percentual: number;
  data_referencia: string | null;
  base_referencia: string;
  uf_referencia: string | null;
  status: StatusOrcamento;
  criado_em: string;
  atualizado_em: string;
  total_itens: number;
}

export interface OrcamentoDetalhe extends OrcamentoResponse {
  itens: ItemOrcamento[];
}

export interface OrcamentoResumo extends OrcamentoResponse {
  obra_nome: string;
}

export interface OrcamentoCreate {
  descricao?: string | null;
  bdi_percentual: number;
  data_referencia?: string | null;
  base_referencia: string;
  uf_referencia?: string | null;
}

export interface CustoRealizado {
  id: string;
  obra_id: string;
  etapa_id: string | null;
  tipo: TipoCusto;
  descricao: string;
  data_lancamento: string;
  valor: number;
  nota_fiscal: string | null;
  criado_em: string;
}

export interface CustoRealizadoCreate {
  etapa_id?: string | null;
  tipo: TipoCusto;
  descricao: string;
  data_lancamento: string;
  valor: number;
  nota_fiscal?: string | null;
}

// ── RDO ───────────────────────────────────────────────────────────────────────

export type ClimaRDO = "ensolarado" | "nublado" | "chuvoso" | "tempestade";
export type StatusRDO = "rascunho" | "finalizado";
export type CriticidadeRDO = "baixa" | "media" | "alta";
export type TipoOcorrenciaRDO = "seguranca" | "qualidade" | "ambiental" | "geral";

export interface EquipeRDO {
  funcao: string;
  quantidade: number;
}

export interface OcorrenciaRDO {
  tipo: TipoOcorrenciaRDO;
  descricao: string;
  criticidade: CriticidadeRDO;
}

export interface RDOResumo {
  id: string;
  obra_id: string;
  data: string;
  clima_manha: string | null;
  clima_tarde: string | null;
  efetivo_total: number | null;
  status: StatusRDO;
  tem_ia: boolean;
  total_atividades: number;
  total_ocorrencias: number;
  criado_em: string;
}

export interface RDOResponse {
  id: string;
  obra_id: string;
  data: string;
  clima_manha: string | null;
  clima_tarde: string | null;
  efetivo_total: number | null;
  equipes: EquipeRDO[];
  atividades: string[];
  ocorrencias: OcorrenciaRDO[];
  observacoes: string | null;
  conteudo_ia: string | null;
  status: StatusRDO;
  criado_em: string;
  atualizado_em: string;
}

export interface RDOCreate {
  data: string;
  clima_manha?: string | null;
  clima_tarde?: string | null;
  efetivo_total?: number | null;
  equipes?: EquipeRDO[];
  atividades?: string[];
  ocorrencias?: OcorrenciaRDO[];
  observacoes?: string | null;
}

export interface TranscricaoVozResponse {
  transcricao: string;
  clima_manha: string | null;
  clima_tarde: string | null;
  efetivo_total: number | null;
  equipes: EquipeRDO[];
  atividades: string[];
  ocorrencias: OcorrenciaRDO[];
  observacoes: string | null;
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

export interface ObraResumoDashboard {
  id: string;
  nome: string;
  status: string;
  progresso_fisico: number;
  empreendimento_nome: string;
  cpi: number | null;
}

export interface EmpreendimentoProgresso {
  nome: string;
  progresso_medio: number;
  total_obras: number;
}

export interface ComercialResumo {
  total_unidades: number;
  unidades_vendidas: number;
  unidades_disponiveis: number;
  unidades_reservadas: number;
  vgv_estoque: number;
  vgv_vendido: number;
  percentual_vendido: number;
  leads_ativos: number;
  pipeline_valor: number;
}

export interface DashboardStats {
  total_empreendimentos: number;
  obras_ativas: number;
  obras_concluidas: number;
  obras_com_alerta: number;
  vgv_total: number;
  obras_recentes: ObraResumoDashboard[];
  empreendimentos_progresso: EmpreendimentoProgresso[];
  comercial: ComercialResumo;
}

// ── Suprimentos ────────────────────────────────────────────────────────────────

export interface Fornecedor {
  id: string;
  nome: string;
  cnpj: string | null;
  categoria: string | null;
  contato: string | null;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  uf: string | null;
  avaliacao: number | null;
  ativo: boolean;
  observacoes: string | null;
}

export interface FornecedorCreate {
  nome: string;
  cnpj?: string | null;
  categoria?: string | null;
  contato?: string | null;
  telefone?: string | null;
  email?: string | null;
  cidade?: string | null;
  uf?: string | null;
  avaliacao?: number | null;
  ativo?: boolean;
  observacoes?: string | null;
}

export type StatusRequisicao = "pendente" | "aprovada" | "em_cotacao" | "comprada" | "entregue" | "cancelada";
export type PrioridadeRequisicao = "baixa" | "normal" | "urgente";

export interface RequisicaoItem {
  descricao: string;
  unidade: string;
  quantidade: number;
  observacao?: string;
}

export interface Requisicao {
  id: string;
  numero: string;
  obra_id: string;
  solicitante: string;
  data_solicitacao: string;
  data_entrega_prevista: string | null;
  status: StatusRequisicao;
  prioridade: PrioridadeRequisicao;
  itens: RequisicaoItem[];
  observacoes: string | null;
  criado_em: string;
}

export interface RequisicaoCreate {
  obra_id?: string | null;
  solicitante: string;
  data_solicitacao: string;
  data_entrega_prevista?: string | null;
  prioridade?: PrioridadeRequisicao;
  itens?: RequisicaoItem[];
  observacoes?: string | null;
}

export type StatusOC = "rascunho" | "aprovada" | "aguardando_pagamento" | "paga" | "entregue" | "cancelada" | "arquivada";

export interface OCItem {
  id: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
  preco_total: number;
  observacao: string | null;
}

export interface OCItemCreate {
  descricao: string;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
  observacao?: string | null;
}

export interface OrdemCompra {
  id: string;
  numero: string;
  obra_id: string;
  fornecedor_id: string | null;
  fornecedor_nome: string | null;
  requisicao_id: string | null;
  status: StatusOC;
  data_emissao: string;
  prazo_entrega: string | null;
  local_entrega: string | null;
  condicao_pagamento: string | null;
  valor_total: number;
  observacoes: string | null;
  itens: OCItem[];
}

export interface OrdemCompraCreate {
  obra_id?: string | null;
  fornecedor_id?: string | null;
  requisicao_id?: string | null;
  data_emissao: string;
  prazo_entrega?: string | null;
  local_entrega?: string | null;
  condicao_pagamento?: string | null;
  observacoes?: string | null;
  itens: OCItemCreate[];
}

export type StatusRecebimento = "pendente" | "conferido" | "divergencia" | "recusado";

export interface RecebimentoItem {
  id: string;
  descricao: string;
  unidade: string;
  quantidade_pedida: number;
  quantidade_recebida: number;
  quantidade_recusada: number;
  motivo_recusa: string | null;
}

export interface Recebimento {
  id: string;
  numero: string;
  obra_id: string;
  oc_id: string | null;
  nota_fiscal: string | null;
  transportadora: string | null;
  recebido_por: string | null;
  data_recebimento: string;
  status: StatusRecebimento;
  observacoes: string | null;
  itens: RecebimentoItem[];
}

export interface RecebimentoCreate {
  obra_id?: string | null;
  oc_id?: string | null;
  nota_fiscal?: string | null;
  transportadora?: string | null;
  recebido_por?: string | null;
  data_recebimento: string;
  observacoes?: string | null;
  itens?: RecebimentoItemCreate[];
}

export interface RecebimentoItemCreate {
  oc_item_id?: string | null;
  descricao: string;
  unidade: string;
  quantidade_pedida: number;
  quantidade_recebida: number;
  quantidade_recusada?: number;
  motivo_recusa?: string | null;
}

export interface RecebimentoItemUpdate {
  id: string;
  quantidade_recebida?: number | null;
  quantidade_recusada?: number | null;
  motivo_recusa?: string | null;
}

export interface EstoqueItem {
  id: string;
  obra_id: string | null;
  codigo: string | null;
  nome: string;
  categoria: string | null;
  unidade: string;
  quantidade: number;
  quantidade_minima: number;
  preco_unitario: number | null;
  fornecedor_id: string | null;
  localizacao: string | null;
  alerta_reposicao: boolean;
}

export type StatusTransferencia = "pendente" | "concluida" | "cancelada";

export interface TransferenciaEstoque {
  id: string;
  numero: string;
  origem_obra_id: string | null;
  destino_obra_id: string | null;
  estoque_item_id: string | null;
  material: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number | null;
  valor_total: number | null;
  data_transferencia: string;
  status: StatusTransferencia;
  solicitante: string | null;
  observacoes: string | null;
  origem_label: string;
  destino_label: string;
}

export interface TransferenciaCreate {
  origem_obra_id?: string | null;
  destino_obra_id?: string | null;
  estoque_item_id?: string | null;
  material: string;
  unidade: string;
  quantidade: number;
  valor_unitario?: number | null;
  data_transferencia: string;
  solicitante?: string | null;
  observacoes?: string | null;
}

export interface SobrasEstoque {
  obra_id: string;
  itens: EstoqueItem[];
  valor_total: number;
  quantidade_itens: number;
}

export interface ObraResumida {
  id: string;
  nome: string;
  codigo?: string | null;
}

// ── Financeiro ─────────────────────────────────────────────────────────────────

export type TipoLancamento = "receita" | "despesa";
export type StatusLancamento = "previsto" | "pago" | "atrasado" | "cancelado";

export interface LancamentoFinanceiro {
  id: string;
  obra_id: string | null;
  tipo: TipoLancamento;
  categoria: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: StatusLancamento;
  nota_fiscal: string | null;
  fornecedor_id: string | null;
  oc_id: string | null;
  forma_pagamento: string | null;
  observacoes: string | null;
}

export interface LancamentoCreate {
  obra_id?: string | null;
  tipo: TipoLancamento;
  categoria: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  data_pagamento?: string | null;
  status?: StatusLancamento;
  nota_fiscal?: string | null;
  fornecedor_id?: string | null;
  oc_id?: string | null;
  forma_pagamento?: string | null;
  observacoes?: string | null;
}

export interface ResumoFinanceiro {
  total_receitas: number;
  total_despesas: number;
  saldo: number;
  a_vencer: number;
  em_atraso: number;
}

export interface FluxoCaixaMes {
  mes: string;
  receitas: number;
  despesas: number;
  saldo: number;
}

// ── Cotações ───────────────────────────────────────────────────────────────────

export type StatusCotacao = "recebida" | "analisada" | "aprovada" | "recusada";

export interface CotacaoItem {
  id: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
  preco_total: number;
  marca_modelo: string | null;
  observacao: string | null;
}

export interface CotacaoItemCreate {
  descricao: string;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
  marca_modelo?: string | null;
  observacao?: string | null;
}

export interface Cotacao {
  id: string;
  numero: string;
  requisicao_id: string | null;
  fornecedor_id: string | null;
  fornecedor_nome: string | null;
  data_cotacao: string;
  validade: string | null;
  prazo_entrega: string | null;
  condicao_pagamento: string | null;
  frete: string | null;
  status: StatusCotacao;
  valor_total: number;
  observacoes: string | null;
  itens: CotacaoItem[];
  criado_em: string;
  /** Nome do arquivo da proposta anexado pelo usuário (PDF/XLSX/DOCX) */
  arquivo_nome: string | null;
}

export interface CotacaoCreate {
  requisicao_id?: string | null;
  fornecedor_id?: string | null;
  data_cotacao: string;
  validade?: string | null;
  prazo_entrega?: string | null;
  condicao_pagamento?: string | null;
  frete?: string | null;
  observacoes?: string | null;
  itens: CotacaoItemCreate[];
}

// Comparativo
export interface ComparativoPreco {
  cotacao_id: string;
  cotacao_numero: string;
  fornecedor_id: string | null;
  fornecedor_nome: string;
  preco_unitario: number;
  preco_total: number;
  marca_modelo: string | null;
  observacao: string | null;
  melhor: boolean;
}

export interface ComparativoItemRow {
  descricao: string;
  unidade: string;
  quantidade: number;
  cotacoes: ComparativoPreco[];
  menor_preco: number | null;
}

export interface ComparativoFornecedor {
  cotacao_id: string;
  cotacao_numero: string;
  fornecedor_id: string | null;
  fornecedor_nome: string;
  total_geral: number;
  validade: string | null;
  prazo_entrega: string | null;
  condicao_pagamento: string | null;
  frete: string | null;
}

export interface ComparativoResponse {
  requisicao_id: string;
  fornecedores: ComparativoFornecedor[];
  itens: ComparativoItemRow[];
}

export interface GerarOCSelecao {
  cotacao_id: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
}

// ── Catálogo de Materiais ──────────────────────────────────────────────────────

export interface Material {
  codigo: string | null;
  descricao: string;
  unidade: string;
  familia: string | null;
}

// ── Centro de Custo ────────────────────────────────────────────────────────────

export type CCOrigemModulo =
  | "empreendimento" | "orcamento" | "financeiro" | "suprimentos" | "manual";

export interface CCOrigem {
  modulo: CCOrigemModulo;
  categoria: string | null;
  descricao: string | null;
  rota: string | null;
  label: string | null;
}

export interface CCItem {
  codigo: string;
  nome: string;
  origem: CCOrigem;
  editavel_inline: boolean;
  valor_orcado: number;
  valor_contratado: number;
  valor_executado: number;
  saldo: number;
  perc_executado: number;
  perc_vgv: number;
  observacao: string | null;
}

export interface CCCategoria {
  codigo: string;
  nome: string;
  icone: string | null;
  itens: CCItem[];
  total_orcado: number;
  total_contratado: number;
  total_executado: number;
  total_saldo: number;
}

export interface CCResumoDRE {
  vgv_total: number;
  impostos_total: number;
  receita_liquida: number;
  custos_diretos_total: number;
  lucro_bruto_spe: number;
  percentual_61_brasil: number;
  resultado_61_brasil: number;
  margem_bruta_spe: number;
  resultado_sobre_vgv: number;
}

export interface CentroCustoResponse {
  obra_id: string;
  obra_nome: string;
  empreendimento_id: string;
  empreendimento_nome: string;
  tipo_obra: "propria" | "parceria";
  parceiro: string | null;
  vgv_estimado: number | null;
  custo_orcado_total: number;
  categorias: CCCategoria[];
  dre: CCResumoDRE;
}
