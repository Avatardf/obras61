import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { obrasApi } from "@/api/client";
import { Badge } from "@/components/ui/Badge";
import type { Atividade, Etapa } from "@/types";

function AtividadeRow({ ativ, obraId }: { ativ: Atividade; obraId: string }) {
  const qc = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [valorTemp, setValorTemp] = useState(String(ativ.quantidade_realizada));

  const mutation = useMutation({
    mutationFn: (v: number) => obrasApi.atualizarAtividade(ativ.id, { quantidade_realizada: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obra", obraId] });
      setEditando(false);
    },
  });

  function salvar() {
    const v = parseFloat(valorTemp);
    if (!isNaN(v) && v >= 0) mutation.mutate(v);
  }

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 group transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Mini barra */}
        <div className="w-16 h-1.5 bg-slate-200 rounded-full shrink-0">
          <div
            className="h-full bg-brand-400 rounded-full"
            style={{ width: `${ativ.percentual}%` }}
          />
        </div>
        <span className="text-sm text-slate-600 truncate">{ativ.nome}</span>
      </div>

      <div className="flex items-center gap-3 shrink-0 ml-3">
        {editando ? (
          <div className="flex items-center gap-1.5">
            <input
              type="number" min={0} max={ativ.quantidade_prevista}
              value={valorTemp}
              onChange={e => setValorTemp(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") salvar(); if (e.key === "Escape") setEditando(false); }}
              autoFocus
              className="w-20 px-2 py-1 text-xs rounded border border-brand-400 outline-none focus:ring-1 focus:ring-brand-300"
            />
            <span className="text-xs text-slate-400">/ {ativ.quantidade_prevista} {ativ.unidade}</span>
            <button onClick={salvar} disabled={mutation.isPending}
              className="text-xs text-white bg-brand-600 px-2 py-1 rounded hover:bg-brand-700 disabled:opacity-60">
              {mutation.isPending ? "…" : "OK"}
            </button>
            <button onClick={() => setEditando(false)} className="text-xs text-slate-400 hover:text-slate-600">✕</button>
          </div>
        ) : (
          <>
            <span className="text-xs text-slate-500">
              {ativ.quantidade_realizada} / {ativ.quantidade_prevista} {ativ.unidade}
            </span>
            <span className={clsx("text-xs font-semibold w-10 text-right",
              ativ.percentual >= 100 ? "text-emerald-600" : ativ.percentual > 0 ? "text-brand-600" : "text-slate-400"
            )}>
              {ativ.percentual.toFixed(0)}%
            </span>
            <button
              onClick={() => setEditando(true)}
              className="opacity-0 group-hover:opacity-100 text-xs text-brand-500 hover:underline transition-opacity"
            >
              Atualizar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface Props { etapas: Etapa[]; obraId: string; }

export function EtapasPanel({ etapas, obraId }: Props) {
  const [expandidas, setExpandidas] = useState<Set<string>>(
    new Set(etapas.filter(e => e.status === "em_execucao").map(e => e.id))
  );

  function toggleEtapa(id: string) {
    setExpandidas(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-700">Etapas da Obra</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Clique em "Atualizar" (hover na atividade) para registrar progresso
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {etapas.map(etapa => {
          const aberta = expandidas.has(etapa.id);
          return (
            <div key={etapa.id}>
              {/* Cabeçalho da etapa */}
              <button
                onClick={() => toggleEtapa(etapa.id)}
                className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
              >
                {aberta ? <ChevronDown size={15} className="text-slate-400 shrink-0" />
                         : <ChevronRight size={15} className="text-slate-400 shrink-0" />}

                <span className="text-xs text-slate-400 w-5 shrink-0">{etapa.ordem}</span>

                <span className="flex-1 text-sm font-medium text-slate-700">{etapa.nome}</span>

                <Badge value={etapa.status} className="shrink-0" />

                {/* Barra de progresso da etapa */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-24 h-1.5 bg-slate-200 rounded-full">
                    <div
                      className={clsx("h-full rounded-full transition-all",
                        etapa.progresso >= 100 ? "bg-emerald-500" : "bg-brand-500"
                      )}
                      style={{ width: `${etapa.progresso}%` }}
                    />
                  </div>
                  <span className={clsx("text-xs font-semibold w-8 text-right",
                    etapa.progresso >= 100 ? "text-emerald-600" : "text-slate-600"
                  )}>
                    {etapa.progresso.toFixed(0)}%
                  </span>
                </div>

                <span className="text-xs text-slate-400 w-12 text-right shrink-0">
                  peso {etapa.percentual_peso}%
                </span>
              </button>

              {/* Atividades */}
              {aberta && (
                <div className="px-5 pb-3 bg-slate-50/50">
                  {etapa.atividades.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2 pl-8">
                      Nenhuma atividade cadastrada nesta etapa
                    </p>
                  ) : (
                    etapa.atividades.map(a => (
                      <AtividadeRow key={a.id} ativ={a} obraId={obraId} />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
