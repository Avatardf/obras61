from typing import Any

from google import genai
from google.genai import types

from app.config import settings

_client = genai.Client(api_key=settings.gemini_api_key)
_MODEL = "gemini-2.5-flash"


async def _generate(prompt: str) -> str:
    response = await _client.aio.models.generate_content(
        model=_MODEL,
        contents=prompt,
    )
    return response.text


async def analisar_obra_texto(prompt: str, contexto: dict[str, Any]) -> str:
    """Análise textual de dados de obra — EVM, desvios, recomendações."""
    system = (
        "Você é um especialista em gestão de obras de construção civil no Brasil. "
        "Analise os dados fornecidos e responda de forma objetiva e prática, "
        "usando terminologia técnica da construção civil brasileira."
    )
    return await _generate(f"{system}\n\nContexto:\n{contexto}\n\nPergunta/Tarefa:\n{prompt}")


async def analisar_imagem_360(
    imagem_bytes: bytes,
    etapa_nome: str,
    imagem_anterior_bytes: bytes | None = None,
) -> dict[str, Any]:
    """Analisa imagem 360° do canteiro e retorna progresso estimado e anomalias."""
    prompt_text = (
        f"Você está analisando uma foto 360° de um canteiro de obras. "
        f"A etapa atual é: {etapa_nome}. "
        "Estime: (1) percentual de conclusão desta etapa (0-100%), "
        "(2) anomalias visíveis (riscos de segurança, desvios de qualidade, material mal armazenado), "
        "(3) sugestão de texto para o Relatório Diário de Obra (RDO). "
        "Responda em JSON com campos: progresso_estimado, anomalias (lista), sugestao_rdo, confianca (0-1)."
    )

    parts: list[Any] = [
        types.Part.from_bytes(data=imagem_bytes, mime_type="image/jpeg"),
    ]
    if imagem_anterior_bytes:
        parts.append(types.Part.from_text(text="Imagem anterior para comparação:"))
        parts.append(types.Part.from_bytes(data=imagem_anterior_bytes, mime_type="image/jpeg"))
    parts.append(types.Part.from_text(text=prompt_text))

    response = await _client.aio.models.generate_content(
        model=_MODEL,
        contents=parts,
    )

    import json
    import re
    json_match = re.search(r"\{.*\}", response.text, re.DOTALL)
    if json_match:
        return json.loads(json_match.group())
    return {"progresso_estimado": None, "anomalias": [], "sugestao_rdo": response.text, "confianca": 0}


async def gerar_analise_empreendimento(dados: dict[str, Any]) -> str:
    """Análise estratégica completa de um empreendimento."""
    prompt = (
        "Analise este empreendimento de construção civil e forneça: "
        "1. Avaliação do desempenho (CPI, SPI, tendências), "
        "2. Principais riscos identificados, "
        "3. Recomendações de ação imediata, "
        "4. Estimativa de conclusão baseada na tendência atual."
    )
    return await analisar_obra_texto(prompt, dados)


