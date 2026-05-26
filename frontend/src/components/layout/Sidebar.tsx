import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Building2, ClipboardList, ShoppingCart,
  Users, CheckSquare, FileText, Camera, BarChart3, Settings,
  Banknote, GitMerge, CalendarRange, LogOut, HardHat, Zap,
} from "lucide-react";
import { clsx } from "clsx";
import { useAuthStore } from "@/stores/authStore";

// ── Grupos de navegação ────────────────────────────────────────────────────────

const navGroups = [
  {
    label: "Gestão",
    items: [
      { to: "/",                icon: LayoutDashboard, label: "Dashboard" },
      { to: "/empreendimentos", icon: Building2,       label: "Empreendimentos" },
      { to: "/pipeline",        icon: GitMerge,        label: "Pipeline" },
      { to: "/cronograma",      icon: CalendarRange,   label: "Cronograma Gantt" },
    ],
  },
  {
    label: "Produção",
    items: [
      { to: "/orcamentos",  icon: ClipboardList, label: "Orçamentos" },
      { to: "/suprimentos", icon: ShoppingCart,  label: "Suprimentos" },
      { to: "/qualidade",   icon: CheckSquare,   label: "Qualidade / RDO" },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { to: "/financeiro", icon: Banknote, label: "Financeiro" },
    ],
  },
  {
    label: "Planejamento",
    items: [
      { to: "/equipes",    icon: Users,     label: "Equipes" },
      { to: "/documentos", icon: FileText,  label: "Documentos" },
      { to: "/vision",     icon: Camera,    label: "Vision 360°" },
      { to: "/analises",   icon: BarChart3, label: "Análises IA" },
    ],
  },
];

// ── NavItem ────────────────────────────────────────────────────────────────────

function NavItem({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        clsx(
          "group relative flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150",
          isActive
            ? "bg-white/10 text-white shadow-sm"
            : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Indicador lateral activo */}
          {isActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-gradient-to-b from-brand-400 to-violet-400" />
          )}
          <Icon
            size={16}
            className={clsx(
              "shrink-0 transition-colors",
              isActive ? "text-brand-400" : "text-slate-500 group-hover:text-slate-300"
            )}
          />
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const inicial = (user?.nome ?? "U")[0].toUpperCase();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <aside className="w-[220px] min-h-screen flex flex-col shrink-0"
      style={{
        background: "linear-gradient(160deg, #0f172a 0%, #0f172a 60%, #0d1f3c 100%)",
        borderRight: "1px solid rgba(255,255,255,.06)",
      }}
    >
      {/* ── Logo ────────────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center shadow-glow-brand">
            <HardHat size={14} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white tracking-tight leading-none">Obras Platform</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Gestão de Obras v2.0</p>
          </div>
        </div>
      </div>

      {/* ── Perfil ──────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 mx-3 my-3 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2.5">
        <div className="relative shrink-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shadow-glow-brand">
            {inicial}
          </div>
          <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-400 rounded-full ring-2 ring-slate-900" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white truncate leading-tight">{user?.nome ?? "Usuário"}</p>
          <p className="text-[10px] text-slate-500 truncate mt-0.5 capitalize">{user?.papel ?? "operador"}</p>
        </div>
      </div>

      {/* ── Navegação ───────────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 pb-2 space-y-4 overflow-y-auto sidebar-scroll">
        {navGroups.map(group => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[9px] font-bold tracking-[0.12em] text-slate-600 uppercase">
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
        <NavLink
          to="/configuracoes"
          className={({ isActive }) =>
            clsx(
              "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all",
              isActive
                ? "bg-white/10 text-white"
                : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
            )
          }
        >
          <Settings size={15} />
          <span>Configurações</span>
        </NavLink>

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
        <p className="text-[9px] text-slate-600">Obras Platform · {new Date().getFullYear()}</p>
      </div>
    </aside>
  );
}
