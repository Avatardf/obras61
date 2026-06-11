import { useState, useRef, useMemo, useEffect } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const LOGO_ESCURO_URL = "/logo/logo-escuro.png";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Trash2, Pencil, Package, ShoppingCart, Truck, Archive,
  ArrowLeftRight, Star, AlertTriangle, CheckCircle2, XCircle, Clock,
  Warehouse, Building2, Download, Upload, FileSpreadsheet, ClipboardList, Eye, Printer, RotateCcw,
  BarChart2, GitMerge, Send, ChevronDown, ChevronRight,
  Zap, Paperclip, FileText,
} from "lucide-react";
import { fornecedoresApi, suprimentosApi, catalogoApi, cotacoesApi } from "@/api/client";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { clsx } from "clsx";
import type {
  Fornecedor, FornecedorCreate,
  Requisicao, RequisicaoCreate,
  OrdemCompra, OrdemCompraCreate, OCItemCreate,
  StatusRequisicao, StatusOC,
  EstoqueItem, ObraResumida,
  TransferenciaEstoque, TransferenciaCreate, StatusTransferencia,
  Recebimento, RecebimentoCreate, RecebimentoItemCreate, StatusRecebimento,
  Material,
  Cotacao, CotacaoCreate, CotacaoItemCreate, StatusCotacao,
  ComparativoResponse, ComparativoFornecedor, ComparativoItemRow,
  GerarOCSelecao,
} from "@/types";

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Converte resposta de erro da API (string ou array Pydantic) para string legível. */
function parseApiError(e: any, fallback = "Erro ao salvar"): string {
  const d = e?.response?.data?.detail;
  if (!d) return fallback;
  if (typeof d === "string") return d;
  if (Array.isArray(d))
    return d.map((x: any) => x.msg ?? JSON.stringify(x)).join("; ");
  return fallback;
}

const fmtQtd = (v: number, un: string) =>
  `${v.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${un}`;

const STATUS_REQ_LABELS: Record<StatusRequisicao, string> = {
  pendente: "Pendente", aprovada: "Aprovada", em_cotacao: "Em cotação",
  comprada: "Comprada", entregue: "Entregue", cancelada: "Cancelada",
};
const STATUS_REQ_COR: Record<StatusRequisicao, string> = {
  pendente: "bg-amber-100 text-amber-700",
  aprovada: "bg-emerald-100 text-emerald-700",
  em_cotacao: "bg-blue-100 text-blue-700",
  comprada: "bg-purple-100 text-purple-700",
  entregue: "bg-teal-100 text-teal-700",
  cancelada: "bg-slate-100 text-slate-500",
};
const PRIORIDADE_COR: Record<string, string> = {
  baixa: "bg-slate-100 text-slate-500",
  normal: "bg-blue-100 text-blue-600",
  urgente: "bg-red-100 text-red-700",
};

const STATUS_OC_LABELS: Record<StatusOC, string> = {
  rascunho:             "Rascunho",
  aprovada:             "Aprovada",
  aguardando_pagamento: "Ag. Pagamento",
  paga:                 "Paga",
  entregue:             "Entregue",
  cancelada:            "Cancelada",
  arquivada:            "Arquivada",
};
const STATUS_OC_COR: Record<StatusOC, string> = {
  rascunho:             "bg-slate-100 text-slate-500",
  aprovada:             "bg-emerald-100 text-emerald-700",
  aguardando_pagamento: "bg-amber-100 text-amber-700",
  paga:                 "bg-blue-100 text-blue-700",
  entregue:             "bg-teal-100 text-teal-700",
  cancelada:            "bg-red-100 text-red-600",
  arquivada:            "bg-slate-100 text-slate-400",
};

const STATUS_TRF_COR: Record<StatusTransferencia, string> = {
  pendente:  "bg-amber-100 text-amber-700",
  concluida: "bg-emerald-100 text-emerald-700",
  cancelada: "bg-slate-100 text-slate-500",
};
const STATUS_TRF_LABELS: Record<StatusTransferencia, string> = {
  pendente: "Pendente", concluida: "Concluída", cancelada: "Cancelada",
};

// ── Abas ──────────────────────────────────────────────────────────────────────

type Tab = "fornecedores" | "requisicoes" | "cotacoes" | "ordens_compra" | "recebimentos" | "estoque" | "transferencias";

const STATUS_REC_LABELS: Record<StatusRecebimento, string> = {
  pendente: "Pendente", conferido: "Conferido",
  divergencia: "Divergência", recusado: "Recusado",
};
const STATUS_REC_COR: Record<StatusRecebimento, string> = {
  pendente:   "bg-amber-100 text-amber-700",
  conferido:  "bg-emerald-100 text-emerald-700",
  divergencia:"bg-orange-100 text-orange-700",
  recusado:   "bg-red-100 text-red-600",
};

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Fornecedores
// ══════════════════════════════════════════════════════════════════════════════

type ImportResultado = { importados: number; erros: string[]; nomes: string[] };

