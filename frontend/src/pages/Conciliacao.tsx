import React, { useCallback, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle, ArrowRight, Banknote, Check, CheckCircle2,
  ChevronRight, CloudUpload, FileText, Info, Loader2,
  RefreshCw, ScanLine, SkipForward, Unlink, X, XCircle,
} from "lucide-react";
import clsx from "clsx";
import {
  conciliacaoApi, financeiroApi,
  type OFXParseResult, type TransacaoOFX,
} from "@/api/client";

// ── Tipos internos ────────────────────────────────────────────────────────────

interface Lancamento {
  id: string;
  tipo: string;
  categoria: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string;
}

type MatchStatus = "confirmado" | "ignorado" | "pendente";

interface RowState {
  status: MatchStatus;
  lancamentoId: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BANCOS: Record<string, string> = {
  "0104": "Caixa Econômica Federal",
  "001":  "Banco do Brasil",
  "237":  "Bradesco",
  "341":  "Itaú",
  "033":  "Santander",
  "260":  "Nubank",
};

function nomeBanco(bankid: string) {
  return BANCOS[bankid] || `Banco ${bankid}`;
}

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function fmtData(s: string) {
  if (!s || s === "0000-00-00") return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

const CATEGORIAS_IGNORAR = ["resg_aut", "tarifa"];

const CATEG_BADGE: Record<string, { label: string; cls: string }> = {
  resg_aut:  { label: "Resg. Auto.",  cls: "bg-slate-100 text-slate-500" },
  tarifa:    { label: "Tarifa",       cls: "bg-slate-100 text-slate-500" },
  pix:       { label: "PIX",          cls: "bg-blue-100 text-blue-700"   },
  boleto:    { label: "Boleto",       cls: "bg-orange-100 text-orange-700" },
  pagamento: { label: "Pagamento",    cls: "bg-purple-100 text-purple-700" },
  outro:     { label: "Outro",        cls: "bg-slate-100 text-slate-600"  },
};

// Auto-match: tenta casar cada transação OFX com um lançamento do sistema
function autoMatch(
  transacoes: TransacaoOFX[],
  lancamentos: Lancamento[],
): Map<string, RowState> {
  const used = new Set<string>();
  const result = new Map<string, RowState>();

  for (const tx of transacoes) {
    // Internas/tarifas → ignorar automaticamente
    if (CATEGORIAS_IGNORAR.includes(tx.categoria)) {
      result.set(tx.fitid, { status: "ignorado", lancamentoId: null });
      continue;
    }

    const txDate   = new Date(tx.data);
    const txAbs    = Math.abs(tx.valor);
    const txTipo   = tx.valor < 0 ? "despesa" : "receita";

    let bestId: string | null = null;
    let bestScore = 0;

    for (const lanc of lancamentos) {
      if (used.has(lanc.id)) continue;
      if (lanc.tipo !== txTipo)  continue;
      if (lanc.status === "cancelado") continue;

      const lancDate  = new Date(lanc.data_vencimento);
      const daysDiff  = Math.abs((txDate.getTime() - lancDate.getTime()) / 86_400_000);
      if (daysDiff > 10) continue;

      const ref      = Math.max(txAbs, lanc.valor, 0.01);
      const valDiff  = Math.abs(txAbs - lanc.valor) / ref;
      if (valDiff > 0.03) continue; // tolerância 3%

      const score = (1 - daysDiff / 10) * 0.4 + (1 - valDiff / 0.03) * 0.6;
      if (score > bestScore) { bestScore = score; bestId = lanc.id; }
    }

    if (bestId) {
      used.add(bestId);
      result.set(tx.fitid, { status: "confirmado", lancamentoId: bestId });
    } else {
      result.set(tx.fitid, { status: "pendente", lancamentoId: null });
    }
  }

  return result;
}

// ── Step 1: Upload ─────────────────────────────────────────────────────────────

function UploadStep({ onParsed }: { onParsed: (r: OFXParseResult) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: conciliacaoApi.upload,
    onSuccess: onParsed,
    onError: (e: any) => setErro(e?.response?.data?.detail ?? "Erro ao processar arquivo."),
  });

  const processFile = useCallback((file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".ofx")) {
      setErro("Selecione um arquivo .ofx válido.");
      return;
    }
    setErro(null);
    mutation.mutate(file);
  }, [mutation]);

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8">
      <div className="w-full max-w-xl">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center">
            <ScanLine size={20} className="text-cyan-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-100">Conciliação Bancária</h1>
            <p className="text-sm text-slate-400">Importe o extrato OFX e vincule com os lançamentos do sistema</p>
          </div>
        </div>

        {/* Drop zone */}
        <div
          className={clsx(
            "relative border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-4 transition-all cursor-pointer",
            dragging
              ? "border-cyan-400 bg-cyan-400/5"
              : "border-slate-700 hover:border-slate-500 bg-slate-800/40",
            mutation.isPending && "pointer-events-none opacity-60",
          )}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault();
            setDragging(false);
            processFile(e.dataTransfer.files[0] ?? null);
          }}
        >
          {mutation.isPending ? (
            <Loader2 size={32} className="text-cyan-400 animate-spin" />
          ) : (
            <CloudUpload size={32} className={dragging ? "text-cyan-400" : "text-slate-500"} />
          )}
          <div className="text-center">
            <p className="font-medium text-slate-200">
              {mutation.isPending ? "Processando…" : "Arraste o arquivo OFX aqui"}
            </p>
            <p className="text-sm text-slate-500 mt-1">ou clique para selecionar</p>
          </div>
          <span className="px-3 py-1 rounded-lg bg-slate-700 text-xs text-slate-400 font-mono">.ofx</span>

          <input
            ref={inputRef}
            type="file"
            accept=".ofx"
            className="hidden"
            onChange={e => processFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {/* Erro */}
        {erro && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle size={15} className="shrink-0" />
            {erro}
          </div>
        )}

        {/* Dica */}
        <div className="mt-5 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-start gap-3">
          <Info size={15} className="text-slate-500 mt-0.5 shrink-0" />
          <p className="text-xs text-slate-400 leading-relaxed">
            Exporte o extrato bancário no formato OFX pelo Internet Banking do seu banco.
            O sistema suporta Caixa Econômica Federal (OFX/SGML v102) e demais bancos que
            usam o padrão Open Financial Exchange.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Matching ───────────────────────────────────────────────────────────

