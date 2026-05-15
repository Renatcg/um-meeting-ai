import json
import logging
from typing import Any

from fastapi import HTTPException, status
from openai import AsyncOpenAI, OpenAIError

from app.config import Settings
from app.database import (
    delete_meeting_memory_items,
    ensure_meeting,
    insert_meeting_memory_items,
    list_meeting_memory_items,
    list_meeting_participants,
    list_sales_recommendations,
    list_transcript_segments,
    search_meeting_memory_items,
)
from app.knowledge_service import embed_texts
from app.models import (
    MeetingMemoryItem,
    MeetingMemoryProcessResponse,
    MeetingMemorySearchRequest,
    MeetingMemorySearchResponse,
)

logger = logging.getLogger(__name__)

MEMORY_TYPES = {
    "transcript_chunk",
    "executive_summary",
    "decision",
    "next_step",
    "commercial_objection",
    "risk",
    "promise",
    "entity",
}


def chunk_transcript(lines: list[str], max_chars: int = 1600) -> list[str]:
    chunks: list[str] = []
    current: list[str] = []
    current_size = 0

    for line in lines:
        next_size = current_size + len(line) + 1
        if current and next_size > max_chars:
            chunks.append("\n".join(current))
            current = []
            current_size = 0

        current.append(line)
        current_size += len(line) + 1

    if current:
        chunks.append("\n".join(current))

    return chunks


def clean_text(value: Any, limit: int = 2600) -> str:
    if value is None:
        return ""
    return str(value).strip()[:limit]


def parse_json_object(value: str) -> dict[str, Any]:
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        start = value.find("{")
        end = value.rfind("}")
        if start < 0 or end < start:
            return {}
        try:
            parsed = json.loads(value[start : end + 1])
        except json.JSONDecodeError:
            return {}

    return parsed if isinstance(parsed, dict) else {}


