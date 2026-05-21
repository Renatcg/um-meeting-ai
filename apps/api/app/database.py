import json
from collections.abc import Sequence

import psycopg
from psycopg.rows import dict_row

from app.config import Settings
from app.models import (
    AgentProfile,
    ConversationMessage,
    ConversationSession,
    KnowledgeDocument,
    KnowledgeSearchResult,
    Meeting,
    MeetingJoinRequest,
    MeetingMemoryItem,
    MeetingMemorySearchResult,
    MeetingParticipant,
    MeetingProcessingJob,
    MeetingRecording,
    MeetingRecentSummary,
    SalesRecommendation,
    TranscriptSegment,
    TranscriptSegmentCreate,
    TrialRequest,
    TrialRequestCreate,
    TrialRequestUpdate,
    UserPublic,
    WhatsAppGroupMessage,
    WhatsAppWebhookEvent,
)
from app.sales_coach_service import RecommendationDraft


CREATE_TRANSCRIPT_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS transcript_segments (
    id BIGSERIAL PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    speaker_name TEXT NOT NULL,
    timestamp_seconds DOUBLE PRECISION NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

CREATE_TRANSCRIPT_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_transcript_segments_meeting_time
ON transcript_segments (meeting_id, timestamp_seconds, id);
"""

CREATE_RECOMMENDATIONS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS sales_recommendations (
    id BIGSERIAL PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    transcript_segment_id BIGINT NOT NULL REFERENCES transcript_segments(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('objection', 'risk', 'opportunity')),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    title TEXT NOT NULL,
    recommendation TEXT NOT NULL,
    evidence TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

CREATE_RECOMMENDATIONS_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_sales_recommendations_meeting_created
ON sales_recommendations (meeting_id, created_at, id);
"""

CREATE_VECTOR_EXTENSION_SQL = "CREATE EXTENSION IF NOT EXISTS vector;"

CREATE_KNOWLEDGE_DOCUMENTS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS knowledge_documents (
    id BIGSERIAL PRIMARY KEY,
    meeting_id TEXT,
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

ALTER_KNOWLEDGE_DOCUMENTS_MEETING_SQL = """
ALTER TABLE knowledge_documents
ADD COLUMN IF NOT EXISTS meeting_id TEXT;
"""

CREATE_KNOWLEDGE_DOCUMENTS_MEETING_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_meeting
ON knowledge_documents (meeting_id, id);
"""

CREATE_KNOWLEDGE_CHUNKS_TABLE_SQL_TEMPLATE = """
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector({dimensions}) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

CREATE_KNOWLEDGE_CHUNKS_DOCUMENT_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document
ON knowledge_chunks (document_id, chunk_index);
"""

CREATE_KNOWLEDGE_CHUNKS_VECTOR_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);
"""

CREATE_MEETING_MEMORY_ITEMS_TABLE_SQL_TEMPLATE = """
CREATE TABLE IF NOT EXISTS meeting_memory_items (
    id BIGSERIAL PRIMARY KEY,
    organization_id TEXT NOT NULL DEFAULT 'default',
    agent_id TEXT NOT NULL DEFAULT 'coevo',
    meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    memory_type TEXT NOT NULL CHECK (
        memory_type IN (
            'transcript_chunk',
            'executive_summary',
            'decision',
            'next_step',
            'commercial_objection',
            'risk',
            'promise',
            'entity'
        )
    ),
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{{}}'::jsonb,
    visibility TEXT NOT NULL DEFAULT 'participants' CHECK (
        visibility IN ('participants', 'host_commercial', 'organization')
    ),
    allowed_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    allowed_role_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    sensitivity_level TEXT NOT NULL DEFAULT 'medium' CHECK (
        sensitivity_level IN ('low', 'medium', 'high')
    ),
    embedding vector({dimensions}) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

CREATE_MEETING_MEMORY_ITEMS_MEETING_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_meeting_memory_items_meeting
ON meeting_memory_items (meeting_id, memory_type, id);
"""

CREATE_MEETING_MEMORY_ITEMS_ACL_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_meeting_memory_items_acl
ON meeting_memory_items (organization_id, visibility, sensitivity_level);
"""

CREATE_MEETING_MEMORY_ITEMS_VECTOR_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_meeting_memory_items_embedding
ON meeting_memory_items USING hnsw (embedding vector_cosine_ops);
"""

CREATE_MEETINGS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    recording_url TEXT,
    copilot_dispatched BOOLEAN NOT NULL DEFAULT FALSE
);
"""

CREATE_MEETING_PARTICIPANTS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS meeting_participants (
    id BIGSERIAL PRIMARY KEY,
    meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    identity TEXT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('host', 'commercial', 'client', 'observer')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

ALTER_MEETING_PARTICIPANTS_IDENTITY_SQL = """
ALTER TABLE meeting_participants
ADD COLUMN IF NOT EXISTS identity TEXT;
"""

CREATE_MEETING_PARTICIPANTS_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting_joined
ON meeting_participants (meeting_id, joined_at, id);
"""

CREATE_MEETING_PARTICIPANTS_IDENTITY_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_meeting_participants_identity
ON meeting_participants (meeting_id, identity);
"""

CREATE_MEETING_JOIN_REQUESTS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS meeting_join_requests (
    id BIGSERIAL PRIMARY KEY,
    meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('host', 'commercial', 'client', 'observer')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'approved', 'denied')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

CREATE_MEETING_JOIN_REQUESTS_STATUS_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_meeting_join_requests_status
ON meeting_join_requests (meeting_id, status, created_at, id);
"""

CREATE_MEETING_JOIN_REQUESTS_EMAIL_INDEX_SQL = """
CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_join_requests_email
ON meeting_join_requests (meeting_id, lower(email));
"""

CREATE_AGENT_PROFILE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS agent_profile (
    id TEXT PRIMARY KEY,
    config JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

CREATE_APP_USERS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS app_users (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

CREATE_APP_USERS_EMAIL_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_app_users_email
ON app_users (lower(email));
"""

CREATE_TRIAL_REQUESTS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS trial_requests (
    id BIGSERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    corporate_email TEXT NOT NULL,
    company_name TEXT NOT NULL,
    weekly_meeting_volume TEXT NOT NULL DEFAULT 'ate-5',
    lgpd_accepted BOOLEAN NOT NULL,
    source TEXT NOT NULL DEFAULT 'meeting-ended',
    selected_plan TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

ALTER_TRIAL_REQUESTS_SELECTED_PLAN_SQL = """
ALTER TABLE trial_requests
ADD COLUMN IF NOT EXISTS selected_plan TEXT;
"""

ALTER_TRIAL_REQUESTS_VOLUME_SQL = """
ALTER TABLE trial_requests
ADD COLUMN IF NOT EXISTS weekly_meeting_volume TEXT NOT NULL DEFAULT 'ate-5';
"""

CREATE_TRIAL_REQUESTS_CREATED_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_trial_requests_created
ON trial_requests (created_at DESC, id DESC);
"""

CREATE_MEETING_AGENT_ACTIONS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS meeting_agent_actions (
    id BIGSERIAL PRIMARY KEY,
    meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    requester_identity TEXT NOT NULL,
    requester_name TEXT NOT NULL,
    action_type TEXT NOT NULL,
    status TEXT NOT NULL,
    payload JSONB NOT NULL,
    result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

CREATE_MEETING_AGENT_ACTIONS_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_meeting_agent_actions_meeting_created
ON meeting_agent_actions (meeting_id, created_at DESC, id DESC);
"""

CREATE_MEETING_PENDING_EMAILS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS meeting_pending_emails (
    id BIGSERIAL PRIMARY KEY,
    meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    requester_identity TEXT NOT NULL,
    requester_name TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ
);
"""

CREATE_MEETING_PENDING_EMAILS_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_meeting_pending_emails_status
ON meeting_pending_emails (meeting_id, status, created_at, id);
"""

CREATE_GOOGLE_CALENDAR_CONNECTION_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS google_calendar_connection (
    id TEXT PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    calendar_email TEXT,
    scope TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

CREATE_MEETING_RECORDINGS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS meeting_recordings (
    id BIGSERIAL PRIMARY KEY,
    meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    egress_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL,
    storage_provider TEXT NOT NULL,
    bucket TEXT,
    object_key TEXT,
    file_type TEXT NOT NULL DEFAULT 'mp4',
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds DOUBLE PRECISION,
    size_bytes BIGINT,
    location TEXT,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

CREATE_MEETING_RECORDINGS_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_meeting_recordings_meeting_created
ON meeting_recordings (meeting_id, created_at DESC, id DESC);
"""

CREATE_CONVERSATION_SESSIONS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS conversation_sessions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL DEFAULT 'default',
    agent_id TEXT NOT NULL DEFAULT 'coevo',
    channel TEXT NOT NULL CHECK (channel IN ('web', 'whatsapp', 'voice', 'meeting')),
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_email TEXT,
    title TEXT NOT NULL,
    context_scope JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

CREATE_CONVERSATION_SESSIONS_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_user_updated
ON conversation_sessions (organization_id, user_id, updated_at DESC);
"""

CREATE_CONVERSATION_MESSAGES_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS conversation_messages (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

CREATE_CONVERSATION_MESSAGES_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_conversation_messages_session_created
ON conversation_messages (session_id, created_at, id);
"""

CREATE_MEETING_PROCESSING_JOBS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS meeting_processing_jobs (
    id BIGSERIAL PRIMARY KEY,
    meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL CHECK (job_type IN ('memory')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'running', 'completed', 'failed')
    ),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    locked_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    error TEXT,
    result JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (meeting_id, job_type)
);
"""

CREATE_MEETING_PROCESSING_JOBS_STATUS_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_meeting_processing_jobs_status
ON meeting_processing_jobs (status, updated_at, id);
"""

CREATE_MEETING_PROCESSING_JOBS_MEETING_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_meeting_processing_jobs_meeting
ON meeting_processing_jobs (meeting_id, id);
"""

CREATE_WHATSAPP_GROUP_MESSAGES_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS whatsapp_group_messages (
    id BIGSERIAL PRIMARY KEY,
    group_id TEXT NOT NULL,
    group_name TEXT,
    sender_phone TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (
        message_type IN ('text', 'audio', 'image', 'video', 'document', 'unknown')
    ),
    content TEXT NOT NULL,
    message_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

CREATE_WHATSAPP_GROUP_MESSAGES_GROUP_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_whatsapp_group_messages_group_created
ON whatsapp_group_messages (group_id, created_at DESC, id DESC);
"""

CREATE_WHATSAPP_GROUP_MESSAGES_MESSAGE_ID_INDEX_SQL = """
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_group_messages_message_id
ON whatsapp_group_messages (message_id)
WHERE message_id IS NOT NULL;
"""

CREATE_WHATSAPP_WEBHOOK_EVENTS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL,
    phone TEXT,
    is_group BOOLEAN NOT NULL DEFAULT FALSE,
    group_id TEXT,
    message_id TEXT,
    detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

CREATE_WHATSAPP_WEBHOOK_EVENTS_CREATED_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_created
ON whatsapp_webhook_events (created_at DESC, id DESC);
"""


async def init_database(settings: Settings) -> None:
    async with await psycopg.AsyncConnection.connect(settings.database_url) as conn:
        await conn.execute(CREATE_VECTOR_EXTENSION_SQL)
        await conn.execute(CREATE_MEETINGS_TABLE_SQL)
        await conn.execute(CREATE_MEETING_PARTICIPANTS_TABLE_SQL)
        await conn.execute(ALTER_MEETING_PARTICIPANTS_IDENTITY_SQL)
        await conn.execute(CREATE_MEETING_PARTICIPANTS_INDEX_SQL)
        await conn.execute(CREATE_MEETING_PARTICIPANTS_IDENTITY_INDEX_SQL)
        await conn.execute(CREATE_MEETING_JOIN_REQUESTS_TABLE_SQL)
        await conn.execute(CREATE_MEETING_JOIN_REQUESTS_STATUS_INDEX_SQL)
        await conn.execute(CREATE_MEETING_JOIN_REQUESTS_EMAIL_INDEX_SQL)
        await conn.execute(CREATE_AGENT_PROFILE_TABLE_SQL)
        await conn.execute(CREATE_APP_USERS_TABLE_SQL)
        await conn.execute(CREATE_APP_USERS_EMAIL_INDEX_SQL)
        await conn.execute(CREATE_MEETING_AGENT_ACTIONS_TABLE_SQL)
        await conn.execute(CREATE_MEETING_AGENT_ACTIONS_INDEX_SQL)
        await conn.execute(CREATE_MEETING_PENDING_EMAILS_TABLE_SQL)
        await conn.execute(CREATE_MEETING_PENDING_EMAILS_INDEX_SQL)
        await conn.execute(CREATE_GOOGLE_CALENDAR_CONNECTION_TABLE_SQL)
        await conn.execute(CREATE_MEETING_RECORDINGS_TABLE_SQL)
        await conn.execute(CREATE_MEETING_RECORDINGS_INDEX_SQL)
        await conn.execute(CREATE_CONVERSATION_SESSIONS_TABLE_SQL)
        await conn.execute(CREATE_CONVERSATION_SESSIONS_INDEX_SQL)
        await conn.execute(CREATE_CONVERSATION_MESSAGES_TABLE_SQL)
        await conn.execute(CREATE_CONVERSATION_MESSAGES_INDEX_SQL)
        await conn.execute(CREATE_MEETING_PROCESSING_JOBS_TABLE_SQL)
        await conn.execute(CREATE_MEETING_PROCESSING_JOBS_STATUS_INDEX_SQL)
        await conn.execute(CREATE_MEETING_PROCESSING_JOBS_MEETING_INDEX_SQL)
        await conn.execute(CREATE_WHATSAPP_GROUP_MESSAGES_TABLE_SQL)
        await conn.execute(CREATE_WHATSAPP_GROUP_MESSAGES_GROUP_INDEX_SQL)
        await conn.execute(CREATE_WHATSAPP_GROUP_MESSAGES_MESSAGE_ID_INDEX_SQL)
        await conn.execute(CREATE_WHATSAPP_WEBHOOK_EVENTS_TABLE_SQL)
        await conn.execute(CREATE_WHATSAPP_WEBHOOK_EVENTS_CREATED_INDEX_SQL)
        await conn.execute(CREATE_TRIAL_REQUESTS_TABLE_SQL)
        await conn.execute(ALTER_TRIAL_REQUESTS_SELECTED_PLAN_SQL)
        await conn.execute(ALTER_TRIAL_REQUESTS_VOLUME_SQL)
        await conn.execute(CREATE_TRIAL_REQUESTS_CREATED_INDEX_SQL)
        await conn.execute(CREATE_TRANSCRIPT_TABLE_SQL)
        await conn.execute(CREATE_TRANSCRIPT_INDEX_SQL)
        await conn.execute(CREATE_RECOMMENDATIONS_TABLE_SQL)
        await conn.execute(CREATE_RECOMMENDATIONS_INDEX_SQL)
        await conn.execute(CREATE_KNOWLEDGE_DOCUMENTS_TABLE_SQL)
        await conn.execute(ALTER_KNOWLEDGE_DOCUMENTS_MEETING_SQL)
        await conn.execute(CREATE_KNOWLEDGE_DOCUMENTS_MEETING_INDEX_SQL)
        await conn.execute(
            CREATE_KNOWLEDGE_CHUNKS_TABLE_SQL_TEMPLATE.format(
                dimensions=settings.openai_embedding_dimensions,
            )
        )
        await conn.execute(CREATE_KNOWLEDGE_CHUNKS_DOCUMENT_INDEX_SQL)
        await conn.execute(CREATE_KNOWLEDGE_CHUNKS_VECTOR_INDEX_SQL)
        await conn.execute(
            CREATE_MEETING_MEMORY_ITEMS_TABLE_SQL_TEMPLATE.format(
                dimensions=settings.openai_embedding_dimensions,
            )
        )
        await conn.execute(CREATE_MEETING_MEMORY_ITEMS_MEETING_INDEX_SQL)
        await conn.execute(CREATE_MEETING_MEMORY_ITEMS_ACL_INDEX_SQL)
        await conn.execute(CREATE_MEETING_MEMORY_ITEMS_VECTOR_INDEX_SQL)


async def insert_trial_request(
    *,
    settings: Settings,
    payload: TrialRequestCreate,
) -> TrialRequest:
    query = """
    INSERT INTO trial_requests (
        full_name,
        phone,
        corporate_email,
        company_name,
        weekly_meeting_volume,
        lgpd_accepted,
        source,
        selected_plan
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    RETURNING
        id,
        full_name,
        phone,
        corporate_email,
        company_name,
        weekly_meeting_volume,
        lgpd_accepted,
        source,
        selected_plan,
        created_at;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                query,
                (
                    payload.full_name,
                    payload.phone,
                    str(payload.corporate_email),
                    payload.company_name,
                    payload.weekly_meeting_volume,
                    payload.lgpd_accepted,
                    payload.source,
                    payload.selected_plan,
                ),
            )
            row = await cur.fetchone()

    if row is None:
        raise RuntimeError("Trial request insert did not return a row.")

    return TrialRequest.model_validate(row)


async def list_trial_requests(
    *,
    settings: Settings,
    limit: int = 100,
) -> list[TrialRequest]:
    query = """
    SELECT
        id,
        full_name,
        phone,
        corporate_email,
        company_name,
        weekly_meeting_volume,
        lgpd_accepted,
        source,
        selected_plan,
        created_at
    FROM trial_requests
    ORDER BY created_at DESC, id DESC
    LIMIT %s;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (limit,))
            rows = await cur.fetchall()

    return [TrialRequest.model_validate(row) for row in rows]


async def update_trial_request(
    *,
    settings: Settings,
    lead_id: int,
    payload: TrialRequestUpdate,
) -> TrialRequest:
    query = """
    UPDATE trial_requests
    SET
        full_name = %s,
        phone = %s,
        corporate_email = %s,
        company_name = %s,
        weekly_meeting_volume = %s,
        selected_plan = %s
    WHERE id = %s
    RETURNING
        id,
        full_name,
        phone,
        corporate_email,
        company_name,
        weekly_meeting_volume,
        lgpd_accepted,
        source,
        selected_plan,
        created_at;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                query,
                (
                    payload.full_name,
                    payload.phone,
                    str(payload.corporate_email),
                    payload.company_name,
                    payload.weekly_meeting_volume,
                    payload.selected_plan,
                    lead_id,
                ),
            )
            row = await cur.fetchone()

    if row is None:
        raise ValueError("Trial request not found.")

    return TrialRequest.model_validate(row)


async def delete_trial_request(*, settings: Settings, lead_id: int) -> None:
    query = "DELETE FROM trial_requests WHERE id = %s RETURNING id;"

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (lead_id,))
            row = await cur.fetchone()

    if row is None:
        raise ValueError("Trial request not found.")


async def count_app_users(*, settings: Settings) -> int:
    query = "SELECT COUNT(*)::int AS count FROM app_users;"
    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query)
            row = await cur.fetchone()
    return int(row["count"]) if row else 0


