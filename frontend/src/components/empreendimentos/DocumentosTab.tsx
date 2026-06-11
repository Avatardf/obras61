import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight,
  Clock, MessageSquare, MinusCircle, RefreshCw,
} from "lucide-react";
import clsx from "clsx";
import { documentosApi, type DocStatus } from "@/api/client";
import { CATALOGO, calcProgresso, type StatusDoc } from "@/lib/docsCatalogo";
import { useAuthStore } from "@/stores/authStore";
import { podeEscrever } from "@/lib/permissoes";

// ── Configuração dos 3 botões de status ──────────────────────────────────────

const STATUS_BTNS = [
  {
    value: "pendente"     as StatusDoc,
    icon:  <span className="w-3 h-3 rounded border-2 border-slate-400 bg-white inline-block" />,
    label: "Pendente",
    activeClass: "bg-slate-600 text-white border-slate-600",
    idleClass:   "text-slate-400 border-slate-200 hover:border-slate-400 hover:text-slate-600",
  },
  {
    value: "em_andamento" as StatusDoc,
    icon:  <Clock size={12} />,
    label: "Em andamento",
    activeClass: "bg-blue-500 text-white border-blue-500",
    idleClass:   "text-slate-400 border-slate-200 hover:border-blue-400 hover:text-blue-500",
  },
  {
    value: "concluido"    as StatusDoc,
    icon:  <CheckCircle2 size={12} />,
    label: "Concluído",
    activeClass: "bg-emerald-500 text-white border-emerald-500",
    idleClass:   "text-slate-400 border-slate-200 hover:border-emerald-400 hover:text-emerald-500",
  },
  {
    value: "nao_se_aplica" as StatusDoc,
    icon:  <MinusCircle size={12} />,
    label: "N/A",
    activeClass: "bg-slate-300 text-slate-600 border-slate-300",
    idleClass:   "text-slate-300 border-slate-200 hover:border-slate-400 hover:text-slate-500",
  },
] as const;

// ── Obs inline ────────────────────────────────────────────────────────────────

function ObsField({
  value, onSave, disabled,
}: {
  value: string; onSave: (v: string) => void; disabled: boolean;
}) {
  const [local, setLocal] = useState(value);
  const savedRef = useRef(value);

  // Sincroniza quando o valor externo muda (invalidação de query)
  useEffect(() => {
    if (value !== savedRef.current) {
      setLocal(value);
      savedRef.current = value;
    }
  }, [value]);

  function handleBlur() {
    const trimmed = local.trim();
    if (trimmed !== savedRef.current) {
      savedRef.current = trimmed;
      onSave(trimmed || "");
    }
  }

  return (
    <textarea
      rows={2}
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={handleBlur}
      disabled={disabled}
      placeholder="Observação interna (ex: Aguardando JUCEG, prazo 15 dias…)"
      className={clsx(
        "w-full text-xs text-slate-600 placeholder-slate-400 border border-slate-200 rounded-lg p-2.5 resize-none outline-none transition-colors",
        !disabled && "focus:border-brand-400 focus:ring-1 focus:ring-brand-200",
        disabled && "bg-slate-50 cursor-default",
      )}
    />
  );
}

// ── Linha de documento ────────────────────────────────────────────────────────

interface DocRowState {
  status: StatusDoc;
  obs: string;
}

