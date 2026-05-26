import { clsx } from "clsx";
import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  erro?: string;
  dica?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, erro, dica, className, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">
        {label}
        {props.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        ref={ref}
        className={clsx(
          "px-3 py-2 rounded-lg border text-sm transition-colors outline-none",
          "placeholder:text-slate-400",
          erro
            ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
            : "border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100",
          className,
        )}
        {...props}
      />
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      {dica && !erro && <p className="text-xs text-slate-400">{dica}</p>}
    </div>
  )
);
Input.displayName = "Input";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  erro?: string;
  /** Array de opções — alternativa a passar <option> como children */
  options?: { value: string; label: string }[];
  children?: React.ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, erro, options, children, className, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">
        {label}
        {props.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <select
        ref={ref}
        className={clsx(
          "px-3 py-2 rounded-lg border text-sm bg-white transition-colors outline-none",
          erro
            ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
            : "border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100",
          className,
        )}
        {...props}
      >
        {options
          ? options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)
          : children}
      </select>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  )
);
Select.displayName = "Select";
