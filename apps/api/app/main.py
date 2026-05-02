from uuid import uuid4

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from livekit import api

from app.auth import (
    create_participant_access_token,
    get_participant_claims,
    require_sales_panel_access,
    ParticipantClaims,
)
from app.config import get_settings
from app.copilot import dispatch_copilot
from app.database import (
    init_database,
    insert_sales_recommendations,
    insert_transcript_segment,
    list_sales_recommendations,
    list_transcript_segments,
)
from app.models import (
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
)
from app.knowledge_service import ingest_knowledge_document, search_knowledge
from app.sales_coach_service import analyze_segment
from app.store import meeting_store

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_database(settings)
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


@app.post("/knowledge/documents", response_model=KnowledgeUploadResponse, status_code=201)
async def upload_knowledge_document(
    file: UploadFile = File(...),
) -> KnowledgeUploadResponse:
    return await ingest_knowledge_document(settings=settings, file=file)


@app.post("/knowledge/search", response_model=KnowledgeSearchResponse)
async def search_knowledge_base(
    payload: KnowledgeSearchRequest,
) -> KnowledgeSearchResponse:
    return await search_knowledge(
        settings=settings,
        query=payload.query,
        top_k=payload.top_k,
    )


@app.post("/meetings", response_model=Meeting, status_code=201)
def create_meeting(payload: CreateMeetingRequest) -> Meeting:
    return meeting_store.create(payload.title)


@app.get("/meetings/{meeting_id}", response_model=Meeting)
def get_meeting(meeting_id: str) -> Meeting:
    return meeting_store.ensure(meeting_id)


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

    meeting = meeting_store.ensure(meeting_id)
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
    meeting_store.ensure(meeting_id)
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
    meeting_store.ensure(meeting_id)
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
    meeting_store.ensure(meeting_id)
    require_sales_panel_access(claims, meeting_id)
    recommendations = await list_sales_recommendations(
        settings=settings,
        meeting_id=meeting_id,
    )
    return list(recommendations)
