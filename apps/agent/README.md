# apps/agent

Agente de IA do UM Meeting AI: **UM Copilot**.

## Responsabilidades

- Entrar em salas LiveKit como participante de IA.
- Ouvir audio da reuniao.
- Responder por voz quando chamado.

## Stack planejada

- Python
- LiveKit Agents
- OpenAI Realtime
- OpenAI Realtime para resposta por voz

## Sprint 2

Implementa o primeiro worker do **UM Copilot** com LiveKit Agents.

O agente:

- registra o agent name `um-copilot`;
- entra na sala quando o backend cria um dispatch;
- aparece conceitualmente como UM Copilot;
- escuta audio da reuniao;
- usa OpenAI Realtime para responder por voz;
- transcreve a fala de entrada para detectar chamadas;
- gera resposta apenas quando a transcricao final contem "Copilot" ou "UM Copilot".
- envia cada trecho final transcrito para a API salvar no PostgreSQL.
- consulta a base de conhecimento pela ferramenta `search_knowledge_base` quando a pergunta depende de documentos.

CRM, memoria de longo prazo e notas ainda nao foram implementados.

## Rodando localmente

Configure `.env` na raiz com LiveKit e OpenAI:

```bash
LIVEKIT_URL=wss://your-livekit-project.livekit.cloud
LIVEKIT_API_KEY=replace-me
LIVEKIT_API_SECRET=replace-me
OPENAI_API_KEY=replace-me
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
API_URL=http://localhost:8000
AGENT_API_KEY=replace-me
```

Instale e rode:

```bash
cd apps/agent
python -m venv .venv
source .venv/bin/activate
pip install -e .
python agent.py dev
```

Em outro terminal, rode a API e o frontend. Ao entrar em uma reuniao, o backend tentara despachar o agente `um-copilot` para a mesma sala.
