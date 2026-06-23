import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight,
  Clock, MessageSquare, MinusCircle, RefreshCw, Coins, CalendarClock,
} from "lucide-react";
import clsx from "clsx";
import { documentosApi, type DocStatus } from "@/api/client";
import { CATALOGO, RESPONSAVEIS, calcProgresso, type StatusDoc, type DocItem, type Responsavel } from "@/lib/docsCatalogo";
import { useAuthStore } from "@/stores/authStore";
import { podeEscrever } from "@/lib/permissoes";

const STATUS_BTNS = [
  { value: "pendente"     as StatusDoc, icon: <span className="w-3 h-3 rounded border-2 border-slate-400 bg-white inline-block" />, label: "Pendente",
    activeClass: "bg-slate-600 text-white border-slate-600", idleClass: "text-slate-400 border-slate-200 hover:border-slate-400 hover:text-slate-600" },
  { value: "em_andamento" as StatusDoc, icon: <Clock size={12} />, label: "Em andamento",
    activeClass: "bg-blue-500 text-white border-blue-500", idleClass: "text-slate-400 border-slate-200 hover:border-blue-400 hover:text-blue-500" },
  { value: "concluido"    as StatusDoc, icon: <CheckCircle2 size={12} />, label: "Concluído",
    activeClass: "bg-emerald-500 text-white border-emerald-500", idleClass: "text-slate-400 border-slate-200 hover:border-emerald-400 hover:text-emerald-500" },
  { value: "nao_se_aplica" as StatusDoc, icon: <MinusCircle size={12} />, label: "N/A",
    activeClass: "bg-slate-300 text-slate-600 border-slate-300", idleClass: "text-slate-300 border-slate-200 hover:border-slate-400 hover:text-slate-500" },
] as const;

const hoje = () => new Date().toISOString().slice(0, 10);

// ── Observação inline ─────────────────────────────────────────────────────────

function ObsField({ value, onSave, disabled }: { value: string; onSave: (v: string) => void; disabled: boolean }) {
  const [local, setLocal] = useState(value);
  const savedRef = useRef(value);
  useEffect(() => { if (value !== savedRef.current) { setLocal(value); savedRef.current = value; } }, [value]);
  function handleBlur() {
    const t = local.trim();
    if (t !== savedRef.current) { savedRef.current = t; onSave(t || ""); }
  }
  return (
    <textarea rows={2} value={local} onChange={e => setLocal(e.target.value)} onBlur={handleBlur} disabled={disabled}
      placeholder="Observação interna (ex: Aguardando JUCEG, protocolo nº…)"
      className={clsx("w-full text-xs text-slate-600 placeholder-slate-400 border border-slate-200 rounded-lg p-2.5 resize-none outline-none transition-colors",
        !disabled && "focus:border-brand-400 focus:ring-1 focus:ring-brand-200", disabled && "bg-slate-50 cursor-default")} />
  );
}

// ── Linha de documento ────────────────────────────────────────────────────────

interface DocRowInitial { status: StatusDoc; obs: string; prazo: string; resp: string }

const RESP_OPCOES = Object.keys(RESPONSAVEIS) as Responsavel[];

