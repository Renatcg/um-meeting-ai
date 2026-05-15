# apps/api

Backend do UM Meeting AI.

## Responsabilidades

- Autenticacao e autorizacao.
- Criacao e gerenciamento de reunioes.
- Geracao de tokens LiveKit para participantes e para o Jarvis.
- Persistencia de transcricoes, notas, dicas e resumos.
- Orquestracao de jobs com Redis.
- Integracao com storage S3/R2 para gravacoes.

## Stack planejada

- FastAPI
- PostgreSQL
- Redis
- LiveKit Server SDK
- SDKs de storage S3/R2

## Sprint 1

Endpoints implementados:

- `GET /health`
- `POST /meetings`
- `POST /meetings/{meeting_id}/token`
- `POST /meetings/{meeting_id}/transcript`
- `GET /meetings/{meeting_id}/transcript`
- `GET /meetings/{meeting_id}/sales-recommendations`
- `POST /meetings/{meeting_id}/memory/process`
- `GET /meetings/{meeting_id}/memory`
- `POST /meetings/{meeting_id}/memory/search`
- `POST /knowledge/documents`
- `POST /knowledge/search`

As reunioes ainda ficam em memoria nesta sprint. Os trechos de transcricao e recomendacoes comerciais sao persistidos em PostgreSQL.

## Banco

A API cria automaticamente a tabela `transcript_segments` ao iniciar.

Campos principais:

- `meeting_id`
- `speaker_name`
- `timestamp_seconds`
- `content`

Tambem cria `sales_recommendations` para cards privados do comercial.

Para RAG, cria:

- `knowledge_documents`
- `knowledge_chunks`
- `meeting_memory_items`

`knowledge_chunks.embedding` usa pgvector.
`meeting_memory_items.embedding` tambem usa pgvector e guarda memoria pos-reuniao
com ACL basica por usuario/papel.

## Memoria pos-reuniao

Quando a reuniao termina, a API dispara em segundo plano um processamento de
memoria. Tambem e possivel reprocessar manualmente:

```bash
POST /meetings/{meeting_id}/memory/process?force=true
X-Agent-API-Key: <AGENT_API_KEY>
```

A memoria guarda varios niveis:

- transcricao em chunks
- resumo executivo
- decisoes
- proximos passos
- objecoes comerciais
- riscos
- promessas feitas
- entidades citadas

Busca semantica:

```json
{
  "query": "O que o cliente falou sobre prazo?",
  "top_k": 8,
  "customer": "ACME"
}
```

Use `POST /meetings/{meeting_id}/memory/search` com
`Authorization: Bearer <participant_access_token>`. O retorno respeita a
permissao basica gravada na memoria.

## Painel comercial

O endpoint de recomendacoes exige `Authorization: Bearer <participant_access_token>`.

O token e emitido em `POST /meetings/{meeting_id}/token` e contem o papel do participante. A API bloqueia o acesso se o papel for `client` ou `observer`.

## Base de conhecimento

`POST /knowledge/documents` recebe upload multipart no campo `file`.

Formatos aceitos:

- PDF
- DOCX
- TXT
- MD

`POST /knowledge/search` recebe:

```json
{
  "query": "pergunta ou termo de busca",
  "top_k": 5
}
```

## Rodando localmente

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
