import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  AlertTriangle, Building2, CheckCircle2, ServerOff, TrendingDown, TrendingUp,
  BarChart2, Layers, Zap, Home, Trophy, Filter,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { clsx } from "clsx";
import { dashboardApi } from "@/api/client";
import type { DashboardStats, EmpreendimentoProgresso } from "@/types";

// ── Formatters ─────────────────────────────────────────────────────────────────

function formatVGV(valor: number): string {
  if (valor >= 1_000_000) return `R$ ${(valor / 1_000_000).toFixed(1)}M`;
  if (valor >= 1_000)     return `R$ ${(valor / 1_000).toFixed(0)}K`;
  return `R$ ${valor.toFixed(0)}`;
}

// ── Section Title ──────────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, title, aside }: {
  icon?: React.ElementType;
  title: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
      <div className="flex items-center gap-2">
        <span className="block w-[3px] h-4 rounded-full bg-gradient-to-b from-brand-500 to-violet-500 shrink-0" />
        {Icon && <Icon size={15} className="text-slate-400 shrink-0" />}
        <h2 className="text-sm font-bold text-slate-700">{title}</h2>
      </div>
      {aside}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiProps {
  icon: React.ElementType;
  label: string;
  valor: string;
  sub?: string;
  accent: string;       // gradient class e.g. "from-brand-500 to-brand-600"
  iconColor: string;    // text color e.g. "text-brand-500"
  subColor?: string;
}