function FornecedoresTab() {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Fornecedor | null>(null);
  const [busca, setBusca] = useState("");
  const [importRes, setImportRes] = useState<ImportResultado | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: fornecedores = [], isLoading } = useQuery<Fornecedor[]>({
    queryKey: ["fornecedores"],
    queryFn: () => fornecedoresApi.listar(),
  });

  const importar = useMutation({
    mutationFn: (file: File) => fornecedoresApi.xlsxImportar(file),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
      setImportRes(res);
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (e: any) =>
      setImportRes({ importados: 0, erros: [e?.response?.data?.detail ?? "Erro no servidor"], nomes: [] }),
  });

  const filtrados = fornecedores.filter(f =>
    f.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (f.cnpj ?? "").includes(busca)
  );

  const excluir = useMutation({
    mutationFn: (id: string) => fornecedoresApi.excluir(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fornecedores"] }),
  });

  const vazio: FornecedorCreate = { nome: "", ativo: true };
  const [form, setForm] = useState<FornecedorCreate>(vazio);
  const [err, setErr] = useState<string | null>(null);

  const salvar = useMutation({
    mutationFn: () =>
      editando
        ? fornecedoresApi.atualizar(editando.id, form)
        : fornecedoresApi.criar(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
      setAberto(false); setForm(vazio); setEditando(null);
    },
    onError: (e: any) => setErr(parseApiError(e)),
  });

  function abrirEditar(f: Fornecedor) {
    setEditando(f);
    setForm({ nome: f.nome, cnpj: f.cnpj ?? "", categoria: f.categoria ?? "",
              telefone: f.telefone ?? "", email: f.email ?? "",
              cidade: f.cidade ?? "", uf: f.uf ?? "",
              avaliacao: f.avaliacao ?? undefined, ativo: f.ativo });
    setAberto(true);
  }

  return (
    <>
      {/* Barra de ferramentas */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <Input label="" placeholder="Buscar por nome ou CNPJ…" value={busca}
          onChange={e => setBusca(e.target.value)} className="w-72" />
        <div className="flex items-center gap-2">
          {/* Excel actions */}
          <button onClick={() => fornecedoresApi.xlsxTemplate()}
            title="Baixar planilha modelo para importação"
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
            <Download size={14} /> Modelo Excel
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importar.isPending}
            title="Importar fornecedores de arquivo Excel"
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-60">
            <Upload size={14} /> {importar.isPending ? "Importando…" : "Importar Excel"}
          </button>
          <input
            ref={fileRef} type="file" accept=".xlsx" className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) importar.mutate(f);
            }} />
          <button onClick={() => fornecedoresApi.xlsxExportar()}
            title="Exportar lista de fornecedores em Excel"
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
            <FileSpreadsheet size={14} /> Exportar
          </button>
          <button onClick={() => { setEditando(null); setForm(vazio); setAberto(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700">
            <Plus size={16} /> Novo fornecedor
          </button>
        </div>
      </div>

      {/* Resultado de importação */}
      {importRes && (
        <div className={clsx(
          "mb-4 px-4 py-3 rounded-lg border text-sm",
          importRes.importados > 0
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : "bg-red-50 border-red-200 text-red-800"
        )}>
          <div className="flex items-start justify-between gap-2">
            <div>
              {importRes.importados > 0 && (
                <p className="font-medium">
                  ✓ {importRes.importados} fornecedor(es) importado(s) com sucesso
                </p>
              )}
              {importRes.erros.length > 0 && (
                <div className="mt-1">
                  <p className="font-medium text-amber-700">Avisos:</p>
                  <ul className="list-disc list-inside text-xs text-amber-700 space-y-0.5 mt-0.5">
                    {importRes.erros.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
            <button onClick={() => setImportRes(null)}
              className="text-slate-400 hover:text-slate-600 flex-shrink-0">
              <XCircle size={16} />
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-slate-400 text-sm p-6">Carregando…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500 font-medium uppercase tracking-wide">
                <th className="pb-2 pr-4">Nome</th>
                <th className="pb-2 pr-4">CNPJ</th>
                <th className="pb-2 pr-4">Categoria</th>
                <th className="pb-2 pr-4">Cidade/UF</th>
                <th className="pb-2 pr-4">Avaliação</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(f => (
                <tr key={f.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 pr-4 font-medium text-slate-800">{f.nome}</td>
                  <td className="py-3 pr-4 text-slate-500">{f.cnpj ?? "—"}</td>
                  <td className="py-3 pr-4 text-slate-500">{f.categoria ?? "—"}</td>
                  <td className="py-3 pr-4 text-slate-500">{f.cidade ? `${f.cidade}/${f.uf}` : "—"}</td>
                  <td className="py-3 pr-4">
                    {f.avaliacao ? (
                      <span className="flex items-center gap-0.5 text-amber-500">
                        <Star size={12} fill="currentColor" /> {f.avaliacao}/5
                      </span>
                    ) : "—"}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium",
                      f.ativo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                      {f.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <button onClick={() => abrirEditar(f)}
                        className="text-slate-400 hover:text-brand-600"><Pencil size={14} /></button>
                      <button onClick={() => { if (confirm(`Excluir "${f.nome}"?`)) excluir.mutate(f.id); }}
                        className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={7} className="py-10 text-center text-slate-400">Nenhum fornecedor cadastrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal aberto={aberto} onFechar={() => { setAberto(false); setErr(null); }}
        titulo={editando ? "Editar fornecedor" : "Novo fornecedor"}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input label="Nome / Razão Social" required value={form.nome ?? ""}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <Input label="CNPJ" value={form.cnpj ?? ""}
              onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))}
              placeholder="00.000.000/0001-00" />
            <Input label="Categoria" value={form.categoria ?? ""}
              onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
              placeholder="Material, Serviço…" />
            <Input label="Telefone" value={form.telefone ?? ""}
              onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
            <Input label="E-mail" value={form.email ?? ""}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <Input label="Cidade" value={form.cidade ?? ""}
              onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} />
            <Input label="UF" value={form.uf ?? ""}
              onChange={e => setForm(f => ({ ...f, uf: e.target.value }))}
              placeholder="RJ" maxLength={2} />
          </div>
          {err && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">{err}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setAberto(false)}
              className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={() => salvar.mutate()}
              disabled={!form.nome?.trim() || salvar.isPending}
              className="flex-1 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60">
              {salvar.isPending ? "Salvando…" : editando ? "Salvar" : "Cadastrar"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENT: MaterialSearch — busca com autocomplete + navegação por família
// ══════════════════════════════════════════════════════════════════════════════

type ItemSolicitado = { descricao: string; unidade: string; quantidade: number };

function MaterialSearch({ onAddItens }: { onAddItens: (itens: ItemSolicitado[]) => void }) {
  const [modo, setModo] = useState<"busca" | "familia">("busca");
  const [busca, setBusca] = useState("");
  const [familiaAtiva, setFamiliaAtiva] = useState<string | null>(null);
  // Map: descricao → quantidade
  const [selecionados, setSelecionados] = useState<Map<string, number>>(new Map());

  const { data: catalogoData } = useQuery({
    queryKey: ["catalogo-todos"],
    queryFn: () => catalogoApi.listarMateriais({ limit: 6000 }),
    staleTime: Infinity,
  });
  const catalogo: Material[] = catalogoData?.items ?? [];

  const { data: familias = [] } = useQuery({
    queryKey: ["catalogo-familias"],
    queryFn: () => catalogoApi.listarFamilias(),
    staleTime: Infinity,
  });

  const resultadosBusca = useMemo(() => {
    if (busca.trim().length < 2) return [];
    const q = busca.toLowerCase();
    return catalogo
      .filter(m => m.descricao.toLowerCase().includes(q) || (m.codigo?.toLowerCase().includes(q) ?? false))
      .slice(0, 40);
  }, [catalogo, busca]);

  const itensFamilia = useMemo(() =>
    familiaAtiva ? catalogo.filter(m => m.familia === familiaAtiva) : [],
    [catalogo, familiaAtiva]
  );

  function toggleItem(m: Material, checked: boolean) {
    setSelecionados(prev => {
      const next = new Map(prev);
      if (checked) next.set(m.descricao, 1);
      else next.delete(m.descricao);
      return next;
    });
  }

  function setQtd(descricao: string, qtd: number) {
    setSelecionados(prev => {
      const next = new Map(prev);
      if (next.has(descricao)) next.set(descricao, qtd);
      return next;
    });
  }

  function addBusca(m: Material) {
    onAddItens([{ descricao: m.descricao, unidade: m.unidade, quantidade: 1 }]);
    setBusca("");
  }

  function addSelecionados() {
    const items = catalogo
      .filter(m => selecionados.has(m.descricao))
      .map(m => ({
        descricao: m.descricao,
        unidade: m.unidade,
        quantidade: selecionados.get(m.descricao) ?? 1,
      }));
    if (items.length) {
      onAddItens(items);
      setSelecionados(new Map());
    }
  }

  return (
    <div className="border border-brand-200 rounded-lg bg-brand-50/20 overflow-hidden">
      {/* Cabeçalho com seletor de modo */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-2 border-b border-brand-100">
        <span className="text-xs font-semibold text-slate-700">Catálogo de materiais</span>
        <div className="flex rounded-md border border-slate-200 bg-white overflow-hidden ml-2">
          <button onClick={() => setModo("busca")}
            className={clsx("px-3 py-1 text-xs font-medium transition-colors",
              modo === "busca" ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50")}>
            Busca
          </button>
          <button onClick={() => setModo("familia")}
            className={clsx("px-3 py-1 text-xs font-medium border-l border-slate-200 transition-colors",
              modo === "familia" ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50")}>
            Por família
          </button>
        </div>
        {catalogo.length > 0 && (
          <span className="ml-auto text-xs text-slate-400">{catalogo.length} itens</span>
        )}
      </div>

      {/* Modo Busca */}
      {modo === "busca" && (
        <div className="p-3 space-y-1.5">
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Digite o material (mín. 2 letras)…"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-brand-400 outline-none bg-white"
            autoComplete="off"
          />
          {resultadosBusca.length > 0 && (
            <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-100 shadow-sm">
              {resultadosBusca.map((m, i) => (
                <button key={i} onClick={() => addBusca(m)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-brand-50 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-slate-800 group-hover:text-brand-700">{m.descricao}</span>
                    {m.familia && (
                      <span className="ml-2 text-xs text-slate-400">{m.familia}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                    <span className="text-xs text-slate-400">{m.unidade}</span>
                    <span className="text-xs text-brand-500 opacity-0 group-hover:opacity-100">+ add</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {busca.trim().length >= 2 && resultadosBusca.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-2">Nenhum material para "{busca}"</p>
          )}
          {busca.trim().length < 2 && (
            <p className="text-xs text-slate-400 text-center py-1.5">
              Digite para buscar no catálogo e clique para adicionar
            </p>
          )}
        </div>
      )}

      {/* Modo Por Família */}
      {modo === "familia" && (
        <div className="p-3 space-y-2">
          {/* Botões de família */}
          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
            {familias.length === 0 && (
              <span className="text-xs text-slate-400">Carregando famílias…</span>
            )}
            {familias.map(f => (
              <button key={f} onClick={() => setFamiliaAtiva(f === familiaAtiva ? null : f)}
                className={clsx("px-2.5 py-1 text-xs rounded-full border transition-colors whitespace-nowrap",
                  f === familiaAtiva
                    ? "bg-brand-600 text-white border-brand-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-brand-300 hover:text-brand-600")}>
                {f}
              </button>
            ))}
          </div>

          {familiaAtiva && itensFamilia.length > 0 && (
            <>
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-medium">{familiaAtiva} — {itensFamilia.length} itens</span>
                <div className="flex gap-3">
                  <button onClick={() => setSelecionados(prev => {
                    const next = new Map(prev);
                    itensFamilia.forEach(m => { if (!next.has(m.descricao)) next.set(m.descricao, 1); });
                    return next;
                  })} className="text-brand-600 hover:underline">Todos</button>
                  <button onClick={() => setSelecionados(prev => {
                    const next = new Map(prev);
                    itensFamilia.forEach(m => next.delete(m.descricao));
                    return next;
                  })} className="text-slate-400 hover:underline">Limpar</button>
                </div>
              </div>

              <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-100">
                {itensFamilia.map((m, i) => {
                  const checked = selecionados.has(m.descricao);
                  return (
                    <label key={i}
                      className={clsx("flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-brand-50 transition-colors",
                        checked && "bg-brand-50/60")}>
                      <input type="checkbox" checked={checked}
                        onChange={e => toggleItem(m, e.target.checked)}
                        className="rounded border-slate-300 accent-brand-600" />
                      <span className="flex-1 text-sm text-slate-800 leading-tight">{m.descricao}</span>
                      {checked && (
                        <input
                          type="number" min="0.001" step="0.001"
                          value={selecionados.get(m.descricao) ?? 1}
                          onChange={e => setQtd(m.descricao, +e.target.value)}
                          onClick={e => e.preventDefault()}
                          className="w-16 text-xs text-right px-1.5 py-0.5 border border-slate-200 rounded focus:border-brand-400 outline-none" />
                      )}
                      <span className="text-xs text-slate-400 w-8 text-right">{m.unidade}</span>
                    </label>
                  );
                })}
              </div>

              {selecionados.size > 0 && (
                <button onClick={addSelecionados}
                  className="w-full py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors">
                  + Adicionar {selecionados.size} item(ns) selecionado(s)
                </button>
              )}
            </>
          )}

          {familiaAtiva === null && (
            <p className="text-xs text-slate-400 text-center py-2">
              Selecione uma família para ver os itens disponíveis
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Requisições
// ══════════════════════════════════════════════════════════════════════════════

function RequisicoesTab() {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [itensImportErr, setItensImportErr] = useState<string[]>([]);
  const fileItensRef = useRef<HTMLInputElement>(null);
  const [importandoItens, setImportandoItens] = useState(false);
  const [visualizando, setVisualizando] = useState<Requisicao | null>(null);
  const [excluidos, setExcluidos] = useState<Set<number>>(new Set());
  // Quantidades editadas no modal de análise (índice → quantidade nova)
  const [qtdEditada, setQtdEditada] = useState<Record<number, number>>({});
  const [salvandoQtd, setSalvandoQtd] = useState(false);
  // Logo pré-carregado para uso nos PDFs
  const logoRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new Image();
    img.src = LOGO_ESCURO_URL;
    img.onload = () => { logoRef.current = img; };
  }, []);
  // Filtros
  const [buscaReq, setBuscaReq] = useState("");
  const [filtroStatusReq, setFiltroStatusReq] = useState("");
  const [filtroPrioridade, setFiltroPrioridade] = useState("");

  // Estoque do almoxarifado para cruzamento com itens da requisição
  const { data: estoqueAlmox = [] } = useQuery<EstoqueItem[]>({
    queryKey: ["estoque", "almoxarifado", null],
    queryFn: () => suprimentosApi.listarEstoque(null),
    enabled: !!visualizando,
    staleTime: 60_000,
  });

  /** Normaliza string para comparação fuzzy: minúsculas, sem acentos */
  function normStr(s: string) {
    return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").trim();
  }

  /** Retorna quantidade em estoque (almoxarifado) que melhor corresponde à descrição do item */
  function estoqueParaItem(descricao: string): { qtd: number; un: string } | null {
    if (!descricao) return null;
    const needleNorm = normStr(descricao);
    const needleWords = needleNorm.split(/\s+/).filter(w => w.length > 2);
    if (!needleWords.length) return null;

    let best: EstoqueItem | null = null;
    let bestScore = 0;

    for (const item of estoqueAlmox) {
      const hayNorm = normStr(item.nome);
      // score = quantidade de palavras do needle presentes no haystack
      const score = needleWords.filter(w => hayNorm.includes(w)).length;
      // match mínimo: pelo menos metade das palavras batem, E ao menos 1 palavra
      if (score > bestScore && score >= Math.max(1, Math.ceil(needleWords.length / 2))) {
        bestScore = score;
        best = item;
      }
    }
    return best ? { qtd: best.quantidade, un: best.unidade } : null;
  }

  function abrirAnalise(r: Requisicao) {
    setVisualizando(r);
    setExcluidos(new Set());
    setQtdEditada({});
  }

  /** Quantidade atual do item (editada > original) */
  function qtdAtual(idx: number, original: number): number {
    return qtdEditada[idx] !== undefined ? qtdEditada[idx] : original;
  }

  /** Persiste as quantidades editadas no backend */
  async function salvarQuantidades() {
    if (!visualizando || Object.keys(qtdEditada).length === 0) return;
    setSalvandoQtd(true);
    try {
      const itensAtualizados = visualizando.itens.map((it: any, idx: number) => ({
        ...it,
        quantidade: qtdAtual(idx, it.quantidade),
      }));
      await suprimentosApi.atualizarRequisicao(visualizando.id, { itens: itensAtualizados } as any);
      await qc.invalidateQueries({ queryKey: ["requisicoes"] });
      // Atualiza o visualizando local
      setVisualizando({ ...visualizando, itens: itensAtualizados });
      setQtdEditada({});
    } finally {
      setSalvandoQtd(false);
    }
  }

  function toggleExcluir(idx: number) {
    setExcluidos(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function gerarPDFCotacao(req: Requisicao, excl: Set<number>) {
    const ativos = req.itens
      .map((item: any, idx: number) => ({ item, idx }))
      .filter(({ idx }) => !excl.has(idx));

    const hoje = new Date().toLocaleDateString("pt-BR");
    const dataArq = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const entrega = req.data_entrega_prevista
      ? new Date(req.data_entrega_prevista + "T00:00:00").toLocaleDateString("pt-BR")
      : "A combinar";

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const PW = 210; // A4 width mm
    const ML = 14;  // margin left
    const MR = 14;  // margin right
    const CW = PW - ML - MR; // content width = 182mm
    const BLUE: [number, number, number] = [30, 64, 175];
    const BLUE_LIGHT: [number, number, number] = [239, 246, 255];
    const SLATE: [number, number, number] = [241, 245, 249];
    const YELLOW: [number, number, number] = [255, 251, 235];

    // ── Cabeçalho ──────────────────────────────────────────────────────────────
    // Logo à esquerda (largura 44mm, altura 11mm ≈ proporção 4:1)
    if (logoRef.current) {
      doc.addImage(logoRef.current, "PNG", ML, 10, 44, 11);
    } else {
      // Fallback textual caso a imagem ainda não tenha carregado
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(...BLUE);
      doc.text("61Brasil", ML, 18);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...BLUE);
    doc.text("SOLICITAÇÃO DE COTAÇÃO", PW - MR, 16, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`${req.numero}  ·  Emissão: ${hoje}`, PW - MR, 21, { align: "right" });

    // linha separadora
    doc.setDrawColor(...BLUE);
    doc.setLineWidth(0.7);
    doc.line(ML, 26, PW - MR, 26);

    // ── Meta grid (4 colunas) ──────────────────────────────────────────────────
    let y = 30;
    doc.setFillColor(...SLATE);
    doc.roundedRect(ML, y, CW, 16, 2, 2, "F");
    const cols4 = CW / 4;
    const metas = [
      ["SOLICITANTE",     req.solicitante],
      ["ENTREGA DESEJADA", entrega],
      ["PRIORIDADE",      req.prioridade.toUpperCase()],
      ["ITENS",           `${ativos.length} item(ns)`],
    ];
    metas.forEach(([lbl, val], i) => {
      const x = ML + i * cols4 + 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(130, 130, 130);
      doc.text(lbl, x, y + 5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text(val, x, y + 12);
    });

    // ── Instrução ──────────────────────────────────────────────────────────────
    y += 20;
    doc.setFillColor(...BLUE_LIGHT);
    doc.setDrawColor(191, 219, 254);
    doc.setLineWidth(0.3);
    doc.roundedRect(ML, y, CW, 14, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(30, 58, 95);
    doc.text("Instruções ao Fornecedor:", ML + 4, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const instrLines = doc.splitTextToSize(
      "Preencha o preço unitário de cada item na coluna destacada. Informe também os dados da empresa, prazo de entrega, condições de pagamento e validade da proposta. Retorne este documento preenchido por e-mail ou WhatsApp para análise e aprovação." +
      (req.observacoes ? `  Obs.: ${req.observacoes}` : ""),
      CW - 8
    );
    doc.text(instrLines.slice(0, 2), ML + 4, y + 10);

    // ── Seção "Itens para Cotação" ─────────────────────────────────────────────
    y += 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...BLUE);
    doc.text("ITENS PARA COTAÇÃO", ML, y + 4);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(ML, y + 6, PW - MR, y + 6);

    y += 8;

    // ── Tabela de itens ────────────────────────────────────────────────────────
    const tableRows = ativos.map(({ item, idx }, i) => [
      String(i + 1),
      item.descricao,
      item.unidade,
      String(qtdAtual(idx, item.quantidade)).replace(".", ","),
      "",  // Marca / Modelo — preencher pelo fornecedor
      "",  // Preço Unit. — preencher pelo fornecedor
      "",  // Valor Total — preencher pelo fornecedor
    ]);

    // linha de totais
    const footRow = [{ content: "TOTAL GERAL", colSpan: 6, styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: SLATE } },
                     { content: "R$", styles: { halign: "center" as const, fontStyle: "bold" as const, fillColor: SLATE } }];

    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      head: [[
        { content: "#",                             styles: { halign: "center" } },
        { content: "Descrição do Material / Serviço", styles: { halign: "left"   } },
        { content: "UN",                            styles: { halign: "center" } },
        { content: "QTD",                           styles: { halign: "center" } },
        { content: "Marca / Modelo",                styles: { halign: "center" } },
        { content: "Preço Unit. (R$)",              styles: { halign: "center" } },
        { content: "Valor Total (R$)",              styles: { halign: "center" } },
      ]],
      body: tableRows,
      foot: [footRow],
      showFoot: "lastPage",
      headStyles: {
        fillColor: BLUE,
        textColor: [255, 255, 255] as [number, number, number],
        fontStyle: "bold",
        fontSize: 8,
        cellPadding: 3,
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 2.5,
        lineColor: [226, 232, 240] as [number, number, number],
        lineWidth: 0.2,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252] as [number, number, number],
      },
      columnStyles: {
        0: { cellWidth: 8,  halign: "center" },
        1: { cellWidth: "auto" },
        2: { cellWidth: 13, halign: "center" },
        3: { cellWidth: 15, halign: "center" },
        4: { cellWidth: 32, halign: "left",   fillColor: YELLOW },  // Marca/Modelo
        5: { cellWidth: 26, halign: "center", fillColor: YELLOW },  // Preço Unit.
        6: { cellWidth: 26, halign: "center", fillColor: YELLOW },  // Valor Total
      },
      didParseCell(data) {
        // Garantir fundo amarelo nas colunas Marca/Preço/Total (a serem preenchidas)
        if (data.section === "body" && (data.column.index === 4 || data.column.index === 5 || data.column.index === 6)) {
          data.cell.styles.fillColor = YELLOW;
        }
      },
    });

    // ── Dados do Fornecedor ────────────────────────────────────────────────────
    y = (doc as any).lastAutoTable.finalY + 8;

    // nova página se não couber
    if (y > 220) { doc.addPage(); y = 16; }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...BLUE);
    doc.text("DADOS DO FORNECEDOR", ML, y);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(ML, y + 2, PW - MR, y + 2);
    y += 6;

    const supplierFields = [
      ["Razão Social / Nome Fantasia", "CNPJ / CPF"],
      ["Telefone / WhatsApp",          "E-mail"],
      ["Prazo de Entrega",             "Condição de Pagamento"],
      ["Frete (CIF / FOB / Incluso / A combinar)", "Validade desta Proposta"],
    ];
    const halfW = (CW - 6) / 2;
    supplierFields.forEach((row) => {
      row.forEach((lbl, ci) => {
        const fx = ML + ci * (halfW + 6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(130, 130, 130);
        doc.text(lbl.toUpperCase(), fx, y);
        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(0.4);
        doc.line(fx, y + 7, fx + halfW, y + 7);
      });
      y += 12;
    });

    // Campo Observações
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.text("OBSERVAÇÕES / CONDIÇÕES ESPECIAIS", ML, y);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.4);
    doc.line(ML, y + 7, PW - MR, y + 7);
    doc.line(ML, y + 14, PW - MR, y + 14);
    y += 18;

    // ── Assinaturas ────────────────────────────────────────────────────────────
    y += 6;
    doc.setDrawColor(55, 65, 81);
    doc.setLineWidth(0.5);
    doc.line(ML, y, ML + halfW, y);
    doc.line(ML + halfW + 6, y, PW - MR, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Assinatura e Carimbo do Fornecedor", ML + halfW / 2, y + 5, { align: "center" });
    doc.text("Data  _____ / _____ / _________", ML + halfW + 6 + halfW / 2, y + 5, { align: "center" });

    // ── Rodapé ─────────────────────────────────────────────────────────────────
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(ML, 285, PW - MR, 285);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Documento gerado em ${hoje}  ·  ${req.numero}  ·  Este documento não tem valor fiscal  ·  61Brasil Construtora & Incorporadora  ·  Pág. ${p}/${pageCount}`,
        PW / 2, 289, { align: "center" }
      );
    }

    doc.save(`Cotacao_${req.numero}_${dataArq}.pdf`);
  }

  const { data: requisicoes = [], isLoading } = useQuery<Requisicao[]>({
    queryKey: ["requisicoes"],
    queryFn: () => suprimentosApi.listarRequisicoes(),
  });

  const { data: obras = [] } = useQuery<ObraResumida[]>({
    queryKey: ["obras-lista"],
    queryFn: () => suprimentosApi.listarObras(),
  });

  const hoje = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState<RequisicaoCreate>({
    obra_id: null, solicitante: "", data_solicitacao: hoje, prioridade: "normal", itens: [],
  });
  const [itemNovo, setItemNovo] = useState({ descricao: "", unidade: "un", quantidade: 1 });
  const [colarAberto, setColarAberto] = useState(false);
  const [textoColar, setTextoColar] = useState("");

  function parseColar() {
    const linhas = textoColar.split(/\r?\n/).filter(l => l.trim());
    const novos: { descricao: string; unidade: string; quantidade: number }[] = [];
    for (const linha of linhas) {
      const cols = linha.split("\t").map(c => c.trim());
      const descricao = cols[0] ?? "";
      const unidade   = cols[1] ?? "un";
      const qtd       = parseFloat((cols[2] ?? "1").replace(",", ".")) || 1;
      if (descricao) novos.push({ descricao, unidade, quantidade: qtd });
    }
    if (novos.length) {
      setForm(f => ({ ...f, itens: [...(f.itens ?? []), ...novos] }));
      setTextoColar("");
      setColarAberto(false);
    }
  }

  async function importarItensXlsx(file: File) {
    setImportandoItens(true);
    try {
      const res = await suprimentosApi.xlsxReqImportarItens(file);
      if (res.itens.length) {
        setForm(f => ({ ...f, itens: [...(f.itens ?? []), ...res.itens] }));
      }
      setItensImportErr(res.erros);
    } catch {
      setItensImportErr(["Erro ao processar arquivo."]);
    } finally {
      setImportandoItens(false);
      if (fileItensRef.current) fileItensRef.current.value = "";
    }
  }

  const criar = useMutation({
    mutationFn: () => suprimentosApi.criarRequisicao(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["requisicoes"] }); setAberto(false); },
    onError: (e: any) => setErr(parseApiError(e)),
  });

  const simularReq = useMutation({
    mutationFn: () => suprimentosApi.criarRequisicao({
      solicitante: "Demo — Eng. Carlos Menezes",
      data_solicitacao: new Date().toISOString().slice(0, 10),
      data_entrega_prevista: new Date(Date.now() + 21 * 86400_000).toISOString().slice(0, 10),
      prioridade: "normal",
      observacoes: "Requisição de demonstração — materiais para fundação e alvenaria do Bloco B.",
      itens: [
        { descricao: "Cimento CP II-E 50 kg",              unidade: "SC",  quantidade: 500 },
        { descricao: "Areia lavada média",                  unidade: "M3",  quantidade: 30  },
        { descricao: "Brita 1 (granulometria 9,5–25 mm)",  unidade: "M3",  quantidade: 20  },
        { descricao: "Tijolo cerâmico furado 9×14×19 cm",  unidade: "UN",  quantidade: 5000},
        { descricao: "Vergalhão CA-50 Ø10 mm",             unidade: "KG",  quantidade: 500 },
        { descricao: "Tela soldada Q-92",                   unidade: "M2",  quantidade: 50  },
        { descricao: "Cal hidratada CH-III 20 kg",         unidade: "SC",  quantidade: 100 },
      ],
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requisicoes"] }),
    onError: (e: any) => alert(parseApiError(e, "Erro ao criar simulação")),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => suprimentosApi.excluirRequisicao(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requisicoes"] }),
  });

  const atualizarStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StatusRequisicao }) =>
      suprimentosApi.atualizarRequisicao(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requisicoes"] }),
  });

  const reqFiltradas = useMemo(() => {
    const q = buscaReq.toLowerCase().trim();
    return requisicoes.filter(r => {
      const matchQ = !q || r.numero.toLowerCase().includes(q) || r.solicitante.toLowerCase().includes(q);
      const matchS = !filtroStatusReq || r.status === filtroStatusReq;
      const matchP = !filtroPrioridade || r.prioridade === filtroPrioridade;
      return matchQ && matchS && matchP;
    });
  }, [requisicoes, buscaReq, filtroStatusReq, filtroPrioridade]);

  return (
    <>
      <div className="flex justify-end gap-2 mb-4">
        <button
          onClick={() => {
            if (!confirm("Criar uma requisição de demonstração com 7 materiais para estrutura e alvenaria?")) return;
            simularReq.mutate();
          }}
          disabled={simularReq.isPending}
          title="Cria uma requisição de demonstração com materiais típicos de obra"
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-60">
          <Zap size={15} /> {simularReq.isPending ? "Criando…" : "Simular Requisição"}
        </button>
        <button onClick={() => setAberto(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700">
          <Plus size={16} /> Nova requisição
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="Buscar por número ou solicitante…"
          value={buscaReq}
          onChange={e => setBuscaReq(e.target.value)}
          className="flex-1 min-w-[200px] text-sm px-3 py-1.5 border border-slate-200 rounded-lg outline-none focus:border-brand-400 bg-white"
        />
        <select
          value={filtroStatusReq}
          onChange={e => setFiltroStatusReq(e.target.value)}
          className="text-sm px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-600 outline-none focus:border-brand-400">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_REQ_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select
          value={filtroPrioridade}
          onChange={e => setFiltroPrioridade(e.target.value)}
          className="text-sm px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-600 outline-none focus:border-brand-400">
          <option value="">Todas as prioridades</option>
          <option value="baixa">Baixa</option>
          <option value="normal">Normal</option>
          <option value="alta">Alta</option>
          <option value="urgente">Urgente</option>
        </select>
        {(buscaReq || filtroStatusReq || filtroPrioridade) && (
          <button
            onClick={() => { setBuscaReq(""); setFiltroStatusReq(""); setFiltroPrioridade(""); }}
            className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5 border border-slate-200 rounded-lg bg-white">
            Limpar
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-sm p-6">Carregando…</div>
      ) : (
        <div className="space-y-2">
          {reqFiltradas.map(r => (
            <div key={r.id} className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between gap-3">
                {/* Esquerda: badges */}
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded flex-shrink-0">{r.numero}</span>
                  <span className={clsx("px-2 py-0.5 text-xs rounded-full font-medium flex-shrink-0", STATUS_REQ_COR[r.status as StatusRequisicao])}>
                    {STATUS_REQ_LABELS[r.status as StatusRequisicao]}
                  </span>
                  <span className={clsx("px-2 py-0.5 text-xs rounded-full font-medium flex-shrink-0", PRIORIDADE_COR[r.prioridade])}>
                    {r.prioridade}
                  </span>
                  <span className="text-sm text-slate-600 truncate">
                    <span className="font-medium">{r.solicitante}</span>
                    {" · "}{r.data_solicitacao}
                    {r.data_entrega_prevista && <span className="text-slate-400"> · entrega {r.data_entrega_prevista}</span>}
                  </span>
                </div>
                {/* Direita: ações */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => abrirAnalise(r)}
                    title="Ver detalhes e aprovar"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 text-slate-600 rounded-lg hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700 transition-colors">
                    <Eye size={13} /> Analisar
                  </button>
                  <select
                    value={r.status}
                    onChange={e => atualizarStatus.mutate({ id: r.id, status: e.target.value as StatusRequisicao })}
                    className="text-xs py-1.5 px-2 h-7 border border-slate-200 rounded-lg bg-white text-slate-600 focus:border-brand-400 outline-none min-w-[120px]">
                    {Object.entries(STATUS_REQ_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                  <button onClick={() => { if (confirm("Excluir?")) excluir.mutate(r.id); }}
                    className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                </div>
              </div>
              {r.itens.length > 0 && (
                <div className="mt-2 text-xs text-slate-400">
                  {r.itens.length} item(ns): {r.itens.slice(0, 4).map((i: any) => i.descricao).join(", ")}
                  {r.itens.length > 4 && " …"}
                </div>
              )}
            </div>
          ))}
          {reqFiltradas.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              {requisicoes.length === 0 ? "Nenhuma requisição registrada" : "Nenhuma requisição encontrada para os filtros aplicados"}
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Detalhes / Análise / Aprovação ──────────────────────────── */}
      {visualizando && (
        <Modal
          aberto={!!visualizando}
          onFechar={() => setVisualizando(null)}
          titulo={`Análise — ${visualizando.numero}`}
          largura="2xl">
          <div className="space-y-4">
            {/* Meta */}
            <div className="grid grid-cols-4 gap-3 bg-slate-50 rounded-lg px-4 py-3 text-sm">
              <div>
                <span className="text-xs text-slate-500 block">Solicitante</span>
                <span className="font-semibold text-slate-800">{visualizando.solicitante}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Status</span>
                <span className={clsx("px-2 py-0.5 text-xs rounded-full font-medium",
                  STATUS_REQ_COR[visualizando.status as StatusRequisicao])}>
                  {STATUS_REQ_LABELS[visualizando.status as StatusRequisicao]}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Data solicitação</span>
                <span className="text-slate-700">{visualizando.data_solicitacao}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Entrega prevista</span>
                <span className="text-slate-700">{visualizando.data_entrega_prevista ?? "—"}</span>
              </div>
              {visualizando.observacoes && (
                <div className="col-span-4">
                  <span className="text-xs text-slate-500 block">Observações</span>
                  <span className="text-slate-700 italic">{visualizando.observacoes}</span>
                </div>
              )}
            </div>

            {/* Tabela de itens com exclusão */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-700">
                  Itens da requisição
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    {visualizando.itens.length - excluidos.size} de {visualizando.itens.length} para cotação
                  </span>
                  {excluidos.size > 0 && (
                    <span className="ml-2 text-xs text-red-500">
                      · {excluidos.size} excluído(s)
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  {Object.keys(qtdEditada).length > 0 && (
                    <>
                      <button
                        onClick={() => setQtdEditada({})}
                        disabled={salvandoQtd}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 px-2 py-1 rounded-lg hover:bg-slate-50 disabled:opacity-50">
                        <RotateCcw size={11} /> Desfazer
                      </button>
                      <button
                        onClick={salvarQuantidades}
                        disabled={salvandoQtd}
                        className="flex items-center gap-1 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 px-2.5 py-1 rounded-lg disabled:opacity-50">
                        {salvandoQtd ? "Salvando..." : `💾 Salvar ${Object.keys(qtdEditada).length} qtd${Object.keys(qtdEditada).length>1?'s':''}`}
                      </button>
                    </>
                  )}
                  {excluidos.size > 0 && (
                    <button
                      onClick={() => setExcluidos(new Set())}
                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 px-2 py-1 rounded-lg hover:bg-slate-50">
                      <RotateCcw size={11} /> Restaurar todos
                    </button>
                  )}
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr className="text-left text-xs text-slate-500 font-medium uppercase tracking-wide border-b border-slate-200">
                      <th className="px-3 py-2 w-8">#</th>
                      <th className="px-3 py-2">Descrição</th>
                      <th className="px-3 py-2 text-center w-14">Un</th>
                      <th className="px-3 py-2 text-right w-16">Qtd</th>
                      <th className="px-3 py-2 text-right w-20">Estoque</th>
                      <th className="px-3 py-2 w-32">Obs.</th>
                      <th className="px-3 py-2 w-16 text-center">Cotação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visualizando.itens.map((item: any, idx: number) => {
                      const excl = excluidos.has(idx);
                      const estq = estoqueParaItem(item.descricao ?? "");
                      const qtdReal = qtdAtual(idx, item.quantidade);
                      const editado = qtdEditada[idx] !== undefined && qtdEditada[idx] !== item.quantidade;
                      const temSuficiente = estq && estq.qtd >= qtdReal;
                      const temParcial = estq && estq.qtd > 0 && estq.qtd < qtdReal;
                      return (
                        <tr key={idx}
                          className={clsx("border-t border-slate-100 transition-colors",
                            excl ? "bg-red-50/40" : "hover:bg-slate-50")}>
                          <td className="px-3 py-2 text-xs text-slate-400">{idx + 1}</td>
                          <td className={clsx("px-3 py-2 font-medium",
                            excl ? "line-through text-slate-400" : "text-slate-800")}>
                            {item.descricao}
                          </td>
                          <td className={clsx("px-3 py-2 text-center text-xs",
                            excl ? "text-slate-300" : "text-slate-500")}>
                            {item.unidade}
                          </td>
                          <td className={clsx("px-3 py-2 text-right font-mono",
                            excl && "text-slate-300 line-through")}>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              disabled={excl}
                              value={qtdReal}
                              onChange={(e) => {
                                const v = e.target.value === "" ? 0 : Number(e.target.value);
                                setQtdEditada(prev => ({ ...prev, [idx]: v }));
                              }}
                              className={clsx(
                                "w-16 px-1.5 py-0.5 text-right font-mono text-sm rounded border transition-colors",
                                excl ? "bg-slate-50 border-transparent text-slate-300" :
                                editado ? "bg-amber-50 border-amber-300 text-amber-800 font-bold focus:ring-1 focus:ring-amber-400" :
                                "bg-transparent border-transparent hover:border-slate-300 focus:border-brand-500 focus:ring-1 focus:ring-brand-400 text-slate-700"
                              )}
                              title={editado ? `Original: ${item.quantidade}` : "Clique para editar"}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            {estq ? (
                              <span className={clsx(
                                "inline-block text-xs font-mono px-1.5 py-0.5 rounded",
                                temSuficiente
                                  ? "bg-emerald-100 text-emerald-700"
                                  : temParcial
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-red-100 text-red-600"
                              )}>
                                {estq.qtd.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} {estq.un}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-400 italic">
                            {item.observacao ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => toggleExcluir(idx)}
                              title={excl ? "Reincluir na cotação" : "Excluir desta cotação"}
                              className={clsx(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors",
                                excl
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                  : "bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600"
                              )}>
                              {excl
                                ? <><RotateCcw size={10} /> Incluir</>
                                : <><XCircle size={10} /> Excluir</>
                              }
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {excluidos.size > 0 && (
                <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
                  <AlertTriangle size={11} className="text-amber-500" />
                  Itens excluídos ficam riscados e NÃO entram no PDF de cotação. Clique em "Incluir" para reverter.
                </p>
              )}
            </div>

            {/* Linha separadora e ações */}
            <div className="border-t border-slate-100 pt-3 space-y-3">
              {/* Gerar PDF */}
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                <Printer size={18} className="text-blue-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-800">Documento de Cotação para Fornecedores</p>
                  <p className="text-xs text-blue-600">
                    {visualizando.itens.length - excluidos.size} item(ns) selecionado(s)
                    {excluidos.size > 0 && ` · ${excluidos.size} excluído(s) desta cotação`}
                  </p>
                </div>
                <button
                  onClick={() => gerarPDFCotacao(visualizando, excluidos)}
                  disabled={visualizando.itens.length === excluidos.size}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex-shrink-0">
                  <Download size={14} /> Gerar PDF de Cotação
                </button>
              </div>

              {/* Aprovação */}
              <div>
                <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Aprovação</p>
                <div className="flex flex-wrap gap-2">
                  {visualizando.status !== "aprovada" && (
                    <button
                      onClick={() => {
                        atualizarStatus.mutate({ id: visualizando.id, status: "aprovada" });
                        setVisualizando(prev => prev ? { ...prev, status: "aprovada" } : null);
                      }}
                      disabled={atualizarStatus.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-60">
                      <CheckCircle2 size={14} /> Aprovar
                    </button>
                  )}
                  {visualizando.status !== "em_cotacao" && (
                    <button
                      onClick={() => {
                        atualizarStatus.mutate({ id: visualizando.id, status: "em_cotacao" });
                        setVisualizando(prev => prev ? { ...prev, status: "em_cotacao" } : null);
                      }}
                      disabled={atualizarStatus.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60">
                      <ShoppingCart size={14} /> Em Cotação
                    </button>
                  )}
                  {visualizando.status !== "cancelada" && (
                    <button
                      onClick={() => {
                        if (!confirm("Cancelar esta requisição?")) return;
                        atualizarStatus.mutate({ id: visualizando.id, status: "cancelada" });
                        setVisualizando(prev => prev ? { ...prev, status: "cancelada" } : null);
                      }}
                      disabled={atualizarStatus.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 disabled:opacity-60">
                      <XCircle size={14} /> Cancelar req.
                    </button>
                  )}
                  <button
                    onClick={() => setVisualizando(null)}
                    className="ml-auto px-4 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50">
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: Nova Requisição ─────────────────────────────────────────── */}
      <Modal aberto={aberto} onFechar={() => setAberto(false)} titulo="Nova requisição de material" largura="2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="Obra (opcional)" value={form.obra_id ?? ""}
              onChange={e => setForm(f => ({ ...f, obra_id: e.target.value || null }))}>
              <option value="">— Empresa / Geral —</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </Select>
            <Select label="Prioridade" value={form.prioridade ?? "normal"}
              onChange={e => setForm(f => ({ ...f, prioridade: e.target.value as any }))}>
              <option value="baixa">Baixa</option>
              <option value="normal">Normal</option>
              <option value="urgente">Urgente</option>
            </Select>
            <Input label="Solicitante" required value={form.solicitante}
              onChange={e => setForm(f => ({ ...f, solicitante: e.target.value }))} />
            <Input label="Data" type="date" value={form.data_solicitacao}
              onChange={e => setForm(f => ({ ...f, data_solicitacao: e.target.value }))} />
            <div className="col-span-2">
              <Input label="Entrega prevista" type="date" value={form.data_entrega_prevista ?? ""}
                onChange={e => setForm(f => ({ ...f, data_entrega_prevista: e.target.value || null }))} />
            </div>
          </div>

          {/* Itens */}
          <div>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <p className="text-sm font-medium text-slate-700">
                Itens solicitados
                {(form.itens ?? []).length > 0 && (
                  <span className="ml-1.5 text-xs text-slate-400">({(form.itens ?? []).length})</span>
                )}
              </p>
              <div className="flex items-center gap-1.5">
                <button onClick={() => suprimentosApi.xlsxReqTemplate()}
                  title="Baixar modelo de planilha"
                  className="flex items-center gap-1 px-2 py-1 text-xs border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50">
                  <Download size={11} /> Modelo
                </button>
                <button
                  onClick={() => fileItensRef.current?.click()}
                  disabled={importandoItens}
                  title="Importar itens de planilha Excel"
                  className="flex items-center gap-1 px-2 py-1 text-xs border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 disabled:opacity-50">
                  <Upload size={11} /> {importandoItens ? "…" : "Excel"}
                </button>
                <input ref={fileItensRef} type="file" accept=".xlsx" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) importarItensXlsx(f); }} />
                <button
                  onClick={() => { setColarAberto(v => !v); setTextoColar(""); }}
                  className={clsx(
                    "flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border transition-colors",
                    colarAberto
                      ? "bg-brand-600 text-white border-brand-600"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  )}>
                  <ClipboardList size={11} /> Colar
                </button>
              </div>
            </div>
            {itensImportErr.length > 0 && (
              <div className="mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                {itensImportErr.map((e, i) => <p key={i}>{e}</p>)}
                <button onClick={() => setItensImportErr([])} className="mt-1 underline">fechar</button>
              </div>
            )}

            {/* Painel colar */}
            {colarAberto && (
              <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-500 mb-1.5">
                  Cole aqui as colunas copiadas da planilha (3 colunas: <b>Descrição</b> · <b>Unidade</b> · <b>Quantidade</b>)
                </p>
                <textarea
                  rows={4}
                  autoFocus
                  value={textoColar}
                  onChange={e => setTextoColar(e.target.value)}
                  placeholder={"Cimento CP-III\tsc\t50\nAreia lavada\tm³\t10\nBrita 1\ttt\t15"}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs font-mono focus:border-brand-400 outline-none resize-none"
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={parseColar}
                    disabled={!textoColar.trim()}
                    className="px-3 py-1.5 bg-brand-600 text-white rounded text-xs font-medium hover:bg-brand-700 disabled:opacity-50">
                    Adicionar itens
                  </button>
                  <button onClick={() => setColarAberto(false)}
                    className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded text-xs hover:bg-slate-100">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Catálogo com autocomplete e navegação por família */}
            <MaterialSearch
              onAddItens={novos =>
                setForm(f => ({ ...f, itens: [...(f.itens ?? []), ...novos] }))
              }
            />

            {/* Lista de itens adicionados */}
            {(form.itens ?? []).length > 0 && (
              <div className="max-h-36 overflow-y-auto space-y-1 mt-1">
                {(form.itens ?? []).map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="flex-1 bg-slate-50 rounded px-2 py-1 truncate">{item.descricao}</span>
                    <input
                      type="number" min="0.001" step="0.001"
                      value={item.quantidade}
                      onChange={e => setForm(f => ({
                        ...f,
                        itens: f.itens!.map((x, j) => j === i ? { ...x, quantidade: +e.target.value } : x),
                      }))}
                      className="w-16 text-xs text-right px-1.5 py-1 border border-slate-200 rounded focus:border-brand-400 outline-none" />
                    <span className="text-slate-400 text-xs w-8">{item.unidade}</span>
                    <button onClick={() => setForm(f => ({ ...f, itens: f.itens!.filter((_, j) => j !== i) }))}
                      className="text-red-400 hover:text-red-600 flex-shrink-0"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Linha de adição manual */}
            <div className="flex gap-2">
              <input placeholder="Item manual…" value={itemNovo.descricao}
                onChange={e => setItemNovo(n => ({ ...n, descricao: e.target.value }))}
                className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm outline-none focus:border-brand-400" />
              <input placeholder="Un" value={itemNovo.unidade}
                onChange={e => setItemNovo(n => ({ ...n, unidade: e.target.value }))}
                className="w-14 px-2 py-1.5 border border-slate-200 rounded text-sm text-center outline-none focus:border-brand-400" />
              <input type="number" placeholder="Qtd" value={itemNovo.quantidade}
                onChange={e => setItemNovo(n => ({ ...n, quantidade: +e.target.value }))}
                className="w-16 px-2 py-1.5 border border-slate-200 rounded text-sm text-right outline-none focus:border-brand-400" />
              <button
                onClick={() => {
                  if (!itemNovo.descricao.trim()) return;
                  setForm(f => ({ ...f, itens: [...(f.itens ?? []), { ...itemNovo }] }));
                  setItemNovo({ descricao: "", unidade: "un", quantidade: 1 });
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-sm font-medium whitespace-nowrap">
                + Add
              </button>
            </div>
          </div>

          {err && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">{err}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setAberto(false)}
              className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={() => criar.mutate()}
              disabled={!form.solicitante.trim() || criar.isPending}
              className="flex-1 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60">
              {criar.isPending ? "Criando…" : "Criar requisição"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Ordens de Compra
// ══════════════════════════════════════════════════════════════════════════════

// Etapas de cancelamento de OC
type EtapaCancelamento = 1 | 2;

function OrdensCompraTab() {
  const qc = useQueryClient();

  // ── Estado: cancelamento com 2 disclaimers ─────────────────────────────────
  const [cancelModal, setCancelModal] = useState<{ oc: OrdemCompra; etapa: EtapaCancelamento; motivo: string } | null>(null);
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false);
  // Filtros
  const [buscaOC, setBuscaOC] = useState("");
  const [filtroStatusOC, setFiltroStatusOC] = useState("");

  const { data: ocs = [], isLoading } = useQuery<OrdemCompra[]>({
    queryKey: ["ordens-compra"],
    queryFn: () => suprimentosApi.listarOCs(),
  });

  // OCs visíveis (oculta arquivadas por padrão)
  const ocsVisiveis = mostrarArquivadas
    ? ocs
    : ocs.filter(oc => oc.status !== "arquivada");

  const ocsFiltradas = useMemo(() => {
    const q = buscaOC.toLowerCase().trim();
    return ocsVisiveis.filter(oc => {
      const matchQ = !q || oc.numero.toLowerCase().includes(q) ||
        (oc.fornecedor_nome ?? "").toLowerCase().includes(q);
      const matchS = !filtroStatusOC || oc.status === filtroStatusOC;
      return matchQ && matchS;
    });
  }, [ocsVisiveis, buscaOC, filtroStatusOC]);

  const atualizarStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StatusOC }) =>
      suprimentosApi.atualizarOC(id, { status }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["ordens-compra"] });
      // Quando OC vai para financeiro → backend cria lançamento automaticamente
      if (vars.status === "aguardando_pagamento") {
        qc.invalidateQueries({ queryKey: ["financeiro"] });
        qc.invalidateQueries({ queryKey: ["financeiro-resumo"] });
      }
    },
  });

  const cancelarOC = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      suprimentosApi.cancelarOC(id, motivo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ordens-compra"] });
      qc.invalidateQueries({ queryKey: ["requisicoes"] });
      setCancelModal(null);
    },
    onError: (e: any) => alert(parseApiError(e, "Erro ao cancelar OC")),
  });

  const arquivarOC = useMutation({
    mutationFn: (id: string) => suprimentosApi.arquivarOC(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ordens-compra"] }),
  });

  // Ícone de status financeiro
  const statusFinanceiroLabel: Record<StatusOC, { label: string; cor: string }> = {
    rascunho:             { label: "Aguardando aprovação", cor: "text-slate-500" },
    aprovada:             { label: "Aguardando envio ao financeiro", cor: "text-amber-600" },
    aguardando_pagamento: { label: "Aguardando pagamento pelo financeiro", cor: "text-amber-600" },
    paga:                 { label: "Paga — aguardando entrega", cor: "text-blue-600" },
    entregue:             { label: "Entregue e encerrada", cor: "text-emerald-600" },
    cancelada:            { label: "Cancelada", cor: "text-red-500" },
    arquivada:            { label: "Arquivada", cor: "text-slate-400" },
  };

  const arquivadas = ocs.filter(o => o.status === "arquivada").length;

  return (
    <>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs text-slate-500 mt-0.5">
            OCs geradas automaticamente pelo Comparativo de Cotações
          </p>
        </div>
        {arquivadas > 0 && (
          <button
            onClick={() => setMostrarArquivadas(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50">
            <Archive size={13} />
            {mostrarArquivadas ? "Ocultar" : `Ver ${arquivadas} arquivada(s)`}
          </button>
        )}
      </div>

      {/* Aviso sobre fluxo */}
      <div className="mb-4 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700">
        <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
        <span>
          As Ordens de Compra são geradas a partir do Comparativo de Cotações. Após aprovação, o pagamento é
          processado pela aba <strong>Financeiro</strong>. O status aqui reflete o andamento deste processo.
        </span>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="Buscar por número ou fornecedor…"
          value={buscaOC}
          onChange={e => setBuscaOC(e.target.value)}
          className="flex-1 min-w-[200px] text-sm px-3 py-1.5 border border-slate-200 rounded-lg outline-none focus:border-brand-400 bg-white"
        />
        <select
          value={filtroStatusOC}
          onChange={e => setFiltroStatusOC(e.target.value)}
          className="text-sm px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-600 outline-none focus:border-brand-400">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_OC_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        {(buscaOC || filtroStatusOC) && (
          <button
            onClick={() => { setBuscaOC(""); setFiltroStatusOC(""); }}
            className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5 border border-slate-200 rounded-lg bg-white">
            Limpar
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-sm p-6">Carregando…</div>
      ) : ocs.length === 0 ? (
        <div className="py-16 text-center text-slate-400">
          <Truck size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma ordem de compra</p>
          <p className="text-xs mt-1">Use o Comparativo na aba Cotações para gerar OCs automaticamente.</p>
        </div>
      ) : ocsFiltradas.length === 0 ? (
        <div className="py-12 text-center text-slate-400">Nenhuma OC encontrada para os filtros aplicados</div>
      ) : (
        <div className="space-y-3">
          {ocsFiltradas.map(oc => {
            const fin = statusFinanceiroLabel[oc.status as StatusOC];
            const podeAprovar = oc.status === "rascunho";
            const podeCancelar = !["cancelada", "arquivada", "entregue"].includes(oc.status);
            const podeArquivar = ["entregue", "cancelada"].includes(oc.status);
            return (
              <div key={oc.id}
                className={clsx(
                  "border rounded-xl p-4 transition-colors",
                  oc.status === "cancelada" ? "border-red-200 bg-red-50/30" :
                  oc.status === "arquivada" ? "border-slate-100 bg-slate-50/50 opacity-60" :
                  oc.status === "entregue"  ? "border-teal-200 bg-teal-50/20" :
                  "border-slate-200 bg-white hover:border-slate-300"
                )}>
                {/* Linha 1: identificação + valor */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{oc.numero}</span>
                    <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", STATUS_OC_COR[oc.status as StatusOC])}>
                      {STATUS_OC_LABELS[oc.status as StatusOC]}
                    </span>
                    <span className="text-sm font-bold text-slate-800">{fmt(oc.valor_total)}</span>
                  </div>
                  {/* Ações */}
                  <div className="flex items-center gap-2">
                    {podeAprovar && (
                      <button
                        onClick={() => atualizarStatus.mutate({ id: oc.id, status: "aprovada" })}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium">
                        <CheckCircle2 size={13} /> Aprovar OC
                      </button>
                    )}
                    {oc.status === "aprovada" && (
                      <button
                        onClick={() => atualizarStatus.mutate({ id: oc.id, status: "aguardando_pagamento" })}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium">
                        <Send size={13} /> Enviar ao Financeiro
                      </button>
                    )}
                    {/* Pagamento confirmado pelo Financeiro — sem botão aqui */}
                    {podeArquivar && (
                      <button
                        onClick={() => {
                          if (confirm(`Arquivar ${oc.numero}? A OC será removida da lista ativa.`))
                            arquivarOC.mutate(oc.id);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
                        <Archive size={13} /> Arquivar
                      </button>
                    )}
                    {podeCancelar && (
                      <button
                        onClick={() => setCancelModal({ oc, etapa: 1, motivo: "" })}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                        <XCircle size={13} /> Cancelar
                      </button>
                    )}
                  </div>
                </div>

                {/* Linha 2: fornecedor + datas */}
                <div className="mt-2 text-sm text-slate-600">
                  <span className="font-medium">{oc.fornecedor_nome ?? "Sem fornecedor"}</span>
                  <span className="mx-2 text-slate-300">·</span>
                  <span className="text-xs text-slate-500">Emissão: {oc.data_emissao}</span>
                  {oc.prazo_entrega && (
                    <><span className="mx-2 text-slate-300">·</span>
                    <span className="text-xs text-slate-500">Prazo: {oc.prazo_entrega}</span></>
                  )}
                  {oc.itens.length > 0 && (
                    <><span className="mx-2 text-slate-300">·</span>
                    <span className="text-xs text-slate-500">{oc.itens.length} item(ns)</span></>
                  )}
                </div>

                {/* Linha 3: status financeiro */}
                {fin && (
                  <div className={clsx("mt-1.5 text-xs flex items-center gap-1.5", fin.cor)}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
                    {fin.label}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal: Cancelamento — Etapa 1 ──────────────────────────────────── */}
      {cancelModal?.etapa === 1 && (
        <Modal aberto onFechar={() => setCancelModal(null)} titulo="Cancelar Ordem de Compra" largura="md">
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm text-amber-800">
                <p className="font-semibold">Atenção: esta ação não pode ser desfeita.</p>
                <p>
                  Ao cancelar a OC <strong>{cancelModal.oc.numero}</strong>, uma <strong>nova requisição</strong> será
                  criada automaticamente com todos os itens desta OC, reiniciando o processo de cotação.
                </p>
                <p className="text-xs text-amber-700 mt-2 border-t border-amber-200 pt-2">
                  <strong>Exemplos de uso válido:</strong> o fornecedor se recusa a entregar apenas parte dos itens e
                  os preços são válidos somente para o pedido completo; ou materiais disponíveis em estoque de outra
                  obra dispensam parte do pedido antes do pagamento.
                </p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Motivo do cancelamento <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                autoFocus
                value={cancelModal.motivo}
                onChange={e => setCancelModal(m => m ? { ...m, motivo: e.target.value } : m)}
                placeholder="Ex.: Fornecedor recusa parcialidade da compra; material encontrado em estoque de outra obra..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-amber-400 outline-none resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCancelModal(null)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
                Voltar
              </button>
              <button
                disabled={!cancelModal.motivo.trim()}
                onClick={() => setCancelModal(m => m ? { ...m, etapa: 2 } : m)}
                className="flex-1 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
                Continuar →
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: Cancelamento — Etapa 2 (confirmação final) ──────────────── */}
      {cancelModal?.etapa === 2 && (
        <Modal aberto onFechar={() => setCancelModal(null)} titulo="Confirmar Cancelamento" largura="md">
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
              <XCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm text-red-800">
                <p className="font-semibold">Esta é a confirmação final. Leia com atenção:</p>
                <ul className="list-disc list-inside space-y-1 text-xs text-red-700">
                  <li>A OC <strong>{cancelModal.oc.numero}</strong> será marcada como <strong>Cancelada</strong>.</li>
                  <li>Uma nova requisição será criada com os itens desta OC.</li>
                  <li>A nova requisição precisará passar por <strong>aprovação e nova cotação</strong>.</li>
                  <li>O motivo registrado ficará no histórico da OC cancelada.</li>
                </ul>
                <p className="mt-2 text-xs">
                  <strong>Motivo informado:</strong> {cancelModal.motivo}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCancelModal(m => m ? { ...m, etapa: 1 } : m)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
                ← Voltar
              </button>
              <button
                disabled={cancelarOC.isPending}
                onClick={() => cancelarOC.mutate({ id: cancelModal!.oc.id, motivo: cancelModal!.motivo })}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60">
                {cancelarOC.isPending ? "Cancelando…" : "Cancelar OC e Criar Nova Requisição"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Estoque
// ══════════════════════════════════════════════════════════════════════════════

type EscopoEstoque = "almoxarifado" | "obra";

function EstoqueTab() {
  const qc = useQueryClient();
  const [escopo, setEscopo] = useState<EscopoEstoque>("almoxarifado");
  const [obraId, setObraId] = useState<string>("");
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<EstoqueItem | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const { data: obras = [] } = useQuery<ObraResumida[]>({
    queryKey: ["obras-lista"],
    queryFn: () => suprimentosApi.listarObras(),
  });

  // null = almoxarifado geral, string = obra específica, undefined = todos
  const queryKey = ["estoque", escopo, obraId];
  const { data: estoque = [], isLoading } = useQuery<EstoqueItem[]>({
    queryKey,
    queryFn: () => {
      if (escopo === "almoxarifado") return suprimentosApi.listarEstoque(null);
      if (obraId) return suprimentosApi.listarEstoque(obraId);
      return Promise.resolve([]);
    },
    enabled: escopo === "almoxarifado" || !!obraId,
  });

  const valorTotal = estoque.reduce(
    (s, i) => s + i.quantidade * (i.preco_unitario ?? 0), 0
  );
  const alertas = estoque.filter(i => i.alerta_reposicao).length;

  const itemVazio = { nome: "", unidade: "un", quantidade: 0, quantidade_minima: 0 };
  const [form, setForm] = useState<Omit<EstoqueItem, "id" | "alerta_reposicao">>(
    { ...itemVazio, obra_id: null, codigo: null, categoria: null,
      preco_unitario: null, fornecedor_id: null, localizacao: null }
  );

  const salvar = useMutation({
    mutationFn: () =>
      editando
        ? suprimentosApi.atualizarEstoque(editando.id, form)
        : suprimentosApi.criarEstoqueItem({ ...form,
            obra_id: escopo === "obra" && obraId ? obraId : null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estoque"] });
      setAberto(false); setEditando(null); setErr(null);
    },
    onError: (e: any) => setErr(parseApiError(e)),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => suprimentosApi.excluirEstoque(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estoque"] }),
  });

  function abrirEditar(item: EstoqueItem) {
    setEditando(item);
    setForm({
      obra_id: item.obra_id, codigo: item.codigo, nome: item.nome,
      categoria: item.categoria, unidade: item.unidade,
      quantidade: item.quantidade, quantidade_minima: item.quantidade_minima,
      preco_unitario: item.preco_unitario, fornecedor_id: item.fornecedor_id,
      localizacao: item.localizacao,
    });
    setAberto(true);
  }

  return (
    <>
      {/* Seletor de escopo */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button
            onClick={() => setEscopo("almoxarifado")}
            className={clsx("flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors",
              escopo === "almoxarifado"
                ? "bg-brand-600 text-white"
                : "text-slate-600 hover:bg-slate-50")}>
            <Warehouse size={14} /> Almoxarifado Geral
          </button>
          <button
            onClick={() => setEscopo("obra")}
            className={clsx("flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors border-l border-slate-200",
              escopo === "obra"
                ? "bg-brand-600 text-white"
                : "text-slate-600 hover:bg-slate-50")}>
            <Building2 size={14} /> Por Obra
          </button>
        </div>

        {escopo === "obra" && (
          <Select label="" value={obraId}
            onChange={e => setObraId(e.target.value)}
            className="w-56">
            <option value="">— Selecione uma obra —</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </Select>
        )}

        <div className="flex-1" />
        <button onClick={() => { setEditando(null); setForm({
            ...itemVazio, obra_id: null, codigo: null, categoria: null,
            preco_unitario: null, fornecedor_id: null, localizacao: null
          }); setAberto(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700">
          <Plus size={16} /> Novo item
        </button>
      </div>

      {/* KPIs */}
      {estoque.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Itens no estoque</p>
            <p className="text-xl font-bold text-slate-700">{estoque.length}</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Valor total</p>
            <p className="text-xl font-bold text-emerald-700">{fmt(valorTotal)}</p>
          </div>
          {alertas > 0 ? (
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <AlertTriangle size={12} className="text-amber-500" /> Abaixo do mínimo
              </p>
              <p className="text-xl font-bold text-amber-600">{alertas} item(ns)</p>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Status</p>
              <p className="text-sm font-medium text-emerald-600 mt-1">✓ Tudo regularizado</p>
            </div>
          )}
        </div>
      )}

      {/* Prompt para selecionar obra */}
      {escopo === "obra" && !obraId ? (
        <div className="py-12 text-center text-slate-400">
          <Building2 size={32} className="mx-auto mb-3 text-slate-300" />
          <p>Selecione uma obra para ver seu estoque</p>
        </div>
      ) : isLoading ? (
        <div className="text-slate-400 text-sm p-6">Carregando…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500 font-medium uppercase tracking-wide">
                <th className="pb-2 pr-4">Material</th>
                <th className="pb-2 pr-4">Categoria</th>
                <th className="pb-2 pr-4 text-right">Quantidade</th>
                <th className="pb-2 pr-4 text-right">Mínimo</th>
                <th className="pb-2 pr-4 text-right">Preço Unit.</th>
                <th className="pb-2 pr-4 text-right">Valor Total</th>
                <th className="pb-2 pr-4">Localização</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {estoque.map(item => (
                <tr key={item.id}
                  className={clsx("border-b border-slate-100 hover:bg-slate-50",
                    item.alerta_reposicao && "bg-amber-50/40")}>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      {item.alerta_reposicao && (
                        <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />
                      )}
                      <span className="font-medium text-slate-800">{item.nome}</span>
                    </div>
                    {item.codigo && <span className="text-xs text-slate-400">{item.codigo}</span>}
                  </td>
                  <td className="py-3 pr-4 text-slate-500">{item.categoria ?? "—"}</td>
                  <td className={clsx("py-3 pr-4 text-right font-mono",
                    item.alerta_reposicao ? "text-amber-600 font-semibold" : "text-slate-700")}>
                    {fmtQtd(item.quantidade, item.unidade)}
                  </td>
                  <td className="py-3 pr-4 text-right font-mono text-slate-500">
                    {fmtQtd(item.quantidade_minima, item.unidade)}
                  </td>
                  <td className="py-3 pr-4 text-right text-slate-600">
                    {item.preco_unitario != null ? fmt(item.preco_unitario) : "—"}
                  </td>
                  <td className="py-3 pr-4 text-right font-medium text-slate-700">
                    {item.preco_unitario != null
                      ? fmt(item.quantidade * item.preco_unitario) : "—"}
                  </td>
                  <td className="py-3 pr-4 text-slate-500 text-xs">{item.localizacao ?? "—"}</td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <button onClick={() => abrirEditar(item)}
                        className="text-slate-400 hover:text-brand-600"><Pencil size={14} /></button>
                      <button onClick={() => { if (confirm(`Excluir "${item.nome}"?`)) excluir.mutate(item.id); }}
                        className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {estoque.length === 0 && (
                <tr><td colSpan={8} className="py-10 text-center text-slate-400">
                  Nenhum item no estoque {escopo === "almoxarifado" ? "do almoxarifado" : "desta obra"}
                </td></tr>
              )}
            </tbody>
            {estoque.length > 0 && (
              <tfoot>
                <tr className="border-t border-slate-200 font-semibold">
                  <td colSpan={5} className="py-2 pr-4 text-right text-xs text-slate-500 uppercase tracking-wide">
                    Total valorizado:
                  </td>
                  <td className="py-2 pr-4 text-right text-emerald-700">{fmt(valorTotal)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Modal de item */}
      <Modal aberto={aberto} onFechar={() => { setAberto(false); setErr(null); }}
        titulo={editando ? "Editar item de estoque" : "Novo item de estoque"}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input label="Nome / Descrição do material" required value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <Input label="Código" value={form.codigo ?? ""}
              onChange={e => setForm(f => ({ ...f, codigo: e.target.value || null }))} />
            <Input label="Categoria" value={form.categoria ?? ""}
              onChange={e => setForm(f => ({ ...f, categoria: e.target.value || null }))}
              placeholder="Cimento, Madeira, Elétrico…" />
            <Input label="Unidade" required value={form.unidade}
              onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))}
              placeholder="sc, m², m³, un…" />
            <Input label="Localização" value={form.localizacao ?? ""}
              onChange={e => setForm(f => ({ ...f, localizacao: e.target.value || null }))}
              placeholder="Depósito A, Prateleira 3…" />
            <div>
              <p className="text-xs font-medium text-slate-600 mb-1">Quantidade atual</p>
              <input type="number" step="0.001" value={form.quantidade}
                onChange={e => setForm(f => ({ ...f, quantidade: +e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-brand-400 outline-none" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-600 mb-1">Quantidade mínima</p>
              <input type="number" step="0.001" value={form.quantidade_minima}
                onChange={e => setForm(f => ({ ...f, quantidade_minima: +e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-brand-400 outline-none" />
            </div>
            <div className="col-span-2">
              <CurrencyInput label="Preço unitário"
                value={form.preco_unitario ?? null}
                nullable
                onChange={v => setForm(f => ({ ...f, preco_unitario: v }))} />
            </div>
          </div>
          {err && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">{err}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={() => { setAberto(false); setErr(null); }}
              className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={() => salvar.mutate()}
              disabled={!form.nome.trim() || !form.unidade.trim() || salvar.isPending}
              className="flex-1 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60">
              {salvar.isPending ? "Salvando…" : editando ? "Salvar" : "Adicionar"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Transferências
// ══════════════════════════════════════════════════════════════════════════════

function TransferenciasTab() {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { data: obras = [] } = useQuery<ObraResumida[]>({
    queryKey: ["obras-lista"],
    queryFn: () => suprimentosApi.listarObras(),
  });

  const { data: transferencias = [], isLoading } = useQuery<TransferenciaEstoque[]>({
    queryKey: ["transferencias"],
    queryFn: () => suprimentosApi.listarTransferencias(),
  });

  const hoje = new Date().toISOString().split("T")[0];
  const [origemTipo, setOrigemTipo] = useState<"almoxarifado" | "obra">("almoxarifado");
  const [destinoTipo, setDestinoTipo] = useState<"almoxarifado" | "obra">("obra");
  const [origemObraId, setOrigemObraId] = useState<string | null>(null);
  const [destinoObraId, setDestinoObraId] = useState<string | null>(null);
  const [dataTransf, setDataTransf] = useState(hoje);
  const [solicitante, setSolicitante] = useState("");
  const [filtroEstoque, setFiltroEstoque] = useState("");
  // Map de estoque_item_id → quantidade a transferir
  const [selecionados, setSelecionados] = useState<Map<string, number>>(new Map());
  const [enviando, setEnviando] = useState(false);

  // Estoque de origem
  const { data: estoqueOrigem = [] } = useQuery<EstoqueItem[]>({
    queryKey: ["estoque-origem", origemTipo, origemObraId],
    queryFn: () => {
      if (origemTipo === "almoxarifado") return suprimentosApi.listarEstoque(null);
      if (origemObraId) return suprimentosApi.listarEstoque(origemObraId);
      return Promise.resolve([]);
    },
    enabled: origemTipo === "almoxarifado" || !!origemObraId,
  });

  const estoqueFiltrado = useMemo(() => {
    if (!filtroEstoque.trim()) return estoqueOrigem;
    const q = filtroEstoque.toLowerCase();
    return estoqueOrigem.filter(i =>
      i.nome.toLowerCase().includes(q) ||
      (i.codigo ?? "").toLowerCase().includes(q) ||
      (i.categoria ?? "").toLowerCase().includes(q)
    );
  }, [estoqueOrigem, filtroEstoque]);

  function fecharModal() {
    setAberto(false); setErr(null);
    setSelecionados(new Map()); setFiltroEstoque("");
  }

  function toggleItem(item: EstoqueItem) {
    setSelecionados(prev => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.set(item.id, Math.min(1, item.quantidade));
      }
      return next;
    });
  }

  function setQtd(itemId: string, qtd: number) {
    setSelecionados(prev => {
      const next = new Map(prev);
      next.set(itemId, qtd);
      return next;
    });
  }

  function selecionarTodos() {
    const novos = new Map<string, number>();
    estoqueFiltrado.filter(i => i.quantidade > 0).forEach(i => {
      novos.set(i.id, i.quantidade);
    });
    setSelecionados(novos);
  }

  function deselecionarTodos() {
    setSelecionados(new Map());
  }

  async function registrarTransferencias() {
    const itens = Array.from(selecionados.entries()).filter(([, q]) => q > 0);
    if (!itens.length) { setErr("Selecione ao menos um item com quantidade."); return; }
    setEnviando(true); setErr(null);
    try {
      await Promise.all(itens.map(([itemId, qtd]) => {
        const item = estoqueOrigem.find(i => i.id === itemId)!;
        const payload: TransferenciaCreate = {
          origem_obra_id:  origemTipo  === "almoxarifado" ? null : origemObraId,
          destino_obra_id: destinoTipo === "almoxarifado" ? null : destinoObraId,
          estoque_item_id: itemId,
          material: item.nome,
          unidade: item.unidade,
          quantidade: qtd,
          valor_unitario: item.preco_unitario ?? null,
          data_transferencia: dataTransf,
          solicitante: solicitante || null,
        };
        return suprimentosApi.criarTransferencia(payload);
      }));
      qc.invalidateQueries({ queryKey: ["transferencias"] });
      qc.invalidateQueries({ queryKey: ["estoque"] });
      fecharModal();
    } catch (e: any) {
      setErr(parseApiError(e, "Erro ao registrar transferências"));
    } finally {
      setEnviando(false);
    }
  }

  const confirmar = useMutation({
    mutationFn: (id: string) => suprimentosApi.atualizarTransferencia(id, { status: "concluida" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transferencias"] });
      qc.invalidateQueries({ queryKey: ["estoque"] });
    },
  });

  const cancelar = useMutation({
    mutationFn: (id: string) => suprimentosApi.atualizarTransferencia(id, { status: "cancelada" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transferencias"] }),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => suprimentosApi.excluirTransferencia(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transferencias"] }),
  });

  const pendentes  = transferencias.filter(t => t.status === "pendente").length;
  const concluidas = transferencias.filter(t => t.status === "concluida").length;

  return (
    <>
      {/* Cabeçalho + KPIs */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-amber-600">
            <Clock size={14} /> {pendentes} pendente(s)
          </span>
          <span className="flex items-center gap-1.5 text-emerald-600">
            <CheckCircle2 size={14} /> {concluidas} concluída(s)
          </span>
        </div>
        <button onClick={() => setAberto(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700">
          <ArrowLeftRight size={16} /> Nova transferência
        </button>
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-sm p-6">Carregando…</div>
      ) : (
        <div className="space-y-2">
          {transferencias.map(t => (
            <div key={t.id} className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                      {t.numero}
                    </span>
                    <span className={clsx("px-2 py-0.5 text-xs rounded-full font-medium",
                      STATUS_TRF_COR[t.status as StatusTransferencia])}>
                      {STATUS_TRF_LABELS[t.status as StatusTransferencia]}
                    </span>
                  </div>
                  {/* Rota de/para */}
                  <div className="flex items-center gap-2 text-sm text-slate-700 mt-1">
                    <span className="flex items-center gap-1 font-medium">
                      {t.origem_obra_id ? <Building2 size={13} /> : <Warehouse size={13} />}
                      {t.origem_label}
                    </span>
                    <ArrowLeftRight size={13} className="text-slate-400" />
                    <span className="flex items-center gap-1 font-medium">
                      {t.destino_obra_id ? <Building2 size={13} /> : <Warehouse size={13} />}
                      {t.destino_label}
                    </span>
                  </div>
                  {/* Material */}
                  <div className="text-sm text-slate-600 mt-1">
                    <span className="font-medium">{t.material}</span>
                    {" · "}{fmtQtd(t.quantidade, t.unidade)}
                    {t.valor_unitario != null && (
                      <> · <span className="text-slate-500">
                        {fmt(t.valor_unitario)}/un
                        {t.valor_total != null && (
                          <span className="ml-1 font-medium text-slate-700">
                            = {fmt(t.valor_total)}
                          </span>
                        )}
                      </span></>
                    )}
                  </div>
                  {t.solicitante && (
                    <div className="text-xs text-slate-400 mt-0.5">
                      Solicitante: {t.solicitante} · {t.data_transferencia}
                    </div>
                  )}
                </div>
                {/* Ações */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {t.status === "pendente" && (
                    <>
                      <button
                        onClick={() => {
                          if (confirm(`Confirmar e mover estoque para "${t.destino_label}"?`))
                            confirmar.mutate(t.id);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium">
                        <CheckCircle2 size={12} /> Confirmar
                      </button>
                      <button
                        onClick={() => { if (confirm("Cancelar transferência?")) cancelar.mutate(t.id); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
                        <XCircle size={12} /> Cancelar
                      </button>
                    </>
                  )}
                  {t.status !== "concluida" && (
                    <button onClick={() => { if (confirm("Excluir?")) excluir.mutate(t.id); }}
                      className="text-slate-400 hover:text-red-500 p-1">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {transferencias.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <ArrowLeftRight size={32} className="mx-auto mb-3 text-slate-300" />
              <p>Nenhuma transferência registrada</p>
              <p className="text-xs mt-1">Use transferências para mover materiais entre almoxarifado e obras</p>
            </div>
          )}
        </div>
      )}

      {/* Modal Nova Transferência — seleção em massa */}
      <Modal aberto={aberto} onFechar={fecharModal}
        titulo="Nova Transferência de Material" largura="2xl">
        <div className="space-y-4">

          {/* ── De / Para ── */}
          <div className="grid grid-cols-2 gap-4">
            {/* Origem */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-bold">De</span>
                Origem
              </p>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                <button onClick={() => { setOrigemTipo("almoxarifado"); setOrigemObraId(null); setSelecionados(new Map()); }}
                  className={clsx("flex-1 py-1.5 text-xs font-medium transition-colors",
                    origemTipo === "almoxarifado" ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50")}>
                  <Warehouse size={11} className="inline mr-1" /> Almoxarifado
                </button>
                <button onClick={() => { setOrigemTipo("obra"); setSelecionados(new Map()); }}
                  className={clsx("flex-1 py-1.5 text-xs font-medium border-l border-slate-200 transition-colors",
                    origemTipo === "obra" ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50")}>
                  <Building2 size={11} className="inline mr-1" /> Obra
                </button>
              </div>
              {origemTipo === "obra" && (
                obras.length === 0
                  ? <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      <span>Nenhuma obra. Crie obras em <strong>Empreendimentos</strong> primeiro.</span>
                    </div>
                  : <Select label="" value={origemObraId ?? ""}
                      onChange={e => { setOrigemObraId(e.target.value || null); setSelecionados(new Map()); }}>
                      <option value="">— Selecione —</option>
                      {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                    </Select>
              )}
            </div>

            {/* Destino */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-bold">Para</span>
                Destino
              </p>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                <button onClick={() => setDestinoTipo("almoxarifado")}
                  className={clsx("flex-1 py-1.5 text-xs font-medium transition-colors",
                    destinoTipo === "almoxarifado" ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50")}>
                  <Warehouse size={11} className="inline mr-1" /> Almoxarifado
                </button>
                <button onClick={() => setDestinoTipo("obra")}
                  className={clsx("flex-1 py-1.5 text-xs font-medium border-l border-slate-200 transition-colors",
                    destinoTipo === "obra" ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50")}>
                  <Building2 size={11} className="inline mr-1" /> Obra
                </button>
              </div>
              {destinoTipo === "obra" && (
                obras.length === 0
                  ? <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      <span>Nenhuma obra. Crie obras em <strong>Empreendimentos</strong> primeiro.</span>
                    </div>
                  : <Select label="" value={destinoObraId ?? ""}
                      onChange={e => setDestinoObraId(e.target.value || null)}>
                      <option value="">— Selecione —</option>
                      {obras.filter(o => o.id !== origemObraId).map(o => (
                        <option key={o.id} value={o.id}>{o.nome}</option>
                      ))}
                    </Select>
              )}
            </div>
          </div>

          {/* ── Data e Solicitante ── */}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Data" type="date" value={dataTransf}
              onChange={e => setDataTransf(e.target.value)} />
            <Input label="Solicitante" value={solicitante}
              onChange={e => setSolicitante(e.target.value)}
              placeholder="Nome do responsável" />
          </div>

          {/* ── Lista de estoque ── */}
          <div>
            <div className="flex items-center justify-between mb-2 gap-3">
              {/* Filtro */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={filtroEstoque}
                  onChange={e => setFiltroEstoque(e.target.value)}
                  placeholder="Filtrar materiais..."
                  className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-brand-400 outline-none"
                />
                <Package size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
              </div>
              {/* Selecionar / desselecionar */}
              <div className="flex gap-2 shrink-0">
                <button onClick={selecionarTodos}
                  className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                  Selec. todos
                </button>
                {selecionados.size > 0 && (
                  <button onClick={deselecionarTodos}
                    className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50">
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {/* Tabela de itens */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                    <tr className="text-left text-xs text-slate-500 font-medium uppercase tracking-wide">
                      <th className="px-3 py-2 w-8"></th>
                      <th className="px-3 py-2">Material</th>
                      <th className="px-3 py-2 text-center w-16">Un.</th>
                      <th className="px-3 py-2 text-right w-24">Disponível</th>
                      <th className="px-3 py-2 text-right w-28">Qtd. transferir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estoqueFiltrado.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-xs">
                          {estoqueOrigem.length === 0
                            ? "Nenhum item no estoque de origem. Adicione itens na aba Estoque."
                            : "Nenhum item encontrado para o filtro digitado."}
                        </td>
                      </tr>
                    )}
                    {estoqueFiltrado.map(item => {
                      const sel = selecionados.has(item.id);
                      const qtdSel = selecionados.get(item.id) ?? 0;
                      const semEstoque = item.quantidade <= 0;
                      return (
                        <tr key={item.id}
                          onClick={() => !semEstoque && toggleItem(item)}
                          className={clsx(
                            "border-t border-slate-100 transition-colors",
                            semEstoque ? "opacity-40 cursor-not-allowed" :
                            sel ? "bg-brand-50 cursor-pointer" : "hover:bg-slate-50 cursor-pointer"
                          )}>
                          <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                            <input type="checkbox"
                              checked={sel}
                              disabled={semEstoque}
                              onChange={() => !semEstoque && toggleItem(item)}
                              className="w-4 h-4 accent-brand-600 cursor-pointer" />
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={clsx("font-medium", sel ? "text-brand-800" : "text-slate-800")}>
                              {item.nome}
                            </span>
                            {item.categoria && (
                              <span className="ml-2 text-xs text-slate-400">{item.categoria}</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center text-xs text-slate-500">{item.unidade}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs">
                            <span className={clsx(
                              "px-1.5 py-0.5 rounded",
                              item.quantidade <= 0 ? "bg-red-100 text-red-600" :
                              item.alerta_reposicao ? "bg-amber-100 text-amber-700" :
                              "bg-emerald-100 text-emerald-700"
                            )}>
                              {item.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                            {sel ? (
                              <input
                                type="number"
                                min="0.001"
                                max={item.quantidade}
                                step="0.001"
                                value={qtdSel || ""}
                                onChange={e => setQtd(item.id, +e.target.value)}
                                className="w-24 px-2 py-1 border border-brand-300 rounded text-right text-xs font-mono focus:border-brand-500 outline-none bg-white"
                                autoFocus
                              />
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Resumo da seleção */}
            {selecionados.size > 0 && (
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>
                  <strong className="text-brand-700">{selecionados.size}</strong> item(ns) selecionado(s)
                  {Array.from(selecionados.values()).some(q => q <= 0) && (
                    <span className="ml-2 text-amber-600">· Preencha as quantidades</span>
                  )}
                </span>
                {(() => {
                  const valorTotal = Array.from(selecionados.entries()).reduce((sum, [id, qtd]) => {
                    const item = estoqueOrigem.find(i => i.id === id);
                    return sum + qtd * (item?.preco_unitario ?? 0);
                  }, 0);
                  return valorTotal > 0
                    ? <span>Valor estimado: <strong className="text-brand-700">{fmt(valorTotal)}</strong></span>
                    : null;
                })()}
              </div>
            )}
          </div>

          {err && <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{err}</p>}

          <div className="flex gap-3 pt-1 border-t border-slate-100">
            <button onClick={fecharModal}
              className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
              Cancelar
            </button>
            <button
              onClick={registrarTransferencias}
              disabled={enviando || selecionados.size === 0 || Array.from(selecionados.values()).every(q => q <= 0)}
              className="flex-1 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {enviando
                ? <><ArrowLeftRight size={14} className="animate-pulse" /> Registrando {selecionados.size} transferência(s)…</>
                : <><ArrowLeftRight size={14} /> Registrar {selecionados.size > 0 ? `${selecionados.size} transferência(s)` : "transferência"}</>
              }
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Recebimentos
// ══════════════════════════════════════════════════════════════════════════════

// Tipo auxiliar para edição de itens de recebimento
type EditItemRec = {
  id: string;
  descricao: string;
  unidade: string;
  quantidade_pedida: number;
  quantidade_recebida: number;
  quantidade_recusada: number;
  motivo_recusa: string;
};

function calcStatusRec(itens: EditItemRec[]): StatusRecebimento {
  if (!itens.length) return "pendente";
  const totalRec  = itens.reduce((s, i) => s + i.quantidade_recebida, 0);
  const totalRec2 = itens.reduce((s, i) => s + i.quantidade_recusada, 0);
  const totalPed  = itens.reduce((s, i) => s + i.quantidade_pedida, 0);
  if (totalRec2 > 0 && totalRec === 0) return "recusado";
  if (totalRec2 > 0 || totalRec < totalPed) return "divergencia";
  return "conferido";
}

function RecebimentosTab() {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  // Filtros
  const [buscaRec, setBuscaRec] = useState("");
  const [filtroStatusRec, setFiltroStatusRec] = useState("");
  // Modal de edição de itens
  const [editModal, setEditModal] = useState<{
    rec: Recebimento;
    itens: EditItemRec[];
    confirmar: boolean; // true = salvar + confirmar entrega
  } | null>(null);

  const { data: recebimentos = [], isLoading } = useQuery<Recebimento[]>({
    queryKey: ["recebimentos"],
    queryFn: () => suprimentosApi.listarRecebimentos(),
  });

  const { data: ocs = [] } = useQuery<OrdemCompra[]>({
    queryKey: ["ordens-compra"],
    queryFn: () => suprimentosApi.listarOCs(),
  });

  const { data: obras = [] } = useQuery<ObraResumida[]>({
    queryKey: ["obras-lista"],
    queryFn: () => suprimentosApi.listarObras(),
  });

  const hoje = new Date().toISOString().split("T")[0];
  const itemVazio: RecebimentoItemCreate = {
    descricao: "", unidade: "un", quantidade_pedida: 0,
    quantidade_recebida: 0, quantidade_recusada: 0, motivo_recusa: null,
  };
  const [form, setForm] = useState<RecebimentoCreate>({
    obra_id: null, oc_id: null, nota_fiscal: null,
    transportadora: null, recebido_por: null,
    data_recebimento: hoje, observacoes: null, itens: [],
  });
  const [itemNovo, setItemNovo] = useState<RecebimentoItemCreate>(itemVazio);

  function preencherDeOC(ocId: string) {
    const oc = ocs.find(o => o.id === ocId);
    if (!oc) return;
    setForm(f => ({
      ...f,
      oc_id: ocId,
      obra_id: oc.obra_id ?? f.obra_id,
      itens: oc.itens.map(i => ({
        oc_item_id: i.id,
        descricao: i.descricao,
        unidade: i.unidade,
        quantidade_pedida: i.quantidade,
        quantidade_recebida: i.quantidade,   // default = pedido
        quantidade_recusada: 0,
        motivo_recusa: null,
      })),
    }));
  }

  function calcStatus(itens: RecebimentoItemCreate[]): StatusRecebimento {
    if (!itens.length) return "pendente";
    const totalRec  = itens.reduce((s, i) => s + (i.quantidade_recebida ?? 0), 0);
    const totalRec2 = itens.reduce((s, i) => s + (i.quantidade_recusada ?? 0), 0);
    const totalPed  = itens.reduce((s, i) => s + i.quantidade_pedida, 0);
    if (totalRec2 > 0 && totalRec === 0) return "recusado";
    if (totalRec2 > 0 || totalRec < totalPed) return "divergencia";
    return "conferido";
  }

  function resetForm() {
    setForm({
      obra_id: null, oc_id: null, nota_fiscal: null,
      transportadora: null, recebido_por: null,
      data_recebimento: hoje, observacoes: null, itens: [],
    });
    setItemNovo(itemVazio);
    setErr(null);
  }

  const criar = useMutation({
    mutationFn: () =>
      suprimentosApi.criarRecebimento(form).then(async (rec) => {
        const status = calcStatus(form.itens ?? []);
        if (status !== "pendente") {
          await suprimentosApi.atualizarRecebimento(rec.id, { status });
        }
        return rec;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recebimentos"] });
      setAberto(false); resetForm();
    },
    onError: (e: any) => setErr(parseApiError(e)),
  });

  const atualizar = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StatusRecebimento }) =>
      suprimentosApi.atualizarRecebimento(id, { status }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["recebimentos"] });
      // Quando entrega confirmada → backend atualiza estoque e OC automaticamente
      if (vars.status === "conferido") {
        qc.invalidateQueries({ queryKey: ["estoque"] });
        qc.invalidateQueries({ queryKey: ["ordens-compra"] });
      }
    },
  });

  const excluir = useMutation({
    mutationFn: (id: string) => suprimentosApi.excluirRecebimento(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recebimentos"] }),
  });

  // Salva edição de itens (+ opcionalmente confirma entrega)
  const salvarItens = useMutation({
    mutationFn: async () => {
      if (!editModal) return;
      const { rec, itens, confirmar } = editModal;
      const novoStatus = confirmar ? "conferido" : calcStatusRec(itens);
      await suprimentosApi.atualizarRecebimento(rec.id, {
        status: novoStatus,
        itens: itens.map(i => ({
          id: i.id,
          quantidade_recebida: i.quantidade_recebida,
          quantidade_recusada: i.quantidade_recusada,
          motivo_recusa: i.motivo_recusa || null,
        })),
      });
      return novoStatus;
    },
    onSuccess: (novoStatus) => {
      qc.invalidateQueries({ queryKey: ["recebimentos"] });
      if (novoStatus === "conferido") {
        qc.invalidateQueries({ queryKey: ["estoque"] });
        qc.invalidateQueries({ queryKey: ["ordens-compra"] });
      }
      setEditModal(null);
    },
    onError: (e: any) => alert(parseApiError(e, "Erro ao salvar")),
  });

  function abrirEdicao(rec: Recebimento, confirmar = false) {
    setEditModal({
      rec,
      confirmar,
      itens: rec.itens.map(i => ({
        id: i.id,
        descricao: i.descricao,
        unidade: i.unidade,
        quantidade_pedida: i.quantidade_pedida,
        quantidade_recebida: i.quantidade_recebida,
        quantidade_recusada: i.quantidade_recusada,
        motivo_recusa: i.motivo_recusa ?? "",
      })),
    });
  }

  // KPIs
  const pendentes   = recebimentos.filter(r => r.status === "pendente").length;
  const divergentes = recebimentos.filter(r => r.status === "divergencia").length;

  const recFiltrados = useMemo(() => {
    const q = buscaRec.toLowerCase().trim();
    return recebimentos.filter(r => {
      const matchQ = !q || r.numero.toLowerCase().includes(q) ||
        (r.nota_fiscal ?? "").toLowerCase().includes(q) ||
        (r.recebido_por ?? "").toLowerCase().includes(q);
      const matchS = !filtroStatusRec || r.status === filtroStatusRec;
      return matchQ && matchS;
    });
  }, [recebimentos, buscaRec, filtroStatusRec]);

  const obraLabel = (id: string | null) =>
    id ? obras.find(o => o.id === id)?.nome ?? id : "Empresa Geral";

  const ocLabel = (id: string | null) =>
    id ? ocs.find(o => o.id === id)?.numero ?? id : null;

  return (
    <>
      {/* Cabeçalho + KPIs */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-amber-600">
            <Clock size={14} /> {pendentes} pendente(s)
          </span>
          {divergentes > 0 && (
            <span className="flex items-center gap-1.5 text-orange-600">
              <AlertTriangle size={14} /> {divergentes} divergência(s)
            </span>
          )}
        </div>
        <button onClick={() => { resetForm(); setAberto(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700">
          <Plus size={16} /> Registrar Recebimento
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="Buscar por número, NF ou responsável…"
          value={buscaRec}
          onChange={e => setBuscaRec(e.target.value)}
          className="flex-1 min-w-[200px] text-sm px-3 py-1.5 border border-slate-200 rounded-lg outline-none focus:border-brand-400 bg-white"
        />
        <select
          value={filtroStatusRec}
          onChange={e => setFiltroStatusRec(e.target.value)}
          className="text-sm px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-600 outline-none focus:border-brand-400">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_REC_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        {(buscaRec || filtroStatusRec) && (
          <button
            onClick={() => { setBuscaRec(""); setFiltroStatusRec(""); }}
            className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5 border border-slate-200 rounded-lg bg-white">
            Limpar
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-sm p-6">Carregando…</div>
      ) : (
        <div className="space-y-2">
          {recFiltrados.map(r => {
            const isOpen = expandido === r.id;
            return (
              <div key={r.id} className="border border-slate-200 rounded-lg overflow-hidden">
                <div
                  className="flex items-start justify-between p-4 cursor-pointer hover:bg-slate-50"
                  onClick={() => setExpandido(isOpen ? null : r.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        {r.numero}
                      </span>
                      <span className={clsx("px-2 py-0.5 text-xs rounded-full font-medium",
                        STATUS_REC_COR[r.status as StatusRecebimento])}>
                        {STATUS_REC_LABELS[r.status as StatusRecebimento]}
                      </span>
                      {r.oc_id && ocLabel(r.oc_id) && (
                        <span className="text-xs text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                          OC: {ocLabel(r.oc_id)}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-600">
                      <span className="font-medium">{obraLabel(r.obra_id)}</span>
                      {" · "}{r.data_recebimento}
                      {r.nota_fiscal && ` · NF: ${r.nota_fiscal}`}
                      {r.recebido_por && ` · Por: ${r.recebido_por}`}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {r.itens.length} item(ns)
                      {r.transportadora && ` · ${r.transportadora}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    {(r.status === "pendente" || r.status === "divergencia") && (
                      <>
                        {/* Editar quantidades recebidas */}
                        <button
                          onClick={() => abrirEdicao(r)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-medium">
                          <Pencil size={12} /> Editar
                        </button>
                        {/* Confirmar entrega completa (abre modal para ajustar antes) */}
                        <button
                          onClick={() => abrirEdicao(r, true)}
                          disabled={atualizar.isPending}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium">
                          <CheckCircle2 size={12} /> Confirmar Entrega
                        </button>
                      </>
                    )}
                    <button onClick={e => { e.stopPropagation(); if (confirm("Excluir?")) excluir.mutate(r.id); }}
                      className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                </div>

                {/* Itens expandidos */}
                {isOpen && r.itens.length > 0 && (
                  <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-slate-500 font-medium">
                          <th className="pb-1.5 pr-4">Material</th>
                          <th className="pb-1.5 pr-4 text-right">Pedido</th>
                          <th className="pb-1.5 pr-4 text-right">Recebido</th>
                          <th className="pb-1.5 pr-4 text-right">Recusado</th>
                          <th className="pb-1.5">Motivo recusa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.itens.map((it, idx) => {
                          const ok = it.quantidade_recebida >= it.quantidade_pedida && it.quantidade_recusada === 0;
                          return (
                            <tr key={idx} className={clsx("border-t border-slate-200",
                              !ok && "text-orange-700")}>
                              <td className="py-1.5 pr-4 font-medium">
                                {it.descricao}
                              </td>
                              <td className="py-1.5 pr-4 text-right font-mono">
                                {it.quantidade_pedida} {it.unidade}
                              </td>
                              <td className={clsx("py-1.5 pr-4 text-right font-mono",
                                it.quantidade_recebida < it.quantidade_pedida ? "text-orange-600" : "text-emerald-600")}>
                                {it.quantidade_recebida}
                              </td>
                              <td className={clsx("py-1.5 pr-4 text-right font-mono",
                                it.quantidade_recusada > 0 ? "text-red-600" : "text-slate-400")}>
                                {it.quantidade_recusada}
                              </td>
                              <td className="py-1.5 text-slate-500 italic">
                                {it.motivo_recusa ?? "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
          {recFiltrados.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <Truck size={32} className="mx-auto mb-3 text-slate-300" />
              {recebimentos.length === 0 ? (
                <>
                  <p>Nenhum recebimento registrado</p>
                  <p className="text-xs mt-1">Registre a confirmação de entrega de materiais aqui</p>
                </>
              ) : (
                <p>Nenhum recebimento encontrado para os filtros aplicados</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal Novo Recebimento */}
      <Modal aberto={aberto} onFechar={() => { setAberto(false); resetForm(); }}
        titulo="Registrar Recebimento de Material" largura="xl">
        <div className="space-y-5">
          {/* Cabeçalho */}
          <div className="grid grid-cols-2 gap-4">
            <Select label="Ordem de Compra de origem (opcional)"
              value={form.oc_id ?? ""}
              onChange={e => {
                if (e.target.value) preencherDeOC(e.target.value);
                else setForm(f => ({ ...f, oc_id: null }));
              }}>
              <option value="">— Selecionar OC (pré-preenche itens) —</option>
              {ocs.map(o => (
                <option key={o.id} value={o.id}>
                  {o.numero}
                  {o.fornecedor_nome ? ` · ${o.fornecedor_nome}` : ""}
                  {` · ${fmt(o.valor_total)}`}
                </option>
              ))}
            </Select>
            <Select label="Obra (opcional)" value={form.obra_id ?? ""}
              onChange={e => setForm(f => ({ ...f, obra_id: e.target.value || null }))}>
              <option value="">— Empresa / Almoxarifado Geral —</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </Select>
            <Input label="Data de recebimento" type="date" value={form.data_recebimento}
              onChange={e => setForm(f => ({ ...f, data_recebimento: e.target.value }))} />
            <Input label="Nota Fiscal" value={form.nota_fiscal ?? ""}
              onChange={e => setForm(f => ({ ...f, nota_fiscal: e.target.value || null }))}
              placeholder="NF 000123" />
            <Input label="Transportadora" value={form.transportadora ?? ""}
              onChange={e => setForm(f => ({ ...f, transportadora: e.target.value || null }))} />
            <Input label="Recebido por" value={form.recebido_por ?? ""}
              onChange={e => setForm(f => ({ ...f, recebido_por: e.target.value || null }))} />
          </div>

          {/* Itens */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">
              Itens recebidos
              {(form.itens ?? []).length > 0 && (
                <span className="ml-2 text-xs text-slate-400 font-normal">{(form.itens ?? []).length} item(ns)</span>
              )}
            </p>

            {/* Tabela de itens */}
            {(form.itens ?? []).length > 0 && (
              <div className="overflow-x-auto mb-3 max-h-52 overflow-y-auto border border-slate-100 rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 font-medium border-b border-slate-200">
                      <th className="pb-1.5 pr-3">Descrição</th>
                      <th className="pb-1.5 pr-3 w-14">Un</th>
                      <th className="pb-1.5 pr-3 w-24 text-right">Pedido</th>
                      <th className="pb-1.5 pr-3 w-24 text-right">Recebido</th>
                      <th className="pb-1.5 pr-3 w-24 text-right">Recusado</th>
                      <th className="pb-1.5 w-40">Motivo recusa</th>
                      <th className="pb-1.5 w-6"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(form.itens ?? []).map((it, idx) => {
                      const diverge = (it.quantidade_recebida ?? 0) < it.quantidade_pedida
                        || (it.quantidade_recusada ?? 0) > 0;
                      return (
                        <tr key={idx} className={clsx("border-b border-slate-100",
                          diverge && "bg-orange-50/40")}>
                          <td className="py-1.5 pr-3 font-medium text-slate-800">{it.descricao}</td>
                          <td className="py-1.5 pr-3 text-slate-500 text-xs">{it.unidade}</td>
                          <td className="py-1.5 pr-3 text-right text-slate-500 font-mono text-xs">
                            {it.quantidade_pedida}
                          </td>
                          <td className="py-1.5 pr-3">
                            <input type="number" step="0.001" min="0"
                              value={it.quantidade_recebida ?? 0}
                              onChange={e => setForm(f => ({
                                ...f,
                                itens: f.itens!.map((x, i) =>
                                  i === idx ? { ...x, quantidade_recebida: +e.target.value } : x
                                ),
                              }))}
                              className={clsx(
                                "w-full text-right font-mono text-xs px-2 py-1 border rounded focus:border-brand-400 outline-none",
                                (it.quantidade_recebida ?? 0) < it.quantidade_pedida
                                  ? "border-orange-300 bg-orange-50"
                                  : "border-slate-200"
                              )} />
                          </td>
                          <td className="py-1.5 pr-3">
                            <input type="number" step="0.001" min="0"
                              value={it.quantidade_recusada ?? 0}
                              onChange={e => setForm(f => ({
                                ...f,
                                itens: f.itens!.map((x, i) =>
                                  i === idx ? { ...x, quantidade_recusada: +e.target.value } : x
                                ),
                              }))}
                              className={clsx(
                                "w-full text-right font-mono text-xs px-2 py-1 border rounded focus:border-brand-400 outline-none",
                                (it.quantidade_recusada ?? 0) > 0
                                  ? "border-red-300 bg-red-50"
                                  : "border-slate-200"
                              )} />
                          </td>
                          <td className="py-1.5 pr-1">
                            {(it.quantidade_recusada ?? 0) > 0 ? (
                              <input
                                value={it.motivo_recusa ?? ""}
                                onChange={e => setForm(f => ({
                                  ...f,
                                  itens: f.itens!.map((x, i) =>
                                    i === idx ? { ...x, motivo_recusa: e.target.value || null } : x
                                  ),
                                }))}
                                placeholder="motivo…"
                                className="w-full text-xs px-2 py-1 border border-red-200 rounded focus:border-red-400 outline-none bg-red-50" />
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-1.5">
                            <button onClick={() => setForm(f => ({
                              ...f, itens: f.itens!.filter((_, i) => i !== idx),
                            }))}
                              className="text-slate-300 hover:text-red-500">
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Adicionar item manualmente */}
            <div className="bg-slate-50 rounded-lg p-3 border border-dashed border-slate-200">
              <p className="text-xs text-slate-500 mb-2">Adicionar item manualmente</p>
              <div className="grid grid-cols-5 gap-2">
                <input placeholder="Descrição"
                  value={itemNovo.descricao}
                  onChange={e => setItemNovo(n => ({ ...n, descricao: e.target.value }))}
                  className="col-span-2 px-2 py-1.5 border border-slate-200 rounded text-sm focus:border-brand-400 outline-none" />
                <input placeholder="Un" value={itemNovo.unidade}
                  onChange={e => setItemNovo(n => ({ ...n, unidade: e.target.value }))}
                  className="px-2 py-1.5 border border-slate-200 rounded text-sm text-center focus:border-brand-400 outline-none" />
                <input type="number" placeholder="Qtd pedida" step="0.001" min="0"
                  value={itemNovo.quantidade_pedida || ""}
                  onChange={e => setItemNovo(n => ({ ...n, quantidade_pedida: +e.target.value, quantidade_recebida: +e.target.value }))}
                  className="px-2 py-1.5 border border-slate-200 rounded text-sm text-right focus:border-brand-400 outline-none" />
                <button
                  onClick={() => {
                    if (!itemNovo.descricao.trim() || itemNovo.quantidade_pedida <= 0) return;
                    setForm(f => ({ ...f, itens: [...(f.itens ?? []), { ...itemNovo }] }));
                    setItemNovo(itemVazio);
                  }}
                  className="px-3 py-1.5 bg-brand-600 text-white rounded text-sm font-medium hover:bg-brand-700">
                  + Add
                </button>
              </div>
            </div>
          </div>

          {/* Status sugerido */}
          {(form.itens ?? []).length > 0 && (
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-3 text-sm">
              <span className="text-slate-600">Status calculado:</span>
              <span className={clsx("px-2.5 py-0.5 rounded-full text-xs font-medium",
                STATUS_REC_COR[calcStatus(form.itens ?? [])])}>
                {STATUS_REC_LABELS[calcStatus(form.itens ?? [])]}
              </span>
              <span className="text-xs text-slate-400">
                (baseado nas quantidades informadas)
              </span>
            </div>
          )}

          {/* Observações */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Observações</label>
            <textarea rows={2} value={form.observacoes ?? ""}
              onChange={e => setForm(f => ({ ...f, observacoes: e.target.value || null }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-brand-400 outline-none resize-none"
              placeholder="Ocorrências, avarias, observações de entrega…" />
          </div>

          {err && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">{err}</p>}
          <div className="flex gap-3">
            <button onClick={() => { setAberto(false); resetForm(); }}
              className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={() => criar.mutate()}
              disabled={criar.isPending}
              className="flex-1 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60">
              {criar.isPending ? "Salvando…" : "Registrar Recebimento"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Edição de Itens do Recebimento */}
      {editModal && (
        <Modal
          aberto={true}
          onFechar={() => setEditModal(null)}
          titulo={editModal.confirmar
            ? `Confirmar Entrega · ${editModal.rec.numero}`
            : `Editar Recebimento · ${editModal.rec.numero}`}
          largura="xl">
          <div className="space-y-4">
            {editModal.confirmar && (
              <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-xs text-emerald-700">
                <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
                <span>Revise as quantidades recebidas antes de confirmar. Após confirmação, os itens serão lançados no estoque automaticamente.</span>
              </div>
            )}

            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200 text-xs text-slate-500 font-medium">
                    <th className="pb-2 pr-3 text-left">Material</th>
                    <th className="pb-2 pr-2 w-12 text-center">Un</th>
                    <th className="pb-2 pr-3 w-20 text-center">Pedido</th>
                    <th className="pb-2 pr-3 w-24 text-center text-emerald-700">Recebido</th>
                    <th className="pb-2 pr-3 w-24 text-center text-red-700">Recusado</th>
                    <th className="pb-2 text-left text-red-700">Motivo recusa</th>
                  </tr>
                </thead>
                <tbody>
                  {editModal.itens.map((item, idx) => (
                    <tr key={item.id} className={clsx(
                      "border-b border-slate-100",
                      item.quantidade_recusada > 0 && "bg-red-50/30"
                    )}>
                      <td className="py-2 pr-3 font-medium text-slate-700">{item.descricao}</td>
                      <td className="py-2 pr-2 text-center text-slate-500 text-xs">{item.unidade}</td>
                      <td className="py-2 pr-3 text-center text-slate-500 tabular-nums">{item.quantidade_pedida}</td>
                      <td className="py-2 pr-3">
                        <input
                          type="number" min={0} max={item.quantidade_pedida} step="0.001"
                          value={item.quantidade_recebida}
                          onChange={e => setEditModal(m => m ? {
                            ...m,
                            itens: m.itens.map((it, i) =>
                              i === idx ? { ...it, quantidade_recebida: +e.target.value } : it
                            )
                          } : null)}
                          className={clsx(
                            "w-full px-2 py-1 text-sm text-center border rounded focus:outline-none focus:border-emerald-400 tabular-nums",
                            item.quantidade_recebida < item.quantidade_pedida
                              ? "border-amber-300 bg-amber-50 text-amber-800"
                              : "border-emerald-200 bg-emerald-50 text-emerald-800"
                          )}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="number" min={0} step="0.001"
                          value={item.quantidade_recusada}
                          onChange={e => setEditModal(m => m ? {
                            ...m,
                            itens: m.itens.map((it, i) =>
                              i === idx ? { ...it, quantidade_recusada: +e.target.value } : it
                            )
                          } : null)}
                          className={clsx(
                            "w-full px-2 py-1 text-sm text-center border rounded focus:outline-none focus:border-red-400 tabular-nums",
                            item.quantidade_recusada > 0
                              ? "border-red-300 bg-red-50 text-red-800"
                              : "border-slate-200"
                          )}
                        />
                      </td>
                      <td className="py-2">
                        {item.quantidade_recusada > 0 ? (
                          <input
                            type="text"
                            value={item.motivo_recusa}
                            placeholder="Informe o motivo…"
                            onChange={e => setEditModal(m => m ? {
                              ...m,
                              itens: m.itens.map((it, i) =>
                                i === idx ? { ...it, motivo_recusa: e.target.value } : it
                              )
                            } : null)}
                            className="w-full px-2 py-1 text-xs border border-red-200 rounded focus:outline-none focus:border-red-400 bg-red-50"
                          />
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Status calculado */}
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-2.5 text-sm">
              <span className="text-slate-600 text-xs">Status resultante:</span>
              <span className={clsx("px-2.5 py-0.5 rounded-full text-xs font-medium",
                STATUS_REC_COR[calcStatusRec(editModal.itens)])}>
                {STATUS_REC_LABELS[calcStatusRec(editModal.itens)]}
              </span>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditModal(null)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
                Cancelar
              </button>
              {editModal.confirmar ? (
                <button
                  onClick={() => salvarItens.mutate()}
                  disabled={salvarItens.isPending}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60">
                  {salvarItens.isPending ? "Confirmando…" : "✓ Confirmar Entrega e Atualizar Estoque"}
                </button>
              ) : (
                <button
                  onClick={() => salvarItens.mutate()}
                  disabled={salvarItens.isPending}
                  className="flex-1 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60">
                  {salvarItens.isPending ? "Salvando…" : "Salvar Quantidades"}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COTAÇÕES
// ══════════════════════════════════════════════════════════════════════════════

// ── Componente: upload e extração de proposta PDF/XLS/DOCX ───────────────────

function UploadProposta({ onItensExtraidos }: {
  onItensExtraidos: (itens: (CotacaoItemCreate & { _key?: number })[]) => void
}) {
  const [dragging, setDragging] = useState(false);
  const [extraindo, setExtraindo] = useState(false);
  const [resultado, setResultado] = useState<{ arquivo: string; total: number } | null>(null);
  const [errUpload, setErrUpload] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const processar = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["pdf", "xlsx", "xls", "docx", "doc"].includes(ext)) {
      setErrUpload("Formato não suportado. Use PDF, XLSX ou DOCX.");
      return;
    }
    setErrUpload("");
    setExtraindo(true);
    setResultado(null);
    try {
      const res = await cotacoesApi.extrairItens(file);
      if (res.itens.length === 0) {
        setErrUpload("Nenhum item encontrado no arquivo. Verifique se o PDF contém uma tabela de itens.");
      } else {
        setResultado({ arquivo: res.arquivo, total: res.total });
        onItensExtraidos(res.itens);
      }
    } catch (e: any) {
      setErrUpload(parseApiError(e, "Erro ao extrair itens do arquivo."));
    } finally {
      setExtraindo(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processar(file);
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !extraindo && fileRef.current?.click()}
        className={clsx(
          "relative border-2 border-dashed rounded-xl px-6 py-5 text-center cursor-pointer transition-all",
          dragging
            ? "border-brand-400 bg-brand-50"
            : extraindo
              ? "border-amber-300 bg-amber-50 cursor-wait"
              : resultado
                ? "border-emerald-300 bg-emerald-50"
                : "border-slate-200 hover:border-brand-300 hover:bg-slate-50"
        )}>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.xlsx,.xls,.docx,.doc"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) processar(f); e.target.value = ""; }}
        />

        {extraindo ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-amber-700">Extraindo itens com IA…</p>
            <p className="text-xs text-amber-500">Aguarde enquanto o Gemini analisa a proposta</p>
          </div>
        ) : resultado ? (
          <div className="flex items-center justify-center gap-3">
            <CheckCircle2 size={22} className="text-emerald-500 flex-shrink-0" />
            <div className="text-left">
              <p className="text-sm font-semibold text-emerald-700">
                {resultado.total} item(ns) extraído(s) com sucesso!
              </p>
              <p className="text-xs text-emerald-500 truncate max-w-xs">{resultado.arquivo}</p>
              <p className="text-xs text-slate-400 mt-0.5">Revise e ajuste os itens abaixo antes de salvar</p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); setResultado(null); onItensExtraidos([]); }}
              className="ml-auto text-xs text-slate-400 hover:text-slate-600 border border-slate-200 px-2 py-1 rounded-lg">
              Trocar arquivo
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload size={24} className="text-slate-300" />
            <div>
              <p className="text-sm font-medium text-slate-600">
                Importar Proposta do Fornecedor
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Arraste ou clique para selecionar — PDF, XLSX ou DOCX
              </p>
              <p className="text-xs text-brand-500 mt-1 font-medium">
                ✦ Extração automática com IA (Gemini)
              </p>
            </div>
          </div>
        )}
      </div>

      {errUpload && (
        <p className="text-xs text-red-600 flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertTriangle size={13} /> {errUpload}
        </p>
      )}
    </div>
  );
}

const STATUS_COT_LABELS: Record<string, string> = {
  recebida: "Recebida", analisada: "Recebida", aprovada: "Aprovada", recusada: "Recusada",
};
const STATUS_COT_COR: Record<string, string> = {
  recebida:  "bg-blue-100 text-blue-700",
  analisada: "bg-blue-100 text-blue-700",
  aprovada:  "bg-emerald-100 text-emerald-700",
  recusada:  "bg-red-100 text-red-700",
};
// Apenas estes 3 status são permitidos para seleção
const STATUS_COT_OPCOES: Array<{ value: StatusCotacao; label: string }> = [
  { value: "recebida", label: "Recebida" },
  { value: "aprovada", label: "Aprovada" },
  { value: "recusada", label: "Recusada" },
];

function CotacoesTab() {
  const qc = useQueryClient();
  const hoje = new Date().toISOString().slice(0, 10);

  // ── Estado: filtros ───────────────────────────────────────────────────────
  const [buscaCot, setBuscaCot] = useState("");
  const [filtroStatusCot, setFiltroStatusCot] = useState("");

  // ── Estado: justificativa de recusa ───────────────────────────────────────
  const [recusaModal, setRecusaModal] = useState<{ id: string; justif: string } | null>(null);

  // ── Estado: form nova cotação ─────────────────────────────────────────────
  type FormCot = {
    requisicao_id: string;
    fornecedor_id: string;
    data_cotacao: string;
    validade: string;
    prazo_entrega: string;
    condicao_pagamento: string;
    frete: string;
    observacoes: string;
  };
  const formInit: FormCot = {
    requisicao_id: "", fornecedor_id: "", data_cotacao: hoje,
    validade: "", prazo_entrega: "", condicao_pagamento: "", frete: "", observacoes: "",
  };
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState<FormCot>(formInit);
  const [itens, setItens] = useState<(CotacaoItemCreate & { _key: number })[]>([]);
  const [err, setErr] = useState("");

  // ── Estado: comparativo ───────────────────────────────────────────────────
  const [comparativoReq, setComparativoReq] = useState<Requisicao | null>(null);
  const [selecoes, setSelecoes] = useState<Map<string, GerarOCSelecao>>(new Map());
  // chave: descricao normalizada → seleção

  // ── Estado: simulação de cotações ─────────────────────────────────────────
  const [simModal, setSimModal] = useState(false);
  const [simReqId, setSimReqId] = useState("");
  const [simPending, setSimPending] = useState(false);

  // ── Estado: arquivo (upload/view) ─────────────────────────────────────────
  const fileArquivoRef = useRef<HTMLInputElement>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [viewArquivo, setViewArquivo] = useState<{ url: string; nome: string; isPdf: boolean } | null>(null);

  // ── Dados ─────────────────────────────────────────────────────────────────
  const { data: cotacoes = [], isLoading } = useQuery<Cotacao[]>({
    queryKey: ["cotacoes"],
    queryFn: () => cotacoesApi.listar(),
  });
  const { data: fornecedores = [] } = useQuery<Fornecedor[]>({
    queryKey: ["fornecedores"],
    queryFn: () => fornecedoresApi.listar({ ativo: true }),
  });
  const { data: requisicoes = [] } = useQuery<Requisicao[]>({
    queryKey: ["requisicoes"],
    queryFn: () => suprimentosApi.listarRequisicoes(),
  });
  const { data: comparativo, isLoading: loadingComp } = useQuery<ComparativoResponse>({
    queryKey: ["comparativo", comparativoReq?.id],
    queryFn: () => cotacoesApi.comparativo(comparativoReq!.id),
    enabled: !!comparativoReq,
  });

  const cotFiltradas = useMemo(() => {
    const q = buscaCot.toLowerCase().trim();
    return cotacoes.filter(c => {
      const matchQ = !q || c.numero.toLowerCase().includes(q) ||
        (c.fornecedor_nome ?? "").toLowerCase().includes(q);
      const matchS = !filtroStatusCot || c.status === filtroStatusCot;
      return matchQ && matchS;
    });
  }, [cotacoes, buscaCot, filtroStatusCot]);

  // ── Ouvir evento de "Registrar Cotação" vindo da tela de Requisições ──────
  useState(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ requisicao: Requisicao }>;
      setForm({ ...formInit, requisicao_id: ev.detail.requisicao.id });
      // Pré-popula itens da requisição com preço 0 para o fornecedor preencher
      setItens(ev.detail.requisicao.itens.map((it: any, i: number) => ({
        _key: i,
        descricao: it.descricao,
        unidade: it.unidade,
        quantidade: it.quantidade,
        preco_unitario: 0,
        observacao: it.observacao ?? "",
      })));
      setModalAberto(true);
    };
    window.addEventListener("abrir-nova-cotacao", handler);
    return () => window.removeEventListener("abrir-nova-cotacao", handler);
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const criarCotacao = useMutation({
    mutationFn: (data: CotacaoCreate) => cotacoesApi.criar(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cotacoes"] });
      qc.invalidateQueries({ queryKey: ["requisicoes"] });
      setModalAberto(false);
      setForm(formInit);
      setItens([]);
    },
    onError: (e: any) => setErr(parseApiError(e, "Erro ao registrar cotação")),
  });

  const atualizarCot = useMutation({
    mutationFn: ({ id, status, observacoes }: { id: string; status: StatusCotacao; observacoes?: string }) =>
      cotacoesApi.atualizar(id, { status, ...(observacoes ? { observacoes } : {}) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cotacoes"] }),
  });

  const excluirCot = useMutation({
    mutationFn: (id: string) => cotacoesApi.excluir(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cotacoes"] }),
  });

  const gerarOCs = useMutation({
    mutationFn: ({ reqId, sel }: { reqId: string; sel: GerarOCSelecao[] }) =>
      cotacoesApi.gerarOCs(reqId, { selecoes: sel, data_emissao: hoje }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cotacoes"] });
      qc.invalidateQueries({ queryKey: ["requisicoes"] });
      qc.invalidateQueries({ queryKey: ["ordens-compra"] });
      setComparativoReq(null);
      setSelecoes(new Map());
    },
    onError: (e: any) => alert(parseApiError(e, "Erro ao gerar OCs")),
  });

  // ── Simulação: gera cotações demo para uma requisição em_cotacao ──────────
  async function executarSimulacao() {
    if (!simReqId) return;
    const req = requisicoes.find(r => r.id === simReqId);
    if (!req || req.itens.length === 0) return alert("Requisição sem itens.");
    const forns = fornecedores.slice(0, 3);
    if (forns.length === 0) return alert("Nenhum fornecedor cadastrado.");

    // Preços base: hash determinístico sobre a descrição do item
    const hashStr = (s: string) => Math.abs([...s.toLowerCase()].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0));
    const basePreco = (desc: string, un: string) => {
      const h = hashStr(desc);
      const faixas: Record<string, [number, number]> = {
        SC: [14, 35], M3: [80, 160], UN: [0.40, 25], KG: [4, 12], M2: [12, 30], M: [8, 60], L: [2, 15],
      };
      const [lo, hi] = faixas[un.toUpperCase()] ?? [5, 100];
      return +(lo + (h % 1000) / 1000 * (hi - lo)).toFixed(2);
    };
    // Multiplicadores por fornecedor/item → vencedores distintos
    const mult = [
      [0.92, 1.04, 1.07],  // forn 0 ganha itens 0,3,6; forn 1 ganha itens 1,4; forn 2 ganha 2,5
      [1.05, 0.93, 1.08],
      [1.08, 1.06, 0.94],
    ];

    const prazos    = ["5 dias úteis após aprovação", "7 a 10 dias úteis", "3 dias úteis (estoque disponível)"];
    const conds     = ["30/60 dias", "À vista (2% desc.) ou 28 dias", "À vista ou 30 dias"];
    const fretes    = ["CIF (incluso)", "FOB (por conta do comprador)", "CIF acima de R$ 3.000"];
    const obsForn   = [
      "Entrega inclusa para compras acima de R$ 5.000.",
      "Frete por conta do comprador. Desconto à vista.",
      "Estoque disponível para entrega imediata.",
    ];

    setSimPending(true);
    try {
      for (let fi = 0; fi < forns.length; fi++) {
        const itensCreate: CotacaoItemCreate[] = req.itens
          .filter((_: any, idx: number) => {
            // Último fornecedor não cota itens 3 e 5 (simula cotação parcial)
            if (fi === forns.length - 1 && (idx === 3 || idx === 5)) return false;
            return true;
          })
          .map((it: any, idx: number) => {
            const base = basePreco(it.descricao, it.unidade);
            const m = mult[fi]?.[idx % 3] ?? 1.0;
            const pu = +(base * m).toFixed(2);
            return { descricao: it.descricao, unidade: it.unidade, quantidade: it.quantidade, preco_unitario: pu };
          });
        await cotacoesApi.criar({
          requisicao_id: req.id,
          fornecedor_id: forns[fi].id,
          data_cotacao: hoje,
          validade: new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10),
          prazo_entrega: prazos[fi],
          condicao_pagamento: conds[fi],
          frete: fretes[fi],
          observacoes: obsForn[fi],
          itens: itensCreate,
        });
      }
      qc.invalidateQueries({ queryKey: ["cotacoes"] });
      qc.invalidateQueries({ queryKey: ["requisicoes"] });
      setSimModal(false);
      setSimReqId("");
    } catch (e: any) {
      alert(parseApiError(e, "Erro ao criar cotações de simulação"));
    } finally {
      setSimPending(false);
    }
  }

  // ── Arquivo: upload, download, visualização ────────────────────────────────
  async function handleUploadArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadingId) return;
    e.target.value = "";
    try {
      await cotacoesApi.uploadArquivo(uploadingId, file);
      qc.invalidateQueries({ queryKey: ["cotacoes"] });
    } catch {
      alert("Erro ao fazer upload do arquivo.");
    } finally {
      setUploadingId(null);
    }
  }

  async function handleBaixarArquivo(cot: Cotacao) {
    try {
      const blob = await cotacoesApi.downloadArquivo(cot.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = cot.arquivo_nome ?? "proposta";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Erro ao baixar arquivo.");
    }
  }

  async function handleVisualizarArquivo(cot: Cotacao) {
    try {
      const blob = await cotacoesApi.downloadArquivo(cot.id);
      const url = URL.createObjectURL(blob);
      const isPdf = (cot.arquivo_nome ?? "").toLowerCase().endsWith(".pdf");
      setViewArquivo({ url, nome: cot.arquivo_nome ?? "proposta", isPdf });
    } catch {
      alert("Erro ao carregar arquivo.");
    }
  }

  // ── Helpers de item ────────────────────────────────────────────────────────
  const addItem = () =>
    setItens(p => [...p, { _key: Date.now(), descricao: "", unidade: "un", quantidade: 1, preco_unitario: 0, marca_modelo: "" }]);

  const updItem = (key: number, field: string, value: any) =>
    setItens(p => p.map(i => i._key === key ? { ...i, [field]: value } : i));

  const remItem = (key: number) =>
    setItens(p => p.filter(i => i._key !== key));

  const handleSubmit = () => {
    if (!form.data_cotacao) return setErr("Data da cotação é obrigatória");
    if (itens.length === 0) return setErr("Adicione ao menos um item");
    setErr("");
    criarCotacao.mutate({
      requisicao_id: form.requisicao_id || null,
      fornecedor_id: form.fornecedor_id || null,
      data_cotacao: form.data_cotacao,
      validade: form.validade || null,
      prazo_entrega: form.prazo_entrega || null,
      condicao_pagamento: form.condicao_pagamento || null,
      frete: form.frete || null,
      observacoes: form.observacoes || null,
      itens: itens.map(({ _key, ...rest }) => rest),
    });
  };

  // ── Comparativo: helpers ───────────────────────────────────────────────────
  const toggleSelecao = (descricao: string, cotId: string, preco: number, un: string, qtd: number) => {
    const key = descricao.toLowerCase().trim();
    setSelecoes(prev => {
      const next = new Map(prev);
      if (next.has(key) && next.get(key)!.cotacao_id === cotId) {
        next.delete(key);
      } else {
        next.set(key, { cotacao_id: cotId, descricao, unidade: un, quantidade: qtd, preco_unitario: preco });
      }
      return next;
    });
  };

  const selecionarMelhoresTodos = () => {
    if (!comparativo) return;
    const next = new Map<string, GerarOCSelecao>();
    comparativo.itens.forEach(row => {
      const melhor = row.cotacoes.find(c => c.melhor);
      if (melhor) {
        next.set(row.descricao.toLowerCase().trim(), {
          cotacao_id: melhor.cotacao_id,
          descricao: row.descricao,
          unidade: row.unidade,
          quantidade: row.quantidade,
          preco_unitario: melhor.preco_unitario,
        });
      }
    });
    setSelecoes(next);
  };

  // ── Renderização ───────────────────────────────────────────────────────────
  const reqs_selecionaveis = requisicoes.filter(r =>
    r.status === "aprovada" || r.status === "em_cotacao"
  );

  // Requisições elegíveis para simulação (em_cotacao ou aprovada)
  const reqs_para_sim = requisicoes.filter(r =>
    r.status === "em_cotacao" || r.status === "aprovada"
  );

  return (
    <>
      {/* Input oculto para upload de arquivo de cotação */}
      <input
        ref={fileArquivoRef}
        type="file"
        accept=".pdf,.xlsx,.docx,.xls,.doc"
        className="hidden"
        onChange={handleUploadArquivo}
      />

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Cotações</h2>
          <p className="text-xs text-slate-500 mt-0.5">Respostas de fornecedores para requisições aprovadas</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setSimReqId(reqs_para_sim[0]?.id ?? ""); setSimModal(true); }}
            title="Gera cotações de demonstração com preços variados por fornecedor"
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600">
            <Zap size={15} /> Simular Cotações
          </button>
          <button
            onClick={() => { setForm(formInit); setItens([]); setErr(""); setModalAberto(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700">
            <Plus size={16} /> Nova Cotação
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="Buscar por número ou fornecedor…"
          value={buscaCot}
          onChange={e => setBuscaCot(e.target.value)}
          className="flex-1 min-w-[200px] text-sm px-3 py-1.5 border border-slate-200 rounded-lg outline-none focus:border-brand-400 bg-white"
        />
        <select
          value={filtroStatusCot}
          onChange={e => setFiltroStatusCot(e.target.value)}
          className="text-sm px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-600 outline-none focus:border-brand-400">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_COT_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        {(buscaCot || filtroStatusCot) && (
          <button
            onClick={() => { setBuscaCot(""); setFiltroStatusCot(""); }}
            className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5 border border-slate-200 rounded-lg bg-white">
            Limpar
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Carregando…</div>
      ) : cotacoes.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <BarChart2 size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma cotação registrada</p>
          <p className="text-xs mt-1">Após aprovar uma requisição, registre as respostas dos fornecedores.</p>
        </div>
      ) : cotFiltradas.length === 0 ? (
        <div className="text-center py-12 text-slate-400">Nenhuma cotação encontrada para os filtros aplicados</div>
      ) : (
        <div className="space-y-2">
          {cotFiltradas.map(c => {
            const req = requisicoes.find(r => r.id === c.requisicao_id);
            return (
              <div key={c.id}
                className="border border-slate-200 rounded-xl p-4 flex flex-wrap items-start gap-3 hover:border-slate-300 transition-colors">
                {/* Identificação */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">{c.numero}</span>
                    <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", STATUS_COT_COR[c.status as StatusCotacao])}>
                      {STATUS_COT_LABELS[c.status as StatusCotacao]}
                    </span>
                    {c.fornecedor_nome && (
                      <span className="text-sm font-medium text-slate-700">{c.fornecedor_nome}</span>
                    )}
                    {/* ── Botões de arquivo ─────────────────────────────── */}
                    {c.arquivo_nome ? (
                      <span className="flex items-center gap-1 ml-1">
                        <span className="text-xs text-slate-400 italic truncate max-w-[140px]" title={c.arquivo_nome}>
                          <Paperclip size={10} className="inline mr-0.5" />{c.arquivo_nome}
                        </span>
                        <button
                          onClick={() => handleVisualizarArquivo(c)}
                          title="Visualizar proposta"
                          className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors">
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => handleBaixarArquivo(c)}
                          title="Baixar proposta"
                          className="p-1 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors">
                          <Download size={13} />
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => { setUploadingId(c.id); fileArquivoRef.current?.click(); }}
                        title="Anexar arquivo da proposta recebida (PDF, XLSX, DOCX)"
                        className="flex items-center gap-1 px-2 py-0.5 text-xs border border-dashed border-slate-300 text-slate-400 rounded hover:border-brand-400 hover:text-brand-600 transition-colors">
                        <Paperclip size={11} /> Anexar proposta
                      </button>
                    )}
                  </div>
                  {req && (
                    <p className="text-xs text-slate-500 mt-1">
                      Ref: <span className="font-mono">{req.numero}</span> · {req.solicitante}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                    <span>Data: {new Date(c.data_cotacao + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                    {c.validade && <span>Val.: {new Date(c.validade + "T00:00:00").toLocaleDateString("pt-BR")}</span>}
                    {c.prazo_entrega && <span>Prazo: {c.prazo_entrega}</span>}
                    {c.condicao_pagamento && <span>Pag.: {c.condicao_pagamento}</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{c.itens.length} item(ns) · Total: <span className="font-semibold text-slate-600">{fmt(c.valor_total)}</span></p>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  {req && (c.status === "recebida" || c.status === "analisada") && (
                    <button
                      onClick={() => { setComparativoReq(req); setSelecoes(new Map()); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-50">
                      <BarChart2 size={13} /> Comparativo
                    </button>
                  )}
                  {/* Status só editável se não aprovada com OC gerada */}
                  {c.status !== "aprovada" ? (
                    <select
                      value={c.status === "analisada" ? "recebida" : c.status}
                      onChange={e => {
                        const novoStatus = e.target.value as StatusCotacao;
                        if (novoStatus === "recusada") {
                          setRecusaModal({ id: c.id, justif: "" });
                        } else {
                          atualizarCot.mutate({ id: c.id, status: novoStatus });
                        }
                      }}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 w-[120px]">
                      {STATUS_COT_OPCOES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-slate-400 italic px-2">OC gerada</span>
                  )}
                  <button
                    onClick={() => { if (confirm("Excluir cotação?")) excluirCot.mutate(c.id); }}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-200">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal: simulação de cotações ─────────────────────────────────────── */}
      {simModal && (
        <Modal aberto={simModal} onFechar={() => { setSimModal(false); setSimReqId(""); }}
          titulo="Simular Cotações Recebidas" largura="md">
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <Zap size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                Serão criadas <strong>{Math.min(fornecedores.length, 3)} cotações</strong> (uma por fornecedor),
                com preços variados por item — o último fornecedor não cotará 2 itens para simular
                uma cotação parcial. Use o <strong>Comparativo</strong> para ver a análise de melhor preço.
              </p>
            </div>

            {reqs_para_sim.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">
                Nenhuma requisição <em>aprovada</em> ou <em>em cotação</em> disponível.
                Crie uma requisição primeiro.
              </p>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Requisição para simular <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={simReqId}
                    onChange={e => setSimReqId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-brand-400 outline-none bg-white">
                    <option value="">Selecione…</option>
                    {reqs_para_sim.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.numero} · {r.solicitante} ({r.itens.length} itens)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 pt-1">
                  <button onClick={() => { setSimModal(false); setSimReqId(""); }}
                    className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
                    Cancelar
                  </button>
                  <button
                    disabled={!simReqId || simPending}
                    onClick={executarSimulacao}
                    className="flex-1 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-2">
                    {simPending
                      ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Criando…</>
                      : <><Zap size={14} /> Criar Cotações de Simulação</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ── Modal: visualizar arquivo da proposta ────────────────────────────── */}
      {viewArquivo && (
        <Modal
          aberto={!!viewArquivo}
          onFechar={() => { URL.revokeObjectURL(viewArquivo.url); setViewArquivo(null); }}
          titulo={`📄 ${viewArquivo.nome}`}
          largura="2xl">
          <div className="flex flex-col gap-3">
            {viewArquivo.isPdf ? (
              <iframe
                src={viewArquivo.url}
                title={viewArquivo.nome}
                className="w-full rounded-lg border border-slate-200"
                style={{ height: "70vh" }}
              />
            ) : (
              <div className="py-10 text-center text-slate-500">
                <FileText size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">Pré-visualização não disponível para este formato.</p>
                <p className="text-xs mt-1 text-slate-400">Use o botão abaixo para baixar o arquivo.</p>
              </div>
            )}
            <div className="flex justify-end">
              <a
                href={viewArquivo.url}
                download={viewArquivo.nome}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700">
                <Download size={15} /> Baixar arquivo
              </a>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: justificativa de recusa ───────────────────────────────────── */}
      {recusaModal && (
        <Modal aberto={!!recusaModal} onFechar={() => setRecusaModal(null)}
          titulo="Justificativa de Recusa" largura="md">
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3">
              <XCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">
                Ao marcar como <strong>Recusada</strong>, a cotação ficará registrada com a justificativa e
                não poderá ser utilizada para geração de OC. O responsável pela cotação será notificado.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Motivo da recusa <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={4}
                autoFocus
                value={recusaModal.justif}
                onChange={e => setRecusaModal(m => m ? { ...m, justif: e.target.value } : m)}
                placeholder="Ex.: Preços acima do mercado, prazo de entrega incompatível, produtos sem certificação..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-red-400 outline-none resize-none"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setRecusaModal(null)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
                Cancelar
              </button>
              <button
                disabled={!recusaModal.justif.trim()}
                onClick={() => {
                  atualizarCot.mutate({
                    id: recusaModal!.id,
                    status: "recusada",
                    observacoes: `[RECUSADA] ${recusaModal!.justif}`,
                  });
                  setRecusaModal(null);
                }}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                Confirmar Recusa
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: nova cotação ─────────────────────────────────────────────── */}
      {modalAberto && (
        <Modal
          aberto={modalAberto}
          onFechar={() => setModalAberto(false)}
          titulo="Registrar Cotação de Fornecedor"
          largura="2xl">
          <div className="space-y-4">
            {err && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}

            {/* ── Upload de proposta ────────────────────────────────────────── */}
            <UploadProposta
              onItensExtraidos={(novosItens) => {
                setItens(novosItens.map((it, i) => ({ ...it, _key: Date.now() + i })));
              }}
            />

            <div className="grid grid-cols-2 gap-3">
              {/* Requisição vinculada */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Requisição (opcional)</label>
                <select
                  value={form.requisicao_id}
                  onChange={e => {
                    const reqId = e.target.value;
                    setForm(f => ({ ...f, requisicao_id: reqId }));
                    if (reqId) {
                      const req = requisicoes.find(r => r.id === reqId);
                      if (req && itens.length === 0) {
                        setItens(req.itens.map((it: any, i: number) => ({
                          _key: i,
                          descricao: it.descricao,
                          unidade: it.unidade,
                          quantidade: it.quantidade,
                          preco_unitario: 0,
                          observacao: it.observacao ?? "",
                        })));
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-brand-400 outline-none bg-white">
                  <option value="">— Sem vínculo —</option>
                  {reqs_selecionaveis.map(r => (
                    <option key={r.id} value={r.id}>{r.numero} — {r.solicitante} ({r.itens.length} itens)</option>
                  ))}
                </select>
              </div>

              {/* Fornecedor */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Fornecedor</label>
                <select
                  value={form.fornecedor_id}
                  onChange={e => setForm(f => ({ ...f, fornecedor_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-brand-400 outline-none bg-white">
                  <option value="">— Selecione o fornecedor —</option>
                  {fornecedores.map(f => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Data da Cotação *</label>
                <input type="date" value={form.data_cotacao}
                  onChange={e => setForm(f => ({ ...f, data_cotacao: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-brand-400 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Validade da Proposta</label>
                <input type="date" value={form.validade}
                  onChange={e => setForm(f => ({ ...f, validade: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-brand-400 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Prazo de Entrega</label>
                <input type="text" placeholder="Ex.: 7 dias úteis"
                  value={form.prazo_entrega}
                  onChange={e => setForm(f => ({ ...f, prazo_entrega: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-brand-400 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Condição de Pagamento</label>
                <input type="text" placeholder="Ex.: 30/60/90 dias"
                  value={form.condicao_pagamento}
                  onChange={e => setForm(f => ({ ...f, condicao_pagamento: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-brand-400 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Frete</label>
                <input type="text" placeholder="CIF / FOB / Incluso"
                  value={form.frete}
                  onChange={e => setForm(f => ({ ...f, frete: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-brand-400 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Observações</label>
                <input type="text" value={form.observacoes}
                  onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-brand-400 outline-none" />
              </div>
            </div>

            {/* Itens com preços */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Itens cotados</p>
                <button onClick={addItem}
                  className="flex items-center gap-1 text-xs px-2 py-1 border border-brand-200 text-brand-600 rounded-lg hover:bg-brand-50">
                  <Plus size={12} /> Adicionar item
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
                {itens.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    Nenhum item. Vincule uma requisição ou clique em "Adicionar item".
                  </p>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr className="text-left text-slate-500 border-b border-slate-200">
                        <th className="px-3 py-2">Descrição</th>
                        <th className="px-2 py-2 w-32">Marca / Modelo</th>
                        <th className="px-2 py-2 w-14 text-center">Un</th>
                        <th className="px-2 py-2 w-16 text-right">Qtd</th>
                        <th className="px-2 py-2 w-28 text-right">Preço Unit.</th>
                        <th className="px-2 py-2 w-24 text-right">Total</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map(it => (
                        <tr key={it._key} className="border-t border-slate-100">
                          <td className="px-3 py-1.5">
                            <input type="text" value={it.descricao}
                              onChange={e => updItem(it._key, "descricao", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 rounded text-xs focus:border-brand-400 outline-none" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="text" value={(it as any).marca_modelo ?? ""}
                              placeholder="Marca · modelo"
                              onChange={e => updItem(it._key, "marca_modelo", e.target.value)}
                              className="w-full px-2 py-1 border border-violet-200 bg-violet-50/30 rounded text-xs focus:border-violet-400 outline-none" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="text" value={it.unidade}
                              onChange={e => updItem(it._key, "unidade", e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 rounded text-xs focus:border-brand-400 outline-none text-center" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0.001" step="0.001" value={it.quantidade}
                              onChange={e => updItem(it._key, "quantidade", +e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 rounded text-xs focus:border-brand-400 outline-none text-right" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" step="0.01" value={it.preco_unitario}
                              onChange={e => updItem(it._key, "preco_unitario", +e.target.value)}
                              className="w-full px-2 py-1 border border-amber-200 bg-amber-50 rounded text-xs focus:border-amber-400 outline-none text-right font-medium" />
                          </td>
                          <td className="px-2 py-1.5 text-right font-medium text-slate-700">
                            {fmt(it.quantidade * it.preco_unitario)}
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            <button onClick={() => remItem(it._key)}
                              className="text-slate-300 hover:text-red-500 transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 border-t border-slate-200">
                        <td colSpan={5} className="px-3 py-2 text-xs font-semibold text-slate-500 text-right uppercase">Total Geral</td>
                        <td className="px-2 py-2 text-right font-bold text-slate-800">
                          {fmt(itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0))}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button onClick={() => setModalAberto(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={handleSubmit} disabled={criarCotacao.isPending}
                className="px-5 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-60">
                {criarCotacao.isPending ? "Salvando…" : "Registrar Cotação"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: comparativo ──────────────────────────────────────────────── */}
      {comparativoReq && (
        <Modal
          aberto={!!comparativoReq}
          onFechar={() => { setComparativoReq(null); setSelecoes(new Map()); }}
          titulo={`Comparativo de Cotações — ${comparativoReq.numero}`}
          largura="2xl">
          {loadingComp ? (
            <div className="py-12 text-center text-slate-400">Carregando comparativo…</div>
          ) : !comparativo || comparativo.fornecedores.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <BarChart2 size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma cotação para esta requisição</p>
              <p className="text-xs mt-1">Registre as respostas dos fornecedores primeiro.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Cabeçalho dos fornecedores */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left text-xs text-slate-500 font-medium border-b border-slate-200 bg-slate-50 w-1/3">
                        Item
                      </th>
                      <th className="px-2 py-2 text-center text-xs text-slate-500 font-medium border-b border-slate-200 bg-slate-50 w-14">
                        Un
                      </th>
                      <th className="px-2 py-2 text-right text-xs text-slate-500 font-medium border-b border-slate-200 bg-slate-50 w-14">
                        Qtd
                      </th>
                      {comparativo.fornecedores.map(f => (
                        <th key={f.cotacao_id}
                          className="px-3 py-2 text-center text-xs font-medium border-b border-slate-200 bg-blue-50 text-blue-700 min-w-[100px]">
                          <div className="font-semibold">{f.cotacao_numero}</div>
                          <div className="text-blue-500 font-normal truncate max-w-[120px]">{f.fornecedor_nome}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparativo.itens.map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                        <td className="px-3 py-2 text-sm text-slate-700 border-b border-slate-100 font-medium">
                          {row.descricao}
                        </td>
                        <td className="px-2 py-2 text-center text-xs text-slate-500 border-b border-slate-100">
                          {row.unidade}
                        </td>
                        <td className="px-2 py-2 text-right text-xs text-slate-500 border-b border-slate-100 font-mono">
                          {row.quantidade}
                        </td>
                        {comparativo.fornecedores.map(f => {
                          const preco = row.cotacoes.find(c => c.cotacao_id === f.cotacao_id);
                          const key = row.descricao.toLowerCase().trim();
                          const selecionado = selecoes.get(key)?.cotacao_id === f.cotacao_id;
                          if (!preco) {
                            return (
                              <td key={f.cotacao_id}
                                className="px-3 py-2 text-center text-xs text-slate-300 border-b border-slate-100">
                                —
                              </td>
                            );
                          }
                          return (
                            <td key={f.cotacao_id}
                              className="px-3 py-2 text-center border-b border-slate-100">
                              <button
                                onClick={() => toggleSelecao(row.descricao, f.cotacao_id, preco.preco_unitario, row.unidade, row.quantidade)}
                                className={clsx(
                                  "w-full rounded-lg px-2 py-1.5 text-xs font-medium transition-all border-2",
                                  selecionado
                                    ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                                    : preco.melhor
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-400"
                                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                )}>
                                <div className="font-mono">
                                  {fmt(preco.preco_unitario)}
                                  {preco.melhor && !selecionado && (
                                    <span className="ml-1 text-emerald-500 text-[10px]">★</span>
                                  )}
                                </div>
                                <div className="text-[10px] opacity-70 mt-0.5">
                                  Total: {fmt(preco.preco_total)}
                                </div>
                                {preco.marca_modelo && (
                                  <div className={clsx(
                                    "text-[10px] mt-1 font-semibold truncate",
                                    selecionado ? "text-white/90" : "text-violet-600"
                                  )} title={preco.marca_modelo}>
                                    🏷️ {preco.marca_modelo}
                                  </div>
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100">
                      <td colSpan={3} className="px-3 py-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Total por Fornecedor
                      </td>
                      {comparativo.fornecedores.map(f => (
                        <td key={f.cotacao_id} className="px-3 py-2 text-center">
                          <div className="text-sm font-bold text-slate-800">{fmt(f.total_geral)}</div>
                          {f.validade && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Val.: {new Date(f.validade + "T00:00:00").toLocaleDateString("pt-BR")}
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Resumo da seleção */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-medium text-blue-800">
                      {selecoes.size} de {comparativo.itens.length} itens selecionados
                    </p>
                    <p className="text-xs text-blue-600 mt-0.5">
                      Clique nos preços para selecionar o fornecedor vencedor de cada item. ★ = menor preço.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={selecionarMelhoresTodos}
                      className="px-3 py-1.5 text-xs border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-100">
                      ★ Selecionar menores preços
                    </button>
                    <button
                      onClick={() => setSelecoes(new Map())}
                      className="px-3 py-1.5 text-xs border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
                      Limpar
                    </button>
                  </div>
                </div>

                {selecoes.size > 0 && (
                  <div className="mt-3">
                    {/* Agrupamento por fornecedor/cotação */}
                    {(() => {
                      const grupos = new Map<string, { nome: string; itens: GerarOCSelecao[]; total: number }>();
                      selecoes.forEach(sel => {
                        const forn = comparativo.fornecedores.find(f => f.cotacao_id === sel.cotacao_id);
                        const nome = forn?.fornecedor_nome ?? sel.cotacao_id;
                        const k = sel.cotacao_id;
                        if (!grupos.has(k)) grupos.set(k, { nome, itens: [], total: 0 });
                        const g = grupos.get(k)!;
                        g.itens.push(sel);
                        g.total += sel.quantidade * sel.preco_unitario;
                      });
                      return Array.from(grupos.entries()).map(([cotId, g]) => (
                        <div key={cotId} className="text-xs text-blue-700 mt-1 flex items-center gap-2">
                          <ChevronRight size={12} />
                          <span className="font-medium">{g.nome}</span>
                          <span>— {g.itens.length} item(ns) — {fmt(g.total)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-1 border-t border-slate-100">
                <button onClick={() => { setComparativoReq(null); setSelecoes(new Map()); }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50">
                  Fechar
                </button>
                <button
                  onClick={() => {
                    if (selecoes.size === 0) return alert("Selecione ao menos um item.");
                    if (!confirm(`Gerar ${new Set(Array.from(selecoes.values()).map(s => s.cotacao_id)).size} Ordem(ns) de Compra?`)) return;
                    gerarOCs.mutate({
                      reqId: comparativoReq.id,
                      sel: Array.from(selecoes.values()),
                    });
                  }}
                  disabled={selecoes.size === 0 || gerarOCs.isPending}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                  <GitMerge size={14} />
                  {gerarOCs.isPending ? "Gerando OCs…" : `Gerar ${new Set(Array.from(selecoes.values()).map(s => s.cotacao_id)).size > 0 ? new Set(Array.from(selecoes.values()).map(s => s.cotacao_id)).size : ""} OC(s)`}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

export function Suprimentos() {
  const [tab, setTab] = useState<Tab>("requisicoes");

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "requisicoes",    label: "Requisições",      icon: <ShoppingCart size={16} /> },
    { id: "cotacoes",       label: "Cotações",         icon: <BarChart2 size={16} /> },
    { id: "ordens_compra",  label: "Ordens de Compra", icon: <Truck size={16} /> },
    { id: "recebimentos",   label: "Recebimentos",     icon: <CheckCircle2 size={16} /> },
    { id: "fornecedores",   label: "Fornecedores",     icon: <Package size={16} /> },
    { id: "estoque",        label: "Estoque",          icon: <Archive size={16} /> },
    { id: "transferencias", label: "Transferências",   icon: <ArrowLeftRight size={16} /> },
  ];

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-800">Suprimentos</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Requisições · Cotações · Ordens de Compra · Recebimentos · Fornecedores · Estoque
        </p>
      </div>

      {/* Fluxo de compras */}
      <div className="flex items-center gap-2 mb-5 text-xs text-slate-500 overflow-x-auto py-1">
        {[
          { step: "1", label: "Requisição",     desc: "Solicitante registra necessidade",    tab: "requisicoes" as Tab },
          { step: "2", label: "Aprovação",       desc: "Responsável valida e prioriza",       tab: null },
          { step: "3", label: "Cotação",         desc: "Fornecedores enviam preços",          tab: "cotacoes" as Tab },
          { step: "4", label: "Ordem de Compra", desc: "Comprador emite para fornecedor",     tab: "ordens_compra" as Tab },
          { step: "5", label: "Recebimento",     desc: "Obra confirma entrega e quantidades", tab: "recebimentos" as Tab },
        ].map((s, idx) => (
          <div key={s.step} className="flex items-center gap-2 flex-shrink-0">
            {idx > 0 && <div className="w-8 h-px bg-slate-300 flex-shrink-0" />}
            <button
              onClick={() => s.tab && setTab(s.tab)}
              className={clsx(
                "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-left",
                s.tab ? "cursor-pointer hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50" : "cursor-default",
                s.tab === tab
                  ? "border-brand-300 bg-brand-50 text-brand-700"
                  : "border-slate-200 bg-white text-slate-600"
              )}>
              <span className={clsx(
                "w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0",
                s.tab === tab ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-600"
              )}>{s.step}</span>
              <div>
                <p className="font-medium leading-tight">{s.label}</p>
                <p className="text-xs text-slate-400 leading-tight hidden sm:block">{s.desc}</p>
              </div>
            </button>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors -mb-px border-b-2 whitespace-nowrap",
              tab === t.id
                ? "border-brand-600 text-brand-600 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-6">
        {tab === "fornecedores"   && <FornecedoresTab />}
        {tab === "requisicoes"    && <RequisicoesTab />}
        {tab === "cotacoes"       && <CotacoesTab />}
        {tab === "ordens_compra"  && <OrdensCompraTab />}
        {tab === "recebimentos"   && <RecebimentosTab />}
        {tab === "estoque"        && <EstoqueTab />}
        {tab === "transferencias" && <TransferenciasTab />}
      </div>
    </div>
  );
}
