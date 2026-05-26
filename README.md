# Obras Platform

Sistema completo de **gestão de empreendimentos imobiliários e construção civil**,
com módulos de viabilidade, orçamento, suprimentos, financeiro, centro de custo,
RDO (Relatório Diário de Obra) e análise por IA.

---

## ✨ Principais features

- **Empreendimentos**: cadastro, pipeline (Kanban), estimativa paramétrica de custos via Gemini, mapa interativo, soft-delete com lixeira
- **Obras**: etapas, cronograma físico-financeiro (Gantt), EVM (CPI/SPI), atividades, integração com captura 360°
- **Orçamentos**: itens por composição (SINAPI), custos realizados, EVM
- **Suprimentos**: fornecedores, requisições, cotações (com marca/modelo), comparativo, ordens de compra, recebimento, estoque, transferências
- **Financeiro**: lançamentos categorizados (alinhados com o CC), fluxo de caixa, resumo mensal
- **Centro de Custo (CC)**: visão consolidada da obra com 14 categorias × ~65 sub-itens; dados auto-alimentados de outros módulos com disclaimer ao clicar em campos linkados
- **RDO**: registro estruturado + **gravação por voz** com transcrição automática via Gemini (preenche os campos do RDO a partir do relato falado)
- **Vision 360°**: análise de capturas 360° do canteiro via IA
- **Análises IA**: avaliação estratégica do empreendimento (Monte Carlo, EVM, Real Options)
- **Multi-tenant** com RLS (Row Level Security) no PostgreSQL

---

## 🛠️ Stack

| Camada     | Tecnologias |
|------------|-------------|
| Backend    | Python 3.12 · FastAPI · SQLAlchemy 2 (async) · Alembic · asyncpg · Pydantic v2 |
| Frontend   | React 18 · TypeScript · Vite · TanStack Query v5 · Tailwind CSS 3 · React Router 6 · Recharts · Leaflet |
| Banco      | PostgreSQL 16 (com Row Level Security para multi-tenancy) |
| Cache/Fila | Redis 7 · Celery |
| IA         | Google Gemini 2.5 Flash (texto, imagem, áudio) |
| DevOps     | Docker · Docker Compose |

---

## 🚀 Como rodar localmente

### Pré-requisitos
- Docker Desktop instalado
- Chave da API Gemini ([obtenha aqui](https://aistudio.google.com/app/apikey))

### Setup

```bash
# 1. Clone o repositório
git clone https://github.com/<seu-usuario>/obras-platform.git
cd obras-platform

# 2. Configure as variáveis de ambiente
cp .env.example .env
# Edite .env e preencha:
#   - POSTGRES_PASSWORD
#   - SECRET_KEY (gere uma chave forte)
#   - GEMINI_API_KEY (sua chave do Google AI Studio)

# 3. Suba os containers
docker compose up -d --build

# 4. Aplique as migrations
docker exec obras-backend-1 alembic upgrade head

# 5. (Opcional) Popule o catálogo do Centro de Custo
docker exec obras-backend-1 python -m scripts.seed_cc_catalogo
```

Acesse:
- **Frontend**: http://localhost:5173
- **Backend (Swagger)**: http://localhost:8000/docs
- **Backend (ReDoc)**: http://localhost:8000/redoc

### Criando o primeiro usuário

```bash
# Crie um usuário admin via API ou direto no banco
docker exec obras-backend-1 python -m scripts.db seed
```

---

## 📂 Estrutura

```
obras/
├── backend/                    # FastAPI + SQLAlchemy
│   ├── app/
│   │   ├── api/v1/             # Endpoints REST
│   │   ├── models/             # Modelos SQLAlchemy
│   │   ├── schemas/            # Schemas Pydantic
│   │   ├── services/           # Lógica de negócio (Gemini, EVM, etc.)
│   │   └── workers/            # Tasks Celery (ETL SINAPI, Vision 360°)
│   ├── migrations/             # Alembic
│   └── scripts/                # Seeds e utilitários
│
├── frontend/                   # React + Vite + TS
│   ├── src/
│   │   ├── api/                # Cliente HTTP (axios)
│   │   ├── components/         # Componentes reutilizáveis
│   │   ├── pages/              # Rotas
│   │   ├── stores/             # Estado global (Zustand)
│   │   └── types/              # Tipos TS compartilhados
│   └── public/
│
├── docker-compose.yml
└── .env.example
```

---

## 🔐 Segurança

- Multi-tenant com **Row Level Security** no PostgreSQL (toda query filtra automaticamente pelo `tenant_id` da sessão)
- JWT para autenticação
- Senhas hasheadas com bcrypt
- **Nunca commite o `.env`** — use `.env.example` como template
- Em produção, rotacione `SECRET_KEY` e `GEMINI_API_KEY`

---

## 📜 Licença

Proprietária — todos os direitos reservados.
