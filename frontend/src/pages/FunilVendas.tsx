import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, X, Loader2, Trash2, User, Building2, Home, Clock, TrendingUp, Trophy, AlertCircle,
} from "lucide-react";
import { clsx } from "clsx";
import {
  leadsApi, empreendimentosApi, unidadesApi,
  type Lead, type EtapaFunil, type FunilResponse,
} from "@/api/client";

// ── Config das etapas (ordem + cor) ────────────────────────────────────────────

const ETAPAS: { id: EtapaFunil; label: string; cor: string; barra: string }[] = [
  { id: "pre_atendimento", label: "Pré-Atendimento", cor: "text-slate-600",   barra: "bg-slate-400"   },
  { id: "visita",          label: "Visita",          cor: "text-sky-600",     barra: "bg-sky-400"     },
  { id: "atendimento",     label: "Atendimento",     cor: "text-indigo-600",  barra: "bg-indigo-400"  },
  { id: "pasta_digital",   label: "Pasta Digital",   cor: "text-amber-600",   barra: "bg-amber-400"   },
  { id: "proposta",        label: "Proposta",        cor: "text-orange-600",  barra: "bg-orange-400"  },
  { id: "contrato",        label: "Contrato",        cor: "text-emerald-600", barra: "bg-emerald-500" },
];
const ETAPA_LABEL: Record<EtapaFunil, string> = {
  pre_atendimento: "Pré-Atendimento", visita: "Visita", atendimento: "Atendimento",
  pasta_digital: "Pasta Digital", proposta: "Proposta", contrato: "Contrato", perdido: "Perdido",
};
const ORIGENS = ["site", "indicacao", "portal", "whatsapp", "telefone", "visita_stand"];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500";

// ── Modal de lead (criar/editar) ───────────────────────────────────────────────

