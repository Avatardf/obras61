import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect, useCallback } from "react";
import { empreendimentosApi } from "@/api/client";
import { Input, Select } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Modal } from "@/components/ui/Modal";
import type {
  EmpreendimentoCreate, EmpreendimentoResponse,
  PadraoConstrutivo, EstacionamentoTipo, SistemaEstrutural,
} from "@/types";
import { MapPin, Search, X, Loader2, Building2, TrendingUp, Layers, Car, Dumbbell } from "lucide-react";
import { clsx } from "clsx";
import { MapaLocalizacao, type ReverseGeocodeResult } from "@/components/empreendimentos/MapaLocalizacao";

// ── Tipos & constantes ────────────────────────────────────────────────────────

const TIPOS = [
  { value: "residencial_vertical",   label: "Residencial Vertical" },
  { value: "residencial_horizontal", label: "Residencial Horizontal" },
  { value: "comercial",              label: "Comercial" },
  { value: "misto",                  label: "Misto" },
  { value: "infraestrutura",         label: "Infraestrutura" },
];

const PADROES = [
  { value: "economico", label: "Econômico / Popular" },
  { value: "normal",    label: "Normal / Padrão" },
  { value: "alto",      label: "Alto Padrão" },
  { value: "luxo",      label: "Luxo / Premium" },
];

const ESTACIONAMENTOS = [
  { value: "nenhum",         label: "Sem estacionamento" },
  { value: "superficie",     label: "Em superfície (descoberto)" },
  { value: "semi_enterrado", label: "Semi-enterrado" },
  { value: "subsolo_1",      label: "Subsolo — 1 nível" },
  { value: "subsolo_2",      label: "Subsolo — 2 níveis" },
  { value: "subsolo_3",      label: "Subsolo — 3+ níveis" },
];

const ESTRUTURAS = [
  { value: "concreto_armado",      label: "Concreto armado (in loco)" },
  { value: "alvenaria_estrutural", label: "Alvenaria estrutural" },
  { value: "steel_frame",          label: "Steel frame" },
  { value: "pre_moldado",          label: "Pré-moldado / pré-fabricado" },
];

const DIFERENCIAIS_OPCOES = [
  { value: "piscina_adulto",    label: "🏊 Piscina adulto" },
  { value: "piscina_infantil",  label: "🏊 Piscina infantil" },
  { value: "academia",          label: "🏋️ Academia / Fitness" },
  { value: "salao_festas",      label: "🎉 Salão de festas" },
  { value: "coworking",         label: "💼 Coworking / Lounge" },
  { value: "playground",        label: "🛝 Playground" },
  { value: "quadra_esportiva",  label: "🏀 Quadra esportiva" },
  { value: "brinquedoteca",     label: "🧸 Brinquedoteca" },
  { value: "spa_sauna",         label: "🧖 Spa / Sauna" },
  { value: "rooftop",           label: "🌆 Rooftop / Sky deck" },
  { value: "churrasqueira",     label: "🍖 Área gourmet / Churrasqueira" },
  { value: "petplace",          label: "🐾 Pet place" },
  { value: "horta_comunitaria", label: "🌱 Horta comunitária" },
  { value: "salao_jogos",       label: "🎮 Salão de jogos" },
];

const STATUS = [
  { value: "estudo",      label: "Estudo" },
  { value: "viabilidade", label: "Viabilidade" },
  { value: "aprovacao",   label: "Aprovação" },
  { value: "em_obras",    label: "Em obras" },
  { value: "entregue",    label: "Entregue" },
  { value: "cancelado",   label: "Cancelado" },
];

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS",
  "MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC",
  "SP","SE","TO",
].map(uf => ({ value: uf, label: uf }));

