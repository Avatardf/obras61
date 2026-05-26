import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Plus, Trash2, CloudSun, Users, CheckSquare, AlertTriangle, Mic, Sparkles } from "lucide-react";
import { useState } from "react";
import { rdoApi } from "@/api/client";
import { VoiceRecorderRDO } from "@/components/rdo/VoiceRecorderRDO";
import type { EquipeRDO, OcorrenciaRDO, TipoOcorrenciaRDO, CriticidadeRDO, TranscricaoVozResponse } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const CLIMA_OPTS = [
  { value: "ensolarado", label: "☀️ Ensolarado" },
  { value: "nublado",    label: "🌤️ Nublado"    },
  { value: "chuvoso",    label: "🌧️ Chuvoso"    },
  { value: "tempestade", label: "⛈️ Tempestade"  },
];

const TIPO_OC_OPTS: { value: TipoOcorrenciaRDO; label: string }[] = [
  { value: "seguranca",  label: "Segurança"    },
  { value: "qualidade",  label: "Qualidade"    },
  { value: "ambiental",  label: "Ambiental"    },
  { value: "geral",      label: "Geral"        },
];

const CRIT_OPTS: { value: CriticidadeRDO; label: string; cls: string }[] = [
  { value: "baixa", label: "Baixa",  cls: "bg-emerald-100 text-emerald-700" },
  { value: "media", label: "Média",  cls: "bg-amber-100 text-amber-700"     },
  { value: "alta",  label: "Alta",   cls: "bg-red-100 text-red-700"         },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-600 mb-3">
      <Icon size={15} />
      <h4 className="text-sm font-semibold">{title}</h4>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  aberto: boolean;
  onFechar: () => void;
  obraId: string;
}

