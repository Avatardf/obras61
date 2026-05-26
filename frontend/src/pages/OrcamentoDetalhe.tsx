import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, CheckCircle2, ChevronDown, ChevronRight,
  Loader2, Plus, Trash2,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { clsx } from "clsx";
import { orcamentosApi } from "@/api/client";
import { Select } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import type { ItemOrcamentoCreate, OrcamentoDetalhe as OrcDetalhe, OrigemPreco } from "@/types";

// ── Formatters ─────────────────────────────────────────────────────────────────

function moeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_LABEL: Record<string, [string, string]> = {
  rascunho:  ["bg-amber-50 text-amber-700 border border-amber-200",  "Rascunho"],
  vigente:   ["bg-emerald-50 text-emerald-700 border border-emerald-200", "Vigente"],
  arquivado: ["bg-slate-100 text-slate-500 border border-slate-200", "Arquivado"],
};

const ORIGEM_LABELS: Record<OrigemPreco, string> = {
  sinapi:   "SINAPI",
  sicro:    "SICRO",
  cub:      "CUB",
  cotacao:  "Cotação",
  proprio:  "Próprio",
};

// ── Formulário inline de novo item ────────────────────────────────────────────

const EMPTY_ITEM: ItemOrcamentoCreate = {
  codigo_composicao: "",
  descricao: "",
  unidade: "m²",
  quantidade: 1,
  custo_unitario: 0,
  origem_preco: "sinapi",
};

