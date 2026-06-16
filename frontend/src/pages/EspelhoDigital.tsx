import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2, Plus, Layers, Loader2, AlertCircle, X, Trash2, Wand2,
} from "lucide-react";
import { clsx } from "clsx";
import {
  empreendimentosApi, unidadesApi,
  type Unidade, type StatusUnidade, type ResumoEspelho,
} from "@/api/client";

// ── Config de status (cores alinhadas ao espelho digital) ──────────────────────

const STATUS: Record<StatusUnidade, { label: string; chip: string; cell: string; dot: string }> = {
  disponivel:   { label: "Disponível",   chip: "bg-emerald-100 text-emerald-700", cell: "bg-emerald-500 hover:bg-emerald-600 text-white",   dot: "bg-emerald-500" },
  pre_reserva:  { label: "Pré-reserva",  chip: "bg-yellow-100 text-yellow-700",   cell: "bg-yellow-400 hover:bg-yellow-500 text-yellow-950", dot: "bg-yellow-400" },
  reservado:    { label: "Reservado",    chip: "bg-orange-100 text-orange-700",   cell: "bg-orange-500 hover:bg-orange-600 text-white",     dot: "bg-orange-500" },
  vendido:      { label: "Vendido",      chip: "bg-blue-100 text-blue-700",       cell: "bg-blue-600 hover:bg-blue-700 text-white",         dot: "bg-blue-600" },
  permuta:      { label: "Permuta",      chip: "bg-violet-100 text-violet-700",   cell: "bg-violet-500 hover:bg-violet-600 text-white",     dot: "bg-violet-500" },
  indisponivel: { label: "Indisponível", chip: "bg-slate-200 text-slate-600",     cell: "bg-slate-400 hover:bg-slate-500 text-white",       dot: "bg-slate-400" },
};
const STATUS_ORDEM: StatusUnidade[] = ["disponivel", "pre_reserva", "reservado", "vendido", "permuta", "indisponivel"];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500";

// ── Modal de edição de unidade ─────────────────────────────────────────────────

