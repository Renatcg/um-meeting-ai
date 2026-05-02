# UM Meeting AI

MVP de uma plataforma de reunioes com video ao vivo, transcricao e um participante de IA chamado **UM Copilot**.

O produto combina salas de reuniao com LiveKit, um backend FastAPI, um agente de IA com LiveKit Agents e OpenAI Realtime, persistencia em PostgreSQL com pgvector, Redis para jobs e S3/R2 para gravacoes.

## Objetivo do MVP

Permitir que participantes entrem em uma sala de video e contem com o UM Copilot para:

- participar da reuniao como agente de IA;
- transcrever a conversa em tempo real;
- tomar notas e gerar resumo;
- responder quando chamado;
- enviar dicas privadas ao comercial durante a chamada.

## Estrutura

```txt
.
├── apps
│   ├── web       # Frontend Next.js + React + Tailwind
│   ├── api       # Backend FastAPI
│   └── agent     # LiveKit Agent + OpenAI Realtime
├── packages
│   └── database  # Schema, migrations e helpers de banco
└── docs          # Documentacao tecnica e de produto
```

## Stack planejada

- Frontend: Next.js, React, Tailwind
- Backend: FastAPI, Python
- Video e salas: LiveKit Cloud
- Agente de IA: LiveKit Agents
- Voz e interacao em tempo real: OpenAI Realtime
- Banco: PostgreSQL com pgvector
- Jobs e filas: Redis
- Gravacoes: S3 ou Cloudflare R2

## Sprint 1

Implementado nesta primeira sprint:

- frontend Next.js;
- rota `/meeting/[id]`;
- tela de nome e e-mail;
- aceite LGPD obrigatorio antes de entrar;
- backend FastAPI;
- endpoint para criar reuniao;
- endpoint para gerar token LiveKit;
- entrada na sala com audio e video.

IA, transcricao, notas e dicas privadas ainda nao foram implementadas.

## Sprint 2

Implementado nesta sprint:

- app Python em `apps/agent`;
- agente LiveKit chamado `um-copilot`;
- prompt de sistema em `apps/agent/prompts.py`;
- integracao com OpenAI Realtime para resposta por voz;
- dispatch do UM Copilot pelo backend ao gerar token da sala;
- regra de comportamento: responder somente quando chamado por "Copilot" ou "UM Copilot".

Ainda nao inclui RAG, painel comercial, dicas privadas, memoria, notas ou resumo automatico.

## Sprint 3

Implementado nesta sprint:

- transcricao em tempo real a partir do audio ouvido pelo UM Copilot;
- envio dos trechos transcritos do agente para a API;
- tabela PostgreSQL `transcript_segments`;
- cada trecho com `meeting_id`, `speaker_name`, `timestamp_seconds` e `content`;
- endpoint `GET /meetings/{id}/transcript`;
- aba lateral de transcricao na sala do frontend.

O realtime da interface usa polling simples nesta sprint. WebSocket/SSE pode entrar depois.

## Sprint 4

Implementado nesta sprint:

- papeis de participante: `host`, `commercial`, `client` e `observer`;
- token privado da API para autorizar recursos por papel;
- painel comercial visivel somente para `host` e `commercial`;
- `sales_coach_service` para analisar trechos da transcricao;
- cards privados de objecao, risco e oportunidade;
- persistencia dos cards em PostgreSQL;
- endpoint privado `GET /meetings/{id}/sales-recommendations`.

Clientes e observadores nao recebem nem renderizam recomendacoes comerciais.

## Sprint 5

Implementado nesta sprint:

- upload de documentos PDF, DOCX, TXT e MD;
- extracao de texto dos documentos;
- quebra em chunks;
- embeddings com OpenAI;
- persistencia no PostgreSQL com pgvector;
- endpoint `POST /knowledge/documents`;
- endpoint `POST /knowledge/search`;
- ferramenta `search_knowledge_base` no UM Copilot;
- resposta explicita quando a base nao tem informacao suficiente.

## Rodando localmente

1. Crie `.env` na raiz a partir de `.env.example`.
2. Configure `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `DATABASE_URL` e `OPENAI_API_KEY`.
3. Suba o PostgreSQL local se quiser usar Docker:

```bash
docker compose up -d postgres
```

4. Instale e rode a API:

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

5. Em outro terminal, instale e rode o frontend:

```bash
npm install
npm run dev:web
```

5. Abra `http://localhost:3000`.

## Proximas etapas sugeridas

1. Criar o workspace do monorepo e tooling base.
2. Inicializar `apps/web` com Next.js e Tailwind.
3. Inicializar `apps/api` com FastAPI, healthcheck e configuracao.
4. Inicializar `apps/agent` com o esqueleto do LiveKit Agent.
5. Definir schema inicial em `packages/database`.
6. Conectar LiveKit Cloud e gerar tokens de sala pelo backend.
