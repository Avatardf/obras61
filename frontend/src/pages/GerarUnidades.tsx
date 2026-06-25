import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Plus, Trash2, Loader2, AlertCircle, Printer, Wand2, Lock,
} from "lucide-react";
import { clsx } from "clsx";
import { empreendimentosApi, unidadesApi, type Unidade } from "@/api/client";
import { ORIENTACOES } from "@/pages/EspelhoDigital";

const inputClass = "w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500";
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

interface Linha {
  _key: number;
  id?: string | null;
  grupo: string;
  identificador: string;
  pavimento: number | null;
  area_privativa_m2: number | null;
  custo: number | null;
  preco_tabela: number | null;
  valor_venda: number | null;
  orientacao_solar: string;
  status: string;            // 'disponivel' pode ser removida; demais ficam travadas
}

let _seq = 0;
const fromUnidade = (u: Unidade): Linha => ({
  _key: ++_seq, id: u.id, grupo: u.grupo, identificador: u.identificador,
  pavimento: u.pavimento, area_privativa_m2: u.area_privativa_m2, custo: u.custo,
  preco_tabela: u.preco_tabela, valor_venda: u.valor_venda,
  orientacao_solar: u.orientacao_solar ?? "", status: u.status,
});
const novaLinha = (grupo: string, pavimento: number | null, identificador = ""): Linha => ({
  _key: ++_seq, id: null, grupo, identificador, pavimento,
  area_privativa_m2: null, custo: null, preco_tabela: null, valor_venda: null,
  orientacao_solar: "", status: "disponivel",
});

