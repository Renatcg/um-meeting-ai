from datetime import datetime, timedelta, timezone
import logging
from uuid import uuid4

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from livekit import api
from openai import AsyncOpenAI, OpenAIError

from app.auth import (
    create_participant_access_token,
    get_participant_claims,
    require_sales_panel_access,
    ParticipantClaims,
)
from app.config import get_settings
from app.copilot import dispatch_copilot
from app.database import (
    ensure_meeting,
    get_agent_profile,
    has_host_or_commercial_joined,
    init_database,
    insert_sales_recommendations,
    insert_transcript_segment,
    insert_meeting,
    insert_trial_request,
    list_trial_requests,
    list_sales_recommendations,
    list_transcript_segments,
    mark_meeting_ended,
    register_meeting_participant,
    upsert_agent_profile,
)
from app.models import (
    AgentProfile,
    CreateMeetingRequest,
    CreateTokenRequest,
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
    KnowledgeUploadResponse,
    LiveKitTokenResponse,
    Meeting,
    SalesRecommendation,
    TranscriptSegment,
    TranscriptSegmentCreate,
    TrialRequest,
    TrialRequestCreate,
    VoiceDemoRequest,
)
from app.knowledge_service import (
    ingest_knowledge_document,
    ingest_knowledge_media,
    search_knowledge,
)
from app.sales_coach_service import analyze_segment
from app.store import meeting_store

settings = get_settings()
MEETING_JOIN_GRACE_PERIOD = timedelta(minutes=15)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        await init_database(settings)
    except Exception:
        logger.exception("database initialization failed")
    yield


app = FastAPI(title="UM Meeting AI API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/trial-requests", response_model=TrialRequest, status_code=201)
async def create_trial_request(payload: TrialRequestCreate) -> TrialRequest:
    if not payload.lgpd_accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="LGPD acceptance is required.",
        )

    return await insert_trial_request(settings=settings, payload=payload)


@app.get("/trial-requests", response_model=list[TrialRequest])
async def read_trial_requests() -> list[TrialRequest]:
    return await list_trial_requests(settings=settings)


@app.post("/knowledge/documents", response_model=KnowledgeUploadResponse, status_code=201)
async def upload_knowledge_document(
    file: UploadFile = File(...),
) -> KnowledgeUploadResponse:
    return await ingest_knowledge_document(settings=settings, file=file)


@app.post("/knowledge/media", response_model=KnowledgeUploadResponse, status_code=201)
async def upload_knowledge_media(
    file: UploadFile = File(...),
) -> KnowledgeUploadResponse:
    return await ingest_knowledge_media(settings=settings, file=file)


@app.get("/agent/profile", response_model=AgentProfile)
async def read_agent_profile() -> AgentProfile:
    return await get_agent_profile(settings=settings)


@app.put("/agent/profile", response_model=AgentProfile)
async def save_agent_profile(profile: AgentProfile) -> AgentProfile:
    return await upsert_agent_profile(settings=settings, profile=profile)


@app.post("/agent/voice-demo")
async def create_voice_demo(payload: VoiceDemoRequest) -> Response:
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OPENAI_API_KEY is required for voice demos.",
        )

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    try:
        audio = await client.audio.speech.create(
            model="gpt-4o-mini-tts",
            voice=payload.voice,
            input=payload.text,
            response_format="mp3",
        )
    except OpenAIError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nao foi possivel gerar a demo de voz.",
        ) from exc

    return Response(content=audio.content, media_type="audio/mpeg")


@app.post(
    "/meetings/{meeting_id}/knowledge/documents",
    response_model=KnowledgeUploadResponse,
    status_code=201,
)
async def upload_meeting_knowledge_document(
    meeting_id: str,
    file: UploadFile = File(...),
) -> KnowledgeUploadResponse:
    await ensure_meeting(settings=settings, meeting_id=meeting_id)
    return await ingest_knowledge_document(
        settings=settings,
        file=file,
        meeting_id=meeting_id,
    )


@app.post(
    "/meetings/{meeting_id}/knowledge/media",
    response_model=KnowledgeUploadResponse,
    status_code=201,
)
async def upload_meeting_knowledge_media(
    meeting_id: str,
    file: UploadFile = File(...),
) -> KnowledgeUploadResponse:
    await ensure_meeting(settings=settings, meeting_id=meeting_id)
    return await ingest_knowledge_media(
        settings=settings,
        file=file,
        meeting_id=meeting_id,
    )


@app.post("/knowledge/search", response_model=KnowledgeSearchResponse)
async def search_knowledge_base(
    payload: KnowledgeSearchRequest,
) -> KnowledgeSearchResponse:
    return await search_knowledge(
        settings=settings,
        query=payload.query,
        top_k=payload.top_k,
    )


@app.post(
    "/meetings/{meeting_id}/knowledge/search",
    response_model=KnowledgeSearchResponse,
)
async def search_meeting_knowledge_base(
    meeting_id: str,
    payload: KnowledgeSearchRequest,
) -> KnowledgeSearchResponse:
    await ensure_meeting(settings=settings, meeting_id=meeting_id)
    return await search_knowledge(
        settings=settings,
        query=payload.query,
        top_k=payload.top_k,
        meeting_id=meeting_id,
    )


