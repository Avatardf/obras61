import { useQuery } from "@tanstack/react-query";
import { FileText, ServerOff, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { clsx } from "clsx";
import { orcamentosApi } from "@/api/client";
import type { OrcamentoResumo } from "@/types";

function moeda(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(0)}K`;
  return `R$ ${v.toFixed(0)}`;
}

const STATUS_CLS: Record<string, string> = {
  rascunho:  "bg-amber-50 text-amber-700",
  vigente:   "bg-emerald-50 text-emerald-700",
  arquivado: "bg-slate-100 text-slate-500",
};

const STATUS_LABEL: Record<string, string> = {
  rascunho:  "Rascunho",
  vigente:   "Vigente",
  arquivado: "Arquivado",
};

const BASE_LABEL: Record<string, string> = {
  sinapi: "SINAPI", sicro: "SICRO", cub: "CUB", tcpo: "TCPO", propria: "Própria",
};

export function Orcamentos() {
  const navigate = useNavigate();

  const { data: orcamentos = [], isLoading, isError } = useQuery<OrcamentoResumo[]>({
    queryKey: ["orcamentos-todos"],
    queryFn: orcamentosApi.listarTodos,
    retry: 1,
  });

  const vigentes   = orcamentos.filter(o => o.status === "vigente").length;
  const rascunhos  = orcamentos.filter(o => o.status === "rascunho").length;
  const bacTotal   = orcamentos.filter(o => o.status === "vigente")
                               .reduce((s, o) => s + o.valor_total * (1 + o.bdi_percentual / 100), 0);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-white rounded-xl border border-slate-200" />)}
        </div>
        <div className="h-64 bg-white rounded-xl border border-slate-200" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-64 text-slate-400">
        <ServerOff size={32} className="mb-3 opacity-40" />
        <p className="font-medium text-slate-500">Módulo indisponível</p>
        <p className="text-sm mt-1">Verifique se a API está rodando</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
            <FileText size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{vigentes}</p>
            <p className="text-xs text-slate-500">Orçamentos vigentes</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
            <FileText size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{rascunhos}</p>
            <p className="text-xs text-slate-500">Em rascunho</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
            <TrendingUp size={18} className="text-brand-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-brand-600">{moeda(bacTotal)}</p>
            <p className="text-xs text-slate-500">BAC total (c/ BDI, vigentes)</p>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Todos os orçamentos</h2>
          <span className="text-xs text-slate-400">{orcamentos.length} registro{orcamentos.length !== 1 ? "s" : ""}</span>
        </div>

        {orcamentos.length === 0 ? (
          <div className="px-6 py-16 text-center text-slate-400">
            <FileText size={36} className="mx-auto mb-3 opacity-25" />
            <p className="font-medium text-slate-500">Nenhum orçamento cadastrado</p>
            <p className="text-sm mt-1">
              Acesse uma obra e crie o primeiro orçamento na aba <strong>Orçamento</strong>
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Obra</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Versão</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Base</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">BAC (c/ BDI)</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Itens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orcamentos.map(orc => {
                  const bacComBdi = orc.valor_total * (1 + orc.bdi_percentual / 100);
                  return (
                    <tr
                      key={orc.id}
                      onClick={() => navigate(`/orcamentos/${orc.id}`)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-800">{orc.obra_nome}</p>
                        {orc.descricao && (
                          <p className="text-xs text-slate-400 mt-0.5">{orc.descricao}</p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center text-slate-600">v{orc.versao}</td>
                      <td className="px-4 py-4">
                        <span className={clsx(
                          "text-xs font-medium px-2 py-0.5 rounded-full",
                          STATUS_CLS[orc.status] ?? "bg-slate-100 text-slate-500",
                        )}>
                          {STATUS_LABEL[orc.status] ?? orc.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500 hidden md:table-cell uppercase">
                        {BASE_LABEL[orc.base_referencia] ?? orc.base_referencia}
                        {orc.uf_referencia && ` / ${orc.uf_referencia}`}
                      </td>
                      <td className="px-4 py-4 text-right font-semibold text-slate-800 tabular-nums">
                        {bacComBdi > 0 ? moeda(bacComBdi) : "—"}
                      </td>
                      <td className="px-4 py-4 text-center text-slate-600">{orc.total_itens}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
