import { Bell, ChevronDown, LogOut, Building2, Menu } from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useNavigate } from "react-router-dom";

const diasSemana = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];
const meses = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];

function dataAtual(): string {
  const d = new Date();
  return `${diasSemana[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

interface HeaderProps {
  titulo: string;
  onMenuToggle: () => void;
}

export function Header({ titulo, onMenuToggle }: HeaderProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [menuAberto, setMenuAberto] = useState(false);
  const inicial = (user?.nome ?? "U")[0].toUpperCase();

  function handleLogout() {
    setMenuAberto(false);
    logout();
    navigate("/login");
  }

  return (
    <header
      className="h-14 flex items-center justify-between px-3 sm:px-6 shrink-0 gap-3"
      style={{
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(226,232,240,0.8)",
        boxShadow: "0 1px 3px 0 rgba(0,0,0,0.04)",
      }}
    >
      {/* Hamburguer — só aparece no mobile */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 -ml-1 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors active:scale-95 shrink-0"
        aria-label="Abrir menu"
      >
        <Menu size={20} />
      </button>

      {/* Título */}
      <h1 className="text-sm font-bold text-slate-800 tracking-tight truncate flex-1">{titulo}</h1>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">

        {/* Data — só desktop */}
        <span className="hidden xl:block text-xs text-slate-400 font-medium tabular-nums">
          {dataAtual()}
        </span>

        {/* Divider — só desktop */}
        <div className="hidden xl:block w-px h-5 bg-slate-200" />

        {/* Notificações */}
        <button className="relative p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all active:scale-95">
          <Bell size={17} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full ring-1 ring-white animate-pulse-slow" />
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-slate-200" />

        {/* Perfil */}
        <div className="relative">
          <button
            onClick={() => setMenuAberto(v => !v)}
            className="flex items-center gap-2 rounded-xl px-1.5 sm:px-2 py-1.5 hover:bg-slate-100 transition-all active:scale-95"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {inicial}
            </div>
            {/* Nome + cargo — só em telas maiores */}
            <div className="text-left hidden sm:block">
              <p className="text-xs font-semibold text-slate-700 leading-none">{user?.nome ?? "Usuário"}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                <Building2 size={9} />
                {user?.tenantNome ?? "Construtora"}
              </p>
            </div>
            <ChevronDown size={12} className="text-slate-400 hidden sm:block" />
          </button>

          {menuAberto && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuAberto(false)} />
              <div className="absolute right-0 top-12 z-20 rounded-2xl overflow-hidden w-56 shadow-xl animate-slide-in"
                style={{
                  background: "rgba(255,255,255,0.95)",
                  backdropFilter: "blur(16px)",
                  border: "1px solid rgba(226,232,240,0.8)",
                }}
              >
                <div className="px-4 py-3.5 bg-gradient-to-br from-brand-50 to-violet-50 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center text-white text-sm font-bold shadow-glow-brand">
                      {inicial}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{user?.nome}</p>
                      <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                    </div>
                  </div>
                  <span className="mt-2.5 inline-block text-xs font-semibold px-2.5 py-0.5 bg-brand-100 text-brand-700 rounded-full capitalize">
                    {user?.papel}
                  </span>
                </div>
                <div className="p-1">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    <LogOut size={14} />
                    Sair da conta
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