async def insert_app_user(
    *,
    settings: Settings,
    name: str,
    email: str,
    password_hash: str,
    is_admin: bool,
) -> UserPublic:
    query = """
    INSERT INTO app_users (name, email, password_hash, is_admin)
    VALUES (%s, %s, %s, %s)
    RETURNING id, name, email, is_admin, created_at;
    """

    try:
        async with await psycopg.AsyncConnection.connect(
            settings.database_url,
            row_factory=dict_row,
        ) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    query,
                    (name, email.lower(), password_hash, is_admin),
                )
                row = await cur.fetchone()
    except psycopg.errors.UniqueViolation as exc:
        raise ValueError("User already exists.") from exc

    if row is None:
        raise RuntimeError("User insert did not return a row.")
    return UserPublic.model_validate(row)


async def get_app_user_by_email(
    *,
    settings: Settings,
    email: str,
) -> dict | None:
    query = """
    SELECT id, name, email, password_hash, is_admin, created_at
    FROM app_users
    WHERE lower(email) = lower(%s)
    LIMIT 1;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (email,))
            row = await cur.fetchone()

    return dict(row) if row else None


async def get_app_user_by_id(
    *,
    settings: Settings,
    user_id: int,
) -> UserPublic | None:
    query = """
    SELECT id, name, email, is_admin, created_at
    FROM app_users
    WHERE id = %s
    LIMIT 1;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (user_id,))
            row = await cur.fetchone()

    return UserPublic.model_validate(row) if row else None


