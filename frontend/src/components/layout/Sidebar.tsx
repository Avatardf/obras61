import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Building2, ClipboardList, ShoppingCart,
  Users, CheckSquare, FileText, Camera, BarChart3, Settings,
  Banknote, GitMerge, CalendarRange, LogOut, Zap, X, UserCog,
  ScanLine, Download,
} from "lucide-react";
import { clsx } from "clsx";
import { useAuthStore } from "@/stores/authStore";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { podAcessar, PAPEL_LABELS, PAPEL_CORES, type Papel } from "@/lib/permissoes";

const LOGO_AMARELO = "/logo/logo-amarelo.png";

// ── Grupos de navegação ────────────────────────────────────────────────────────

export const navGroups = [
  {
    label: "Gestão",
    items: [
      { to: "/",                icon: LayoutDashboard, label: "Dashboard",        color: "text-sky-400",     bg: "bg-sky-400/15"     },
      { to: "/empreendimentos", icon: Building2,       label: "Empreendimentos",  color: "text-amber-400",   bg: "bg-amber-400/15"   },
      { to: "/pipeline",        icon: GitMerge,        label: "Pipeline",         color: "text-violet-400",  bg: "bg-violet-400/15"  },
      { to: "/cronograma",      icon: CalendarRange,   label: "Cronograma Gantt", color: "text-teal-400",    bg: "bg-teal-400/15"    },
    ],
  },
  {
    label: "Produção",
    items: [
      { to: "/orcamentos",  icon: ClipboardList, label: "Orçamentos",      color: "text-emerald-400", bg: "bg-emerald-400/15" },
      { to: "/suprimentos", icon: ShoppingCart,  label: "Suprimentos",     color: "text-blue-400",    bg: "bg-blue-400/15"    },
      { to: "/qualidade",   icon: CheckSquare,   label: "Qualidade / RDO", color: "text-yellow-400",  bg: "bg-yellow-400/15"  },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { to: "/financeiro",   icon: Banknote,  label: "Financeiro",   color: "text-green-400", bg: "bg-green-400/15" },
      { to: "/conciliacao",  icon: ScanLine,  label: "Conciliação",  color: "text-cyan-400",  bg: "bg-cyan-400/15"  },
    ],
  },
  {
    label: "Planejamento",
    items: [
      { to: "/equipes",    icon: Users,     label: "Equipes",     color: "text-indigo-400", bg: "bg-indigo-400/15" },
      { to: "/documentos", icon: FileText,  label: "Documentos",  color: "text-slate-300",  bg: "bg-slate-300/10"  },
      { to: "/vision",     icon: Camera,    label: "Vision 360°", color: "text-rose-400",   bg: "bg-rose-400/15"   },
      { to: "/analises",   icon: BarChart3, label: "Análises IA", color: "text-purple-400", bg: "bg-purple-400/15" },
    ],
  },
];

// ── NavItem ────────────────────────────────────────────────────────────────────

