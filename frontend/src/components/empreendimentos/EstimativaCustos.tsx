import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { empreendimentosApi } from "@/api/client";
import type { EstimativaCusto, EmpreendimentoResponse } from "@/types";
import {
  Sparkles, Loader2, ChevronDown, ChevronUp, Trash2,
  AlertTriangle, CheckCircle2, Info, TrendingUp, Pencil,
} from "lucide-react";
import { clsx } from "clsx";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtM2 = (v: number | null | undefined) =>
  v == null ? "—" : `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}/m²`;

const BREAKDOWN_LABELS: Record<string, string> = {
  fundacao:              "Fundação",
  estrutura:             "Estrutura",
  vedacao_alvenaria:     "Vedação / Alvenaria",
  cobertura:             "Cobertura",
  instalacoes_eletricas: "Instalações Elétricas",
  instalacoes_hidraulicas: "Instalações Hidráulicas",
  instalacoes_especiais: "Instalações Especiais",
  revestimentos:         "Revestimentos",
  esquadrias_vidros:     "Esquadrias e Vidros",
  pintura:               "Pintura",
  acabamentos_metais:    "Acabamentos / Metais",
  elevadores:            "Elevadores",
  estacionamento:        "Estacionamento",
  areas_lazer:           "Áreas de Lazer",
  areas_comuns_circulacao: "Áreas Comuns / Circulação",
  bdi_indiretos:         "BDI / Custos Indiretos",
};

const CONFIANCA_INFO: Record<string, { label: string; cor: string; icon: typeof Info }> = {
  alta:  { label: "Confiança alta",   cor: "text-emerald-600 bg-emerald-50 border-emerald-200", icon: CheckCircle2 },
  media: { label: "Confiança média",  cor: "text-amber-600 bg-amber-50 border-amber-200",       icon: Info },
  baixa: { label: "Confiança baixa",  cor: "text-red-600 bg-red-50 border-red-200",             icon: AlertTriangle },
};

// ── Componente de barra de breakdown ─────────────────────────────────────────

function BreakdownBar({ label, valor, total, cor }: {
  label: string; valor: number; total: number; cor: string;
}) {
  const pct = total > 0 ? (valor / total * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 text-xs text-slate-500 text-right shrink-0">{label}</div>
      <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
        <div className={clsx("h-full rounded-full", cor)} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-28 text-xs text-slate-600 font-medium shrink-0">{fmt(valor)}</div>
      <div className="w-10 text-xs text-slate-400 shrink-0">{pct.toFixed(0)}%</div>
    </div>
  );
}

// Paleta de cores para as barras
const CORES = [
  "bg-blue-500", "bg-indigo-500", "bg-violet-500", "bg-purple-500",
  "bg-fuchsia-400", "bg-rose-400", "bg-orange-400", "bg-amber-400",
  "bg-yellow-400", "bg-lime-400", "bg-green-500", "bg-teal-500",
  "bg-cyan-500", "bg-sky-500", "bg-slate-400", "bg-zinc-500",
];

// ── Card de uma estimativa ────────────────────────────────────────────────────

