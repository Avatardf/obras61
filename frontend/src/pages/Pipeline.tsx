import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Building2, TrendingUp, Layers, CheckCircle2,
  MapPin, Users, Banknote, BarChart3, ChevronRight,
  Percent, Handshake, Package,
} from "lucide-react";
import { empreendimentosApi } from "@/api/client";
import type { EmpreendimentoResponse, StatusEmpreendimento } from "@/types";

// ── helpers ────────────────────────────────────────────────────────────────────

const fmtBRL = (v: number | null | undefined) => {
  if (v == null) return "—";
  if (v >= 1_000_000)
    return `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M`;
  if (v >= 1_000)
    return `R$ ${(v / 1_000).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} K`;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const TIPO_LABEL: Record<string, string> = {
  residencial_vertical:   "Res. Vertical",
  residencial_horizontal: "Res. Horizontal",
  comercial:              "Comercial",
  misto:                  "Misto",
  infraestrutura:         "Infraestrutura",
};

// ── Pipeline phases ────────────────────────────────────────────────────────────

interface Fase {
  id: string;
  label: string;
  statuses: StatusEmpreendimento[];
  cor: string;         // Tailwind border/bg colour token
  corBg: string;
  corText: string;
  corBadge: string;
}

const FASES: Fase[] = [
  {
    id: "prospeccao",
    label: "Prospecção",
    statuses: ["estudo", "viabilidade"],
    cor: "border-sky-400",
    corBg: "bg-sky-50",
    corText: "text-sky-700",
    corBadge: "bg-sky-100 text-sky-700",
  },
  {
    id: "aprovacao",
    label: "Em Aprovação",
    statuses: ["aprovacao"],
    cor: "border-amber-400",
    corBg: "bg-amber-50",
    corText: "text-amber-700",
    corBadge: "bg-amber-100 text-amber-700",
  },
  {
    id: "construcao",
    label: "Em Construção",
    statuses: ["em_obras"],
    cor: "border-brand-500",
    corBg: "bg-brand-50",
    corText: "text-brand-700",
    corBadge: "bg-brand-100 text-brand-700",
  },
  {
    id: "entregue",
    label: "Entregues",
    statuses: ["entregue"],
    cor: "border-emerald-400",
    corBg: "bg-emerald-50",
    corText: "text-emerald-700",
    corBadge: "bg-emerald-100 text-emerald-700",
  },
];

// ── KPI Card ───────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-4 shadow-sm">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-slate-800 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Empreendimento Card ────────────────────────────────────────────────────────

function EmpCard({ emp, fase }: { emp: EmpreendimentoResponse; fase: Fase }) {
  const navigate = useNavigate();
  const prob = emp.probabilidade ?? null;
  const vgv = emp.vgv_previsto ?? null;
  const vgvPonderado = vgv != null && prob != null ? vgv * (prob / 100) : null;

  return (
    <div
      onClick={() => navigate(`/empreendimentos/${emp.id}`)}
      className={`
        bg-white rounded-xl border-l-4 ${fase.cor}
        border border-slate-200 p-3 cursor-pointer
        hover:shadow-md hover:-translate-y-0.5 transition-all group
      `}
    >
      {/* header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold text-slate-800 leading-tight flex-1 group-hover:text-brand-600 transition-colors">
          {emp.nome}
        </h4>
        <ChevronRight size={14} className="text-slate-300 group-hover:text-brand-400 shrink-0 mt-0.5 transition-colors" />
      </div>

      {/* tipo + localização */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${fase.corBadge}`}>
          <Building2 size={10} />
          {TIPO_LABEL[emp.tipo] ?? emp.tipo}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
          <MapPin size={10} />
          {emp.endereco.cidade}/{emp.endereco.uf}
        </span>
      </div>

      {/* financeiro */}
      <div className="space-y-1 border-t border-slate-100 pt-2">
        {vgv != null && (
          <div className="flex justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <Banknote size={10} /> VGV Previsto
            </span>
            <span className="font-semibold text-slate-700">{fmtBRL(vgv)}</span>
          </div>
        )}
        {vgvPonderado != null && prob != null && (
          <div className="flex justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <Percent size={10} /> Ponderado ({prob}%)
            </span>
            <span className="font-semibold text-emerald-600">{fmtBRL(vgvPonderado)}</span>
          </div>
        )}
      </div>

      {/* rodapé */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 pt-2 border-t border-slate-100">
        {emp.num_unidades != null && (
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Users size={10} /> {emp.num_unidades} un.
          </span>
        )}
        {emp.parceiro && (
          <span className="flex items-center gap-1 text-xs text-slate-400 truncate max-w-[120px]">
            <Handshake size={10} /> {emp.parceiro}
          </span>
        )}
        {emp.produto && (
          <span className="flex items-center gap-1 text-xs text-slate-400 truncate max-w-[100px]">
            <Package size={10} /> {emp.produto}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Pipeline column ────────────────────────────────────────────────────────────

function PipelineColuna({
  fase,
  empreendimentos,
}: {
  fase: Fase;
  empreendimentos: EmpreendimentoResponse[];
}) {
  const totalVGV = empreendimentos.reduce((s, e) => s + (e.vgv_previsto ?? 0), 0);

  return (
    <div className="flex flex-col min-w-[260px] max-w-[320px] flex-1">
      {/* cabeçalho da coluna */}
      <div className={`rounded-xl ${fase.corBg} border ${fase.cor} px-3 py-2.5 mb-3`}>
        <div className="flex items-center justify-between">
          <span className={`text-sm font-bold ${fase.corText}`}>{fase.label}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${fase.corBadge}`}>
            {empreendimentos.length}
          </span>
        </div>
        {totalVGV > 0 && (
          <p className="text-xs text-slate-500 mt-0.5">{fmtBRL(totalVGV)}</p>
        )}
      </div>

      {/* cards */}
      <div className="flex flex-col gap-2.5 flex-1">
        {empreendimentos.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-8 text-xs text-slate-300 italic">
            Nenhum empreendimento
          </div>
        ) : (
          empreendimentos.map(emp => (
            <EmpCard key={emp.id} emp={emp} fase={fase} />
          ))
        )}
      </div>
    </div>
  );
}

