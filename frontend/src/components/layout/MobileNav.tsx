/**
 * MobileNav — navegação inferior para celular (lg:hidden).
 *
 * Padrão mobile-first: bottom bar fixa com os 4 destinos mais usados
 * + botão "Mais" que abre um bottom sheet com todos os módulos
 * (mesma fonte de dados do Sidebar, filtrada por papel).
 */
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Building2, CheckSquare, ShoppingCart,
  MoreHorizontal, X, LogOut, UserCog, Settings, Download,
} from "lucide-react";
import { clsx } from "clsx";
import { useAuthStore } from "@/stores/authStore";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { podAcessar, type Papel } from "@/lib/permissoes";
import { navGroups } from "@/components/layout/Sidebar";

// Destinos fixos da barra (os mais usados no canteiro)
const ATALHOS = [
  { to: "/",                icon: LayoutDashboard, label: "Início" },
  { to: "/empreendimentos", icon: Building2,       label: "Empreend." },
  { to: "/qualidade",       icon: CheckSquare,     label: "RDO" },
  { to: "/suprimentos",     icon: ShoppingCart,    label: "Suprimentos" },
];

export function MobileNav() {
  const { user, logout } = useAuthStore();
  const { disponivel: pwaDisponivel, instalar: instalarPwa } = usePwaInstall();
  const navigate = useNavigate();
  const [sheetAberto, setSheetAberto] = useState(false);
  const papel = user?.papel as Papel | undefined;
  const isAdmin = papel === "admin";

  const atalhos = ATALHOS.filter(a => podAcessar(papel, a.to));

  const gruposFiltrados = navGroups
    .map(g => ({ ...g, items: g.items.filter(i => podAcessar(papel, i.to)) }))
    .filter(g => g.items.length > 0);

  function handleLogout() {
    setSheetAberto(false);
    logout();
    navigate("/login");
  }

  return (
    <>
      {/* ── Bottom sheet "Mais" ─────────────────────────────────────── */}
      {sheetAberto && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSheetAberto(false)}
          />
          <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-3xl shadow-2xl max-h-[80vh] overflow-y-auto animate-slide-in pb-[env(safe-area-inset-bottom)]">
            {/* Alça + fechar */}
            <div className="sticky top-0 bg-white pt-3 pb-2 px-5 flex items-center justify-between rounded-t-3xl">
              <div className="absolute left-1/2 -translate-x-1/2 top-2 w-10 h-1 rounded-full bg-slate-200" />
              <p className="text-sm font-semibold text-slate-800 mt-2">Todos os módulos</p>
              <button
                onClick={() => setSheetAberto(false)}
                className="p-1.5 mt-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 pb-6 space-y-5">
              {gruposFiltrados.map(grupo => (
                <div key={grupo.label}>
                  <p className="text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase mb-2">
                    {grupo.label}
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {grupo.items.map(item => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === "/"}
                        onClick={() => setSheetAberto(false)}
                        className={({ isActive }) =>
                          clsx(
                            "flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl text-center transition-colors",
                            isActive ? "bg-brand-50" : "hover:bg-slate-50 active:bg-slate-100"
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <span className={clsx(
                              "flex items-center justify-center w-10 h-10 rounded-xl",
                              item.bg.replace("/15", "/20"),
                            )}>
                              <item.icon size={18} className={item.color.replace("-400", "-600")} />
                            </span>
                            <span className={clsx(
                              "text-[10px] font-medium leading-tight",
                              isActive ? "text-brand-700" : "text-slate-600"
                            )}>
                              {item.label}
                            </span>
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}

              {/* Admin + sair */}
              <div className="pt-3 border-t border-slate-100 space-y-1">
                {pwaDisponivel && (
                  <button
                    onClick={() => { setSheetAberto(false); instalarPwa(); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                  >
                    <Download size={16} className="text-emerald-600" />
                    Instalar aplicativo
                  </button>
                )}
                {isAdmin && (
                  <NavLink
                    to="/usuarios"
                    onClick={() => setSheetAberto(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <UserCog size={16} className="text-violet-500" />
                    Gerenciar Usuários
                  </NavLink>
                )}
                {isAdmin && (
                  <NavLink
                    to="/configuracoes"
                    onClick={() => setSheetAberto(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <Settings size={16} className="text-slate-400" />
                    Configurações
                  </NavLink>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <LogOut size={16} />
                  Sair da conta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Barra inferior fixa ─────────────────────────────────────── */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
        style={{ borderTop: "1px solid rgba(226,232,240,0.9)", boxShadow: "0 -2px 12px rgba(0,0,0,0.06)" }}
      >
        <div className="flex items-stretch justify-around">
          {atalhos.map(a => (
            <NavLink
              key={a.to}
              to={a.to}
              end={a.to === "/"}
              className="flex-1 flex flex-col items-center gap-0.5 pt-2 pb-1.5 min-w-0 active:bg-slate-50 transition-colors"
            >
              {({ isActive }) => (
                <>
                  <span className={clsx(
                    "flex items-center justify-center w-11 h-6 rounded-full transition-colors",
                    isActive && "bg-brand-100"
                  )}>
                    <a.icon size={19} className={isActive ? "text-brand-700" : "text-slate-400"} strokeWidth={isActive ? 2.2 : 1.8} />
                  </span>
                  <span className={clsx(
                    "text-[10px] font-medium leading-none truncate max-w-full px-1",
                    isActive ? "text-brand-700" : "text-slate-500"
                  )}>
                    {a.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}

          {/* Mais */}
          <button
            onClick={() => setSheetAberto(true)}
            className="flex-1 flex flex-col items-center gap-0.5 pt-2 pb-1.5 min-w-0 active:bg-slate-50 transition-colors"
          >
            <span className={clsx(
              "flex items-center justify-center w-11 h-6 rounded-full transition-colors",
              sheetAberto && "bg-brand-100"
            )}>
              <MoreHorizontal size={19} className={sheetAberto ? "text-brand-700" : "text-slate-400"} strokeWidth={1.8} />
            </span>
            <span className={clsx(
              "text-[10px] font-medium leading-none",
              sheetAberto ? "text-brand-700" : "text-slate-500"
            )}>
              Mais
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
