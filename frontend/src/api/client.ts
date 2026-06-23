import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "",
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,   // 15 segundos — nunca fica pendurado infinitamente
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (email: string, senha: string) =>
    api.post("/api/v1/auth/login", { email, senha }).then(r => r.data),
  me: () =>
    api.get("/api/v1/auth/me").then(r => r.data),
  registrar: (data: {
    nome: string; cnpj: string;
    email_admin: string; senha_admin: string; nome_admin: string;
  }) => api.post("/api/v1/auth/registrar", data).then(r => r.data),
};

export const empreendimentosApi = {
  listar: (params?: { pagina?: number; por_pagina?: number; status?: string; busca?: string }) =>
    api.get("/api/v1/empreendimentos", { params }).then(r => r.data),
  buscar: (id: string) =>
    api.get(`/api/v1/empreendimentos/${id}`).then(r => r.data),
  criar: (data: import("@/types").EmpreendimentoCreate) =>
    api.post("/api/v1/empreendimentos", data).then(r => r.data),
  atualizar: (id: string, data: Partial<import("@/types").EmpreendimentoCreate>) =>
    api.patch(`/api/v1/empreendimentos/${id}`, data).then(r => r.data),
  excluir: (id: string) =>
    api.delete(`/api/v1/empreendimentos/${id}`),
  // Lixeira (soft delete)
  listarLixeira: (): Promise<import("@/types").EmpreendimentoResponse[]> =>
    api.get(`/api/v1/empreendimentos/lixeira/items`).then(r => r.data),
  restaurar: (id: string): Promise<import("@/types").EmpreendimentoResponse> =>
    api.post(`/api/v1/empreendimentos/${id}/restaurar`).then(r => r.data),
  excluirPermanente: (id: string) =>
    api.delete(`/api/v1/empreendimentos/${id}/permanente`),
  // Estimativas de custo IA
  gerarEstimativa: (id: string): Promise<import("@/types").EstimativaCusto> =>
    api.post(`/api/v1/empreendimentos/${id}/estimativas`).then(r => r.data),
  listarEstimativas: (id: string): Promise<import("@/types").EstimativaCusto[]> =>
    api.get(`/api/v1/empreendimentos/${id}/estimativas`).then(r => r.data),
  excluirEstimativa: (empId: string, estId: string) =>
    api.delete(`/api/v1/empreendimentos/${empId}/estimativas/${estId}`),
};

export const obrasApi = {
  listar:  (empId: string) =>
    api.get(`/api/v1/empreendimentos/${empId}/obras`).then(r => r.data),
  criar: (empId: string, data: import("@/types").ObraCreate) =>
    api.post(`/api/v1/empreendimentos/${empId}/obras`, data).then(r => r.data),
  buscar: (obraId: string) =>
    api.get(`/api/v1/obras/${obraId}`).then(r => r.data),
  atualizar: (obraId: string, data: Partial<import("@/types").ObraCreate>) =>
    api.patch(`/api/v1/obras/${obraId}`, data).then(r => r.data),
  excluir: (obraId: string) =>
    api.delete(`/api/v1/obras/${obraId}`),
  atualizarEtapaGantt: (etapaId: string, data: {
    mes_inicio?: number | null;
    duracao_meses?: number | null;
    percentual_planejado?: number;
    percentual_realizado?: number;
    status?: string;
  }) => api.patch(`/api/v1/etapas/${etapaId}`, data).then(r => r.data),
  analiseIA: (obraId: string) =>
    api.get(`/api/v1/obras/${obraId}/analise-ia`).then(r => r.data),
  atualizarEtapa: (etapaId: string, data: { status?: string; percentual_peso?: number }) =>
    api.patch(`/api/v1/etapas/${etapaId}`, data).then(r => r.data),
  atualizarAtividade: (ativId: string, data: { quantidade_realizada?: number }) =>
    api.patch(`/api/v1/atividades/${ativId}`, data).then(r => r.data),
  criarAtividade: (etapaId: string, data: { nome: string; unidade: string; quantidade_prevista: number }) =>
    api.post(`/api/v1/etapas/${etapaId}/atividades`, data).then(r => r.data),
};