function NovoItemForm({
  orcId,
  onSalvo,
}: {
  orcId: string;
  onSalvo: () => void;
}) {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<ItemOrcamentoCreate>({ ...EMPTY_ITEM });
  const [erro, setErro] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => orcamentosApi.adicionarItem(orcId, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orcamento", orcId] });
      setForm({ ...EMPTY_ITEM });
      setErro(null);
      onSalvo();
    },
    onError: (err: any) => {
      setErro(err?.response?.data?.detail ?? "Erro ao adicionar item");
    },
  });

  function set<K extends keyof ItemOrcamentoCreate>(k: K, v: ItemOrcamentoCreate[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  const totalPreview = (form.quantidade || 0) * (form.custo_unitario || 0);
  const valido = form.descricao.trim().length >= 2 && form.custo_unitario > 0;

  return (
    <div className="border-t border-slate-100">
      {!aberto ? (
        <button
          onClick={() => setAberto(true)}
          className="w-full flex items-center gap-2 px-5 py-3 text-sm text-brand-600 hover:bg-brand-50 transition-colors"
        >
          <Plus size={14} /> Adicionar item
        </button>
      ) : (
        <div className="p-4 bg-slate-50 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Novo item</span>
            <button onClick={() => { setAberto(false); setErro(null); }} className="text-slate-400 hover:text-slate-600">
              ✕
            </button>
          </div>

          {/* Linha 1: código + descrição */}
          <div className="grid grid-cols-12 gap-2">
            <input
              placeholder="Código (SINAPI)"
              value={form.codigo_composicao ?? ""}
              onChange={e => set("codigo_composicao", e.target.value || null)}
              className="col-span-3 px-2.5 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
            <input
              placeholder="Descrição do serviço / material *"
              value={form.descricao}
              onChange={e => set("descricao", e.target.value)}
              className="col-span-9 px-2.5 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
          </div>

          {/* Linha 2: unidade + qtd + custo unit + origem + total */}
          <div className="grid grid-cols-12 gap-2 items-center">
            <input
              placeholder="Un."
              value={form.unidade}
              onChange={e => set("unidade", e.target.value)}
              className="col-span-1 px-2 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-400 text-center"
            />
            <CurrencyInput
              bare small
              value={form.quantidade}
              onChange={v => set("quantidade", v ?? 0)}
              placeholder="Qtd."
              decimais={3}
              className="col-span-2"
            />
            <CurrencyInput
              bare small
              value={form.custo_unitario}
              onChange={v => set("custo_unitario", v ?? 0)}
              placeholder="Preço unit."
              decimais={4}
              className="col-span-3"
            />
            <select
              value={form.origem_preco}
              onChange={e => set("origem_preco", e.target.value as OrigemPreco)}
              className="col-span-2 px-2.5 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-400 bg-white"
            >
              {(Object.entries(ORIGEM_LABELS) as [OrigemPreco, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <div className="col-span-2 text-right text-xs font-semibold text-slate-700 tabular-nums">
              {moeda(totalPreview)}
            </div>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !valido}
              className="col-span-2 py-2 bg-brand-600 text-white text-xs rounded-lg hover:bg-brand-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-1"
            >
              {mutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Adicionar
            </button>
          </div>

          {erro && <p className="text-xs text-red-600">{erro}</p>}
        </div>
      )}
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

export function OrcamentoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: orc, isLoading } = useQuery<OrcDetalhe>({
    queryKey: ["orcamento", id],
    queryFn: () => orcamentosApi.buscar(id!),
    enabled: !!id,
  });

  const ativarMutation = useMutation({
    mutationFn: (novoStatus: string) =>
      orcamentosApi.atualizar(id!, { status: novoStatus }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orcamento", id] }),
  });

  const excluirItemMutation = useMutation({
    mutationFn: (itemId: string) => orcamentosApi.excluirItem(itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orcamento", id] }),
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-1/3" />
        <div className="h-4 bg-slate-100 rounded w-1/4" />
        <div className="h-64 bg-white border border-slate-200 rounded-xl" />
      </div>
    );
  }

  if (!orc) return null;

  const [statusCls, statusLabel] = STATUS_LABEL[orc.status] ?? STATUS_LABEL.rascunho;
  const bacComBdi = orc.valor_total * (1 + orc.bdi_percentual / 100);

  return (
    <div className="p-6 space-y-5">

      {/* Cabeçalho */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors mt-0.5"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-slate-800">
              Orçamento v{orc.versao}
            </h2>
            <span className={clsx("text-xs font-semibold px-2.5 py-0.5 rounded-full", statusCls)}>
              {statusLabel}
            </span>
          </div>
          {orc.descricao && (
            <p className="text-sm text-slate-500 mt-0.5">{orc.descricao}</p>
          )}
          <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-slate-400">
            <span>Base: <strong className="text-slate-600 uppercase">{orc.base_referencia}</strong></span>
            {orc.uf_referencia && <span>UF: <strong className="text-slate-600">{orc.uf_referencia}</strong></span>}
            {orc.data_referencia && <span>Ref.: <strong className="text-slate-600">{orc.data_referencia}</strong></span>}
            <span>BDI: <strong className="text-slate-600">{orc.bdi_percentual}%</strong></span>
          </div>
        </div>

        {/* Ações de status */}
        <div className="flex gap-2 shrink-0">
          {orc.status === "rascunho" && (
            <button
              onClick={() => ativarMutation.mutate("vigente")}
              disabled={ativarMutation.isPending || orc.total_itens === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              title={orc.total_itens === 0 ? "Adicione pelo menos um item primeiro" : ""}
            >
              {ativarMutation.isPending
                ? <Loader2 size={14} className="animate-spin" />
                : <CheckCircle2 size={14} />
              }
              Ativar orçamento
            </button>
          )}
          {orc.status === "vigente" && (
            <button
              onClick={() => ativarMutation.mutate("arquivado")}
              disabled={ativarMutation.isPending}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Arquivar
            </button>
          )}
        </div>
      </div>

      {/* Cards de resumo financeiro */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "BAC (s/ BDI)", valor: moeda(orc.valor_total), cor: "text-slate-700" },
          { label: `BAC (c/ BDI ${orc.bdi_percentual}%)`, valor: moeda(bacComBdi), cor: "text-brand-700 font-bold" },
          { label: "Total de itens", valor: String(orc.total_itens), cor: "text-slate-700" },
          { label: "Status", valor: statusLabel, cor: orc.status === "vigente" ? "text-emerald-700 font-bold" : "text-amber-700 font-bold" },
        ].map(({ label, valor, cor }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-400 mb-1">{label}</p>
            <p className={clsx("text-lg", cor)}>{valor}</p>
          </div>
        ))}
      </div>

      {/* Tabela de itens */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Itens do orçamento</h3>
          <span className="text-xs text-slate-400">{orc.itens.length} item{orc.itens.length !== 1 ? "s" : ""}</span>
        </div>

        {orc.itens.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-400">
            <p className="font-medium text-slate-500">Nenhum item cadastrado</p>
            <p className="text-sm mt-1">Adicione itens de serviços e materiais abaixo</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Código</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Descrição</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-14">Un.</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Qtd.</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">R$ Unit.</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-32">Total</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Origem</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orc.itens.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                      {item.codigo_composicao ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.descricao}</td>
                    <td className="px-3 py-3 text-center text-slate-500 text-xs">{item.unidade}</td>
                    <td className="px-3 py-3 text-right text-slate-600 tabular-nums">{item.quantidade.toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-3 text-right text-slate-600 tabular-nums">{moeda(item.custo_unitario)}</td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-800 tabular-nums">{moeda(item.custo_total)}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
                        {ORIGEM_LABELS[item.origem_preco as OrigemPreco] ?? item.origem_preco}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      {orc.status !== "arquivado" && (
                        <button
                          onClick={() => excluirItemMutation.mutate(item.id)}
                          disabled={excluirItemMutation.isPending}
                          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-slate-600 text-right uppercase tracking-wide">
                    Total s/ BDI
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-slate-800 tabular-nums">
                    {moeda(orc.valor_total)}
                  </td>
                  <td colSpan={2} />
                </tr>
                {orc.bdi_percentual > 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-2 text-xs font-semibold text-brand-700 text-right uppercase tracking-wide">
                      Total c/ BDI ({orc.bdi_percentual}%)
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-brand-700 tabular-nums">
                      {moeda(bacComBdi)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        )}

        {/* Formulário inline de novo item (apenas para rascunho/vigente) */}
        {orc.status !== "arquivado" && (
          <NovoItemForm orcId={orc.id} onSalvo={() => {}} />
        )}
      </div>
    </div>
  );
}
