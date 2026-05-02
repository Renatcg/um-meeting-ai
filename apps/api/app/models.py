from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, EmailStr, Field

ParticipantRole = Literal["host", "commercial", "client", "observer"]
RecommendationKind = Literal["objection", "risk", "opportunity"]
RecommendationSeverity = Literal["low", "medium", "high"]


class CreateMeetingRequest(BaseModel):
    title: str = Field(default="Reuniao UM", min_length=1, max_length=120)


class Meeting(BaseModel):
    id: str
    title: str
    created_at: datetime
    copilot_dispatched: bool = False

    @classmethod
    def create(cls, title: str) -> "Meeting":
        return cls(
            id=f"meeting-{uuid4().hex[:12]}",
            title=title,
            created_at=datetime.now(timezone.utc),
        )


class CreateTokenRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    role: ParticipantRole
    lgpd_accepted: bool


class LiveKitTokenResponse(BaseModel):
    token: str
    url: str
    room: str
    identity: str
    role: ParticipantRole
    participant_access_token: str
    copilot_dispatch_requested: bool = False
    copilot_dispatch_error: str | None = None


class TranscriptSegmentCreate(BaseModel):
    speaker_name: str = Field(min_length=1, max_length=120)
    timestamp_seconds: float = Field(ge=0)
    content: str = Field(min_length=1)


class TranscriptSegment(BaseModel):
    id: int
    meeting_id: str
    speaker_name: str
    timestamp_seconds: float
    content: str
    created_at: datetime


class SalesRecommendation(BaseModel):
    id: int
    meeting_id: str
    transcript_segment_id: int
    kind: RecommendationKind
    severity: RecommendationSeverity
    title: str
    recommendation: str
    evidence: str
    created_at: datetime


class KnowledgeDocument(BaseModel):
    id: int
    filename: str
    content_type: str
    size_bytes: int
    chunk_count: int
    created_at: datetime


class KnowledgeUploadResponse(BaseModel):
    document: KnowledgeDocument


class KnowledgeSearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=1000)
    top_k: int = Field(default=5, ge=1, le=10)


class KnowledgeSearchResult(BaseModel):
    chunk_id: int
    document_id: int
    filename: str
    chunk_index: int
    content: str
    score: float


class KnowledgeSearchResponse(BaseModel):
    results: list[KnowledgeSearchResult]
