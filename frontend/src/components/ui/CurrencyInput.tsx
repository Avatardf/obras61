import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Formata número para exibição pt-BR: 1600.5 + dec=2 → "1.600,50" */
function formatarBRL(valor: number, decimais = 2): string {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais,
  });
}

/**
 * Converte string de dígitos para valor numérico.
 * "160050" + dec=2 → 1600.50
 */
function digitsParaValor(digits: string, decimais: number): number {
  if (!digits) return 0;
  return parseInt(digits, 10) / Math.pow(10, decimais);
}

/**
 * Converte valor numérico para string de dígitos.
 * 1600.50 + dec=2 → "160050"
 */
function valorParaDigits(valor: number, decimais: number): string {
  if (!valor) return "";
  const inteiro = Math.round(Math.abs(valor) * Math.pow(10, decimais));
  return inteiro === 0 ? "" : inteiro.toString();
}

/** Interpreta texto colado (pt-BR ou en-US) e retorna string de dígitos. */
function parsearColado(texto: string, decimais: number): string {
  let s = texto.trim().replace(/[^\d.,]/g, "");
  if (!s) return "";
  const temVirgula = s.includes(",");
  const temPonto   = s.includes(".");
  if (temVirgula && temPonto) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (temVirgula) {
    s = s.replace(",", ".");
  }
  const num = parseFloat(s);
  if (isNaN(num) || num < 0) return "";
  return Math.round(num * Math.pow(10, decimais)).toString();
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface CurrencyInputProps {
  label?: string;
  value: number | null | undefined;
  onChange: (valor: number | null) => void;
  placeholder?: string;
  erro?: string;
  dica?: string;
  required?: boolean;
  /** Permite limpar o campo (retorna null). Padrão: false. */
  nullable?: boolean;
  /** Casas decimais. Padrão 2; use 3 ou 4 para quantidades/preços SINAPI. */
  decimais?: number;
  className?: string;
  disabled?: boolean;
  /** Omite o wrapper com label — para uso em forms inline. */
  bare?: boolean;
  /** Tamanho reduzido do texto. */
  small?: boolean;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function CurrencyInput({
  label,
  value,
  onChange,
  placeholder = "0,00",
  erro,
  dica,
  required,
  nullable = false,
  decimais = 2,
  className,
  disabled,
  bare = false,
  small = false,
}: CurrencyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Estado interno: apenas dígitos, sem separadores.
   * Máscara calculadora — ex: "160050" = R$ 1.600,50
   */
  const [digits, setDigits] = useState<string>(() =>
    valorParaDigits(value ?? 0, decimais)
  );

  const [focado, setFocado] = useState(false);

  // Sincroniza quando o valor externo muda (ex: reset do formulário)
  useEffect(() => {
    if (!focado) {
      const esperado = valorParaDigits(value ?? 0, decimais);
      if (esperado !== digits) setDigits(esperado);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimais, focado]);

  // Texto exibido: sempre formatado em pt-BR
  const textoExibido = digits
    ? formatarBRL(digitsParaValor(digits, decimais), decimais)
    : "";

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    setFocado(true);
    e.currentTarget.select();
  }

  function handleBlur() {
    setFocado(false);
  }

  function aplicarDigits(novos: string) {
    // Remove zeros à esquerda (ex: "007" → "7"), mas permite "" (campo vazio)
    const limpos = novos.replace(/^0+(?=\d)/, "");
    setDigits(limpos);
    if (!limpos) {
      onChange(nullable ? null : 0);
    } else {
      onChange(digitsParaValor(limpos, decimais));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Navegação e atalhos de teclado passam sem interferência
    const navKeys = [
      "Tab", "Escape", "Enter",
      "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
      "Home", "End",
    ];
    if (navKeys.includes(e.key) || e.ctrlKey || e.metaKey) return;

    // Bloqueia a modificação nativa — gerenciamos nós mesmos
    e.preventDefault();

    if (e.key === "Backspace" || e.key === "Delete") {
      aplicarDigits(digits.slice(0, -1));
      return;
    }

    if (/^\d$/.test(e.key)) {
      aplicarDigits(digits + e.key);
    }
    // Vírgula, ponto e outros caracteres são ignorados (desnecessários na máscara)
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const colado = e.clipboardData.getData("text");
    const novos = parsearColado(colado, decimais);
    if (novos) aplicarDigits(novos);
  }

  const inputEl = (
    <div
      className={clsx(
        "flex items-center rounded-lg border transition-colors",
        small ? "text-xs" : "text-sm",
        erro
          ? "border-red-400 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-100"
          : "border-slate-300 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100",
        disabled && "opacity-60 bg-slate-50",
        bare && className,
      )}
    >
      <span
        className={clsx(
          "text-slate-400 select-none shrink-0",
          small ? "pl-2 pr-1 text-xs" : "pl-3 pr-1.5 text-sm",
        )}
      >
        R$
      </span>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={textoExibido}
        onChange={() => {
          /* controlado via onKeyDown + onPaste */
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder}
        disabled={disabled}
        className={clsx(
          "flex-1 bg-transparent outline-none text-right tabular-nums placeholder:text-slate-300",
          small ? "py-1.5 pr-2" : "py-2 pr-3",
        )}
      />
    </div>
  );

  if (bare) return inputEl;

  return (
    <div className={clsx("flex flex-col gap-1", className)}>
      {label && (
        <label className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {inputEl}
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      {dica && !erro && <p className="text-xs text-slate-400">{dica}</p>}
    </div>
  );
}
