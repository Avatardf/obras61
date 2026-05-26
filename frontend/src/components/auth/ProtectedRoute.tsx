import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

interface Props {
  children: React.ReactNode;
  papeis?: string[];  // se informado, restringe por papel
}

export function ProtectedRoute({ children, papeis }: Props) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (papeis && user && !papeis.includes(user.papel)) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center text-slate-400">
          <p className="text-lg font-medium">Acesso restrito</p>
          <p className="text-sm mt-1">
            Seu perfil ({user.papel}) não tem permissão para acessar esta área.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
