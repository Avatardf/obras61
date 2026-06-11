import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users, UserPlus, Plus, Pencil, Trash2, X, Loader2, AlertCircle,
  HardHat, Building2, MapPin, Phone, ShieldCheck, ShieldOff,
} from "lucide-react";
import { clsx } from "clsx";
import {
  equipesApi, suprimentosApi, fornecedoresApi,
  type ColaboradorResponse, type EquipeResponse,
} from "@/api/client";

// ── Constantes ─────────────────────────────────────────────────────────────────

const FUNCOES_SUGERIDAS = [
  "Encarregado", "Mestre de obras", "Pedreiro", "Servente", "Armador",
  "Carpinteiro", "Eletricista", "Encanador", "Pintor", "Azulejista",
  "Gesseiro", "Soldador", "Operador de grua", "Almoxarife", "Vigia",
];

const inputClass =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none " +
  "focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500";

function VinculoBadge({ tipo }: { tipo: string }) {
  return tipo === "proprio" ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
      Próprio
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
      Terceirizado
    </span>
  );
}

// ── Modal: Colaborador ─────────────────────────────────────────────────────────

function ColaboradorModal({
  colaborador, equipes, onClose,
}: {
  colaborador?: ColaboradorResponse | null;
  equipes: EquipeResponse[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdicao = !!colaborador;
  const [nome, setNome] = useState(colaborador?.nome ?? "");
  const [funcao, setFuncao] = useState(colaborador?.funcao ?? "");
  const [tipoVinculo, setTipoVinculo] = useState<"proprio" | "terceirizado">(colaborador?.tipo_vinculo ?? "proprio");
  const [fornecedorId, setFornecedorId] = useState(colaborador?.fornecedor_id ?? "");
  const [equipeId, setEquipeId] = useState(colaborador?.equipe_id ?? "");
  const [custoDiaria, setCustoDiaria] = useState(colaborador?.custo_diaria?.toString() ?? "");
  const [telefone, setTelefone] = useState(colaborador?.telefone ?? "");
  const [erro, setErro] = useState("");

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: () => fornecedoresApi.listar({ ativo: true }),
    enabled: tipoVinculo === "terceirizado",
  });

  const payload = () => ({
    nome, funcao,
    tipo_vinculo: tipoVinculo,
    fornecedor_id: tipoVinculo === "terceirizado" && fornecedorId ? fornecedorId : null,
    equipe_id: equipeId || null,
    custo_diaria: custoDiaria ? Number(custoDiaria) : null,
    telefone: telefone || null,
  });

  const salvar = useMutation({
    mutationFn: () =>
      isEdicao
        ? equipesApi.atualizarColaborador(colaborador!.id, payload())
        : equipesApi.criarColaborador(payload()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["colaboradores"] });
      qc.invalidateQueries({ queryKey: ["equipes"] });
      onClose();
    },
    onError: (e: any) => setErro(e?.response?.data?.detail ?? "Erro ao salvar colaborador"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!nome.trim()) { setErro("Nome é obrigatório"); return; }
    if (!funcao.trim()) { setErro("Função é obrigatória"); return; }
    salvar.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">
            {isEdicao ? "Editar Colaborador" : "Novo Colaborador"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Nome completo *</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: José Pereira" className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Função *</label>
              <input
                value={funcao} onChange={e => setFuncao(e.target.value)}
                placeholder="Ex: Pedreiro" list="funcoes-sugeridas" className={inputClass}
              />
              <datalist id="funcoes-sugeridas">
                {FUNCOES_SUGERIDAS.map(f => <option key={f} value={f} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Vínculo</label>
              <select value={tipoVinculo} onChange={e => setTipoVinculo(e.target.value as any)} className={clsx(inputClass, "bg-white")}>
                <option value="proprio">Próprio</option>
                <option value="terceirizado">Terceirizado</option>
              </select>
            </div>
          </div>

          {tipoVinculo === "terceirizado" && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Empreiteira / Fornecedor</label>
              <select value={fornecedorId} onChange={e => setFornecedorId(e.target.value)} className={clsx(inputClass, "bg-white")}>
                <option value="">— Não informado —</option>
                {fornecedores.map((f: any) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Custo diária (R$)</label>
              <input
                type="number" min="0" step="0.01"
                value={custoDiaria} onChange={e => setCustoDiaria(e.target.value)}
                placeholder="Ex: 180,00" className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Telefone</label>
              <input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(21) 99999-9999" className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Equipe</label>
            <select value={equipeId} onChange={e => setEquipeId(e.target.value)} className={clsx(inputClass, "bg-white")}>
              <option value="">— Sem equipe —</option>
              {equipes.map(eq => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
            </select>
          </div>

          {erro && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle size={14} />
              {erro}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={salvar.isPending}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {salvar.isPending && <Loader2 size={14} className="animate-spin" />}
              {isEdicao ? "Salvar" : "Criar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: Equipe ──────────────────────────────────────────────────────────────

function EquipeModal({
  equipe, colaboradores, onClose,
}: {
  equipe?: EquipeResponse | null;
  colaboradores: ColaboradorResponse[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdicao = !!equipe;
  const [nome, setNome] = useState(equipe?.nome ?? "");
  const [liderId, setLiderId] = useState(equipe?.lider_id ?? "");
  const [descricao, setDescricao] = useState(equipe?.descricao ?? "");
  const [erro, setErro] = useState("");

  const salvar = useMutation({
    mutationFn: () => {
      const data = { nome, lider_id: liderId || null, descricao: descricao || null };
      return isEdicao ? equipesApi.atualizar(equipe!.id, data) : equipesApi.criar(data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["equipes"] }); onClose(); },
    onError: (e: any) => setErro(e?.response?.data?.detail ?? "Erro ao salvar equipe"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!nome.trim()) { setErro("Nome é obrigatório"); return; }
    salvar.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">
            {isEdicao ? "Editar Equipe" : "Nova Equipe"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Nome da equipe *</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Equipe Estrutura A" className={inputClass} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Encarregado / Líder</label>
            <select value={liderId} onChange={e => setLiderId(e.target.value)} className={clsx(inputClass, "bg-white")}>
              <option value="">— Não definido —</option>
              {colaboradores.map(c => (
                <option key={c.id} value={c.id}>{c.nome} ({c.funcao})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Descrição</label>
            <textarea
              value={descricao} onChange={e => setDescricao(e.target.value)} rows={2}
              placeholder="Especialidade, observações…" className={inputClass}
            />
          </div>

          {erro && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle size={14} />
              {erro}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={salvar.isPending}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {salvar.isPending && <Loader2 size={14} className="animate-spin" />}
              {isEdicao ? "Salvar" : "Criar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: Alocar equipe a obra ────────────────────────────────────────────────

function AlocarModal({ equipe, onClose }: { equipe: EquipeResponse; onClose: () => void }) {
  const qc = useQueryClient();
  const hoje = new Date().toISOString().slice(0, 10);
  const [obraId, setObraId] = useState("");
  const [dataInicio, setDataInicio] = useState(hoje);
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState("");

  const { data: obras = [] } = useQuery({
    queryKey: ["obras-lista"],
    queryFn: suprimentosApi.listarObras,
  });

  const alocar = useMutation({
    mutationFn: () => equipesApi.alocar(equipe.id, {
      obra_id: obraId, data_inicio: dataInicio, observacao: observacao || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["equipes"] }); onClose(); },
    onError: (e: any) => setErro(e?.response?.data?.detail ?? "Erro ao alocar equipe"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!obraId) { setErro("Selecione a obra"); return; }
    alocar.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Alocar "{equipe.nome}" a uma obra</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {equipe.alocacao_atual && (
            <div className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              Atualmente em <strong>{equipe.alocacao_atual.obra_nome}</strong>. A alocação atual
              será encerrada na data de início da nova.
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Obra *</label>
            <select value={obraId} onChange={e => setObraId(e.target.value)} className={clsx(inputClass, "bg-white")}>
              <option value="">— Selecione —</option>
              {obras.map((o: any) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Data de início *</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Observação</label>
            <input value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Opcional" className={inputClass} />
          </div>

          {erro && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle size={14} />
              {erro}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={alocar.isPending}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {alocar.isPending && <Loader2 size={14} className="animate-spin" />}
              Alocar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Confirmação de exclusão genérica ───────────────────────────────────────────

function ConfirmarExclusao({
  titulo, mensagem, onConfirmar, onClose, isPending,
}: {
  titulo: string; mensagem: React.ReactNode;
  onConfirmar: () => void; onClose: () => void; isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <Trash2 size={20} className="text-red-400" />
        </div>
        <h2 className="text-base font-semibold text-slate-800 mb-1">{titulo}</h2>
        <p className="text-sm text-slate-500 mb-5">{mensagem}</p>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirmar} disabled={isPending}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
            {isPending && <Loader2 size={14} className="animate-spin" />}
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

type Aba = "colaboradores" | "equipes";

export function Equipes() {
  const qc = useQueryClient();
  const [aba, setAba] = useState<Aba>("colaboradores");

  // Modais
  const [colabModal, setColabModal] = useState(false);
  const [colabEditando, setColabEditando] = useState<ColaboradorResponse | null>(null);
  const [colabExcluindo, setColabExcluindo] = useState<ColaboradorResponse | null>(null);
  const [equipeModal, setEquipeModal] = useState(false);
  const [equipeEditando, setEquipeEditando] = useState<EquipeResponse | null>(null);
  const [equipeExcluindo, setEquipeExcluindo] = useState<EquipeResponse | null>(null);
  const [alocando, setAlocando] = useState<EquipeResponse | null>(null);

  const { data: colaboradores = [], isLoading: loadingColab, isError: erroColab } = useQuery({
    queryKey: ["colaboradores"],
    queryFn: () => equipesApi.listarColaboradores(),
  });

  const { data: equipes = [], isLoading: loadingEquipes, isError: erroEquipes } = useQuery({
    queryKey: ["equipes"],
    queryFn: () => equipesApi.listar(),
  });

  const toggleAtivoColab = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      equipesApi.atualizarColaborador(id, { ativo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["colaboradores"] }),
  });

  const excluirColab = useMutation({
    mutationFn: (id: string) => equipesApi.excluirColaborador(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["colaboradores"] });
      qc.invalidateQueries({ queryKey: ["equipes"] });
      setColabExcluindo(null);
    },
  });

  const excluirEquipe = useMutation({
    mutationFn: (id: string) => equipesApi.excluir(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equipes"] });
      qc.invalidateQueries({ queryKey: ["colaboradores"] });
      setEquipeExcluindo(null);
    },
  });

  const isLoading = loadingColab || loadingEquipes;
  const isError = erroColab || erroEquipes;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 size={24} className="animate-spin mr-2" />
        Carregando equipes…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500 gap-2">
        <AlertCircle size={20} />
        Erro ao carregar dados. Verifique se a API está rodando.
      </div>
    );
  }

  const nomePorId = new Map(colaboradores.map(c => [c.id, c.nome]));
  const equipePorId = new Map(equipes.map(e => [e.id, e.nome]));

  return (
    <>
      {/* Modais */}
      {(colabModal || colabEditando) && (
        <ColaboradorModal
          colaborador={colabEditando}
          equipes={equipes}
          onClose={() => { setColabModal(false); setColabEditando(null); }}
        />
      )}
      {(equipeModal || equipeEditando) && (
        <EquipeModal
          equipe={equipeEditando}
          colaboradores={colaboradores}
          onClose={() => { setEquipeModal(false); setEquipeEditando(null); }}
        />
      )}
      {alocando && <AlocarModal equipe={alocando} onClose={() => setAlocando(null)} />}
      {colabExcluindo && (
        <ConfirmarExclusao
          titulo="Excluir colaborador?"
          mensagem={<><span className="font-medium text-slate-700">{colabExcluindo.nome}</span> será removido permanentemente.</>}
          onConfirmar={() => excluirColab.mutate(colabExcluindo.id)}
          onClose={() => setColabExcluindo(null)}
          isPending={excluirColab.isPending}
        />
      )}
      {equipeExcluindo && (
        <ConfirmarExclusao
          titulo="Excluir equipe?"
          mensagem={<>A equipe <span className="font-medium text-slate-700">{equipeExcluindo.nome}</span> será removida. Os colaboradores serão desvinculados, mas não excluídos.</>}
          onConfirmar={() => excluirEquipe.mutate(equipeExcluindo.id)}
          onClose={() => setEquipeExcluindo(null)}
          isPending={excluirEquipe.isPending}
        />
      )}

      <div className="p-6 max-w-6xl mx-auto">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Equipes</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {colaboradores.length} colaboradores · {equipes.length} equipes
            </p>
          </div>
          {aba === "colaboradores" ? (
            <button
              onClick={() => { setColabEditando(null); setColabModal(true); }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-colors shadow-sm"
            >
              <UserPlus size={15} />
              Novo Colaborador
            </button>
          ) : (
            <button
              onClick={() => { setEquipeEditando(null); setEquipeModal(true); }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-colors shadow-sm"
            >
              <Plus size={15} />
              Nova Equipe
            </button>
          )}
        </div>

        {/* Abas */}
        <div className="flex gap-1 mb-5 border-b border-slate-200">
          {([
            { id: "colaboradores", label: "Colaboradores", icone: HardHat },
            { id: "equipes", label: "Equipes", icone: Users },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setAba(t.id)}
              className={clsx(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                aba === t.id
                  ? "text-brand-600 border-brand-600"
                  : "text-slate-500 border-transparent hover:text-slate-700"
              )}
            >
              <t.icone size={15} />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── ABA COLABORADORES ─────────────────────────────────── */}
        {aba === "colaboradores" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Colaborador</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Função</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Vínculo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Equipe</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Diária</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {colaboradores.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-slate-800 leading-tight">{c.nome}</p>
                        {c.telefone && (
                          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                            <Phone size={10} /> {c.telefone}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{c.funcao}</td>
                      <td className="px-4 py-3.5"><VinculoBadge tipo={c.tipo_vinculo} /></td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {c.equipe_id ? equipePorId.get(c.equipe_id) ?? "—" : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-600 tabular-nums">
                        {c.custo_diaria != null
                          ? c.custo_diaria.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => toggleAtivoColab.mutate({ id: c.id, ativo: !c.ativo })}
                          className={clsx(
                            "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors",
                            c.ativo
                              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          )}
                        >
                          {c.ativo ? <ShieldCheck size={11} /> : <ShieldOff size={11} />}
                          {c.ativo ? "Ativo" : "Inativo"}
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setColabEditando(c)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Editar">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setColabExcluindo(c)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Excluir">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {colaboradores.length === 0 && (
              <div className="py-12 text-center text-slate-400">
                <HardHat size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-medium">Nenhum colaborador cadastrado</p>
                <p className="text-xs mt-1">Cadastre pedreiros, serventes, armadores e demais profissionais de campo.</p>
              </div>
            )}
          </div>
        )}

        {/* ── ABA EQUIPES ───────────────────────────────────────── */}
        {aba === "equipes" && (
          <>
            {equipes.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-12 text-center text-slate-400">
                <Users size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-medium">Nenhuma equipe criada</p>
                <p className="text-xs mt-1">Monte equipes com os colaboradores e aloque-as às obras.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {equipes.map(eq => (
                  <div key={eq.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col">
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-800 truncate">{eq.nome}</h3>
                        {eq.lider_id && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            Encarregado: <span className="font-medium">{nomePorId.get(eq.lider_id) ?? "—"}</span>
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button onClick={() => setEquipeEditando(eq)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Editar">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setEquipeExcluindo(eq)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Excluir">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Alocação atual */}
                    <div className={clsx(
                      "flex items-center gap-2 text-xs rounded-lg px-3 py-2 mb-3",
                      eq.alocacao_atual
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-50 text-slate-400"
                    )}>
                      {eq.alocacao_atual ? (
                        <>
                          <Building2 size={12} className="shrink-0" />
                          <span className="truncate">
                            Em <strong>{eq.alocacao_atual.obra_nome}</strong> desde{" "}
                            {new Date(eq.alocacao_atual.data_inicio + "T12:00:00").toLocaleDateString("pt-BR")}
                          </span>
                        </>
                      ) : (
                        <>
                          <MapPin size={12} className="shrink-0" />
                          Sem alocação no momento
                        </>
                      )}
                    </div>

                    {/* Membros */}
                    <div className="flex-1">
                      <p className="text-xs font-medium text-slate-500 mb-1.5">
                        {eq.membros.length} {eq.membros.length === 1 ? "membro" : "membros"}
                      </p>
                      {eq.membros.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {eq.membros.slice(0, 6).map(m => (
                            <span key={m.id} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {m.nome.split(" ")[0]} · {m.funcao}
                            </span>
                          ))}
                          {eq.membros.length > 6 && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-400">
                              +{eq.membros.length - 6}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setAlocando(eq)}
                      className="mt-4 w-full px-3 py-2 text-xs font-medium text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-50 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Building2 size={13} />
                      {eq.alocacao_atual ? "Realocar para outra obra" : "Alocar a uma obra"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