export const orcamentosApi = {
  // Orçamentos
  listarTodos: () =>
    api.get("/api/v1/orcamentos").then(r => r.data),
  listar: (obraId: string) =>
    api.get(`/api/v1/obras/${obraId}/orcamentos`).then(r => r.data),
  criar: (obraId: string, data: import("@/types").OrcamentoCreate) =>
    api.post(`/api/v1/obras/${obraId}/orcamentos`, data).then(r => r.data),
  buscar: (orcId: string) =>
    api.get(`/api/v1/orcamentos/${orcId}`).then(r => r.data),
  atualizar: (orcId: string, data: Partial<import("@/types").OrcamentoCreate> & { status?: string }) =>
    api.patch(`/api/v1/orcamentos/${orcId}`, data).then(r => r.data),
  excluir: (orcId: string) =>
    api.delete(`/api/v1/orcamentos/${orcId}`),
  // Itens
  adicionarItem: (orcId: string, data: import("@/types").ItemOrcamentoCreate) =>
    api.post(`/api/v1/orcamentos/${orcId}/itens`, data).then(r => r.data),
  excluirItem: (itemId: string) =>
    api.delete(`/api/v1/itens-orcamento/${itemId}`),
  // Custos realizados
  listarCustos: (obraId: string) =>
    api.get(`/api/v1/obras/${obraId}/custos`).then(r => r.data),
  registrarCusto: (obraId: string, data: import("@/types").CustoRealizadoCreate) =>
    api.post(`/api/v1/obras/${obraId}/custos`, data).then(r => r.data),
  excluirCusto: (custoId: string) =>
    api.delete(`/api/v1/custos/${custoId}`),
};

export const rdoApi = {
  listarTodos: () =>
    api.get("/api/v1/rdos").then(r => r.data),
  listar: (obraId: string) =>
    api.get(`/api/v1/obras/${obraId}/rdos`).then(r => r.data),
  criar: (obraId: string, data: import("@/types").RDOCreate) =>
    api.post(`/api/v1/obras/${obraId}/rdos`, data).then(r => r.data),
  buscar: (rdoId: string) =>
    api.get(`/api/v1/rdos/${rdoId}`).then(r => r.data),
  atualizar: (rdoId: string, data: Partial<import("@/types").RDOCreate> & { status?: string }) =>
    api.patch(`/api/v1/rdos/${rdoId}`, data).then(r => r.data),
  excluir: (rdoId: string) =>
    api.delete(`/api/v1/rdos/${rdoId}`),
  gerarIA: (rdoId: string) =>
    api.post(`/api/v1/rdos/${rdoId}/gerar-ia`).then(r => r.data),
  transcreverVoz: (audio: Blob) => {
    const form = new FormData();
    // Detecta extensão amigável a partir do mime
    const ext = (audio.type.split("/")[1] || "webm").split(";")[0];
    form.append("audio", audio, `rdo-voz.${ext}`);
    return api.post("/api/v1/rdos/transcrever-voz", form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120_000, // Gemini pode levar até 2 min
    }).then(r => r.data) as Promise<import("@/types").TranscricaoVozResponse>;
  },
};

export const dashboardApi = {
  resumo: () =>
    api.get("/api/v1/dashboard").then(r => r.data),
};

/** Dispara download de um Blob em memória sem abrir nova aba. */
function _downloadBlob(data: Blob, filename: string) {
  const href = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = href; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(href), 5_000);
}