// Mapeamento nome completo → sigla para estados brasileiros
const ESTADO_UF: Record<string, string> = {
  "Acre": "AC", "Alagoas": "AL", "Amapá": "AP", "Amazonas": "AM",
  "Bahia": "BA", "Ceará": "CE", "Distrito Federal": "DF", "Espírito Santo": "ES",
  "Goiás": "GO", "Maranhão": "MA", "Mato Grosso": "MT", "Mato Grosso do Sul": "MS",
  "Minas Gerais": "MG", "Pará": "PA", "Paraíba": "PB", "Paraná": "PR",
  "Pernambuco": "PE", "Piauí": "PI", "Rio de Janeiro": "RJ",
  "Rio Grande do Norte": "RN", "Rio Grande do Sul": "RS", "Rondônia": "RO",
  "Roraima": "RR", "Santa Catarina": "SC", "São Paulo": "SP",
  "Sergipe": "SE", "Tocantins": "TO",
};

// ── Nominatim (OpenStreetMap) ─────────────────────────────────────────────────

interface NominatimAddr {
  road?: string;
  house_number?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  postcode?: string;
}
interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: NominatimAddr;
}

async function geocodificar(q: string): Promise<NominatimResult[]> {
  if (q.trim().length < 4) return [];
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(q)}` +
    `&format=json&addressdetails=1&limit=6&countrycodes=br`;
  const r = await fetch(url, {
    headers: { "Accept-Language": "pt-BR,pt;q=0.9" },
  });
  if (!r.ok) return [];
  return r.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type Erros = Partial<Record<string, string>>;

interface FormState extends EmpreendimentoCreate {
  endereco: {
    rua: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
    lat?: number;
    lng?: number;
  };
  padrao_construtivo: PadraoConstrutivo | null;
  estacionamento_tipo: EstacionamentoTipo | null;
  sistema_estrutural: SistemaEstrutural | null;
}

const vazio = (): FormState => ({
  nome: "",
  tipo: "residencial_vertical",
  status: "estudo",
  vgv_previsto: null,
  num_unidades: null,
  area_terreno_m2: null,
  valor_terreno: null,
  preco_custo_unidade: null,
  preco_venda_unidade: null,
  padrao_construtivo: "normal",
  metragem_media_unidade: null,
  num_pavimentos_estimado: null,
  estacionamento_tipo: "subsolo_1",
  num_vagas: null,
  num_elevadores: null,
  sistema_estrutural: "concreto_armado",
  diferenciais_lazer: [],
  endereco: { rua: "", numero: "", bairro: "", cidade: "", uf: "RJ", cep: "" },
});

function fromEditando(e: EmpreendimentoResponse): FormState {
  const end = e.endereco as any;
  return {
    nome: e.nome,
    tipo: e.tipo,
    status: e.status,
    vgv_previsto: e.vgv_previsto,
    num_unidades: e.num_unidades,
    area_terreno_m2: e.area_terreno_m2,
    valor_terreno: e.valor_terreno,
    preco_custo_unidade: e.preco_custo_unidade,
    preco_venda_unidade: e.preco_venda_unidade,
    // Aplica defaults explícitos quando o BD retorna null — assim o select
    // visualmente mostrado já tem valor real no estado, e ao salvar manda
    // o default ao backend (e o botão de estimativa fica habilitado).
    padrao_construtivo: e.padrao_construtivo ?? "normal",
    metragem_media_unidade: e.metragem_media_unidade,
    num_pavimentos_estimado: e.num_pavimentos_estimado,
    estacionamento_tipo: e.estacionamento_tipo ?? "subsolo_1",
    num_vagas: e.num_vagas,
    num_elevadores: e.num_elevadores,
    sistema_estrutural: e.sistema_estrutural ?? "concreto_armado",
    diferenciais_lazer: e.diferenciais_lazer ?? [],
    endereco: {
      rua: end.rua ?? "",
      numero: end.numero ?? "",
      bairro: end.bairro ?? "",
      cidade: end.cidade ?? "",
      uf: end.uf ?? "RJ",
      cep: end.cep ?? "",
      lat: end.lat,
      lng: end.lng,
    },
  };
}

// Pequeno input numérico reutilizável
function NumInput({ label, placeholder, value, onChange, min, step }: {
  label: string; placeholder?: string;
  value: number | null | undefined;
  onChange: (v: string) => void;
  min?: number; step?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input
        type="number" min={min} step={step} placeholder={placeholder}
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
      />
    </div>
  );
}

// KPI mini card para indicadores calculados
function KpiMini({ label, valor, cor = "text-slate-700" }: {
  label: string; valor: string; cor?: string;
}) {
  return (
    <div className="bg-white border border-blue-100 rounded-lg px-3 py-2">
      <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={clsx("text-sm font-semibold", cor)}>{valor}</p>
    </div>
  );
}

// Indicador de percentual terreno/VGV com faixa de cor
function PctVgv({ valor, vgv }: { valor: number | null | undefined; vgv: number | null | undefined }) {
  if (!valor || !vgv || vgv === 0) return null;
  const pct = (valor / vgv) * 100;
  const cor =
    pct <= 20 ? "text-emerald-600 bg-emerald-50 border-emerald-200" :
    pct <= 30 ? "text-amber-600 bg-amber-50 border-amber-200" :
                "text-red-600 bg-red-50 border-red-200";
  return (
    <span className={clsx("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold", cor)}>
      <TrendingUp size={11} />
      {pct.toFixed(1)}% do VGV
    </span>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  aberto: boolean;
  onFechar: () => void;
  editando?: EmpreendimentoResponse | null;
}

// ── Componente principal ──────────────────────────────────────────────────────

export function EmpreendimentoForm({ aberto, onFechar, editando }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(editando ? fromEditando(editando) : vazio());
  const [erros, setErros] = useState<Erros>({});

  // Address autocomplete state
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<NominatimResult[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buscaRef = useRef<HTMLDivElement>(null);

  // Reset form on open
  useEffect(() => {
    if (aberto) {
      setForm(editando ? fromEditando(editando) : vazio());
      setErros({});
      setBusca("");
      setResultados([]);
    }
  }, [aberto, editando]);

  // Click outside to close dropdown
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (buscaRef.current && !buscaRef.current.contains(e.target as Node)) {
        setDropdownAberto(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Debounced geocoding
  const pesquisar = useCallback((q: string) => {
    setBusca(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.trim().length < 4) { setResultados([]); setDropdownAberto(false); return; }
    timerRef.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await geocodificar(q);
        setResultados(res);
        setDropdownAberto(res.length > 0);
      } finally {
        setBuscando(false);
      }
    }, 500);
  }, []);

  // Selecionar resultado do autocomplete
  function selecionarEndereco(r: NominatimResult) {
    const a = r.address;
    const cidade = a.city || a.town || a.village || "";
    const ufNome = a.state || "";
    const uf = ESTADO_UF[ufNome] || form.endereco.uf;
    const cep = (a.postcode || "").replace("-", "");
    setForm(f => ({
      ...f,
      endereco: {
        rua: a.road || "",
        numero: a.house_number || "",
        bairro: a.suburb || a.neighbourhood || "",
        cidade,
        uf,
        cep: cep ? `${cep.slice(0, 5)}-${cep.slice(5)}` : "",
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
      },
    }));
    setBusca(r.display_name.split(",").slice(0, 3).join(","));
    setDropdownAberto(false);
    setResultados([]);
  }

  // Mutation
  const mutation = useMutation({
    mutationFn: () =>
      editando
        ? empreendimentosApi.atualizar(editando.id, form)
        : empreendimentosApi.criar(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empreendimentos"] });
      onFechar();
      setForm(vazio());
      setErros({});
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setErros({ geral: detail });
      else if (err?.response?.status)
        setErros({ geral: `Erro ${err.response.status}: ${err.response.statusText}` });
      else setErros({ geral: "Não foi possível conectar ao servidor." });
    },
  });

  // Generic setter
  function set(campo: string, valor: unknown) {
    setErros(e => ({ ...e, [campo]: undefined }));
    if (campo.startsWith("endereco.")) {
      const sub = campo.replace("endereco.", "");
      setForm(f => ({ ...f, endereco: { ...f.endereco, [sub]: valor } }));
    } else {
      setForm(f => ({ ...f, [campo]: valor }));
    }
  }

  function validar(): boolean {
    const e: Erros = {};
    if (!form.nome.trim()) e.nome = "Nome é obrigatório";
    if (!form.endereco.cidade.trim()) e["endereco.cidade"] = "Cidade é obrigatória";
    if (!form.endereco.uf) e["endereco.uf"] = "UF é obrigatória";
    if (form.vgv_previsto !== null && (form.vgv_previsto ?? 0) < 0)
      e.vgv_previsto = "VGV não pode ser negativo";
    setErros(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validar()) return;
    mutation.mutate();
  }

  const isVertical = form.tipo === "residencial_vertical";

  // Atualiza lat/lng quando o usuário clica/arrasta no mapa
  function handleMapaChange(c: { lat: number; lng: number }) {
    setForm(f => ({
      ...f,
      endereco: { ...f.endereco, lat: c.lat, lng: c.lng },
    }));
  }

  // Preenche campos de endereço a partir do reverse-geocoding (Nominatim)
  // — útil quando o usuário marca direto no mapa em vez de digitar.
  // Apenas preenche campos que estão vazios, para não sobrescrever o que
  // o usuário já digitou manualmente.
  function handleReverseGeocode(r: ReverseGeocodeResult) {
    setForm(f => ({
      ...f,
      endereco: {
        ...f.endereco,
        rua:    f.endereco.rua    || r.rua    || "",
        numero: f.endereco.numero || r.numero || "",
        bairro: f.endereco.bairro || r.bairro || "",
        cidade: f.endereco.cidade || r.cidade || "",
        uf:     f.endereco.uf     || r.uf     || "",
        cep:    f.endereco.cep    || r.cep    || "",
      },
    }));
  }

  return (
    <Modal
      titulo={editando ? "Editar Empreendimento" : "Novo Empreendimento"}
      aberto={aberto}
      onFechar={onFechar}
      largura="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">

        {erros.geral && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
            {erros.geral}
          </div>
        )}

        {/* ── Seção 1: Dados básicos ────────────────────────────────────── */}
        <div className="space-y-4">
          <Input
            label="Nome do empreendimento"
            required
            placeholder="Ex: Residencial Carioca Tower"
            value={form.nome}
            onChange={e => set("nome", e.target.value)}
            erro={erros.nome}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Tipo"
              required
              options={TIPOS}
              value={form.tipo}
              onChange={e => set("tipo", e.target.value)}
            />
            <Select
              label="Status"
              required
              options={STATUS}
              value={form.status}
              onChange={e => set("status", e.target.value)}
            />
          </div>

          <CurrencyInput
            label="VGV Previsto"
            nullable
            value={form.vgv_previsto}
            onChange={v => set("vgv_previsto", v)}
            placeholder="Ex: 45.000.000,00"
            erro={erros.vgv_previsto}
            dica="Valor Geral de Vendas estimado do empreendimento"
          />
        </div>

        {/* ── Seção 2: Dados específicos (Residencial Vertical) ─────────── */}
        {isVertical && (
          <div className="border border-blue-100 bg-blue-50/40 rounded-xl p-4 space-y-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
              <Building2 size={15} />
              Dados do Residencial Vertical
            </div>

            {/* Sub-seção: Volumetria */}
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Volumetria</p>
              <div className="grid grid-cols-2 gap-4">
                <NumInput label="Número de unidades" placeholder="Ex: 120"
                  value={form.num_unidades} onChange={v => set("num_unidades", v ? parseInt(v) : null)} min={1} step={1} />
                <NumInput label="Metragem média por unidade (m²)" placeholder="Ex: 75"
                  value={form.metragem_media_unidade} onChange={v => set("metragem_media_unidade", v ? parseFloat(v) : null)} min={10} step={0.5} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <NumInput label="Número de pavimentos" placeholder="Ex: 18"
                  value={form.num_pavimentos_estimado} onChange={v => set("num_pavimentos_estimado", v ? parseInt(v) : null)} min={1} step={1} />
                <NumInput label="Área do terreno (m²)" placeholder="Ex: 2500"
                  value={form.area_terreno_m2} onChange={v => set("area_terreno_m2", v ? parseFloat(v) : null)} min={0} step={1} />
              </div>
            </div>

            {/* Sub-seção: Padrão e estrutura */}
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Padrão construtivo</p>
              <div className="grid grid-cols-2 gap-4">
                <Select label="Padrão construtivo" options={PADROES}
                  value={form.padrao_construtivo ?? "normal"}
                  onChange={e => set("padrao_construtivo", e.target.value)} />
                <Select label="Sistema estrutural" options={ESTRUTURAS}
                  value={form.sistema_estrutural ?? "concreto_armado"}
                  onChange={e => set("sistema_estrutural", e.target.value)} />
              </div>
            </div>

            {/* Sub-seção: Estacionamento */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-400 font-semibold">
                <Car size={12} /> Estacionamento
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Select label="Tipo de estacionamento" options={ESTACIONAMENTOS}
                  value={form.estacionamento_tipo ?? "nenhum"}
                  onChange={e => set("estacionamento_tipo", e.target.value)} />
                <NumInput label="Número de vagas" placeholder="Ex: 180"
                  value={form.num_vagas} onChange={v => set("num_vagas", v ? parseInt(v) : null)} min={0} step={1} />
              </div>
              <NumInput label="Número de elevadores" placeholder="Ex: 3"
                value={form.num_elevadores} onChange={v => set("num_elevadores", v ? parseInt(v) : null)} min={0} step={1} />
            </div>

            {/* Sub-seção: Diferenciais de lazer */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-400 font-semibold">
                <Dumbbell size={12} /> Áreas de lazer e diferenciais
              </div>
              <div className="grid grid-cols-2 gap-y-2 gap-x-3">
                {DIFERENCIAIS_OPCOES.map(op => {
                  const checked = (form.diferenciais_lazer ?? []).includes(op.value);
                  return (
                    <label key={op.value} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const atual = form.diferenciais_lazer ?? [];
                          set("diferenciais_lazer", checked
                            ? atual.filter(x => x !== op.value)
                            : [...atual, op.value]);
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                      />
                      <span className="text-xs text-slate-700 group-hover:text-slate-900">{op.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Sub-seção: Valores financeiros */}
            <div className="space-y-3 border-t border-blue-100 pt-4">
              <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Valores financeiros</p>
              <div className="grid grid-cols-2 gap-4">
                <CurrencyInput label="Custo por unidade" nullable value={form.preco_custo_unidade}
                  onChange={v => set("preco_custo_unidade", v)} placeholder="0,00"
                  dica="Custo médio de construção por unidade" />
                <CurrencyInput label="Preço de venda por unidade" nullable value={form.preco_venda_unidade}
                  onChange={v => set("preco_venda_unidade", v)} placeholder="0,00"
                  dica="Preço médio de venda por unidade" />
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <CurrencyInput label="Valor do terreno" nullable value={form.valor_terreno}
                    onChange={v => set("valor_terreno", v)} placeholder="0,00"
                    dica="Custo de aquisição do terreno" />
                </div>
                <div className="pb-2">
                  <PctVgv valor={form.valor_terreno} vgv={form.vgv_previsto} />
                </div>
              </div>
              {form.valor_terreno && form.vgv_previsto && (
                <p className="text-xs text-slate-400">Referência: terreno entre 15% e 25% do VGV</p>
              )}
            </div>

            {/* Indicadores calculados ao vivo */}
            {form.num_unidades && form.vgv_previsto ? (
              <div className="grid grid-cols-3 gap-2 pt-1">
                <KpiMini label="VGV/unidade"
                  valor={(form.vgv_previsto / form.num_unidades).toLocaleString("pt-BR", {
                    style: "currency", currency: "BRL", maximumFractionDigits: 0,
                  })} />
                {form.preco_custo_unidade && form.preco_venda_unidade && (
                  <KpiMini label="Margem/unidade"
                    valor={`${((form.preco_venda_unidade - form.preco_custo_unidade) / form.preco_venda_unidade * 100).toFixed(1)}%`}
                    cor={form.preco_venda_unidade > form.preco_custo_unidade ? "text-emerald-600" : "text-red-600"} />
                )}
                {form.num_unidades && form.preco_venda_unidade && (
                  <KpiMini label="Receita total"
                    valor={(form.num_unidades * form.preco_venda_unidade).toLocaleString("pt-BR", {
                      style: "currency", currency: "BRL", maximumFractionDigits: 0,
                    })} />
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* ── Seção 3: Localização ──────────────────────────────────────── */}
        <div className="border-t border-slate-100 pt-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <MapPin size={14} className="text-brand-500" />
            Localização
          </div>

          {/* Autocomplete de endereço */}
          <div ref={buscaRef} className="relative">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Buscar endereço
            </label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Digite rua, bairro, cidade… (min. 4 caracteres)"
                value={busca}
                onChange={e => pesquisar(e.target.value)}
                onFocus={() => resultados.length > 0 && setDropdownAberto(true)}
                className="w-full pl-9 pr-9 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
              {buscando && (
                <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
              )}
              {!buscando && busca && (
                <button
                  type="button"
                  onClick={() => { setBusca(""); setResultados([]); setDropdownAberto(false); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Dropdown de resultados */}
            {dropdownAberto && resultados.length > 0 && (
              <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-50">
                {resultados.map(r => (
                  <li key={r.place_id}>
                    <button
                      type="button"
                      onClick={() => selecionarEndereco(r)}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-brand-50 text-slate-700 flex items-start gap-2"
                    >
                      <MapPin size={13} className="mt-0.5 text-brand-400 shrink-0" />
                      <span className="line-clamp-2">{r.display_name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Mapa interativo — clique ou arraste o pino */}
          <MapaLocalizacao
            lat={form.endereco.lat ?? null}
            lng={form.endereco.lng ?? null}
            onChange={handleMapaChange}
            onReverseGeocode={handleReverseGeocode}
          />

          {/* Campos de endereço estruturados */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Input
                label="Logradouro (Rua / Avenida)"
                placeholder="Ex: Av. das Américas"
                value={form.endereco.rua}
                onChange={e => set("endereco.rua", e.target.value)}
              />
            </div>
            <Input
              label="Número"
              placeholder="Ex: 4200"
              value={form.endereco.numero}
              onChange={e => set("endereco.numero", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Bairro"
              placeholder="Ex: Barra da Tijuca"
              value={form.endereco.bairro}
              onChange={e => set("endereco.bairro", e.target.value)}
            />
            <Input
              label="CEP"
              placeholder="00000-000"
              value={form.endereco.cep}
              onChange={e => set("endereco.cep", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Input
                label="Cidade"
                required
                placeholder="Ex: Rio de Janeiro"
                value={form.endereco.cidade}
                onChange={e => set("endereco.cidade", e.target.value)}
                erro={erros["endereco.cidade"]}
              />
            </div>
            <Select
              label="UF"
              required
              options={UFS}
              value={form.endereco.uf}
              onChange={e => set("endereco.uf", e.target.value)}
            />
          </div>
        </div>

        {/* ── Rodapé ───────────────────────────────────────────────────── */}
        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onFechar}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60 transition-colors"
          >
            {mutation.isPending
              ? "Salvando…"
              : editando ? "Salvar alterações" : "Cadastrar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