// ── Summary Table ──────────────────────────────────────────────────────────────

function TabelaResumo({ empreendimentos }: { empreendimentos: EmpreendimentoResponse[] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
        <BarChart3 size={16} className="text-slate-500" />
        <span className="text-sm font-semibold text-slate-700">Resumo por Fase</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
            <tr>
              <th className="px-5 py-2.5 text-left font-medium">Fase</th>
              <th className="px-4 py-2.5 text-center font-medium">Empreend.</th>
              <th className="px-4 py-2.5 text-center font-medium">Unidades</th>
              <th className="px-4 py-2.5 text-right font-medium">VGV Est.</th>
              <th className="px-4 py-2.5 text-right font-medium">VGV Ponderado</th>
            </tr>
          </thead>
          <tbody>
            {FASES.map(fase => {
              const list = empreendimentos.filter(e =>
                (fase.statuses as string[]).includes(e.status)
              );
              const vgv = list.reduce((s, e) => s + (e.vgv_previsto ?? 0), 0);
              const pond = list.reduce((s, e) => {
                if (e.vgv_previsto != null && e.probabilidade != null) {
                  return s + e.vgv_previsto * (e.probabilidade / 100);
                }
                return s;
              }, 0);
              const unidades = list.reduce((s, e) => s + (e.num_unidades ?? 0), 0);

              return (
                <tr key={fase.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-5 py-3">
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${fase.corBadge.replace("text-", "bg-").split(" ")[0]}`} />
                    <span className="font-medium text-slate-700">{fase.label}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">{list.length}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{unidades || "—"}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">{vgv > 0 ? fmtBRL(vgv) : "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600">{pond > 0 ? fmtBRL(pond) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-50 font-semibold text-slate-800 border-t-2 border-slate-200">
            <tr>
              <td className="px-5 py-3">Total</td>
              <td className="px-4 py-3 text-center">{empreendimentos.length}</td>
              <td className="px-4 py-3 text-center">
                {empreendimentos.reduce((s, e) => s + (e.num_unidades ?? 0), 0) || "—"}
              </td>
              <td className="px-4 py-3 text-right">
                {fmtBRL(empreendimentos.reduce((s, e) => s + (e.vgv_previsto ?? 0), 0))}
              </td>
              <td className="px-4 py-3 text-right text-emerald-600">
                {fmtBRL(
                  empreendimentos.reduce((s, e) => {
                    if (e.vgv_previsto != null && e.probabilidade != null) {
                      return s + e.vgv_previsto * (e.probabilidade / 100);
                    }
                    return s;
                  }, 0)
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function Pipeline() {
  const [busca, setBusca] = useState("");

  // Fetch all pages (up to 200) so the pipeline shows everything
  const { data, isLoading } = useQuery({
    queryKey: ["empreendimentos", "pipeline"],
    queryFn: () =>
      empreendimentosApi.listar({ por_pagina: 200, pagina: 1 }),
    staleTime: 30_000,
  });

  const todos: EmpreendimentoResponse[] = data?.items ?? [];

  const filtrados = busca.trim()
    ? todos.filter(e =>
        e.nome.toLowerCase().includes(busca.toLowerCase()) ||
        e.endereco.cidade.toLowerCase().includes(busca.toLowerCase()) ||
        (e.parceiro ?? "").toLowerCase().includes(busca.toLowerCase())
      )
    : todos;

  // KPIs
  const totalVGV = filtrados.reduce((s, e) => s + (e.vgv_previsto ?? 0), 0);
  const totalPonderado = filtrados.reduce((s, e) => {
    if (e.vgv_previsto != null && e.probabilidade != null)
      return s + e.vgv_previsto * (e.probabilidade / 100);
    return s;
  }, 0);
  const emConstrucao = filtrados.filter(e => e.status === "em_obras").length;
  const emProspeccao = filtrados.filter(e =>
    e.status === "estudo" || e.status === "viabilidade"
  ).length;

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-slate-400 text-sm">Carregando pipeline…</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Cabeçalho ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pipeline de Obras</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Visão geral dos empreendimentos por fase do ciclo de vida
          </p>
        </div>
        <input
          type="text"
          placeholder="Buscar empreendimento, cidade, parceiro…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Building2}
          label="Total Empreendimentos"
          value={String(filtrados.length)}
          sub={todos.length !== filtrados.length ? `${todos.length} no total` : undefined}
          color="bg-slate-600"
        />
        <KpiCard
          icon={Banknote}
          label="VGV Total Estimado"
          value={fmtBRL(totalVGV)}
          color="bg-blue-600"
        />
        <KpiCard
          icon={TrendingUp}
          label="VGV Ponderado"
          value={fmtBRL(totalPonderado)}
          sub="VGV × probabilidade"
          color="bg-emerald-600"
        />
        <KpiCard
          icon={Layers}
          label="Em Construção"
          value={String(emConstrucao)}
          sub={`${emProspeccao} em prospecção`}
          color="bg-brand-600"
        />
      </div>

      {/* ── Kanban ───────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4 min-w-max">
          {FASES.map(fase => (
            <PipelineColuna
              key={fase.id}
              fase={fase}
              empreendimentos={filtrados.filter(e =>
                (fase.statuses as string[]).includes(e.status)
              )}
            />
          ))}
        </div>
      </div>

      {/* ── Tabela resumo ─────────────────────────────────────────────────── */}
      <TabelaResumo empreendimentos={filtrados} />
    </div>
  );
}
