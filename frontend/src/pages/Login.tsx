import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { authApi } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";

const LOGO_AMARELO = "/logo/logo-amarelo.png";

type Aba = "login" | "registrar";

const PERFIS_DEMO = [
  {
    papel: "admin",
    label: "Administrador",
    email: "admin@demo.com.br",
    descricao: "Acesso total: usuários, configs e todos os módulos",
    cor: "bg-purple-50 border-purple-200 hover:border-purple-400",
    badge: "bg-purple-100 text-purple-700",
    icone: "👑",
  },
  {
    papel: "engenheiro",
    label: "Engenheiro",
    email: "engenheiro@demo.com.br",
    descricao: "Obras, orçamentos, EVM e cronograma",
    cor: "bg-blue-50 border-blue-200 hover:border-blue-400",
    badge: "bg-blue-100 text-blue-700",
    icone: "🏗️",
  },
  {
    papel: "mestre",
    label: "Mestre de Obras",
    email: "mestre@demo.com.br",
    descricao: "RDO, avanço de etapas e ocorrências de campo",
    cor: "bg-orange-50 border-orange-200 hover:border-orange-400",
    badge: "bg-orange-100 text-orange-700",
    icone: "🦺",
  },
  {
    papel: "comprador",
    label: "Comprador",
    email: "comprador@demo.com.br",
    descricao: "Requisições, cotações e aprovação de materiais",
    cor: "bg-green-50 border-green-200 hover:border-green-400",
    badge: "bg-green-100 text-green-700",
    icone: "🛒",
  },
  {
    papel: "financeiro",
    label: "Financeiro",
    email: "financeiro@demo.com.br",
    descricao: "Centro de custo, conciliação bancária e relatórios",
    cor: "bg-emerald-50 border-emerald-200 hover:border-emerald-400",
    badge: "bg-emerald-100 text-emerald-700",
    icone: "💰",
  },
  {
    papel: "viewer",
    label: "Visitante",
    email: "viewer@demo.com.br",
    descricao: "Somente visualização, sem permissão de edição",
    cor: "bg-slate-50 border-slate-200 hover:border-slate-400",
    badge: "bg-slate-100 text-slate-600",
    icone: "👁️",
  },
];

