import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { obrasApi } from "@/api/client";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { ObraCreate } from "@/types";

const STATUS_OBRA = [
  { value: "planejamento", label: "Planejamento" },
  { value: "em_execucao",  label: "Em execução" },
  { value: "paralisada",   label: "Paralisada" },
  { value: "concluida",    label: "Concluída" },
];

interface Props {
  aberto: boolean;
  onFechar: () => void;
  empreendimentoId: string;
}

const vazio = (): ObraCreate => ({
  nome: "", status: "planejamento", usar_etapas_padrao: true,
  area_construida_m2: null, numero_pavimentos: null, numero_unidades: null,
});

export function ObraForm({ aberto, onFechar, empreendimentoId }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ObraCreate>(vazio());
  const [erro, setErro] = useState("");

  const mutation = useMutation({
    mutationFn: () => obrasApi.criar(empreendimentoId, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obras", empreendimentoId] });
      qc.invalidateQueries({ queryKey: ["empreendimentos"] });
      onFechar();
      setForm(vazio());
      setErro("");
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail;
      setErro(typeof detail === "string" ? detail : "Erro ao salvar. Verifique se a API está rodando.");
    },
  });

  function set(campo: keyof ObraCreate, valor: unknown) {
    setForm(f => ({ ...f, [campo]: valor }));
  }

  return (
    <Modal titulo="Nova Obra" aberto={aberto} onFechar={onFechar}>
      <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} className="p-6 space-y-5">

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
            {erro}
          </div>
        )}

        <Input
          label="Nome da obra" required
          placeholder="Ex: Torre A — 18 pavimentos"
          value={form.nome}
          onChange={e => set("nome", e.target.value)}
        />

        <Select
          label="Status" required
          options={STATUS_OBRA}
          value={form.status}
          onChange={e => set("status", e.target.value)}
        />

        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Área (m²)" type="number" min={0} step={0.01}
            placeholder="Ex: 8400"
            value={form.area_construida_m2 ?? ""}
            onChange={e => set("area_construida_m2", e.target.value ? Number(e.target.value) : null)}
          />
          <Input
            label="Pavimentos" type="number" min={1}
            placeholder="Ex: 18"
            value={form.numero_pavimentos ?? ""}
            onChange={e => set("numero_pavimentos", e.target.value ? Number(e.target.value) : null)}
          />
          <Input
            label="Unidades" type="number" min={1}
            placeholder="Ex: 72"
            value={form.numero_unidades ?? ""}
            onChange={e => set("numero_unidades", e.target.value ? Number(e.target.value) : null)}
          />
        </div>

        {/* Etapas padrão */}
        <label className="flex items-start gap-3 p-4 bg-brand-50 border border-brand-200 rounded-xl cursor-pointer">
          <input
            type="checkbox"
            checked={form.usar_etapas_padrao}
            onChange={e => set("usar_etapas_padrao", e.target.checked)}
            className="mt-0.5 accent-brand-600"
          />
          <div>
            <p className="text-sm font-medium text-brand-800">Criar etapas padrão automaticamente</p>
            <p className="text-xs text-brand-600 mt-0.5">
              Fundação, Estrutura, Vedação, Cobertura, Elétricas, Hidráulicas,
              Revestimentos, Esquadrias, Pintura e Acabamentos — com pesos pré-definidos
            </p>
          </div>
        </label>

        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
          <button type="button" onClick={onFechar}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={mutation.isPending}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60 transition-colors">
            {mutation.isPending ? "Salvando…" : "Criar obra"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
