# Deployment

## Recommended test environment

- GitHub for source control.
- Vercel for `apps/web`.
- Railway, Render or Fly.io for `apps/api`.
- Railway, Render or Fly.io for `apps/agent`.
- PostgreSQL with pgvector enabled.
- LiveKit Cloud.
- OpenAI API.

## Required environment variables

Shared:

```bash
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
OPENAI_API_KEY=
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=1536
APP_JWT_SECRET=
AGENT_API_KEY=
DATABASE_URL=
```

Web:

```bash
NEXT_PUBLIC_API_URL=https://your-api.example.com
```

Agent:

```bash
API_URL=https://your-api.example.com
COPILOT_AGENT_NAME=um-copilot
COPILOT_DISPLAY_NAME=UM Copilot
OPENAI_REALTIME_MODEL=gpt-realtime
OPENAI_REALTIME_VOICE=marin
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
```

## Vercel

Set the project root to the repository root and use `vercel.json`.

Set `NEXT_PUBLIC_API_URL` to the deployed API URL.

## API worker

Use `apps/api/Dockerfile`.

The API must be publicly reachable by the web app and the agent.

## Agent worker

Use `apps/agent/Dockerfile`.

The agent does not need to expose an HTTP port. It must keep running so LiveKit can dispatch the `um-copilot` worker into rooms.

## Database

The PostgreSQL database must support:

```sql
CREATE EXTENSION vector;
```

The API creates its tables on startup.
