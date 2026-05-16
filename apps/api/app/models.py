from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, EmailStr, Field

ParticipantRole = Literal["host", "commercial", "client", "observer"]
RecommendationKind = Literal["objection", "risk", "opportunity"]
RecommendationSeverity = Literal["low", "medium", "high"]
AgentGender = Literal["masculine", "feminine", "neutral"]
WeeklyMeetingVolume = Literal["ate-5", "5-10", "10-20", "mais-20"]
MemoryItemType = Literal[
    "transcript_chunk",
    "executive_summary",
    "decision",
    "next_step",
    "commercial_objection",
    "risk",
    "promise",
    "entity",
]
MemoryVisibility = Literal["participants", "host_commercial", "organization"]
SensitivityLevel = Literal["low", "medium", "high"]
AgentAction = Literal["send_email", "schedule_meeting", "web_search"]
AgentIntegration = Literal["resend_email", "google_calendar", "web_search"]
EmailRecipientScope = Literal["all_participants", "clients", "host", "custom"]
CalendarAttendeeScope = Literal["all_participants", "clients", "host", "custom"]
ConversationChannel = Literal["web", "whatsapp", "voice", "meeting"]
ConversationMessageRole = Literal["user", "assistant", "system"]
AgentVoice = Literal[
    "alloy",
    "ash",
    "ballad",
    "coral",
    "echo",
    "sage",
    "shimmer",
    "verse",
    "marin",
    "cedar",
]


class CreateMeetingRequest(BaseModel):
    title: str = Field(default="Reuniao UM", min_length=1, max_length=120)


class Meeting(BaseModel):
    id: str
    title: str
    created_at: datetime
    started_at: datetime | None = None
    ended_at: datetime | None = None
    recording_url: str | None = None
    copilot_dispatched: bool = False

    @classmethod
    def create(cls, title: str) -> "Meeting":
        return cls(
            id=f"meeting-{uuid4().hex[:12]}",
            title=title,
            created_at=datetime.now(timezone.utc),
        )


class MeetingParticipant(BaseModel):
    id: int
    meeting_id: str
    identity: str | None = None
    name: str
    email: EmailStr
    role: ParticipantRole
    joined_at: datetime


class MeetingRecentSummary(BaseModel):
    id: str
    title: str
    created_at: datetime
    started_at: datetime | None = None
    ended_at: datetime | None = None
    recording_url: str | None = None
    copilot_dispatched: bool = False
    participant_count: int = 0
    transcript_count: int = 0
    memory_count: int = 0
    participants: list[MeetingParticipant] = Field(default_factory=list)


class MeetingRecording(BaseModel):
    id: int
    meeting_id: str
    egress_id: str
    status: str
    storage_provider: str
    bucket: str | None = None
    object_key: str | None = None
    file_type: str = "mp4"
    started_at: datetime | None = None
    ended_at: datetime | None = None
    duration_seconds: float | None = None
    size_bytes: int | None = None
    location: str | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime


class RecordingStartResponse(BaseModel):
    started: bool
    configured: bool
    recording: MeetingRecording | None = None
    detail: str | None = None


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


class MeetingMemoryItem(BaseModel):
    id: int
    organization_id: str
    agent_id: str
    meeting_id: str
    memory_type: MemoryItemType
    content: str
    metadata: dict = Field(default_factory=dict)
    visibility: MemoryVisibility
    allowed_user_ids: list[str] = Field(default_factory=list)
    allowed_role_ids: list[str] = Field(default_factory=list)
    sensitivity_level: SensitivityLevel
    created_at: datetime


class MeetingMemoryProcessResponse(BaseModel):
    meeting_id: str
    created_count: int
    skipped: bool = False
    reason: str | None = None


