import { Building2, MapPin, Pencil, Trash2, Home, Ruler, TrendingUp, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import type { EmpreendimentoResponse } from "@/types";
import { clsx } from "clsx";

// ── helpers ────────────────────────────────────────────────────────────────────

const TIPO_ICONE: Record<string, string> = {
  residencial_vertical:   "🏢",
  residencial_horizontal: "🏘️",
  comercial:              "🏪",
  misto:                  "🏙️",
  infraestrutura:         "🏗️",
};

// gradiente no topo por status
const STATUS_GRADIENT: Record<string, string> = {
  estudo:      "from-slate-400 to-slate-500",
  viabilidade: "from-sky-400 to-brand-500",
  aprovacao:   "from-amber-400 to-orange-500",
  em_obras:    "from-brand-500 to-violet-500",
  entregue:    "from-emerald-400 to-teal-500",
  cancelado:   "from-red-400 to-red-500",
};

function formatarVGV(valor: number | null): string {
  if (!valor) return "—";
  if (valor >= 1_000_000) return `R$ ${(valor / 1_000_000).toFixed(1)}M`;
  if (valor >= 1_000) return `R$ ${(valor / 1_000).toFixed(0)}K`;
  return `R$ ${valor.toFixed(0)}`;
}

interface Props {
  emp: EmpreendimentoResponse;
  onEditar: (emp: EmpreendimentoResponse) => void;
  onExcluir: (emp: EmpreendimentoResponse) => void;
}

export function EmpreendimentoCard({ emp, onEditar, onExcluir }: Props) {
  const navigate = useNavigate();
  const gradient = STATUS_GRADIENT[emp.status] ?? "from-slate-400 to-slate-500";

  return (
    <div
      className={clsx(
        "card card-hover flex flex-col overflow-hidden cursor-pointer group relative",
      )}
      onClick={() => navigate(`/empreendimentos/${emp.id}`)}
    >
      {/* Faixa gradiente no topo por status */}
      <div className={`h-[3px] bg-gradient-to-r ${gradient} w-full`} />

      <div className="p-5 flex flex-col gap-3.5">

        {/* Ações: Editar / Excluir — visíveis no hover */}
        <div
          className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onEditar(emp); }}
            title="Editar empreendimento"
            className="p-1.5 rounded-lg bg-white/90 backdrop-blur-sm border border-slate-200/80
                       text-slate-500 hover:text-brand-600 hover:bg-brand-50 hover:border-brand-200
                       shadow-sm transition-all active:scale-95"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onExcluir(emp); }}
            title="Excluir empreendimento"
            className="p-1.5 rounded-lg bg-white/90 backdrop-blur-sm border border-slate-200/80
                       text-slate-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200
                       shadow-sm transition-all active:scale-95"
          >
            <Trash2 size={13} />
          </button>
        </div>

        {/* Cabeçalho */}
        <div className="flex items-start gap-3 pr-20">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-lg shrink-0 shadow-sm`}>
            <span>{TIPO_ICONE[emp.tipo] ?? "🏗️"}</span>
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-800 leading-snug truncate group-hover:text-brand-600 transition-colors">
              {emp.nome}
            </h3>
            <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
              <MapPin size={10} />
              {emp.endereco.cidade}, {emp.endereco.uf}
              {emp.endereco.bairro && ` · ${emp.endereco.bairro}`}
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          <Badge value={emp.status} />
          <Badge value={emp.tipo} />
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100">
          <div className="bg-slate-50 rounded-xl p-2.5">
            <p className="text-[10px] text-slate-400 font-medium">VGV Previsto</p>
            <p className="text-sm font-bold text-slate-700 mt-0.5">{formatarVGV(emp.vgv_previsto)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-2.5">
            <p className="text-[10px] text-slate-400 font-medium">Obras</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Building2 size={12} className="text-brand-400" />
              <p className="text-sm font-bold text-slate-700">{emp.total_obras}</p>
            </div>
          </div>
        </div>

        {/* Dados extras — Residencial Vertical */}
        {emp.tipo === "residencial_vertical" && (emp.num_unidades || emp.area_terreno_m2 || emp.valor_terreno) && (
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
            {emp.num_unidades != null && (
              <div className="flex items-center gap-1.5">
                <Home size={11} className="text-sky-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 leading-none">Unidades</p>
                  <p className="text-xs font-bold text-slate-700">{emp.num_unidades}</p>
                </div>
              </div>
            )}
            {emp.area_terreno_m2 != null && (
              <div className="flex items-center gap-1.5">
                <Ruler size={11} className="text-emerald-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 leading-none">Terreno</p>
                  <p className="text-xs font-bold text-slate-700">
                    {emp.area_terreno_m2.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} m²
                  </p>
                </div>
              </div>
            )}
            {emp.valor_terreno && emp.vgv_previsto && emp.vgv_previsto > 0 && (
              <div className="flex items-center gap-1.5">
                <TrendingUp size={11} className="shrink-0 text-violet-400" />
                <div>
                  <p className="text-[10px] text-slate-400 leading-none">T/VGV</p>
                  <p className={clsx("text-xs font-bold", (() => {
                    const p = (emp.valor_terreno / emp.vgv_previsto) * 100;
                    return p <= 20 ? "text-emerald-600" : p <= 30 ? "text-amber-600" : "text-red-600";
                  })())}>
                    {((emp.valor_terreno / emp.vgv_previsto) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pipeline info se preenchida */}
        {(emp.probabilidade != null || emp.parceiro) && (
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100 flex-wrap">
            {emp.probabilidade != null && (
              <span className="inline-flex items-center gap-1 text-xs text-violet-600 font-semibold bg-violet-50 px-2 py-0.5 rounded-full">
                <TrendingUp size={10} /> {emp.probabilidade}%
              </span>
            )}
            {emp.parceiro && (
              <span className="text-xs text-slate-400 truncate">🤝 {emp.parceiro}</span>
            )}
          </div>
        )}

        {/* Ações rápidas: Centro de Custo */}
        <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
          {emp.primary_obra_id ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/obras/${emp.primary_obra_id}?tab=centro-custo`);
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl
                         text-xs font-bold text-white
                         bg-gradient-to-r from-emerald-500 to-teal-600
                         hover:from-emerald-600 hover:to-teal-700
                         shadow-sm hover:shadow-md transition-all active:scale-95"
            >
              <Wallet size={13} />
              Centro de Custo
            </button>
          ) : (
            <button
              disabled
              title="Cadastre uma obra para acessar o Centro de Custo"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl
                         text-xs font-bold text-slate-400 bg-slate-50 border border-slate-200
                         cursor-not-allowed"
              onClick={(e) => e.stopPropagation()}
            >
              <Wallet size={13} />
              Centro de Custo · sem obra
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
