import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, Wallet, AlertCircle, Plus, Trash2, Pencil,
  ShoppingCart, CheckCircle2, CreditCard,
} from "lucide-react";
import { financeiroApi } from "@/api/client";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { clsx } from "clsx";
import type { LancamentoCreate, LancamentoFinanceiro, ResumoFinanceiro, FluxoCaixaMes, TipoLancamento, StatusLancamento } from "@/types";

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_LABELS: Record<StatusLancamento, string> = {
  previsto: "Previsto", pago: "Pago", atrasado: "Atrasado", cancelado: "Cancelado",
};
const STATUS_COR: Record<StatusLancamento, string> = {
  previsto:  "bg-blue-100 text-blue-700",
  pago:      "bg-emerald-100 text-emerald-700",
  atrasado:  "bg-red-100 text-red-700",
  cancelado: "bg-slate-100 text-slate-500",
};

// Categorias agrupadas — alinhadas com os itens do Centro de Custo (CC)
// Cada categoria do CC tem uma entrada aqui, agrupada por bloco.
const CATEGORIAS_DESPESA_GRUPOS: Array<{ label: string; opcoes: { value: string; label: string }[] }> = [
  {
    label: "Aquisição e Legalização (CC 1.x)",
    opcoes: [
      { value: "tributo_aquisicao", label: "ITBI / registro do imóvel" },
      { value: "juridico",          label: "Due diligence jurídica" },
      { value: "societario",        label: "Abertura SPE/SCP" },
      { value: "tributo",           label: "Tributos federais (RET)" },
      { value: "cartorio",          label: "Cartório / memorial / averbação" },
      { value: "licenca",           label: "Alvará / licenças / taxas" },
    ],
  },
  {
    label: "Projetos e Aprovações (CC 2.x)",
    opcoes: [
      { value: "projeto_arquitetonico",   label: "Projeto arquitetônico" },
      { value: "projeto_estrutural",      label: "Projeto estrutural" },
      { value: "projeto_complementar",    label: "Projetos complementares" },
      { value: "art_rrt",                 label: "ART/RRT — CREA/CAU" },
      { value: "aprovacao_concessionaria",label: "Aprovações em concessionárias" },
    ],
  },
  {
    label: "Custos de Obra (CC 3-9)",
    opcoes: [
      { value: "material",      label: "Material" },
      { value: "equipamento",   label: "Equipamento" },
      { value: "servico",       label: "Serviço" },
    ],
  },
  {
    label: "Mão de Obra Subempreitada (CC 10.x)",
    opcoes: [
      { value: "mao_de_obra",   label: "Mão de obra subempreitada" },
    ],
  },
  {
    label: "Canteiro e Operacionais (CC 11.x)",
    opcoes: [
      { value: "canteiro",            label: "Instalações provisórias / canteiro" },
      { value: "utilidades_canteiro", label: "Energia/água do canteiro" },
      { value: "frete",               label: "Transporte / frete" },
    ],
  },
  {
    label: "Encerramento e Entrega (CC 13.x)",
    opcoes: [
      { value: "habite_se",  label: "Habite-se / taxas de encerramento" },
      { value: "limpeza",    label: "Limpeza final / vistoria" },
    ],
  },
  {
    label: "Impostos da Obra (CC 14.x)",
    opcoes: [
      { value: "tributo_ret",  label: "RET — 2% sobre receita SPE" },
      { value: "tributo_iss",  label: "ISS sobre serviços" },
      { value: "tributo_inss", label: "INSS/FGTS sobre folha" },
    ],
  },
  {
    label: "Outros",
    opcoes: [
      { value: "administrativo", label: "Administrativo" },
      { value: "seguro",         label: "Seguro" },
      { value: "outros",         label: "Outros" },
    ],
  },
];

// Lista plana retrocompatível
const CATEGORIAS_DESPESA = CATEGORIAS_DESPESA_GRUPOS.flatMap(g => g.opcoes.map(o => o.value));

// Label de exibição (busca em todos os grupos)
export const labelCategoria = (v: string): string => {
  for (const g of CATEGORIAS_DESPESA_GRUPOS) {
    const o = g.opcoes.find(x => x.value === v);
    if (o) return o.label;
  }
  return v;
};