async def gerar_rdo_texto(dados: dict) -> str:
    """Gera o texto formal do Relatório Diário de Obra via Gemini."""

    CLIMA_PT = {
        "ensolarado": "Ensolarado ☀️",
        "nublado":    "Nublado 🌤️",
        "chuvoso":    "Chuvoso 🌧️",
        "tempestade": "Tempestade ⛈️",
    }

    clima_manha = CLIMA_PT.get(dados.get("clima_manha", ""), dados.get("clima_manha") or "Não informado")
    clima_tarde = CLIMA_PT.get(dados.get("clima_tarde", ""), dados.get("clima_tarde") or "Não informado")

    equipes_txt = ""
    for e in dados.get("equipes", []):
        equipes_txt += f"  - {e['funcao']}: {e['quantidade']} trabalhador(es)\n"
    if not equipes_txt:
        equipes_txt = f"  - Efetivo total: {dados.get('efetivo_total', 'não informado')} trabalhadores\n"

    atividades_txt = "\n".join(f"  {i+1}. {a}" for i, a in enumerate(dados.get("atividades", [])))
    if not atividades_txt:
        atividades_txt = "  (Nenhuma atividade registrada)"

    ocorrencias_txt = ""
    for oc in dados.get("ocorrencias", []):
        crit = oc.get("criticidade", "").upper()
        ocorrencias_txt += f"  • [{crit}] {oc.get('tipo','').title()}: {oc.get('descricao','')}\n"
    if not ocorrencias_txt:
        ocorrencias_txt = "  Sem ocorrências registradas no período.\n"

    observacoes = dados.get("observacoes") or "Sem observações adicionais."

    prompt = f"""Você é um engenheiro civil responsável por uma obra de construção civil no Brasil.
Redija um Relatório Diário de Obra (RDO) formal, técnico e completo em português brasileiro.

=== DADOS DO DIA ===
Obra: {dados.get('obra_nome', 'Obra')}
Data: {dados.get('data', '')}
Clima — Manhã: {clima_manha} | Tarde: {clima_tarde}

=== EFETIVO PRESENTE ===
{equipes_txt}
Total: {dados.get('efetivo_total', '?')} trabalhadores

=== ATIVIDADES EXECUTADAS ===
{atividades_txt}

=== OCORRÊNCIAS E NÃO-CONFORMIDADES ===
{ocorrencias_txt}

=== OBSERVAÇÕES DO RESPONSÁVEL ===
{observacoes}

=== INSTRUÇÕES DE FORMATO ===
Escreva o RDO completo com as seguintes seções:
1. Cabeçalho (identificação da obra, data, responsável técnico)
2. Condições Climáticas e Impactos na Obra
3. Quadro de Efetivo
4. Atividades Realizadas (narrativo técnico detalhado)
5. Ocorrências / Não-Conformidades / Medidas Tomadas
6. Observações e Recomendações
7. Assinatura / Responsável Técnico

Use linguagem técnica formal da construção civil. Seja objetivo e detalhado."""

    return await _generate(prompt)


