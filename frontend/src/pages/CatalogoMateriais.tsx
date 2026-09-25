import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  Package, Plus, Upload, Download, Search, Pencil, Trash2, Eye, EyeOff,
  Loader2, X, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, FileSpreadsheet,
} from "lucide-react";
import { clsx } from "clsx";
import { catalogoApi, type ResultadoImportacao } from "@/api/client";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { useAuthStore } from "@/stores/authStore";
import { podeEditarCatalogo } from "@/lib/permissoes";
import type { Material } from "@/types";

const POR_PAGINA = 50;
const UNIDADES_COMUNS = ["UN", "PÇ", "M", "M2", "M3", "KG", "SC", "L", "CX", "RL", "GL", "BR", "TON", "CJ", "VB"];
const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500";

const ORIGEM: Record<Material["origem"], { label: string; cor: string }> = {
  padrao:   { label: "Padrão",   cor: "bg-slate-100 text-slate-600" },
  proprio:  { label: "Próprio",  cor: "bg-brand-100 text-brand-700" },
  planilha: { label: "Planilha", cor: "bg-emerald-100 text-emerald-700" },
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Atualiza todas as telas que mostram o catálogo (esta, Suprimentos e a busca do Orçamento). */
function invalidarCatalogo(qc: QueryClient) {
  qc.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith("catalogo") });
}

// ── Modal: incluir / editar material ───────────────────────────────────────────