const CATEGORIAS_RECEITA = [
  "receita_venda", "receita_medicao", "adiantamento", "outros",
];

const FORMAS_PAGAMENTO = [
  "Cartão de crédito fornecedor",
  "Cartão de crédito empresa",
  "Boleto bancário",
  "PIX",
  "Transferência bancária (TED)",
  "Cheque",
  "Dinheiro",
  "Outros",
];

const anoAtual = new Date().getFullYear();
const anos = Array.from({ length: 5 }, (_, i) => anoAtual - 2 + i);

// ── Cartão de KPI ─────────────────────────────────────────────────────────────

function KPICard({
  label, value, icon, cor, sub,
}: { label: string; value: number; icon: React.ReactNode; cor: string; sub?: string }) {
  return (
    <div className={clsx("rounded-xl border p-5 flex items-start justify-between", cor)}>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide opacity-70 mb-1">{label}</p>
        <p className="text-2xl font-bold">{fmt(value)}</p>
        {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
      </div>
      <div className="opacity-60">{icon}</div>
    </div>
  );
}

// ── Formulário de lançamento ──────────────────────────────────────────────────

interface FormLanc extends LancamentoCreate {
  _id?: string;
}

const hoje = new Date().toISOString().split("T")[0];

function formVazio(): FormLanc {
  return {
    tipo: "despesa", categoria: "", descricao: "",
    valor: 0, data_vencimento: hoje, status: "previsto",
  };
}

// ── Página Principal ──────────────────────────────────────────────────────────

export function Financeiro() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [ano, setAno] = useState(anoAtual);
  const [filtroTipo, setFiltroTipo] = useState<"" | TipoLancamento>("");
  const [filtroStatus, setFiltroStatus] = useState<"" | StatusLancamento>("");
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<FormLanc>(formVazio());
  const [err, setErr] = useState<string | null>(null);

  // Auto-abrir formulário se vier de outro módulo (ex: Centro de Custo)
  // URL: /financeiro?obra_id=X&categoria=Y&novo=1
  useEffect(() => {
    if (searchParams.get("novo") === "1") {
      const obraId    = searchParams.get("obra_id") || undefined;
      const categoria = searchParams.get("categoria") || "";
      setForm({
        ...formVazio(),
        obra_id:   obraId,
        categoria,
        tipo:      "despesa",
      });
      setAberto(true);
      // Limpa params para não reabrir
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Modal de confirmação de pagamento OC
  const [pagarModal, setPagarModal] = useState<{
    lancamento: LancamentoFinanceiro;
    formaPagamento: string;
    dataPagamento: string;
  } | null>(null);

  const params = {
    ano,
    ...(filtroTipo ? { tipo: filtroTipo } : {}),
    ...(filtroStatus ? { status: filtroStatus } : {}),
  };

  const { data: lancamentos = [] } = useQuery<LancamentoFinanceiro[]>({
    queryKey: ["financeiro", params],
    queryFn: () => financeiroApi.listar(params),
  });

  const { data: resumo } = useQuery<ResumoFinanceiro>({
    queryKey: ["financeiro-resumo", ano],
    queryFn: () => financeiroApi.resumo({ ano }),
  });

  const { data: fluxo = [] } = useQuery<FluxoCaixaMes[]>({
    queryKey: ["financeiro-fluxo", ano],
    queryFn: () => financeiroApi.fluxoCaixa({ ano }),
  });

  const salvar = useMutation({
    mutationFn: () =>
      form._id
        ? financeiroApi.atualizar(form._id, form)
        : financeiroApi.criar(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      qc.invalidateQueries({ queryKey: ["financeiro-resumo"] });
      qc.invalidateQueries({ queryKey: ["financeiro-fluxo"] });
      setAberto(false);
      setForm(formVazio());
    },
    onError: (e: any) => setErr(e?.response?.data?.detail ?? "Erro ao salvar"),
  });

  // Confirmação de pagamento de OC
  const confirmarPagamento = useMutation({
    mutationFn: () =>
      financeiroApi.atualizar(pagarModal!.lancamento.id, {
        status: "pago",
        forma_pagamento: pagarModal!.formaPagamento || undefined,
        data_pagamento: pagarModal!.dataPagamento || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      qc.invalidateQueries({ queryKey: ["financeiro-resumo"] });
      qc.invalidateQueries({ queryKey: ["financeiro-fluxo"] });
      // Atualiza OC e Recebimentos (backend faz isso automaticamente)
      qc.invalidateQueries({ queryKey: ["ordens-compra"] });
      qc.invalidateQueries({ queryKey: ["recebimentos"] });
      setPagarModal(null);
    },
    onError: (e: any) => alert(e?.response?.data?.detail ?? "Erro ao confirmar pagamento"),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => financeiroApi.excluir(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      qc.invalidateQueries({ queryKey: ["financeiro-resumo"] });
      qc.invalidateQueries({ queryKey: ["financeiro-fluxo"] });
    },
  });

  function abrirEditar(l: LancamentoFinanceiro) {
    setForm({
      _id: l.id,
      obra_id: l.obra_id ?? undefined,
      tipo: l.tipo as TipoLancamento,
      categoria: l.categoria,
      descricao: l.descricao,
      valor: l.valor,
      data_vencimento: l.data_vencimento,
      data_pagamento: l.data_pagamento ?? undefined,
      status: l.status as StatusLancamento,
      nota_fiscal: l.nota_fiscal ?? undefined,
      forma_pagamento: l.forma_pagamento ?? undefined,
      observacoes: l.observacoes ?? undefined,
    });
    setAberto(true);
  }

  // Formata label do mês
  const mesLabel = (mes: string) => {
    const [y, m] = mes.split("-");
    return `${m}/${y.slice(2)}`;
  };

  const categorias = form.tipo === "receita" ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;

  // OCs pendentes de pagamento (lançamentos previsto com oc_id)
  const ocsPendentes = lancamentos.filter(l => l.oc_id && l.status === "previsto");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Financeiro</h1>
          <p className="text-sm text-slate-500 mt-0.5">Receitas · Despesas · Fluxo de Caixa</p>
        </div>
        <div className="flex items-center gap-3">
          <Select label="" value={String(ano)} onChange={e => setAno(+e.target.value)}>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </Select>
          <button onClick={() => { setForm(formVazio()); setAberto(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700">
            <Plus size={16} /> Novo lançamento
          </button>
        </div>
      </div>

      {/* KPIs */}
      {resumo && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard label="Receitas" value={resumo.total_receitas}
            icon={<TrendingUp size={24} />}
            cor="bg-emerald-50 border-emerald-200 text-emerald-800" />
          <KPICard label="Despesas" value={resumo.total_despesas}
            icon={<TrendingDown size={24} />}
            cor="bg-red-50 border-red-200 text-red-800" />
          <KPICard label="Saldo" value={resumo.saldo}
            icon={<Wallet size={24} />}
            cor={clsx(
              "border",
              resumo.saldo >= 0
                ? "bg-blue-50 border-blue-200 text-blue-800"
                : "bg-orange-50 border-orange-200 text-orange-800"
            )} />
          <KPICard label="Em atraso" value={resumo.em_atraso}
            icon={<AlertCircle size={24} />}
            cor="bg-amber-50 border-amber-200 text-amber-800"
            sub={`A vencer: ${fmt(resumo.a_vencer)}`} />
        </div>
      )}

      {/* Painel de Ordens de Compra pendentes de pagamento */}
      {ocsPendentes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart size={18} className="text-amber-700" />
            <h2 className="text-sm font-semibold text-amber-800">
              Ordens de Compra aguardando pagamento ({ocsPendentes.length})
            </h2>
          </div>
          <div className="space-y-2">
            {ocsPendentes.map(l => (
              <div key={l.id}
                className="flex items-center justify-between bg-white rounded-lg border border-amber-200 px-4 py-3 gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-slate-800">{l.descricao}</span>
                    <span className="text-xs text-slate-400">· Vencimento: {l.data_vencimento}</span>
                  </div>
                  {l.observacoes && (
                    <p className="text-xs text-slate-500 mt-0.5">{l.observacoes}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-base font-bold text-red-700">{fmt(l.valor)}</span>
                  <button
                    onClick={() => setPagarModal({
                      lancamento: l,
                      formaPagamento: "",
                      dataPagamento: hoje,
                    })}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium">
                    <CheckCircle2 size={13} /> Confirmar Pagamento
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gráfico Fluxo de Caixa */}
      {fluxo.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Fluxo de Caixa {ano}</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={fluxo.map(m => ({ ...m, mes: mesLabel(m.mes) }))}
              margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabela de lançamentos */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <Select label="" value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value as any)}>
            <option value="">Todos os tipos</option>
            <option value="receita">Receitas</option>
            <option value="despesa">Despesas</option>
          </Select>
          <Select label="" value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value as any)}>
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
          <span className="ml-auto text-xs text-slate-400">{lancamentos.length} lançamento(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500 font-medium uppercase tracking-wide">
                <th className="py-3 px-5 text-left">Descrição</th>
                <th className="py-3 px-3 text-left">Categoria</th>
                <th className="py-3 px-3 text-left">Vencimento</th>
                <th className="py-3 px-3 text-left">Forma Pgto</th>
                <th className="py-3 px-3 text-right">Valor</th>
                <th className="py-3 px-3 text-left">Status</th>
                <th className="py-3 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {lancamentos.map(l => (
                <tr key={l.id} className={clsx(
                  "border-b border-slate-50 hover:bg-slate-50",
                  l.oc_id && l.status === "previsto" && "bg-amber-50/40"
                )}>
                  <td className="py-3 px-5">
                    <div className="flex items-center gap-2">
                      <span className={clsx(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        l.tipo === "receita" ? "bg-emerald-500" : "bg-red-500"
                      )} />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-800">{l.descricao}</span>
                          {l.oc_id && (
                            <span className="flex items-center gap-0.5 text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
                              <ShoppingCart size={10} /> OC
                            </span>
                          )}
                        </div>
                        {l.data_pagamento && (
                          <p className="text-xs text-slate-400">Pago em: {l.data_pagamento}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-500">{labelCategoria(l.categoria)}</td>
                  <td className="py-3 px-3 text-slate-500">{l.data_vencimento}</td>
                  <td className="py-3 px-3 text-slate-500 text-xs">
                    {l.forma_pagamento ? (
                      <span className="flex items-center gap-1">
                        <CreditCard size={11} /> {l.forma_pagamento}
                      </span>
                    ) : "—"}
                  </td>
                  <td className={clsx(
                    "py-3 px-3 text-right font-semibold tabular-nums",
                    l.tipo === "receita" ? "text-emerald-700" : "text-red-700"
                  )}>
                    {l.tipo === "receita" ? "+" : "-"}{fmt(l.valor)}
                  </td>
                  <td className="py-3 px-3">
                    <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium",
                      STATUS_COR[l.status as StatusLancamento])}>
                      {STATUS_LABELS[l.status as StatusLancamento]}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex gap-2 items-center">
                      {l.oc_id && l.status === "previsto" && (
                        <button
                          onClick={() => setPagarModal({
                            lancamento: l,
                            formaPagamento: "",
                            dataPagamento: hoje,
                          })}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-600 text-white rounded font-medium hover:bg-emerald-700">
                          <CheckCircle2 size={11} /> Pagar
                        </button>
                      )}
                      <button onClick={() => abrirEditar(l)}
                        className="text-slate-400 hover:text-brand-600"><Pencil size={14} /></button>
                      <button onClick={() => { if (confirm("Excluir lançamento?")) excluir.mutate(l.id); }}
                        className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {lancamentos.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Nenhum lançamento em {ano}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal lançamento */}
      <Modal aberto={aberto} onFechar={() => { setAberto(false); setErr(null); }}
        titulo={form._id ? "Editar lançamento" : "Novo lançamento"}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="Tipo" required value={form.tipo}
              onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoLancamento, categoria: "" }))}>
              <option value="despesa">Despesa</option>
              <option value="receita">Receita</option>
            </Select>
            <Select label="Categoria" required value={form.categoria}
              onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
              <option value="">— Selecione —</option>
              {form.tipo === "despesa" ? (
                CATEGORIAS_DESPESA_GRUPOS.map(g => (
                  <optgroup key={g.label} label={g.label}>
                    {g.opcoes.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </optgroup>
                ))
              ) : (
                CATEGORIAS_RECEITA.map(c => (
                  <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                ))
              )}
            </Select>
          </div>

          <Input label="Descrição" required value={form.descricao}
            onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
            placeholder="Ex.: Compra de cimento, medição de empreiteiro…" />

          <div className="grid grid-cols-2 gap-4">
            <CurrencyInput label="Valor" required value={form.valor}
              onChange={v => setForm(f => ({ ...f, valor: v ?? 0 }))} />
            <Select label="Status" value={form.status ?? "previsto"}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as StatusLancamento }))}>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Data de vencimento" type="date" required value={form.data_vencimento}
              onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} />
            <Input label="Data de pagamento" type="date" value={form.data_pagamento ?? ""}
              onChange={e => setForm(f => ({ ...f, data_pagamento: e.target.value || null }))} />
          </div>

          <Select label="Forma de pagamento (opcional)" value={form.forma_pagamento ?? ""}
            onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value || null }))}>
            <option value="">— Selecione —</option>
            {FORMAS_PAGAMENTO.map(f => <option key={f} value={f}>{f}</option>)}
          </Select>

          <Input label="Nota fiscal (opcional)" value={form.nota_fiscal ?? ""}
            onChange={e => setForm(f => ({ ...f, nota_fiscal: e.target.value || null }))}
            placeholder="NF-e 001234" />

          {err && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">{err}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={() => { setAberto(false); setErr(null); }}
              className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={() => salvar.mutate()}
              disabled={!form.descricao.trim() || !form.categoria || form.valor <= 0 || salvar.isPending}
              className="flex-1 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60">
              {salvar.isPending ? "Salvando…" : form._id ? "Salvar" : "Registrar"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Confirmar Pagamento OC */}
      {pagarModal && (
        <Modal aberto={true} onFechar={() => setPagarModal(null)}
          titulo="Confirmar Pagamento" largura="md">
          <div className="space-y-4">
            {/* Resumo do lançamento */}
            <div className="bg-slate-50 rounded-lg p-4 space-y-1">
              <p className="text-sm font-semibold text-slate-800">{pagarModal.lancamento.descricao}</p>
              <p className="text-xs text-slate-500">Vencimento: {pagarModal.lancamento.data_vencimento}</p>
              <p className="text-xl font-bold text-red-700 mt-1">{fmt(pagarModal.lancamento.valor)}</p>
            </div>

            <Select label="Forma de pagamento *" required
              value={pagarModal.formaPagamento}
              onChange={e => setPagarModal(m => m ? { ...m, formaPagamento: e.target.value } : null)}>
              <option value="">— Selecione a forma de pagamento —</option>
              {FORMAS_PAGAMENTO.map(f => <option key={f} value={f}>{f}</option>)}
            </Select>

            <Input label="Data de pagamento" type="date"
              value={pagarModal.dataPagamento}
              onChange={e => setPagarModal(m => m ? { ...m, dataPagamento: e.target.value } : null)} />

            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700">
              <p className="font-medium mb-1">Ao confirmar o pagamento:</p>
              <ul className="space-y-0.5 list-disc list-inside">
                <li>O lançamento financeiro será marcado como <strong>Pago</strong></li>
                <li>A Ordem de Compra será atualizada para <strong>Paga</strong></li>
                <li>Um Recebimento será criado automaticamente aguardando entrega</li>
              </ul>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setPagarModal(null)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={() => confirmarPagamento.mutate()}
                disabled={!pagarModal.formaPagamento || confirmarPagamento.isPending}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60">
                {confirmarPagamento.isPending ? "Confirmando…" : "Confirmar Pagamento"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