async def list_app_users(*, settings: Settings) -> Sequence[UserPublic]:
    query = """
    SELECT id, name, email, is_admin, created_at
    FROM app_users
    ORDER BY created_at DESC, id DESC;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query)
            rows = await cur.fetchall()

    return [UserPublic.model_validate(row) for row in rows]


async def insert_meeting(*, settings: Settings, meeting: Meeting) -> Meeting:
    query = """
    INSERT INTO meetings (
        id,
        title,
        created_at,
        started_at,
        ended_at,
        recording_url,
        copilot_dispatched
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s)
    RETURNING id, title, created_at, started_at, ended_at, recording_url, copilot_dispatched;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                query,
                (
                    meeting.id,
                    meeting.title,
                    meeting.created_at,
                    meeting.started_at,
                    meeting.ended_at,
                    meeting.recording_url,
                    meeting.copilot_dispatched,
                ),
            )
            row = await cur.fetchone()

    if row is None:
        raise RuntimeError("Meeting insert did not return a row.")

    return Meeting.model_validate(row)


async def get_meeting_by_id(*, settings: Settings, meeting_id: str) -> Meeting | None:
    query = """
    SELECT id, title, created_at, started_at, ended_at, recording_url, copilot_dispatched
    FROM meetings
    WHERE id = %s;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (meeting_id,))
            row = await cur.fetchone()

    if row is None:
        return None

    return Meeting.model_validate(row)


async def ensure_meeting(*, settings: Settings, meeting_id: str) -> Meeting:
    existing = await get_meeting_by_id(settings=settings, meeting_id=meeting_id)
    if existing:
        return existing

    meeting = Meeting.create("Reuniao UM")
    meeting.id = meeting_id
    return await insert_meeting(settings=settings, meeting=meeting)


async def list_recent_meetings(
    *,
    settings: Settings,
    limit: int = 20,
) -> Sequence[MeetingRecentSummary]:
    query = """
    SELECT
        m.id,
        m.title,
        m.created_at,
        m.started_at,
        m.ended_at,
        m.recording_url,
        m.copilot_dispatched,
        COUNT(DISTINCT mp.id)::int AS participant_count,
        COUNT(DISTINCT ts.id)::int AS transcript_count,
        COUNT(DISTINCT mmi.id)::int AS memory_count,
        COALESCE(
            jsonb_agg(
                DISTINCT jsonb_build_object(
                    'id', mp.id,
                    'meeting_id', mp.meeting_id,
                    'identity', mp.identity,
                    'name', mp.name,
                    'email', mp.email,
                    'role', mp.role,
                    'joined_at', mp.joined_at
                )
            ) FILTER (WHERE mp.id IS NOT NULL),
            '[]'::jsonb
        ) AS participants
    FROM meetings m
    LEFT JOIN meeting_participants mp ON mp.meeting_id = m.id
    LEFT JOIN transcript_segments ts ON ts.meeting_id = m.id
    LEFT JOIN meeting_memory_items mmi ON mmi.meeting_id = m.id
    GROUP BY m.id
    ORDER BY m.created_at DESC
    LIMIT %s;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (limit,))
            rows = await cur.fetchall()

    return [MeetingRecentSummary.model_validate(row) for row in rows]