async def transcrever_rdo_voz(audio_bytes: bytes, mime_type: str = "audio/webm") -> dict[str, Any]:
    """Transcreve um áudio de relato de RDO e extrai os campos estruturados.

    O áudio é um relato do responsável pela obra, falando livremente sobre
    o dia (clima, efetivo, atividades, ocorrências, observações). O Gemini
    transcreve + extrai os campos no formato esperado pelo RDO.

    Retorna dict com:
        transcricao: str (texto completo falado)
        clima_manha: str | None  ('ensolarado'|'nublado'|'chuvoso'|'tempestade')
        clima_tarde: str | None
        efetivo_total: int | None
        equipes: list[{funcao: str, quantidade: int}]
        atividades: list[str]
        ocorrencias: list[{tipo: str, descricao: str, criticidade: str}]
        observacoes: str | None
    """
    import json
    import re

    prompt_text = """Você é um assistente especializado em Relatórios Diários de Obra (RDO).
Recebeu um áudio de um engenheiro/mestre de obras relatando o dia de trabalho na construção civil brasileira.

TAREFAS:
1. Transcreva o áudio fielmente em português brasileiro.
2. Extraia as informações estruturadas conforme o esquema do RDO abaixo.

CAMPOS A EXTRAIR:
- clima_manha / clima_tarde: classifique em UMA das opções (sem acento): ensolarado | nublado | chuvoso | tempestade
  Se não mencionar, use null.
- efetivo_total: número TOTAL de trabalhadores presentes (inteiro).
- equipes: lista de {funcao, quantidade} para cada categoria mencionada
  (ex: pedreiro, servente, armador, carpinteiro, eletricista, encanador, mestre, etc.).
- atividades: lista de strings, cada uma descrevendo uma atividade EXECUTADA no dia.
  Seja conciso mas técnico (ex: "Concretagem da laje do 3º pavimento",
  "Assentamento de alvenaria de vedação no bloco B", "Instalação de tubulação hidráulica no térreo").
- ocorrencias: lista de {tipo, descricao, criticidade}.
  tipo: seguranca | qualidade | ambiental | geral
  criticidade: baixa | media | alta
  Considere ocorrência: acidente, quase-acidente, retrabalho, falha de material,
  paralisação, descumprimento de norma, problema ambiental, etc.
- observacoes: texto livre com observações gerais (atrasos, pendências, próximos passos, comentários).

RESPONDA APENAS COM JSON VÁLIDO, sem markdown, sem ```json, sem texto fora do JSON.

Estrutura exata:
{
  "transcricao": "<texto completo transcrito>",
  "clima_manha": "<ensolarado|nublado|chuvoso|tempestade|null>",
  "clima_tarde": "<ensolarado|nublado|chuvoso|tempestade|null>",
  "efetivo_total": <int|null>,
  "equipes": [{"funcao": "...", "quantidade": <int>}],
  "atividades": ["...", "..."],
  "ocorrencias": [{"tipo": "...", "descricao": "...", "criticidade": "..."}],
  "observacoes": "<texto|null>"
}

REGRAS:
- Se algum campo não foi mencionado, use null (ou lista vazia para arrays).
- Não invente informações que não foram ditas.
- Mantenha a fidelidade ao que foi falado, mas pode normalizar termos
  (ex: "tava chovendo de manhã" → clima_manha: "chuvoso")."""

    parts: list[Any] = [
        types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
        types.Part.from_text(text=prompt_text),
    ]

    response = await _client.aio.models.generate_content(
        model=_MODEL,
        contents=parts,
    )

    texto = response.text or ""
    # Extrai JSON da resposta (remove eventual markdown residual)
    texto_limpo = re.sub(r"```(?:json)?\s*", "", texto).replace("```", "").strip()
    json_match = re.search(r"\{.*\}", texto_limpo, re.DOTALL)
    if not json_match:
        raise ValueError(f"Gemini não retornou JSON válido na transcrição: {texto[:300]}")

    dados = json.loads(json_match.group())

    # Normalização defensiva
    CLIMAS_VALIDOS = {"ensolarado", "nublado", "chuvoso", "tempestade"}
    TIPOS_VALIDOS  = {"seguranca", "qualidade", "ambiental", "geral"}
    CRITS_VALIDOS  = {"baixa", "media", "alta"}

    if dados.get("clima_manha") not in CLIMAS_VALIDOS:
        dados["clima_manha"] = None
    if dados.get("clima_tarde") not in CLIMAS_VALIDOS:
        dados["clima_tarde"] = None
    if not isinstance(dados.get("equipes"), list):
        dados["equipes"] = []
    if not isinstance(dados.get("atividades"), list):
        dados["atividades"] = []

    ocorrencias_clean = []
    for oc in dados.get("ocorrencias") or []:
        if not isinstance(oc, dict) or not oc.get("descricao"):
            continue
        ocorrencias_clean.append({
            "tipo":        oc.get("tipo") if oc.get("tipo") in TIPOS_VALIDOS else "geral",
            "descricao":   str(oc.get("descricao", "")).strip(),
            "criticidade": oc.get("criticidade") if oc.get("criticidade") in CRITS_VALIDOS else "baixa",
        })
    dados["ocorrencias"] = ocorrencias_clean

    return dados


async def sugerir_composicoes_sinapi(descricao_obra: str) -> str:
    """Dado uma descrição de obra, sugere códigos SINAPI relevantes."""
    prompt = (
        f"Para uma obra com a seguinte descrição: '{descricao_obra}', "
        "liste os 10 principais códigos SINAPI que seriam necessários, "
        "com código, descrição resumida e unidade. Responda em formato de tabela markdown."
    )
    return await _generate(prompt)


