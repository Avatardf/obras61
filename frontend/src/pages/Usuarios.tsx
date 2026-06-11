import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus, Pencil, Trash2, ShieldCheck, ShieldOff,
  Eye, EyeOff, X, Loader2, AlertCircle,
} from "lucide-react";
import { clsx } from "clsx";
import { usuariosApi, type UsuarioResponse } from "@/api/client";
import { PAPEL_LABELS, PAPEL_CORES, type Papel } from "@/lib/permissoes";
import { useAuthStore } from "@/stores/authStore";

// ── Helpers ────────────────────────────────────────────────────────────────────

const PAPEIS: Papel[] = ["admin", "engenheiro", "mestre", "comprador", "financeiro", "viewer"];

function PapelBadge({ papel }: { papel: string }) {
  const cor = PAPEL_CORES[papel as Papel] ?? "bg-slate-100 text-slate-600";
  const label = PAPEL_LABELS[papel as Papel] ?? papel;
  return (
    <span className={clsx("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", cor)}>
      {label}
    </span>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────────

interface ModalProps {
  usuario?: UsuarioResponse | null;
  onClose: () => void;
}

function UsuarioModal({ usuario, onClose }: ModalProps) {
  const qc = useQueryClient();
  const isEdicao = !!usuario;
  const [nome, setNome] = useState(usuario?.nome ?? "");
  const [email, setEmail] = useState(usuario?.email ?? "");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState<Papel>((usuario?.papel as Papel) ?? "viewer");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState("");

  const criar = useMutation({
    mutationFn: () => usuariosApi.criar({ nome, email, senha, papel }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["usuarios"] }); onClose(); },
    onError: (e: any) => setErro(e?.response?.data?.detail ?? "Erro ao criar usuário"),
  });

  const atualizar = useMutation({
    mutationFn: () => usuariosApi.atualizar(usuario!.id, {
      nome: nome || undefined,
      papel: papel || undefined,
      senha: senha || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["usuarios"] }); onClose(); },
    onError: (e: any) => setErro(e?.response?.data?.detail ?? "Erro ao atualizar usuário"),
  });

  const isPending = criar.isPending || atualizar.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!nome.trim()) { setErro("Nome é obrigatório"); return; }
    if (!isEdicao && !email.trim()) { setErro("E-mail é obrigatório"); return; }
    if (!isEdicao && !senha) { setErro("Senha é obrigatória"); return; }
    isEdicao ? atualizar.mutate() : criar.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">
            {isEdicao ? "Editar Usuário" : "Novo Usuário"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Nome completo</label>
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: João da Silva"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
            />
          </div>

          {/* E-mail — só na criação */}
          {!isEdicao && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="usuario@empresa.com"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
              />
            </div>
          )}

          {/* Papel */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Perfil de acesso</label>
            <select
              value={papel}
              onChange={e => setPapel(e.target.value as Papel)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 bg-white"
            >
              {PAPEIS.map(p => (
                <option key={p} value={p}>{PAPEL_LABELS[p]}</option>
              ))}
            </select>
          </div>

          {/* Senha */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              {isEdicao ? "Nova senha (deixe em branco para não alterar)" : "Senha"}
            </label>
            <div className="relative">
              <input
                type={mostrarSenha ? "text" : "password"}
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder={isEdicao ? "••••••••" : "Mínimo 6 caracteres"}
                className="w-full px-3 py-2 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {mostrarSenha ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Erro */}
          {erro && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle size={14} />
              {erro}
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              {isEdicao ? "Salvar" : "Criar Usuário"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Confirmação de exclusão ────────────────────────────────────────────────────

function ConfirmarExclusao({ usuario, onClose }: { usuario: UsuarioResponse; onClose: () => void }) {
  const qc = useQueryClient();
  const excluir = useMutation({
    mutationFn: () => usuariosApi.excluir(usuario.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["usuarios"] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <Trash2 size={20} className="text-red-400" />
        </div>
        <h2 className="text-base font-semibold text-slate-800 mb-1">Excluir usuário?</h2>
        <p className="text-sm text-slate-500 mb-5">
          <span className="font-medium text-slate-700">{usuario.nome}</span> será removido permanentemente e não poderá mais acessar o sistema.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => excluir.mutate()}
            disabled={excluir.isPending}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            {excluir.isPending && <Loader2 size={14} className="animate-spin" />}
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

export function Usuarios() {
  const { user: eu } = useAuthStore();
  const qc = useQueryClient();
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<UsuarioResponse | null>(null);
  const [excluindo, setExcluindo] = useState<UsuarioResponse | null>(null);

  const { data: usuarios = [], isLoading, isError } = useQuery({
    queryKey: ["usuarios"],
    queryFn: usuariosApi.listar,
  });

  const toggleAtivo = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      usuariosApi.atualizar(id, { ativo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usuarios"] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 size={24} className="animate-spin mr-2" />
        Carregando usuários…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500 gap-2">
        <AlertCircle size={20} />
        Erro ao carregar usuários
      </div>
    );
  }

  return (
    <>
      {/* Modais */}
      {(modalAberto || editando) && (
        <UsuarioModal
          usuario={editando}
          onClose={() => { setModalAberto(false); setEditando(null); }}
        />
      )}
      {excluindo && (
        <ConfirmarExclusao
          usuario={excluindo}
          onClose={() => setExcluindo(null)}
        />
      )}

      <div className="p-6 max-w-4xl mx-auto">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Gerenciar Usuários</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {usuarios.length} {usuarios.length === 1 ? "usuário cadastrado" : "usuários cadastrados"} neste tenant
            </p>
          </div>
          <button
            onClick={() => { setEditando(null); setModalAberto(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-colors shadow-sm"
          >
            <UserPlus size={15} />
            Novo Usuário
          </button>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Usuário</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Perfil</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {usuarios.map(u => {
                const sou_eu = u.id === eu?.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Usuário */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {u.nome[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800 leading-tight">
                            {u.nome}
                            {sou_eu && <span className="ml-1.5 text-[10px] text-brand-500 font-medium">(você)</span>}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Perfil */}
                    <td className="px-4 py-3.5">
                      <PapelBadge papel={u.papel} />
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => !sou_eu && toggleAtivo.mutate({ id: u.id, ativo: !u.ativo })}
                        disabled={sou_eu}
                        title={sou_eu ? "Você não pode desativar sua própria conta" : (u.ativo ? "Desativar" : "Ativar")}
                        className={clsx(
                          "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors",
                          u.ativo
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200",
                          sou_eu && "cursor-default opacity-70"
                        )}
                      >
                        {u.ativo ? <ShieldCheck size={11} /> : <ShieldOff size={11} />}
                        {u.ativo ? "Ativo" : "Inativo"}
                      </button>
                    </td>

                    {/* Ações */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditando(u)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => !sou_eu && setExcluindo(u)}
                          disabled={sou_eu}
                          className={clsx(
                            "p-1.5 rounded-lg transition-colors",
                            sou_eu
                              ? "text-slate-200 cursor-default"
                              : "text-slate-400 hover:text-red-500 hover:bg-red-50"
                          )}
                          title={sou_eu ? "Você não pode excluir sua própria conta" : "Excluir"}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {usuarios.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <p className="text-sm">Nenhum usuário cadastrado ainda.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