function EstimativaCard({
  est, empId, onDeleted,
}: {
  est: EstimativaCusto;
  empId: string;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const [expandido, setExpandido] = useState(true);

  const deletar = useMutation({
    mutationFn: () => empreendimentosApi.excluirEstimativa(empId, est.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estimativas", empId] });
      onDeleted();
    },
  });

  const confianca = CONFIANCA_INFO[est.confianca] ?? CONFIANCA_INFO.media;
  const ConfiancaIcon = confianca.icon;

  const breakdownEntries = Object.entries(est.breakdown ?? {}).filter(([, v]) => (v as number) > 0);
  const totalBreakdown = breakdownEntries.reduce((s, [, v]) => s + (v as number), 0);

  const dataStr = new Date(est.gerado_em).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Cabeçalho */}
      <div className="flex items-center gap-4 px-5 py-4 bg-gradient-to-r from-brand-50 to-indigo-50 border-b border-slate-100">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-bold text-slate-800">{fmt(est.custo_total)}</span>
            {est.custo_total_min && est.custo_total_max && (
              <span className="text-xs text-slate-400">
                ({fmt(est.custo_total_min)} – {fmt(est.custo_total_max)})
              </span>
            )}
            <span className={clsx(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium",
              confianca.cor
            )}>
              <ConfiancaIcon size={10} />
              {confianca.label}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{dataStr} · {est.modelo_ia}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => deletar.mutate()}
            disabled={deletar.isPending}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Excluir estimativa"
          >
            {deletar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
          <button
            onClick={() => setExpandido(e => !e)}
            className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Métricas resumidas */}
      <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
        {[
          { label: "Custo/m² construído", valor: fmtM2(est.custo_por_m2_construido) },
          { label: "Área construída est.", valor: est.area_construida_estimada_m2 ? `${est.area_construida_estimada_m2.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} m²` : "—" },
          { label: "Custo por unidade",    valor: fmt(est.custo_por_unidade) },
          { label: "Ref. CUB",             valor: est.multiplicador_cub ? `${est.multiplicador_cub}× CUB` : "—" },
        ].map(m => (
          <div key={m.label} className="px-4 py-3 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">{m.label}</p>
            <p className="text-sm font-semibold text-slate-700 mt-0.5">{m.valor}</p>
          </div>
        ))}
      </div>

      {/* Corpo expansível */}
      {expandido && (
        <div className="p-5 space-y-5">
          {/* Referência CUB */}
          {est.referencia_cub && (
            <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              <TrendingUp size={13} className="mt-0.5 text-brand-400 shrink-0" />
              {est.referencia_cub}
            </div>
          )}

          {/* Breakdown por categoria */}
          {breakdownEntries.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Composição do custo
              </p>
              {breakdownEntries
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([chave, valor], i) => (
                  <BreakdownBar
                    key={chave}
                    label={BREAKDOWN_LABELS[chave] ?? chave}
                    valor={valor as number}
                    total={totalBreakdown}
                    cor={CORES[i % CORES.length]}
                  />
                ))}
            </div>
          )}

          {/* Premissas */}
          {est.premissas?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Premissas adotadas
              </p>
              <ul className="space-y-1">
                {est.premissas.map((p, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                    <span className="text-brand-400 mt-0.5 shrink-0">•</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Observações */}
          {est.observacoes && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5 text-xs text-amber-800">
              <p className="font-semibold mb-1">⚠️ Observações da IA</p>
              {est.observacoes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  empreendimento: EmpreendimentoResponse;
  /** Callback opcional para abrir o formulário de edição com foco
   *  na seção que falta. Quando ausente, mostra apenas o aviso. */
  onEditar?: (camposFaltantes: string[]) => void;
}

export function EstimativaCustos({ empreendimento, onEditar }: Props) {
  const qc = useQueryClient();
  const empId = empreendimento.id;

  const { data: estimativas = [], isLoading } = useQuery<EstimativaCusto[]>({
    queryKey: ["estimativas", empId],
    queryFn: () => empreendimentosApi.listarEstimativas(empId),
  });

  const gerar = useMutation({
    mutationFn: () => empreendimentosApi.gerarEstimativa(empId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estimativas", empId] }),
    onError: (e: any) => {
      const msg = e?.response?.data?.detail ?? "Erro ao gerar estimativa.";
      alert(msg);
    },
  });

  const semDados =
    !empreendimento.num_unidades ||
    !empreendimento.metragem_media_unidade ||
    !empreendimento.padrao_construtivo;

  return (
    <div className="space-y-4">
      {/* Cabeçalho da seção */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Sparkles size={15} className="text-brand-500" />
            Estimativa de Custos IA
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Estimativa paramétrica gerada pelo Gemini com base nos dados do empreendimento
          </p>
        </div>
        <button
          onClick={() => gerar.mutate()}
          disabled={gerar.isPending || semDados}
          title={semDados ? "Preencha nº de unidades, metragem média e padrão construtivo antes de estimar" : "Gerar nova estimativa"}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            semDados
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-brand-600 text-white hover:bg-brand-700"
          )}
        >
          {gerar.isPending
            ? <><Loader2 size={14} className="animate-spin" /> Gerando…</>
            : <><Sparkles size={14} /> Nova estimativa</>
          }
        </button>
      </div>

      {/* Aviso: dados incompletos com CTA */}
      {semDados && (() => {
        const faltantes: string[] = [];
        if (!empreendimento.num_unidades)          faltantes.push("nº de unidades");
        if (!empreendimento.metragem_media_unidade) faltantes.push("metragem média por unidade");
        if (!empreendimento.padrao_construtivo)    faltantes.push("padrão construtivo");
        return (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="font-semibold mb-0.5">Dados insuficientes para gerar a estimativa</p>
              <p className="text-xs text-amber-800">
                Preencha {" "}
                {faltantes.map((c, i) => (
                  <span key={c}>
                    <strong>{c}</strong>{i < faltantes.length - 1 ? (i === faltantes.length - 2 ? " e " : ", ") : ""}
                  </span>
                ))}{" "}
                no cadastro para que a IA possa estimar o custo paramétrico.
              </p>
            </div>
            {onEditar && (
              <button
                onClick={() => onEditar(faltantes)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95 shrink-0"
              >
                <Pencil size={12} />
                Editar agora
              </button>
            )}
          </div>
        );
      })()}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
          <Loader2 size={16} className="animate-spin" /> Carregando estimativas…
        </div>
      )}

      {/* Estimativas */}
      {!isLoading && estimativas.length === 0 && (
        <div className="flex flex-col items-center py-10 text-slate-400">
          <Sparkles size={32} className="mb-2 opacity-30" />
          <p className="text-sm font-medium">Nenhuma estimativa gerada</p>
          <p className="text-xs mt-1">Clique em "Nova estimativa" para gerar a primeira análise</p>
        </div>
      )}

      {estimativas.map(est => (
        <EstimativaCard
          key={est.id}
          est={est}
          empId={empId}
          onDeleted={() => {}}
        />
      ))}
    </div>
  );
}
