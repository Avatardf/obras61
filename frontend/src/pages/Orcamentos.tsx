import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  FileText, TrendingUp, CheckCircle2, Clock4, Plus,
  Search, ChevronRight, Building2, Loader2, AlertCircle,
  X, ServerOff, Tag, Calendar, Percent,
} from "lucide-react";
import { clsx } from "clsx";
import { orcamentosApi, suprimentosApi } from "@/api/client";
import { Input, Select } from "@/components/ui/Input";
import type { OrcamentoCreate, OrcamentoResumo, ObraResumida } from "@/types";

// ── Formatters ─────────────────────────────────────────────────────────────────

function moeda(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace(".", ",")}M`;
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(0).replace(".", ",")}K`;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function moedaLongo(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_CFG: Record<string, { cls: string; dot: string; label: string }> = {
  rascunho:  { cls: "bg-amber-50  text-amber-700  border border-amber-200",   dot: "bg-amber-400",   label: "Rascunho"  },
  vigente:   { cls: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-400", label: "Vigente"   },
  arquivado: { cls: "bg-slate-100  text-slate-500   border border-slate-200",  dot: "bg-slate-400",   label: "Arquivado" },
};

const BASE_LABEL: Record<string, string> = {
  sinapi: "SINAPI", sicro: "SICRO", cub: "CUB", tcpo: "TCPO", propria: "Própria",
};

const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

// ── Modal "Novo Orçamento" ─────────────────────────────────────────────────────

interface NovoOrcModalProps { onClose: () => void }

function NovoOrcamentoModal({ onClose }: NovoOrcModalProps) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [obraId, setObraId] = useState("");
  const [erro, setErro] = useState("");
  const [form, setForm] = useState<OrcamentoCreate>({
    descricao: "",
    bdi_percentual: 25,
    base_referencia: "sinapi",
    uf_referencia: "RJ",
    data_referencia: new Date().toISOString().split("T")[0],
  });

  const { data: obras = [], isLoading: loadingObras } = useQuery<ObraResumida[]>({
    queryKey: ["obras-lista"],
    queryFn: suprimentosApi.listarObras,
  });

  const criar = useMutation({
    mutationFn: () => orcamentosApi.criar(obraId, form),
    onSuccess: (orc) => {
      qc.invalidateQueries({ queryKey: ["orcamentos-todos"] });
      qc.invalidateQueries({ queryKey: ["orcamentos", obraId] });
      onClose();
      navigate(`/orcamentos/${orc.id}`);
    },
    onError: (e: any) => setErro(e?.response?.data?.detail ?? "Erro ao criar orçamento"),
  });

  function set<K extends keyof OrcamentoCreate>(k: K, v: OrcamentoCreate[K]) {
    setForm(f => ({ ...f, [k]: v }));
    setErro("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Novo Orçamento</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {step === 1 ? "Passo 1 de 2 — Selecione a obra" : "Passo 2 de 2 — Dados do orçamento"}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {step === 1 ? (
            /* ── Passo 1: Seleção de obra ── */
            <>
              <p className="text-sm text-slate-600">
                O orçamento é sempre vinculado a uma obra. Selecione para qual obra este orçamento pertence:
              </p>

              {loadingObras ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
                  <Loader2 size={16} className="animate-spin" /> Carregando obras…
                </div>
              ) : obras.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <Building2 size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma obra cadastrada.</p>
                  <p className="text-xs mt-1">Crie uma obra em Empreendimentos primeiro.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {obras.map(o => (
                    <button
                      key={o.id}
                      onClick={() => setObraId(o.id)}
                      className={clsx(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all",
                        obraId === o.id
                          ? "border-brand-500 bg-brand-50 text-brand-800"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                      )}
                    >
                      <div className={clsx(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                        obraId === o.id ? "bg-brand-600" : "bg-slate-100"
                      )}>
                        <Building2 size={13} className={obraId === o.id ? "text-white" : "text-slate-500"} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{o.nome}</p>
                        {o.codigo && <p className="text-xs text-slate-400">Cód: {o.codigo}</p>}
                      </div>
                      {obraId === o.id && <CheckCircle2 size={16} className="text-brand-600 ml-auto shrink-0" />}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={!obraId}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                >
                  Próximo <ChevronRight size={14} />
                </button>
              </div>
            </>
          ) : (
            /* ── Passo 2: Dados do orçamento ── */
            <>
              {/* Obra selecionada */}
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                <Building2 size={13} className="text-slate-400 shrink-0" />
                <span className="text-xs text-slate-500">Obra:</span>
                <span className="text-xs font-medium text-slate-700 truncate">
                  {obras.find(o => o.id === obraId)?.nome}
                </span>
                <button onClick={() => setStep(1)} className="ml-auto text-xs text-brand-600 hover:text-brand-700 shrink-0">
                  Alterar
                </button>
              </div>

              <Input
                label="Descrição (opcional)"
                value={form.descricao ?? ""}
                onChange={e => set("descricao", e.target.value)}
                placeholder="Ex.: Orçamento base SINAPI — Jan/2025"
              />

              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Base de referência"
                  value={form.base_referencia}
                  onChange={e => set("base_referencia", e.target.value)}
                >
                  <option value="sinapi">SINAPI</option>
                  <option value="sicro">SICRO</option>
                  <option value="cub">CUB</option>
                  <option value="tcpo">TCPO</option>
                  <option value="propria">Composição própria</option>
                </Select>

                <Select
                  label="UF de referência"
                  value={form.uf_referencia ?? "RJ"}
                  onChange={e => set("uf_referencia", e.target.value)}
                >
                  {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="BDI (%)"
                  type="number"
                  min={0} max={100} step={0.5}
                  value={form.bdi_percentual}
                  onChange={e => set("bdi_percentual", parseFloat(e.target.value) || 0)}
                  dica="Benefícios e Despesas Indiretas"
                />
                <Input
                  label="Data de referência"
                  type="date"
                  value={form.data_referencia ?? ""}
                  onChange={e => set("data_referencia", e.target.value)}
                />
              </div>

              {erro && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  <AlertCircle size={14} /> {erro}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setStep(1)} className="flex-1 py-2.5 text-sm font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
                  Voltar
                </button>
                <button
                  onClick={() => criar.mutate()}
                  disabled={criar.isPending}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                >
                  {criar.isPending && <Loader2 size={14} className="animate-spin" />}
                  Criar Orçamento
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Card de Orçamento ──────────────────────────────────────────────────────────

function OrcCard({ orc }: { orc: OrcamentoResumo }) {
  const navigate = useNavigate();
  const cfg = STATUS_CFG[orc.status] ?? STATUS_CFG.rascunho;
  const bacComBdi = orc.valor_total * (1 + orc.bdi_percentual / 100);

  return (
    <button
      onClick={() => navigate(`/orcamentos/${orc.id}`)}
      className="group bg-white rounded-2xl border border-slate-200 p-5 text-left hover:shadow-md hover:border-brand-300 transition-all"
    >
      {/* Cabeçalho do card */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-800 group-hover:text-brand-700 transition-colors truncate">
            {orc.obra_nome}
          </p>
          {orc.descricao && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{orc.descricao}</p>
          )}
        </div>
        <span className={clsx("text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1", cfg.cls)}>
          <span className={clsx("w-1.5 h-1.5 rounded-full", cfg.dot)} />
          {cfg.label}
        </span>
      </div>

      {/* Valor principal */}
      <div className="mb-4">
        <p className="text-xs text-slate-400 mb-0.5">BAC com BDI ({orc.bdi_percentual}%)</p>
        <p className={clsx(
          "text-xl font-bold tabular-nums",
          orc.status === "vigente" ? "text-brand-700" : "text-slate-700"
        )}>
          {bacComBdi > 0 ? moedaLongo(bacComBdi) : "—"}
        </p>
        {bacComBdi > 0 && orc.valor_total !== bacComBdi && (
          <p className="text-xs text-slate-400 mt-0.5">sem BDI: {moeda(orc.valor_total)}</p>
        )}
      </div>

      {/* Metadados */}
      <div className="grid grid-cols-3 gap-2 text-xs text-slate-500 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <Tag size={10} className="text-slate-400" />
          <span className="uppercase font-medium">{BASE_LABEL[orc.base_referencia] ?? orc.base_referencia}</span>
          {orc.uf_referencia && <span className="text-slate-400">/{orc.uf_referencia}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <FileText size={10} className="text-slate-400" />
          <span>{orc.total_itens} {orc.total_itens === 1 ? "item" : "itens"}</span>
        </div>
        <div className="flex items-center gap-1.5 justify-end">
          <span className="text-slate-400">v{orc.versao}</span>
          <ChevronRight size={12} className="text-slate-300 group-hover:text-brand-500 transition-colors" />
        </div>
      </div>
    </button>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

export function Orcamentos() {
  const [modalAberto, setModalAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"" | "rascunho" | "vigente" | "arquivado">("");

  const { data: orcamentos = [], isLoading, isError } = useQuery<OrcamentoResumo[]>({
    queryKey: ["orcamentos-todos"],
    queryFn: orcamentosApi.listarTodos,
    retry: 1,
  });

  // ── KPIs ──────────────────────────────────────────────────────────────────────
  const vigentes   = useMemo(() => orcamentos.filter(o => o.status === "vigente"),    [orcamentos]);
  const rascunhos  = useMemo(() => orcamentos.filter(o => o.status === "rascunho"),   [orcamentos]);
  const arquivados = useMemo(() => orcamentos.filter(o => o.status === "arquivado"),  [orcamentos]);
  const bacTotal   = useMemo(() =>
    vigentes.reduce((s, o) => s + o.valor_total * (1 + o.bdi_percentual / 100), 0),
    [vigentes]
  );

  // ── Filtros ───────────────────────────────────────────────────────────────────
  const filtrados = useMemo(() => {
    let list = [...orcamentos];
    if (filtroStatus) list = list.filter(o => o.status === filtroStatus);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      list = list.filter(o =>
        o.obra_nome.toLowerCase().includes(q) ||
        (o.descricao ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [orcamentos, filtroStatus, busca]);

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6 space-y-5 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-7 w-40 bg-slate-200 rounded" />
          <div className="h-9 w-36 bg-slate-200 rounded-xl" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-white rounded-2xl border border-slate-200" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-44 bg-white rounded-2xl border border-slate-200" />)}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-64 text-slate-400">
        <ServerOff size={32} className="mb-3 opacity-40" />
        <p className="font-medium text-slate-500">Módulo indisponível</p>
        <p className="text-sm mt-1">Verifique se o servidor está rodando</p>
      </div>
    );
  }

  return (
    <>
      {modalAberto && <NovoOrcamentoModal onClose={() => setModalAberto(false)} />}

      <div className="p-4 sm:p-6 space-y-5">

        {/* ── Cabeçalho ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Orçamentos</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Gestão dos orçamentos por base de referência e BDI
            </p>
          </div>
          <button
            onClick={() => setModalAberto(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors shadow-sm shrink-0"
          >
            <Plus size={15} /> Novo Orçamento
          </button>
        </div>

        {/* ── KPIs ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => setFiltroStatus(filtroStatus === "vigente" ? "" : "vigente")}
            className={clsx(
              "bg-white rounded-2xl border p-5 flex items-center gap-4 text-left transition-all hover:shadow-sm",
              filtroStatus === "vigente" ? "border-emerald-300 ring-1 ring-emerald-300" : "border-slate-200"
            )}
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <CheckCircle2 size={18} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{vigentes.length}</p>
              <p className="text-xs text-slate-500">Vigentes</p>
            </div>
          </button>

          <button
            onClick={() => setFiltroStatus(filtroStatus === "rascunho" ? "" : "rascunho")}
            className={clsx(
              "bg-white rounded-2xl border p-5 flex items-center gap-4 text-left transition-all hover:shadow-sm",
              filtroStatus === "rascunho" ? "border-amber-300 ring-1 ring-amber-300" : "border-slate-200"
            )}
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <Clock4 size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{rascunhos.length}</p>
              <p className="text-xs text-slate-500">Em rascunho</p>
            </div>
          </button>

          <button
            onClick={() => setFiltroStatus(filtroStatus === "arquivado" ? "" : "arquivado")}
            className={clsx(
              "bg-white rounded-2xl border p-5 flex items-center gap-4 text-left transition-all hover:shadow-sm",
              filtroStatus === "arquivado" ? "border-slate-400 ring-1 ring-slate-400" : "border-slate-200"
            )}
          >
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
              <FileText size={18} className="text-slate-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{arquivados.length}</p>
              <p className="text-xs text-slate-500">Arquivados</p>
            </div>
          </button>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
              <TrendingUp size={18} className="text-brand-600" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-brand-700 truncate" title={moedaLongo(bacTotal)}>
                {moeda(bacTotal)}
              </p>
              <p className="text-xs text-slate-500">BAC total (vigentes, c/ BDI)</p>
            </div>
          </div>
        </div>

        {/* ── Empty state ────────────────────────────────────────────── */}
        {orcamentos.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
              <FileText size={24} className="text-brand-500" />
            </div>
            <p className="text-base font-semibold text-slate-700">Nenhum orçamento cadastrado</p>
            <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
              Crie o primeiro orçamento para calcular o BAC da obra e ativar os indicadores de EVM (CPI e SPI).
            </p>
            <button
              onClick={() => setModalAberto(true)}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              <Plus size={15} /> Criar primeiro orçamento
            </button>
          </div>
        ) : (
          <>
            {/* ── Filtros ──────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar por obra ou descrição…"
                  className="w-full pl-8 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 bg-white"
                />
                {busca && (
                  <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                {(["", "vigente", "rascunho", "arquivado"] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setFiltroStatus(s)}
                    className={clsx(
                      "px-3 py-2 text-xs font-medium rounded-xl border transition-all",
                      filtroStatus === s
                        ? "bg-brand-600 text-white border-brand-600"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    )}
                  >
                    {s === "" ? "Todos" : STATUS_CFG[s].label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Grid de cards ────────────────────────────────────── */}
            {filtrados.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 py-12 text-center text-slate-400">
                <Search size={28} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium text-slate-500">Nenhum resultado para "{busca}"</p>
                <button onClick={() => { setBusca(""); setFiltroStatus(""); }} className="mt-3 text-xs text-brand-600 hover:text-brand-700">
                  Limpar filtros
                </button>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-400">
                  {filtrados.length} orçamento{filtrados.length !== 1 ? "s" : ""}
                  {filtroStatus && <> · filtrado por <span className="font-medium text-slate-600">{STATUS_CFG[filtroStatus].label}</span></>}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filtrados.map(orc => <OrcCard key={orc.id} orc={orc} />)}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