async def estimar_custos_empreendimento(dados: dict[str, Any]) -> dict[str, Any]:
    """Estimativa paramétrica de custo de construção via Gemini.

    Recebe o dicionário de dados do empreendimento e retorna um dict
    com custo_total, breakdown por categoria, premissas e metadados.
    """
    import json
    import re

    PADRAO_LABELS = {
        "economico": "Econômico/Popular (0,70–0,90× CUB) — apartamentos compactos, acabamentos simples",
        "normal":    "Normal/Padrão (0,95–1,10× CUB) — acabamentos medianos, padrão classe média",
        "alto":      "Alto Padrão (1,25–1,60× CUB) — fachada diferenciada, acabamentos nobres",
        "luxo":      "Luxo/Premium (1,80–2,50× CUB) — personalização total, materiais importados",
    }
    ESTAC_LABELS = {
        "nenhum":         "Sem estacionamento",
        "superficie":     "Estacionamento em superfície (descoberto, custo mínimo)",
        "semi_enterrado": "Estacionamento semi-enterrado (1 nível parcialmente abaixo do nível do terreno)",
        "subsolo_1":      "1 nível de subsolo (garagem totalmente subterrânea, 1 pavimento)",
        "subsolo_2":      "2 níveis de subsolo (garagem subterrânea, 2 pavimentos)",
        "subsolo_3":      "3+ níveis de subsolo (garagem subterrânea profunda)",
    }
    ESTRUT_LABELS = {
        "concreto_armado":    "Concreto armado moldado in loco (pórticos)",
        "alvenaria_estrutural": "Alvenaria estrutural (blocos de concreto ou cerâmicos)",
        "steel_frame":        "Steel frame (perfis de aço leve)",
        "pre_moldado":        "Pré-moldado / pré-fabricado de concreto",
    }
    LAZER_LABELS = {
        "piscina_adulto":   "Piscina adulto",
        "piscina_infantil": "Piscina infantil",
        "academia":         "Academia/Fitness (≈150 m²)",
        "salao_festas":     "Salão de festas (≈200 m²)",
        "coworking":        "Coworking / Business lounge",
        "playground":       "Playground infantil",
        "quadra_esportiva": "Quadra esportiva polivalente",
        "brinquedoteca":    "Brinquedoteca",
        "spa_sauna":        "Spa / Sauna",
        "rooftop":          "Rooftop / Sky deck",
        "churrasqueira":    "Área gourmet / Churrasqueira",
        "petplace":         "Pet place",
        "horta_comunitaria": "Horta comunitária",
        "salao_jogos":      "Salão de jogos / Gamer room",
    }

    lazer = dados.get("diferenciais_lazer") or []
    lazer_txt = ", ".join(LAZER_LABELS.get(d, d) for d in lazer) or "Nenhum diferencial de lazer"
    padrao_txt = PADRAO_LABELS.get(dados.get("padrao_construtivo", ""), "Normal/Padrão")
    estac_txt  = ESTAC_LABELS.get(dados.get("estacionamento_tipo", ""), "Não informado")
    estrut_txt = ESTRUT_LABELS.get(dados.get("sistema_estrutural", ""), "Concreto armado")

    vgv = dados.get("vgv_previsto") or 0
    vgv_fmt = f"R$ {vgv:,.2f}" if vgv else "Não informado"

    prompt = f"""Você é um engenheiro de custos sênior com 20 anos de experiência em incorporação imobiliária no Brasil.
Você realiza estimativas paramétricas na fase de viabilidade de empreendimentos residenciais verticais.

Forneça uma estimativa completa de custo de construção usando o CUB (Custo Unitário Básico) do SINDUSCON como referência.
Inclua SOMENTE custos diretos e indiretos de construção civil:
  ✓ Materiais, mão de obra, equipamentos
  ✓ Serviços de engenharia (projetos estrutural, elétrico, hidráulico, SPDA, etc.)
  ✓ BDI da construtora (25–30% sobre custos diretos)
  ✗ NÃO inclua: terreno, despesas de incorporação (registro, ITBI, IPTU), marketing, lucro da incorporadora

═══════════════════════════════════════════════════════════════
DADOS DO EMPREENDIMENTO: "{dados.get('nome', 'Residencial')}"
Localização: {dados.get('cidade', '')}, {dados.get('uf', 'RJ')}
═══════════════════════════════════════════════════════════════

VOLUMETRIA
  • Número de unidades habitacionais: {dados.get('num_unidades') or '?'}
  • Metragem privativa média por unidade: {dados.get('metragem_media_unidade') or '?'} m²
  • Número de pavimentos (torres + garagem): {dados.get('num_pavimentos_estimado') or '?'}
  • Área total do terreno: {dados.get('area_terreno_m2') or '?'} m²

PADRÃO E SISTEMA CONSTRUTIVO
  • Padrão: {padrao_txt}
  • Sistema estrutural: {estrut_txt}
  • Número de elevadores: {dados.get('num_elevadores') or 'não informado'}

ESTACIONAMENTO
  • Tipo: {estac_txt}
  • Número de vagas: {dados.get('num_vagas') or 0}

DIFERENCIAIS E ÁREAS COMUNS DE LAZER
  • {lazer_txt}

REFERÊNCIA FINANCEIRA
  • VGV Previsto: {vgv_fmt}

═══════════════════════════════════════════════════════════════

METODOLOGIA ESPERADA:
1. Calcule a área construída total estimada:
   - Área privativa total = {dados.get('num_unidades') or 'N'} unid. × {dados.get('metragem_media_unidade') or 'X'} m²
   - Multiplique pelo fator de eficiência típico (1,35–1,65×) para incluir circulação, shafts, hall, etc.
   - Some a área de estacionamento (≈25–35 m²/vaga para subsolo)
   - Some área das instalações de lazer
2. Defina o custo/m² com base no CUB-{dados.get('uf', 'RJ')} e multiplicador do padrão
3. Aplique custos adicionais por estacionamento em subsolo, elevadores e lazer
4. Aplique BDI de 27% sobre custos diretos
5. Apresente intervalos realistas de variação (±15% para confiança média, ±25% para baixa)

Responda SOMENTE com JSON puro e válido (sem markdown, sem ```json, sem texto fora do JSON):
{{
  "custo_total": <float>,
  "custo_total_min": <float>,
  "custo_total_max": <float>,
  "custo_por_m2_construido": <float>,
  "area_construida_estimada_m2": <float>,
  "custo_por_unidade": <float>,
  "confianca": "<baixa|media|alta>",
  "referencia_cub": "<ex: CUB SINDUSCON-RJ R8-N Jan/2025 = R$ 2.847/m²>",
  "multiplicador_cub": <float>,
  "breakdown": {{
    "fundacao": <float>,
    "estrutura": <float>,
    "vedacao_alvenaria": <float>,
    "cobertura": <float>,
    "instalacoes_eletricas": <float>,
    "instalacoes_hidraulicas": <float>,
    "instalacoes_especiais": <float>,
    "revestimentos": <float>,
    "esquadrias_vidros": <float>,
    "pintura": <float>,
    "acabamentos_metais": <float>,
    "elevadores": <float>,
    "estacionamento": <float>,
    "areas_lazer": <float>,
    "areas_comuns_circulacao": <float>,
    "bdi_indiretos": <float>
  }},
  "premissas": [<lista de strings com premissas adotadas, mínimo 5>],
  "observacoes": "<texto livre: avisos, fatores de risco, recomendações>"
}}"""

    texto = await _generate(prompt)

    # Extrai JSON da resposta (remove eventual markdown residual)
    texto_limpo = re.sub(r"```(?:json)?\s*", "", texto).replace("```", "").strip()
    json_match = re.search(r"\{.*\}", texto_limpo, re.DOTALL)
    if not json_match:
        raise ValueError(f"Gemini não retornou JSON válido: {texto[:300]}")
    return json.loads(json_match.group())