function NavItem({
  to, icon: Icon, label, color, bg,
}: {
  to: string; icon: React.ElementType; label: string; color: string; bg: string;
}) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        clsx(
          "group relative flex items-center gap-2.5 px-2 py-2 rounded-xl text-sm font-medium transition-all duration-150",
          isActive
            ? "bg-white/8 text-white"
            : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className={clsx("absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full", color.replace("text-", "bg-"))} />
          )}
          <span className={clsx(
            "flex items-center justify-center w-7 h-7 rounded-lg shrink-0 transition-all duration-150",
            isActive ? bg : "group-hover:" + bg.split(" ")[0],
          )}>
            <Icon
              size={15}
              className={clsx(
                "transition-all duration-150",
                isActive ? color : clsx(color, "opacity-50 group-hover:opacity-90")
              )}
            />
          </span>
          <span className="truncate leading-none">{label}</span>
        </>
      )}
    </NavLink>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const { disponivel: pwaDisponivel, instalar: instalarPwa } = usePwaInstall();
  const navigate = useNavigate();
  const inicial = (user?.nome ?? "U")[0].toUpperCase();
  const papel = user?.papel as Papel | undefined;
  const papelLabel = papel ? (PAPEL_LABELS[papel] ?? papel) : "Operador";
  const papelCor = papel ? (PAPEL_CORES[papel] ?? "bg-slate-100 text-slate-600") : "bg-slate-100 text-slate-600";
  const isAdmin = papel === "admin";

  // Filtra grupos e itens conforme o papel do usuário
  const gruposFiltrados = navGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => podAcessar(papel, item.to)),
    }))
    .filter(group => group.items.length > 0);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <aside
      className={clsx(
        // Base
        "w-[260px] lg:w-[220px] flex flex-col z-50",
        // Mobile: fixed drawer com transição suave
        "fixed inset-y-0 left-0 transition-transform duration-300 ease-in-out",
        // Desktop: estático no fluxo
        "lg:static lg:inset-auto lg:min-h-screen lg:shrink-0",
        // Visibilidade
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}
      style={{
        background: "linear-gradient(160deg, #0f172a 0%, #0f172a 60%, #0d1f3c 100%)",
        borderRight: "1px solid rgba(255,255,255,.06)",
      }}
    >
      {/* ── Logo + botão fechar (mobile) ─────────────────────────────── */}
      <div className="px-5 pt-5 pb-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        <img
          src={LOGO_AMARELO}
          alt="61Brasil Construtora"
          className="h-8 w-auto object-contain"
          style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,.35))" }}
        />
        {/* Botão fechar — só aparece no mobile */}
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Fechar menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* ── Perfil ──────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 mx-3 my-3 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2.5">
        <div className="relative shrink-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shadow-glow-brand">
            {inicial}
          </div>
          <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-400 rounded-full ring-2 ring-slate-900" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white truncate leading-tight">{user?.nome ?? "Usuário"}</p>
          <span className={clsx("inline-block text-[9px] font-medium px-1.5 py-0.5 rounded-full mt-0.5", papelCor)}>
            {papelLabel}
          </span>
        </div>
      </div>

      {/* ── Navegação ───────────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 pb-2 space-y-4 overflow-y-auto sidebar-scroll">
        {gruposFiltrados.map(group => (
          <div key={group.label}>
            <p className="px-2 mb-1.5 text-[9px] font-bold tracking-[0.12em] text-slate-600 uppercase">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(item => (
                <NavItem key={item.to} {...item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Rodapé ──────────────────────────────────────────────────────── */}
      <div className="px-3 pb-4 pt-2 space-y-0.5" style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}>
        {/* Instalar app (PWA) — aparece quando o navegador permite (Android/Chrome) */}
        {pwaDisponivel && (
          <button
            onClick={instalarPwa}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all"
          >
            <Download size={15} className="text-emerald-400" />
            <span>Instalar aplicativo</span>
          </button>
        )}

        {/* Gerenciar Usuários — exclusivo para admin */}
        {isAdmin && (
          <NavLink
            to="/usuarios"
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                isActive ? "bg-violet-500/20 text-violet-300" : "text-slate-500 hover:text-violet-300 hover:bg-violet-500/10"
              )
            }
          >
            <UserCog size={15} className="text-violet-400" />
            <span>Gerenciar Usuários</span>
          </NavLink>
        )}

        {/* Configurações — exclusivo para admin */}
        {isAdmin && (
          <NavLink
            to="/configuracoes"
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                isActive ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
              )
            }
          >
            <Settings size={15} className="text-slate-500" />
            <span>Configurações</span>
          </NavLink>
        )}

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut size={15} />
          <span>Sair</span>
        </button>
      </div>

      {/* ── Versão ──────────────────────────────────────────────────────── */}
      <div className="px-5 py-2.5 flex items-center gap-1.5" style={{ borderTop: "1px solid rgba(255,255,255,.04)" }}>
        <Zap size={9} className="text-slate-600" />
        <p className="text-[9px] text-slate-600">61Brasil · Gestão de Obras · {new Date().getFullYear()}</p>
      </div>
    </aside>
  );
}
