import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle, ChevronDown, ChevronRight, ExternalLink,
  Info, Loader2, MoreVertical, Save, X, Lock,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { clsx } from "clsx";
import { centroCustoApi } from "@/api/client";
import type {
  CCCategoria, CCItem, CentroCustoResponse,
} from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────────────

function moeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function moedaCurto(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(0)}K`;
  return moeda(v);
}

// ─────────────────────────────────────────────────────────────────────────────
// Origem badge + color tokens
// ─────────────────────────────────────────────────────────────────────────────

const ORIGEM_STYLE: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  empreendimento: { bg: "bg-violet-50",   text: "text-violet-700",  icon: "🏢", label: "Empreendimento" },
  orcamento:      { bg: "bg-sky-50",      text: "text-sky-700",     icon: "📋", label: "Orçamento" },
  financeiro:     { bg: "bg-emerald-50",  text: "text-emerald-700", icon: "💵", label: "Financeiro" },
  suprimentos:    { bg: "bg-orange-50",   text: "text-orange-700",  icon: "🛒", label: "Suprimentos" },
  manual:         { bg: "bg-slate-50",    text: "text-slate-600",   icon: "✏️", label: "Manual" },
};

function OrigemBadge({
  modulo, onClick, clickable,
}: {
  modulo: string;
  onClick?: (e: React.MouseEvent) => void;
  clickable?: boolean;
}) {
  const s = ORIGEM_STYLE[modulo] ?? ORIGEM_STYLE.manual;
  const Tag: any = clickable ? "button" : "span";
  return (
    <Tag
      type={clickable ? "button" : undefined}
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full transition-all",
        s.bg, s.text,
        clickable && "cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-current/30 active:scale-95"
      )}
      title={clickable ? "Clique para ver/editar a origem" : undefined}
    >
      <span>{s.icon}</span>
      {s.label}
    </Tag>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Disclaimer Modal (mostra quando o usuário clica em um campo "linkado")
// ─────────────────────────────────────────────────────────────────────────────

function DisclaimerModal({
  item, onClose,
}: { item: CCItem; onClose: () => void }) {
  const navigate = useNavigate();
  const s = ORIGEM_STYLE[item.origem.modulo] ?? ORIGEM_STYLE.manual;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-slide-in">
        {/* Header */}
        <div className={clsx("p-5 flex items-start gap-3", s.bg)}>
          <div className="text-3xl">{s.icon}</div>
          <div className="flex-1 min-w-0">
            <div className={clsx("text-xs font-semibold uppercase tracking-wide", s.text)}>
              Dado vinculado · {s.label}
            </div>
            <h3 className="font-bold text-slate-800 mt-0.5">
              {item.codigo} — {item.nome}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/50 text-slate-500">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="flex gap-3">
            <Info size={18} className="text-brand-500 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-600 leading-relaxed">
              {item.origem.descricao}
            </p>
          </div>

          {/* Valores atuais */}
          <div className="bg-slate-50 rounded-xl p-3.5 grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Orçado</p>
              <p className="text-sm font-bold text-slate-800 mt-0.5">{moeda(item.valor_orcado)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Contratado</p>
              <p className="text-sm font-bold text-slate-800 mt-0.5">{moeda(item.valor_contratado)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Executado</p>
              <p className="text-sm font-bold text-emerald-700 mt-0.5">{moeda(item.valor_executado)}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex items-center gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Fechar
          </button>
          {item.origem.rota && (
            <button
              onClick={() => { onClose(); navigate(item.origem.rota!); }}
              className="btn-primary"
            >
              <ExternalLink size={14} />
              {item.origem.label ?? "Ir para origem"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline editor (para itens com origem='manual')
// ─────────────────────────────────────────────────────────────────────────────

function InlineEditor({
  item, obraId, onClose,
}: { item: CCItem; obraId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [orcado, setOrcado]         = useState(item.valor_orcado);
  const [contratado, setContratado] = useState(item.valor_contratado);
  const [executado, setExecutado]   = useState(item.valor_executado);
  const [obs, setObs]               = useState(item.observacao ?? "");

  const mutation = useMutation({
    mutationFn: () => centroCustoApi.salvar(obraId, item.codigo, {
      valor_orcado: orcado, valor_contratado: contratado,
      valor_executado: executado, observacao: obs || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["centro-custo", obraId] });
      onClose();
    },
  });

  return (
    <tr className="bg-amber-50/40">
      <td colSpan={6} className="px-3 py-3">
        <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">
              ✏️ Editar lançamento manual
            </span>
            <span className="text-xs text-slate-500">— {item.codigo} {item.nome}</span>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wide block mb-1">
                Orçado (R$)
              </label>
              <input
                type="number" min="0" step="100"
                value={orcado}
                onChange={(e) => setOrcado(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wide block mb-1">
                Contratado (R$)
              </label>
              <input
                type="number" min="0" step="100"
                value={contratado}
                onChange={(e) => setContratado(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wide block mb-1">
                Executado (R$)
              </label>
              <input
                type="number" min="0" step="100"
                value={executado}
                onChange={(e) => setExecutado(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wide block mb-1">
              Observação
            </label>
            <input
              type="text"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Ex.: Comissão 4% sobre VGV — pagto na entrega das chaves"
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {mutation.isPending
                ? <Loader2 size={12} className="animate-spin" />
                : <Save size={12} />}
              Salvar
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Linha do item
// ─────────────────────────────────────────────────────────────────────────────

function ItemRow({
  item, obraId,
  onShowDisclaimer, onEdit, editing,
}: {
  item: CCItem; obraId: string;
  onShowDisclaimer: (item: CCItem) => void;
  onEdit: (codigo: string | null) => void;
  editing: boolean;
}) {
  const isLinked = !item.editavel_inline;
  const semDados = item.valor_orcado === 0 && item.valor_contratado === 0 && item.valor_executado === 0;

  const handleCellClick = () => {
    if (isLinked) onShowDisclaimer(item);
    else onEdit(item.codigo);
  };

  return (
    <>
      <tr className={clsx(
        "border-b border-slate-100 hover:bg-slate-50/50 transition-colors group",
        editing && "bg-amber-50/30"
      )}>
        <td className="px-3 py-2 text-xs text-slate-400 font-mono tabular-nums">
          {item.codigo}
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-slate-700">{item.nome}</span>
            <OrigemBadge
              modulo={item.origem.modulo}
              clickable={isLinked}
              onClick={(e) => { e.stopPropagation(); if (isLinked) onShowDisclaimer(item); }}
            />
            {isLinked && <Lock size={10} className="text-slate-300" />}
          </div>
          {item.observacao && (
            <p className="text-[11px] text-slate-400 mt-0.5 italic">{item.observacao}</p>
          )}
        </td>

        {/* Orçado */}
        <td
          onClick={handleCellClick}
          className={clsx(
            "px-3 py-2 text-right text-sm tabular-nums cursor-pointer transition-colors",
            isLinked ? "hover:bg-violet-50" : "hover:bg-amber-50",
            semDados ? "text-slate-300" : "font-semibold text-slate-700"
          )}
        >
          {semDados ? "—" : moedaCurto(item.valor_orcado)}
        </td>

        {/* Contratado */}
        <td
          onClick={handleCellClick}
          className={clsx(
            "px-3 py-2 text-right text-sm tabular-nums cursor-pointer transition-colors",
            isLinked ? "hover:bg-violet-50" : "hover:bg-amber-50",
            item.valor_contratado === 0 ? "text-slate-300" : "font-semibold text-slate-700"
          )}
        >
          {item.valor_contratado === 0 ? "—" : moedaCurto(item.valor_contratado)}
        </td>

        {/* Executado */}
        <td
          onClick={handleCellClick}
          className={clsx(
            "px-3 py-2 text-right text-sm tabular-nums cursor-pointer transition-colors",
            isLinked ? "hover:bg-violet-50" : "hover:bg-amber-50",
            item.valor_executado === 0 ? "text-slate-300" : "font-bold text-emerald-700"
          )}
        >
          {item.valor_executado === 0 ? "—" : moedaCurto(item.valor_executado)}
        </td>

        {/* Saldo + % exec */}
        <td className="px-3 py-2 text-right text-sm tabular-nums">
          {item.valor_orcado === 0 ? (
            <span className="text-slate-300">—</span>
          ) : (
            <div className="flex flex-col items-end">
              <span className={clsx("font-semibold text-xs",
                item.saldo < 0 ? "text-red-600" : "text-slate-600"
              )}>
                {moedaCurto(item.saldo)}
              </span>
              <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden mt-0.5">
                <div className={clsx("h-full rounded-full",
                  item.perc_executado >= 100 ? "bg-emerald-500" :
                  item.perc_executado >= 80  ? "bg-amber-500" : "bg-brand-500",
                )} style={{ width: `${Math.min(item.perc_executado, 100)}%` }} />
              </div>
              <span className="text-[9px] text-slate-400 mt-0.5">
                {item.perc_executado.toFixed(0)}% exec.
              </span>
            </div>
          )}
        </td>
      </tr>

      {editing && (
        <InlineEditor item={item} obraId={obraId} onClose={() => onEdit(null)} />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bloco da Categoria
// ─────────────────────────────────────────────────────────────────────────────

function CategoriaBlock({
  cat, obraId, onShowDisclaimer, editingCode, onEdit,
}: {
  cat: CCCategoria; obraId: string;
  onShowDisclaimer: (item: CCItem) => void;
  editingCode: string | null;
  onEdit: (codigo: string | null) => void;
}) {
  const [aberto, setAberto] = useState(true);
  const temDados = cat.total_orcado > 0 || cat.total_executado > 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header da categoria */}
      <button
        onClick={() => setAberto(v => !v)}
        className={clsx(
          "w-full px-4 py-3 flex items-center gap-3 transition-colors",
          temDados ? "bg-gradient-to-r from-slate-50 to-white" : "bg-white",
          "hover:bg-slate-50"
        )}
      >
        {aberto ? <ChevronDown size={16} className="text-slate-400" />
                : <ChevronRight size={16} className="text-slate-400" />}
        <span className="text-lg">{cat.icone}</span>
        <span className="font-bold text-slate-700 text-sm tracking-wide flex-1 text-left">
          {cat.codigo} — {cat.nome}
        </span>
        <span className="text-xs text-slate-400">{cat.itens.length} itens</span>
        <div className="hidden md:flex items-center gap-4 text-right">
          <div>
            <p className="text-[9px] text-slate-400 font-bold uppercase">Orçado</p>
            <p className="text-xs font-bold text-slate-700">{moedaCurto(cat.total_orcado)}</p>
          </div>
          <div>
            <p className="text-[9px] text-slate-400 font-bold uppercase">Executado</p>
            <p className="text-xs font-bold text-emerald-700">{moedaCurto(cat.total_executado)}</p>
          </div>
        </div>
      </button>

      {aberto && cat.itens.length > 0 && (
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-slate-400 font-bold border-y border-slate-100 bg-slate-50/50">
              <th className="px-3 py-2 text-left w-14">Cód.</th>
              <th className="px-3 py-2 text-left">Item</th>
              <th className="px-3 py-2 text-right w-28">Orçado</th>
              <th className="px-3 py-2 text-right w-28">Contratado</th>
              <th className="px-3 py-2 text-right w-28">Executado</th>
              <th className="px-3 py-2 text-right w-28">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {cat.itens.map(item => (
              <ItemRow
                key={item.codigo} item={item} obraId={obraId}
                onShowDisclaimer={onShowDisclaimer}
                onEdit={onEdit}
                editing={editingCode === item.codigo}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRE da SPE/Parceria (Parte 3 da planilha)
// ─────────────────────────────────────────────────────────────────────────────

function DREPanel({ data }: { data: CentroCustoResponse }) {
  const d = data.dre;
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-r from-violet-50 to-brand-50 border-b border-slate-200">
        <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
          <span className="text-base">📊</span>
          Resultado da {data.tipo_obra === "parceria" ? "SPE/Parceria" : "Obra"}
          {data.tipo_obra === "parceria" && data.parceiro && (
            <span className="text-xs font-normal text-slate-500">· com {data.parceiro}</span>
          )}
        </h3>
      </div>
      <div className="p-4 space-y-2 text-sm">
        <Linha label="VGV Total — Receita Bruta SPE" valor={d.vgv_total} />
        <Linha label="(−) Impostos — RET, ISS"        valor={-d.impostos_total} indent />
        <Linha label="(=) Receita Líquida"            valor={d.receita_liquida} bold />
        <Linha label="(−) Custos Diretos da Obra"     valor={-d.custos_diretos_total} indent />
        <div className="my-2 border-t border-slate-200" />
        <Linha label="(=) LUCRO BRUTO DA SPE"         valor={d.lucro_bruto_spe} bold positiveGreen />
        <Linha label={`Percentual 61 Brasil na parceria`}
               valorTxt={`${d.percentual_61_brasil.toFixed(0)}%`} indent />
        <div className="my-2 border-t border-slate-200" />
        <Linha label="(=) RESULTADO 61 BRASIL nesta obra"
               valor={d.resultado_61_brasil} bold positiveGreen highlight />

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-[10px] text-slate-400 font-bold uppercase">Margem Bruta SPE</p>
            <p className={clsx("text-lg font-bold mt-0.5",
              d.margem_bruta_spe >= 20 ? "text-emerald-700"
              : d.margem_bruta_spe >= 10 ? "text-amber-700" : "text-red-700"
            )}>
              {d.margem_bruta_spe.toFixed(1)}%
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-[10px] text-slate-400 font-bold uppercase">Resultado / VGV</p>
            <p className={clsx("text-lg font-bold mt-0.5",
              d.resultado_sobre_vgv >= 15 ? "text-emerald-700"
              : d.resultado_sobre_vgv >= 8 ? "text-amber-700" : "text-red-700"
            )}>
              {d.resultado_sobre_vgv.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Linha({
  label, valor, valorTxt, bold, indent, positiveGreen, highlight,
}: {
  label: string; valor?: number; valorTxt?: string;
  bold?: boolean; indent?: boolean; positiveGreen?: boolean; highlight?: boolean;
}) {
  const v = valor ?? 0;
  return (
    <div className={clsx(
      "flex items-center justify-between",
      highlight && "bg-gradient-to-r from-emerald-50 to-brand-50 rounded-lg px-3 py-2 -mx-2"
    )}>
      <span className={clsx(
        bold ? "font-bold text-slate-800" : "text-slate-600",
        indent && "pl-3 text-xs"
      )}>{label}</span>
      <span className={clsx(
        "tabular-nums",
        bold ? "font-bold" : "",
        positiveGreen && v > 0 ? "text-emerald-700" : v < 0 ? "text-red-600" : "text-slate-700"
      )}>
        {valorTxt ?? moeda(v)}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component principal
// ─────────────────────────────────────────────────────────────────────────────

export function CentroCustoTab({ obraId }: { obraId: string }) {
  const [disclaimerItem, setDisclaimerItem] = useState<CCItem | null>(null);
  const [editingCode,    setEditingCode]    = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<CentroCustoResponse>({
    queryKey: ["centro-custo", obraId],
    queryFn: () => centroCustoApi.obter(obraId),
  });

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1,2,3].map(i => (
          <div key={i} className="h-20 bg-white rounded-xl border border-slate-200" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-6 text-center text-red-600">
        <AlertCircle size={24} className="mx-auto mb-2" />
        Erro ao carregar Centro de Custo
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Header informativo */}
      <div className="bg-gradient-to-r from-brand-50 via-violet-50 to-emerald-50 rounded-xl border border-slate-200 p-4">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-brand-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs text-slate-600 leading-relaxed">
            <p className="font-semibold text-slate-700 mb-1">Como funciona o Centro de Custo</p>
            <p>
              Cada linha mostra <strong>de onde vêm</strong> os valores: <OrigemBadge modulo="empreendimento" />
              <OrigemBadge modulo="orcamento" /> <OrigemBadge modulo="financeiro" />
              <OrigemBadge modulo="suprimentos" /> <OrigemBadge modulo="manual" />.
            </p>
            <p className="mt-1.5">
              <strong>Campos com cadeado 🔒</strong> são alimentados automaticamente por outros módulos —
              ao clicar você verá um aviso e o atalho para editar na origem.{" "}
              <strong>Campos manuais ✏️</strong> podem ser editados diretamente aqui.
            </p>
          </div>
        </div>
      </div>

      {/* Resumo geral */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ResumoCard label="VGV Estimado"      valor={data.vgv_estimado ?? 0} cor="text-violet-700" />
        <ResumoCard label="Custo Orçado Total" valor={data.custo_orcado_total} cor="text-brand-700" />
        <ResumoCard label="Executado"
                    valor={data.categorias.reduce((s, c) => s + c.total_executado, 0)}
                    cor="text-emerald-700" />
        <ResumoCard label="Resultado 61 Brasil"
                    valor={data.dre.resultado_61_brasil}
                    cor={data.dre.resultado_61_brasil > 0 ? "text-emerald-700" : "text-red-600"} />
      </div>

      {/* Layout: 14 categorias + DRE lateral */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {data.categorias.map(cat => (
            <CategoriaBlock
              key={cat.codigo} cat={cat} obraId={obraId}
              onShowDisclaimer={setDisclaimerItem}
              editingCode={editingCode}
              onEdit={setEditingCode}
            />
          ))}
        </div>

        <div className="space-y-3">
          <DREPanel data={data} />
        </div>
      </div>

      {/* Modal de disclaimer */}
      {disclaimerItem && (
        <DisclaimerModal
          item={disclaimerItem}
          onClose={() => setDisclaimerItem(null)}
        />
      )}
    </div>
  );
}

function ResumoCard({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{label}</p>
      <p className={clsx("text-xl font-bold mt-1 tabular-nums", cor)}>
        {valor === 0 ? "—" : moedaCurto(valor)}
      </p>
    </div>
  );
}
