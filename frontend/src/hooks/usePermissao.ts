import { useAuthStore } from "@/stores/authStore";
import { podAcessar, podeEscrever } from "@/lib/permissoes";
import { useLocation } from "react-router-dom";

/**
 * Retorna helpers de permissão para o usuário autenticado.
 *
 * Uso:
 *   const { podeEditar, temAcesso } = usePermissao();
 *   if (!podeEditar) return null; // esconde botão de excluir
 */
export function usePermissao() {
  const papel = useAuthStore(s => s.user?.papel);
  const { pathname } = useLocation();

  return {
    papel,
    /** Pode criar, editar e excluir (false para viewer) */
    podeEditar: podeEscrever(papel),
    /** Tem acesso à rota atual */
    temAcessoAtual: podAcessar(papel, pathname),
    /** Verifica acesso a uma rota específica */
    temAcesso: (rota: string) => podAcessar(papel, rota),
    /** true se papel === "admin" */
    isAdmin: papel === "admin",
    /** true se papel === "viewer" */
    isViewer: papel === "viewer",
  };
}