function LeadModal({ lead, onClose }: { lead?: Lead | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdicao = !!lead;
  const [nome, setNome] = useState(lead?.nome_cliente ?? "");
  const [telefone, setTelefone] = useState(lead?.telefone ?? "");
  const [email, setEmail] = useState(lead?.email ?? "");
  const [empId, setEmpId] = useState(lead?.empreendimento_id ?? "");
  const [unidadeId, setUnidadeId] = useState(lead?.unidade_id ?? "");
  const [etapa, setEtapa] = useState<EtapaFunil>(lead?.etapa ?? "pre_atendimento");
  const [valor, setValor] = useState(lead?.valor?.toString() ?? "");
  const [responsavel, setResponsavel] = useState(lead?.responsavel ?? "");
  const [origem, setOrigem] = useState(lead?.origem ?? "");
  const [obs, setObs] = useState(lead?.observacoes ?? "");
  const [motivoPerda, setMotivoPerda] = useState(lead?.motivo_perda ?? "");
  const [erro, setErro] = useState("");

  const { data: empreendimentos } = useQuery({
    queryKey: ["empreendimentos", { funil: true }],
    queryFn: () => empreendimentosApi.listar({ por_pagina: 100 }),
  });
  const listaEmp = empreendimentos?.items ?? [];

  const { data: unidades = [] } = useQuery({
    queryKey: ["unidades", empId],
    queryFn: () => unidadesApi.listar(empId),
    enabled: !!empId,
  });

  const payload = () => ({
    nome_cliente: nome, telefone: telefone || null, email: email || null,
    empreendimento_id: empId || null, unidade_id: unidadeId || null,
    etapa, valor: valor ? Number(valor) : null,
    responsavel: responsavel || null, origem: origem || null,
    observacoes: obs || null, motivo_perda: etapa === "perdido" ? (motivoPerda || null) : null,
  });

  const salvar = useMutation({
    mutationFn: () => isEdicao ? leadsApi.atualizar(lead!.id, payload()) : leadsApi.criar(payload()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funil"] });
      qc.invalidateQueries({ queryKey: ["unidades"] });
      qc.invalidateQueries({ queryKey: ["espelho-resumo"] });
      onClose();
    },
    onError: (e: any) => setErro(e?.response?.data?.detail ?? "Erro ao salvar"),
  });

  const excluir = useMutation({
    mutationFn: () => leadsApi.excluir(lead!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["funil"] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <h2 className="text-base font-semibold text-slate-800">{isEdicao ? "Editar lead" : "Novo lead"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Etapa */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Etapa do funil</label>
            <div className="grid grid-cols-3 gap-1.5">
              {[...ETAPAS, { id: "perdido" as EtapaFunil, label: "Perdido", cor: "text-red-600", barra: "" }].map(e => (
                <button key={e.id} onClick={() => setEtapa(e.id)}
                  className={clsx("py-1.5 rounded-lg text-xs font-medium border-2 transition-all",
                    etapa === e.id ? "border-brand-500 bg-brand-50 text-brand-700" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300")}>
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          {etapa === "perdido" && (
            <input value={motivoPerda} onChange={e => setMotivoPerda(e.target.value)} className={inputClass} placeholder="Motivo da perda (ex: preço, financiamento negado)" />
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Cliente *</label>
            <input value={nome} onChange={e => setNome(e.target.value)} className={inputClass} placeholder="Nome do cliente" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input value={telefone} onChange={e => setTelefone(e.target.value)} className={inputClass} placeholder="Telefone" />
            <input value={email} onChange={e => setEmail(e.target.value)} className={inputClass} placeholder="E-mail" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Empreendimento</label>
              <select value={empId} onChange={e => { setEmpId(e.target.value); setUnidadeId(""); }} className={clsx(inputClass, "bg-white")}>
                <option value="">— Nenhum —</option>
                {listaEmp.map((e: any) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Unidade</label>
              <select value={unidadeId} onChange={e => setUnidadeId(e.target.value)} disabled={!empId} className={clsx(inputClass, "bg-white disabled:opacity-50")}>
                <option value="">— Nenhuma —</option>
                {unidades.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.grupo} · {u.identificador}
                    {u.pavimento != null ? ` · ${u.pavimento}º andar` : ""}
                    {u.area_privativa_m2 ? ` · ${u.area_privativa_m2}m²` : ""}
                    {u.preco_tabela ? ` · ${u.preco_tabela.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}` : ""}
                    {u.status !== "disponivel" ? ` · (${u.status})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Valor (R$)</label>
              <input type="number" value={valor} onChange={e => setValor(e.target.value)} className={inputClass} placeholder="350000" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Origem</label>
              <select value={origem} onChange={e => setOrigem(e.target.value)} className={clsx(inputClass, "bg-white")}>
                <option value="">— Selecione —</option>
                {ORIGENS.map(o => <option key={o} value={o}>{o.replace("_", " ")}</option>)}
              </select>
            </div>
          </div>

          <input value={responsavel} onChange={e => setResponsavel(e.target.value)} className={inputClass} placeholder="Responsável (corretor)" />
          <input value={obs} onChange={e => setObs(e.target.value)} className={inputClass} placeholder="Observações" />

          {etapa === "contrato" && unidadeId && (
            <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
              ✓ Ao salvar em <strong>Contrato</strong>, a unidade vinculada será marcada como <strong>vendida</strong> no espelho digital.
            </p>
          )}
          {erro && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2"><AlertCircle size={14} /> {erro}</div>}

          <div className="flex gap-2 pt-1">
            {isEdicao && (
              <button onClick={() => excluir.mutate()} disabled={excluir.isPending}
                className="p-2.5 rounded-lg text-red-500 border border-red-200 hover:bg-red-50" title="Excluir lead"><Trash2 size={16} /></button>
            )}
            <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button onClick={() => { setErro(""); if (!nome.trim()) { setErro("Informe o cliente"); return; } salvar.mutate(); }}
              disabled={salvar.isPending}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {salvar.isPending && <Loader2 size={14} className="animate-spin" />} Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Card de lead ────────────────────────────────────────────────────────────────

function LeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full text-left bg-white rounded-xl border border-slate-200 p-3 hover:border-brand-300 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-sm text-slate-800 leading-tight">{lead.nome_cliente}</p>
        {lead.valor != null && <span className="text-xs font-bold text-emerald-700 whitespace-nowrap">{fmt(lead.valor)}</span>}
      </div>
      {lead.empreendimento_nome && (
        <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 truncate"><Building2 size={10} /> {lead.empreendimento_nome}</p>
      )}
      {lead.unidade_label && (
        <p className="text-[11px] text-slate-500 flex items-center gap-1"><Home size={10} /> {lead.unidade_label}</p>
      )}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
        {lead.responsavel ? (
          <span className="text-[10px] text-slate-500 flex items-center gap-1 truncate"><User size={9} /> {lead.responsavel}</span>
        ) : <span />}
        <span className="text-[10px] text-slate-400 flex items-center gap-1 whitespace-nowrap"><Clock size={9} /> {lead.dias_na_etapa}d</span>
      </div>
    </button>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

export function FunilVendas() {
  const [novo, setNovo] = useState(false);
  const [editando, setEditando] = useState<Lead | null>(null);

  const { data: funil, isLoading, isError } = useQuery<FunilResponse>({
    queryKey: ["funil"],
    queryFn: () => leadsApi.funil(),
  });

  return (
    <>
      {novo && <LeadModal onClose={() => setNovo(false)} />}
      {editando && <LeadModal lead={editando} onClose={() => setEditando(null)} />}

      <div className="p-6">
        {/* Cabeçalho + resumo */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Funil de Vendas</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {funil?.total_leads ?? 0} leads ativos
            </p>
          </div>
          <div className="flex items-center gap-3">
            {funil && (
              <div className="flex gap-4">
                <div className="text-right">
                  <p className="text-[11px] text-slate-400 flex items-center gap-1 justify-end"><TrendingUp size={11} /> Pipeline</p>
                  <p className="text-sm font-bold text-slate-700">{fmt(funil.valor_pipeline)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-400 flex items-center gap-1 justify-end"><Trophy size={11} /> Em contrato</p>
                  <p className="text-sm font-bold text-emerald-700">{fmt(funil.valor_ganho)}</p>
                </div>
              </div>
            )}
            <button onClick={() => setNovo(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-xl hover:bg-brand-700 shadow-sm whitespace-nowrap">
              <Plus size={15} /> Novo lead
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-slate-400"><Loader2 size={24} className="animate-spin mr-2" /> Carregando…</div>
        ) : isError ? (
          <div className="flex items-center justify-center h-64 text-red-500 gap-2"><AlertCircle size={20} /> Erro ao carregar o funil.</div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {ETAPAS.map(etapa => {
              const coluna = funil?.colunas.find(c => c.etapa === etapa.id);
              const leads = coluna?.leads ?? [];
              return (
                <div key={etapa.id} className="flex-shrink-0 w-72">
                  <div className="bg-slate-50 rounded-2xl border border-slate-100 h-full flex flex-col">
                    {/* Header da coluna */}
                    <div className="px-3 pt-3 pb-2">
                      <div className={clsx("h-1 rounded-full mb-2", etapa.barra)} />
                      <div className="flex items-center justify-between">
                        <h3 className={clsx("text-sm font-semibold", etapa.cor)}>{etapa.label}</h3>
                        <span className="text-xs font-medium text-slate-400 bg-white rounded-full px-2 py-0.5">{coluna?.total ?? 0}</span>
                      </div>
                      {!!coluna?.valor && <p className="text-[11px] text-slate-400 mt-0.5">{fmt(coluna.valor)}</p>}
                    </div>
                    {/* Cards */}
                    <div className="px-2 pb-2 space-y-2 flex-1 min-h-[120px]">
                      {leads.map(lead => <LeadCard key={lead.id} lead={lead} onClick={() => setEditando(lead)} />)}
                      {leads.length === 0 && (
                        <div className="text-center py-6 text-[11px] text-slate-300">Sem leads</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