async def insert_meeting_recording(
    *,
    settings: Settings,
    meeting_id: str,
    egress_id: str,
    status: str,
    storage_provider: str,
    bucket: str | None,
    object_key: str | None,
    file_type: str = "mp4",
    location: str | None = None,
) -> MeetingRecording:
    query = """
    INSERT INTO meeting_recordings (
        meeting_id,
        egress_id,
        status,
        storage_provider,
        bucket,
        object_key,
        file_type,
        location
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT (egress_id) DO UPDATE
    SET
        status = EXCLUDED.status,
        location = COALESCE(EXCLUDED.location, meeting_recordings.location),
        updated_at = now()
    RETURNING
        id,
        meeting_id,
        egress_id,
        status,
        storage_provider,
        bucket,
        object_key,
        file_type,
        started_at,
        ended_at,
        duration_seconds,
        size_bytes,
        location,
        error,
        created_at,
        updated_at;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                query,
                (
                    meeting_id,
                    egress_id,
                    status,
                    storage_provider,
                    bucket,
                    object_key,
                    file_type,
                    location,
                ),
            )
            row = await cur.fetchone()

    if row is None:
        raise RuntimeError("Recording insert did not return a row.")

    return MeetingRecording.model_validate(row)


async def list_meeting_recordings(
    *,
    settings: Settings,
    meeting_id: str,
) -> Sequence[MeetingRecording]:
    query = """
    SELECT
        id,
        meeting_id,
        egress_id,
        status,
        storage_provider,
        bucket,
        object_key,
        file_type,
        started_at,
        ended_at,
        duration_seconds,
        size_bytes,
        location,
        error,
        created_at,
        updated_at
    FROM meeting_recordings
    WHERE meeting_id = %s
    ORDER BY created_at DESC, id DESC;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (meeting_id,))
            rows = await cur.fetchall()

    return [MeetingRecording.model_validate(row) for row in rows]


async def list_recent_recordings(
    *,
    settings: Settings,
    limit: int = 50,
) -> Sequence[MeetingRecording]:
    query = """
    SELECT
        id,
        meeting_id,
        egress_id,
        status,
        storage_provider,
        bucket,
        object_key,
        file_type,
        started_at,
        ended_at,
        duration_seconds,
        size_bytes,
        location,
        error,
        created_at,
        updated_at
    FROM meeting_recordings
    ORDER BY created_at DESC, id DESC
    LIMIT %s;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (limit,))
            rows = await cur.fetchall()

    return [MeetingRecording.model_validate(row) for row in rows]


async def get_active_meeting_recording(
    *,
    settings: Settings,
    meeting_id: str,
) -> MeetingRecording | None:
    query = """
    SELECT
        id,
        meeting_id,
        egress_id,
        status,
        storage_provider,
        bucket,
        object_key,
        file_type,
        started_at,
        ended_at,
        duration_seconds,
        size_bytes,
        location,
        error,
        created_at,
        updated_at
    FROM meeting_recordings
    WHERE meeting_id = %s
      AND status IN ('EGRESS_STARTING', 'EGRESS_ACTIVE', 'STARTING', 'ACTIVE')
    ORDER BY created_at DESC, id DESC
    LIMIT 1;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (meeting_id,))
            row = await cur.fetchone()

    return MeetingRecording.model_validate(row) if row else None


async def update_meeting_recording(
    *,
    settings: Settings,
    egress_id: str,
    status: str,
    started_at,
    ended_at,
    duration_seconds: float | None = None,
    size_bytes: int | None = None,
    location: str | None = None,
    error: str | None = None,
) -> MeetingRecording | None:
    query = """
    UPDATE meeting_recordings
    SET
        status = %s,
        started_at = COALESCE(%s, started_at),
        ended_at = COALESCE(%s, ended_at),
        duration_seconds = COALESCE(%s, duration_seconds),
        size_bytes = COALESCE(%s, size_bytes),
        location = COALESCE(%s, location),
        error = COALESCE(%s, error),
        updated_at = now()
    WHERE egress_id = %s
    RETURNING
        id,
        meeting_id,
        egress_id,
        status,
        storage_provider,
        bucket,
        object_key,
        file_type,
        started_at,
        ended_at,
        duration_seconds,
        size_bytes,
        location,
        error,
        created_at,
        updated_at;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                query,
                (
                    status,
                    started_at,
                    ended_at,
                    duration_seconds,
                    size_bytes,
                    location,
                    error,
                    egress_id,
                ),
            )
            row = await cur.fetchone()

            if row and row["location"]:
                await cur.execute(
                    "UPDATE meetings SET recording_url = %s WHERE id = %s;",
                    (row["location"], row["meeting_id"]),
                )

    return MeetingRecording.model_validate(row) if row else None


async def upsert_conversation_session(
    *,
    settings: Settings,
    session_id: str,
    organization_id: str,
    agent_id: str,
    channel: str,
    user_id: str,
    user_name: str,
    user_email: str | None,
    title: str,
    context_scope: dict,
) -> ConversationSession:
    query = """
    INSERT INTO conversation_sessions (
        id,
        organization_id,
        agent_id,
        channel,
        user_id,
        user_name,
        user_email,
        title,
        context_scope
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
    ON CONFLICT (id) DO UPDATE
    SET
        organization_id = EXCLUDED.organization_id,
        agent_id = EXCLUDED.agent_id,
        channel = EXCLUDED.channel,
        user_id = EXCLUDED.user_id,
        user_name = EXCLUDED.user_name,
        user_email = EXCLUDED.user_email,
        context_scope = EXCLUDED.context_scope,
        updated_at = now()
    RETURNING
        id,
        organization_id,
        agent_id,
        channel,
        user_id,
        user_name,
        user_email,
        title,
        context_scope,
        created_at,
        updated_at;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                query,
                (
                    session_id,
                    organization_id,
                    agent_id,
                    channel,
                    user_id,
                    user_name,
                    user_email,
                    title,
                    json.dumps(context_scope),
                ),
            )
            row = await cur.fetchone()

    if row is None:
        raise RuntimeError("Conversation session upsert did not return a row.")

    return ConversationSession.model_validate(row)


async def touch_conversation_session(
    *,
    settings: Settings,
    session_id: str,
) -> None:
    query = "UPDATE conversation_sessions SET updated_at = now() WHERE id = %s;"
    async with await psycopg.AsyncConnection.connect(settings.database_url) as conn:
        await conn.execute(query, (session_id,))


async def list_conversation_sessions(
    *,
    settings: Settings,
    organization_id: str = "default",
    user_id: str | None = None,
    limit: int = 30,
) -> Sequence[ConversationSession]:
    filters = ["organization_id = %s"]
    params: list[object] = [organization_id]
    if user_id:
        filters.append("user_id = %s")
        params.append(user_id)

    query = f"""
    SELECT
        id,
        organization_id,
        agent_id,
        channel,
        user_id,
        user_name,
        user_email,
        title,
        context_scope,
        created_at,
        updated_at
    FROM conversation_sessions
    WHERE {" AND ".join(filters)}
    ORDER BY updated_at DESC
    LIMIT %s;
    """
    params.append(limit)

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, params)
            rows = await cur.fetchall()

    return [ConversationSession.model_validate(row) for row in rows]


async def get_conversation_session(
    *,
    settings: Settings,
    session_id: str,
) -> ConversationSession | None:
    query = """
    SELECT
        id,
        organization_id,
        agent_id,
        channel,
        user_id,
        user_name,
        user_email,
        title,
        context_scope,
        created_at,
        updated_at
    FROM conversation_sessions
    WHERE id = %s;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (session_id,))
            row = await cur.fetchone()

    return ConversationSession.model_validate(row) if row else None


async def insert_conversation_message(
    *,
    settings: Settings,
    session_id: str,
    role: str,
    content: str,
    metadata: dict | None = None,
) -> ConversationMessage:
    query = """
    INSERT INTO conversation_messages (session_id, role, content, metadata)
    VALUES (%s, %s, %s, %s::jsonb)
    RETURNING id, session_id, role, content, metadata, created_at;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                query,
                (
                    session_id,
                    role,
                    content,
                    json.dumps(metadata or {}),
                ),
            )
            row = await cur.fetchone()

    if row is None:
        raise RuntimeError("Conversation message insert did not return a row.")

    await touch_conversation_session(settings=settings, session_id=session_id)
    return ConversationMessage.model_validate(row)


