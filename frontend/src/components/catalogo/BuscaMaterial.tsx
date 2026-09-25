import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { clsx } from "clsx";
import { catalogoApi } from "@/api/client";
import type { Material } from "@/types";

interface Props {
  valor: string;
  onChange: (texto: string) => void;
  /** Chamado quando o usuário escolhe um material da lista */
  onEscolher: (m: Material) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

/**
 * Campo de descrição com sugestões do catálogo de materiais da construtora.
 * O usuário pode digitar livremente ou escolher um item da lista.
 */
export function BuscaMaterial({ valor, onChange, onEscolher, placeholder, className, inputClassName }: Props) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [destaque, setDestaque] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setTermo(valor.trim()), 250);
    return () => clearTimeout(t);
  }, [valor]);

  const { data, isFetching } = useQuery({
    queryKey: ["catalogo-busca", termo],
    queryFn: () => catalogoApi.listarMateriais({ q: termo, limit: 8 }),
    enabled: aberto && termo.length >= 2,
    staleTime: 30_000,
  });
  const sugestoes = data?.items ?? [];
  const mostrar = aberto && termo.length >= 2 && (sugestoes.length > 0 || isFetching);

  function escolher(m: Material) {
    onEscolher(m);
    setAberto(false);
  }

  function teclas(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!mostrar || sugestoes.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setDestaque(i => Math.min(i + 1, sugestoes.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setDestaque(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); escolher(sugestoes[destaque]); }
    else if (e.key === "Escape") setAberto(false);
  }

  return (
    <div className={clsx("relative", className)}>
      <input
        value={valor}
        onChange={e => { onChange(e.target.value); setAberto(true); setDestaque(0); }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        onKeyDown={teclas}
        placeholder={placeholder}
        autoComplete="off"
        className={clsx("w-full", inputClassName)}
      />
      {mostrar && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {isFetching && sugestoes.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400"><Loader2 size={12} className="animate-spin" /> Buscando no catálogo…</div>
          ) : sugestoes.map((m, i) => (
            <button key={m.id} type="button"
              onMouseDown={e => { e.preventDefault(); escolher(m); }}
              onMouseEnter={() => setDestaque(i)}
              className={clsx("w-full flex items-center justify-between gap-3 px-3 py-2 text-left",
                i === destaque ? "bg-brand-50" : "hover:bg-slate-50")}>
              <span className="min-w-0">
                <span className="block text-xs text-slate-800 truncate">{m.descricao}</span>
                {m.familia && <span className="block text-[10px] text-slate-400">{m.familia}{m.codigo ? ` · ${m.codigo}` : ""}</span>}
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-[11px] text-slate-500">{m.unidade}</span>
                {m.preco_referencia != null && (
                  <span className="block text-[11px] font-semibold text-emerald-700 tabular-nums">
                    {Number(m.preco_referencia).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
