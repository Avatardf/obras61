import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, RefreshCw, ChevronDown, ChevronRight, Info } from "lucide-react";
import clsx from "clsx";
import { documentosApi } from "@/api/client";
import {
  CATALOGO, TODOS_DOCS, STATUS_CONFIG, STATUS_CICLO, RESPONSAVEIS, calcProgresso,
  type StatusDoc,
} from "@/lib/docsCatalogo";
import { useAuthStore } from "@/stores/authStore";
import { podeEscrever } from "@/lib/permissoes";

// ── StatusCell ─────────────────────────────────────────────────────────────────

function StatusCell({
  status,
  onClick,
  disabled,
  loading,
}: {
  status: StatusDoc;
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
}) {
  const cfg = STATUS_CONFIG[status];
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      title={cfg.label}
      className={clsx(
        "w-8 h-8 rounded-md border flex items-center justify-center text-sm transition-all mx-auto",
        cfg.cls,
        !disabled && "hover:opacity-80 hover:scale-110 cursor-pointer",
        disabled && "cursor-default",
        loading && "animate-pulse",
      )}
    >
      {loading ? <RefreshCw size={12} className="animate-spin" /> : cfg.icon}
    </button>
  );
}

// ── Popup de seleção de status ─────────────────────────────────────────────────