async def list_conversation_messages(
    *,
    settings: Settings,
    session_id: str,
    limit: int = 100,
) -> Sequence[ConversationMessage]:
    query = """
    SELECT id, session_id, role, content, metadata, created_at
    FROM conversation_messages
    WHERE session_id = %s
    ORDER BY created_at ASC, id ASC
    LIMIT %s;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (session_id, limit))
            rows = await cur.fetchall()

    return [ConversationMessage.model_validate(row) for row in rows]


async def mark_meeting_copilot_dispatched(
    *,
    settings: Settings,
    meeting_id: str,
) -> None:
    query = """
    UPDATE meetings
    SET copilot_dispatched = TRUE
    WHERE id = %s;
    """

    async with await psycopg.AsyncConnection.connect(settings.database_url) as conn:
        await conn.execute(query, (meeting_id,))


async def mark_meeting_ended(*, settings: Settings, meeting_id: str) -> Meeting:
    query = """
    UPDATE meetings
    SET ended_at = COALESCE(ended_at, now())
    WHERE id = %s
    RETURNING id, title, created_at, started_at, ended_at, recording_url, copilot_dispatched;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (meeting_id,))
            row = await cur.fetchone()

    if row is None:
        return await ensure_meeting(settings=settings, meeting_id=meeting_id)

    return Meeting.model_validate(row)


async def upsert_meeting_processing_job(
    *,
    settings: Settings,
    meeting_id: str,
    job_type: str = "memory",
    max_attempts: int = 3,
    force: bool = False,
) -> MeetingProcessingJob:
    status_filter = "" if force else "WHERE meeting_processing_jobs.status != 'completed'"
    query = f"""
    INSERT INTO meeting_processing_jobs (meeting_id, job_type, max_attempts)
    VALUES (%s, %s, %s)
    ON CONFLICT (meeting_id, job_type)
    DO UPDATE SET
        status = 'pending',
        attempts = CASE
            WHEN %s THEN 0
            ELSE meeting_processing_jobs.attempts
        END,
        max_attempts = EXCLUDED.max_attempts,
        locked_at = NULL,
        started_at = CASE
            WHEN %s THEN NULL
            ELSE meeting_processing_jobs.started_at
        END,
        finished_at = NULL,
        error = NULL,
        result = CASE
            WHEN %s THEN '{{}}'::jsonb
            ELSE meeting_processing_jobs.result
        END,
        updated_at = now()
    {status_filter}
    RETURNING
        id,
        meeting_id,
        job_type,
        status,
        attempts,
        max_attempts,
        locked_at,
        started_at,
        finished_at,
        error,
        result,
        created_at,
        updated_at;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                query,
                (meeting_id, job_type, max_attempts, force, force, force),
            )
            row = await cur.fetchone()

    if row is not None:
        return MeetingProcessingJob.model_validate(row)

    existing = await get_meeting_processing_job(
        settings=settings,
        meeting_id=meeting_id,
        job_type=job_type,
    )
    if existing is None:
        raise RuntimeError("Processing job upsert did not return a row.")
    return existing


async def get_meeting_processing_job(
    *,
    settings: Settings,
    meeting_id: str,
    job_type: str = "memory",
) -> MeetingProcessingJob | None:
    query = """
    SELECT
        id,
        meeting_id,
        job_type,
        status,
        attempts,
        max_attempts,
        locked_at,
        started_at,
        finished_at,
        error,
        result,
        created_at,
        updated_at
    FROM meeting_processing_jobs
    WHERE meeting_id = %s AND job_type = %s
    LIMIT 1;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (meeting_id, job_type))
            row = await cur.fetchone()

    return MeetingProcessingJob.model_validate(row) if row else None


async def list_meeting_processing_jobs(
    *,
    settings: Settings,
    meeting_id: str,
) -> Sequence[MeetingProcessingJob]:
    query = """
    SELECT
        id,
        meeting_id,
        job_type,
        status,
        attempts,
        max_attempts,
        locked_at,
        started_at,
        finished_at,
        error,
        result,
        created_at,
        updated_at
    FROM meeting_processing_jobs
    WHERE meeting_id = %s
    ORDER BY created_at DESC, id DESC;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (meeting_id,))
            rows = await cur.fetchall()

    return [MeetingProcessingJob.model_validate(row) for row in rows]


async def claim_meeting_processing_job(
    *,
    settings: Settings,
    job_id: int,
    stale_after_minutes: int = 15,
) -> MeetingProcessingJob | None:
    query = """
    UPDATE meeting_processing_jobs
    SET
        status = 'running',
        attempts = attempts + 1,
        locked_at = now(),
        started_at = COALESCE(started_at, now()),
        finished_at = NULL,
        error = NULL,
        updated_at = now()
    WHERE id = %s
      AND attempts < max_attempts
      AND (
        status = 'pending'
        OR (
            status = 'failed'
            AND attempts < max_attempts
        )
        OR (
            status = 'running'
            AND locked_at < now() - (%s || ' minutes')::interval
        )
      )
    RETURNING
        id,
        meeting_id,
        job_type,
        status,
        attempts,
        max_attempts,
        locked_at,
        started_at,
        finished_at,
        error,
        result,
        created_at,
        updated_at;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (job_id, stale_after_minutes))
            row = await cur.fetchone()

    return MeetingProcessingJob.model_validate(row) if row else None


async def list_due_meeting_processing_jobs(
    *,
    settings: Settings,
    limit: int = 10,
    stale_after_minutes: int = 15,
) -> Sequence[MeetingProcessingJob]:
    query = """
    SELECT
        id,
        meeting_id,
        job_type,
        status,
        attempts,
        max_attempts,
        locked_at,
        started_at,
        finished_at,
        error,
        result,
        created_at,
        updated_at
    FROM meeting_processing_jobs
    WHERE attempts < max_attempts
      AND (
        status = 'pending'
        OR status = 'failed'
        OR (
            status = 'running'
            AND locked_at < now() - (%s || ' minutes')::interval
        )
      )
    ORDER BY created_at ASC, id ASC
    LIMIT %s;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (stale_after_minutes, limit))
            rows = await cur.fetchall()

    return [MeetingProcessingJob.model_validate(row) for row in rows]


async def mark_meeting_processing_job_completed(
    *,
    settings: Settings,
    job_id: int,
    result: dict,
) -> MeetingProcessingJob:
    query = """
    UPDATE meeting_processing_jobs
    SET
        status = 'completed',
        locked_at = NULL,
        finished_at = now(),
        error = NULL,
        result = %s::jsonb,
        updated_at = now()
    WHERE id = %s
    RETURNING
        id,
        meeting_id,
        job_type,
        status,
        attempts,
        max_attempts,
        locked_at,
        started_at,
        finished_at,
        error,
        result,
        created_at,
        updated_at;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (json.dumps(result), job_id))
            row = await cur.fetchone()

    if row is None:
        raise RuntimeError("Completed processing job was not found.")
    return MeetingProcessingJob.model_validate(row)