function DocRow({
  empId, docTipo, docLabel, initial, canWrite,
}: {
  empId: string;
  docTipo: string;
  docLabel: string;
  initial: DocRowState;
  canWrite: boolean;
}) {
  // ── Estado local para optimistic update ──────────────────────────────────
  const [localStatus, setLocalStatus] = useState<StatusDoc>(initial.status);
  const [localObs,    setLocalObs   ] = useState(initial.obs);
  const [obsOpen,     setObsOpen    ] = useState(!!initial.obs);
  const [saveErr,     setSaveErr    ] = useState(false);

  // Sincroniza quando o servidor confirma (ou reverte em caso de erro)
  useEffect(() => { setLocalStatus(initial.status); }, [initial.status]);
  useEffect(() => { setLocalObs(initial.obs);        }, [initial.obs]);

  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: ({ s, o }: { s: StatusDoc; o: string }) =>
      documentosApi.atualizar(empId, docTipo, s, o || null),
    onMutate: ({ s, o }) => {
      // Atualiza o cache local do TanStack Query imediatamente
      qc.setQueryData<DocStatus[]>(["documentos", empId], (old = []) => {
        const exists = old.find(d => d.doc_tipo === docTipo);
        if (exists) {
          return old.map(d =>
            d.doc_tipo === docTipo ? { ...d, status: s, observacoes: o || null } : d
          );
        }
        return [...old, { doc_tipo: docTipo, status: s as string, observacoes: o || null }];
      });
      setSaveErr(false);
    },
    onError: () => {
      // Reverte para o estado que veio do servidor
      setLocalStatus(initial.status);
      setLocalObs(initial.obs);
      setSaveErr(true);
      setTimeout(() => setSaveErr(false), 3000);
    },
    onSettled: () => {
      // Revalida para garantir sincronia com o banco
      qc.invalidateQueries({ queryKey: ["documentos", empId] });
      qc.invalidateQueries({ queryKey: ["matriz-documentos"] });
    },
  });

  // Urgente é tratado como status próprio; "pendente" é o baseStatus visual
  const isUrgente = localStatus === "urgente";
  const displaySt = isUrgente ? "pendente" : localStatus;

  function handleStatus(s: StatusDoc) {
    if (!canWrite) return;
    setLocalStatus(s);              // UI responde instantaneamente
    mut.mutate({ s, o: localObs });
  }

  function toggleUrgente() {
    if (!canWrite) return;
    const next: StatusDoc = isUrgente ? "pendente" : "urgente";
    setLocalStatus(next);
    mut.mutate({ s: next, o: localObs });
  }

  function saveObs(text: string) {
    if (!canWrite) return;
    setLocalObs(text);
    mut.mutate({ s: localStatus, o: text });
  }

  return (
    <div className={clsx(
      "border-b border-slate-100 last:border-0 transition-colors",
      isUrgente && "bg-amber-50/40",
    )}>
      {/* Linha principal */}
      <div className="flex items-center gap-3 py-2.5 px-1">

        {/* Nome do documento */}
        <span className={clsx(
          "flex-1 text-sm leading-snug min-w-0",
          isUrgente ? "text-amber-800 font-medium" : "text-slate-700",
        )}>
          {docLabel}
          {saveErr && (
            <span className="ml-2 text-[10px] text-red-500 font-normal">
              ⚠ Erro ao salvar
            </span>
          )}
        </span>

        {/* Botões de status */}
        {canWrite ? (
          <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden shrink-0">
            {STATUS_BTNS.map(btn => (
              <button
                key={btn.value}
                onClick={() => handleStatus(btn.value)}
                title={btn.label}
                className={clsx(
                  "flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border-r last:border-0 border-slate-200 transition-all",
                  displaySt === btn.value ? btn.activeClass : btn.idleClass,
                )}
              >
                {btn.icon}
                <span className="hidden sm:inline">{btn.label}</span>
              </button>
            ))}
          </div>
        ) : (
          /* Visualizador: só mostra o badge */
          (() => {
            const btn = STATUS_BTNS.find(b => b.value === displaySt) ?? STATUS_BTNS[0];
            return (
              <span className={clsx(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium",
                btn.activeClass,
              )}>
                {btn.icon} {btn.label}
              </span>
            );
          })()
        )}

        {/* Botão Urgente */}
        <button
          onClick={toggleUrgente}
          disabled={!canWrite}
          title={isUrgente ? "Remover urgência" : "Marcar como urgente"}
          className={clsx(
            "flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all shrink-0",
            isUrgente
              ? "bg-amber-500 border-amber-500 text-white shadow-sm"
              : "border-slate-200 text-slate-400 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50",
            !canWrite && "pointer-events-none opacity-60",
          )}
        >
          <AlertTriangle size={12} />
          <span className="hidden sm:inline ml-0.5">Urgente</span>
        </button>

        {/* Botão Observação */}
        <button
          onClick={() => setObsOpen(v => !v)}
          title="Observação interna"
          className={clsx(
            "p-1.5 rounded-lg transition-all shrink-0",
            localObs
              ? "text-brand-500 bg-brand-50 hover:bg-brand-100"
              : "text-slate-300 hover:text-brand-400 hover:bg-brand-50",
            obsOpen && "text-brand-500 bg-brand-50",
          )}
        >
          <MessageSquare size={14} />
        </button>
      </div>

      {/* Campo de observação inline */}
      {obsOpen && (
        <div className="px-1 pb-3">
          <ObsField
            value={localObs}
            onSave={saveObs}
            disabled={!canWrite}
          />
        </div>
      )}
    </div>
  );
}

// ── Bloco de categoria ────────────────────────────────────────────────────────