function DocRow({ empId, doc, initial, canWrite }: {
  empId: string; doc: DocItem; initial: DocRowInitial; canWrite: boolean;
}) {
  const [localStatus, setLocalStatus] = useState<StatusDoc>(initial.status);
  const [localObs, setLocalObs] = useState(initial.obs);
  const [localPrazo, setLocalPrazo] = useState(initial.prazo);
  const [localResp, setLocalResp] = useState(initial.resp);   // "" = usa padrão do catálogo
  const [obsOpen, setObsOpen] = useState(!!initial.obs);
  const [saveErr, setSaveErr] = useState(false);

  useEffect(() => { setLocalStatus(initial.status); }, [initial.status]);
  useEffect(() => { setLocalObs(initial.obs); }, [initial.obs]);
  useEffect(() => { setLocalPrazo(initial.prazo); }, [initial.prazo]);
  useEffect(() => { setLocalResp(initial.resp); }, [initial.resp]);

  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: (p: { s: StatusDoc; o: string; prazo: string; resp: string }) =>
      documentosApi.atualizar(empId, doc.tipo, {
        status: p.s, observacoes: p.o || null, data_prazo: p.prazo || null, responsavel: p.resp || null,
      }),
    onMutate: (p) => {
      qc.setQueryData<DocStatus[]>(["documentos", empId], (old = []) => {
        const ex = old.find(d => d.doc_tipo === doc.tipo);
        const patch = { status: p.s as string, observacoes: p.o || null, data_prazo: p.prazo || null, responsavel: p.resp || null };
        return ex
          ? old.map(d => d.doc_tipo === doc.tipo ? { ...d, ...patch } : d)
          : [...old, { doc_tipo: doc.tipo, ...patch }];
      });
      setSaveErr(false);
    },
    onError: () => { setLocalStatus(initial.status); setLocalObs(initial.obs); setLocalPrazo(initial.prazo); setLocalResp(initial.resp); setSaveErr(true); setTimeout(() => setSaveErr(false), 3000); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["documentos", empId] }); qc.invalidateQueries({ queryKey: ["matriz-documentos"] }); },
  });

  const isUrgente = localStatus === "urgente";
  const displaySt = isUrgente ? "pendente" : localStatus;
  const vencido = !!localPrazo && localStatus !== "concluido" && localStatus !== "nao_se_aplica" && localPrazo < hoje();
  // Responsável efetivo: override salvo, senão o padrão do catálogo
  const respAtual = (localResp || doc.responsavel) as Responsavel;
  const resp = RESPONSAVEIS[respAtual];

  const salvar = (over: Partial<{ s: StatusDoc; o: string; prazo: string; resp: string }> = {}) => {
    if (!canWrite) return;
    const p = { s: localStatus, o: localObs, prazo: localPrazo, resp: localResp, ...over };
    if (over.s !== undefined) setLocalStatus(over.s);
    if (over.o !== undefined) setLocalObs(over.o);
    if (over.prazo !== undefined) setLocalPrazo(over.prazo);
    if (over.resp !== undefined) setLocalResp(over.resp);
    mut.mutate(p);
  };

  return (
    <div className={clsx("border-b border-slate-100 last:border-0 transition-colors",
      isUrgente && "bg-amber-50/40", vencido && !isUrgente && "bg-red-50/40")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 px-1">
        {/* Nome + responsável + dica */}
        <div className="flex-1 min-w-[180px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={clsx("text-sm leading-snug",
              isUrgente ? "text-amber-800 font-medium" : vencido ? "text-red-700 font-medium" : "text-slate-700")}>
              {doc.label}
            </span>
            {canWrite ? (
              <span className="relative inline-flex">
                <select
                  value={localResp || doc.responsavel}
                  onChange={e => salvar({ resp: e.target.value === doc.responsavel ? "" : e.target.value })}
                  title={`Responsável — padrão: ${doc.responsavel}${resp ? " · " + resp.papel : ""}`}
                  className={clsx("appearance-none cursor-pointer text-[10px] font-medium pl-1.5 pr-4 py-0.5 rounded-full outline-none border-0", resp.cor)}
                >
                  {RESP_OPCOES.map(r => <option key={r} value={r}>{r}{r === doc.responsavel ? " (padrão)" : ""}</option>)}
                </select>
                <ChevronDown size={9} className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
              </span>
            ) : (
              <span className={clsx("text-[10px] font-medium px-1.5 py-0.5 rounded-full", resp.cor)} title={resp?.papel}>
                {respAtual}
              </span>
            )}
            {doc.taxa && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700" title="Exige pagamento de taxa/emolumento">
                <Coins size={9} /> Taxa
              </span>
            )}
            {saveErr && <span className="text-[10px] text-red-500">⚠ Erro ao salvar</span>}
          </div>
          {doc.dica && <p className="text-[11px] text-slate-400 mt-0.5">{doc.dica}</p>}
        </div>

        {/* Prazo */}
        <div className="flex items-center gap-1 shrink-0">
          <CalendarClock size={13} className={vencido ? "text-red-500" : "text-slate-300"} />
          <input type="date" value={localPrazo} disabled={!canWrite}
            onChange={e => salvar({ prazo: e.target.value })}
            title="Prazo limite"
            className={clsx("text-xs border rounded-lg px-2 py-1 outline-none w-[120px]",
              vencido ? "border-red-300 text-red-700 bg-red-50" : "border-slate-200 text-slate-600",
              canWrite ? "focus:border-brand-400" : "bg-slate-50 cursor-default")} />
        </div>

        {/* Status */}
        {canWrite ? (
          <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden shrink-0">
            {STATUS_BTNS.map(btn => (
              <button key={btn.value} onClick={() => salvar({ s: btn.value })} title={btn.label}
                className={clsx("flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border-r last:border-0 border-slate-200 transition-all",
                  displaySt === btn.value ? btn.activeClass : btn.idleClass)}>
                {btn.icon}<span className="hidden lg:inline">{btn.label}</span>
              </button>
            ))}
          </div>
        ) : (
          (() => { const b = STATUS_BTNS.find(x => x.value === displaySt) ?? STATUS_BTNS[0];
            return <span className={clsx("flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium", b.activeClass)}>{b.icon} {b.label}</span>; })()
        )}

        {/* Urgente */}
        <button onClick={() => salvar({ s: isUrgente ? "pendente" : "urgente" })} disabled={!canWrite}
          title={isUrgente ? "Remover urgência" : "Marcar como urgente"}
          className={clsx("flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all shrink-0",
            isUrgente ? "bg-amber-500 border-amber-500 text-white shadow-sm" : "border-slate-200 text-slate-400 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50",
            !canWrite && "pointer-events-none opacity-60")}>
          <AlertTriangle size={12} />
        </button>

        {/* Observação */}
        <button onClick={() => setObsOpen(v => !v)} title="Observação interna"
          className={clsx("p-1.5 rounded-lg transition-all shrink-0",
            localObs ? "text-brand-500 bg-brand-50 hover:bg-brand-100" : "text-slate-300 hover:text-brand-400 hover:bg-brand-50",
            obsOpen && "text-brand-500 bg-brand-50")}>
          <MessageSquare size={14} />
        </button>
      </div>

      {obsOpen && <div className="px-1 pb-3"><ObsField value={localObs} onSave={v => salvar({ o: v })} disabled={!canWrite} /></div>}
    </div>
  );
}