class MeetingMemorySearchRequest(BaseModel):
    query: str = Field(min_length=3, max_length=1000)
    top_k: int = Field(default=8, ge=1, le=20)
    meeting_id: str | None = Field(default=None, max_length=120)
    customer: str | None = Field(default=None, max_length=160)
    date_range: str | None = Field(default=None, max_length=80)


class MeetingMemorySearchResult(BaseModel):
    id: int
    meeting_id: str
    meeting_title: str | None = None
    memory_type: MemoryItemType
    content: str
    metadata: dict = Field(default_factory=dict)
    sensitivity_level: SensitivityLevel
    score: float
    created_at: datetime


class MeetingMemorySearchResponse(BaseModel):
    query: str
    results: list[MeetingMemorySearchResult]


class ConversationSession(BaseModel):
    id: str
    organization_id: str
    agent_id: str
    channel: ConversationChannel
    user_id: str
    user_name: str
    user_email: EmailStr | None = None
    title: str
    context_scope: dict = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class ConversationMessage(BaseModel):
    id: int
    session_id: str
    role: ConversationMessageRole
    content: str
    metadata: dict = Field(default_factory=dict)
    created_at: datetime


class AgentRespondContextScope(BaseModel):
    meeting_id: str | None = Field(default=None, max_length=120)
    customer: str | None = Field(default=None, max_length=160)
    date_range: str | None = Field(default=None, max_length=80)


class AgentRespondRequest(BaseModel):
    message: str = Field(min_length=3, max_length=4000)
    session_id: str | None = Field(default=None, max_length=80)
    agent_id: str = Field(default="coevo", min_length=2, max_length=80)
    organization_id: str = Field(default="default", min_length=2, max_length=120)
    channel: ConversationChannel = "web"
    user_id: str = Field(default="local-user", min_length=2, max_length=180)
    user_name: str = Field(default="Acesso local", min_length=1, max_length=120)
    user_email: EmailStr | None = None
    requester_role: ParticipantRole = "host"
    context_scope: AgentRespondContextScope = Field(
        default_factory=AgentRespondContextScope
    )


class AgentRespondResponse(BaseModel):
    session: ConversationSession
    user_message: ConversationMessage
    assistant_message: ConversationMessage
    memory_results: list[MeetingMemorySearchResult] = Field(default_factory=list)


class AgentProfile(BaseModel):
    id: str = Field(default="coevo", min_length=2, max_length=80)
    organization_id: str = Field(default="default", min_length=2, max_length=120)
    name: str = Field(default="Coevo", min_length=2, max_length=40)
    gender: AgentGender = "masculine"
    voice: AgentVoice = "marin"
    tone: str = Field(default="consultivo", max_length=80)
    formality: int = Field(default=68, ge=0, le=100)
    energy: int = Field(default=48, ge=0, le=100)
    empathy: int = Field(default=74, ge=0, le=100)
    assertiveness: int = Field(default=58, ge=0, le=100)
    brevity: int = Field(default=70, ge=0, le=100)
    keywords: list[str] = Field(default_factory=list, max_length=20)
    avoid_words: list[str] = Field(default_factory=list, max_length=20)
    behavior_tags: list[str] = Field(default_factory=list, max_length=20)
    sales_method: str = Field(default="consultivo", max_length=80)
    language_policy: str = Field(
        default="Responder sempre na mesma lingua usada pelo participante.",
        max_length=240,
    )
    custom_instructions: str = Field(default="", max_length=1600)
    voice_command_roles: list[ParticipantRole] = Field(default_factory=lambda: ["host"])
    enabled_actions: list[AgentAction] = Field(
        default_factory=lambda: ["send_email", "schedule_meeting", "web_search"]
    )
    enabled_integrations: list[AgentIntegration] = Field(
        default_factory=lambda: ["resend_email", "google_calendar", "web_search"]
    )
    permissions: dict = Field(default_factory=dict)
    knowledge_base_ids: list[str] = Field(default_factory=list, max_length=50)
    connected_channels: list[str] = Field(default_factory=lambda: ["meeting"], max_length=20)
    tool_access: dict = Field(default_factory=dict)
    require_voice_confirmation: bool = True
    updated_at: datetime | None = None