async def mark_meeting_processing_job_failed(
    *,
    settings: Settings,
    job_id: int,
    error: str,
) -> MeetingProcessingJob:
    query = """
    UPDATE meeting_processing_jobs
    SET
        status = 'failed',
        locked_at = NULL,
        finished_at = now(),
        error = %s,
        updated_at = now()
    WHERE id = %s
    RETURNING
        id,
        meeting_id,
        job_type,
        status,
        attempts,
        max_attempts,
        locked_at,
        started_at,
        finished_at,
        error,
        result,
        created_at,
        updated_at;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (error[:2000], job_id))
            row = await cur.fetchone()

    if row is None:
        raise RuntimeError("Failed processing job was not found.")
    return MeetingProcessingJob.model_validate(row)


async def insert_whatsapp_group_message(
    *,
    settings: Settings,
    group_id: str,
    group_name: str | None,
    sender_phone: str,
    sender_name: str,
    message_type: str,
    content: str,
    message_id: str | None,
) -> WhatsAppGroupMessage | None:
    query = """
    INSERT INTO whatsapp_group_messages (
        group_id,
        group_name,
        sender_phone,
        sender_name,
        message_type,
        content,
        message_id
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT (message_id) WHERE message_id IS NOT NULL DO NOTHING
    RETURNING
        id,
        group_id,
        group_name,
        sender_phone,
        sender_name,
        message_type,
        content,
        message_id,
        created_at;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                query,
                (
                    group_id,
                    group_name,
                    sender_phone,
                    sender_name,
                    message_type,
                    content,
                    message_id,
                ),
            )
            row = await cur.fetchone()

    return WhatsAppGroupMessage.model_validate(row) if row else None


async def list_recent_whatsapp_group_messages(
    *,
    settings: Settings,
    group_id: str,
    limit: int = 80,
) -> Sequence[WhatsAppGroupMessage]:
    query = """
    SELECT
        id,
        group_id,
        group_name,
        sender_phone,
        sender_name,
        message_type,
        content,
        message_id,
        created_at
    FROM whatsapp_group_messages
    WHERE group_id = %s
    ORDER BY created_at DESC, id DESC
    LIMIT %s;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (group_id, limit))
            rows = await cur.fetchall()

    return [WhatsAppGroupMessage.model_validate(row) for row in reversed(rows)]


async def insert_whatsapp_webhook_event(
    *,
    settings: Settings,
    event_type: str,
    status: str,
    phone: str | None = None,
    is_group: bool = False,
    group_id: str | None = None,
    message_id: str | None = None,
    detail: str | None = None,
) -> WhatsAppWebhookEvent:
    query = """
    INSERT INTO whatsapp_webhook_events (
        event_type,
        status,
        phone,
        is_group,
        group_id,
        message_id,
        detail
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s)
    RETURNING
        id,
        event_type,
        status,
        phone,
        is_group,
        group_id,
        message_id,
        detail,
        created_at;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                query,
                (
                    event_type,
                    status,
                    phone,
                    is_group,
                    group_id,
                    message_id,
                    detail[:500] if detail else None,
                ),
            )
            row = await cur.fetchone()

    if row is None:
        raise RuntimeError("WhatsApp webhook event insert did not return a row.")
    return WhatsAppWebhookEvent.model_validate(row)


async def list_whatsapp_webhook_events(
    *,
    settings: Settings,
    limit: int = 30,
) -> Sequence[WhatsAppWebhookEvent]:
    query = """
    SELECT
        id,
        event_type,
        status,
        phone,
        is_group,
        group_id,
        message_id,
        detail,
        created_at
    FROM whatsapp_webhook_events
    ORDER BY created_at DESC, id DESC
    LIMIT %s;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (limit,))
            rows = await cur.fetchall()

    return [WhatsAppWebhookEvent.model_validate(row) for row in rows]


async def register_meeting_participant(
    *,
    settings: Settings,
    meeting_id: str,
    identity: str,
    name: str,
    email: str,
    role: str,
) -> None:
    async with await psycopg.AsyncConnection.connect(settings.database_url) as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO meeting_participants (meeting_id, identity, name, email, role)
                VALUES (%s, %s, %s, %s, %s);
                """,
                (meeting_id, identity, name, email, role),
            )

            if role in ("host", "commercial"):
                await cur.execute(
                    """
                    UPDATE meetings
                    SET started_at = COALESCE(started_at, now())
                    WHERE id = %s;
                    """,
                    (meeting_id,),
                )


async def has_host_or_commercial_joined(
    *,
    settings: Settings,
    meeting_id: str,
) -> bool:
    query = """
    SELECT EXISTS (
        SELECT 1
        FROM meeting_participants
        WHERE meeting_id = %s
          AND role IN ('host', 'commercial')
    ) AS has_joined;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (meeting_id,))
            row = await cur.fetchone()

    return bool(row and row["has_joined"])


async def upsert_meeting_join_request(
    *,
    settings: Settings,
    meeting_id: str,
    name: str,
    email: str,
    role: str,
) -> MeetingJoinRequest:
    query = """
    INSERT INTO meeting_join_requests (meeting_id, name, email, role)
    VALUES (%s, %s, lower(%s), %s)
    ON CONFLICT (meeting_id, lower(email))
    DO UPDATE SET
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        status = CASE
            WHEN meeting_join_requests.status = 'denied' THEN 'pending'
            ELSE meeting_join_requests.status
        END,
        updated_at = now()
    RETURNING id, meeting_id, name, email, role, status, created_at, updated_at;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (meeting_id, name, email, role))
            row = await cur.fetchone()

    if row is None:
        raise RuntimeError("Join request upsert did not return a row.")
    return MeetingJoinRequest.model_validate(row)


async def get_meeting_join_request_by_email(
    *,
    settings: Settings,
    meeting_id: str,
    email: str,
) -> MeetingJoinRequest | None:
    query = """
    SELECT id, meeting_id, name, email, role, status, created_at, updated_at
    FROM meeting_join_requests
    WHERE meeting_id = %s AND lower(email) = lower(%s)
    LIMIT 1;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (meeting_id, email))
            row = await cur.fetchone()

    return MeetingJoinRequest.model_validate(row) if row else None


async def list_meeting_join_requests(
    *,
    settings: Settings,
    meeting_id: str,
    status: str | None = None,
) -> Sequence[MeetingJoinRequest]:
    status_filter = "AND status = %s" if status else ""
    query = f"""
    SELECT id, meeting_id, name, email, role, status, created_at, updated_at
    FROM meeting_join_requests
    WHERE meeting_id = %s
    {status_filter}
    ORDER BY created_at ASC, id ASC;
    """
    params: tuple[object, ...] = (meeting_id, status) if status else (meeting_id,)

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, params)
            rows = await cur.fetchall()

    return [MeetingJoinRequest.model_validate(row) for row in rows]


async def update_meeting_join_request_status(
    *,
    settings: Settings,
    meeting_id: str,
    request_id: int,
    status: str,
) -> MeetingJoinRequest | None:
    query = """
    UPDATE meeting_join_requests
    SET status = %s, updated_at = now()
    WHERE meeting_id = %s AND id = %s
    RETURNING id, meeting_id, name, email, role, status, created_at, updated_at;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (status, meeting_id, request_id))
            row = await cur.fetchone()

    return MeetingJoinRequest.model_validate(row) if row else None


async def get_meeting_participant_by_identity(
    *,
    settings: Settings,
    meeting_id: str,
    identity: str,
) -> MeetingParticipant | None:
    query = """
    SELECT id, meeting_id, identity, name, email, role, joined_at
    FROM meeting_participants
    WHERE meeting_id = %s
      AND identity = %s
    ORDER BY joined_at DESC, id DESC
    LIMIT 1;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (meeting_id, identity))
            row = await cur.fetchone()

    if row is None:
        return None

    return MeetingParticipant.model_validate(row)


async def list_meeting_participants(
    *,
    settings: Settings,
    meeting_id: str,
) -> Sequence[MeetingParticipant]:
    query = """
    SELECT id, meeting_id, identity, name, email, role, joined_at
    FROM meeting_participants
    WHERE meeting_id = %s
    ORDER BY joined_at ASC, id ASC;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (meeting_id,))
            rows = await cur.fetchall()

    return [MeetingParticipant.model_validate(row) for row in rows]