export const fornecedoresApi = {
  listar: (params?: { ativo?: boolean; q?: string }) =>
    api.get("/api/v1/fornecedores", { params }).then(r => r.data),
  criar: (data: import("@/types").FornecedorCreate) =>
    api.post("/api/v1/fornecedores", data).then(r => r.data),
  atualizar: (id: string, data: Partial<import("@/types").FornecedorCreate>) =>
    api.patch(`/api/v1/fornecedores/${id}`, data).then(r => r.data),
  excluir: (id: string) =>
    api.delete(`/api/v1/fornecedores/${id}`),

  // ── Excel ────────────────────────────────────────────────────────────────
  xlsxTemplate: () =>
    api.get("/api/v1/fornecedores/xlsx-template", { responseType: "blob" })
      .then(r => _downloadBlob(r.data, "template_fornecedores.xlsx")),

  xlsxExportar: () =>
    api.get("/api/v1/fornecedores/xlsx-exportar", { responseType: "blob" })
      .then(r => _downloadBlob(r.data, "fornecedores.xlsx")),

  xlsxImportar: (file: File): Promise<{ importados: number; erros: string[]; nomes: string[] }> => {
    const form = new FormData();
    form.append("arquivo", file);
    return api.post("/api/v1/fornecedores/xlsx-importar", form, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(r => r.data);
  },
};

export const suprimentosApi = {
  // Requisições
  listarRequisicoes: (obraId?: string) =>
    obraId
      ? api.get(`/api/v1/obras/${obraId}/requisicoes`).then(r => r.data)
      : api.get("/api/v1/requisicoes").then(r => r.data),
  criarRequisicao: (data: import("@/types").RequisicaoCreate) =>
    api.post("/api/v1/requisicoes", data).then(r => r.data),
  atualizarRequisicao: (id: string, data: Partial<import("@/types").RequisicaoCreate> & { status?: string }) =>
    api.patch(`/api/v1/requisicoes/${id}`, data).then(r => r.data),
  excluirRequisicao: (id: string) =>
    api.delete(`/api/v1/requisicoes/${id}`),
  xlsxReqTemplate: () =>
    api.get("/api/v1/requisicoes/xlsx-template", { responseType: "blob" })
      .then(r => _downloadBlob(r.data, "template_requisicao_itens.xlsx")),
  xlsxReqImportarItens: (file: File): Promise<{ itens: any[]; erros: string[] }> => {
    const form = new FormData(); form.append("arquivo", file);
    return api.post("/api/v1/requisicoes/xlsx-importar-itens", form,
      { headers: { "Content-Type": "multipart/form-data" } }).then(r => r.data);
  },
  // Ordens de Compra
  listarOCs: (obraId?: string) =>
    obraId
      ? api.get(`/api/v1/obras/${obraId}/ordens-compra`).then(r => r.data)
      : api.get("/api/v1/ordens-compra").then(r => r.data),
  criarOC: (data: import("@/types").OrdemCompraCreate) =>
    api.post("/api/v1/ordens-compra", data).then(r => r.data),
  atualizarOC: (id: string, data: Partial<import("@/types").OrdemCompraCreate> & { status?: string }) =>
    api.patch(`/api/v1/ordens-compra/${id}`, data).then(r => r.data),
  excluirOC: (id: string) =>
    api.delete(`/api/v1/ordens-compra/${id}`),
  cancelarOC: (id: string, motivo: string) =>
    api.post(`/api/v1/ordens-compra/${id}/cancelar`, { motivo }).then(r => r.data),
  arquivarOC: (id: string) =>
    api.patch(`/api/v1/ordens-compra/${id}/arquivar`).then(r => r.data),
  xlsxOCTemplate: () =>
    api.get("/api/v1/ordens-compra/xlsx-template", { responseType: "blob" })
      .then(r => _downloadBlob(r.data, "template_oc_itens.xlsx")),
  xlsxOCImportarItens: (file: File): Promise<{ itens: any[]; erros: string[] }> => {
    const form = new FormData(); form.append("arquivo", file);
    return api.post("/api/v1/ordens-compra/xlsx-importar-itens", form,
      { headers: { "Content-Type": "multipart/form-data" } }).then(r => r.data);
  },
  // Recebimentos
  listarRecebimentos: (obraId?: string) =>
    obraId
      ? api.get(`/api/v1/obras/${obraId}/recebimentos`).then(r => r.data)
      : api.get("/api/v1/recebimentos").then(r => r.data),
  criarRecebimento: (data: import("@/types").RecebimentoCreate) =>
    api.post("/api/v1/recebimentos", data).then(r => r.data),
  atualizarRecebimento: (id: string, data: { status?: string; itens?: import("@/types").RecebimentoItemUpdate[]; nota_fiscal?: string | null; transportadora?: string | null; recebido_por?: string | null; observacoes?: string | null }) =>
    api.patch(`/api/v1/recebimentos/${id}`, data).then(r => r.data),
  excluirRecebimento: (id: string) =>
    api.delete(`/api/v1/recebimentos/${id}`),
  // Estoque
  /** obraId=undefined → todos | obraId=null → almoxarifado geral | obraId="uuid" → obra específica */
  listarEstoque: (obraId?: string | null) => {
    if (obraId)        return api.get(`/api/v1/obras/${obraId}/estoque`).then(r => r.data);
    if (obraId === null) return api.get("/api/v1/estoque?almoxarifado=true").then(r => r.data);
    return api.get("/api/v1/estoque").then(r => r.data);
  },
  listarSobras: (obraId: string) =>
    api.get(`/api/v1/obras/${obraId}/estoque/sobras`).then(r => r.data),
  criarEstoqueItem: (data: Omit<import("@/types").EstoqueItem, "id" | "alerta_reposicao">) =>
    api.post("/api/v1/estoque", data).then(r => r.data),
  atualizarEstoque: (id: string, data: Partial<Omit<import("@/types").EstoqueItem, "id" | "alerta_reposicao">>) =>
    api.patch(`/api/v1/estoque/${id}`, data).then(r => r.data),
  excluirEstoque: (id: string) =>
    api.delete(`/api/v1/estoque/${id}`),
  // Transferências
  listarTransferencias: (params?: { obra_id?: string; status?: string }) =>
    api.get("/api/v1/transferencias", { params }).then(r => r.data),
  criarTransferencia: (data: import("@/types").TransferenciaCreate) =>
    api.post("/api/v1/transferencias", data).then(r => r.data),
  atualizarTransferencia: (id: string, data: { status?: string; observacoes?: string }) =>
    api.patch(`/api/v1/transferencias/${id}`, data).then(r => r.data),
  excluirTransferencia: (id: string) =>
    api.delete(`/api/v1/transferencias/${id}`),
  // Lista plana de obras (para selectboxes)
  listarObras: () =>
    api.get("/api/v1/obras-lista").then(r => r.data) as Promise<import("@/types").ObraResumida[]>,
};

export const financeiroApi = {
  listar: (params?: { obra_id?: string; tipo?: string; status?: string; ano?: number }) =>
    api.get("/api/v1/financeiro", { params }).then(r => r.data),
  criar: (data: import("@/types").LancamentoCreate) =>
    api.post("/api/v1/financeiro", data).then(r => r.data),
  atualizar: (id: string, data: Partial<import("@/types").LancamentoCreate>) =>
    api.patch(`/api/v1/financeiro/${id}`, data).then(r => r.data),
  excluir: (id: string) =>
    api.delete(`/api/v1/financeiro/${id}`),
  resumo: (params?: { obra_id?: string; ano?: number }) =>
    api.get("/api/v1/financeiro/resumo", { params }).then(r => r.data),
  fluxoCaixa: (params?: { obra_id?: string; ano?: number }) =>
    api.get("/api/v1/financeiro/fluxo-caixa", { params }).then(r => r.data),
};

export const cotacoesApi = {
  listar: (reqId?: string) =>
    reqId
      ? api.get(`/api/v1/requisicoes/${reqId}/cotacoes`).then(r => r.data) as Promise<import("@/types").Cotacao[]>
      : api.get("/api/v1/cotacoes").then(r => r.data) as Promise<import("@/types").Cotacao[]>,
  criar: (data: import("@/types").CotacaoCreate) =>
    api.post("/api/v1/cotacoes", data).then(r => r.data) as Promise<import("@/types").Cotacao>,
  atualizar: (id: string, data: { status?: import("@/types").StatusCotacao; observacoes?: string }) =>
    api.patch(`/api/v1/cotacoes/${id}`, data).then(r => r.data) as Promise<import("@/types").Cotacao>,
  excluir: (id: string) =>
    api.delete(`/api/v1/cotacoes/${id}`),
  comparativo: (reqId: string) =>
    api.get(`/api/v1/requisicoes/${reqId}/comparativo`).then(r => r.data) as Promise<import("@/types").ComparativoResponse>,
  gerarOCs: (reqId: string, data: { selecoes: import("@/types").GerarOCSelecao[]; data_emissao: string }) =>
    api.post(`/api/v1/requisicoes/${reqId}/gerar-ocs`, data).then(r => r.data) as Promise<import("@/types").OrdemCompra[]>,
  extrairItens: (file: File): Promise<{ total: number; itens: import("@/types").CotacaoItemCreate[]; arquivo: string }> => {
    const form = new FormData();
    form.append("arquivo", file);
    return api.post("/api/v1/cotacoes/extrair-itens", form, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(r => r.data);
  },
  uploadArquivo: (id: string, file: File): Promise<void> => {
    const form = new FormData();
    form.append("arquivo", file);
    return api.post(`/api/v1/cotacoes/${id}/arquivo`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(() => undefined);
  },
  downloadArquivo: (id: string): Promise<Blob> =>
    api.get(`/api/v1/cotacoes/${id}/arquivo`, { responseType: "blob" }).then(r => r.data),
};

export const catalogoApi = {
  listarMateriais: (params?: { q?: string; familia?: string; limit?: number }) =>
    api.get("/api/v1/materiais", { params }).then(r => r.data) as Promise<{ total: number; items: import("@/types").Material[] }>,
  listarFamilias: () =>
    api.get("/api/v1/materiais/familias").then(r => r.data) as Promise<string[]>,
};

export const centroCustoApi = {
  obter: (obraId: string) =>
    api.get(`/api/v1/obras/${obraId}/centro-custo`).then(r => r.data) as Promise<import("@/types").CentroCustoResponse>,
  salvar: (obraId: string, codigo: string, payload: {
    valor_orcado?: number; valor_contratado?: number;
    valor_executado?: number; observacao?: string;
  }) => api.put(`/api/v1/obras/${obraId}/centro-custo/${codigo}`, payload).then(r => r.data),
  remover: (obraId: string, codigo: string) =>
    api.delete(`/api/v1/obras/${obraId}/centro-custo/${codigo}`),
};

// ── Tipos locais para usuários ────────────────────────────────────────────────
export interface UsuarioResponse {
  id: string;
  nome: string;
  email: string;
  papel: string;
  ativo: boolean;
}

export const usuariosApi = {
  listar: (): Promise<UsuarioResponse[]> =>
    api.get("/api/v1/usuarios").then(r => r.data),
  criar: (data: { nome: string; email: string; senha: string; papel: string }): Promise<UsuarioResponse> =>
    api.post("/api/v1/usuarios", data).then(r => r.data),
  atualizar: (id: string, data: { nome?: string; papel?: string; ativo?: boolean; senha?: string }): Promise<UsuarioResponse> =>
    api.patch(`/api/v1/usuarios/${id}`, data).then(r => r.data),
  excluir: (id: string): Promise<void> =>
    api.delete(`/api/v1/usuarios/${id}`).then(() => undefined),
};

export interface DocStatus {
  doc_tipo: string;
  status: string;
  observacoes?: string | null;
  data_inicio?: string | null;
  data_prazo?: string | null;
  data_conclusao?: string | null;
}

export interface DocStatusPayload {
  status: string;
  observacoes?: string | null;
  data_inicio?: string | null;
  data_prazo?: string | null;
  data_conclusao?: string | null;
}

export interface MatrizEmp {
  id: string;
  nome: string;
  statuses: Record<string, string>;
}

export const documentosApi = {
  listar: (empId: string): Promise<DocStatus[]> =>
    api.get(`/api/v1/empreendimentos/${empId}/documentos`).then(r => r.data),
  atualizar: (empId: string, docTipo: string, payload: DocStatusPayload): Promise<DocStatus> =>
    api.put(`/api/v1/empreendimentos/${empId}/documentos/${docTipo}`, payload).then(r => r.data),
  matriz: (): Promise<MatrizEmp[]> =>
    api.get("/api/v1/documentos/matriz").then(r => r.data),
};

export interface TransacaoOFX {
  fitid: string;
  data: string;
  valor: number;
  nome: string;
  memo: string;
  tipo: "CREDIT" | "DEBIT";
  categoria: string;
}

export interface OFXParseResult {
  banco: string;
  conta: string;
  moeda: string;
  data_inicio: string;
  data_fim: string;
  saldo_final: number;
  data_saldo: string;
  transacoes: TransacaoOFX[];
}

export const conciliacaoApi = {
  upload: (file: File): Promise<OFXParseResult> => {
    const form = new FormData();
    form.append("arquivo", file);
    return api.post("/api/v1/conciliacao/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(r => r.data);
  },
  finalizar: (matches: { transacao_fitid: string; lancamento_id: string }[]): Promise<{ atualizados: number }> =>
    api.post("/api/v1/conciliacao/finalizar", { matches }).then(r => r.data),
};

// ── Equipes ──────────────────────────────────────────────────────────────────

export interface ColaboradorResponse {
  id: string;
  nome: string;
  funcao: string;
  tipo_vinculo: "proprio" | "terceirizado";
  fornecedor_id: string | null;
  equipe_id: string | null;
  custo_diaria: number | null;
  telefone: string | null;
  observacoes: string | null;
  ativo: boolean;
}

export interface ColaboradorPayload {
  nome?: string;
  funcao?: string;
  tipo_vinculo?: "proprio" | "terceirizado";
  fornecedor_id?: string | null;
  equipe_id?: string | null;
  custo_diaria?: number | null;
  telefone?: string | null;
  observacoes?: string | null;
  ativo?: boolean;
}

export interface AlocacaoResponse {
  id: string;
  equipe_id: string;
  obra_id: string;
  obra_nome: string | null;
  data_inicio: string;
  data_fim: string | null;
  observacao: string | null;
}

export interface EquipeResponse {
  id: string;
  nome: string;
  lider_id: string | null;
  descricao: string | null;
  ativo: boolean;
  membros: ColaboradorResponse[];
  alocacao_atual: AlocacaoResponse | null;
}

export const equipesApi = {
  // Colaboradores
  listarColaboradores: (params?: { ativo?: boolean; equipe_id?: string }): Promise<ColaboradorResponse[]> =>
    api.get("/api/v1/colaboradores", { params }).then(r => r.data),
  criarColaborador: (data: ColaboradorPayload): Promise<ColaboradorResponse> =>
    api.post("/api/v1/colaboradores", data).then(r => r.data),
  atualizarColaborador: (id: string, data: ColaboradorPayload): Promise<ColaboradorResponse> =>
    api.patch(`/api/v1/colaboradores/${id}`, data).then(r => r.data),
  excluirColaborador: (id: string): Promise<void> =>
    api.delete(`/api/v1/colaboradores/${id}`).then(() => undefined),
  // Equipes
  listar: (params?: { ativo?: boolean }): Promise<EquipeResponse[]> =>
    api.get("/api/v1/equipes", { params }).then(r => r.data),
  criar: (data: { nome: string; lider_id?: string | null; descricao?: string | null }): Promise<EquipeResponse> =>
    api.post("/api/v1/equipes", data).then(r => r.data),
  atualizar: (id: string, data: { nome?: string; lider_id?: string | null; descricao?: string | null; ativo?: boolean }): Promise<EquipeResponse> =>
    api.patch(`/api/v1/equipes/${id}`, data).then(r => r.data),
  excluir: (id: string): Promise<void> =>
    api.delete(`/api/v1/equipes/${id}`).then(() => undefined),
  // Alocações
  listarAlocacoes: (equipeId: string): Promise<AlocacaoResponse[]> =>
    api.get(`/api/v1/equipes/${equipeId}/alocacoes`).then(r => r.data),
  alocar: (equipeId: string, data: { obra_id: string; data_inicio: string; data_fim?: string | null; observacao?: string | null }): Promise<AlocacaoResponse> =>
    api.post(`/api/v1/equipes/${equipeId}/alocacoes`, data).then(r => r.data),
  atualizarAlocacao: (id: string, data: { data_inicio?: string; data_fim?: string | null; observacao?: string | null }): Promise<AlocacaoResponse> =>
    api.patch(`/api/v1/alocacoes/${id}`, data).then(r => r.data),
  excluirAlocacao: (id: string): Promise<void> =>
    api.delete(`/api/v1/alocacoes/${id}`).then(() => undefined),
};

// ── Unidades / Espelho Digital ───────────────────────────────────────────────

export type StatusUnidade =
  | "disponivel" | "pre_reserva" | "reservado" | "vendido" | "permuta" | "indisponivel";

export interface Unidade {
  id: string;
  empreendimento_id: string;
  grupo: string;
  identificador: string;
  tipo: string | null;
  pavimento: number | null;
  area_privativa_m2: number | null;
  area_total_m2: number | null;
  fracao_ideal: number | null;
  preco_tabela: number | null;
  status: StatusUnidade;
  cliente_nome: string | null;
  valor_venda: number | null;
  data_venda: string | null;
  observacao: string | null;
}

export interface ResumoEspelho {
  total: number;
  por_status: Record<StatusUnidade, number>;
  vgv_tabela: number;
  vgv_vendido: number;
}

export const unidadesApi = {
  listar: (empId: string): Promise<Unidade[]> =>
    api.get(`/api/v1/empreendimentos/${empId}/unidades`).then(r => r.data),
  resumo: (empId: string): Promise<ResumoEspelho> =>
    api.get(`/api/v1/empreendimentos/${empId}/unidades/resumo`).then(r => r.data),
  criar: (empId: string, data: Partial<Unidade>): Promise<Unidade> =>
    api.post(`/api/v1/empreendimentos/${empId}/unidades`, data).then(r => r.data),
  gerar: (empId: string, data: {
    grupo: string; tipo?: string | null; quantidade: number;
    inicio?: number; prefixo?: string; area_privativa_m2?: number | null; preco_tabela?: number | null;
  }): Promise<Unidade[]> =>
    api.post(`/api/v1/empreendimentos/${empId}/unidades/gerar`, data).then(r => r.data),
  atualizar: (id: string, data: Partial<Unidade>): Promise<Unidade> =>
    api.patch(`/api/v1/unidades/${id}`, data).then(r => r.data),
  excluir: (id: string): Promise<void> =>
    api.delete(`/api/v1/unidades/${id}`).then(() => undefined),
};

// ── Funil de Vendas (CRM) ────────────────────────────────────────────────────

export type EtapaFunil =
  | "pre_atendimento" | "visita" | "atendimento" | "pasta_digital" | "proposta" | "contrato" | "perdido";

export interface Lead {
  id: string;
  nome_cliente: string;
  telefone: string | null;
  email: string | null;
  empreendimento_id: string | null;
  empreendimento_nome: string | null;
  unidade_id: string | null;
  unidade_label: string | null;
  etapa: EtapaFunil;
  valor: number | null;
  responsavel: string | null;
  origem: string | null;
  observacoes: string | null;
  data_entrada_etapa: string;
  dias_na_etapa: number;
  motivo_perda: string | null;
}

export interface ColunaFunil {
  etapa: EtapaFunil;
  total: number;
  valor: number;
  leads: Lead[];
}

export interface FunilResponse {
  colunas: ColunaFunil[];
  total_leads: number;
  valor_pipeline: number;
  valor_ganho: number;
}

export const leadsApi = {
  funil: (empreendimentoId?: string): Promise<FunilResponse> =>
    api.get("/api/v1/leads/funil", { params: empreendimentoId ? { empreendimento_id: empreendimentoId } : {} }).then(r => r.data),
  criar: (data: Partial<Lead>): Promise<Lead> =>
    api.post("/api/v1/leads", data).then(r => r.data),
  atualizar: (id: string, data: Partial<Lead>): Promise<Lead> =>
    api.patch(`/api/v1/leads/${id}`, data).then(r => r.data),
  excluir: (id: string): Promise<void> =>
    api.delete(`/api/v1/leads/${id}`).then(() => undefined),
};

export const visionApi = {
  pontos: (obraId: string) => api.get(`/api/v1/vision/pontos/${obraId}`).then(r => r.data),
  uploadCaptura: (pontoId: string, arquivo: File) => {
    const form = new FormData();
    form.append("arquivo", arquivo);
    return api.post(`/api/v1/vision/capturas/${pontoId}`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(r => r.data);
  },
};
