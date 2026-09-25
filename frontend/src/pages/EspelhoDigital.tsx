import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Building2, Plus, Layers, Loader2, X, Trash2, Lock,
} from "lucide-react";
import { clsx } from "clsx";
import {
  empreendimentosApi, unidadesApi, leadsApi,
  type Unidade, type StatusUnidade, type ResumoEspelho,
} from "@/api/client";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { useAuthStore } from "@/stores/authStore";
import { ConfirmacaoDesconto, abaixoDoValorDeVenda } from "@/components/vendas/ConfirmacaoDesconto";

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

export const ORIENTACOES: Record<string, string> = {
  nascente: "Nascente (leste)", poente: "Poente (oeste)", ambas: "Ambas faces",
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500";

// ── Modal de edição de unidade ─────────────────────────────────────────────────

const num = (v: number | null | undefined) => (v == null ? null : Number(v));
const STATUS_CORRETOR: StatusUnidade[] = ["disponivel", "pre_reserva", "reservado", "vendido"];

function UnidadeModal({ unidade, onClose }: { unidade: Unidade; onClose: () => void }) {
  const qc = useQueryClient();
  const papel = useAuthStore(s => s.user?.papel);
  const meuId = useAuthStore(s => s.user?.id);
  const isCorretor = papel === "corretor";
  // Corretor só mexe em unidade livre ou que ele mesmo está negociando
  const bloqueada = isCorretor && (
    (unidade.corretor_id != null && unidade.corretor_id !== meuId) ||
    (unidade.corretor_id == null && unidade.status !== "disponivel")
  );

  const [status, setStatus] = useState<StatusUnidade>(unidade.status);
  const [custo, setCusto] = useState<number | null>(num(unidade.custo));
  const [avaliacao, setAvaliacao] = useState<number | null>(num(unidade.valor_avaliacao));
  const [valorDeVenda, setValorDeVenda] = useState<number | null>(num(unidade.preco_tabela));
  const [area, setArea] = useState(unidade.area_privativa_m2?.toString().replace(".", ",") ?? "");
  const [orientacao, setOrientacao] = useState(unidade.orientacao_solar ?? "");
  const [obs, setObs] = useState(unidade.observacao ?? "");
  // Bloco de negociação
  const [cliente, setCliente] = useState(unidade.cliente_nome ?? "");
  const [negociado, setNegociado] = useState<number | null>(num(unidade.valor_venda));
  const [subsidio, setSubsidio] = useState<number | null>(num(unidade.subsidio));
  const [fgts, setFgts] = useState<number | null>(num(unidade.fgts));
  const [recursoProprio, setRecursoProprio] = useState<number | null>(num(unidade.recurso_proprio));
  const [financiado, setFinanciado] = useState<number | null>(num(unidade.valor_financiado));
  const [corretorId, setCorretorId] = useState(unidade.corretor_id ?? "");
  const [confirmandoDesconto, setConfirmandoDesconto] = useState(false);
  const [erro, setErro] = useState("");

  const mostraVenda = status === "vendido" || status === "reservado" || status === "pre_reserva";

  // Admin pode atribuir/transferir a negociação a um corretor
  const { data: responsaveis = [] } = useQuery({
    queryKey: ["leads-responsaveis"],
    queryFn: () => leadsApi.responsaveis(),
    enabled: !isCorretor && mostraVenda,
  });

  // Composição de pagamento: a soma deve fechar o valor negociado
  const temComposicao = [subsidio, fgts, recursoProprio, financiado].some(v => v != null && v > 0);
  const somaComposicao = (subsidio ?? 0) + (fgts ?? 0) + (recursoProprio ?? 0) + (financiado ?? 0);
  const diferenca = (negociado ?? 0) - somaComposicao;
  const fechou = Math.abs(diferenca) < 0.01;
  const entradaSugerida = (negociado ?? 0) - (subsidio ?? 0) - (fgts ?? 0) - (financiado ?? 0);

  function montarPayload(): Partial<Unidade> {
    const negociacao = {
      cliente_nome: mostraVenda ? (cliente || null) : null,
      valor_venda: mostraVenda ? negociado : null,
      subsidio: mostraVenda ? subsidio : null,
      fgts: mostraVenda ? fgts : null,
      recurso_proprio: mostraVenda ? recursoProprio : null,
      valor_financiado: mostraVenda ? financiado : null,
    };
    // Corretor só envia status, observação e negociação — o resto é do admin
    if (isCorretor) return { status, observacao: obs || null, ...negociacao };
    return {
      status,
      custo,
      valor_avaliacao: avaliacao,
      preco_tabela: valorDeVenda,
      area_privativa_m2: area ? Number(area.replace(/\./g, "").replace(",", ".")) : null,
      observacao: obs || null,
      orientacao_solar: orientacao || null,
      ...negociacao,
      ...(corretorId !== (unidade.corretor_id ?? "") ? { corretor_id: corretorId || null } : {}),
    };
  }

  const salvar = useMutation({
    mutationFn: () => unidadesApi.atualizar(unidade.id, montarPayload()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unidades"] });
      qc.invalidateQueries({ queryKey: ["espelho-resumo"] });
      onClose();
    },
    onError: (e: any) => setErro(e?.response?.data?.detail ?? "Erro ao salvar a unidade"),
  });

  const excluir = useMutation({
    mutationFn: () => unidadesApi.excluir(unidade.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unidades"] });
      qc.invalidateQueries({ queryKey: ["espelho-resumo"] });
      onClose();
    },
    onError: (e: any) => setErro(e?.response?.data?.detail ?? "Erro ao excluir a unidade"),
  });

  function tentarSalvar() {
    setErro("");
    if (mostraVenda && abaixoDoValorDeVenda(negociado, valorDeVenda)) {
      setConfirmandoDesconto(true);
      return;
    }
    salvar.mutate();
  }

  const statusVisiveis = isCorretor ? STATUS_CORRETOR : STATUS_ORDEM;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      {confirmandoDesconto && negociado != null && valorDeVenda != null && (
        <ConfirmacaoDesconto
          valorVenda={valorDeVenda}
          valorNegociado={negociado}
          onRevisar={() => setConfirmandoDesconto(false)}
          onConfirmar={() => { setConfirmandoDesconto(false); salvar.mutate(); }}
        />
      )}
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">
            {unidade.grupo} · {unidade.identificador}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        {bloqueada ? (
          // ── Visão somente leitura: unidade de outro corretor ou travada pelo admin
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-start gap-3 rounded-lg bg-orange-50 border border-orange-200 px-3 py-3">
              <Lock size={16} className="text-orange-600 mt-0.5 shrink-0" />
              <p className="text-sm text-orange-800">
                {unidade.corretor_nome
                  ? <>Em negociação com <strong>{unidade.corretor_nome}</strong>. Só ele(a) ou um administrador pode alterar esta unidade.</>
                  : <>Unidade <strong>{STATUS[unidade.status].label.toLowerCase()}</strong>. Só um administrador pode alterá-la.</>}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-slate-500">Status</dt><dd className="font-medium text-slate-800">{STATUS[unidade.status].label}</dd></div>
              <div><dt className="text-xs text-slate-500">Valor de Venda</dt><dd className="font-medium text-slate-800">{unidade.preco_tabela ? fmt(Number(unidade.preco_tabela)) : "—"}</dd></div>
              <div><dt className="text-xs text-slate-500">Área privativa</dt><dd className="font-medium text-slate-800">{unidade.area_privativa_m2 ? `${unidade.area_privativa_m2} m²` : "—"}</dd></div>
              <div><dt className="text-xs text-slate-500">Orientação</dt><dd className="font-medium text-slate-800">{unidade.orientacao_solar ? ORIENTACOES[unidade.orientacao_solar] : "—"}</dd></div>
            </dl>
            <button onClick={onClose} className="w-full px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
              Fechar
            </button>
          </div>
        ) : (
        <div className="px-6 py-5 space-y-4">
          {/* Status — pills clicáveis */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Status</label>
            <div className="grid grid-cols-3 gap-1.5">
              {statusVisiveis.map(s => (
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

          {isCorretor ? (
            // Corretor vê os dados da unidade, mas não altera valores nem características
            <dl className="grid grid-cols-3 gap-3 text-sm bg-slate-50 rounded-lg px-3 py-2.5">
              <div><dt className="text-xs text-slate-500">Valor de Venda</dt><dd className="font-semibold text-slate-800">{valorDeVenda ? fmt(valorDeVenda) : "—"}</dd></div>
              <div><dt className="text-xs text-slate-500">Área</dt><dd className="font-medium text-slate-800">{unidade.area_privativa_m2 ? `${unidade.area_privativa_m2} m²` : "—"}</dd></div>
              <div><dt className="text-xs text-slate-500">Orientação</dt><dd className="font-medium text-slate-800">{unidade.orientacao_solar ? ORIENTACOES[unidade.orientacao_solar] : "—"}</dd></div>
            </dl>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <CurrencyInput label="Custo" nullable small value={custo} onChange={setCusto} placeholder="Ex: 220.000,00" />
                <CurrencyInput label="Valor de Avaliação" nullable small value={avaliacao} onChange={setAvaliacao} placeholder="Ex: 330.000,00" />
                <CurrencyInput label="Valor de Venda" nullable small value={valorDeVenda} onChange={setValorDeVenda} placeholder="Ex: 350.000,00" />
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Área privativa (m²)</label>
                  <input value={area} onChange={e => setArea(e.target.value.replace(/[^\d,]/g, ""))}
                    inputMode="decimal" className={inputClass} placeholder="Ex: 48,50" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Orientação solar</label>
                <select value={orientacao} onChange={e => setOrientacao(e.target.value)} className={clsx(inputClass, "bg-white")}>
                  <option value="">— Não definida —</option>
                  {Object.entries(ORIENTACOES).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
              </div>
            </>
          )}

          {mostraVenda && (
            <div className="space-y-3 bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-xs font-semibold text-slate-600">Dados da negociação</p>
              {!isCorretor && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Corretor responsável</label>
                  <select value={corretorId} onChange={e => setCorretorId(e.target.value)} className={clsx(inputClass, "bg-white")}>
                    <option value="">{unidade.corretor_id ? "— Sem corretor —" : "— Eu (quem salvar) —"}</option>
                    {responsaveis.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Cliente</label>
                <input value={cliente} onChange={e => setCliente(e.target.value)} className={inputClass} placeholder="Nome do comprador" />
              </div>
              <CurrencyInput label="Valor negociado" nullable small value={negociado} onChange={setNegociado}
                placeholder="Ex: 345.000,00"
                dica={valorDeVenda ? `Valor de venda: ${fmt(valorDeVenda)}` : undefined} />

              <div className="pt-2 border-t border-slate-200">
                <p className="text-xs font-semibold text-slate-600 mb-2">Composição do pagamento</p>
                <div className="grid grid-cols-2 gap-2">
                  <CurrencyInput label="Subsídio" nullable small value={subsidio} onChange={setSubsidio} />
                  <CurrencyInput label="FGTS" nullable small value={fgts} onChange={setFgts} />
                  <CurrencyInput label="Recurso Próprio / Entrada" nullable small value={recursoProprio} onChange={setRecursoProprio} />
                  <CurrencyInput label="Valor Financiado" nullable small value={financiado} onChange={setFinanciado} />
                </div>
                {temComposicao && (
                  <div className={clsx(
                    "mt-2 rounded-lg px-3 py-2 text-xs flex items-center justify-between gap-2",
                    fechou ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800",
                  )}>
                    <span>
                      Soma: <strong className="tabular-nums">{fmt(somaComposicao)}</strong>
                      {negociado != null && !fechou && (
                        <> · {diferenca > 0 ? "faltam" : "excede em"} <strong className="tabular-nums">{fmt(Math.abs(diferenca))}</strong></>
                      )}
                      {negociado != null && fechou && " · fecha o valor negociado"}
                    </span>
                    {negociado != null && !fechou && entradaSugerida >= 0 && (
                      <button onClick={() => setRecursoProprio(Math.round(entradaSugerida * 100) / 100)}
                        className="shrink-0 font-semibold underline hover:no-underline">
                        Ajustar entrada
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Observação</label>
            <input value={obs} onChange={e => setObs(e.target.value)} className={inputClass} placeholder="Opcional" />
          </div>

          {erro && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{erro}</div>
          )}

          <div className="flex gap-2 pt-1">
            {!isCorretor && (
              <button onClick={() => excluir.mutate()} disabled={excluir.isPending}
                className="p-2.5 rounded-lg text-red-500 border border-red-200 hover:bg-red-50" title="Excluir unidade">
                <Trash2 size={16} />
              </button>
            )}
            <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={tentarSalvar} disabled={salvar.isPending}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {salvar.isPending && <Loader2 size={14} className="animate-spin" />}
              Salvar
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

export function EspelhoDigital() {
  const navigate = useNavigate();
  const papel = useAuthStore(s => s.user?.papel);
  const meuId = useAuthStore(s => s.user?.id);
  const isCorretor = papel === "corretor";
  const [empId, setEmpId] = useState<string>("");
  const [editando, setEditando] = useState<Unidade | null>(null);

  const { data: empreendimentos } = useQuery({
    queryKey: ["empreendimentos", { espelho: true }],
    queryFn: () => empreendimentosApi.listar({ por_pagina: 100 }),
  });
  const lista = empreendimentos?.items ?? [];
  const empSelecionado = empId || lista[0]?.id || "";
  const empAtual = lista.find((e: any) => e.id === empSelecionado);

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
            {empSelecionado && !isCorretor && (
              <button onClick={() => navigate(`/espelho/${empSelecionado}/gerar`)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 whitespace-nowrap">
                <Plus size={15} /> Cadastrar unidades
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
                  {empAtual?.num_unidades != null && (
                    <p className="text-xs text-slate-500">
                      Cadastradas: <strong className={clsx(resumo.total >= empAtual.num_unidades ? "text-emerald-700" : "text-slate-700")}>{resumo.total} de {empAtual.num_unidades}</strong>
                    </p>
                  )}
                  {empAtual?.num_pavimentos_estimado != null && (
                    <p className="text-xs text-slate-500">Andares: <strong className="text-slate-700">{empAtual.num_pavimentos_estimado}</strong></p>
                  )}
                  <p className="text-xs text-slate-500">VGV (valor de venda): <strong className="text-slate-700">{fmt(resumo.vgv_tabela)}</strong></p>
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
                <p className="text-xs mt-1">{isCorretor ? "O administrador ainda não cadastrou as unidades deste empreendimento." : "Use \"Cadastrar unidades\" para criar as unidades do empreendimento."}</p>
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
                          title={`${u.identificador} · ${STATUS[u.status].label}${u.area_privativa_m2 ? " · " + u.area_privativa_m2 + "m²" : ""}${u.orientacao_solar ? " · " + ORIENTACOES[u.orientacao_solar] : ""}${u.corretor_nome ? " · Corretor: " + u.corretor_nome : ""}${u.cliente_nome ? " · " + u.cliente_nome : ""}`}
                          className={clsx(
                            "aspect-square rounded-lg flex flex-col items-center justify-center text-[11px] font-semibold leading-none transition-all hover:scale-105 hover:shadow-md",
                            STATUS[u.status].cell,
                            isCorretor && u.corretor_id === meuId && "ring-2 ring-offset-2 ring-brand-600",
                          )}>
                          <span>{u.identificador}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Legenda */}
                <div className="flex flex-wrap gap-3 px-1 pt-1">
                  {isCorretor && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded ring-2 ring-offset-1 ring-brand-600 bg-white" />
                      <span className="text-xs text-slate-500">Suas negociações</span>
                    </div>
                  )}
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