export function RDOForm({ aberto, onFechar, obraId }: Props) {
  const qc = useQueryClient();

  // Dados gerais
  const [data,      setData]      = useState(today());
  const [climaManha, setClimaManha] = useState<string>("");
  const [climaTarde, setClimaTarde] = useState<string>("");
  const [efetivo,   setEfetivo]   = useState<string>("");
  const [observ,    setObserv]    = useState("");

  // Equipes
  const [equipes, setEquipes] = useState<EquipeRDO[]>([]);
  const [eqFuncao, setEqFuncao] = useState("");
  const [eqQtd, setEqQtd] = useState("1");

  // Atividades
  const [atividades, setAtividades] = useState<string[]>([]);
  const [novaAtiv, setNovaAtiv] = useState("");

  // Ocorrências
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaRDO[]>([]);
  const [ocTipo, setOcTipo] = useState<TipoOcorrenciaRDO>("geral");
  const [ocDesc, setOcDesc] = useState("");
  const [ocCrit, setOcCrit] = useState<CriticidadeRDO>("baixa");

  // Gravação por voz
  const [vozAberta, setVozAberta] = useState(false);
  const [preenchidoPorVoz, setPreenchidoPorVoz] = useState(false);

  /**
   * Recebe os campos extraídos pelo Gemini a partir do áudio e popula
   * o formulário. O usuário poderá revisar/editar tudo antes de salvar.
   */
  function aplicarTranscricao(d: TranscricaoVozResponse) {
    if (d.clima_manha)   setClimaManha(d.clima_manha);
    if (d.clima_tarde)   setClimaTarde(d.clima_tarde);
    if (d.efetivo_total != null) setEfetivo(String(d.efetivo_total));
    if (d.equipes && d.equipes.length > 0) {
      // Acumula com o que já estava (em caso de re-gravação aditiva, pode-se ajustar)
      setEquipes(d.equipes);
    }
    if (d.atividades && d.atividades.length > 0) {
      setAtividades(d.atividades);
    }
    if (d.ocorrencias && d.ocorrencias.length > 0) {
      setOcorrencias(d.ocorrencias);
    }
    // Concatena transcrição completa + observações estruturadas no campo de observações
    const partes: string[] = [];
    if (d.observacoes) partes.push(d.observacoes);
    if (d.transcricao) partes.push(`\n--- Transcrição original ---\n${d.transcricao}`);
    if (partes.length > 0) setObserv(partes.join("\n"));

    setPreenchidoPorVoz(true);
    setVozAberta(false);
  }

  const criarMutation = useMutation({
    mutationFn: () => rdoApi.criar(obraId, {
      data,
      clima_manha: climaManha || null,
      clima_tarde: climaTarde || null,
      efetivo_total: efetivo ? parseInt(efetivo) : null,
      equipes,
      atividades,
      ocorrencias,
      observacoes: observ || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rdos", obraId] });
      handleFechar();
    },
  });

  function handleFechar() {
    setData(today());
    setClimaManha("");
    setClimaTarde("");
    setEfetivo("");
    setObserv("");
    setEquipes([]);
    setEqFuncao("");
    setEqQtd("1");
    setAtividades([]);
    setNovaAtiv("");
    setOcorrencias([]);
    setOcTipo("geral");
    setOcDesc("");
    setOcCrit("baixa");
    setPreenchidoPorVoz(false);
    setVozAberta(false);
    onFechar();
  }

  function addEquipe() {
    if (!eqFuncao.trim()) return;
    setEquipes(prev => [...prev, { funcao: eqFuncao.trim(), quantidade: parseInt(eqQtd) || 1 }]);
    setEqFuncao("");
    setEqQtd("1");
  }

  function addAtividade() {
    if (!novaAtiv.trim()) return;
    setAtividades(prev => [...prev, novaAtiv.trim()]);
    setNovaAtiv("");
  }

  function addOcorrencia() {
    if (!ocDesc.trim()) return;
    setOcorrencias(prev => [...prev, { tipo: ocTipo, descricao: ocDesc.trim(), criticidade: ocCrit }]);
    setOcDesc("");
    setOcTipo("geral");
    setOcCrit("baixa");
  }

  if (!aberto) return null;

  const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white";
  const selectCls = inputCls;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-12">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={handleFechar} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">Novo Relatório Diário de Obra</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVozAberta(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-brand-600 hover:from-violet-700 hover:to-brand-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95"
              title="Grave o relato por voz e a IA preenche os campos"
            >
              <Mic size={13} />
              Gravar por voz
            </button>
            <button onClick={handleFechar} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Banner: preenchido por voz */}
        {preenchidoPorVoz && (
          <div className="px-6 py-2.5 bg-gradient-to-r from-violet-50 to-brand-50 border-b border-violet-100 flex items-center gap-2">
            <Sparkles size={14} className="text-violet-600" />
            <p className="text-xs text-slate-700">
              <strong className="text-violet-700">Campos preenchidos pela IA</strong> · Revise os dados abaixo antes de salvar.
            </p>
            <button
              onClick={() => setPreenchidoPorVoz(false)}
              className="ml-auto text-violet-500 hover:text-violet-700"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* ── Dados gerais ── */}
          <section>
            <SectionHeader icon={CloudSun} title="Dados gerais" />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Data *</label>
                <input type="date" value={data} onChange={e => setData(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Efetivo presente</label>
                <input
                  type="number" min={0} value={efetivo}
                  onChange={e => setEfetivo(e.target.value)}
                  placeholder="Total de trabalhadores"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Clima — Manhã</label>
                <select value={climaManha} onChange={e => setClimaManha(e.target.value)} className={selectCls}>
                  <option value="">Não informado</option>
                  {CLIMA_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Clima — Tarde</label>
                <select value={climaTarde} onChange={e => setClimaTarde(e.target.value)} className={selectCls}>
                  <option value="">Não informado</option>
                  {CLIMA_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* ── Equipes ── */}
          <section>
            <SectionHeader icon={Users} title="Composição de equipes" />
            {equipes.length > 0 && (
              <div className="mb-3 space-y-1.5">
                {equipes.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 text-sm">
                    <span className="flex-1 text-slate-700">{e.funcao}</span>
                    <span className="text-slate-500 tabular-nums">{e.quantidade}×</span>
                    <button onClick={() => setEquipes(prev => prev.filter((_, j) => j !== i))}
                      className="text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={eqFuncao} onChange={e => setEqFuncao(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addEquipe()}
                placeholder="Função (ex: Pedreiro)"
                className={`${inputCls} flex-1`}
              />
              <input
                type="number" min={1} value={eqQtd}
                onChange={e => setEqQtd(e.target.value)}
                className={`${inputCls} w-20`}
              />
              <button
                onClick={addEquipe}
                disabled={!eqFuncao.trim()}
                className="px-3 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-40 transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </section>

          {/* ── Atividades ── */}
          <section>
            <SectionHeader icon={CheckSquare} title="Atividades executadas" />
            {atividades.length > 0 && (
              <div className="mb-3 space-y-1.5">
                {atividades.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 bg-slate-50 rounded-lg px-3 py-2 text-sm">
                    <span className="text-slate-400 text-xs mt-0.5 select-none">{i + 1}.</span>
                    <span className="flex-1 text-slate-700">{a}</span>
                    <button onClick={() => setAtividades(prev => prev.filter((_, j) => j !== i))}
                      className="text-slate-300 hover:text-red-500 transition-colors mt-0.5">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={novaAtiv} onChange={e => setNovaAtiv(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addAtividade()}
                placeholder="Descreva uma atividade realizada"
                className={`${inputCls} flex-1`}
              />
              <button
                onClick={addAtividade}
                disabled={!novaAtiv.trim()}
                className="px-3 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-40 transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </section>

          {/* ── Ocorrências ── */}
          <section>
            <SectionHeader icon={AlertTriangle} title="Ocorrências e não-conformidades" />
            {ocorrencias.length > 0 && (
              <div className="mb-3 space-y-1.5">
                {ocorrencias.map((oc, i) => {
                  const c = CRIT_OPTS.find(x => x.value === oc.criticidade)!;
                  return (
                    <div key={i} className="flex items-start gap-2 bg-slate-50 rounded-lg px-3 py-2 text-sm">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0 mt-0.5 ${c.cls}`}>{c.label}</span>
                      <span className="flex-1 text-slate-700">{oc.descricao}</span>
                      <span className="text-xs text-slate-400 capitalize shrink-0">{oc.tipo}</span>
                      <button onClick={() => setOcorrencias(prev => prev.filter((_, j) => j !== i))}
                        className="text-slate-300 hover:text-red-500 transition-colors mt-0.5">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <select value={ocTipo} onChange={e => setOcTipo(e.target.value as TipoOcorrenciaRDO)} className={selectCls}>
                  {TIPO_OC_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <select value={ocCrit} onChange={e => setOcCrit(e.target.value as CriticidadeRDO)} className={selectCls}>
                  {CRIT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  value={ocDesc} onChange={e => setOcDesc(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addOcorrencia()}
                  placeholder="Descreva a ocorrência"
                  className={`${inputCls} flex-1`}
                />
                <button
                  onClick={addOcorrencia}
                  disabled={!ocDesc.trim()}
                  className="px-3 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-40 transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </section>

          {/* ── Observações ── */}
          <section>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Observações do responsável
            </label>
            <textarea
              value={observ} onChange={e => setObserv(e.target.value)}
              rows={3}
              placeholder="Comentários adicionais, pendências, pontos de atenção…"
              className={`${inputCls} resize-none`}
            />
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <p className="text-xs text-slate-400">
            {atividades.length} atividade{atividades.length !== 1 ? "s" : ""} · {" "}
            {ocorrencias.length} ocorrência{ocorrencias.length !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <button onClick={handleFechar} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              Cancelar
            </button>
            <button
              onClick={() => criarMutation.mutate()}
              disabled={!data || criarMutation.isPending}
              className="px-5 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors"
            >
              {criarMutation.isPending ? "Salvando…" : "Salvar RDO"}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de gravação por voz (sobrepõe o RDOForm quando aberto) */}
      <VoiceRecorderRDO
        aberto={vozAberta}
        onFechar={() => setVozAberta(false)}
        onTranscricaoPronta={aplicarTranscricao}
      />
    </div>
  );
}