// ── Bloco de fase ─────────────────────────────────────────────────────────────

function FaseBlock({ cat, empId, statuses, obses, prazos, resps, canWrite }: {
  cat: typeof CATALOGO[0]; empId: string;
  statuses: Record<string, string>; obses: Record<string, string>;
  prazos: Record<string, string>; resps: Record<string, string>;
  canWrite: boolean;
}) {
  const [open, setOpen] = useState(false);   // fases começam fechadas
  const tipos = cat.docs.map(d => d.tipo);
  const pct = calcProgresso(statuses, tipos);
  const concluidos = tipos.filter(t => statuses[t] === "concluido").length;
  const urgentes = tipos.filter(t => statuses[t] === "urgente").length;
  const vencidos = cat.docs.filter(d => {
    const p = prazos[d.tipo]; const s = statuses[d.tipo];
    return p && s !== "concluido" && s !== "nao_se_aplica" && p < hoje();
  }).length;

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-3 px-5 py-3.5 bg-slate-50 hover:bg-slate-100/80 transition-colors text-left">
        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-500 shrink-0">
          {String(cat.fase).padStart(2, "0")}
        </span>
        <span className="text-lg leading-none">{cat.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-700 text-sm">{cat.label}</p>
          <p className="text-[11px] text-slate-400 truncate">{cat.subtitulo}</p>
        </div>
        {vencidos > 0 && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium shrink-0">
            <CalendarClock size={10} /> {vencidos} vencido{vencidos > 1 ? "s" : ""}
          </span>
        )}
        {urgentes > 0 && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium shrink-0">
            <AlertTriangle size={10} /> {urgentes}
          </span>
        )}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-slate-400 hidden sm:inline">{concluidos}/{tipos.length}</span>
          <div className="w-20 h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <div className={clsx("h-full rounded-full transition-all", pct >= 100 ? "bg-emerald-500" : pct >= 60 ? "bg-blue-500" : "bg-slate-400")} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-slate-500 w-7 text-right">{pct}%</span>
          {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="px-4">
          {cat.docs.map(doc => (
            <DocRow key={doc.tipo} empId={empId} doc={doc}
              initial={{ status: (statuses[doc.tipo] ?? "pendente") as StatusDoc, obs: obses[doc.tipo] ?? "", prazo: prazos[doc.tipo] ?? "", resp: resps[doc.tipo] ?? "" }}
              canWrite={canWrite} />
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
  const obses: Record<string, string> = {};
  const prazos: Record<string, string> = {};
  const resps: Record<string, string> = {};
  for (const s of rawStatuses) {
    statuses[s.doc_tipo] = s.status;
    obses[s.doc_tipo] = s.observacoes ?? "";
    prazos[s.doc_tipo] = s.data_prazo ?? "";
    resps[s.doc_tipo] = s.responsavel ?? "";
  }

  const allTipos = CATALOGO.flatMap(c => c.docs).map(d => d.tipo);
  const concluidos = allTipos.filter(t => statuses[t] === "concluido").length;
  const urgentes = allTipos.filter(t => statuses[t] === "urgente").length;
  const vencidos = CATALOGO.flatMap(c => c.docs).filter(d => {
    const p = prazos[d.tipo]; const s = statuses[d.tipo];
    return p && s !== "concluido" && s !== "nao_se_aplica" && p < hoje();
  }).length;
  const pct = calcProgresso(statuses, allTipos);

  if (isLoading) {
    return <div className="py-16 flex items-center justify-center"><RefreshCw size={20} className="animate-spin text-slate-300" /></div>;
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Painel de progresso global */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <span className="font-semibold text-slate-700 text-sm">Gestão Documental — {allTipos.length} documentos em 6 fases</span>
          </div>
          <span className="text-sm font-bold text-slate-700">{pct}%</span>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={clsx("h-full rounded-full transition-all duration-500", pct >= 100 ? "bg-emerald-500" : pct >= 60 ? "bg-blue-500" : "bg-slate-400")} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /><strong className="text-emerald-600">{concluidos}</strong> concluídos</span>
          {vencidos > 0 && <span className="flex items-center gap-1.5"><CalendarClock size={11} className="text-red-500" /><strong className="text-red-600">{vencidos}</strong> com prazo vencido</span>}
          {urgentes > 0 && <span className="flex items-center gap-1.5"><AlertTriangle size={11} className="text-amber-500" /><strong className="text-amber-600">{urgentes}</strong> urgentes</span>}
          {!canWrite && <span className="italic text-slate-400">Modo visualização</span>}
        </div>
      </div>

      {/* Fases na ordem da planilha */}
      {CATALOGO.map(cat => (
        <FaseBlock key={cat.id} cat={cat} empId={empreendimentoId}
          statuses={statuses} obses={obses} prazos={prazos} resps={resps} canWrite={canWrite} />
      ))}
    </div>
  );
}
