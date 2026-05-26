import { clsx } from "clsx";

const variants = {
  estudo:       "bg-slate-100 text-slate-600",
  viabilidade:  "bg-violet-50 text-violet-700",
  aprovacao:    "bg-amber-50 text-amber-700",
  em_obras:     "bg-blue-50 text-blue-700",
  entregue:     "bg-emerald-50 text-emerald-700",
  cancelado:    "bg-red-50 text-red-600",
  planejamento: "bg-slate-100 text-slate-600",
  em_execucao:  "bg-blue-50 text-blue-700",
  paralisada:   "bg-amber-50 text-amber-700",
  concluida:    "bg-emerald-50 text-emerald-700",
} as const;

const labels: Record<string, string> = {
  estudo:                  "Estudo",
  viabilidade:             "Viabilidade",
  aprovacao:               "Aprovação",
  em_obras:                "Em obras",
  entregue:                "Entregue",
  cancelado:               "Cancelado",
  planejamento:            "Planejamento",
  em_execucao:             "Em execução",
  paralisada:              "Paralisada",
  concluida:               "Concluída",
  residencial_vertical:    "Residencial Vertical",
  residencial_horizontal:  "Residencial Horizontal",
  comercial:               "Comercial",
  misto:                   "Misto",
  infraestrutura:          "Infraestrutura",
};

export function Badge({ value, className }: { value: string; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-block text-xs font-medium px-2.5 py-0.5 rounded-full",
        variants[value as keyof typeof variants] ?? "bg-slate-100 text-slate-500",
        className,
      )}
    >
      {labels[value] ?? value}
    </span>
  );
}
