import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Bot, CheckSquare, CloudSun, FileText,
  Loader2, RefreshCw, Trash2, Users, AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { clsx } from "clsx";
import { rdoApi } from "@/api/client";
import type { RDOResponse, OcorrenciaRDO } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const CLIMA_ICON: Record<string, string> = {
  ensolarado: "☀️",
  nublado:    "🌤️",
  chuvoso:    "🌧️",
  tempestade: "⛈️",
};

const CRIT_CLS: Record<string, string> = {
  baixa: "bg-emerald-100 text-emerald-700",
  media: "bg-amber-100 text-amber-700",
  alta:  "bg-red-100 text-red-700",
};

const TIPO_LABEL: Record<string, string> = {
  seguranca: "Segurança",
  qualidade: "Qualidade",
  ambiental: "Ambiental",
  geral:     "Geral",
};

function dataFormatada(iso: string) {
  return new Date(iso + "T12:00").toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
}

// ── Small card ────────────────────────────────────────────────────────────────

function InfoCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ icon: Icon, title, children }: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 text-slate-600 mb-4">
        <Icon size={15} />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ── Ocorrência badge ──────────────────────────────────────────────────────────

function OcBadge({ oc }: { oc: OcorrenciaRDO }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <span className={clsx("text-xs font-medium px-2 py-0.5 rounded-full shrink-0 mt-0.5", CRIT_CLS[oc.criticidade] ?? "bg-slate-100 text-slate-500")}>
        {oc.criticidade.charAt(0).toUpperCase() + oc.criticidade.slice(1)}
      </span>
      <div className="flex-1">
        <p className="text-sm text-slate-700">{oc.descricao}</p>
        <p className="text-xs text-slate-400 mt-0.5">{TIPO_LABEL[oc.tipo] ?? oc.tipo}</p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function RDODetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [gerandoIA, setGerandoIA] = useState(false);

  const { data: rdo, isLoading } = useQuery<RDOResponse>({
    queryKey: ["rdo", id],
    queryFn: () => rdoApi.buscar(id!),
    enabled: !!id,
  });

  const excluirMutation = useMutation({
    mutationFn: () => rdoApi.excluir(id!),
    onSuccess: () => navigate(-1),
  });

  const finalizarMutation = useMutation({
    mutationFn: () => rdoApi.atualizar(id!, { status: "finalizado" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rdo", id] }),
  });

  async function handleGerarIA() {
    if (!id) return;
    setGerandoIA(true);
    try {
      await rdoApi.gerarIA(id);
      qc.invalidateQueries({ queryKey: ["rdo", id] });
    } catch {
      // Gemini indisponível
    } finally {
      setGerandoIA(false);
    }
  }

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-1/3" />
        <div className="h-4 bg-slate-100 rounded w-1/4" />
        <div className="grid grid-cols-3 gap-4 mt-6">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!rdo) return null;

  const isRascunho = rdo.status === "rascunho";
  const efetivoPorEquipe = rdo.equipes.reduce((s, e) => s + e.quantidade, 0);
  const efetivo = rdo.efetivo_total ?? efetivoPorEquipe;

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Header */}
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
              RDO — {new Date(rdo.data + "T12:00").toLocaleDateString("pt-BR")}
            </h2>
            <span className={clsx(
              "text-xs font-medium px-2.5 py-0.5 rounded-full",
              isRascunho ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
            )}>
              {isRascunho ? "Rascunho" : "Finalizado"}
            </span>
            {rdo.conteudo_ia && (
              <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">
                <Bot size={10} /> Gemini
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1 capitalize">{dataFormatada(rdo.data)}</p>
        </div>
        <div className="flex items-center gap-2">
          {isRascunho && (
            <button
              onClick={() => finalizarMutation.mutate()}
              disabled={finalizarMutation.isPending}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors"
            >
              {finalizarMutation.isPending ? "Finalizando…" : "Finalizar RDO"}
            </button>
          )}
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["rdo", id] })}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => { if (confirm("Excluir este RDO?")) excluirMutation.mutate(); }}
            disabled={excluirMutation.isPending}
            className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <InfoCard
          label="Clima — Manhã"
          value={rdo.clima_manha
            ? `${CLIMA_ICON[rdo.clima_manha] ?? ""} ${rdo.clima_manha.charAt(0).toUpperCase() + rdo.clima_manha.slice(1)}`
            : "—"
          }
        />
        <InfoCard
          label="Clima — Tarde"
          value={rdo.clima_tarde
            ? `${CLIMA_ICON[rdo.clima_tarde] ?? ""} ${rdo.clima_tarde.charAt(0).toUpperCase() + rdo.clima_tarde.slice(1)}`
            : "—"
          }
        />
        <InfoCard
          label="Efetivo total"
          value={efetivo > 0 ? `${efetivo} trabalhadores` : "—"}
        />
        <InfoCard
          label="Ocorrências"
          value={rdo.ocorrencias.length > 0
            ? `${rdo.ocorrencias.length} registrada${rdo.ocorrencias.length !== 1 ? "s" : ""}`
            : "Nenhuma"
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-5">

          {/* Equipes */}
          {rdo.equipes.length > 0 && (
            <Section icon={Users} title="Composição de equipes">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Função</th>
                      <th className="text-right pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Qtd</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rdo.equipes.map((e, i) => (
                      <tr key={i}>
                        <td className="py-2.5 text-slate-700">{e.funcao}</td>
                        <td className="py-2.5 text-right font-semibold text-slate-700 tabular-nums">{e.quantidade}</td>
                      </tr>
                    ))}
                  </tbody>
                  {rdo.equipes.length > 1 && (
                    <tfoot className="border-t border-slate-200">
                      <tr>
                        <td className="pt-2.5 text-xs font-semibold text-slate-500 uppercase">Total</td>
                        <td className="pt-2.5 text-right font-bold text-slate-800 tabular-nums">
                          {rdo.equipes.reduce((s, e) => s + e.quantidade, 0)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Section>
          )}

          {/* Atividades */}
          <Section icon={CheckSquare} title={`Atividades executadas (${rdo.atividades.length})`}>
            {rdo.atividades.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Nenhuma atividade registrada</p>
            ) : (
              <ol className="space-y-2">
                {rdo.atividades.map((a, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <span className="text-slate-300 font-mono text-xs mt-0.5 w-5 text-right shrink-0">{i + 1}.</span>
                    <span className="text-slate-700">{a}</span>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          {/* Ocorrências */}
          {rdo.ocorrencias.length > 0 && (
            <Section icon={AlertTriangle} title={`Ocorrências e não-conformidades (${rdo.ocorrencias.length})`}>
              <div>
                {rdo.ocorrencias.map((oc, i) => <OcBadge key={i} oc={oc} />)}
              </div>
            </Section>
          )}

          {/* Observações */}
          {rdo.observacoes && (
            <Section icon={FileText} title="Observações do responsável">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{rdo.observacoes}</p>
            </Section>
          )}
        </div>

        {/* Coluna lateral — Gemini */}
        <div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 sticky top-6">
            <div className="flex items-center gap-2 mb-4">
              <Bot size={16} className="text-brand-600" />
              <h3 className="text-sm font-semibold text-slate-700">Relatório formal (Gemini)</h3>
            </div>

            {rdo.conteudo_ia ? (
              <div className="space-y-3">
                <div className="bg-slate-50 rounded-lg p-4 text-xs text-slate-600 leading-relaxed max-h-[60vh] overflow-y-auto whitespace-pre-wrap font-mono">
                  {rdo.conteudo_ia}
                </div>
                <button
                  onClick={handleGerarIA}
                  disabled={gerandoIA}
                  className="w-full flex items-center justify-center gap-2 py-2 border border-brand-300 text-brand-700 rounded-lg text-sm font-medium hover:bg-brand-50 disabled:opacity-60 transition-colors"
                >
                  {gerandoIA
                    ? <><Loader2 size={14} className="animate-spin" /> Gerando…</>
                    : <><RefreshCw size={13} /> Regenerar</>
                  }
                </button>
              </div>
            ) : (
              <div>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  O Gemini redige o RDO formal completo com 7 seções técnicas — cabeçalho,
                  condições climáticas, quadro de efetivo, atividades, ocorrências, observações e assinatura.
                </p>
                <button
                  onClick={handleGerarIA}
                  disabled={gerandoIA}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors"
                >
                  {gerandoIA
                    ? <><Loader2 size={14} className="animate-spin" /> Gerando via Gemini…</>
                    : <><Bot size={14} /> Gerar relatório formal</>
                  }
                </button>
                {rdo.atividades.length === 0 && (
                  <p className="text-xs text-amber-600 mt-2 text-center">
                    Adicione atividades para um relatório mais completo
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