function MaterialModal({ material, familias, onClose }: {
  material: Material | null; familias: string[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [codigo, setCodigo] = useState(material?.codigo ?? "");
  const [descricao, setDescricao] = useState(material?.descricao ?? "");
  const [unidade, setUnidade] = useState(material?.unidade ?? "UN");
  const [familia, setFamilia] = useState(material?.familia ?? "");
  const [preco, setPreco] = useState<number | null>(material?.preco_referencia != null ? Number(material.preco_referencia) : null);
  const [erro, setErro] = useState("");

  const salvar = useMutation({
    mutationFn: () => {
      const dados = {
        codigo: codigo.trim() || null, descricao: descricao.trim(), unidade: unidade.trim() || "UN",
        familia: familia.trim() || null, preco_referencia: preco,
      };
      return material ? catalogoApi.atualizar(material.id, dados) : catalogoApi.criar(dados);
    },
    onSuccess: () => { invalidarCatalogo(qc); onClose(); },
    onError: (e: any) => setErro(e?.response?.data?.detail ?? "Erro ao salvar o material"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">{material ? "Editar material" : "Novo material"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X size={16} /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Descrição *</label>
            <input value={descricao} onChange={e => setDescricao(e.target.value)} className={inputClass} placeholder="Ex: Cimento CP II-E 50 kg" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Código</label>
              <input value={codigo} onChange={e => setCodigo(e.target.value)} className={inputClass} placeholder="Opcional" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Unidade *</label>
              <input value={unidade} onChange={e => setUnidade(e.target.value.toUpperCase())} list="unidades-comuns" className={inputClass} />
              <datalist id="unidades-comuns">{UNIDADES_COMUNS.map(u => <option key={u} value={u} />)}</datalist>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Família</label>
            <input value={familia} onChange={e => setFamilia(e.target.value.toUpperCase())} list="familias-catalogo" className={inputClass} placeholder="Ex: ELÉTRICA" />
            <datalist id="familias-catalogo">{familias.map(f => <option key={f} value={f} />)}</datalist>
          </div>
          <CurrencyInput label="Preço de referência" nullable small value={preco} onChange={setPreco}
            dica="Usado para preencher o custo unitário no orçamento" />

          {erro && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2"><AlertCircle size={14} /> {erro}</div>}

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button onClick={() => { setErro(""); if (descricao.trim().length < 2) { setErro("Informe a descrição"); return; } salvar.mutate(); }}
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

// ── Modal: importar planilha (analisa antes de gravar) ─────────────────────────

function ImportarModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [modo, setModo] = useState<"adicionar" | "substituir">("adicionar");
  const [previa, setPrevia] = useState<ResultadoImportacao | null>(null);
  const [concluido, setConcluido] = useState<ResultadoImportacao | null>(null);
  const [erro, setErro] = useState("");

  const analisar = useMutation({
    mutationFn: () => catalogoApi.importar(arquivo!, modo, true),
    onSuccess: r => setPrevia(r),
    onError: (e: any) => setErro(e?.response?.data?.detail ?? "Não foi possível ler a planilha"),
  });
  const confirmar = useMutation({
    mutationFn: () => catalogoApi.importar(arquivo!, modo, false),
    onSuccess: r => { setConcluido(r); invalidarCatalogo(qc); },
    onError: (e: any) => setErro(e?.response?.data?.detail ?? "Erro ao importar"),
  });

  const resumo = concluido ?? previa;
  const nadaAMudar = !!previa && previa.novos + previa.atualizados + previa.ocultados === 0;

  function trocarArquivo(f: File | null) {
    setArquivo(f); setPrevia(null); setErro("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Importar planilha de materiais</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {!concluido && (
            <>
              <p className="text-sm text-slate-500">
                Colunas aceitas: <strong>Descrição</strong> (obrigatória), Código, Unidade, Família e Preço.
                {" "}<button onClick={() => catalogoApi.baixarModelo()} className="text-brand-600 font-medium underline hover:no-underline">Baixar modelo</button>
              </p>

              <button onClick={() => inputRef.current?.click()}
                className="w-full flex items-center gap-3 px-4 py-4 border-2 border-dashed border-slate-200 rounded-xl hover:border-brand-300 hover:bg-brand-50/30 text-left">
                <FileSpreadsheet size={22} className="text-emerald-600 shrink-0" />
                <span className="text-sm text-slate-700 truncate">{arquivo ? arquivo.name : "Escolher arquivo .xlsx ou .csv"}</span>
              </button>
              <input ref={inputRef} type="file" accept=".xlsx,.csv" className="hidden"
                onChange={e => trocarArquivo(e.target.files?.[0] ?? null)} />

              <div className="space-y-2">
                {([
                  ["adicionar", "Adicionar e atualizar", "Inclui os novos e atualiza os que já existem. Nada é removido."],
                  ["substituir", "Substituir o catálogo", "Faz o mesmo e oculta os itens que não estão na planilha. Os ocultos podem ser reativados depois."],
                ] as const).map(([valor, titulo, texto]) => (
                  <label key={valor} className={clsx("flex gap-3 p-3 rounded-lg border cursor-pointer",
                    modo === valor ? "border-brand-400 bg-brand-50/40" : "border-slate-200 hover:border-slate-300")}>
                    <input type="radio" checked={modo === valor} onChange={() => { setModo(valor); setPrevia(null); }} className="mt-0.5" />
                    <span>
                      <span className="block text-sm font-medium text-slate-800">{titulo}</span>
                      <span className="block text-xs text-slate-500">{texto}</span>
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}

          {resumo && (
            <div className={clsx("rounded-xl border p-4", concluido ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50")}>
              <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                {concluido ? <><CheckCircle2 size={16} className="text-emerald-600" /> Importação concluída</> : "Prévia: nada foi gravado ainda"}
              </p>
              <dl className="grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-slate-500">Novos</dt><dd className="font-semibold text-slate-800 text-right">{resumo.novos}</dd>
                <dt className="text-slate-500">Atualizados</dt><dd className="font-semibold text-slate-800 text-right">{resumo.atualizados}</dd>
                <dt className="text-slate-500">Sem alteração</dt><dd className="font-semibold text-slate-800 text-right">{resumo.sem_alteracao}</dd>
                {resumo.modo === "substituir" && <>
                  <dt className="text-amber-700">A ocultar</dt><dd className="font-semibold text-amber-700 text-right">{resumo.ocultados}</dd>
                </>}
              </dl>
              {resumo.total_erros > 0 && (
                <div className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 max-h-28 overflow-y-auto">
                  <p className="font-semibold mb-1">{resumo.total_erros} linha(s) ignorada(s):</p>
                  {resumo.erros.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              )}
            </div>
          )}

          {erro && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2"><AlertCircle size={14} /> {erro}</div>}

          <div className="flex gap-2 pt-1">
            {concluido ? (
              <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700">Fechar</button>
            ) : (
              <>
                <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
                {!previa ? (
                  <button onClick={() => { setErro(""); analisar.mutate(); }} disabled={!arquivo || analisar.isPending}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2">
                    {analisar.isPending && <Loader2 size={14} className="animate-spin" />} Analisar planilha
                  </button>
                ) : (
                  <button onClick={() => { setErro(""); confirmar.mutate(); }} disabled={confirmar.isPending || nadaAMudar}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                    {confirmar.isPending && <Loader2 size={14} className="animate-spin" />}
                    {nadaAMudar ? "Nada a importar" : "Confirmar importação"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Página ─────────────────────────────────────────────────────────────────────

export function CatalogoMateriais() {
  const qc = useQueryClient();
  const podeEditar = podeEditarCatalogo(useAuthStore(s => s.user?.papel));
  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState("");
  const [familia, setFamilia] = useState("");
  const [mostrarOcultos, setMostrarOcultos] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [editando, setEditando] = useState<Material | "novo" | null>(null);
  const [importando, setImportando] = useState(false);

  // Espera o usuário parar de digitar antes de buscar
  useEffect(() => {
    const t = setTimeout(() => { setBuscaAtiva(busca.trim()); setPagina(0); }, 300);
    return () => clearTimeout(t);
  }, [busca]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["catalogo-lista", buscaAtiva, familia, mostrarOcultos, pagina],
    queryFn: () => catalogoApi.listarMateriais({
      q: buscaAtiva || undefined, familia: familia || undefined,
      limit: POR_PAGINA, offset: pagina * POR_PAGINA, incluir_inativos: mostrarOcultos,
    }),
    placeholderData: prev => prev,
  });
  const { data: familias = [] } = useQuery({
    queryKey: ["catalogo-familias"],
    queryFn: () => catalogoApi.listarFamilias(),
  });

  const alternarAtivo = useMutation({
    mutationFn: (m: Material) => catalogoApi.atualizar(m.id, { ativo: !m.ativo }),
    onSuccess: () => invalidarCatalogo(qc),
  });
  const excluir = useMutation({
    mutationFn: (m: Material) => catalogoApi.excluir(m.id),
    onSuccess: () => invalidarCatalogo(qc),
  });

  const total = data?.total ?? 0;
  const itens = data?.items ?? [];
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <>
      {editando && <MaterialModal material={editando === "novo" ? null : editando} familias={familias} onClose={() => setEditando(null)} />}
      {importando && <ImportarModal onClose={() => setImportando(false)} />}

      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Package size={20} className="text-brand-600" /> Catálogo de Materiais</h1>
            <p className="text-sm text-slate-500 mt-0.5">Lista usada nos orçamentos e nas requisições de Suprimentos</p>
          </div>
          {podeEditar && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => catalogoApi.baixarModelo()}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                <Download size={15} /> Modelo
              </button>
              <button onClick={() => setImportando(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-50">
                <Upload size={15} /> Importar planilha
              </button>
              <button onClick={() => setEditando("novo")}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700">
                <Plus size={15} /> Novo material
              </button>
            </div>
          )}
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por descrição ou código…"
              className={clsx(inputClass, "pl-9")} />
          </div>
          <select value={familia} onChange={e => { setFamilia(e.target.value); setPagina(0); }} className={clsx(inputClass, "sm:w-56 bg-white")}>
            <option value="">Todas as famílias</option>
            {familias.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <label className="flex items-center gap-2 px-3 text-sm text-slate-600 whitespace-nowrap cursor-pointer">
            <input type="checkbox" checked={mostrarOcultos} onChange={e => { setMostrarOcultos(e.target.checked); setPagina(0); }} />
            Mostrar ocultos
          </label>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-slate-400"><Loader2 size={20} className="animate-spin mr-2" /> Carregando catálogo…</div>
          ) : isError ? (
            <div className="flex items-center justify-center h-40 text-red-500 gap-2"><AlertCircle size={18} /> Erro ao carregar o catálogo.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Código</th>
                    <th className="px-4 py-2.5 text-left font-medium">Descrição</th>
                    <th className="px-4 py-2.5 text-left font-medium">Un.</th>
                    <th className="px-4 py-2.5 text-left font-medium">Família</th>
                    <th className="px-4 py-2.5 text-right font-medium">Preço ref.</th>
                    <th className="px-4 py-2.5 text-left font-medium">Origem</th>
                    {podeEditar && <th className="px-4 py-2.5" />}
                  </tr>
                </thead>
                <tbody>
                  {itens.map(m => (
                    <tr key={m.id} className={clsx("border-t border-slate-100", !m.ativo && "opacity-50")}>
                      <td className="px-4 py-2 text-xs text-slate-500 tabular-nums">{m.codigo ?? "—"}</td>
                      <td className="px-4 py-2 text-slate-800">
                        {m.descricao}
                        {!m.ativo && <span className="ml-2 text-[10px] font-semibold uppercase text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">Oculto</span>}
                      </td>
                      <td className="px-4 py-2 text-slate-600">{m.unidade}</td>
                      <td className="px-4 py-2 text-xs text-slate-500">{m.familia ?? "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-700">{m.preco_referencia != null ? brl(Number(m.preco_referencia)) : "—"}</td>
                      <td className="px-4 py-2"><span className={clsx("text-[11px] font-medium rounded-full px-2 py-0.5", ORIGEM[m.origem].cor)}>{ORIGEM[m.origem].label}</span></td>
                      {podeEditar && (
                        <td className="px-4 py-2">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => setEditando(m)} title="Editar" className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50"><Pencil size={14} /></button>
                            <button onClick={() => alternarAtivo.mutate(m)} title={m.ativo ? "Ocultar" : "Reativar"}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50">
                              {m.ativo ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                            <button onClick={() => { if (confirm(`Excluir "${m.descricao}" do catálogo? Esta ação não pode ser desfeita. Para esconder sem apagar, use Ocultar.`)) excluir.mutate(m); }}
                              title="Excluir" className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {itens.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">Nenhum material encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginação */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
            <span>
              {total > 0 ? `${(pagina * POR_PAGINA + 1).toLocaleString("pt-BR")}–${Math.min((pagina + 1) * POR_PAGINA, total).toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")}` : "0 itens"}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pagina === 0}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30"><ChevronLeft size={16} /></button>
              <span className="px-2">Página {pagina + 1} de {totalPaginas}</span>
              <button onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))} disabled={pagina >= totalPaginas - 1}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30"><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