class MeetingEmailActionRequest(BaseModel):
    requester_identity: str = Field(min_length=3, max_length=180)
    requester_name: str = Field(min_length=1, max_length=120)
    recipient_scope: EmailRecipientScope = "all_participants"
    recipients: list[str] = Field(default_factory=list, max_length=30)
    subject: str = Field(min_length=3, max_length=180)
    body: str = Field(min_length=3, max_length=5000)


class MeetingEmailActionResponse(BaseModel):
    sent: bool
    recipient_count: int
    recipients: list[EmailStr]
    sender_name: str
    sender_email: EmailStr


class MeetingEmailDeferResponse(BaseModel):
    deferred: bool
    pending_email_id: int


class GoogleCalendarStatus(BaseModel):
    configured: bool
    connected: bool
    can_create_events: bool = False
    calendar_email: EmailStr | None = None
    updated_at: datetime | None = None
    auth_url: str | None = None


class MeetingCalendarActionRequest(BaseModel):
    requester_identity: str = Field(min_length=3, max_length=180)
    requester_name: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=3, max_length=180)
    description: str = Field(default="", max_length=5000)
    start_time: datetime
    duration_minutes: int = Field(default=30, ge=15, le=480)
    attendee_scope: CalendarAttendeeScope = "all_participants"
    attendees: list[EmailStr] = Field(default_factory=list, max_length=30)


class MeetingCalendarActionResponse(BaseModel):
    created: bool
    event_id: str
    html_link: str | None = None
    attendee_count: int
    attendees: list[EmailStr]
    organizer_email: EmailStr | None = None


class WebSearchResult(BaseModel):
    title: str
    url: str
    snippet: str


class MeetingWebSearchRequest(BaseModel):
    requester_identity: str = Field(min_length=3, max_length=180)
    requester_name: str = Field(min_length=1, max_length=120)
    query: str = Field(min_length=3, max_length=500)


class MeetingWebSearchResponse(BaseModel):
    query: str
    results: list[WebSearchResult]


class MeetingInterventionCheckRequest(BaseModel):
    speaker_name: str = Field(min_length=1, max_length=120)
    transcript: str = Field(min_length=8, max_length=4000)


class MeetingInterventionCheckResponse(BaseModel):
    should_raise_hand: bool
    subject: str | None = None
    rationale: str | None = None


class VoiceDemoRequest(BaseModel):
    voice: AgentVoice
    text: str = Field(
        default="Ola, eu sou o Coevo. Vou acompanhar a reuniao com clareza, calma e foco no que importa.",
        min_length=3,
        max_length=240,
    )


class TrialRequestCreate(BaseModel):
    full_name: str = Field(min_length=3, max_length=120)
    phone: str = Field(min_length=8, max_length=40)
    corporate_email: EmailStr
    company_name: str = Field(min_length=2, max_length=140)
    weekly_meeting_volume: WeeklyMeetingVolume
    lgpd_accepted: bool
    source: str = Field(default="meeting-ended", max_length=80)
    selected_plan: str | None = Field(default=None, max_length=80)


class TrialRequestUpdate(BaseModel):
    full_name: str = Field(min_length=3, max_length=120)
    phone: str = Field(min_length=8, max_length=40)
    corporate_email: EmailStr
    company_name: str = Field(min_length=2, max_length=140)
    weekly_meeting_volume: WeeklyMeetingVolume
    selected_plan: str | None = Field(default=None, max_length=80)


class TrialRequest(BaseModel):
    id: int
    full_name: str
    phone: str
    corporate_email: EmailStr
    company_name: str
    weekly_meeting_volume: WeeklyMeetingVolume
    lgpd_accepted: bool
    source: str
    selected_plan: str | None = None
    created_at: datetime
