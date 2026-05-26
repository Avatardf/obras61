import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { orcamentosApi } from "@/api/client";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import type { CustoRealizadoCreate, Etapa, TipoCusto } from "@/types";

const TIPO_LABELS: Record<TipoCusto, string> = {
  material:       "Material",
  mao_de_obra:    "Mão de obra",
  equipamento:    "Equipamento",
  servico:        "Serviço / Subcontratado",
  administrativo: "Administrativo",
};

interface Props {
  aberto: boolean;
  onFechar: () => void;
  obraId: string;
  etapas: Etapa[];
}

const hoje = () => new Date().toISOString().split("T")[0];

export function CustoRealizadoForm({ aberto, onFechar, obraId, etapas }: Props) {
  const qc = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);

  const [form, setForm] = useState<CustoRealizadoCreate>({
    tipo: "material",
    descricao: "",
    data_lancamento: hoje(),
    valor: 0,
    nota_fiscal: "",
    etapa_id: null,
  });

  const mutation = useMutation({
    mutationFn: () => orcamentosApi.registrarCusto(obraId, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custos", obraId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onFechar();
      resetForm();
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail;
      if (detail) setErro(String(detail));
      else if (err?.response?.status) setErro(`Erro ${err.response.status}`);
      else setErro("Não foi possível conectar ao servidor.");
    },
  });

  function resetForm() {
    setForm({
      tipo: "material",
      descricao: "",
      data_lancamento: hoje(),
      valor: 0,
      nota_fiscal: "",
      etapa_id: null,
    });
    setErro(null);
  }

  function set<K extends keyof CustoRealizadoCreate>(field: K, value: CustoRealizadoCreate[K]) {
    setForm(f => ({ ...f, [field]: value }));
    setErro(null);
  }

  const podeSubmeter = form.descricao.trim().length >= 2 && form.valor > 0;

  return (
    <Modal
      aberto={aberto}
      onFechar={() => { onFechar(); resetForm(); }}
      titulo="Registrar custo realizado"
    >
      <div className="space-y-4">

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Tipo de custo"
            value={form.tipo}
            onChange={e => set("tipo", e.target.value as TipoCusto)}
          >
            {(Object.entries(TIPO_LABELS) as [TipoCusto, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>

          <Input
            label="Data do lançamento"
            type="date"
            value={form.data_lancamento}
            onChange={e => set("data_lancamento", e.target.value)}
          />
        </div>

        <Input
          label="Descrição"
          value={form.descricao}
          onChange={e => set("descricao", e.target.value)}
          placeholder="Ex.: Compra de aço CA-50, Nota 001234"
        />

        <div className="grid grid-cols-2 gap-4">
          <CurrencyInput
            label="Valor"
            value={form.valor}
            onChange={v => set("valor", v ?? 0)}
            required
          />
          <Input
            label="Nota Fiscal (opcional)"
            value={form.nota_fiscal ?? ""}
            onChange={e => set("nota_fiscal", e.target.value || null)}
            placeholder="NF-e 001234"
          />
        </div>

        {etapas.length > 0 && (
          <Select
            label="Etapa (opcional)"
            value={form.etapa_id ?? ""}
            onChange={e => set("etapa_id", e.target.value || null)}
          >
            <option value="">— Sem etapa específica —</option>
            {etapas.map(e => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </Select>
        )}

        {erro && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => { onFechar(); resetForm(); }}
            className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !podeSubmeter}
            className="flex-1 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            {mutation.isPending
              ? <><Loader2 size={14} className="animate-spin" /> Salvando…</>
              : "Registrar custo"
            }
          </button>
        </div>
      </div>
    </Modal>
  );
}
