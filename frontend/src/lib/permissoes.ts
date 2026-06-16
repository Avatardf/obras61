/**
 * Matriz de controle de acesso por papel.
 *
 * Papéis:
 *  admin       → acesso total + gerenciar usuários
 *  engenheiro  → obras, pipeline, cronograma, orçamentos, suprimentos, financeiro, equipes, qualidade
 *  mestre      → obras, cronograma, suprimentos, equipes, qualidade
 *  comprador   → suprimentos
 *  financeiro  → financeiro, orçamentos, suprimentos, obras
 *  viewer      → todos (somente leitura)
 */

export type Papel = "admin" | "engenheiro" | "mestre" | "comprador" | "financeiro" | "viewer";

/** Rota raiz → papéis que podem acessá-la */
export const PERMISSOES: Record<string, Papel[]> = {
  "/":               ["admin","engenheiro","mestre","comprador","financeiro","viewer"],
  "/empreendimentos":["admin","engenheiro","mestre","financeiro","viewer"],
  "/espelho":        ["admin","engenheiro","financeiro","viewer"],
  "/obras":          ["admin","engenheiro","mestre","comprador","financeiro","viewer"],
  "/pipeline":       ["admin","engenheiro","viewer"],
  "/cronograma":     ["admin","engenheiro","mestre","viewer"],
  "/orcamentos":     ["admin","engenheiro","financeiro","viewer"],
  "/rdos":           ["admin","engenheiro","mestre","viewer"],
  "/suprimentos":    ["admin","engenheiro","mestre","comprador","financeiro","viewer"],
  "/financeiro":     ["admin","engenheiro","financeiro","viewer"],
  "/conciliacao":    ["admin","financeiro","viewer"],
  "/equipes":        ["admin","engenheiro","mestre","viewer"],
  "/qualidade":      ["admin","engenheiro","mestre","viewer"],
  "/documentos":     ["admin","engenheiro","mestre","comprador","financeiro","viewer"],
  "/vision":         ["admin","engenheiro","viewer"],
  "/analises":       ["admin","engenheiro","viewer"],
  "/configuracoes":  ["admin"],
  "/usuarios":       ["admin"],
};

/** Retorna true se o papel tem acesso à rota */
export function podAcessar(papel: string | undefined, rota: string): boolean {
  if (!papel) return false;
  // Normaliza para a raiz (ex: /empreendimentos/123 → /empreendimentos)
  const raiz = "/" + rota.split("/").filter(Boolean)[0] || "/";
  const permitidos = PERMISSOES[raiz] ?? PERMISSOES[rota] ?? [];
  return permitidos.includes(papel as Papel);
}

/** Retorna true se o papel pode realizar ações de escrita (criar/editar/excluir) */
export function podeEscrever(papel: string | undefined): boolean {
  return papel !== "viewer" && papel !== undefined;
}

/** Rótulos amigáveis para cada papel */
export const PAPEL_LABELS: Record<Papel, string> = {
  admin:      "Administrador",
  engenheiro: "Engenheiro",
  mestre:     "Mestre de Obras",
  comprador:  "Comprador",
  financeiro: "Financeiro",
  viewer:     "Visualizador",
};

/** Cor de badge por papel */
export const PAPEL_CORES: Record<Papel, string> = {
  admin:      "bg-violet-100 text-violet-700",
  engenheiro: "bg-blue-100 text-blue-700",
  mestre:     "bg-amber-100 text-amber-700",
  comprador:  "bg-emerald-100 text-emerald-700",
  financeiro: "bg-green-100 text-green-700",
  viewer:     "bg-slate-100 text-slate-600",
};
