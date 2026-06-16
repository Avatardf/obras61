import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, Plus, Sparkles, ClipboardList, FileText, Pencil, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { empreendimentosApi, obrasApi } from "@/api/client";
import { ObraForm } from "@/components/obras/ObraForm";
import { EmpreendimentoForm } from "@/components/empreendimentos/EmpreendimentoForm";
import { EstimativaCustos } from "@/components/empreendimentos/EstimativaCustos";
import { DocumentosTab } from "@/components/empreendimentos/DocumentosTab";
import { Badge } from "@/components/ui/Badge";
import type { ObraResponse, EmpreendimentoResponse } from "@/types";
import { clsx } from "clsx";

function ObraCard({ obra, onClick, onEdit, onDelete }: {
  obra: ObraResponse; onClick: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
  return (
    <div
      onClick={onClick}
      className="w-full bg-white rounded-xl border border-slate-200 p-5 text-left hover:shadow-md hover:border-brand-300 transition-all group cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="font-semibold text-slate-800 group-hover:text-brand-700 transition-colors">
            {obra.nome}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge value={obra.status} />
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={stop(onEdit)} title="Editar obra"
            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors">
            <Pencil size={14} />
          </button>
          <button onClick={stop(onDelete)} title="Excluir obra"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Progresso físico */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Progresso físico</span>
          <span className="font-medium">{obra.progresso_fisico.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={clsx("h-full rounded-full transition-all",
              obra.progresso_fisico >= 100 ? "bg-emerald-500" : "bg-brand-500"
            )}
            style={{ width: `${obra.progresso_fisico}%` }}
          />
        </div>
      </div>

      {/* Dados rápidos */}
      <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100">
        {[
          { label: "Área", valor: obra.area_construida_m2 ? `${obra.area_construida_m2.toLocaleString()} m²` : "—" },
          { label: "Pavimentos", valor: obra.numero_pavimentos ?? "—" },
          { label: "Unidades", valor: obra.numero_unidades ?? "—" },
        ].map(({ label, valor }) => (
          <div key={label}>
            <p className="text-xs text-slate-400">{label}</p>
            <p className="text-sm font-medium text-slate-700">{valor}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmpreendimentoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [formAberto, setFormAberto] = useState(false);
  const [obraEditando, setObraEditando] = useState<ObraResponse | null>(null);
  const [obraExcluindo, setObraExcluindo] = useState<ObraResponse | null>(null);
  const [editarEmpAberto, setEditarEmpAberto] = useState(false);
  const [aba, setAba] = useState<"obras" | "estimativas" | "documentos">("obras");

  const excluirObra = useMutation({
    mutationFn: (obraId: string) => obrasApi.excluir(obraId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obras", id] });
      qc.invalidateQueries({ queryKey: ["empreendimentos"] });
      setObraExcluindo(null);
    },
  });

  const { data: emp } = useQuery<EmpreendimentoResponse>({
    queryKey: ["empreendimento", id],
    queryFn: () => empreendimentosApi.buscar(id!),
    enabled: !!id,
  });

  const { data: obras = [], isLoading } = useQuery<ObraResponse[]>({
    queryKey: ["obras", id],
    queryFn: () => obrasApi.listar(id!),
    enabled: !!id,
  });

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/empreendimentos")}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-800">{emp?.nome ?? "Empreendimento"}</h2>
          <div className="flex items-center gap-2 mt-1">
            {emp && <Badge value={emp.status} />}
            {emp?.endereco && (
              <span className="text-xs text-slate-400">
                {(emp.endereco as any).cidade}, {(emp.endereco as any).uf}
              </span>
            )}
          </div>
        </div>
        {aba === "obras" && (
          <button
            onClick={() => setFormAberto(true)}

            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            <Plus size={16} />
            Nova obra
          </button>
        )}
      </div>

      {/* Abas */}
      <div className="flex gap-1 border-b border-slate-200">
        {([
          { key: "obras",       label: "Obras",                   icon: ClipboardList },
          { key: "documentos",  label: "Documentos",              icon: FileText      },
          { key: "estimativas", label: "Estimativa de Custos IA", icon: Sparkles      },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setAba(key)}
            className={clsx(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              aba === key
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Aba Obras */}
      {aba === "obras" && <>
        {/* Contador */}
        <p className="text-sm text-slate-500">
          {obras.length === 0 ? "Nenhuma obra cadastrada" :
           `${obras.length} obra${obras.length > 1 ? "s" : ""}`}
        </p>
      </>}

      {/* Conteúdo aba Obras */}
      {aba === "obras" && <>
        {/* Loading skeletons */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2].map(i => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 h-52 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-3/4 mb-3" />
                <div className="h-3 bg-slate-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        )}

        {/* Grid de obras */}
        {!isLoading && obras.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {obras.map(obra => (
              <ObraCard
                key={obra.id}
                obra={obra}
                onClick={() => navigate(`/obras/${obra.id}`)}
                onEdit={() => setObraEditando(obra)}
                onDelete={() => setObraExcluindo(obra)}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && obras.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Building2 size={40} className="mb-3 opacity-30" />
            <p className="font-medium">Nenhuma obra cadastrada</p>
            <p className="text-sm mt-1">Clique em "Nova obra" para adicionar</p>
          </div>
        )}
      </>}

      {/* Conteúdo aba Documentos */}
      {aba === "documentos" && id && (
        <DocumentosTab empreendimentoId={id} />
      )}

      {/* Conteúdo aba Estimativas */}
      {aba === "estimativas" && emp && (
        <EstimativaCustos
          empreendimento={emp}
          onEditar={() => setEditarEmpAberto(true)}
        />
      )}

      <ObraForm
        aberto={formAberto}
        onFechar={() => setFormAberto(false)}
        empreendimentoId={id!}
      />

      {/* Edição de obra */}
      <ObraForm
        aberto={!!obraEditando}
        onFechar={() => setObraEditando(null)}
        empreendimentoId={id!}
        obra={obraEditando}
      />

      {/* Confirmação de exclusão de obra */}
      {obraExcluindo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-red-400" />
            </div>
            <h2 className="text-base font-semibold text-slate-800 mb-1">Excluir obra?</h2>
            <p className="text-sm text-slate-500 mb-5">
              <span className="font-medium text-slate-700">{obraExcluindo.nome}</span> e todas as suas
              etapas, orçamentos e lançamentos serão removidos permanentemente.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setObraExcluindo(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={() => excluirObra.mutate(obraExcluindo.id)} disabled={excluirObra.isPending}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2">
                {excluirObra.isPending && <Loader2 size={14} className="animate-spin" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edição do empreendimento — abre quando o usuário clica em "Editar agora"
          no banner de dados insuficientes da Estimativa IA */}
      <EmpreendimentoForm
        aberto={editarEmpAberto}
        onFechar={() => setEditarEmpAberto(false)}
        editando={emp ?? null}
      />
    </div>
  );
}
