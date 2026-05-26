/**
 * ConfirmarExclusaoModal — confirmação em 2 etapas antes de mover
 * o empreendimento para a Lixeira. Cores fortes (amber → red) e exige
 * digitar o nome do empreendimento na 2ª etapa para evitar acidentes.
 */
import { AlertTriangle, Trash2, X, ShieldAlert, ArrowRight } from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";
import type { EmpreendimentoResponse } from "@/types";

interface Props {
  emp: EmpreendimentoResponse;
  onCancelar: () => void;
  onConfirmar: () => void;
  loading?: boolean;
}

export function ConfirmarExclusaoModal({ emp, onCancelar, onConfirmar, loading }: Props) {
  const [passo, setPasso] = useState<1 | 2>(1);
  const [textoConfirma, setTextoConfirma] = useState("");

  const textoCorreto = textoConfirma.trim().toLowerCase() === emp.nome.trim().toLowerCase();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCancelar} />

      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-slide-in">

        {/* ── Passo 1: aviso amarelo ───────────────────────────────────── */}
        {passo === 1 && (
          <>
            <div className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 border-b border-amber-200">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <AlertTriangle size={22} className="text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-800 text-lg">
                    Excluir empreendimento?
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Você está prestes a excluir <strong className="text-amber-700">{emp.nome}</strong>.
                  </p>
                </div>
                <button onClick={onCancelar}
                  className="p-1 rounded-lg hover:bg-white/50 text-slate-500">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-3">
              <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-lg px-4 py-3">
                <p className="text-sm text-amber-900 leading-relaxed">
                  <strong>📦 O que vai acontecer:</strong>
                </p>
                <ul className="text-xs text-amber-800 mt-2 space-y-1 ml-1">
                  <li>• O empreendimento será movido para a <strong>Lixeira</strong></li>
                  <li>• <strong>Todos os dados serão preservados</strong> (obras, etapas, financeiro, RDOs, orçamentos)</li>
                  <li>• Você poderá <strong>restaurar a qualquer momento</strong> na aba Lixeira</li>
                  <li>• Após restaurado, tudo volta ao estado anterior</li>
                </ul>
              </div>

              {emp.total_obras > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                  <p className="text-xs text-blue-800">
                    ℹ️ Este empreendimento possui <strong>{emp.total_obras} obra{emp.total_obras !== 1 ? "s" : ""}</strong>.
                    Elas continuam acessíveis enquanto o empreendimento estiver na Lixeira.
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 pb-6 flex items-center gap-2 justify-end">
              <button onClick={onCancelar}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                Cancelar
              </button>
              <button onClick={() => setPasso(2)}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-95">
                <ArrowRight size={14} />
                Continuar
              </button>
            </div>
          </>
        )}

        {/* ── Passo 2: confirmação final em vermelho ────────────────── */}
        {passo === 2 && (
          <>
            <div className="p-6 bg-gradient-to-br from-red-50 to-rose-50 border-b border-red-200">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <ShieldAlert size={22} className="text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-800 text-lg">
                    Confirme a exclusão
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Última etapa de segurança. Digite o nome do empreendimento abaixo.
                  </p>
                </div>
                <button onClick={onCancelar}
                  className="p-1 rounded-lg hover:bg-white/50 text-slate-500">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-red-50 border-l-4 border-red-500 rounded-r-lg px-4 py-3">
                <p className="text-sm text-red-900 font-semibold leading-relaxed">
                  ⚠️ Eu, usuário, declaro que:
                </p>
                <ul className="text-xs text-red-800 mt-2 space-y-1 ml-1">
                  <li>✓ Entendo que o empreendimento <strong>"{emp.nome}"</strong> será excluído</li>
                  <li>✓ Sei que ele ficará na <strong>Lixeira</strong> e pode ser restaurado</li>
                  <li>✓ Estou ciente de que esta ação afeta dados conectados</li>
                </ul>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                  Para confirmar, digite o nome do empreendimento:
                </label>
                <div className="bg-slate-50 rounded-lg px-3 py-2 mb-2 font-mono text-sm text-slate-700 border border-slate-200">
                  {emp.nome}
                </div>
                <input
                  type="text"
                  autoFocus
                  value={textoConfirma}
                  onChange={(e) => setTextoConfirma(e.target.value)}
                  placeholder="Digite aqui exatamente como acima…"
                  className={clsx(
                    "w-full px-3 py-2 border-2 rounded-lg text-sm outline-none transition-colors",
                    textoCorreto
                      ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                      : "border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-300"
                  )}
                />
                {textoCorreto && (
                  <p className="text-xs text-emerald-700 mt-1.5 font-semibold">
                    ✓ Confirmação válida — pode prosseguir
                  </p>
                )}
              </div>
            </div>

            <div className="px-6 pb-6 flex items-center gap-2 justify-end">
              <button onClick={() => setPasso(1)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                ← Voltar
              </button>
              <button
                onClick={onConfirmar}
                disabled={!textoCorreto || loading}
                className={clsx(
                  "flex items-center gap-2 px-5 py-2.5 font-bold text-sm rounded-xl shadow-md transition-all",
                  textoCorreto && !loading
                    ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white active:scale-95"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                )}>
                <Trash2 size={14} />
                {loading ? "Excluindo…" : "Mover para a Lixeira"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