function UnidadeModal({ unidade, onClose }: { unidade: Unidade; onClose: () => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<StatusUnidade>(unidade.status);
  const [precoTabela, setPrecoTabela] = useState(unidade.preco_tabela?.toString() ?? "");
  const [area, setArea] = useState(unidade.area_privativa_m2?.toString() ?? "");
  const [cliente, setCliente] = useState(unidade.cliente_nome ?? "");
  const [valorVenda, setValorVenda] = useState(unidade.valor_venda?.toString() ?? "");
  const [obs, setObs] = useState(unidade.observacao ?? "");

  const mostraVenda = status === "vendido" || status === "reservado" || status === "pre_reserva";

  const salvar = useMutation({
    mutationFn: () => unidadesApi.atualizar(unidade.id, {
      status,
      preco_tabela: precoTabela ? Number(precoTabela) : null,
      area_privativa_m2: area ? Number(area) : null,
      cliente_nome: mostraVenda ? (cliente || null) : null,
      valor_venda: mostraVenda && valorVenda ? Number(valorVenda) : null,
      observacao: obs || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unidades"] });
      qc.invalidateQueries({ queryKey: ["espelho-resumo"] });
      onClose();
    },
  });

  const excluir = useMutation({
    mutationFn: () => unidadesApi.excluir(unidade.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unidades"] });
      qc.invalidateQueries({ queryKey: ["espelho-resumo"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">
            {unidade.grupo} · {unidade.identificador}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Status — pills clicáveis */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Status</label>
            <div className="grid grid-cols-3 gap-1.5">
              {STATUS_ORDEM.map(s => (
                <button key={s} onClick={() => setStatus(s)}
                  className={clsx(
                    "py-1.5 rounded-lg text-xs font-medium border-2 transition-all",
                    status === s ? STATUS[s].chip + " border-current" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                  )}>
                  {STATUS[s].label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Preço de tabela (R$)</label>
              <input type="number" value={precoTabela} onChange={e => setPrecoTabela(e.target.value)} className={inputClass} placeholder="350000" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Área privativa (m²)</label>
              <input type="number" value={area} onChange={e => setArea(e.target.value)} className={inputClass} placeholder="48" />
            </div>
          </div>

          {mostraVenda && (
            <div className="space-y-3 bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-xs font-semibold text-slate-600">Dados da negociação</p>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Cliente</label>
                <input value={cliente} onChange={e => setCliente(e.target.value)} className={inputClass} placeholder="Nome do comprador" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Valor da venda (R$)</label>
                <input type="number" value={valorVenda} onChange={e => setValorVenda(e.target.value)} className={inputClass} placeholder="350000" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Observação</label>
            <input value={obs} onChange={e => setObs(e.target.value)} className={inputClass} placeholder="Opcional" />
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => excluir.mutate()} disabled={excluir.isPending}
              className="p-2.5 rounded-lg text-red-500 border border-red-200 hover:bg-red-50" title="Excluir unidade">
              <Trash2 size={16} />
            </button>
            <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={() => salvar.mutate()} disabled={salvar.isPending}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {salvar.isPending && <Loader2 size={14} className="animate-spin" />}
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal de geração em massa ──────────────────────────────────────────────────

function GerarModal({ empId, onClose }: { empId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [grupo, setGrupo] = useState("");
  const [tipo, setTipo] = useState("apartamento");
  const [quantidade, setQuantidade] = useState("10");
  const [inicio, setInicio] = useState("101");
  const [prefixo, setPrefixo] = useState("");
  const [area, setArea] = useState("");
  const [preco, setPreco] = useState("");
  const [erro, setErro] = useState("");

  const gerar = useMutation({
    mutationFn: () => unidadesApi.gerar(empId, {
      grupo, tipo, quantidade: Number(quantidade), inicio: Number(inicio),
      prefixo, area_privativa_m2: area ? Number(area) : null, preco_tabela: preco ? Number(preco) : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unidades"] });
      qc.invalidateQueries({ queryKey: ["espelho-resumo"] });
      onClose();
    },
    onError: (e: any) => setErro(e?.response?.data?.detail ?? "Erro ao gerar unidades"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Wand2 size={16} className="text-brand-600" /> Gerar unidades em lote
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Grupo *</label>
              <input value={grupo} onChange={e => setGrupo(e.target.value)} className={inputClass} placeholder="Quadra 1 / Torre A" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)} className={clsx(inputClass, "bg-white")}>
                <option value="apartamento">Apartamento</option>
                <option value="lote">Lote</option>
                <option value="casa">Casa</option>
                <option value="sala">Sala comercial</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Quantidade *</label>
              <input type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Nº inicial</label>
              <input type="number" value={inicio} onChange={e => setInicio(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Prefixo</label>
              <input value={prefixo} onChange={e => setPrefixo(e.target.value)} className={inputClass} placeholder="Apto " />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Área padrão (m²)</label>
              <input type="number" value={area} onChange={e => setArea(e.target.value)} className={inputClass} placeholder="48" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Preço padrão (R$)</label>
              <input type="number" value={preco} onChange={e => setPreco(e.target.value)} className={inputClass} placeholder="350000" />
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Exemplo: gera <strong>{quantidade || 0}</strong> unidades de "{prefixo}{inicio || 0}" a "{prefixo}{Number(inicio || 0) + Number(quantidade || 1) - 1}" no grupo <strong>{grupo || "—"}</strong>.
          </p>
          {erro && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle size={14} /> {erro}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button onClick={() => { setErro(""); if (!grupo.trim()) { setErro("Informe o grupo"); return; } gerar.mutate(); }}
              disabled={gerar.isPending}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {gerar.isPending && <Loader2 size={14} className="animate-spin" />}
              Gerar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

export function EspelhoDigital() {
  const [empId, setEmpId] = useState<string>("");
  const [editando, setEditando] = useState<Unidade | null>(null);
  const [gerando, setGerando] = useState(false);

  const { data: empreendimentos } = useQuery({
    queryKey: ["empreendimentos", { espelho: true }],
    queryFn: () => empreendimentosApi.listar({ por_pagina: 100 }),
  });
  const lista = empreendimentos?.items ?? [];
  const empSelecionado = empId || lista[0]?.id || "";

  const { data: unidades = [], isLoading } = useQuery({
    queryKey: ["unidades", empSelecionado],
    queryFn: () => unidadesApi.listar(empSelecionado),
    enabled: !!empSelecionado,
  });

  const { data: resumo } = useQuery<ResumoEspelho>({
    queryKey: ["espelho-resumo", empSelecionado],
    queryFn: () => unidadesApi.resumo(empSelecionado),
    enabled: !!empSelecionado,
  });

  // Agrupa unidades por "grupo"
  const grupos = unidades.reduce<Record<string, Unidade[]>>((acc, u) => {
    (acc[u.grupo] ??= []).push(u);
    return acc;
  }, {});

  return (
    <>
      {editando && <UnidadeModal unidade={editando} onClose={() => setEditando(null)} />}
      {gerando && empSelecionado && <GerarModal empId={empSelecionado} onClose={() => setGerando(false)} />}

      <div className="p-6 max-w-6xl mx-auto">
        {/* Cabeçalho + seletor */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Espelho Digital</h1>
            <p className="text-sm text-slate-500 mt-0.5">Disponibilidade e status de venda das unidades</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={empSelecionado}
              onChange={e => setEmpId(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            >
              {lista.length === 0 && <option value="">— Sem empreendimentos —</option>}
              {lista.map((e: any) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
            {empSelecionado && (
              <button onClick={() => setGerando(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 whitespace-nowrap">
                <Plus size={15} /> Gerar
              </button>
            )}
          </div>
        </div>

        {!empSelecionado ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center text-slate-400">
            <Building2 size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm">Cadastre um empreendimento primeiro.</p>
          </div>
        ) : (
          <>
            {/* Resumo Geral */}
            {resumo && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-800">{resumo.total}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Total</p>
                  </div>
                  {STATUS_ORDEM.map(s => {
                    const n = resumo.por_status[s] ?? 0;
                    const pct = resumo.total ? Math.round((n / resumo.total) * 100) : 0;
                    return (
                      <div key={s} className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={clsx("w-2 h-2 rounded-full", STATUS[s].dot)} />
                          <p className="text-2xl font-bold text-slate-800">{n}</p>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{STATUS[s].label} · {pct}%</p>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-x-8 gap-y-1 mt-4 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500">VGV tabela: <strong className="text-slate-700">{fmt(resumo.vgv_tabela)}</strong></p>
                  <p className="text-xs text-slate-500">VGV vendido: <strong className="text-blue-700">{fmt(resumo.vgv_vendido)}</strong></p>
                  {resumo.vgv_tabela > 0 && (
                    <p className="text-xs text-slate-500">% vendido: <strong className="text-emerald-700">{Math.round((resumo.vgv_vendido / resumo.vgv_tabela) * 100)}%</strong></p>
                  )}
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center h-40 text-slate-400">
                <Loader2 size={22} className="animate-spin mr-2" /> Carregando…
              </div>
            ) : unidades.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center text-slate-400">
                <Layers size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-medium">Nenhuma unidade cadastrada</p>
                <p className="text-xs mt-1">Use "Gerar" para criar as unidades de uma quadra ou torre.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(grupos).map(([grupo, us]) => (
                  <div key={grupo} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-slate-800 text-sm">{grupo}</h3>
                      <span className="text-xs text-slate-400">{us.length} unidades</span>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-12 gap-1.5">
                      {us.map(u => (
                        <button key={u.id} onClick={() => setEditando(u)}
                          title={`${u.identificador} · ${STATUS[u.status].label}${u.cliente_nome ? " · " + u.cliente_nome : ""}`}
                          className={clsx(
                            "aspect-square rounded-lg flex flex-col items-center justify-center text-[11px] font-semibold leading-none transition-all hover:scale-105 hover:shadow-md",
                            STATUS[u.status].cell
                          )}>
                          <span>{u.identificador}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Legenda */}
                <div className="flex flex-wrap gap-3 px-1 pt-1">
                  {STATUS_ORDEM.map(s => (
                    <div key={s} className="flex items-center gap-1.5">
                      <span className={clsx("w-3 h-3 rounded", STATUS[s].cell.split(" ")[0])} />
                      <span className="text-xs text-slate-500">{STATUS[s].label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