function KpiCard({ icon: Icon, label, valor, sub, accent, iconColor, subColor }: KpiProps) {
  return (
    <div className="card card-hover flex flex-col overflow-hidden">
      {/* Barra gradiente no topo */}
      <div className={`h-[3px] bg-gradient-to-r ${accent} w-full`} />
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className={clsx("p-2 rounded-lg bg-slate-50", iconColor)}>
            <Icon size={18} />
          </div>
          <p className="text-3xl font-bold text-slate-900 tabular-nums mt-0.5">{valor}</p>
        </div>
        <div className="mt-3">
          <p className="text-xs font-semibold text-slate-600">{label}</p>
          {sub && (
            <p className={clsx("text-xs mt-0.5", subColor ?? "text-slate-400")}>{sub}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Status chip ───────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, [string, string]> = {
  em_execucao:  ["bg-sky-100 text-sky-700 ring-sky-200",       "Em execução"],
  planejamento: ["bg-slate-100 text-slate-600 ring-slate-200", "Planejamento"],
  paralisada:   ["bg-amber-100 text-amber-700 ring-amber-200", "Paralisada"],
  concluida:    ["bg-emerald-100 text-emerald-700 ring-emerald-200","Concluída"],
  cancelada:    ["bg-red-100 text-red-700 ring-red-200",        "Cancelada"],
};

function StatusChip({ status }: { status: string }) {
  const [cls, label] = STATUS_MAP[status] ?? ["bg-slate-100 text-slate-500 ring-slate-200", status];
  return (
    <span className={clsx("badge ring-1", cls)}>
      {label}
    </span>
  );
}

// ── CPI chip ──────────────────────────────────────────────────────────────────

function CpiChip({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="text-xs text-slate-300">—</span>;
  const ok = valor >= 1;
  const critical = valor < 0.9;
  return (
    <span className={clsx(
      "badge ring-1",
      critical ? "bg-red-50 text-red-700 ring-red-200"
        : ok     ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                 : "bg-amber-50 text-amber-700 ring-amber-200",
    )}>
      {ok ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {valor.toFixed(2)}
    </span>
  );
}

// ── Recharts tooltip ──────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ payload: EmpreendimentoProgresso }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold text-slate-200 mb-1">{label}</p>
      <p className="text-brand-400 font-semibold">{d.progresso_medio.toFixed(1)}% concluído</p>
      <p className="text-slate-500 mt-0.5">{d.total_obras} obra{d.total_obras !== 1 ? "s" : ""}</p>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonDashboard() {
  return (
    <div className="p-4 sm:p-6 space-y-5 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white/80 rounded-2xl border border-slate-200 h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white/80 rounded-2xl border border-slate-200 h-64" />
        <div className="bg-white/80 rounded-2xl border border-slate-200 h-64" />
      </div>
      <div className="bg-white/80 rounded-2xl border border-slate-200 h-52" />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function Dashboard() {
  const navigate = useNavigate();

  const { data: stats, isLoading, isError } = useQuery<DashboardStats>({
    queryKey: ["dashboard"],
    queryFn: dashboardApi.resumo,
    refetchInterval: 60_000,
    retry: 1,
  });

  if (isLoading) return <SkeletonDashboard />;

  if (isError || !stats) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-64 text-slate-400">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <ServerOff size={28} className="opacity-40" />
        </div>
        <p className="font-semibold text-slate-500">Dashboard indisponível</p>
        <p className="text-sm mt-1 text-slate-400">Verifique se a API está rodando</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in">

      {/* ── KPI Cards ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Building2}
          label="Empreendimentos"
          valor={String(stats.total_empreendimentos)}
          sub="no portfólio"
          accent="from-brand-500 to-violet-500"
          iconColor="text-brand-600"
          subColor="text-brand-500"
        />
        <KpiCard
          icon={Layers}
          label="Obras ativas"
          valor={String(stats.obras_ativas)}
          sub="em execução"
          accent="from-emerald-400 to-teal-500"
          iconColor="text-emerald-600"
          subColor="text-emerald-500"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Em alerta (CPI)"
          valor={String(stats.obras_com_alerta)}
          sub={stats.obras_com_alerta > 0 ? "requerem atenção" : "sem alertas"}
          accent={stats.obras_com_alerta > 0 ? "from-red-500 to-orange-500" : "from-slate-300 to-slate-400"}
          iconColor={stats.obras_com_alerta > 0 ? "text-red-500" : "text-slate-400"}
          subColor={stats.obras_com_alerta > 0 ? "text-red-500" : "text-slate-400"}
        />
        <KpiCard
          icon={TrendingUp}
          label="VGV previsto"
          valor={formatVGV(stats.vgv_total)}
          sub="soma total"
          accent="from-gold-400 to-amber-500"
          iconColor="text-gold-600"
          subColor="text-gold-600"
        />
      </div>

      {/* ── Desempenho Comercial (espelho + funil) ──────────────────────────── */}
      {stats.comercial.total_unidades > 0 && (
        <div className="card p-5">
          <SectionTitle icon={Trophy} title="Desempenho comercial" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-1">
            {/* VGV vendido + barra de % */}
            <div className="lg:col-span-1">
              <div className="flex items-end justify-between mb-1.5">
                <div>
                  <p className="text-xs text-slate-400">VGV vendido</p>
                  <p className="text-xl font-bold text-emerald-700 tabular-nums">{formatVGV(stats.comercial.vgv_vendido)}</p>
                </div>
                <p className="text-2xl font-bold text-emerald-600">{stats.comercial.percentual_vendido}%</p>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all"
                  style={{ width: `${Math.min(stats.comercial.percentual_vendido, 100)}%` }} />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">de {formatVGV(stats.comercial.vgv_estoque)} em estoque (VGV tabela)</p>
            </div>

            {/* Unidades por status */}
            <div className="grid grid-cols-4 gap-2 lg:col-span-1">
              {[
                { label: "Total", valor: stats.comercial.total_unidades, cor: "text-slate-700", icon: Home },
                { label: "Vendidas", valor: stats.comercial.unidades_vendidas, cor: "text-blue-600", icon: Trophy },
                { label: "Reservadas", valor: stats.comercial.unidades_reservadas, cor: "text-orange-500", icon: Layers },
                { label: "Disponíveis", valor: stats.comercial.unidades_disponiveis, cor: "text-emerald-600", icon: Home },
              ].map(k => (
                <div key={k.label} className="text-center bg-slate-50 rounded-xl py-3">
                  <p className={clsx("text-xl font-bold tabular-nums", k.cor)}>{k.valor}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{k.label}</p>
                </div>
              ))}
            </div>

            {/* Funil */}
            <button onClick={() => navigate("/funil")}
              className="lg:col-span-1 flex items-center justify-between bg-rose-50 rounded-xl px-4 py-3 hover:bg-rose-100 transition-colors text-left">
              <div>
                <p className="text-xs text-rose-500 flex items-center gap-1"><Filter size={11} /> Pipeline de vendas</p>
                <p className="text-xl font-bold text-rose-700 tabular-nums">{formatVGV(stats.comercial.pipeline_valor)}</p>
                <p className="text-[11px] text-rose-400 mt-0.5">{stats.comercial.leads_ativos} leads ativos</p>
              </div>
              <TrendingUp size={28} className="text-rose-300" />
            </button>
          </div>
        </div>
      )}

      {/* ── Gráfico + Resumo ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Barchart */}
        <div className="card lg:col-span-2 p-5">
          <SectionTitle icon={BarChart2} title="Progresso médio por empreendimento" />
          {stats.empreendimentos_progresso.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-slate-400 gap-2">
              <BarChart2 size={28} className="opacity-30" />
              <p className="text-sm">Nenhum empreendimento cadastrado</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart
                data={stats.empreendimentos_progresso}
                margin={{ top: 4, right: 4, left: -22, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="barBrand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#0284c7" />
                  </linearGradient>
                  <linearGradient id="barGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="nome"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(241,245,249,0.6)" }} />
                <Bar dataKey="progresso_medio" radius={[6, 6, 0, 0]} maxBarSize={52}>
                  {stats.empreendimentos_progresso.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.progresso_medio >= 100 ? "url(#barGreen)" : "url(#barBrand)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Resumo geral */}
        <div className="card p-5 flex flex-col">
          <SectionTitle title="Resumo geral" />
          <div className="flex-1 space-y-2">
            {[
              { label: "Obras ativas",     valor: stats.obras_ativas,          icon: Layers,         cor: "text-sky-500",     bg: "bg-sky-50" },
              { label: "Concluídas",       valor: stats.obras_concluidas,       icon: CheckCircle2,   cor: "text-emerald-500", bg: "bg-emerald-50" },
              { label: "Com alerta (CPI)", valor: stats.obras_com_alerta,       icon: AlertTriangle,  cor: stats.obras_com_alerta > 0 ? "text-amber-500" : "text-slate-300", bg: stats.obras_com_alerta > 0 ? "bg-amber-50" : "bg-slate-50" },
              { label: "Empreendimentos",  valor: stats.total_empreendimentos,  icon: Building2,      cor: "text-brand-500",   bg: "bg-brand-50" },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                <div className={clsx("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", item.bg)}>
                  <item.icon size={14} className={item.cor} />
                </div>
                <span className="flex-1 text-sm text-slate-600">{item.label}</span>
                <span className="text-sm font-bold text-slate-800 tabular-nums">{item.valor}</span>
              </div>
            ))}
          </div>

          {/* VGV destaque */}
          <div className="mt-4 rounded-xl p-4 bg-gradient-to-br from-gold-50 via-amber-50 to-gold-100 border border-gold-200/60">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap size={11} className="text-gold-500" />
              <p className="text-xs font-semibold text-gold-600">VGV Total previsto</p>
            </div>
            <p className="text-2xl font-bold text-gold-700 tabular-nums">{formatVGV(stats.vgv_total)}</p>
            {stats.vgv_total === 0 && (
              <p className="text-xs text-gold-500/70 mt-1">Informe o VGV nos empreendimentos</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Obras recentes ────────────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-4 sm:px-6 pt-5 pb-0">
          <SectionTitle
            icon={Building2}
            title="Obras recentes"
            aside={
              <span className="text-xs text-slate-400 font-medium">
                {stats.obras_recentes.length} registros
              </span>
            }
          />
        </div>

        {stats.obras_recentes.length === 0 ? (
          <div className="px-4 sm:px-6 py-12 text-center text-slate-400">
            <Building2 size={32} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm font-medium text-slate-500">Nenhuma obra cadastrada</p>
            <p className="text-xs mt-1">Acesse Empreendimentos e crie a primeira obra</p>
          </div>
        ) : (
          <div className="overflow-x-auto mt-1">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "linear-gradient(90deg, #1e293b 0%, #0f172a 100%)" }}>
                  {["Obra", "Empreendimento", "Status", "% Físico", "CPI"].map((col, i) => (
                    <th
                      key={col}
                      className={clsx(
                        "py-3 text-left text-[11px] font-semibold uppercase tracking-wider",
                        i === 0 ? "pl-6 pr-4" : "px-4",
                        i === 1 ? "hidden md:table-cell" : "",
                        "text-slate-300",
                      )}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.obras_recentes.map((obra, idx) => (
                  <tr
                    key={obra.id}
                    onClick={() => navigate(`/obras/${obra.id}`)}
                    className={clsx(
                      "cursor-pointer group transition-all",
                      idx % 2 === 0 ? "bg-white" : "bg-slate-50/40",
                      "hover:bg-brand-50/50 hover:shadow-sm",
                    )}
                  >
                    <td className="pl-6 pr-4 py-3.5 font-semibold text-slate-800 group-hover:text-brand-600 transition-colors">
                      {obra.nome}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500 hidden md:table-cell">
                      {obra.empreendimento_nome}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusChip status={obra.status} />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={clsx(
                              "h-full rounded-full transition-all",
                              obra.progresso_fisico >= 100
                                ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                                : "bg-gradient-to-r from-brand-400 to-brand-600",
                            )}
                            style={{ width: `${obra.progresso_fisico}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-600 tabular-nums w-10 text-right">
                          {obra.progresso_fisico.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <CpiChip valor={obra.cpi} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
