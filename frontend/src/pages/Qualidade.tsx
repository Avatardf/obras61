import { useQuery } from "@tanstack/react-query";
import {
  Bot, CalendarDays, CheckCircle2, ClipboardList,
  CloudSun, Loader2, ServerOff,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { clsx } from "clsx";
import { rdoApi } from "@/api/client";
import type { RDOResumo } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const CLIMA_ICON: Record<string, string> = {
  ensolarado: "☀️",
  nublado:    "🌤️",
  chuvoso:    "🌧️",
  tempestade: "⛈️",
};

function dataFmt(iso: string) {
  return new Date(iso + "T12:00").toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon, label, value, sub, iconCls = "text-brand-600",
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: string;
  iconCls?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
      <div className={clsx("p-2.5 rounded-xl bg-slate-50", iconCls)}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs text-slate-400 mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function Qualidade() {
  const navigate = useNavigate();
  const [filtroStatus, setFiltroStatus] = useState<"" | "rascunho" | "finalizado">("");
  const [filtroBusca, setFiltroBusca] = useState("");

  const { data: rdos = [], isLoading, isError, refetch } = useQuery<RDOResumo[]>({
    queryKey: ["rdos-todos"],
    queryFn: () => rdoApi.listarTodos(),
    retry: 1,
  });

  // ── Filtered ──
  const filtrados = rdos.filter(r => {
    if (filtroStatus && r.status !== filtroStatus) return false;
    if (filtroBusca) {
      const q = filtroBusca.toLowerCase();
      return r.data.includes(q);
    }
    return true;
  });

  // ── Stats ──
  const totalIA = rdos.filter(r => r.tem_ia).length;
  const finalizados = rdos.filter(r => r.status === "finalizado").length;

  // ── Error / loading ──
  if (isError) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-64 gap-4 text-slate-400">
        <ServerOff size={36} className="opacity-40" />
        <p className="text-sm">API não disponível</p>
        <button
          onClick={() => refetch()}
          className="text-xs text-brand-600 hover:underline"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          icon={ClipboardList}
          label="Total de RDOs"
          value={isLoading ? "—" : rdos.length}
          sub="últimos 100 registros"
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Finalizados"
          value={isLoading ? "—" : finalizados}
          iconCls="text-emerald-600"
          sub={rdos.length > 0 ? `${Math.round(finalizados / rdos.length * 100)}% do total` : undefined}
        />
        <SummaryCard
          icon={Bot}
          label="Com relatório Gemini"
          value={isLoading ? "—" : totalIA}
          iconCls="text-purple-600"
          sub={rdos.length > 0 ? `${Math.round(totalIA / rdos.length * 100)}% do total` : undefined}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="date"
          value={filtroBusca}
          onChange={e => setFiltroBusca(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white"
          placeholder="Filtrar por data"
        />
        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value as "" | "rascunho" | "finalizado")}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white"
        >
          <option value="">Todos os status</option>
          <option value="rascunho">Rascunho</option>
          <option value="finalizado">Finalizado</option>
        </select>
        {(filtroStatus || filtroBusca) && (
          <button
            onClick={() => { setFiltroStatus(""); setFiltroBusca(""); }}
            className="text-xs text-slate-400 hover:text-slate-600 px-2"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Carregando RDOs…</span>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          <CalendarDays size={36} className="mx-auto mb-3 opacity-25" />
          <p className="font-medium text-slate-500">
            {rdos.length === 0 ? "Nenhum RDO registrado" : "Nenhum resultado para o filtro"}
          </p>
          <p className="text-sm mt-1">
            {rdos.length === 0
              ? "Acesse uma obra e use a aba RDO para lançar o relatório diário"
              : "Tente ajustar os filtros"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Clima</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Efetivo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Atividades</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Ocorrências</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">IA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map(r => (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/rdos/${r.id}`)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <CalendarDays size={13} className="text-slate-300 shrink-0" />
                        <span className="text-slate-700 font-medium tabular-nums">{dataFmt(r.data)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm">
                      <span title={`Manhã: ${r.clima_manha ?? "—"} | Tarde: ${r.clima_tarde ?? "—"}`}>
                        {r.clima_manha
                          ? `${CLIMA_ICON[r.clima_manha] ?? ""} / ${CLIMA_ICON[r.clima_tarde ?? ""] ?? "—"}`
                          : <span className="text-slate-300">—</span>
                        }
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 hidden md:table-cell tabular-nums">
                      {r.efetivo_total != null ? `${r.efetivo_total} trab.` : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <span className="text-slate-600">{r.total_atividades}</span>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      {r.total_ocorrencias > 0 ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                          {r.total_ocorrencias}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={clsx(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        r.status === "finalizado"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      )}>
                        {r.status === "finalizado" ? "Finalizado" : "Rascunho"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {r.tem_ia ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-brand-600">
                          <Bot size={12} /> Gerado
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
            {filtrados.length} registro{filtrados.length !== 1 ? "s" : ""}
            {filtrados.length !== rdos.length && ` (de ${rdos.length} total)`}
          </div>
        </div>
      )}
    </div>
  );
}
