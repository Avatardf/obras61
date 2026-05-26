import { X } from "lucide-react";
import { useEffect } from "react";

interface ModalProps {
  titulo: string;
  aberto: boolean;
  onFechar: () => void;
  children: React.ReactNode;
  largura?: "md" | "lg" | "xl" | "2xl";
}

const larguras = { md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-3xl", "2xl": "max-w-4xl" };

export function Modal({ titulo, aberto, onFechar, children, largura = "lg" }: ModalProps) {
  useEffect(() => {
    if (!aberto) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onFechar}
      />
      {/* Painel — flex column, altura máxima 94vh para caber em qualquer tela */}
      <div className={`relative w-full ${larguras[largura]} bg-white rounded-2xl shadow-2xl flex flex-col`} style={{ maxHeight: "94vh" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-slate-800">{titulo}</h2>
          <button
            onClick={onFechar}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        {/* Conteúdo não rola por padrão — cada modal controla seu scroll interno */}
        <div className="flex-1 min-h-0 px-6 py-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
