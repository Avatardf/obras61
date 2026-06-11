import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { podAcessar } from "@/lib/permissoes";
import { ShieldOff } from "lucide-react";

interface Props {
  children: React.ReactNode;
  papeis?: string[];  // opcional — restringe por lista explícita de papéis
}

export function ProtectedRoute({ children, papeis }: Props) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  // 1. Não autenticado → redireciona para login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Verificação por lista explícita de papéis (uso interno)
  if (papeis && user && !papeis.includes(user.papel)) {
    return <AcessoNegado papel={user.papel} />;
  }

  // 3. Verificação pela matriz de permissões global
  if (user && !podAcessar(user.papel, location.pathname)) {
    return <AcessoNegado papel={user.papel} />;
  }

  return <>{children}</>;
}

function AcessoNegado({ papel }: { papel: string }) {
  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <ShieldOff size={24} className="text-red-400" />
        </div>
        <p className="text-base font-semibold text-slate-700">Acesso restrito</p>
        <p className="text-sm text-slate-400 mt-1 max-w-xs">
          O perfil <span className="font-medium text-slate-600 capitalize">{papel}</span> não tem
          permissão para acessar esta área.
        </p>
      </div>
    </div>
  );
}
