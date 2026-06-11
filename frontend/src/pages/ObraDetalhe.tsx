import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Bot, Building2, CalendarDays, DollarSign,
  Loader2, Plus, RefreshCw, Trash2,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { clsx } from "clsx";
import { obrasApi, orcamentosApi, rdoApi } from "@/api/client";
import { EVMPanel } from "@/components/obras/EVMPanel";
import { EtapasPanel } from "@/components/obras/EtapasPanel";
import { OrcamentoForm } from "@/components/orcamentos/OrcamentoForm";
import { CustoRealizadoForm } from "@/components/orcamentos/CustoRealizadoForm";
import { CentroCustoTab } from "@/components/obras/CentroCustoTab";
import { RDOForm } from "@/components/rdo/RDOForm";
import { Badge } from "@/components/ui/Badge";
import type {
  AnaliseIA, CustoRealizado, ObraDetalhe as ObraDetalheType,
  OrcamentoResponse, RDOResumo,
} from "@/types";

// ── Formatters ─────────────────────────────────────────────────────────────────

function moeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function moedaCurto(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(0)}K`;
  return moeda(v);
}

const STATUS_ORC: Record<string, [string, string]> = {
  rascunho:  ["bg-amber-50 text-amber-700",    "Rascunho"],
  vigente:   ["bg-emerald-50 text-emerald-700", "Vigente"],
  arquivado: ["bg-slate-100 text-slate-500",    "Arquivado"],
};

const TIPO_CUSTO_LABEL: Record<string, string> = {
  material:       "Material",
  mao_de_obra:    "Mão de obra",
  equipamento:    "Equipamento",
  servico:        "Serviço",
  administrativo: "Administrativo",
};

const TIPO_CUSTO_COR: Record<string, string> = {
  material:       "bg-blue-50 text-blue-700",
  mao_de_obra:    "bg-purple-50 text-purple-700",
  equipamento:    "bg-orange-50 text-orange-700",
  servico:        "bg-cyan-50 text-cyan-700",
  administrativo: "bg-slate-100 text-slate-600",
};

// ── Tab: Orçamentos ────────────────────────────────────────────────────────────

function OrcamentosTab({ obraId }: { obraId: string }) {
  const navigate = useNavigate();
  const [formAberto, setFormAberto] = useState(false);

  const { data: orcamentos = [], isLoading } = useQuery<OrcamentoResponse[]>({
    queryKey: ["orcamentos", obraId],
    queryFn: () => orcamentosApi.listar(obraId),
  });

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1,2].map(i => <div key={i} className="h-20 bg-white rounded-xl border border-slate-200" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {orcamentos.length === 0
            ? "Nenhum orçamento criado para esta obra"
            : `${orcamentos.length} orçamento${orcamentos.length > 1 ? "s" : ""}`}
        </p>
        <button
          onClick={() => setFormAberto(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          <Plus size={14} /> Novo orçamento
        </button>
      </div>

      {orcamentos.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">
          <DollarSign size={36} className="mx-auto mb-3 opacity-25" />
          <p className="font-medium text-slate-500">Sem orçamentos</p>
          <p className="text-sm mt-1">Crie o orçamento base para ativar o cálculo de CPI e SPI</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orcamentos.map(orc => {
            const [cls, label] = STATUS_ORC[orc.status] ?? STATUS_ORC.rascunho;
            const bacComBdi = orc.valor_total * (1 + orc.bdi_percentual / 100);
            return (
              <button
                key={orc.id}
                onClick={() => navigate(`/orcamentos/${orc.id}`)}
                className="bg-white rounded-xl border border-slate-200 p-5 text-left hover:shadow-md hover:border-brand-300 transition-all group"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-semibold text-slate-800 group-hover:text-brand-700 transition-colors">
                      Orçamento v{orc.versao}
                    </p>
                    {orc.descricao && (
                      <p className="text-xs text-slate-400 mt-0.5">{orc.descricao}</p>
                    )}
                  </div>
                  <span className={clsx("text-xs font-medium px-2 py-0.5 rounded-full shrink-0", cls)}>
                    {label}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100">
                  <div>
                    <p className="text-xs text-slate-400">BAC c/ BDI</p>
                    <p className="text-sm font-semibold text-slate-700">
                      {bacComBdi > 0 ? moedaCurto(bacComBdi) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Itens</p>
                    <p className="text-sm font-semibold text-slate-700">{orc.total_itens}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Base</p>
                    <p className="text-sm font-semibold text-slate-700 uppercase">{orc.base_referencia}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <OrcamentoForm
        aberto={formAberto}
        onFechar={() => setFormAberto(false)}
        obraId={obraId}
      />
    </div>
  );
}

// ── Tab: Custos ────────────────────────────────────────────────────────────────

function CustosTab({ obraId, etapas }: { obraId: string; etapas: ObraDetalheType["etapas"] }) {
  const qc = useQueryClient();
  const [formAberto, setFormAberto] = useState(false);

  const { data: custos = [], isLoading } = useQuery<CustoRealizado[]>({
    queryKey: ["custos", obraId],
    queryFn: () => orcamentosApi.listarCustos(obraId),
  });

  const excluirMutation = useMutation({
    mutationFn: (id: string) => orcamentosApi.excluirCusto(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custos", obraId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const totalAC = custos.reduce((s, c) => s + c.valor, 0);

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1,2,3].map(i => <div key={i} className="h-14 bg-white rounded-xl border border-slate-200" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {custos.length === 0 ? "Nenhum custo lançado" : `${custos.length} lançamento${custos.length > 1 ? "s" : ""}`}
          </p>
          {custos.length > 0 && (
            <p className="text-xs text-slate-400 mt-0.5">
              AC total: <strong className="text-slate-700">{moeda(totalAC)}</strong>
            </p>
          )}
        </div>
        <button
          onClick={() => setFormAberto(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          <Plus size={14} /> Registrar custo
        </button>
      </div>

      {custos.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">
          <DollarSign size={36} className="mx-auto mb-3 opacity-25" />
          <p className="font-medium text-slate-500">Nenhum custo registrado</p>
          <p className="text-sm mt-1">Registre materiais, mão de obra e serviços realizados</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Descrição</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">NF</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Valor</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {custos.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-5 py-3.5 text-xs text-slate-500 tabular-nums">
                      {new Date(c.data_lancamento + "T00:00").toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={clsx(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        TIPO_CUSTO_COR[c.tipo] ?? "bg-slate-100 text-slate-500",
                      )}>
                        {TIPO_CUSTO_LABEL[c.tipo] ?? c.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">{c.descricao}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-400 hidden md:table-cell font-mono">
                      {c.nota_fiscal ?? "—"}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-slate-800 tabular-nums">
                      {moeda(c.valor)}
                    </td>
                    <td className="px-2 py-3.5">
                      <button
                        onClick={() => excluirMutation.mutate(c.id)}
                        disabled={excluirMutation.isPending}
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan={4} className="px-5 py-3 text-xs font-semibold text-slate-600 text-right uppercase tracking-wide">
                    Total AC
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800 tabular-nums">
                    {moeda(totalAC)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <CustoRealizadoForm
        aberto={formAberto}
        onFechar={() => setFormAberto(false)}
        obraId={obraId}
        etapas={etapas}
      />
    </div>
  );
}

// ── Tab: RDO ───────────────────────────────────────────────────────────────────

const CLIMA_ICON: Record<string, string> = {
  ensolarado: "☀️",
  nublado:    "🌤️",
  chuvoso:    "🌧️",
  tempestade: "⛈️",
};

function RDOTab({ obraId }: { obraId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [formAberto, setFormAberto] = useState(false);

  const { data: rdos = [], isLoading } = useQuery<RDOResumo[]>({
    queryKey: ["rdos", obraId],
    queryFn: () => rdoApi.listar(obraId),
  });

  const excluirMutation = useMutation({
    mutationFn: (id: string) => rdoApi.excluir(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rdos", obraId] }),
  });

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1,2,3].map(i => <div key={i} className="h-16 bg-white rounded-xl border border-slate-200" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {rdos.length === 0
            ? "Nenhum RDO registrado para esta obra"
            : `${rdos.length} relatório${rdos.length > 1 ? "s" : ""}`}
        </p>
        <button
          onClick={() => setFormAberto(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          <Plus size={14} /> Novo RDO
        </button>
      </div>

      {rdos.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">
          <CalendarDays size={36} className="mx-auto mb-3 opacity-25" />
          <p className="font-medium text-slate-500">Sem relatórios diários</p>
          <p className="text-sm mt-1">Registre as atividades, efetivo e ocorrências de cada dia de obra</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Data</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Clima</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Efetivo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Atividades</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Ocorrências</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rdos.map(r => (
                <tr
                  key={r.id}
                  onClick={() => navigate(`/rdos/${r.id}`)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <td className="px-5 py-3.5 font-medium text-slate-700 tabular-nums">
                    {new Date(r.data + "T12:00").toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell text-base">
                    {r.clima_manha
                      ? `${CLIMA_ICON[r.clima_manha] ?? ""} / ${CLIMA_ICON[r.clima_tarde ?? ""] ?? "—"}`
                      : <span className="text-slate-300 text-sm">—</span>
                    }
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 hidden md:table-cell tabular-nums">
                    {r.efetivo_total != null ? r.efetivo_total : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 tabular-nums">{r.total_atividades}</td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    {r.total_ocorrencias > 0 ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                        {r.total_ocorrencias}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <span className={clsx(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        r.status === "finalizado"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      )}>
                        {r.status === "finalizado" ? "Finalizado" : "Rascunho"}
                      </span>
                      {r.tem_ia && (
                        <Bot size={12} className="text-brand-500" aria-label="Relatório Gemini gerado" />
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-3.5" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => { if (confirm("Excluir este RDO?")) excluirMutation.mutate(r.id); }}
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RDOForm aberto={formAberto} onFechar={() => setFormAberto(false)} obraId={obraId} />
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

type Tab = "etapas" | "orcamento" | "custos" | "centro-custo" | "rdo";

export function ObraDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "etapas";
  const [tab, _setTab] = useState<Tab>(initialTab);
  const setTab = (t: Tab) => {
    _setTab(t);
    setSearchParams(t === "etapas" ? {} : { tab: t }, { replace: true });
  };
  const [analiseIA, setAnaliseIA] = useState<AnaliseIA | null>(null);
  const [carregandoIA, setCarregandoIA] = useState(false);

  const { data: obra, isLoading } = useQuery<ObraDetalheType>({
    queryKey: ["obra", id],
    queryFn: () => obrasApi.buscar(id!),
    enabled: !!id,
    refetchInterval: 30_000,
  });

  async function buscarAnaliseIA() {
    if (!id) return;
    setCarregandoIA(true);
    try {
      const data = await obrasApi.analiseIA(id);
      setAnaliseIA(data);
    } catch {
      // API pode não estar rodando
    } finally {
      setCarregandoIA(false);
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-1/3" />
        <div className="h-4 bg-slate-100 rounded w-1/4" />
        <div className="grid grid-cols-3 gap-4 mt-6">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-white border border-slate-200 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!obra) return null;

  const progresso = obra.progresso_fisico;

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Cabeçalho */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors mt-0.5"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-800">{obra.nome}</h2>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Badge value={obra.status} />
            {obra.numero_pavimentos && (
              <span className="text-xs text-slate-400">{obra.numero_pavimentos} pavimentos</span>
            )}
            {obra.numero_unidades && (
              <span className="text-xs text-slate-400">{obra.numero_unidades} unidades</span>
            )}
            {obra.area_construida_m2 && (
              <span className="text-xs text-slate-400">
                {obra.area_construida_m2.toLocaleString()} m²
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ["obra", id] })}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          title="Atualizar dados"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Progresso geral */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Progresso Físico Geral</h3>
          <span className={clsx("text-2xl font-bold",
            progresso >= 100 ? "text-emerald-600" : progresso > 50 ? "text-brand-600" : "text-slate-700"
          )}>
            {progresso.toFixed(1)}%
          </span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={clsx("h-full rounded-full transition-all duration-700",
              progresso >= 100 ? "bg-emerald-500" : "bg-brand-500"
            )}
            style={{ width: `${progresso}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1.5">
          <span>Início</span>
          <span>Entrega</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1">
          {(["etapas", "orcamento", "custos", "centro-custo", "rdo"] as Tab[]).map(t => {
            const label = t === "etapas" ? "Etapas & EVM"
              : t === "orcamento" ? "Orçamento"
              : t === "custos" ? "Custos"
              : t === "centro-custo" ? "💰 Centro de Custo"
              : "RDO";
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={clsx(
                  "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                  tab === t
                    ? "border-brand-600 text-brand-700"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300",
                )}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Conteúdo das tabs */}
      {tab === "etapas" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Etapas */}
          <div className="lg:col-span-2">
            {obra.etapas.length > 0 ? (
              <EtapasPanel etapas={obra.etapas} obraId={obra.id} />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
                <p className="font-medium">Nenhuma etapa cadastrada</p>
              </div>
            )}
          </div>

          {/* Coluna lateral: EVM + Análise IA */}
          <div className="space-y-5">
            {obra.evm && <EVMPanel evm={obra.evm} />}

            {/* Análise Gemini */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Bot size={16} className="text-brand-600" />
                <h3 className="text-sm font-semibold text-slate-700">Análise Gemini</h3>
              </div>
              {analiseIA ? (
                <div className="space-y-3">
                  <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap">
                    {analiseIA.analise_ia}
                  </div>
                  <button
                    onClick={() => setAnaliseIA(null)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Limpar análise
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-slate-400 mb-3">
                    O Gemini analisa CPI, SPI e tendências da obra e gera recomendações práticas.
                  </p>
                  <button
                    onClick={buscarAnaliseIA}
                    disabled={carregandoIA}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors"
                  >
                    {carregandoIA
                      ? <><Loader2 size={14} className="animate-spin" /> Analisando…</>
                      : "Gerar análise"
                    }
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "orcamento"    && <OrcamentosTab obraId={obra.id} />}
      {tab === "custos"       && <CustosTab obraId={obra.id} etapas={obra.etapas} />}
      {tab === "centro-custo" && <CentroCustoTab obraId={obra.id} />}
      {tab === "rdo"          && <RDOTab obraId={obra.id} />}

    </div>
  );
}