export function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [aba, setAba] = useState<Aba>("login");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [mostrarPerfis, setMostrarPerfis] = useState(false);

  // campos login
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  // campos registro
  const [reg, setReg] = useState({
    nome: "", cnpj: "", nome_admin: "",
    email_admin: "", senha_admin: "",
  });

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const data = await authApi.login(email, senha);
      setAuth(data.access_token, {
        id: data.user.id,
        nome: data.user.nome,
        email: data.user.email,
        papel: data.user.papel,
        tenantId: data.user.tenant_id,
        tenantNome: data.user.tenant_nome,
      });
      navigate("/");
    } catch (err: any) {
      setErro(err?.response?.data?.detail ?? "Erro ao conectar ao servidor");
    } finally {
      setCarregando(false);
    }
  }

  async function handleRegistrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const data = await authApi.registrar(reg);
      setAuth(data.access_token, {
        id: data.user.id,
        nome: data.user.nome,
        email: data.user.email,
        papel: data.user.papel,
        tenantId: data.user.tenant_id,
        tenantNome: data.user.tenant_nome,
      });
      navigate("/");
    } catch (err: any) {
      setErro(err?.response?.data?.detail ?? "Erro ao criar conta");
    } finally {
      setCarregando(false);
    }
  }

  async function loginDemo(demoEmail: string) {
    setErro("");
    setCarregando(true);
    setEmail(demoEmail);
    setSenha("demo1234");
    try {
      const data = await authApi.login(demoEmail, "demo1234");
      setAuth(data.access_token, {
        id: data.user.id,
        nome: data.user.nome,
        email: data.user.email,
        papel: data.user.papel,
        tenantId: data.user.tenant_id,
        tenantNome: data.user.tenant_nome,
      });
      navigate("/");
    } catch (err: any) {
      setErro(err?.response?.data?.detail ?? "Erro ao conectar ao servidor");
    } finally {
      setCarregando(false);
    }
  }

  const inputClass =
    "w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm outline-none " +
    "focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-colors " +
    "placeholder:text-slate-400";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">

      {/* Painel central */}
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src={LOGO_AMARELO}
            alt="61Brasil Construtora"
            className="h-14 w-auto object-contain mx-auto mb-3"
            style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,.4))" }}
          />
          <p className="text-slate-400 text-sm mt-1">Gestão Inteligente de Obras</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Abas */}
          <div className="flex border-b border-slate-100">
            {(["login", "registrar"] as Aba[]).map((a) => (
              <button
                key={a}
                onClick={() => { setAba(a); setErro(""); }}
                className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
                  aba === a
                    ? "text-brand-600 border-b-2 border-brand-600"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {a === "login" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Erro global */}
            {erro && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
                {erro}
              </div>
            )}

            {/* ── FORM LOGIN ────────────────────────────────────── */}
            {aba === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="seu@email.com.br"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
                  <div className="relative">
                    <input
                      type={mostrarSenha ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={senha}
                      onChange={e => setSenha(e.target.value)}
                      className={`${inputClass} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarSenha(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={carregando}
                  className="w-full py-2.5 bg-brand-600 text-white rounded-lg text-sm font-semibold hover:bg-brand-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 mt-2"
                >
                  {carregando && <Loader2 size={16} className="animate-spin" />}
                  {carregando ? "Entrando…" : "Entrar"}
                </button>

                {/* Seletor de perfis de demonstração */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setMostrarPerfis(v => !v)}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                  >
                    <span className="text-xs font-medium text-slate-600">
                      🔑 Explorar perfis de demonstração
                    </span>
                    <span className="text-slate-400 text-xs">{mostrarPerfis ? "▲" : "▼"}</span>
                  </button>

                  {mostrarPerfis && (
                    <div className="p-3 bg-white border-t border-slate-100">
                      <p className="text-xs text-slate-500 mb-3">
                        Escolha um perfil para conhecer as funcionalidades e restrições de cada papel:
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {PERFIS_DEMO.map((p) => (
                          <button
                            key={p.papel}
                            type="button"
                            disabled={carregando}
                            onClick={() => loginDemo(p.email)}
                            className={`text-left p-2.5 rounded-lg border-2 transition-all disabled:opacity-50 ${p.cor}`}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-base leading-none">{p.icone}</span>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${p.badge}`}>
                                {p.papel}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-slate-700 leading-tight">{p.label}</p>
                            <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{p.descricao}</p>
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-2.5 text-center">
                        Todos os perfis usam a senha <code className="font-mono">demo1234</code>
                      </p>
                    </div>
                  )}
                </div>
              </form>
            )}

            {/* ── FORM REGISTRO ─────────────────────────────────── */}
            {aba === "registrar" && (
              <form onSubmit={handleRegistrar} className="space-y-4">
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 mb-1">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                    Dados da Construtora
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Nome da construtora *</label>
                      <input required placeholder="Ex: Construtora Carioca Ltda"
                        value={reg.nome} onChange={e => setReg(r => ({ ...r, nome: e.target.value }))}
                        className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">CNPJ *</label>
                      <input required placeholder="00.000.000/0001-00"
                        value={reg.cnpj} onChange={e => setReg(r => ({ ...r, cnpj: e.target.value }))}
                        className={inputClass} />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                    Usuário Administrador
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Seu nome *</label>
                      <input required placeholder="Nome completo"
                        value={reg.nome_admin} onChange={e => setReg(r => ({ ...r, nome_admin: e.target.value }))}
                        className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Email *</label>
                      <input type="email" required placeholder="admin@construtora.com.br"
                        value={reg.email_admin} onChange={e => setReg(r => ({ ...r, email_admin: e.target.value }))}
                        className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Senha *</label>
                      <div className="relative">
                        <input
                          type={mostrarSenha ? "text" : "password"}
                          required minLength={8}
                          placeholder="Mínimo 8 caracteres"
                          value={reg.senha_admin}
                          onChange={e => setReg(r => ({ ...r, senha_admin: e.target.value }))}
                          className={`${inputClass} pr-10`}
                        />
                        <button type="button" onClick={() => setMostrarSenha(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={carregando}
                  className="w-full py-2.5 bg-brand-600 text-white rounded-lg text-sm font-semibold hover:bg-brand-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                >
                  {carregando && <Loader2 size={16} className="animate-spin" />}
                  {carregando ? "Criando conta…" : "Criar conta grátis"}
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          © {new Date().getFullYear()} Obras Platform — Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
