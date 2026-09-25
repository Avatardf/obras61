import { AlertTriangle } from "lucide-react";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Retorna true quando o valor negociado fica abaixo do valor de venda. */
export function abaixoDoValorDeVenda(negociado: number | null | undefined, valorVenda: number | null | undefined): boolean {
  return negociado != null && valorVenda != null && valorVenda > 0 && negociado < valorVenda;
}

interface Props {
  valorVenda: number;
  valorNegociado: number;
  onConfirmar: () => void;
  onRevisar: () => void;
}

/**
 * Popup de alerta quando o valor negociado fica abaixo do valor de venda.
 * O corretor pode seguir, mas precisa confirmar o desconto de forma explícita.
 */
export function ConfirmacaoDesconto({ valorVenda, valorNegociado, onConfirmar, onRevisar }: Props) {
  const desconto = valorVenda - valorNegociado;
  const pct = (desconto / valorVenda) * 100;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border-2 border-amber-400">
        <div className="bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-4 flex items-center gap-3">
          <div className="p-2 rounded-full bg-white/25">
            <AlertTriangle size={22} className="text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Valor abaixo do valor de venda</h3>
            <p className="text-xs text-white/90">Confirme antes de registrar o desconto</p>
          </div>
        </div>

        <div className="px-5 py-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Valor de venda</span>
            <span className="font-medium text-slate-700 tabular-nums">{brl(valorVenda)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Valor negociado</span>
            <span className="font-medium text-slate-700 tabular-nums">{brl(valorNegociado)}</span>
          </div>
          <div className="flex justify-between border-t border-amber-200 pt-2 bg-amber-50 -mx-5 px-5 py-2">
            <span className="font-semibold text-amber-800">Desconto</span>
            <span className="font-bold text-amber-800 tabular-nums">
              {brl(desconto)} ({pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)
            </span>
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onRevisar}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
            Revisar valor
          </button>
          <button onClick={onConfirmar}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-amber-500 rounded-lg hover:bg-amber-600">
            Confirmar desconto
          </button>
        </div>
      </div>
    </div>
  );
}