function StatusPicker({
  current,
  onSelect,
  onClose,
}: {
  current: StatusDoc;
  onSelect: (s: StatusDoc) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1 overflow-hidden"
      onMouseLeave={onClose}
    >
      {STATUS_CICLO.map(s => {
        const cfg = STATUS_CONFIG[s];
        return (
          <button
            key={s}
            onClick={() => { onSelect(s); onClose(); }}
            className={clsx(
              "w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-slate-50 transition-colors",
              s === current && "bg-slate-100 font-semibold",
            )}
          >
            <span>{cfg.icon}</span>
            <span>{cfg.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Célula interativa (com picker) ────────────────────────────────────────────

function MatrizCell({
  empId, docTipo, statusAtual, canWrite,
}: {
  empId: string; docTipo: string; statusAtual: StatusDoc; canWrite: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: (s: StatusDoc) => documentosApi.atualizar(empId, docTipo, { status: s }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["matriz-documentos"] }),
  });

  return (
    <div className="relative flex items-center justify-center h-10">
      <StatusCell
        status={statusAtual}
        onClick={() => canWrite && setShowPicker(v => !v)}
        disabled={!canWrite}
        loading={mut.isPending}
      />
      {showPicker && canWrite && (
        <StatusPicker
          current={statusAtual}
          onSelect={s => mut.mutate(s)}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

// ── Linha categoria (header) ───────────────────────────────────────────────────

function CatRow({
  cat, collapsed, onToggle, emps, statusMap, canWrite,
}: {
  cat: typeof CATALOGO[0];
  collapsed: boolean;
  onToggle: () => void;
  emps: { id: string; nome: string }[];
  statusMap: Map<string, Record<string, string>>;
  canWrite: boolean;
}) {
  return (
    <>
      {/* Categoria header */}
      <tr className="bg-slate-50 border-b border-slate-200">
        <td colSpan={emps.length + 1} className="px-4 py-2">
          <button
            onClick={onToggle}
            className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wide hover:text-slate-800 transition-colors"
          >
            {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
            <span className="font-normal text-slate-400">({cat.docs.length})</span>
          </button>
        </td>
      </tr>
      {/* Documentos da categoria */}
      {!collapsed && cat.docs.map((doc, i) => (
        <tr
          key={doc.tipo}
          className={clsx(
            "border-b border-slate-100 hover:bg-slate-50/50 transition-colors",
            i % 2 === 0 ? "bg-white" : "bg-slate-50/30"
          )}
        >
          <td className="px-4 py-1 whitespace-nowrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-700">{doc.label}</span>
              <span className={clsx("text-[10px] font-medium px-1.5 py-0.5 rounded-full cursor-help", RESPONSAVEIS[doc.responsavel].cor)}
                title={`Responsável padrão: ${doc.responsavel} — ${RESPONSAVEIS[doc.responsavel].papel}.\nPara alterar o responsável deste documento, abra Empreendimentos › selecione o empreendimento › aba Documentos.`}>
                {doc.responsavel}
              </span>
              {doc.taxa && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700" title="Exige taxa/emolumento">
                  Taxa
                </span>
              )}
            </div>
          </td>
          {emps.map(emp => {
            const empStatuses = statusMap.get(emp.id) ?? {};
            const s = (empStatuses[doc.tipo] ?? "pendente") as StatusDoc;
            return (
              <td key={emp.id} className="px-2 py-1 min-w-[72px]">
                <MatrizCell
                  empId={emp.id}
                  docTipo={doc.tipo}
                  statusAtual={s}
                  canWrite={canWrite}
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export function Documentos() {
  const { user } = useAuthStore();
  const canWrite = podeEscrever(user?.papel);

  const { data: matriz = [], isLoading } = useQuery({
    queryKey: ["matriz-documentos"],
    queryFn: documentosApi.matriz,
  });

  // Grupos começam fechados por padrão (52 documentos — abre só o que precisar)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(CATALOGO.map(c => c.id)));

  // Mapa empId → statuses
  const statusMap = useMemo(
    () => new Map(matriz.map(e => [e.id, e.statuses])),
    [matriz],
  );

  function toggleCat(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Progresso por empreendimento
  function progresso(empId: string): number {
    const s = statusMap.get(empId) ?? {};
    return calcProgresso(s, TODOS_DOCS.map(d => d.tipo));
  }

  const MAX_EMP = 12;   // colunas máximas no layout

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <RefreshCw size={20} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (matriz.length === 0) {
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-3 text-slate-400">
        <FileText size={36} className="opacity-30" />
        <p className="font-medium">Nenhum empreendimento cadastrado</p>
        <p className="text-sm">Cadastre empreendimentos primeiro para gerenciar documentos.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Cabeçalho */}
      <div className="px-6 pt-5 pb-3 border-b border-slate-200 bg-white flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
          <FileText size={16} className="text-amber-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-bold text-slate-800">Status Documental — Todas as Obras</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {!canWrite && "Modo visualização · "}
            Clique em qualquer célula para atualizar o status
          </p>
        </div>
        {/* Legenda */}
        <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500">
          {(Object.entries(STATUS_CONFIG) as [StatusDoc, typeof STATUS_CONFIG[StatusDoc]][]).map(([key, cfg]) => (
            <span key={key} className="flex items-center gap-1">
              <span>{cfg.icon}</span> {cfg.label}
            </span>
          ))}
        </div>
      </div>

      {/* Tabela scrollável */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-20 bg-slate-800 shadow">
            <tr>
              {/* Coluna doc */}
              <th className="sticky left-0 z-30 bg-slate-800 px-4 py-2.5 text-left text-xs font-semibold text-amber-400 whitespace-nowrap min-w-[240px] border-r border-slate-700">
                Documento
              </th>
              {/* Coluna por empreendimento */}
              {matriz.slice(0, MAX_EMP).map(emp => {
                const pct = progresso(emp.id);
                return (
                  <th
                    key={emp.id}
                    className="px-2 py-2.5 text-center min-w-[72px] border-r border-slate-700 last:border-0"
                  >
                    <div className="text-xs font-bold text-white truncate max-w-[80px] mx-auto" title={emp.nome}>
                      {emp.nome.length > 10 ? emp.nome.slice(0, 10) + "…" : emp.nome}
                    </div>
                    {/* Barra de progresso */}
                    <div className="mt-1 h-1.5 rounded-full bg-slate-700 overflow-hidden mx-1">
                      <div
                        className={clsx(
                          "h-full rounded-full transition-all",
                          pct >= 100 ? "bg-emerald-400" : pct >= 60 ? "bg-blue-400" : "bg-amber-400"
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-slate-400 mt-0.5">{pct}%</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {CATALOGO.map(cat => (
              <CatRow
                key={cat.id}
                cat={cat}
                collapsed={collapsed.has(cat.id)}
                onToggle={() => toggleCat(cat.id)}
                emps={matriz.slice(0, MAX_EMP)}
                statusMap={statusMap}
                canWrite={canWrite}
              />
            ))}

            {/* Linha de totais */}
            <tr className="bg-slate-800 text-white">
              <td className="sticky left-0 bg-slate-800 px-4 py-2.5 text-xs font-bold text-amber-400">
                % Documentação Concluída
              </td>
              {matriz.slice(0, MAX_EMP).map(emp => {
                const pct = progresso(emp.id);
                return (
                  <td key={emp.id} className="text-center py-2.5">
                    <span className={clsx(
                      "text-xs font-bold",
                      pct >= 100 ? "text-emerald-400" : pct >= 60 ? "text-blue-400" : "text-amber-400"
                    )}>
                      {pct}%
                    </span>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>

        {/* Aviso se há mais empreendimentos do que colunas */}
        {matriz.length > MAX_EMP && (
          <div className="px-4 py-3 flex items-center gap-2 text-xs text-slate-500 bg-amber-50 border-t border-amber-100">
            <Info size={12} className="text-amber-500 shrink-0" />
            Exibindo {MAX_EMP} de {matriz.length} empreendimentos. Use a aba de Documentos em cada empreendimento para ver todos.
          </div>
        )}
      </div>
    </div>
  );
}
