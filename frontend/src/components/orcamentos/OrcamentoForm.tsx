import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { orcamentosApi } from "@/api/client";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import type { OrcamentoCreate } from "@/types";

const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

interface Props {
  aberto: boolean;
  onFechar: () => void;
  obraId: string;
}

export function OrcamentoForm({ aberto, onFechar, obraId }: Props) {
  const qc = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);

  const [form, setForm] = useState<OrcamentoCreate>({
    descricao: "",
    bdi_percentual: 25,
    base_referencia: "sinapi",
    uf_referencia: "RJ",
    data_referencia: new Date().toISOString().split("T")[0],
  });

  const mutation = useMutation({
    mutationFn: () => orcamentosApi.criar(obraId, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orcamentos", obraId] });
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
      descricao: "",
      bdi_percentual: 25,
      base_referencia: "sinapi",
      uf_referencia: "RJ",
      data_referencia: new Date().toISOString().split("T")[0],
    });
    setErro(null);
  }

  function set(field: keyof OrcamentoCreate, value: string | number | null) {
    setForm(f => ({ ...f, [field]: value }));
    setErro(null);
  }

  return (
    <Modal
      aberto={aberto}
      onFechar={() => { onFechar(); resetForm(); }}
      titulo="Novo orçamento"
    >
      <div className="space-y-4">
        <Input
          label="Descrição (opcional)"
          value={form.descricao ?? ""}
          onChange={e => set("descricao", e.target.value)}
          placeholder="Ex.: Orçamento base SINAPI Jan/2025"
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Base de referência"
            value={form.base_referencia}
            onChange={e => set("base_referencia", e.target.value)}
          >
            <option value="sinapi">SINAPI</option>
            <option value="sicro">SICRO</option>
            <option value="cub">CUB</option>
            <option value="tcpo">TCPO</option>
            <option value="propria">Composição própria</option>
          </Select>

          <Select
            label="UF de referência"
            value={form.uf_referencia ?? ""}
            onChange={e => set("uf_referencia", e.target.value)}
          >
            {UFS.map(uf => (
              <option key={uf} value={uf}>{uf}</option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="BDI (%)"
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={form.bdi_percentual}
            onChange={e => set("bdi_percentual", parseFloat(e.target.value) || 0)}
            dica="Benefícios e Despesas Indiretas"
          />
          <Input
            label="Data de referência"
            type="date"
            value={form.data_referencia ?? ""}
            onChange={e => set("data_referencia", e.target.value)}
          />
        </div>

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
            disabled={mutation.isPending}
            className="flex-1 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            {mutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Criando…</> : "Criar orçamento"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
