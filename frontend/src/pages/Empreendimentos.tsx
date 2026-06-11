import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Search, Trash2, RotateCcw, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";
import { empreendimentosApi } from "@/api/client";
import { ConfirmarExclusaoModal } from "@/components/empreendimentos/ConfirmarExclusaoModal";
import { EmpreendimentoCard } from "@/components/empreendimentos/EmpreendimentoCard";
import { EmpreendimentoForm } from "@/components/empreendimentos/EmpreendimentoForm";
import type { EmpreendimentoLista, EmpreendimentoResponse } from "@/types";

const FILTROS_STATUS = [
  { value: "", label: "Todos" },
  { value: "estudo", label: "Estudo" },
  { value: "viabilidade", label: "Viabilidade" },
  { value: "aprovacao", label: "Aprovação" },
  { value: "em_obras", label: "Em obras" },
  { value: "entregue", label: "Entregue" },
];

type Aba = "ativos" | "lixeira";

export function Empreendimentos() {
  const qc = useQueryClient();
  const [aba, setAba] = useState<Aba>("ativos");
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");
  const [pagina, setPagina] = useState(1);
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<EmpreendimentoResponse | null>(null);
  const [excluindo, setExcluindo] = useState<EmpreendimentoResponse | null>(null);
  const [excluirPermanente, setExcluirPermanente] = useState<EmpreendimentoResponse | null>(null);

  // Lista padrão (ativos)
  const { data, isLoading, isError } = useQuery<EmpreendimentoLista>({
    queryKey: ["empreendimentos", { busca, statusFiltro, pagina }],
    queryFn: () =>
      empreendimentosApi.listar({
        busca: busca || undefined,
        status: statusFiltro || undefined,
        pagina,
        por_pagina: 12,
      }),
    staleTime: 30_000,
    enabled: aba === "ativos",
  });

  // Lixeira
  const { data: lixeira = [], isLoading: loadingLixeira } = useQuery<EmpreendimentoResponse[]>({
    queryKey: ["empreendimentos-lixeira"],
    queryFn: () => empreendimentosApi.listarLixeira(),
    enabled: aba === "lixeira",
  });

  // Mover para lixeira (soft delete)
  const mutExcluir = useMutation({
    mutationFn: (id: string) => empreendimentosApi.excluir(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empreendimentos"] });
      qc.invalidateQueries({ queryKey: ["empreendimentos-lixeira"] });
      setExcluindo(null);
    },
  });

  // Restaurar da lixeira
  const mutRestaurar = useMutation({
    mutationFn: (id: string) => empreendimentosApi.restaurar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empreendimentos"] });
      qc.invalidateQueries({ queryKey: ["empreendimentos-lixeira"] });
    },
  });

  // Exclusão definitiva
  const mutPermanente = useMutation({
    mutationFn: (id: string) => empreendimentosApi.excluirPermanente(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empreendimentos-lixeira"] });
      setExcluirPermanente(null);
    },
  });

  function abrirNovo() {
    setEditando(null);
    setFormAberto(true);
  }

  function abrirEdicao(emp: EmpreendimentoResponse) {
    setEditando(emp);
    setFormAberto(true);
  }

  const totalPaginas = data ? Math.ceil(data.total / data.por_pagina) : 0;

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* ── Tabs: Ativos | Lixeira ───────────────────────────────────── */}
      <div className="border-b border-slate-200 -mb-1">
        <nav className="flex gap-1">
          <button
            onClick={() => setAba("ativos")}
            className={clsx(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2",
              aba === "ativos"
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300",
            )}
          >
            <Building2 size={14} />
            Empreendimentos
            {data && (
              <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                {data.total}
              </span>
            )}
          </button>
          <button
            onClick={() => setAba("lixeira")}
            className={clsx(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2",
              aba === "lixeira"
                ? "border-red-500 text-red-700"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300",
            )}
          >
            <Trash2 size={14} />
            Lixeira
            {lixeira.length > 0 && (
              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">
                {lixeira.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {aba === "ativos" && (
        <>
          {/* Barra de ações */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <div className="flex gap-2 flex-1">
              {/* Campo de busca */}
              <div className="relative flex-1 max-w-xs">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar empreendimento…"
                  value={busca}
                  onChange={e => { setBusca(e.target.value); setPagina(1); }}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
                />
              </div>

              {/* Filtro de status */}
              <div className="flex gap-1 flex-wrap">
                {FILTROS_STATUS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => { setStatusFiltro(f.value); setPagina(1); }}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      statusFiltro === f.value
                        ? "bg-brand-600 text-white"
                        : "bg-white border border-slate-300 text-slate-600 hover:border-brand-400"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Botão novo */}
            <button
              onClick={abrirNovo}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors shrink-0"
            >
              <Plus size={16} />
              Novo empreendimento
            </button>
          </div>

          {/* Contador */}
          {data && (
            <p className="text-sm text-slate-500">
              {data.total === 0 ? "Nenhum empreendimento encontrado" :
               `${data.total} empreendimento${data.total > 1 ? "s" : ""} encontrado${data.total > 1 ? "s" : ""}`}
            </p>
          )}

          {/* Grade de cards */}
          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 h-48 animate-pulse">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 bg-slate-200 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                      <div className="h-3 bg-slate-100 rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-5 py-4 rounded-xl">
              Erro ao carregar empreendimentos. Verifique se a API está rodando.
            </div>
          )}

          {!isLoading && !isError && data?.items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Building2 size={40} className="mb-3 opacity-30" />
              <p className="font-medium">Nenhum empreendimento cadastrado</p>
              <p className="text-sm mt-1">Clique em "Novo empreendimento" para começar</p>
            </div>
          )}

          {!isLoading && data && data.items.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.items.map(emp => (
                <EmpreendimentoCard
                  key={emp.id}
                  emp={emp}
                  onEditar={abrirEdicao}
                  onExcluir={setExcluindo}
                />
              ))}
            </div>
          )}

          {/* Paginação */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                disabled={pagina === 1}
                onClick={() => setPagina(p => p - 1)}
                className="px-3 py-1.5 rounded-lg text-sm border border-slate-300 disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                ← Anterior
              </button>
              <span className="text-sm text-slate-500">
                Página {pagina} de {totalPaginas}
              </span>
              <button
                disabled={pagina === totalPaginas}
                onClick={() => setPagina(p => p + 1)}
                className="px-3 py-1.5 rounded-lg text-sm border border-slate-300 disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                Próxima →
              </button>
            </div>
          )}
        </>
      )}

      {/* ── ABA LIXEIRA ─────────────────────────────────────────────── */}
      {aba === "lixeira" && (
        <LixeiraView
          items={lixeira}
          isLoading={loadingLixeira}
          onRestaurar={(id) => mutRestaurar.mutate(id)}
          onExcluirPermanente={setExcluirPermanente}
          restaurando={mutRestaurar.isPending ? mutRestaurar.variables : null}
        />
      )}

      {/* Modal de formulário */}
      <EmpreendimentoForm
        aberto={formAberto}
        onFechar={() => { setFormAberto(false); setEditando(null); }}
        editando={editando}
      />

      {/* Modal de confirmação de exclusão (2-step) */}
      {excluindo && (
        <ConfirmarExclusaoModal
          emp={excluindo}
          onCancelar={() => setExcluindo(null)}
          onConfirmar={() => mutExcluir.mutate(excluindo.id)}
          loading={mutExcluir.isPending}
        />
      )}

      {/* Modal de exclusão DEFINITIVA (vindo da lixeira) */}
      {excluirPermanente && (
        <ExclusaoPermanenteModal
          emp={excluirPermanente}
          onCancelar={() => setExcluirPermanente(null)}
          onConfirmar={() => mutPermanente.mutate(excluirPermanente.id)}
          loading={mutPermanente.isPending}
          erro={(mutPermanente.error as any)?.response?.data?.detail}
        />
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// LixeiraView — listagem dos empreendimentos soft-deleted
// ─────────────────────────────────────────────────────────────────────────────

function LixeiraView({
  items, isLoading, onRestaurar, onExcluirPermanente, restaurando,
}: {
  items: EmpreendimentoResponse[];
  isLoading: boolean;
  onRestaurar: (id: string) => void;
  onExcluirPermanente: (emp: EmpreendimentoResponse) => void;
  restaurando: string | null;
}) {
  if (isLoading) {
    return <div className="text-sm text-slate-400 py-6">Carregando lixeira…</div>;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Trash2 size={40} className="mb-3 opacity-30" />
        <p className="font-medium">Lixeira vazia</p>
        <p className="text-sm mt-1">Empreendimentos excluídos aparecem aqui</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
        <ShieldAlert className="text-amber-600 shrink-0 mt-0.5" size={18} />
        <div className="text-sm text-amber-900">
          <p className="font-semibold">Itens na Lixeira</p>
          <p className="text-xs text-amber-800 mt-0.5">
            Os dados ficam preservados aqui até serem restaurados ou excluídos definitivamente.
            <strong> A exclusão definitiva apaga todos os dados — não há como reverter.</strong>
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {items.map(emp => (
          <div key={emp.id}
            className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 hover:border-slate-300 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center text-lg shrink-0">
              {emp.tipo === "residencial_vertical" ? "🏢" :
               emp.tipo === "residencial_horizontal" ? "🏘️" :
               emp.tipo === "comercial" ? "🏪" :
               emp.tipo === "misto" ? "🏙️" : "🏗️"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-700 truncate">{emp.nome}</p>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span>{emp.endereco?.cidade}, {emp.endereco?.uf}</span>
                <span>·</span>
                <span>{emp.total_obras} obra{emp.total_obras !== 1 ? "s" : ""}</span>
                {emp.deleted_at && (
                  <>
                    <span>·</span>
                    <span className="text-red-600">
                      Excluído em {new Date(emp.deleted_at).toLocaleDateString("pt-BR")}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onRestaurar(emp.id)}
                disabled={restaurando === emp.id}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                <RotateCcw size={12} />
                {restaurando === emp.id ? "Restaurando…" : "Restaurar"}
              </button>
              <button
                onClick={() => onExcluirPermanente(emp)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-600 hover:text-white text-red-700 text-xs font-semibold rounded-lg transition-colors"
              >
                <Trash2 size={12} />
                Excluir definitivamente
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// ExclusaoPermanenteModal — confirmação final em RED, irreversível
// ─────────────────────────────────────────────────────────────────────────────

function ExclusaoPermanenteModal({
  emp, onCancelar, onConfirmar, loading, erro,
}: {
  emp: EmpreendimentoResponse;
  onCancelar: () => void;
  onConfirmar: () => void;
  loading?: boolean;
  erro?: string;
}) {
  const [texto, setTexto] = useState("");
  const ok = texto.trim().toUpperCase() === "EXCLUIR DEFINITIVAMENTE";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onCancelar} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-slide-in">
        <div className="p-6 bg-gradient-to-br from-red-500 to-red-700 text-white">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <ShieldAlert size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">⚠️ Exclusão DEFINITIVA</h3>
              <p className="text-sm text-red-100 mt-1">Esta ação é <strong>IRREVERSÍVEL</strong>.</p>
            </div>
            <button onClick={onCancelar} className="p-1 rounded-lg hover:bg-white/20">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div className="bg-red-50 border-l-4 border-red-600 rounded-r-lg px-4 py-3">
            <p className="text-sm text-red-900 font-bold leading-relaxed mb-2">
              🚨 Tudo será PERDIDO permanentemente:
            </p>
            <ul className="text-xs text-red-800 space-y-1 ml-1">
              <li>✗ O empreendimento <strong>"{emp.nome}"</strong></li>
              <li>✗ Todas as obras vinculadas e suas etapas</li>
              <li>✗ Orçamentos, lançamentos financeiros, RDOs, capturas 360</li>
              <li>✗ Histórico completo — <strong>NÃO há como recuperar</strong></li>
            </ul>
          </div>

          <div>
            <label className="block text-xs font-bold text-red-700 uppercase tracking-wide mb-1.5">
              Para confirmar, digite: <span className="font-mono">EXCLUIR DEFINITIVAMENTE</span>
            </label>
            <input
              type="text"
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="EXCLUIR DEFINITIVAMENTE"
              className={clsx(
                "w-full px-3 py-2 border-2 rounded-lg text-sm font-mono outline-none transition-colors",
                ok
                  ? "border-red-500 bg-red-50 text-red-800 font-bold"
                  : "border-slate-300 focus:border-red-500 focus:ring-1 focus:ring-red-300"
              )}
            />
          </div>

          {erro && (
            <div className="bg-red-100 border border-red-300 rounded-lg px-3 py-2 text-xs text-red-800">
              ⚠️ {erro}
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 pb-6 flex items-center gap-2 justify-end">
          <button onClick={onCancelar}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={!ok || loading}
            className={clsx(
              "flex items-center gap-2 px-5 py-2.5 font-bold text-sm rounded-xl transition-all",
              ok && !loading
                ? "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg active:scale-95"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            )}>
            <Trash2 size={14} />
            {loading ? "Apagando…" : "Apagar permanentemente"}
          </button>
        </div>
      </div>
    </div>
  );
}