def normalize_list(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def build_allowed_users(participants: list, roles: set[str] | None = None) -> list[str]:
    return sorted(
        {
            str(participant.email).lower()
            for participant in participants
            if roles is None or participant.role in roles
        }
    )


def base_memory_item(
    *,
    meeting_id: str,
    memory_type: str,
    content: str,
    allowed_users: list[str],
    metadata: dict[str, Any] | None = None,
    visibility: str = "participants",
    allowed_roles: list[str] | None = None,
    sensitivity_level: str = "medium",
) -> dict[str, Any]:
    return {
        "organization_id": "default",
        "agent_id": "coevo",
        "meeting_id": meeting_id,
        "memory_type": memory_type,
        "content": content,
        "metadata": metadata or {},
        "visibility": visibility,
        "allowed_user_ids": allowed_users,
        "allowed_role_ids": allowed_roles or ["host", "commercial", "client"],
        "sensitivity_level": sensitivity_level,
    }


async def extract_structured_memory(
    *,
    settings: Settings,
    meeting_title: str,
    transcript: str,
    participants: list,
    recommendations: list,
) -> dict[str, Any]:
    if not settings.openai_api_key:
        return {}

    participant_lines = "\n".join(
        f"- {participant.name} <{participant.email}> ({participant.role})"
        for participant in participants
    )
    recommendation_lines = "\n".join(
        f"- {item.kind}/{item.severity}: {item.title} | {item.evidence}"
        for item in recommendations
    )

    prompt = f"""
Voce transforma uma reuniao em memoria corporativa consultavel.
Responda apenas JSON valido, sem markdown.

Titulo da reuniao: {meeting_title}

Participantes:
{participant_lines or "Nao identificado."}

Cards comerciais detectados:
{recommendation_lines or "Nenhum card registrado."}

Transcricao:
{transcript[:24000]}

Retorne este formato:
{{
  "executive_summary": "resumo executivo objetivo",
  "decisions": [
    {{"content": "decisao tomada", "owner": "nome se houver", "customer": "cliente se houver"}}
  ],
  "next_steps": [
    {{"content": "proximo passo", "owner": "responsavel se houver", "due_date": "data se houver", "customer": "cliente se houver"}}
  ],
  "objections": [
    {{"content": "objecao comercial", "speaker": "quem falou", "customer": "cliente se houver"}}
  ],
  "risks": [
    {{"content": "risco identificado", "severity": "low|medium|high", "customer": "cliente se houver"}}
  ],
  "promises": [
    {{"content": "promessa feita", "speaker": "quem prometeu", "customer": "cliente se houver"}}
  ],
  "entities": [
    {{"name": "entidade citada", "type": "person|company|project|date|value|other", "context": "contexto curto"}}
  ]
}}

Se algo nao existir, use lista vazia. Nao invente fatos.
"""
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    try:
        response = await client.responses.create(
            model=settings.openai_summary_model,
            input=prompt,
        )
    except OpenAIError:
        logger.exception("meeting memory extraction failed")
        return {}

    return parse_json_object(response.output_text.strip())


async def process_meeting_memory(
    *,
    settings: Settings,
    meeting_id: str,
    force: bool = False,
) -> MeetingMemoryProcessResponse:
    meeting = await ensure_meeting(settings=settings, meeting_id=meeting_id)
    existing = await list_meeting_memory_items(settings=settings, meeting_id=meeting_id)
    if existing and not force:
        return MeetingMemoryProcessResponse(
            meeting_id=meeting_id,
            created_count=len(existing),
            skipped=True,
            reason="Memory already exists for this meeting.",
        )

    segments = list(await list_transcript_segments(settings=settings, meeting_id=meeting_id))
    if not segments:
        return MeetingMemoryProcessResponse(
            meeting_id=meeting_id,
            created_count=0,
            skipped=True,
            reason="No transcript found for this meeting.",
        )

    participants = list(await list_meeting_participants(settings=settings, meeting_id=meeting_id))
    recommendations = list(
        await list_sales_recommendations(settings=settings, meeting_id=meeting_id)
    )
    allowed_users = build_allowed_users(participants)
    gatekeeper_users = build_allowed_users(participants, {"host", "commercial"})

    transcript_lines = [
        f"[{segment.timestamp_seconds:.0f}s] {segment.speaker_name}: {segment.content}"
        for segment in segments
    ]
    transcript = "\n".join(transcript_lines)
    structured = await extract_structured_memory(
        settings=settings,
        meeting_title=meeting.title,
        transcript=transcript,
        participants=participants,
        recommendations=recommendations,
    )

    items: list[dict[str, Any]] = []
    for index, chunk in enumerate(chunk_transcript(transcript_lines)):
        items.append(
            base_memory_item(
                meeting_id=meeting_id,
                memory_type="transcript_chunk",
                content=chunk,
                allowed_users=allowed_users,
                metadata={"chunk_index": index, "meeting_title": meeting.title},
                sensitivity_level="medium",
            )
        )

    summary = clean_text(structured.get("executive_summary"))
    if summary:
        items.append(
            base_memory_item(
                meeting_id=meeting_id,
                memory_type="executive_summary",
                content=summary,
                allowed_users=allowed_users,
                metadata={"meeting_title": meeting.title},
                visibility="organization",
                sensitivity_level="medium",
            )
        )

    mappings = [
        ("decisions", "decision", "medium"),
        ("next_steps", "next_step", "medium"),
        ("objections", "commercial_objection", "high"),
        ("risks", "risk", "high"),
        ("promises", "promise", "medium"),
        ("entities", "entity", "low"),
    ]
    for source_key, memory_type, sensitivity in mappings:
        for item in normalize_list(structured.get(source_key)):
            if source_key == "entities":
                content = clean_text(
                    f"{item.get('name', '')} ({item.get('type', 'other')}): {item.get('context', '')}",
                    limit=1200,
                )
            else:
                content = clean_text(item.get("content"), limit=1800)

            if not content or memory_type not in MEMORY_TYPES:
                continue

            items.append(
                base_memory_item(
                    meeting_id=meeting_id,
                    memory_type=memory_type,
                    content=content,
                    allowed_users=(
                        gatekeeper_users
                        if memory_type in {"commercial_objection", "risk"}
                        else allowed_users
                    ),
                    metadata={
                        **item,
                        "source": source_key,
                        "meeting_title": meeting.title,
                    },
                    visibility=(
                        "host_commercial"
                        if memory_type in {"commercial_objection", "risk"}
                        else "participants"
                    ),
                    allowed_roles=(
                        ["host", "commercial"]
                        if memory_type in {"commercial_objection", "risk"}
                        else ["host", "commercial", "client"]
                    ),
                    sensitivity_level=sensitivity,
                )
            )

    if not items:
        return MeetingMemoryProcessResponse(
            meeting_id=meeting_id,
            created_count=0,
            skipped=True,
            reason="No memory items could be generated.",
        )

    if force:
        await delete_meeting_memory_items(settings=settings, meeting_id=meeting_id)

    embeddings = await embed_texts(
        settings=settings,
        texts=[item["content"] for item in items],
    )
    inserted = await insert_meeting_memory_items(
        settings=settings,
        items=items,
        embeddings=embeddings,
    )
    return MeetingMemoryProcessResponse(
        meeting_id=meeting_id,
        created_count=len(inserted),
    )


async def search_meeting_memory(
    *,
    settings: Settings,
    payload: MeetingMemorySearchRequest,
    requester_email: str | None,
    requester_role: str | None,
    organization_id: str = "default",
) -> MeetingMemorySearchResponse:
    embeddings = await embed_texts(settings=settings, texts=[payload.query])
    results = await search_meeting_memory_items(
        settings=settings,
        query_embedding=embeddings[0],
        top_k=payload.top_k,
        organization_id=organization_id,
        requester_email=requester_email.lower() if requester_email else None,
        requester_role=requester_role,
        meeting_id=payload.meeting_id,
        customer=payload.customer,
    )
    return MeetingMemorySearchResponse(query=payload.query, results=list(results))


async def require_memory_or_404(
    *,
    settings: Settings,
    meeting_id: str,
) -> list[MeetingMemoryItem]:
    items = list(await list_meeting_memory_items(settings=settings, meeting_id=meeting_id))
    if not items:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No memory has been generated for this meeting yet.",
        )
    return items
