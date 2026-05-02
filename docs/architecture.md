# Arquitetura Inicial

## Visao geral

O UM Meeting AI e uma plataforma de reunioes em que participantes humanos entram em uma sala LiveKit e um agente de IA, o **UM Copilot**, participa como mais um membro da chamada.

O frontend cria a experiencia da reuniao, o backend controla identidade, permissoes e tokens, e o agente executa a inteligencia em tempo real.

```txt
Participante
    |
    v
apps/web  <----->  apps/api  <-----> PostgreSQL + pgvector
    |                  |
    |                  +------> Redis
    |                  |
    v                  +------> S3/R2
LiveKit Cloud
    ^
    |
apps/agent <-----> OpenAI Realtime
```

## Componentes

### apps/web

Aplicacao Next.js responsavel pela interface do usuario:

- lobby;
- sala de video;
- lista de participantes;
- painel de transcricao;
- painel de notas;
- dicas privadas para o comercial;
- estado visual do UM Copilot.

### apps/api

API FastAPI responsavel por regras de negocio e integracoes server-side:

- criar reunioes;
- emitir tokens LiveKit;
- registrar participantes;
- persistir transcricoes e notas;
- iniciar jobs;
- expor dados para o frontend;
- controlar acesso a gravacoes.

### apps/agent

Worker do UM Copilot:

- conecta em salas LiveKit;
- recebe audio e eventos da sala;
- usa OpenAI Realtime para voz e raciocinio em tempo real;
- gera transcricao, notas e sugestoes;
- publica mensagens privadas ou eventos para o backend/frontend.

### packages/database

Camada compartilhada para schema e migrations.

Entidades iniciais provaveis:

- organizations;
- users;
- meetings;
- meeting_participants;
- transcripts;
- transcript_segments;
- notes;
- copilot_messages;
- recordings;
- embeddings.

## Fluxo principal do MVP

1. Usuario cria ou entra em uma reuniao pelo frontend.
2. Frontend chama a API para criar a sessao e obter token LiveKit.
3. API gera token LiveKit com permissoes adequadas.
4. Participante entra na sala LiveKit.
5. API agenda ou aciona o UM Copilot para entrar na mesma sala.
6. Agente entra como participante LiveKit.
7. Agente escuta audio, transcreve e envia eventos estruturados.
8. API persiste transcricao, notas e mensagens relevantes.
9. Frontend mostra transcricao, notas e dicas privadas em tempo real.
10. Ao fim, API salva resumo, proximos passos e links de gravacao.

## Transcricao da Sprint 3

Na Sprint 3, o UM Copilot usa o audio recebido via LiveKit Agents e a transcricao do OpenAI Realtime para gerar trechos finais de conversa.

Cada trecho e enviado para a API e salvo em PostgreSQL na tabela `transcript_segments` com:

- `meeting_id`;
- `speaker_name`;
- `timestamp_seconds`;
- `content`.

O frontend consulta `GET /meetings/{id}/transcript` periodicamente e exibe os trechos em uma aba lateral da sala.

## Painel comercial da Sprint 4

Participantes entram com um dos papeis:

- `host`;
- `commercial`;
- `client`;
- `observer`.

Ao gerar o token LiveKit, a API tambem emite um token privado da propria API com o papel do participante. O frontend usa esse token para acessar recursos privados.

Somente `host` e `commercial` podem chamar `GET /meetings/{id}/sales-recommendations`. Participantes `client` e `observer` nao veem a aba comercial e tambem sao bloqueados pela API.

O `sales_coach_service` analisa cada trecho final de transcricao e gera cards quando detecta:

- objecao;
- risco;
- oportunidade.

Os cards sao salvos na tabela `sales_recommendations` e exibidos na aba comercial em polling simples.

## Base de conhecimento da Sprint 5

A API aceita upload de documentos PDF, DOCX, TXT e MD em `POST /knowledge/documents`.

O fluxo de ingestao e:

1. receber o arquivo;
2. extrair texto;
3. quebrar em chunks;
4. gerar embeddings com OpenAI;
5. salvar documento e chunks no PostgreSQL com pgvector.

Tabelas:

- `knowledge_documents`;
- `knowledge_chunks`.

O endpoint `POST /knowledge/search` gera embedding para a consulta e retorna os chunks mais similares.

O UM Copilot tem a ferramenta `search_knowledge_base`. Quando for chamado e a pergunta depender de documentos, ele deve consultar a base. Se a busca nao retornar informacao suficiente, o Copilot deve dizer isso claramente ao participante.

## Dados em tempo real

Eventos de baixa latencia podem trafegar por:

- LiveKit data channels para eventos diretamente ligados a sala;
- WebSocket/SSE na API para atualizacoes de produto;
- Redis Pub/Sub ou streams para comunicacao interna entre API e agent.

A decisao final deve ser tomada quando o MVP definir quais eventos precisam ser privados, persistidos ou exibidos apenas para alguns participantes.

## Privacidade e permissoes

O MVP precisa tratar separadamente:

- mensagens publicas do UM Copilot na reuniao;
- respostas por voz audiveis por todos;
- dicas privadas visiveis apenas para o comercial;
- transcricoes e gravacoes com acesso controlado.

Toda dica privada deve ter metadados de destinatario e nunca deve ser enviada para o canal publico da sala.

## Gravacoes

Gravacoes devem ser armazenadas em S3/R2 com metadados no PostgreSQL:

- meeting_id;
- storage_provider;
- bucket;
- object_key;
- duration;
- status;
- created_at.

O acesso deve ser feito por URLs assinadas geradas pela API.

## Busca e memoria

pgvector sera usado para:

- buscar trechos relevantes de reunioes anteriores;
- recuperar conhecimento comercial;
- apoiar resumo e follow-up;
- encontrar objecoes, decisoes e proximos passos similares.

Para o MVP, embeddings podem ser gerados de forma assincrona via jobs Redis.

## Riscos tecnicos iniciais

- Latencia entre LiveKit, agente e OpenAI Realtime.
- Separacao confiavel entre mensagens publicas e dicas privadas.
- Qualidade da transcricao em reunioes com multiplos participantes.
- Controle de custos de voz, transcricao e armazenamento.
- Consentimento e seguranca para gravacoes.

## Decisoes pendentes

- Modelo exato de autenticacao.
- Provedor final de storage: AWS S3 ou Cloudflare R2.
- Ferramenta de migrations.
- Estrategia de realtime entre API e frontend.
- Nivel de multi-tenant no MVP.
