import { TrendingDown, TrendingUp } from "lucide-react";
import { clsx } from "clsx";
import type { MetricasEVM } from "@/types";

function Indice({ label, valor, invertido = false }: { label: string; valor: number; invertido?: boolean }) {
  const ok = invertido ? valor <= 1 : valor >= 1;
  return (
    <div className={clsx(
      "flex flex-col items-center justify-center p-4 rounded-xl border",
      ok ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
    )}>
      <div className={clsx("flex items-center gap-1 text-xs font-medium mb-1",
        ok ? "text-emerald-600" : "text-red-600")}>
        {ok ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        {label}
      </div>
      <span className={clsx("text-2xl font-bold", ok ? "text-emerald-700" : "text-red-700")}>
        {valor.toFixed(2)}
      </span>
      <span className="text-xs mt-1 text-slate-500">
        {ok ? (label === "CPI" ? "No orçamento" : "No prazo") : (label === "CPI" ? "Acima do orçamento" : "Atrasada")}
      </span>
    </div>
  );
}

function Moeda({ valor }: { valor: number }) {
  if (valor >= 1_000_000) return <>R$ {(valor / 1_000_000).toFixed(2)}M</>;
  if (valor >= 1_000) return <>R$ {(valor / 1_000).toFixed(0)}K</>;
  return <>R$ {valor.toFixed(0)}</>;
}

interface Props { evm: MetricasEVM; }

export function EVMPanel({ evm }: Props) {
  const percentualEV = evm.bac > 0 ? (evm.ev / evm.bac) * 100 : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Desempenho EVM</h3>
        <span className="text-xs text-slate-400">Earned Value Management</span>
      </div>

      {/* Índices CPI e SPI */}
      <div className="grid grid-cols-2 gap-3">
        <Indice label="CPI" valor={evm.cpi} />
        <Indice label="SPI" valor={evm.spi} />
      </div>

      {/* Barra de progresso de valor ganho */}
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
          <span>Valor ganho (EV)</span>
          <span>{percentualEV.toFixed(1)}% do BAC</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all"
            style={{ width: `${Math.min(percentualEV, 100)}%` }}
          />
        </div>
      </div>

      {/* Valores monetários */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        {[
          { label: "Orçamento Total (BAC)",    valor: evm.bac, cor: "text-slate-700" },
          { label: "Custo Real (AC)",           valor: evm.ac,  cor: "text-slate-700" },
          { label: "Estimativa Conclusão (EAC)",valor: evm.eac, cor: evm.vac < 0 ? "text-red-600" : "text-emerald-600" },
          { label: "Variação Conclusão (VAC)",  valor: evm.vac, cor: evm.vac < 0 ? "text-red-600" : "text-emerald-600" },
        ].map(({ label, valor, cor }) => (
          <div key={label} className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1">{label}</p>
            <p className={clsx("text-sm font-semibold", cor)}>
              <Moeda valor={valor} />
            </p>
          </div>
        ))}
      </div>

      {/* Interpretação */}
      {evm.interpretacao && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-700">{evm.interpretacao}</p>
        </div>
      )}
    </div>
  );
}