function MatchingStep({
  ofx,
  rows,
  setRows,
  lancamentos,
  onAvancar,
  onVoltar,
}: {
  ofx: OFXParseResult;
  rows: Map<string, RowState>;
  setRows: React.Dispatch<React.SetStateAction<Map<string, RowState>>>;
  lancamentos: Lancamento[];
  onAvancar: () => void;
  onVoltar: () => void;
}) {
  const [filtro, setFiltro] = useState<"todos" | "confirmado" | "pendente" | "ignorado">("todos");
  const [pickerFitid, setPickerFitid] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");

  const confirmados = [...rows.values()].filter(r => r.status === "confirmado").length;
  const pendentes   = [...rows.values()].filter(r => r.status === "pendente").length;
  const ignorados   = [...rows.values()].filter(r => r.status === "ignorado").length;

  const txsFiltradas = ofx.transacoes.filter(tx => {
    const row = rows.get(tx.fitid);
    if (!row) return true;
    if (filtro === "todos") return true;
    return row.status === filtro;
  });

  function setStatus(fitid: string, status: MatchStatus, lancamentoId?: string | null) {
    setRows(prev => {
      const next = new Map(prev);
      next.set(fitid, { status, lancamentoId: lancamentoId ?? null });
      return next;
    });
  }

  function getLancamento(id: string | null) {
    if (!id) return null;
    return lancamentos.find(l => l.id === id) ?? null;
  }

  // Lançamentos disponíveis para vincular (não usados em outros matches)
  const usedIds = new Set(
    [...rows.entries()]
      .filter(([, r]) => r.lancamentoId)
      .map(([, r]) => r.lancamentoId!)
  );

  function candidatos(tx: TransacaoOFX) {
    const txTipo = tx.valor < 0 ? "despesa" : "receita";
    return lancamentos.filter(l =>
      l.tipo === txTipo &&
      l.status !== "cancelado" &&
      (!usedIds.has(l.id) || rows.get(tx.fitid)?.lancamentoId === l.id) &&
      (pickerSearch === "" ||
        l.descricao.toLowerCase().includes(pickerSearch.toLowerCase()) ||
        String(l.valor).includes(pickerSearch))
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header info */}
      <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Banknote size={16} className="text-cyan-400" />
          <span className="text-sm font-medium text-slate-200">{nomeBanco(ofx.banco)}</span>
          <span className="text-xs text-slate-500 font-mono">···{ofx.conta.slice(-4)}</span>
        </div>
        <div className="text-xs text-slate-500">
          {fmtData(ofx.data_inicio)} → {fmtData(ofx.data_fim)}
        </div>
        <div className="ml-auto text-sm font-semibold text-slate-100">
          Saldo extrato: <span className={ofx.saldo_final >= 0 ? "text-emerald-400" : "text-red-400"}>{fmtBRL(ofx.saldo_final)}</span>
        </div>
      </div>

      {/* Stats + filtros */}
      <div className="px-6 py-3 border-b border-slate-800 flex items-center gap-3 flex-wrap">
        {(["todos", "confirmado", "pendente", "ignorado"] as const).map(f => {
          const count = f === "todos"
            ? ofx.transacoes.length
            : f === "confirmado" ? confirmados
            : f === "pendente" ? pendentes
            : ignorados;
          return (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={clsx(
                "px-3 py-1 rounded-lg text-xs font-medium transition-all",
                filtro === f
                  ? f === "confirmado" ? "bg-emerald-500/20 text-emerald-300"
                  : f === "pendente" ? "bg-amber-500/20 text-amber-300"
                  : f === "ignorado" ? "bg-slate-600/50 text-slate-400"
                  : "bg-cyan-500/20 text-cyan-300"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              )}
            >
              {f === "todos" ? "Todos" : f === "confirmado" ? "Vinculados" : f === "pendente" ? "Pendentes" : "Ignorados"}
              <span className="ml-1.5 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Tabela */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm">
            <tr className="border-b border-slate-800">
              <th className="px-4 py-2.5 text-left text-xs text-slate-500 font-medium w-24">Data</th>
              <th className="px-4 py-2.5 text-left text-xs text-slate-500 font-medium">Transação (extrato)</th>
              <th className="px-4 py-2.5 text-right text-xs text-slate-500 font-medium w-32">Valor</th>
              <th className="px-4 py-2.5 text-left text-xs text-slate-500 font-medium w-32">Categoria</th>
              <th className="px-4 py-2.5 text-left text-xs text-slate-500 font-medium">Lançamento vinculado</th>
              <th className="px-4 py-2.5 text-center text-xs text-slate-500 font-medium w-28">Status</th>
              <th className="px-4 py-2.5 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {txsFiltradas.map(tx => {
              const row = rows.get(tx.fitid) ?? { status: "pendente" as MatchStatus, lancamentoId: null };
              const lancamento = getLancamento(row.lancamentoId);
              const isIgnorado = row.status === "ignorado";
              const isInterno  = CATEGORIAS_IGNORAR.includes(tx.categoria);

              return (
                <tr
                  key={tx.fitid}
                  className={clsx(
                    "group transition-colors",
                    isIgnorado ? "opacity-50" : "hover:bg-white/[0.02]"
                  )}
                >
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs tabular-nums">
                    {fmtData(tx.data)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-200 font-medium text-xs leading-tight">{tx.nome}</p>
                    <p className="text-slate-500 text-[11px] mt-0.5 truncate max-w-xs">{tx.memo}</p>
                  </td>
                  <td className={clsx(
                    "px-4 py-3 text-right font-semibold tabular-nums text-sm",
                    tx.valor >= 0 ? "text-emerald-400" : "text-red-400"
                  )}>
                    {fmtBRL(tx.valor)}
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const b = CATEG_BADGE[tx.categoria] ?? CATEG_BADGE.outro;
                      return (
                        <span className={clsx("px-2 py-0.5 rounded-full text-[10px] font-medium", b.cls)}>
                          {b.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    {lancamento ? (
                      <div>
                        <p className="text-slate-200 text-xs font-medium truncate max-w-[220px]">{lancamento.descricao}</p>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          {fmtData(lancamento.data_vencimento)} · {fmtBRL(lancamento.valor)}
                        </p>
                      </div>
                    ) : isIgnorado ? (
                      <span className="text-xs text-slate-600 italic">
                        {isInterno ? "Transação interna" : "Ignorado"}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-500/70 italic">Sem correspondência</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.status === "confirmado" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-medium">
                        <Check size={9} /> Vinculado
                      </span>
                    )}
                    {row.status === "pendente" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-medium">
                        <AlertCircle size={9} /> Pendente
                      </span>
                    )}
                    {row.status === "ignorado" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700 text-slate-500 text-[10px] font-medium">
                        <SkipForward size={9} /> Ignorado
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!isInterno && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {row.status !== "ignorado" && (
                          <button
                            onClick={() => {
                              setPickerFitid(tx.fitid);
                              setPickerSearch("");
                            }}
                            title="Vincular lançamento"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-400/10 transition-colors"
                          >
                            <RefreshCw size={12} />
                          </button>
                        )}
                        {row.status === "ignorado" ? (
                          <button
                            onClick={() => setStatus(tx.fitid, "pendente")}
                            title="Reativar"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
                          >
                            <ArrowRight size={12} />
                          </button>
                        ) : (
                          <button
                            onClick={() => setStatus(tx.fitid, "ignorado")}
                            title="Ignorar"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {txsFiltradas.length === 0 && (
          <div className="py-16 text-center text-slate-500 text-sm">
            Nenhuma transação {filtro !== "todos" ? `com status "${filtro}"` : ""}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-800 flex items-center gap-4">
        <button
          onClick={onVoltar}
          className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
        >
          ← Voltar
        </button>
        <div className="flex-1 flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-emerald-400" />
            <strong className="text-emerald-400">{confirmados}</strong> vinculados
          </span>
          <span className="flex items-center gap-1.5">
            <AlertCircle size={12} className="text-amber-400" />
            <strong className="text-amber-400">{pendentes}</strong> pendentes
          </span>
          <span className="flex items-center gap-1.5">
            <SkipForward size={12} className="text-slate-500" />
            <strong className="text-slate-500">{ignorados}</strong> ignorados
          </span>
        </div>
        <button
          onClick={onAvancar}
          className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-medium transition-colors flex items-center gap-2"
        >
          Revisar e Finalizar <ChevronRight size={14} />
        </button>
      </div>

      {/* Modal picker de lançamento */}
      {pickerFitid && (() => {
        const tx = ofx.transacoes.find(t => t.fitid === pickerFitid)!;
        const lista = candidatos(tx);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-[540px] max-h-[70vh] bg-slate-900 border border-slate-700 rounded-2xl flex flex-col shadow-2xl">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-100 text-sm">Vincular lançamento</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {tx.nome} · {fmtData(tx.data)} · {fmtBRL(tx.valor)}
                  </p>
                </div>
                <button
                  onClick={() => setPickerFitid(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="px-4 py-3 border-b border-slate-800">
                <input
                  autoFocus
                  placeholder="Buscar por descrição ou valor…"
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex-1 overflow-auto divide-y divide-slate-800/50">
                {/* Opção: sem vínculo */}
                <button
                  className="w-full px-4 py-3 text-left hover:bg-white/5 transition-colors flex items-center gap-3"
                  onClick={() => {
                    setStatus(pickerFitid, "ignorado");
                    setPickerFitid(null);
                  }}
                >
                  <Unlink size={14} className="text-slate-500 shrink-0" />
                  <span className="text-sm text-slate-400 italic">Ignorar esta transação</span>
                </button>

                {lista.length === 0 && (
                  <div className="py-10 text-center text-slate-500 text-sm">
                    Nenhum lançamento compatível encontrado
                  </div>
                )}

                {lista.map(l => (
                  <button
                    key={l.id}
                    className="w-full px-4 py-3 text-left hover:bg-white/5 transition-colors"
                    onClick={() => {
                      setStatus(pickerFitid, "confirmado", l.id);
                      setPickerFitid(null);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-slate-200 font-medium truncate">{l.descricao}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {fmtData(l.data_vencimento)} ·{" "}
                          <span className={clsx(
                            "text-xs font-medium",
                            l.status === "pago" ? "text-emerald-400" :
                            l.status === "atrasado" ? "text-red-400" : "text-amber-400"
                          )}>
                            {l.status}
                          </span>
                        </p>
                      </div>
                      <span className={clsx(
                        "text-sm font-semibold tabular-nums shrink-0",
                        l.tipo === "receita" ? "text-emerald-400" : "text-red-400"
                      )}>
                        {fmtBRL(l.valor)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Step 3: Finalizar ──────────────────────────────────────────────────────────

function FinalizarStep({
  ofx,
  rows,
  lancamentos,
  onVoltar,
  onConcluido,
}: {
  ofx: OFXParseResult;
  rows: Map<string, RowState>;
  lancamentos: Lancamento[];
  onVoltar: () => void;
  onConcluido: () => void;
}) {
  const confirmados = [...rows.entries()]
    .filter(([, r]) => r.status === "confirmado" && r.lancamentoId)
    .map(([fitid, r]) => ({ transacao_fitid: fitid, lancamento_id: r.lancamentoId! }));

  const pendentes = [...rows.values()].filter(r => r.status === "pendente").length;

  const mutation = useMutation({
    mutationFn: () => conciliacaoApi.finalizar(confirmados),
    onSuccess: onConcluido,
  });

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
            <CheckCircle2 size={20} className="text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100">Revisar e confirmar conciliação</h2>
            <p className="text-sm text-slate-400">
              Extrato: {nomeBanco(ofx.banco)} · {fmtData(ofx.data_inicio)} → {fmtData(ofx.data_fim)}
            </p>
          </div>
        </div>

        {/* Resumo cards */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-2xl font-bold text-emerald-400">{confirmados.length}</p>
            <p className="text-xs text-emerald-300/70 mt-0.5">Lançamentos a marcar como Pago</p>
          </div>
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-2xl font-bold text-amber-400">{pendentes}</p>
            <p className="text-xs text-amber-300/70 mt-0.5">Transações sem correspondência</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700">
            <p className="text-2xl font-bold text-slate-300">
              {[...rows.values()].filter(r => r.status === "ignorado").length}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Transações ignoradas</p>
          </div>
        </div>

        {/* Saldo */}
        <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/50 mb-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Saldo final do extrato</span>
            <span className="font-semibold text-slate-100">{fmtBRL(ofx.saldo_final)}</span>
          </div>
        </div>

        {/* Lista de lançamentos a atualizar */}
        {confirmados.length > 0 && (
          <div className="mb-5 rounded-2xl border border-slate-700/50 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-800/60 border-b border-slate-700/50">
              <p className="text-xs font-medium text-slate-400">Lançamentos que serão marcados como Pago</p>
            </div>
            <div className="divide-y divide-slate-800/50 max-h-48 overflow-auto">
              {confirmados.map(({ transacao_fitid, lancamento_id }) => {
                const lanc = lancamentos.find(l => l.id === lancamento_id);
                const tx   = ofx.transacoes.find(t => t.fitid === transacao_fitid);
                if (!lanc || !tx) return null;
                return (
                  <div key={transacao_fitid} className="px-4 py-2.5 flex items-center gap-3 bg-slate-900/40">
                    <Check size={12} className="text-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 truncate">{lanc.descricao}</p>
                      <p className="text-[10px] text-slate-500">{fmtData(lanc.data_vencimento)}</p>
                    </div>
                    <span className="text-xs font-semibold text-emerald-400 tabular-nums">
                      {fmtBRL(lanc.valor)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Aviso pendentes */}
        {pendentes > 0 && (
          <div className="mb-5 flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>
              <strong>{pendentes}</strong> transação(ões) do extrato não foram vinculadas a
              lançamentos. Você pode verificá-las manualmente na página Financeiro.
            </span>
          </div>
        )}

        {/* Erro */}
        {mutation.isError && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <XCircle size={14} className="shrink-0" />
            {(mutation.error as any)?.response?.data?.detail ?? "Erro ao finalizar conciliação."}
          </div>
        )}

        {/* Ações */}
        <div className="flex items-center gap-3">
          <button
            onClick={onVoltar}
            disabled={mutation.isPending}
            className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 text-sm transition-colors disabled:opacity-50"
          >
            ← Voltar
          </button>
          {confirmados.length === 0 ? (
            <button
              onClick={onConcluido}
              className="px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium transition-colors"
            >
              Concluir sem alterar lançamentos
            </button>
          ) : (
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {mutation.isPending ? (
                <><Loader2 size={14} className="animate-spin" /> Processando…</>
              ) : (
                <><CheckCircle2 size={14} /> Confirmar Conciliação</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sucesso ────────────────────────────────────────────────────────────────────

function SucessoStep({ onNova }: { onNova: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={32} className="text-emerald-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-100 mb-2">Conciliação concluída!</h2>
        <p className="text-sm text-slate-400 mb-6">
          Os lançamentos vinculados foram marcados como pagos no sistema.
        </p>
        <button
          onClick={onNova}
          className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-medium transition-colors"
        >
          Nova Conciliação
        </button>
      </div>
    </div>
  );
}

// ── Stepper indicador ──────────────────────────────────────────────────────────

const STEPS = [
  { key: "upload",    label: "Importar extrato" },
  { key: "matching",  label: "Vincular"          },
  { key: "finalizar", label: "Confirmar"         },
];

function Stepper({ current }: { current: string }) {
  const idx = STEPS.findIndex(s => s.key === current);
  return (
    <div className="flex items-center gap-0 px-6 py-4 border-b border-slate-800">
      {STEPS.map((s, i) => (
        <React.Fragment key={s.key}>
          <div className="flex items-center gap-2">
            <div className={clsx(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all",
              i < idx ? "bg-emerald-500 text-white"
              : i === idx ? "bg-cyan-500 text-white ring-4 ring-cyan-500/20"
              : "bg-slate-800 text-slate-500"
            )}>
              {i < idx ? <Check size={12} /> : i + 1}
            </div>
            <span className={clsx(
              "text-xs font-medium transition-colors",
              i === idx ? "text-slate-200" : i < idx ? "text-slate-400" : "text-slate-600"
            )}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={clsx(
              "flex-1 h-px mx-3 transition-colors",
              i < idx ? "bg-emerald-500/40" : "bg-slate-800"
            )} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

type StepKey = "upload" | "matching" | "finalizar" | "sucesso";

export function Conciliacao() {
  const [step, setStep] = useState<StepKey>("upload");
  const [ofxResult, setOfxResult] = useState<OFXParseResult | null>(null);
  const [rows, setRows] = useState<Map<string, RowState>>(new Map());

  const { data: lancamentos = [] } = useQuery<Lancamento[]>({
    queryKey: ["lancamentos-todos"],
    queryFn: () => financeiroApi.listar(),
    enabled: step === "matching" || step === "finalizar",
  });

  function handleParsed(result: OFXParseResult) {
    setOfxResult(result);
    const matched = autoMatch(result.transacoes, lancamentos);
    setRows(matched);
    setStep("matching");
  }

  function handleMatchingNext() {
    setStep("finalizar");
  }

  function handleReset() {
    setStep("upload");
    setOfxResult(null);
    setRows(new Map());
  }

  // Quando os lançamentos carregam e já temos OFX (volta da etapa de matching)
  // → re-roda o auto-match para incluir dados novos, mas só na 1ª vez que entramos no matching
  // (o usuário pode ter editado os rows manualmente, então não re-rodamos se já tem estado)

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #0d1f3c 100%)" }}
    >
      {step !== "sucesso" && step !== "upload" && (
        <Stepper current={step} />
      )}

      {step === "upload" && (
        <UploadStep onParsed={handleParsed} />
      )}

      {step === "matching" && ofxResult && (
        <MatchingStep
          ofx={ofxResult}
          rows={rows}
          setRows={setRows}
          lancamentos={lancamentos}
          onAvancar={handleMatchingNext}
          onVoltar={handleReset}
        />
      )}

      {step === "finalizar" && ofxResult && (
        <FinalizarStep
          ofx={ofxResult}
          rows={rows}
          lancamentos={lancamentos}
          onVoltar={() => setStep("matching")}
          onConcluido={() => setStep("sucesso")}
        />
      )}

      {step === "sucesso" && (
        <SucessoStep onNova={handleReset} />
      )}
    </div>
  );
}