export function GerarUnidades() {
  const { empId } = useParams<{ empId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: emp } = useQuery({
    queryKey: ["empreendimento", empId],
    queryFn: () => empreendimentosApi.buscar(empId!),
    enabled: !!empId,
  });
  const { data: existentes } = useQuery<Unidade[]>({
    queryKey: ["unidades", empId],
    queryFn: () => unidadesApi.listar(empId!),
    enabled: !!empId,
  });

  const teto: number | null = emp?.num_unidades ?? null;
  const andaresEmp: number | null = emp?.num_pavimentos_estimado ?? null;

  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [grupoNovo, setGrupoNovo] = useState("");
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState("");
  const [pdf, setPdf] = useState(false);

  // Inicializa a partir das unidades já cadastradas (uma vez)
  useEffect(() => {
    if (existentes && !carregado) {
      setLinhas(existentes.map(fromUnidade));
      setGrupoNovo(existentes[0]?.grupo ?? "Torre A");
      setCarregado(true);
    }
  }, [existentes, carregado]);

  const persistidas = linhas.some(l => l.id);
  const podeAdicionar = teto == null || linhas.length < teto;
  const restantes = teto == null ? null : teto - linhas.length;

  function set(key: number, campo: keyof Linha, valor: unknown) {
    setLinhas(ls => ls.map(l => l._key === key ? { ...l, [campo]: valor } : l));
  }
  function addLinha() {
    if (!podeAdicionar) return;
    setLinhas(ls => [...ls, novaLinha(grupoNovo || "Torre A", null)]);
  }
  function removerLinha(key: number) {
    const l = linhas.find(x => x._key === key);
    if (l && l.status !== "disponivel") {
      setErro(`A unidade ${l.identificador} está '${l.status}' e não pode ser removida aqui.`);
      return;
    }
    setErro("");
    setLinhas(ls => ls.filter(x => x._key !== key));
  }

  // Preenchimento automático — só quando ainda não há nada cadastrado
  function preencherAuto() {
    if (teto == null) {
      setErro("Defina o número de unidades no cadastro do empreendimento para usar o preenchimento automático.");
      return;
    }
    const andares = andaresEmp && andaresEmp > 0 ? andaresEmp : 1;
    const porAndar = Math.ceil(teto / andares);
    const novas: Linha[] = [];
    let count = 0;
    for (let a = 1; a <= andares && count < teto; a++) {
      for (let i = 0; i < porAndar && count < teto; i++) {
        novas.push(novaLinha(grupoNovo || "Torre A", a, String(a * 100 + i + 1)));
        count++;
      }
    }
    setLinhas(novas);
    setErro("");
  }

  const totalCusto = linhas.reduce((s, l) => s + (l.custo ?? 0), 0);
  const totalTabela = linhas.reduce((s, l) => s + (l.preco_tabela ?? 0), 0);
  const totalVenda = linhas.reduce((s, l) => s + (l.valor_venda ?? 0), 0);
  const totalArea = linhas.reduce((s, l) => s + (l.area_privativa_m2 ?? 0), 0);

  const salvar = useMutation({
    mutationFn: () => unidadesApi.salvarLote(empId!, linhas.map(l => ({
      id: l.id ?? undefined,
      grupo: (l.grupo || "Torre A").trim(),
      identificador: l.identificador.trim(),
      pavimento: l.pavimento,
      area_privativa_m2: l.area_privativa_m2,
      custo: l.custo,
      preco_tabela: l.preco_tabela,
      valor_venda: l.valor_venda,
      orientacao_solar: l.orientacao_solar || null,
    }))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unidades"] });
      qc.invalidateQueries({ queryKey: ["espelho-resumo"] });
      navigate("/espelho");
    },
    onError: (e: any) => setErro(e?.response?.data?.detail ?? "Erro ao salvar unidades"),
  });

  function confirmarSalvar() {
    setErro("");
    if (linhas.length === 0) { setErro("Adicione ao menos uma unidade."); return; }
    if (linhas.some(l => !l.identificador.trim())) { setErro("Toda unidade precisa de um número."); return; }
    const chaves = linhas.map(l => `${(l.grupo || "Torre A").trim()}::${l.identificador.trim()}`);
    if (new Set(chaves).size !== chaves.length) { setErro("Há números de unidade repetidos no mesmo grupo."); return; }
    if (teto != null && linhas.length > teto) { setErro(`O empreendimento permite no máximo ${teto} unidades.`); return; }
    salvar.mutate();
  }

  // ── Modo PDF / impressão ──────────────────────────────────────────────────
  if (pdf) {
    const ordenadas = [...linhas].sort((a, b) =>
      `${a.grupo}`.localeCompare(`${b.grupo}`) ||
      a.identificador.localeCompare(b.identificador, undefined, { numeric: true }));
    return (
      <div className="p-6 max-w-5xl mx-auto print:p-0">
        <div className="flex items-center justify-between mb-4 print:mb-6">
          <div>
            <h2 className="font-bold text-slate-800 print:text-xl">Tabela de unidades — {emp?.nome}</h2>
            <p className="text-xs text-slate-500 print:text-sm">{linhas.length} unidades</p>
          </div>
          <div className="flex gap-2 print:hidden">
            <button onClick={() => setPdf(false)} className="px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
              Voltar
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700">
              <Printer size={15} /> Imprimir / Salvar PDF
            </button>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-2">Unidade</th>
              <th className="py-2 pr-2">Andar</th>
              <th className="py-2 pr-2">Área</th>
              <th className="py-2 pr-2">Orientação</th>
              <th className="py-2 pr-2 text-right">Custo</th>
              <th className="py-2 pr-2 text-right">Tabela</th>
              <th className="py-2 pr-2 text-right">Venda</th>
              <th className="py-2 pr-2 text-right">Margem (tabela)</th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.map(l => {
              const m = (l.preco_tabela ?? 0) - (l.custo ?? 0);
              return (
                <tr key={l._key} className="border-b border-slate-50">
                  <td className="py-1.5 pr-2 font-medium text-slate-700">{l.grupo} · {l.identificador}</td>
                  <td className="py-1.5 pr-2 text-slate-500">{l.pavimento != null ? `${l.pavimento}º` : "—"}</td>
                  <td className="py-1.5 pr-2 text-slate-500">{l.area_privativa_m2 ? `${l.area_privativa_m2} m²` : "—"}</td>
                  <td className="py-1.5 pr-2 text-slate-500">{l.orientacao_solar ? ORIENTACOES[l.orientacao_solar] : "—"}</td>
                  <td className="py-1.5 pr-2 text-right text-slate-500">{l.custo ? fmt(l.custo) : "—"}</td>
                  <td className="py-1.5 pr-2 text-right text-slate-700">{l.preco_tabela ? fmt(l.preco_tabela) : "—"}</td>
                  <td className="py-1.5 pr-2 text-right text-blue-700">{l.valor_venda ? fmt(l.valor_venda) : "—"}</td>
                  <td className={clsx("py-1.5 pr-2 text-right", m >= 0 ? "text-emerald-700" : "text-red-600")}>
                    {(l.preco_tabela || l.custo) ? fmt(m) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 font-semibold text-slate-700">
              <td className="py-2 pr-2" colSpan={2}>Total — {linhas.length} unidades</td>
              <td className="py-2 pr-2">{totalArea ? `${totalArea.toFixed(0)} m²` : "—"}</td>
              <td></td>
              <td className="py-2 pr-2 text-right">{totalCusto ? fmt(totalCusto) : "—"}</td>
              <td className="py-2 pr-2 text-right">{totalTabela ? fmt(totalTabela) : "—"}</td>
              <td className="py-2 pr-2 text-right">{totalVenda ? fmt(totalVenda) : "—"}</td>
              <td className="py-2 pr-2 text-right text-emerald-700">{(totalTabela - totalCusto) ? fmt(totalTabela - totalCusto) : "—"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  // ── Modo edição ───────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate("/espelho")} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Cadastro de unidades</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {emp?.nome ?? "—"}
            {teto != null && <> · <strong className={clsx(linhas.length > teto && "text-red-600")}>{linhas.length} de {teto}</strong> unidades</>}
            {andaresEmp != null && <> · {andaresEmp} {andaresEmp === 1 ? "andar" : "andares"}</>}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        {/* Aviso de teto não definido */}
        {teto == null && (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-4">
            <AlertCircle size={15} />
            Defina o <strong>número de unidades</strong> e o <strong>número de pavimentos</strong> no cadastro do empreendimento para travar o total e usar o preenchimento automático.
          </div>
        )}

        {/* Controles topo */}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Grupo padrão (torre/bloco)</label>
            <input value={grupoNovo} onChange={e => setGrupoNovo(e.target.value)} className={clsx(inputClass, "w-40")} placeholder="Torre A" />
          </div>
          {!persistidas && (
            <button onClick={preencherAuto}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-50">
              <Wand2 size={15} /> Preencher numeração automática
            </button>
          )}
        </div>

        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm min-w-[920px]">
            <thead>
              <tr className="text-left text-xs font-medium text-slate-500">
                <th className="px-1 py-1.5">Grupo</th>
                <th className="px-1 py-1.5">Número *</th>
                <th className="px-1 py-1.5">Andar</th>
                <th className="px-1 py-1.5">Área (m²)</th>
                <th className="px-1 py-1.5">Custo (R$)</th>
                <th className="px-1 py-1.5">Tabela (R$)</th>
                <th className="px-1 py-1.5">Venda (R$)</th>
                <th className="px-1 py-1.5">Orientação</th>
                <th className="px-1 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(l => {
                const travada = l.status !== "disponivel";
                return (
                  <tr key={l._key} className="border-t border-slate-100">
                    <td className="px-1 py-1.5">
                      <input value={l.grupo} onChange={e => set(l._key, "grupo", e.target.value)} className={clsx(inputClass, "w-28")} />
                    </td>
                    <td className="px-1 py-1.5">
                      <input value={l.identificador} onChange={e => set(l._key, "identificador", e.target.value)} className={clsx(inputClass, "w-20")} placeholder="101" />
                    </td>
                    <td className="px-1 py-1.5">
                      {andaresEmp && andaresEmp > 0 ? (
                        <select value={l.pavimento ?? ""} onChange={e => set(l._key, "pavimento", e.target.value ? Number(e.target.value) : null)} className={clsx(inputClass, "bg-white w-16")}>
                          <option value="">—</option>
                          {Array.from({ length: andaresEmp }, (_, i) => i + 1).map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                      ) : (
                        <input type="number" value={l.pavimento ?? ""} onChange={e => set(l._key, "pavimento", e.target.value ? Number(e.target.value) : null)} className={clsx(inputClass, "w-16")} />
                      )}
                    </td>
                    <td className="px-1 py-1.5">
                      <input type="number" value={l.area_privativa_m2 ?? ""} onChange={e => set(l._key, "area_privativa_m2", e.target.value ? Number(e.target.value) : null)} className={clsx(inputClass, "w-20")} placeholder="48" />
                    </td>
                    <td className="px-1 py-1.5">
                      <input type="number" value={l.custo ?? ""} onChange={e => set(l._key, "custo", e.target.value ? Number(e.target.value) : null)} className={clsx(inputClass, "w-28")} placeholder="220000" />
                    </td>
                    <td className="px-1 py-1.5">
                      <input type="number" value={l.preco_tabela ?? ""} onChange={e => set(l._key, "preco_tabela", e.target.value ? Number(e.target.value) : null)} className={clsx(inputClass, "w-28")} placeholder="350000" />
                    </td>
                    <td className="px-1 py-1.5">
                      <input type="number" value={l.valor_venda ?? ""} onChange={e => set(l._key, "valor_venda", e.target.value ? Number(e.target.value) : null)} className={clsx(inputClass, "w-28")} placeholder="—" />
                    </td>
                    <td className="px-1 py-1.5">
                      <select value={l.orientacao_solar} onChange={e => set(l._key, "orientacao_solar", e.target.value)} className={clsx(inputClass, "bg-white w-32")}>
                        <option value="">—</option>
                        {Object.entries(ORIENTACOES).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                      </select>
                    </td>
                    <td className="px-1 py-1.5">
                      {travada ? (
                        <span className="inline-flex p-1.5 text-slate-300" title={`Unidade '${l.status}' — não pode ser removida aqui`}><Lock size={14} /></span>
                      ) : (
                        <button onClick={() => removerLinha(l._key)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50" title="Remover unidade">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {linhas.length === 0 && (
                <tr><td colSpan={9} className="px-1 py-6 text-center text-sm text-slate-400">Nenhuma unidade. Adicione manualmente ou use o preenchimento automático.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-3 mt-3">
          <button onClick={addLinha} disabled={!podeAdicionar}
            className="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 disabled:opacity-40 disabled:cursor-not-allowed">
            <Plus size={15} /> Adicionar unidade
          </button>
          {restantes != null && (
            <span className="text-xs text-slate-400">
              {restantes > 0 ? `Faltam ${restantes} para o total de ${teto}` : restantes === 0 ? `Total de ${teto} atingido` : `${-restantes} acima do teto de ${teto}`}
            </span>
          )}
        </div>

        {erro && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-3">
            <AlertCircle size={14} /> {erro}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-4 mt-3 border-t border-slate-100">
          <button onClick={() => navigate("/espelho")} className="px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={() => setPdf(true)} disabled={linhas.length === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">
            <Printer size={15} /> Exportar PDF
          </button>
          <button onClick={confirmarSalvar} disabled={salvar.isPending}
            className="px-4 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-60 flex items-center gap-2">
            {salvar.isPending && <Loader2 size={14} className="animate-spin" />}
            Salvar unidades
          </button>
        </div>
      </div>
    </div>
  );
}
