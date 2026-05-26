import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
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
