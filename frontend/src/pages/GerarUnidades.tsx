import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Plus, Trash2, Loader2, AlertCircle, Printer, Wand2,
} from "lucide-react";
import { clsx } from "clsx";
import { empreendimentosApi, unidadesApi, type AndarConfig } from "@/api/client";
import { ORIENTACOES } from "@/pages/EspelhoDigital";

const inputClass = "w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500";
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

interface LinhaAndar extends AndarConfig {
  _key: number;
}

let _seq = 0;
const novaLinha = (andar: number): LinhaAndar => ({
  _key: ++_seq, andar, quantidade: 4, inicio: andar * 100 + 1,
  tipo: "apartamento", area_privativa_m2: null, preco_tabela: null, orientacao_solar: "",
});

interface UnidadePreview {
  andar: number;
  identificador: string;
  tipo: string | null;
  area: number | null;
  preco: number | null;
  orientacao: string | null;
}

export function GerarUnidades() {
  const { empId } = useParams<{ empId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: emp } = useQuery({
    queryKey: ["empreendimento", empId],
    queryFn: () => empreendimentosApi.buscar(empId!),
    enabled: !!empId,
  });

  const [grupo, setGrupo] = useState("");
  const [andares, setAndares] = useState<LinhaAndar[]>([novaLinha(1)]);
  const [erro, setErro] = useState("");
  const [mostrarPreview, setMostrarPreview] = useState(false);

  function addAndar() {
    const proximo = andares.length ? Math.max(...andares.map(a => a.andar)) + 1 : 1;
    setAndares(a => [...a, novaLinha(proximo)]);
  }
  function removerAndar(key: number) {
    setAndares(a => a.filter(x => x._key !== key));
  }
  function set(key: number, campo: keyof AndarConfig, valor: unknown) {
    setAndares(a => a.map(x => x._key === key ? { ...x, [campo]: valor } : x));
  }

  const preview = useMemo<UnidadePreview[]>(() => {
    const usados = new Set<string>();
    const linhas: UnidadePreview[] = [];
    for (const cfg of andares) {
      const inicio = cfg.inicio ?? cfg.andar * 100 + 1;
      for (let i = 0; i < cfg.quantidade; i++) {
        const ident = String(inicio + i);
        if (usados.has(ident)) continue;
        usados.add(ident);
        linhas.push({
          andar: cfg.andar, identificador: ident, tipo: cfg.tipo ?? null,
          area: cfg.area_privativa_m2 ?? null, preco: cfg.preco_tabela ?? null,
          orientacao: cfg.orientacao_solar || null,
        });
      }
    }
    return linhas.sort((a, b) => a.identificador.localeCompare(b.identificador, undefined, { numeric: true }));
  }, [andares]);

  const totalArea = preview.reduce((s, u) => s + (u.area ?? 0), 0);
  const totalVgv = preview.reduce((s, u) => s + (u.preco ?? 0), 0);

  const gerar = useMutation({
    mutationFn: () => unidadesApi.gerarPorAndar(empId!, {
      grupo,
      andares: andares.map(({ _key, ...cfg }) => ({ ...cfg, orientacao_solar: cfg.orientacao_solar || null })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unidades"] });
      qc.invalidateQueries({ queryKey: ["espelho-resumo"] });
      navigate("/espelho");
    },
    onError: (e: any) => setErro(e?.response?.data?.detail ?? "Erro ao gerar unidades"),
  });

  function confirmarGerar() {
    setErro("");
    if (!grupo.trim()) { setErro("Informe o grupo (ex: Torre A)"); return; }
    if (preview.length === 0) { setErro("Nenhuma unidade configurada"); return; }
    gerar.mutate();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto print:p-0">
      {/* Cabeçalho — escondido na impressão */}
      <div className="flex items-center gap-3 mb-5 print:hidden">
        <button onClick={() => navigate("/espelho")} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Wand2 size={18} className="text-brand-600" /> Gerar unidades por andar
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {emp?.nome ?? "—"} · cada andar pode ter quantidade, área, preço e orientação diferentes
          </p>
        </div>
      </div>

      {!mostrarPreview ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 print:hidden">
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Grupo (torre/quadra/bloco) *</label>
            <input value={grupo} onChange={e => setGrupo(e.target.value)} className={clsx(inputClass, "max-w-xs")} placeholder="Torre A" />
          </div>

          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="text-left text-xs font-medium text-slate-500">
                  <th className="px-1 py-1.5">Andar</th>
                  <th className="px-1 py-1.5">Unidades</th>
                  <th className="px-1 py-1.5">Nº inicial</th>
                  <th className="px-1 py-1.5">Tipo</th>
                  <th className="px-1 py-1.5">Área (m²)</th>
                  <th className="px-1 py-1.5">Preço (R$)</th>
                  <th className="px-1 py-1.5">Orientação</th>
                  <th className="px-1 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {andares.map(a => (
                  <tr key={a._key} className="border-t border-slate-100">
                    <td className="px-1 py-1.5">
                      <input type="number" value={a.andar} onChange={e => set(a._key, "andar", Number(e.target.value))} className={clsx(inputClass, "w-16")} />
                    </td>
                    <td className="px-1 py-1.5">
                      <input type="number" min={1} value={a.quantidade} onChange={e => set(a._key, "quantidade", Number(e.target.value))} className={clsx(inputClass, "w-16")} />
                    </td>
                    <td className="px-1 py-1.5">
                      <input type="number" value={a.inicio ?? ""} onChange={e => set(a._key, "inicio", e.target.value ? Number(e.target.value) : null)} className={clsx(inputClass, "w-20")} placeholder={`${a.andar * 100 + 1}`} />
                    </td>
                    <td className="px-1 py-1.5">
                      <select value={a.tipo ?? ""} onChange={e => set(a._key, "tipo", e.target.value || null)} className={clsx(inputClass, "bg-white w-32")}>
                        <option value="apartamento">Apartamento</option>
                        <option value="lote">Lote</option>
                        <option value="casa">Casa</option>
                        <option value="sala">Sala comercial</option>
                      </select>
                    </td>
                    <td className="px-1 py-1.5">
                      <input type="number" value={a.area_privativa_m2 ?? ""} onChange={e => set(a._key, "area_privativa_m2", e.target.value ? Number(e.target.value) : null)} className={clsx(inputClass, "w-20")} placeholder="48" />
                    </td>
                    <td className="px-1 py-1.5">
                      <input type="number" value={a.preco_tabela ?? ""} onChange={e => set(a._key, "preco_tabela", e.target.value ? Number(e.target.value) : null)} className={clsx(inputClass, "w-28")} placeholder="350000" />
                    </td>
                    <td className="px-1 py-1.5">
                      <select value={a.orientacao_solar ?? ""} onChange={e => set(a._key, "orientacao_solar", e.target.value)} className={clsx(inputClass, "bg-white w-32")}>
                        <option value="">—</option>
                        {Object.entries(ORIENTACOES).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                      </select>
                    </td>
                    <td className="px-1 py-1.5">
                      <button onClick={() => removerAndar(a._key)} disabled={andares.length === 1}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-30" title="Remover andar">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={addAndar} className="mt-3 flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
            <Plus size={15} /> Adicionar andar
          </button>

          <p className="text-xs text-slate-400 mt-4">
            Prévia: <strong>{preview.length}</strong> unidades serão geradas no grupo <strong>{grupo || "—"}</strong>.
          </p>

          {erro && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-3">
              <AlertCircle size={14} /> {erro}
            </div>
          )}

          <div className="flex gap-2 pt-4 mt-2 border-t border-slate-100">
            <button onClick={() => navigate("/espelho")} className="px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
              Cancelar
            </button>
            <button
              onClick={() => { setErro(""); if (!grupo.trim()) { setErro("Informe o grupo"); return; } if (preview.length === 0) { setErro("Nenhuma unidade configurada"); return; } setMostrarPreview(true); }}
              className="px-4 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700">
              Ver prévia e confirmar
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 print:shadow-none print:border-0">
          <div className="flex items-center justify-between mb-4 print:mb-6">
            <div>
              <h2 className="font-bold text-slate-800 print:text-xl">Tabela de unidades — {grupo}</h2>
              <p className="text-xs text-slate-500 print:text-sm">{emp?.nome}</p>
            </div>
            <button onClick={() => window.print()} className="print:hidden flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
              <Printer size={15} /> Exportar PDF
            </button>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-2">Unidade</th>
                <th className="py-2 pr-2">Andar</th>
                <th className="py-2 pr-2">Tipo</th>
                <th className="py-2 pr-2">Área</th>
                <th className="py-2 pr-2">Orientação</th>
                <th className="py-2 pr-2 text-right">Preço de tabela</th>
              </tr>
            </thead>
            <tbody>
              {preview.map(u => (
                <tr key={u.identificador} className="border-b border-slate-50">
                  <td className="py-1.5 pr-2 font-medium text-slate-700">{u.identificador}</td>
                  <td className="py-1.5 pr-2 text-slate-500">{u.andar}º</td>
                  <td className="py-1.5 pr-2 text-slate-500 capitalize">{u.tipo ?? "—"}</td>
                  <td className="py-1.5 pr-2 text-slate-500">{u.area ? `${u.area} m²` : "—"}</td>
                  <td className="py-1.5 pr-2 text-slate-500">{u.orientacao ? ORIENTACOES[u.orientacao] : "—"}</td>
                  <td className="py-1.5 pr-2 text-right text-slate-700">{u.preco ? fmt(u.preco) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 font-semibold text-slate-700">
                <td className="py-2 pr-2" colSpan={3}>Total — {preview.length} unidades</td>
                <td className="py-2 pr-2">{totalArea ? `${totalArea.toFixed(0)} m²` : "—"}</td>
                <td></td>
                <td className="py-2 pr-2 text-right">{totalVgv ? fmt(totalVgv) : "—"}</td>
              </tr>
            </tfoot>
          </table>

          {erro && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-4 print:hidden">
              <AlertCircle size={14} /> {erro}
            </div>
          )}

          <div className="flex gap-2 pt-5 mt-4 border-t border-slate-100 print:hidden">
            <button onClick={() => setMostrarPreview(false)} className="px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
              Voltar e editar
            </button>
            <button onClick={confirmarGerar} disabled={gerar.isPending}
              className="px-4 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-60 flex items-center gap-2">
              {gerar.isPending && <Loader2 size={14} className="animate-spin" />}
              Confirmar e gerar {preview.length} unidades
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
