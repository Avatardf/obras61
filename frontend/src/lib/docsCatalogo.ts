/**
 * Catálogo estático dos 39 documentos obrigatórios por empreendimento.
 * Os statuses ficam no banco; os rótulos e categorias são fixos aqui.
 */

export type StatusDoc =
  | "pendente"
  | "em_andamento"
  | "concluido"
  | "nao_se_aplica"
  | "urgente";

export interface DocItem {
  tipo: string;       // chave única (snake_case)
  label: string;      // nome exibido
}

export interface DocCategoria {
  id: string;
  label: string;
  icon: string;       // emoji
  docs: DocItem[];
}

export const CATALOGO: DocCategoria[] = [
  {
    id: "aquisicao",
    label: "Aquisição do Terreno",
    icon: "🏗️",
    docs: [
      { tipo: "escritura_compra_venda",   label: "Escritura de compra e venda"         },
      { tipo: "itbi_recolhido",           label: "ITBI recolhido"                      },
      { tipo: "matricula_atualizada",     label: "Matrícula atualizada (< 30 dias)"    },
      { tipo: "due_diligence_juridica",   label: "Due diligence jurídica"              },
    ],
  },
  {
    id: "juridico",
    label: "Jurídico / Societário",
    icon: "⚖️",
    docs: [
      { tipo: "scp_constituida",          label: "SCP constituída e registrada"        },
      { tipo: "spe_aberta",               label: "SPE aberta (CNPJ)"                  },
      { tipo: "ret_cadastrado",           label: "RET cadastrado (Receita Federal)"    },
      { tipo: "certidoes_negativas",      label: "Certidões negativas (CND/FGTS/Trab.)" },
      { tipo: "contrato_parceria",        label: "Contrato de parceria assinado"       },
      { tipo: "parecer_juridico",         label: "Parecer jurídico do contrato"        },
    ],
  },
  {
    id: "projeto_licencas",
    label: "Projeto e Licenças",
    icon: "📐",
    docs: [
      { tipo: "projeto_arquitetonico",    label: "Projeto arquitetônico aprovado"      },
      { tipo: "projeto_estrutural",       label: "Projeto estrutural"                  },
      { tipo: "memorial_incorporacao",    label: "Memorial de incorporação registrado" },
      { tipo: "alvara_construcao",        label: "Alvará de construção válido"         },
      { tipo: "art_rrt_execucao",         label: "ART/RRT de execução"                },
    ],
  },
  {
    id: "construcao",
    label: "Construção",
    icon: "🔨",
    docs: [
      { tipo: "contrato_mestre_obras",    label: "Contrato com Mestre de Obras"        },
      { tipo: "empresa_mestre",           label: "Empresa Mestre (razão social + CNPJ)"},
      { tipo: "cronograma_fisico",        label: "Cronograma físico-financeiro aprovado" },
      { tipo: "diario_obra_iniciado",     label: "Diário de obra iniciado"             },
      { tipo: "seguro_obra",              label: "Seguro de obra contratado"           },
    ],
  },
  {
    id: "concessionarias",
    label: "Concessionárias / Órgãos",
    icon: "⚡",
    docs: [
      { tipo: "aneel_solicitacao",        label: "ANEEL — solicitação de ligação"      },
      { tipo: "aneel_ligacao_definitiva", label: "ANEEL — ligação definitiva"          },
      { tipo: "saneago_agua_esgoto",      label: "Saneago — ligação de água/esgoto"   },
      { tipo: "saneago_ligacao_definitiva",label: "Saneago — ligação definitiva"       },
      { tipo: "bombeiros_ppci",           label: "Bombeiros — PPCI aprovado"           },
      { tipo: "avcb_emitido",             label: "AVCB emitido"                        },
      { tipo: "habite_se_solicitado",     label: "Habite-se solicitado"                },
      { tipo: "habite_se_emitido",        label: "Habite-se emitido"                   },
    ],
  },
  {
    id: "cef_financiamento",
    label: "CEF / Financiamento",
    icon: "🏦",
    docs: [
      { tipo: "cadastro_cef",             label: "Cadastro CEF — ficha do empreendimento" },
      { tipo: "engeval_fase1",            label: "Avaliação ENGEVAL — 1ª fase (30%)"  },
      { tipo: "engeval_fase2",            label: "Avaliação ENGEVAL — 2ª fase (60%)"  },
      { tipo: "engeval_fase3",            label: "Avaliação ENGEVAL — 3ª fase (100%)" },
      { tipo: "financiamento_producao",   label: "Financiamento à produção contratado" },
      { tipo: "geric_obtido",             label: "GERIC obtido"                        },
    ],
  },
  {
    id: "encerramento",
    label: "Encerramento",
    icon: "🔑",
    docs: [
      { tipo: "averbacao_construcao",     label: "Averbação da construção na matrícula" },
      { tipo: "individualizacao_matriculas", label: "Individualização de matrículas"   },
      { tipo: "termos_entrega_assinados", label: "Termos de entrega assinados"         },
      { tipo: "manuais_proprietario",     label: "Manuais do proprietário entregues"   },
      { tipo: "encerramento_spe",         label: "Encerramento da SPE"                 },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export const TODOS_DOCS: DocItem[] = CATALOGO.flatMap(c => c.docs);

export const STATUS_CONFIG: Record<StatusDoc, { label: string; icon: string; cls: string; dot: string }> = {
  pendente:      { label: "Pendente",       icon: "⬜", cls: "bg-slate-100 text-slate-500 border-slate-200",      dot: "bg-slate-400"   },
  em_andamento:  { label: "Em andamento",   icon: "🔄", cls: "bg-blue-50 text-blue-600 border-blue-200",          dot: "bg-blue-500"    },
  concluido:     { label: "Concluído",      icon: "✅", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  nao_se_aplica: { label: "N/A",            icon: "➖", cls: "bg-slate-50 text-slate-400 border-slate-150",       dot: "bg-slate-300"   },
  urgente:       { label: "Urgente",        icon: "⚠️", cls: "bg-amber-50 text-amber-700 border-amber-200",       dot: "bg-amber-500"   },
};

export const STATUS_CICLO: StatusDoc[] = [
  "pendente", "em_andamento", "concluido", "nao_se_aplica", "urgente",
];

export function proximoStatus(atual: string): StatusDoc {
  const idx = STATUS_CICLO.indexOf(atual as StatusDoc);
  return idx >= 0 ? STATUS_CICLO[(idx + 1) % STATUS_CICLO.length] : "em_andamento";
}

/** Calcula % de conclusão de um conjunto de statuses. Exclui N/A do denominador. */
export function calcProgresso(statuses: Record<string, string>, tipos: string[]): number {
  const validos = tipos.filter(t => statuses[t] !== "nao_se_aplica");
  if (validos.length === 0) return 100;
  const concluidos = validos.filter(t => statuses[t] === "concluido");
  return Math.round((concluidos.length / validos.length) * 100);
}