function CatBlock({
  cat, empId, statuses, obses, canWrite,
}: {
  cat: typeof CATALOGO[0];
  empId: string;
  statuses: Record<string, string>;
  obses: Record<string, string>;
  canWrite: boolean;
}) {
  const [open, setOpen] = useState(true);
  const tipos  = cat.docs.map(d => d.tipo);
  const pct    = calcProgresso(statuses, tipos);
  const urgentes = tipos.filter(t => statuses[t] === "urgente").length;

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      {/* Header da categoria */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-3.5 bg-slate-50 hover:bg-slate-100/80 transition-colors text-left"
      >
        <span className="text-lg leading-none">{cat.icon}</span>
        <span className="font-semibold text-slate-700 text-sm flex-1">{cat.label}</span>

        {urgentes > 0 && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
            <AlertTriangle size={10} />
            {urgentes} urgente{urgentes > 1 ? "s" : ""}
          </span>
        )}

        {/* Mini progresso */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-20 h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <div
              className={clsx(
                "h-full rounded-full transition-all",
                pct >= 100 ? "bg-emerald-500" : pct >= 60 ? "bg-blue-500" : "bg-slate-400"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-slate-500 w-7 text-right">{pct}%</span>
          {open
            ? <ChevronDown size={14} className="text-slate-400 ml-1" />
            : <ChevronRight size={14} className="text-slate-400 ml-1" />
          }
        </div>
      </button>

      {/* Documentos */}
      {open && (
        <div className="px-4">
          {cat.docs.map(doc => (
            <DocRow
              key={doc.tipo}
              empId={empId}
              docTipo={doc.tipo}
              docLabel={doc.label}
              initial={{
                status: (statuses[doc.tipo] ?? "pendente") as StatusDoc,
                obs: obses[doc.tipo] ?? "",
              }}
              canWrite={canWrite}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Componente exportado ──────────────────────────────────────────────────────

export function DocumentosTab({ empreendimentoId }: { empreendimentoId: string }) {
  const { user } = useAuthStore();
  const canWrite = podeEscrever(user?.papel);

  const { data: rawStatuses = [], isLoading } = useQuery({
    queryKey: ["documentos", empreendimentoId],
    queryFn: () => documentosApi.listar(empreendimentoId),
  });

  const statuses: Record<string, string> = {};
  const obses:    Record<string, string> = {};
  for (const s of rawStatuses) {
    statuses[s.doc_tipo]  = s.status;
    obses[s.doc_tipo]     = s.observacoes ?? "";
  }

  const allTipos   = CATALOGO.flatMap(c => c.docs).map(d => d.tipo);
  const concluidos = allTipos.filter(t => statuses[t] === "concluido").length;
  const urgentes   = allTipos.filter(t => statuses[t] === "urgente").length;
  const pct        = calcProgresso(statuses, allTipos);

  if (isLoading) {
    return (
      <div className="py-16 flex items-center justify-center">
        <RefreshCw size={20} className="animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Barra de progresso global */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <span className="font-semibold text-slate-700 text-sm">Progresso Documental</span>
          </div>
          <span className="text-sm font-bold text-slate-700">{pct}%</span>
        </div>

        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={clsx(
              "h-full rounded-full transition-all duration-500",
              pct >= 100 ? "bg-emerald-500" : pct >= 60 ? "bg-blue-500" : "bg-slate-400"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <strong className="text-emerald-600">{concluidos}</strong> concluídos
          </span>
          {urgentes > 0 && (
            <span className="flex items-center gap-1.5">
              <AlertTriangle size={11} className="text-amber-500" />
              <strong className="text-amber-600">{urgentes}</strong> urgentes
            </span>
          )}
          <span className="text-slate-400">{allTipos.length} documentos no total</span>
          {!canWrite && <span className="italic text-slate-400">Modo visualização</span>}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-4 px-1 text-xs text-slate-500">
        {STATUS_BTNS.map(btn => (
          <span key={btn.value} className="flex items-center gap-1.5">
            <span className={clsx("flex items-center gap-1 px-2 py-0.5 rounded border text-[10px]", btn.activeClass)}>
              {btn.icon} {btn.label}
            </span>
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded border bg-amber-500 border-amber-500 text-white text-[10px]">
            <AlertTriangle size={10} /> Urgente
          </span>
          = pendência crítica
        </span>
        {canWrite && (
          <span className="flex items-center gap-1.5 text-slate-400">
            <MessageSquare size={11} /> clique para adicionar observação
          </span>
        )}
      </div>

      {/* Categorias */}
      {CATALOGO.map(cat => (
        <CatBlock
          key={cat.id}
          cat={cat}
          empId={empreendimentoId}
          statuses={statuses}
          obses={obses}
          canWrite={canWrite}
        />
      ))}
    </div>
  );
}