async def insert_meeting_agent_action(
    *,
    settings: Settings,
    meeting_id: str,
    requester_identity: str,
    requester_name: str,
    action_type: str,
    status: str,
    payload: dict,
    result: dict | None = None,
) -> None:
    query = """
    INSERT INTO meeting_agent_actions (
        meeting_id,
        requester_identity,
        requester_name,
        action_type,
        status,
        payload,
        result
    )
    VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s::jsonb);
    """

    async with await psycopg.AsyncConnection.connect(settings.database_url) as conn:
        await conn.execute(
            query,
            (
                meeting_id,
                requester_identity,
                requester_name,
                action_type,
                status,
                json.dumps(payload),
                json.dumps(result) if result is not None else None,
            ),
        )


async def list_meeting_agent_actions(
    *,
    settings: Settings,
    meeting_id: str,
    limit: int = 20,
) -> list[dict]:
    query = """
    SELECT
        id,
        requester_identity,
        requester_name,
        action_type,
        status,
        payload,
        result,
        created_at
    FROM meeting_agent_actions
    WHERE meeting_id = %s
    ORDER BY created_at DESC, id DESC
    LIMIT %s;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (meeting_id, limit))
            rows = await cur.fetchall()

    return [dict(row) for row in rows]


async def insert_meeting_pending_email(
    *,
    settings: Settings,
    meeting_id: str,
    requester_identity: str,
    requester_name: str,
    payload: dict,
) -> int:
    query = """
    INSERT INTO meeting_pending_emails (
        meeting_id,
        requester_identity,
        requester_name,
        payload
    )
    VALUES (%s, %s, %s, %s::jsonb)
    RETURNING id;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                query,
                (
                    meeting_id,
                    requester_identity,
                    requester_name,
                    json.dumps(payload),
                ),
            )
            row = await cur.fetchone()

    if row is None:
        raise RuntimeError("Pending email insert did not return an id.")

    return int(row["id"])


async def list_pending_meeting_emails(
    *,
    settings: Settings,
    meeting_id: str,
) -> list[dict]:
    query = """
    SELECT id, requester_identity, requester_name, payload
    FROM meeting_pending_emails
    WHERE meeting_id = %s AND status = 'pending'
    ORDER BY created_at ASC, id ASC;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (meeting_id,))
            rows = await cur.fetchall()

    return [dict(row) for row in rows]


async def mark_pending_meeting_email(
    *,
    settings: Settings,
    pending_email_id: int,
    status: str,
    result: dict | None = None,
) -> None:
    query = """
    UPDATE meeting_pending_emails
    SET status = %s,
        result = %s::jsonb,
        sent_at = CASE WHEN %s = 'sent' THEN now() ELSE sent_at END
    WHERE id = %s;
    """

    async with await psycopg.AsyncConnection.connect(settings.database_url) as conn:
        await conn.execute(
            query,
            (
                status,
                json.dumps(result) if result is not None else None,
                status,
                pending_email_id,
            ),
        )


async def get_google_calendar_connection(*, settings: Settings) -> dict | None:
    query = """
    SELECT access_token, refresh_token, expires_at, calendar_email, scope, updated_at
    FROM google_calendar_connection
    WHERE id = 'default';
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query)
            row = await cur.fetchone()

    return dict(row) if row else None


async def upsert_google_calendar_connection(
    *,
    settings: Settings,
    access_token: str,
    refresh_token: str | None,
    expires_at,
    calendar_email: str | None,
    scope: str | None,
) -> dict:
    query = """
    INSERT INTO google_calendar_connection (
        id,
        access_token,
        refresh_token,
        expires_at,
        calendar_email,
        scope,
        updated_at
    )
    VALUES ('default', %s, %s, %s, %s, %s, now())
    ON CONFLICT (id) DO UPDATE
    SET access_token = EXCLUDED.access_token,
        refresh_token = COALESCE(EXCLUDED.refresh_token, google_calendar_connection.refresh_token),
        expires_at = EXCLUDED.expires_at,
        calendar_email = COALESCE(EXCLUDED.calendar_email, google_calendar_connection.calendar_email),
        scope = COALESCE(EXCLUDED.scope, google_calendar_connection.scope),
        updated_at = now()
    RETURNING access_token, refresh_token, expires_at, calendar_email, scope, updated_at;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                query,
                (access_token, refresh_token, expires_at, calendar_email, scope),
            )
            row = await cur.fetchone()

    if row is None:
        raise RuntimeError("Google Calendar connection upsert did not return a row.")

    return dict(row)


async def insert_transcript_segment(
    *,
    settings: Settings,
    meeting_id: str,
    segment: TranscriptSegmentCreate,
) -> TranscriptSegment:
    query = """
    INSERT INTO transcript_segments (
        meeting_id,
        speaker_name,
        timestamp_seconds,
        content
    )
    VALUES (%s, %s, %s, %s)
    RETURNING id, meeting_id, speaker_name, timestamp_seconds, content, created_at;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                query,
                (
                    meeting_id,
                    segment.speaker_name,
                    segment.timestamp_seconds,
                    segment.content,
                ),
            )
            row = await cur.fetchone()

    if row is None:
        raise RuntimeError("Transcript segment insert did not return a row.")

    return TranscriptSegment.model_validate(row)


async def list_transcript_segments(
    *,
    settings: Settings,
    meeting_id: str,
) -> Sequence[TranscriptSegment]:
    query = """
    SELECT id, meeting_id, speaker_name, timestamp_seconds, content, created_at
    FROM transcript_segments
    WHERE meeting_id = %s
    ORDER BY timestamp_seconds ASC, id ASC;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (meeting_id,))
            rows = await cur.fetchall()

    return [TranscriptSegment.model_validate(row) for row in rows]


async def insert_sales_recommendations(
    *,
    settings: Settings,
    meeting_id: str,
    transcript_segment_id: int,
    drafts: Sequence[RecommendationDraft],
) -> Sequence[SalesRecommendation]:
    if not drafts:
        return []

    query = """
    INSERT INTO sales_recommendations (
        meeting_id,
        transcript_segment_id,
        kind,
        severity,
        title,
        recommendation,
        evidence
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s)
    RETURNING
        id,
        meeting_id,
        transcript_segment_id,
        kind,
        severity,
        title,
        recommendation,
        evidence,
        created_at;
    """

    inserted: list[SalesRecommendation] = []

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            for draft in drafts:
                await cur.execute(
                    query,
                    (
                        meeting_id,
                        transcript_segment_id,
                        draft.kind,
                        draft.severity,
                        draft.title,
                        draft.recommendation,
                        draft.evidence,
                    ),
                )
                row = await cur.fetchone()
                if row is not None:
                    inserted.append(SalesRecommendation.model_validate(row))

    return inserted


async def list_sales_recommendations(
    *,
    settings: Settings,
    meeting_id: str,
) -> Sequence[SalesRecommendation]:
    query = """
    SELECT
        id,
        meeting_id,
        transcript_segment_id,
        kind,
        severity,
        title,
        recommendation,
        evidence,
        created_at
    FROM sales_recommendations
    WHERE meeting_id = %s
    ORDER BY created_at ASC, id ASC;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (meeting_id,))
            rows = await cur.fetchall()

    return [SalesRecommendation.model_validate(row) for row in rows]


def vector_literal(values: Sequence[float]) -> str:
    return "[" + ",".join(f"{value:.8f}" for value in values) + "]"