@app.post("/meetings", response_model=Meeting, status_code=201)
async def create_meeting(payload: CreateMeetingRequest) -> Meeting:
    meeting = meeting_store.create(payload.title)
    return await insert_meeting(settings=settings, meeting=meeting)


@app.get("/meetings/{meeting_id}", response_model=Meeting)
async def get_meeting(meeting_id: str) -> Meeting:
    return await ensure_meeting(settings=settings, meeting_id=meeting_id)


@app.post("/meetings/{meeting_id}/end", response_model=Meeting)
async def end_meeting(
    meeting_id: str,
    claims: ParticipantClaims = Depends(get_participant_claims),
) -> Meeting:
    require_sales_panel_access(claims, meeting_id)
    return await mark_meeting_ended(settings=settings, meeting_id=meeting_id)


@app.post("/meetings/{meeting_id}/token", response_model=LiveKitTokenResponse)
async def create_livekit_token(
    meeting_id: str,
    payload: CreateTokenRequest,
) -> LiveKitTokenResponse:
    if not payload.lgpd_accepted:
        raise HTTPException(
            status_code=400,
            detail="Aceite LGPD obrigatorio para entrar na reuniao.",
        )

    meeting = await ensure_meeting(settings=settings, meeting_id=meeting_id)

    now = datetime.now(timezone.utc)
    if (
        meeting.ended_at is not None
        and now - meeting.ended_at > MEETING_JOIN_GRACE_PERIOD
    ):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Link da reuniao expirado.",
        )

    has_gatekeeper_joined = await has_host_or_commercial_joined(
        settings=settings,
        meeting_id=meeting.id,
    )

    if (
        payload.role not in ("host", "commercial")
        and not has_gatekeeper_joined
    ):
        if now - meeting.created_at > MEETING_JOIN_GRACE_PERIOD:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="Link da reuniao expirado porque Host ou Comercial nao entrou.",
            )

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Aguarde o Host ou Comercial entrar para liberar a sala.",
        )

    identity = f"{payload.email}:{uuid4().hex[:8]}"
    participant_access_token = create_participant_access_token(
        settings=settings,
        meeting_id=meeting.id,
        identity=identity,
        name=payload.name,
        email=str(payload.email),
        role=payload.role,
    )

    token = (
        api.AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
        .with_identity(identity)
        .with_name(payload.name)
        .with_grants(
            api.VideoGrants(
                room_join=True,
                room=meeting.id,
                can_publish=True,
                can_subscribe=True,
            )
        )
        .to_jwt()
    )
    copilot_dispatch_requested, copilot_dispatch_error = await dispatch_copilot(
        settings=settings,
        meeting=meeting,
    )
    await register_meeting_participant(
        settings=settings,
        meeting_id=meeting.id,
        name=payload.name,
        email=str(payload.email),
        role=payload.role,
    )

    return LiveKitTokenResponse(
        token=token,
        url=settings.livekit_url,
        room=meeting.id,
        identity=identity,
        role=payload.role,
        participant_access_token=participant_access_token,
        copilot_dispatch_requested=copilot_dispatch_requested,
        copilot_dispatch_error=copilot_dispatch_error,
    )


def verify_agent_api_key(
    x_agent_api_key: str | None = Header(default=None),
) -> None:
    if not settings.agent_api_key:
        return

    if x_agent_api_key != settings.agent_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid agent API key.",
        )


@app.post(
    "/meetings/{meeting_id}/transcript",
    response_model=TranscriptSegment,
    status_code=201,
    dependencies=[Depends(verify_agent_api_key)],
)
async def create_transcript_segment(
    meeting_id: str,
    payload: TranscriptSegmentCreate,
) -> TranscriptSegment:
    await ensure_meeting(settings=settings, meeting_id=meeting_id)
    segment = await insert_transcript_segment(
        settings=settings,
        meeting_id=meeting_id,
        segment=payload,
    )
    recommendations = analyze_segment(segment)
    await insert_sales_recommendations(
        settings=settings,
        meeting_id=meeting_id,
        transcript_segment_id=segment.id,
        drafts=recommendations,
    )
    return segment


@app.get("/meetings/{meeting_id}/transcript", response_model=list[TranscriptSegment])
async def get_meeting_transcript(meeting_id: str) -> list[TranscriptSegment]:
    await ensure_meeting(settings=settings, meeting_id=meeting_id)
    segments = await list_transcript_segments(settings=settings, meeting_id=meeting_id)
    return list(segments)


@app.get(
    "/meetings/{meeting_id}/sales-recommendations",
    response_model=list[SalesRecommendation],
)
async def get_sales_recommendations(
    meeting_id: str,
    claims: ParticipantClaims = Depends(get_participant_claims),
) -> list[SalesRecommendation]:
    await ensure_meeting(settings=settings, meeting_id=meeting_id)
    require_sales_panel_access(claims, meeting_id)
    recommendations = await list_sales_recommendations(
        settings=settings,
        meeting_id=meeting_id,
    )
    return list(recommendations)
