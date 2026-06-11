import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { empreendimentosApi, obrasApi } from "@/api/client";
import type { ObraResponse, ObraDetalhe, Etapa, EmpreendimentoResponse } from "@/types";
import {
  BarChart2, TableIcon, CheckCircle2, Clock, AlertTriangle,
  Loader2, Calendar, ChevronDown,
} from "lucide-react";
import { clsx } from "clsx";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COR: Record<string, string> = {
  concluida:   "bg-emerald-500",
  em_execucao: "bg-brand-500",
  atrasada:    "bg-red-500",
  pendente:    "bg-slate-300",
};

const STATUS_BADGE: Record<string, string> = {
  concluida:   "bg-emerald-100 text-emerald-700",
  em_execucao: "bg-blue-100 text-blue-700",
  atrasada:    "bg-red-100 text-red-700",
  pendente:    "bg-slate-100 text-slate-500",
};

const STATUS_LABEL: Record<string, string> = {
  concluida:   "✅ Concluída",
  em_execucao: "🔄 Em andamento",
  atrasada:    "⚠️ Atrasada",
  pendente:    "⬜ Não iniciada",
};

function fmtMes(dataInicio: string | null, mesNum: number): string {
  if (!dataInicio) return `M${mesNum}`;
  const d = new Date(dataInicio + "T00:00:00");
  d.setMonth(d.getMonth() + mesNum - 1);
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

// ── Barra do Gantt ─────────────────────────────────────────────────────────────

function GanttBar({ etapa, totalMeses, dataInicio, onEdit }: {
  etapa: Etapa;
  totalMeses: number;
  dataInicio: string | null;
  onEdit: (etapa: Etapa) => void;
}) {
  const inicio = etapa.mes_inicio ?? 1;
  const dur = etapa.duracao_meses ?? 2;
  const left  = ((inicio - 1) / totalMeses) * 100;
  const width = (dur / totalMeses) * 100;
  const realPct = Math.min(etapa.percentual_realizado, 100);

  return (
    <div className="relative h-7 w-full group">
      {/* Barra de fundo (planejado) */}
      <div
        className={clsx("absolute top-1 h-5 rounded-full opacity-30", STATUS_COR[etapa.status])}
        style={{ left: `${left}%`, width: `${width}%` }}
      />
      {/* Barra real */}
      <div
        className={clsx("absolute top-1 h-5 rounded-full cursor-pointer hover:opacity-90 transition-opacity", STATUS_COR[etapa.status])}
        style={{ left: `${left}%`, width: `${Math.max(width * realPct / 100, realPct > 0 ? 1 : 0)}%` }}
        onClick={() => onEdit(etapa)}
        title={`${etapa.nome}: ${realPct}% realizado`}
      />
      {/* Texto sobre a barra */}
      {width > 8 && (
        <span
          className="absolute top-1 left-0 h-5 flex items-center px-2 text-[10px] font-semibold text-white pointer-events-none overflow-hidden whitespace-nowrap"
          style={{ left: `${left}%`, width: `${width}%` }}>
          {realPct > 0 ? `${realPct.toFixed(0)}%` : ""}
        </span>
      )}
    </div>
  );
}

// ── Modal de edição rápida de etapa ──────────────────────────────────────────

function EtapaEditModal({ etapa, totalMeses, onSave, onClose }: {
  etapa: Etapa;
  totalMeses: number;
  onSave: (id: string, data: Partial<Etapa>) => void;
  onClose: () => void;
}) {
  const [mesInicio, setMesInicio] = useState(etapa.mes_inicio ?? 1);
  const [duracao, setDuracao] = useState(etapa.duracao_meses ?? 2);
  const [plan, setPlan] = useState(etapa.percentual_planejado);
  const [real, setReal] = useState(etapa.percentual_realizado);
  const [status, setStatus] = useState(etapa.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[440px] p-6 space-y-4">
        <h3 className="font-semibold text-slate-800">{etapa.nome}</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Mês início</label>
            <input type="number" min={1} max={totalMeses} value={mesInicio}
              onChange={e => setMesInicio(+e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-brand-400 outline-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Duração (meses)</label>
            <input type="number" min={1} max={totalMeses} value={duracao}
              onChange={e => setDuracao(+e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-brand-400 outline-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">% Planejado</label>
            <input type="number" min={0} max={100} value={plan}
              onChange={e => setPlan(+e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-brand-400 outline-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">% Realizado</label>
            <input type="number" min={0} max={100} value={real}
              onChange={e => setReal(+e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-brand-400 outline-none" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-slate-600 mb-1 block">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-brand-400 outline-none bg-white">
              <option value="pendente">⬜ Não iniciada</option>
              <option value="em_execucao">🔄 Em andamento</option>
              <option value="concluida">✅ Concluída</option>
              <option value="atrasada">⚠️ Atrasada</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose}
            className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={() => {
              onSave(etapa.id, { mes_inicio: mesInicio, duracao_meses: duracao,
                percentual_planejado: plan, percentual_realizado: real, status: status as any });
              onClose();
            }}
            className="flex-1 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700">
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export function CronogramaGantt() {
  const qc = useQueryClient();
  const [obraId, setObraId] = useState<string>("");
  const [modo, setModo] = useState<"gantt" | "tabela">("gantt");
  const [editando, setEditando] = useState<Etapa | null>(null);

  // Lista todos empreendimentos para popular o selector
  const { data: emps = [] } = useQuery<EmpreendimentoResponse[]>({
    queryKey: ["empreendimentos-todos"],
    queryFn: () => empreendimentosApi.listar({ por_pagina: 100 }).then((r: any) => r.items ?? []),
  });

  // Obras de cada empreendimento (flat)
  const [todasObras, setTodasObras] = useState<ObraResponse[]>([]);
  useQuery({
    queryKey: ["obras-flat", emps.map(e => e.id).join(",")],
    queryFn: async () => {
      const results = await Promise.all(emps.map(e => obrasApi.listar(e.id)));
      const flat = results.flat() as ObraResponse[];
      setTodasObras(flat);
      if (!obraId && flat.length) setObraId(flat[0].id);
      return flat;
    },
    enabled: emps.length > 0,
  });

  const { data: obra, isLoading } = useQuery<ObraDetalhe>({
    queryKey: ["obra-detalhe", obraId],
    queryFn: () => obrasApi.buscar(obraId),
    enabled: !!obraId,
  });

  const salvarEtapa = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      obrasApi.atualizarEtapaGantt(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["obra-detalhe", obraId] }),
  });

  const etapas = useMemo(() =>
    [...(obra?.etapas ?? [])].sort((a, b) => a.ordem - b.ordem), [obra]);

  // Calcula total de meses para a escala do Gantt
  const totalMeses = useMemo(() => {
    if (!etapas.length) return 12;
    const maxMes = Math.max(...etapas.map(e => (e.mes_inicio ?? 1) + (e.duracao_meses ?? 2) - 1));
    return Math.max(maxMes, 12);
  }, [etapas]);

  // KPIs
  const kpis = useMemo(() => {
    const total     = etapas.length;
    const concluidas = etapas.filter(e => e.status === "concluida").length;
    const emExec    = etapas.filter(e => e.status === "em_execucao").length;
    const atrasadas = etapas.filter(e => e.status === "atrasada").length;
    const pesoTotal  = etapas.reduce((s, e) => s + e.percentual_peso, 0);
    const realPond   = etapas.reduce((s, e) => s + (e.percentual_realizado * e.percentual_peso / 100), 0);
    const pct = pesoTotal > 0 ? realPond / pesoTotal * 100 : obra?.progresso_fisico ?? 0;
    return { total, concluidas, emExec, atrasadas, pct };
  }, [etapas, obra]);

  // Colunas de meses para o cabeçalho do Gantt
  const meses = useMemo(() =>
    Array.from({ length: totalMeses }, (_, i) => i + 1), [totalMeses]);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <BarChart2 size={20} className="text-brand-600" />
            Cronograma Gantt
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Planejamento e acompanhamento físico-financeiro</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Seletor de obra */}
          <div className="relative">
            <select
              value={obraId}
              onChange={e => setObraId(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-400 outline-none min-w-[220px]">
              {todasObras.length === 0
                ? <option value="">Carregando obras…</option>
                : todasObras.map(o => (
                    <option key={o.id} value={o.id}>{o.nome}</option>
                  ))
              }
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
          </div>
          {/* Toggle de modo */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button onClick={() => setModo("gantt")}
              className={clsx("flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
                modo === "gantt" ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50")}>
              <BarChart2 size={13} /> Gantt
            </button>
            <button onClick={() => setModo("tabela")}
              className={clsx("flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-l border-slate-200 transition-colors",
                modo === "tabela" ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50")}>
              <TableIcon size={13} /> Tabela
            </button>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-slate-400 py-8">
          <Loader2 size={18} className="animate-spin" /> Carregando cronograma…
        </div>
      )}

      {obra && !isLoading && (
        <>
          {/* Obra info + KPIs */}
          <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
              <div>
                <p className="font-semibold text-slate-800">{obra.nome}</p>
                <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <Calendar size={11} />
                  {obra.data_inicio
                    ? `Início: ${new Date(obra.data_inicio + "T00:00:00").toLocaleDateString("pt-BR")}`
                    : "Sem data de início"}
                  {obra.data_prevista_termino && (
                    <> · Previsão: {new Date(obra.data_prevista_termino + "T00:00:00").toLocaleDateString("pt-BR")}</>
                  )}
                  {totalMeses > 0 && <> · {totalMeses} meses</>}
                </p>
              </div>
              <span className={clsx("px-2.5 py-1 rounded-full text-xs font-medium",
                STATUS_BADGE[obra.status] ?? "bg-slate-100 text-slate-500")}>
                {obra.status.replace("_", " ")}
              </span>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              {[
                { label: "Total de Etapas", valor: kpis.total,       cor: "text-slate-700" },
                { label: "Concluídas",       valor: kpis.concluidas, cor: "text-emerald-600" },
                { label: "Em Andamento",     valor: kpis.emExec,     cor: "text-blue-600" },
                { label: "Atrasadas",        valor: kpis.atrasadas,  cor: "text-red-600" },
                { label: "% Realizado",      valor: `${kpis.pct.toFixed(1)}%`, cor: "text-brand-700" },
              ].map(k => (
                <div key={k.label} className="bg-slate-50 rounded-lg px-4 py-3 text-center">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">{k.label}</p>
                  <p className={clsx("text-xl font-bold", k.cor)}>{k.valor}</p>
                </div>
              ))}
            </div>

            {/* Barra de progresso geral */}
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Progresso Geral (ponderado por peso)</span>
                <span className="font-semibold text-brand-700">{kpis.pct.toFixed(1)}%</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full transition-all"
                  style={{ width: `${kpis.pct}%` }} />
              </div>
            </div>
          </div>

          {/* ── MODO GANTT ─────────────────────────────────────────────────────── */}
          {modo === "gantt" && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-700">Diagrama de Gantt</p>
                <p className="text-xs text-slate-400 mt-0.5">Clique em uma barra para editar o progresso da etapa</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: "900px" }}>
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-2.5 text-left text-xs text-slate-500 font-medium w-48 shrink-0">
                        Atividade
                      </th>
                      {meses.map(m => (
                        <th key={m} className="py-2.5 text-center text-[10px] text-slate-400 font-medium px-0.5"
                          style={{ width: `${(100 - 20) / totalMeses}%` }}>
                          {fmtMes(obra.data_inicio, m)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {etapas.map(etapa => (
                      <tr key={etapa.id} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-1.5 text-xs font-medium text-slate-700 whitespace-nowrap w-48">
                          <span className="mr-1.5 text-slate-400">{etapa.ordem}.</span>
                          {etapa.nome}
                        </td>
                        <td colSpan={totalMeses} className="py-1.5 px-2">
                          <GanttBar
                            etapa={etapa}
                            totalMeses={totalMeses}
                            dataInicio={obra.data_inicio}
                            onEdit={e => setEditando(e)}
                          />
                        </td>
                      </tr>
                    ))}
                    {/* Linha de progresso geral */}
                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                      <td className="px-4 py-2 text-xs font-bold text-slate-600 uppercase tracking-wide">
                        Avanço Geral
                      </td>
                      <td colSpan={totalMeses} className="px-2 py-2">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-500 rounded-full" style={{ width: `${kpis.pct}%` }} />
                          </div>
                          <span className="text-xs font-bold text-brand-700 w-12 text-right">
                            {kpis.pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Legenda */}
              <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap gap-4 text-xs text-slate-500">
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <span key={k} className="flex items-center gap-1.5">
                    <span className={clsx("w-3 h-3 rounded-full inline-block", STATUS_COR[k])} />
                    {v}
                  </span>
                ))}
                <span className="text-slate-400 italic">· Barra clara = planejado · Barra sólida = realizado</span>
              </div>
            </div>
          )}

          {/* ── MODO TABELA ────────────────────────────────────────────────────── */}
          {modo === "tabela" && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-700">Etapas do Cronograma</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-left text-xs text-slate-500 font-medium uppercase tracking-wide">
                      <th className="px-4 py-2.5 w-8">#</th>
                      <th className="px-4 py-2.5">Atividade</th>
                      <th className="px-4 py-2.5 text-right w-20">Peso (%)</th>
                      <th className="px-4 py-2.5 text-right w-24">Planejado (%)</th>
                      <th className="px-4 py-2.5 text-right w-24">Realizado (%)</th>
                      <th className="px-4 py-2.5 text-center w-16">Início</th>
                      <th className="px-4 py-2.5 text-center w-20">Duração</th>
                      <th className="px-4 py-2.5 text-center w-32">Status</th>
                      <th className="px-4 py-2.5 w-16">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {etapas.map(etapa => {
                      const planPct = etapa.percentual_planejado;
                      const realPct = etapa.percentual_realizado;
                      return (
                        <tr key={etapa.id} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">{etapa.ordem}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-800">{etapa.nome}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="text-xs font-mono text-slate-600">{etapa.percentual_peso.toFixed(2)}%</span>
                            <div className="mt-1 h-1.5 bg-slate-100 rounded-full w-16 ml-auto">
                              <div className="h-full bg-brand-400 rounded-full" style={{ width: `${etapa.percentual_peso}%` }} />
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="text-xs font-mono text-slate-600">{planPct.toFixed(2)}%</span>
                            <div className="mt-1 h-1.5 bg-slate-100 rounded-full w-16 ml-auto">
                              <div className="h-full bg-amber-400 rounded-full" style={{ width: `${planPct}%` }} />
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={clsx("text-xs font-mono font-semibold",
                              realPct >= planPct ? "text-emerald-600" : "text-slate-600")}>
                              {realPct.toFixed(2)}%
                            </span>
                            <div className="mt-1 h-1.5 bg-slate-100 rounded-full w-16 ml-auto">
                              <div className={clsx("h-full rounded-full",
                                realPct >= planPct ? "bg-emerald-500" : "bg-brand-500")}
                                style={{ width: `${realPct}%` }} />
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-center text-xs text-slate-500">
                            {etapa.mes_inicio ? `Mês ${etapa.mes_inicio}` : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-center text-xs text-slate-500">
                            {etapa.duracao_meses ? `${etapa.duracao_meses} mes${etapa.duracao_meses > 1 ? "es" : ""}` : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", STATUS_BADGE[etapa.status])}>
                              {STATUS_LABEL[etapa.status] ?? etapa.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <button onClick={() => setEditando(etapa)}
                              className="text-xs px-2 py-1 border border-slate-200 rounded-lg text-slate-500 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700 transition-colors">
                              Editar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {etapas.length === 0 && (
            <div className="flex flex-col items-center py-16 text-slate-400">
              <BarChart2 size={40} className="mb-3 opacity-30" />
              <p className="font-medium">Nenhuma etapa cadastrada</p>
              <p className="text-xs mt-1">Abra a obra e adicione etapas ao cronograma</p>
            </div>
          )}
        </>
      )}

      {!obraId && !isLoading && (
        <div className="flex flex-col items-center py-20 text-slate-400">
          <BarChart2 size={48} className="mb-3 opacity-20" />
          <p className="font-medium">Selecione uma obra para visualizar o cronograma</p>
        </div>
      )}

      {/* Modal de edição */}
      {editando && obra && (
        <EtapaEditModal
          etapa={editando}
          totalMeses={totalMeses}
          onSave={(id, data) => salvarEtapa.mutate({ id, data })}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  );
}