async def insert_knowledge_document(
    *,
    settings: Settings,
    meeting_id: str | None,
    filename: str,
    content_type: str,
    size_bytes: int,
) -> KnowledgeDocument:
    query = """
    INSERT INTO knowledge_documents (meeting_id, filename, content_type, size_bytes)
    VALUES (%s, %s, %s, %s)
    RETURNING id, filename, content_type, size_bytes, chunk_count, created_at;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (meeting_id, filename, content_type, size_bytes))
            row = await cur.fetchone()

    if row is None:
        raise RuntimeError("Knowledge document insert did not return a row.")

    return KnowledgeDocument.model_validate(row)


async def insert_knowledge_chunks(
    *,
    settings: Settings,
    document_id: int,
    chunks: Sequence[str],
    embeddings: Sequence[Sequence[float]],
) -> None:
    insert_query = """
    INSERT INTO knowledge_chunks (document_id, chunk_index, content, embedding)
    VALUES (%s, %s, %s, %s::vector);
    """
    update_query = """
    UPDATE knowledge_documents
    SET chunk_count = %s
    WHERE id = %s;
    """

    async with await psycopg.AsyncConnection.connect(settings.database_url) as conn:
        async with conn.cursor() as cur:
            for index, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                await cur.execute(
                    insert_query,
                    (document_id, index, chunk, vector_literal(embedding)),
                )
            await cur.execute(update_query, (len(chunks), document_id))


async def get_knowledge_document(
    *,
    settings: Settings,
    document_id: int,
) -> KnowledgeDocument:
    query = """
    SELECT id, filename, content_type, size_bytes, chunk_count, created_at
    FROM knowledge_documents
    WHERE id = %s;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (document_id,))
            row = await cur.fetchone()

    if row is None:
        raise RuntimeError("Knowledge document was not found after ingest.")

    return KnowledgeDocument.model_validate(row)


async def search_knowledge_chunks(
    *,
    settings: Settings,
    query_embedding: Sequence[float],
    top_k: int,
    meeting_id: str | None = None,
) -> Sequence[KnowledgeSearchResult]:
    meeting_filter = (
        "WHERE kd.meeting_id = %s OR kd.meeting_id IS NULL"
        if meeting_id
        else "WHERE kd.meeting_id IS NULL"
    )
    query = f"""
    SELECT
        kc.id AS chunk_id,
        kc.document_id,
        kd.filename,
        kc.chunk_index,
        kc.content,
        1 - (kc.embedding <=> %s::vector) AS score
    FROM knowledge_chunks kc
    JOIN knowledge_documents kd ON kd.id = kc.document_id
    {meeting_filter}
    ORDER BY kc.embedding <=> %s::vector
    LIMIT %s;
    """
    embedding = vector_literal(query_embedding)
    params = (
        (embedding, meeting_id, embedding, top_k)
        if meeting_id
        else (embedding, embedding, top_k)
    )

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, params)
            rows = await cur.fetchall()

    return [KnowledgeSearchResult.model_validate(row) for row in rows]


async def delete_meeting_memory_items(
    *,
    settings: Settings,
    meeting_id: str,
) -> None:
    query = "DELETE FROM meeting_memory_items WHERE meeting_id = %s;"

    async with await psycopg.AsyncConnection.connect(settings.database_url) as conn:
        await conn.execute(query, (meeting_id,))


async def insert_meeting_memory_items(
    *,
    settings: Settings,
    items: Sequence[dict],
    embeddings: Sequence[Sequence[float]],
) -> Sequence[MeetingMemoryItem]:
    if not items:
        return []

    query = """
    INSERT INTO meeting_memory_items (
        organization_id,
        agent_id,
        meeting_id,
        memory_type,
        content,
        metadata,
        visibility,
        allowed_user_ids,
        allowed_role_ids,
        sensitivity_level,
        embedding
    )
    VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s, %s::jsonb, %s::jsonb, %s, %s::vector)
    RETURNING
        id,
        organization_id,
        agent_id,
        meeting_id,
        memory_type,
        content,
        metadata,
        visibility,
        allowed_user_ids,
        allowed_role_ids,
        sensitivity_level,
        created_at;
    """
    inserted: list[MeetingMemoryItem] = []

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            for item, embedding in zip(items, embeddings):
                await cur.execute(
                    query,
                    (
                        item.get("organization_id", "default"),
                        item.get("agent_id", "coevo"),
                        item["meeting_id"],
                        item["memory_type"],
                        item["content"],
                        json.dumps(item.get("metadata", {})),
                        item.get("visibility", "participants"),
                        json.dumps(item.get("allowed_user_ids", [])),
                        json.dumps(item.get("allowed_role_ids", [])),
                        item.get("sensitivity_level", "medium"),
                        vector_literal(embedding),
                    ),
                )
                row = await cur.fetchone()
                if row is not None:
                    inserted.append(MeetingMemoryItem.model_validate(row))

    return inserted


async def list_meeting_memory_items(
    *,
    settings: Settings,
    meeting_id: str,
) -> Sequence[MeetingMemoryItem]:
    query = """
    SELECT
        id,
        organization_id,
        agent_id,
        meeting_id,
        memory_type,
        content,
        metadata,
        visibility,
        allowed_user_ids,
        allowed_role_ids,
        sensitivity_level,
        created_at
    FROM meeting_memory_items
    WHERE meeting_id = %s
    ORDER BY id ASC;
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (meeting_id,))
            rows = await cur.fetchall()

    return [MeetingMemoryItem.model_validate(row) for row in rows]


async def search_meeting_memory_items(
    *,
    settings: Settings,
    query_embedding: Sequence[float],
    top_k: int,
    organization_id: str,
    requester_email: str | None,
    requester_role: str | None,
    meeting_id: str | None = None,
    customer: str | None = None,
) -> Sequence[MeetingMemorySearchResult]:
    filters = ["mmi.organization_id = %s"]
    params: list[object] = [organization_id]

    if meeting_id:
        filters.append("mmi.meeting_id = %s")
        params.append(meeting_id)

    if customer:
        filters.append(
            "(mmi.metadata->>'customer' ILIKE %s OR mmi.content ILIKE %s)"
        )
        params.extend((f"%{customer}%", f"%{customer}%"))

    acl_filter = """
    (
        mmi.visibility = 'organization'
        OR %s = ANY (
            SELECT jsonb_array_elements_text(mmi.allowed_role_ids)
        )
        OR %s = ANY (
            SELECT jsonb_array_elements_text(mmi.allowed_user_ids)
        )
    )
    """
    filters.append(acl_filter)
    params.extend((requester_role or "", requester_email or ""))

    embedding = vector_literal(query_embedding)
    where_clause = " AND ".join(filters)
    query = f"""
    SELECT
        mmi.id,
        mmi.meeting_id,
        m.title AS meeting_title,
        mmi.memory_type,
        mmi.content,
        mmi.metadata,
        mmi.sensitivity_level,
        1 - (mmi.embedding <=> %s::vector) AS score,
        mmi.created_at
    FROM meeting_memory_items mmi
    JOIN meetings m ON m.id = mmi.meeting_id
    WHERE {where_clause}
    ORDER BY mmi.embedding <=> %s::vector
    LIMIT %s;
    """
    query_params = [embedding, *params, embedding, top_k]

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, query_params)
            rows = await cur.fetchall()

    return [MeetingMemorySearchResult.model_validate(row) for row in rows]


async def get_agent_profile(*, settings: Settings) -> AgentProfile:
    query = """
    SELECT config, updated_at
    FROM agent_profile
    WHERE id = 'default';
    """

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query)
            row = await cur.fetchone()

    defaults = AgentProfile()
    if row is None:
        return defaults

    profile = AgentProfile.model_validate(row["config"])
    if set(profile.enabled_actions) == {"send_email"}:
        profile.enabled_actions = defaults.enabled_actions
    if set(profile.enabled_integrations) == {"resend_email"}:
        profile.enabled_integrations = defaults.enabled_integrations
    profile.updated_at = row["updated_at"]
    return profile


async def upsert_agent_profile(
    *,
    settings: Settings,
    profile: AgentProfile,
) -> AgentProfile:
    query = """
    INSERT INTO agent_profile (id, config, updated_at)
    VALUES ('default', %s::jsonb, now())
    ON CONFLICT (id) DO UPDATE
    SET config = EXCLUDED.config,
        updated_at = now()
    RETURNING config, updated_at;
    """

    payload = profile.model_dump(mode="json", exclude={"updated_at"})

    async with await psycopg.AsyncConnection.connect(
        settings.database_url,
        row_factory=dict_row,
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, (json.dumps(payload),))
            row = await cur.fetchone()

    if row is None:
        raise RuntimeError("Agent profile upsert did not return a row.")

    saved = AgentProfile.model_validate(row["config"])
    saved.updated_at = row["updated_at"]
    return saved
