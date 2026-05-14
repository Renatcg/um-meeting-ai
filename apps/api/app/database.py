import json
from collections.abc import Sequence

import psycopg
from psycopg.rows import dict_row

from app.config import Settings
from app.models import (
    AgentProfile,
    KnowledgeDocument,
    KnowledgeSearchResult,
    Meeting,
    SalesRecommendation,
    TranscriptSegment,
    TranscriptSegmentCreate,
    TrialRequest,
    TrialRequestCreate,
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
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('host', 'commercial', 'client', 'observer')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

CREATE_MEETING_PARTICIPANTS_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting_joined
ON meeting_participants (meeting_id, joined_at, id);
"""

CREATE_AGENT_PROFILE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS agent_profile (
    id TEXT PRIMARY KEY,
    config JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

CREATE_TRIAL_REQUESTS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS trial_requests (
    id BIGSERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    corporate_email TEXT NOT NULL,
    company_name TEXT NOT NULL,
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

CREATE_TRIAL_REQUESTS_CREATED_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_trial_requests_created
ON trial_requests (created_at DESC, id DESC);
"""


async def init_database(settings: Settings) -> None:
    async with await psycopg.AsyncConnection.connect(settings.database_url) as conn:
        await conn.execute(CREATE_VECTOR_EXTENSION_SQL)
        await conn.execute(CREATE_MEETINGS_TABLE_SQL)
        await conn.execute(CREATE_MEETING_PARTICIPANTS_TABLE_SQL)
        await conn.execute(CREATE_MEETING_PARTICIPANTS_INDEX_SQL)
        await conn.execute(CREATE_AGENT_PROFILE_TABLE_SQL)
        await conn.execute(CREATE_TRIAL_REQUESTS_TABLE_SQL)
        await conn.execute(ALTER_TRIAL_REQUESTS_SELECTED_PLAN_SQL)
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
        lgpd_accepted,
        source,
        selected_plan
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s)
    RETURNING
        id,
        full_name,
        phone,
        corporate_email,
        company_name,
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


async def register_meeting_participant(
    *,
    settings: Settings,
    meeting_id: str,
    name: str,
    email: str,
    role: str,
) -> None:
    async with await psycopg.AsyncConnection.connect(settings.database_url) as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO meeting_participants (meeting_id, name, email, role)
                VALUES (%s, %s, %s, %s);
                """,
                (meeting_id, name, email, role),
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

    if row is None:
        return AgentProfile()

    profile = AgentProfile.model_validate(row["config"])
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
