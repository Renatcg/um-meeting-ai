from datetime import datetime, timedelta, timezone
import asyncio
import logging
from uuid import uuid4

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, Header, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from livekit import api
from openai import AsyncOpenAI, OpenAIError

from app.auth import (
    AppUserClaims,
    create_app_access_token,
    create_participant_access_token,
    get_current_user_claims,
    get_participant_claims,
    hash_password,
    require_admin_user,
    require_sales_panel_access,
    ParticipantClaims,
    verify_password,
)
from app.config import get_settings
from app.calendar_service import (
    build_google_calendar_auth_url,
    create_google_calendar_event,
    exchange_google_calendar_code,
    GoogleCalendarAPIError,
    google_calendar_configured,
    google_calendar_can_create_events,
)
from app.copilot import dispatch_copilot
from app.conversation_service import respond_with_agent_memory
from app.database import (
    count_app_users,
    get_conversation_session,
    delete_trial_request,
    ensure_meeting,
    get_agent_profile,
    get_app_user_by_email,
    get_app_user_by_id,
    get_google_calendar_connection,
    get_meeting_join_request_by_email,
    get_meeting_participant_by_identity,
    has_host_or_commercial_joined,
    init_database,
    insert_meeting_agent_action,
    insert_meeting_pending_email,
    insert_sales_recommendations,
    insert_transcript_segment,
    insert_meeting,
    insert_app_user,
    insert_trial_request,
    insert_whatsapp_group_message,
    insert_whatsapp_webhook_event,
    list_app_users,
    list_conversation_messages,
    list_conversation_sessions,
    list_meeting_recordings,
    list_meeting_agent_actions,
    list_meeting_join_requests,
    list_recent_meetings,
    list_pending_meeting_emails,
    list_meeting_participants,
    list_meeting_processing_jobs,
    list_trial_requests,
    list_whatsapp_webhook_events,
    list_sales_recommendations,
    list_transcript_segments,
    mark_pending_meeting_email,
    mark_meeting_ended,
    register_meeting_participant,
    update_meeting_join_request_status,
    update_trial_request,
    upsert_meeting_join_request,
    upsert_agent_profile,
)
from app.email_service import send_meeting_action_email, send_trial_confirmation_email
from app.intervention_service import evaluate_intervention
from app.models import (
    AgentProfile,
    AgentRespondRequest,
    AgentRespondResponse,
    AuthResponse,
    ConversationMessage,
    ConversationSession,
    CreateMeetingRequest,
    CreateTokenRequest,
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
    KnowledgeUploadResponse,
    LiveKitTokenResponse,
    Meeting,
    GoogleCalendarStatus,
    MeetingCalendarActionRequest,
    MeetingCalendarActionResponse,
    MeetingEmailDeferResponse,
    MeetingEmailActionRequest,
    MeetingEmailActionResponse,
    MeetingInterventionCheckRequest,
    MeetingInterventionCheckResponse,
    MeetingJoinRequest,
    MeetingJoinRequestDecision,
    MeetingMemoryItem,
    MeetingMemorySearchRequest,
    MeetingMemorySearchResponse,
    MeetingProcessingJob,
    MeetingRecentSummary,
    MeetingRecording,
    RecordingHealthResponse,
    MeetingWebSearchRequest,
    MeetingWebSearchResponse,
    RecordingStartResponse,
    SalesRecommendation,
    TranscriptSegment,
    TranscriptSegmentCreate,
    TrialRequest,
    TrialRequestCreate,
    TrialRequestUpdate,
    UserCreate,
    UserLoginRequest,
    UserPublic,
    VoiceDemoRequest,
    WhatsAppWebhookEvent,
)
from app.knowledge_service import (
    ingest_knowledge_document,
    ingest_knowledge_media,
    search_knowledge,
)
from app.memory_service import (
    require_memory_or_404,
    search_meeting_memory,
)
from app.processing_service import (
    enqueue_meeting_memory_processing,
    run_due_meeting_processing_jobs,
    run_meeting_processing_job,
)
from app.recording_service import (
    recording_health,
    save_egress_info,
    start_meeting_recording,
    stop_active_meeting_recording,
)
from app.sales_coach_service import analyze_segment
from app.store import meeting_store
from app.web_search_service import search_web
from app.whatsapp_group_service import (
    answer_whatsapp_group_message,
    should_respond_to_group_message,
)
from app.whatsapp_service import (
    parse_evo_webhook_payload,
    send_evo_audio,
    send_evo_text,
    synthesize_whatsapp_audio,
    summarize_evo_payload,
    transcribe_whatsapp_audio,
    whatsapp_phone_is_allowed,
)

settings = get_settings()
MEETING_JOIN_GRACE_PERIOD = timedelta(minutes=15)
logger = logging.getLogger(__name__)


LIVEKIT_WEBHOOK_ROOM_FINISHED = "room_finished"
LIVEKIT_WEBHOOK_EGRESS_ENDED = "egress_ended"
LIVEKIT_WEBHOOK_EGRESS_UPDATED = "egress_updated"
LIVEKIT_WEBHOOK_PARTICIPANT_LEFT = "participant_left"


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


def log_background_task_failure(task: asyncio.Task) -> None:
    try:
        task.result()
    except asyncio.CancelledError:
        return
    except Exception:
        logger.exception("background task failed")


def is_livekit_agent_participant(identity: str | None, name: str | None) -> bool:
    normalized_identity = (identity or "").strip().lower()
    normalized_name = (name or "").strip().lower()
    if normalized_identity.startswith("agent-"):
        return True
    return normalized_name in {"coevo", "jarvis", "um copilot", "copilot"}


async def list_livekit_human_participants(meeting_id: str) -> list[api.ParticipantInfo]:
    livekit_api = api.LiveKitAPI(
        settings.livekit_url,
        settings.livekit_api_key,
        settings.livekit_api_secret,
    )
    try:
        response = await livekit_api.room.list_participants(
            api.ListParticipantsRequest(room=meeting_id)
        )
    finally:
        await livekit_api.aclose()

    return [
        participant
        for participant in response.participants
        if not is_livekit_agent_participant(
            getattr(participant, "identity", None),
            getattr(participant, "name", None),
        )
    ]


async def finalize_meeting_if_no_humans(meeting_id: str) -> None:
    await asyncio.sleep(1)
    try:
        humans = await list_livekit_human_participants(meeting_id)
    except Exception:
        logger.exception("failed to inspect livekit participants after participant left")
        return

    if humans:
        return

    logger.info(
        "finalizing meeting because no human participants remain",
        extra={"meeting_id": meeting_id},
    )
    try:
        await finalize_meeting(meeting_id)
    except Exception:
        logger.exception("failed to finalize meeting after last human participant left")

    await delete_livekit_room_if_exists(meeting_id)


async def delete_livekit_room_if_exists(meeting_id: str) -> None:
    livekit_api = api.LiveKitAPI(
        settings.livekit_url,
        settings.livekit_api_key,
        settings.livekit_api_secret,
    )
    try:
        await livekit_api.room.delete_room(api.DeleteRoomRequest(room=meeting_id))
    except Exception:
        logger.exception(
            "failed to delete stale livekit room",
            extra={"meeting_id": meeting_id},
        )
    finally:
        await livekit_api.aclose()


async def cleanup_livekit_rooms_without_humans() -> None:
    livekit_api = api.LiveKitAPI(
        settings.livekit_url,
        settings.livekit_api_key,
        settings.livekit_api_secret,
    )
    try:
        rooms_response = await livekit_api.room.list_rooms(api.ListRoomsRequest())
        rooms = list(getattr(rooms_response, "rooms", []) or [])
    except Exception:
        logger.exception("failed to list livekit rooms during cleanup")
        return
    finally:
        await livekit_api.aclose()

    for room in rooms:
        meeting_id = getattr(room, "name", "") or ""
        if not meeting_id:
            continue

        try:
            humans = await list_livekit_human_participants(meeting_id)
        except Exception:
            logger.exception(
                "failed to inspect livekit room during cleanup",
                extra={"meeting_id": meeting_id},
            )
            continue

        if humans:
            continue

        logger.warning(
            "cleanup found livekit room without human participants",
            extra={"meeting_id": meeting_id},
        )
        try:
            await finalize_meeting(meeting_id)
        except Exception:
            logger.exception(
                "failed to finalize stale livekit room",
                extra={"meeting_id": meeting_id},
            )
            continue

        await delete_livekit_room_if_exists(meeting_id)


async def stale_meeting_cleanup_loop() -> None:
    interval = max(int(settings.meeting_cleanup_interval_seconds), 60)
    while True:
        await asyncio.sleep(interval)
        await cleanup_livekit_rooms_without_humans()


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        await init_database(settings)
    except Exception:
        logger.exception("database initialization failed")

    cleanup_task = None
    if settings.meeting_cleanup_enabled:
        cleanup_task = asyncio.create_task(stale_meeting_cleanup_loop())
        cleanup_task.add_done_callback(log_background_task_failure)

    try:
        yield
    finally:
        if cleanup_task:
            cleanup_task.cancel()
            try:
                await cleanup_task
            except asyncio.CancelledError:
                pass


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


@app.post("/auth/register", response_model=AuthResponse, status_code=201)
async def register_user(
    payload: UserCreate,
    authorization: str | None = Header(default=None),
) -> AuthResponse:
    user_count = await count_app_users(settings=settings)
    requested_admin = payload.is_admin
    is_admin = user_count == 0

    if user_count > 0 and requested_admin:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators can create administrator users.",
            )
        claims = get_current_user_claims(authorization=authorization)
        if not claims.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators can create administrator users.",
            )
        is_admin = True

    try:
        user = await insert_app_user(
            settings=settings,
            name=payload.name,
            email=str(payload.email),
            password_hash=hash_password(payload.password),
            is_admin=is_admin,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already exists.",
        ) from exc

    return AuthResponse(
        access_token=create_app_access_token(settings=settings, user=user),
        user=user,
    )


@app.post("/auth/login", response_model=AuthResponse)
async def login_user(payload: UserLoginRequest) -> AuthResponse:
    row = await get_app_user_by_email(settings=settings, email=str(payload.email))
    if not row or not verify_password(payload.password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    user = UserPublic.model_validate(row)
    return AuthResponse(
        access_token=create_app_access_token(settings=settings, user=user),
        user=user,
    )


@app.get("/auth/me", response_model=UserPublic)
async def read_current_user(
    claims: AppUserClaims = Depends(get_current_user_claims),
) -> UserPublic:
    user = await get_app_user_by_id(settings=settings, user_id=claims.user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
        )
    return user


@app.get("/users", response_model=list[UserPublic])
async def read_users(
    _: AppUserClaims = Depends(require_admin_user),
) -> list[UserPublic]:
    return list(await list_app_users(settings=settings))


@app.post("/trial-requests", response_model=TrialRequest, status_code=201)
async def create_trial_request(payload: TrialRequestCreate) -> TrialRequest:
    if not payload.lgpd_accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="LGPD acceptance is required.",
        )

    lead = await insert_trial_request(settings=settings, payload=payload)
    try:
        await send_trial_confirmation_email(settings=settings, lead=lead)
    except Exception as exc:
        logger.exception("trial request confirmation email failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Lead saved, but confirmation email could not be sent.",
        ) from exc

    return lead


@app.get("/trial-requests", response_model=list[TrialRequest])
async def read_trial_requests() -> list[TrialRequest]:
    return await list_trial_requests(settings=settings)


@app.put("/trial-requests/{lead_id}", response_model=TrialRequest)
async def edit_trial_request(
    lead_id: int,
    payload: TrialRequestUpdate,
) -> TrialRequest:
    try:
        return await update_trial_request(
            settings=settings,
            lead_id=lead_id,
            payload=payload,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found.",
        ) from exc


@app.delete("/trial-requests/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_trial_request(lead_id: int) -> Response:
    try:
        await delete_trial_request(settings=settings, lead_id=lead_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found.",
        ) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)


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


@app.get("/agent/conversations", response_model=list[ConversationSession])
async def read_conversation_sessions(
    organization_id: str = "default",
    user_id: str | None = None,
    limit: int = 30,
) -> list[ConversationSession]:
    safe_limit = min(max(limit, 1), 100)
    return list(
        await list_conversation_sessions(
            settings=settings,
            organization_id=organization_id,
            user_id=user_id,
            limit=safe_limit,
        )
    )


@app.get(
    "/agent/conversations/{session_id}/messages",
    response_model=list[ConversationMessage],
)
async def read_conversation_messages(session_id: str) -> list[ConversationMessage]:
    session = await get_conversation_session(settings=settings, session_id=session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )
    return list(
        await list_conversation_messages(
            settings=settings,
            session_id=session_id,
            limit=200,
        )
    )


@app.post("/agent/respond", response_model=AgentRespondResponse)
async def respond_with_agent(payload: AgentRespondRequest) -> AgentRespondResponse:
    return await respond_with_agent_memory(settings=settings, payload=payload)


@app.post(
    "/agent/memory/search",
    response_model=MeetingMemorySearchResponse,
    dependencies=[Depends(verify_agent_api_key)],
)
async def search_agent_memory(
    payload: MeetingMemorySearchRequest,
) -> MeetingMemorySearchResponse:
    return await search_meeting_memory(
        settings=settings,
        payload=payload,
        requester_email=None,
        requester_role="host",
        organization_id="default",
    )


@app.get("/integrations/google-calendar", response_model=GoogleCalendarStatus)
async def get_google_calendar_status() -> GoogleCalendarStatus:
    configured = google_calendar_configured(settings)
    connection = await get_google_calendar_connection(settings=settings)
    auth_url = build_google_calendar_auth_url(settings) if configured else None
    return GoogleCalendarStatus(
        configured=configured,
        connected=bool(connection),
        can_create_events=google_calendar_can_create_events(connection),
        calendar_email=connection.get("calendar_email") if connection else None,
        updated_at=connection.get("updated_at") if connection else None,
        auth_url=auth_url,
    )


@app.get("/integrations/google-calendar/callback")
async def google_calendar_callback(code: str | None = None) -> Response:
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Google OAuth code.",
        )

    try:
        await exchange_google_calendar_code(settings=settings, code=code)
    except Exception as exc:
        logger.exception("google calendar oauth failed")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Calendar could not be connected.",
        ) from exc

    html = """
    <!doctype html>
    <html lang="pt-BR">
      <head><meta charset="utf-8"><title>Google Agenda conectado</title></head>
      <body style="font-family: Arial, sans-serif; padding: 40px;">
        <h1>Google Agenda conectado.</h1>
        <p>Voce ja pode voltar para o Coevo Meet.</p>
      </body>
    </html>
    """
    return Response(content=html, media_type="text/html")


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


@app.get(
    "/meetings/recent",
    response_model=list[MeetingRecentSummary],
    dependencies=[Depends(verify_agent_api_key)],
)
async def get_recent_meetings(limit: int = 20) -> list[MeetingRecentSummary]:
    safe_limit = min(max(limit, 1), 100)
    return list(await list_recent_meetings(settings=settings, limit=safe_limit))


@app.get("/meetings/history", response_model=list[MeetingRecentSummary])
async def get_meeting_history(limit: int = 20) -> list[MeetingRecentSummary]:
    safe_limit = min(max(limit, 1), 50)
    return list(await list_recent_meetings(settings=settings, limit=safe_limit))


@app.get("/meetings/{meeting_id}", response_model=Meeting)
async def get_meeting(meeting_id: str) -> Meeting:
    return await ensure_meeting(settings=settings, meeting_id=meeting_id)


async def finalize_meeting(meeting_id: str) -> Meeting:
    stopped_recording = None
    try:
        stopped_recording = await stop_active_meeting_recording(
            settings=settings,
            meeting_id=meeting_id,
        )
    except Exception:
        logger.exception("failed to stop active recording during meeting finalization")

    if stopped_recording and not stopped_recording.location:
        logger.error(
            "meeting finalized but recording has no saved location",
            extra={
                "meeting_id": meeting_id,
                "egress_id": stopped_recording.egress_id,
                "status": stopped_recording.status,
                "error": stopped_recording.error,
            },
        )

    meeting = await mark_meeting_ended(settings=settings, meeting_id=meeting_id)
    await send_deferred_meeting_emails(meeting_id)
    job = await enqueue_meeting_memory_processing(
        settings=settings,
        meeting_id=meeting_id,
    )
    task = asyncio.create_task(
        run_meeting_processing_job(settings=settings, job_id=job.id)
    )
    task.add_done_callback(log_background_task_failure)
    return meeting


@app.post("/meetings/{meeting_id}/end", response_model=Meeting)
async def end_meeting(
    meeting_id: str,
    claims: ParticipantClaims = Depends(get_participant_claims),
) -> Meeting:
    require_sales_panel_access(claims, meeting_id)
    return await finalize_meeting(meeting_id)


@app.post(
    "/meetings/{meeting_id}/recording/start",
    response_model=RecordingStartResponse,
)
async def start_recording(
    meeting_id: str,
    claims: ParticipantClaims = Depends(get_participant_claims),
) -> RecordingStartResponse:
    require_sales_panel_access(claims, meeting_id)
    await ensure_meeting(settings=settings, meeting_id=meeting_id)
    try:
        return await start_meeting_recording(
            settings=settings,
            meeting_id=meeting_id,
        )
    except Exception as exc:
        logger.exception("failed to start meeting recording")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not start LiveKit Egress recording.",
        ) from exc


@app.post("/meetings/{meeting_id}/recording/stop", response_model=MeetingRecording | None)
async def stop_recording(
    meeting_id: str,
    claims: ParticipantClaims = Depends(get_participant_claims),
) -> MeetingRecording | None:
    require_sales_panel_access(claims, meeting_id)
    await ensure_meeting(settings=settings, meeting_id=meeting_id)
    try:
        return await stop_active_meeting_recording(
            settings=settings,
            meeting_id=meeting_id,
        )
    except Exception as exc:
        logger.exception("failed to stop meeting recording")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not stop LiveKit Egress recording.",
        ) from exc


@app.get("/meetings/{meeting_id}/recordings", response_model=list[MeetingRecording])
async def get_meeting_recordings(
    meeting_id: str,
    claims: ParticipantClaims = Depends(get_participant_claims),
) -> list[MeetingRecording]:
    if claims.meeting_id != meeting_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Participant token does not belong to this meeting.",
        )
    return list(await list_meeting_recordings(settings=settings, meeting_id=meeting_id))


@app.get(
    "/recordings/health",
    response_model=RecordingHealthResponse,
    dependencies=[Depends(verify_agent_api_key)],
)
async def get_recording_health(
    response: Response,
    limit: int = 50,
) -> RecordingHealthResponse:
    safe_limit = min(max(limit, 1), 200)
    health = await recording_health(settings=settings, limit=safe_limit)
    if not health.healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        logger.error("recording health check failed", extra=health.model_dump())
    return health


@app.post("/livekit/webhook")
async def livekit_webhook(request: Request) -> dict[str, str]:
    body = await request.body()
    auth_header = request.headers.get("Authorization", "")
    try:
        receiver = api.WebhookReceiver(
            api.TokenVerifier(settings.livekit_api_key, settings.livekit_api_secret)
        )
        event = receiver.receive(body.decode("utf-8"), auth_header)
    except Exception as exc:
        logger.warning("invalid livekit webhook", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid LiveKit webhook.",
        ) from exc

    event_name = getattr(event, "event", "")
    room = getattr(event, "room", None)
    meeting_id = getattr(room, "name", None)
    if event_name == LIVEKIT_WEBHOOK_ROOM_FINISHED and meeting_id:
        try:
            await finalize_meeting(meeting_id)
        except Exception:
            logger.exception("failed to finalize meeting from livekit webhook")
    elif event_name == LIVEKIT_WEBHOOK_PARTICIPANT_LEFT and meeting_id:
        task = asyncio.create_task(finalize_meeting_if_no_humans(meeting_id))
        task.add_done_callback(log_background_task_failure)
    elif event_name in {LIVEKIT_WEBHOOK_EGRESS_ENDED, LIVEKIT_WEBHOOK_EGRESS_UPDATED}:
        egress_info = getattr(event, "egress_info", None) or getattr(event, "egress", None)
        if egress_info:
            try:
                await save_egress_info(settings=settings, info=egress_info)
            except Exception:
                logger.exception("failed to save egress info from livekit webhook")

    return {"status": "ok"}


@app.post("/integrations/whatsapp/evo/webhook")
async def evo_whatsapp_webhook(
    request: Request,
    x_evo_webhook_secret: str | None = Header(default=None),
) -> dict[str, str]:
    if not settings.evo_api_enabled:
        return {"status": "disabled"}

    if (
        settings.evo_api_webhook_secret
        and x_evo_webhook_secret != settings.evo_api_webhook_secret
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Evo webhook secret.",
        )

    payload = await request.json()
    payload_summary = summarize_evo_payload(payload)
    inbound = parse_evo_webhook_payload(payload)
    if inbound is None:
        logger.info("ignored whatsapp webhook payload without supported message")
        await insert_whatsapp_webhook_event(
            settings=settings,
            event_type=str(payload_summary.get("event") or "unknown"),
            status="ignored",
            is_group=bool(payload_summary.get("is_group")),
            group_id=str(payload_summary.get("remote_jid") or "") or None,
            message_id=str(payload_summary.get("message_id") or "") or None,
            detail=str(payload_summary),
        )
        return {"status": "ignored"}

    permission_phone = inbound.sender_phone or inbound.phone
    if not whatsapp_phone_is_allowed(settings=settings, phone=permission_phone):
        logger.warning(
            "blocked whatsapp message from unauthorized phone: phone=%s group=%s",
            permission_phone,
            inbound.is_group,
        )
        await insert_whatsapp_webhook_event(
            settings=settings,
            event_type=str(payload_summary.get("event") or "unknown"),
            status="blocked",
            phone=permission_phone,
            is_group=inbound.is_group,
            group_id=inbound.group_id,
            message_id=inbound.message_id,
            detail=f"phone not in WHATSAPP_ALLOWED_PHONES | {payload_summary}",
        )
        return {"status": "blocked"}

    instance = inbound.instance or settings.evo_api_instance
    if not instance:
        logger.error("whatsapp webhook received without configured Evo instance")
        return {"status": "missing-instance"}

    message_text = inbound.text
    should_reply_with_audio = False
    if inbound.has_audio:
        if not inbound.audio_base64:
            await send_evo_text(
                settings=settings,
                instance=instance,
                phone=inbound.phone,
                text=(
                    "Recebi seu audio, mas minha conexao com o WhatsApp ainda nao recebeu "
                    "o arquivo de midia. Ative webhook_base64 na Evo API para eu conseguir ouvir."
                ),
            )
            return {"status": "audio-without-base64"}

        try:
            message_text = await transcribe_whatsapp_audio(
                settings=settings,
                audio_base64=inbound.audio_base64,
                mimetype=inbound.audio_mimetype,
            )
            should_reply_with_audio = settings.whatsapp_send_audio_replies
        except Exception:
            logger.exception("failed to transcribe whatsapp audio")
            await send_evo_text(
                settings=settings,
                instance=instance,
                phone=inbound.phone,
                text=(
                    "Recebi seu audio, mas nao consegui transcrever agora. "
                    "Pode me mandar a mensagem em texto?"
                ),
            )
            return {"status": "audio-transcription-failed"}

    if len(message_text.strip()) < 3:
        await send_evo_text(
            settings=settings,
            instance=instance,
            phone=inbound.phone,
            text="Nao consegui entender bem. Pode me mandar um pouco mais de contexto?",
        )
        await insert_whatsapp_webhook_event(
            settings=settings,
            event_type=str(payload_summary.get("event") or "unknown"),
            status="message-too-short",
            phone=permission_phone,
            is_group=inbound.is_group,
            group_id=inbound.group_id,
            message_id=inbound.message_id,
            detail=str(payload_summary),
        )
        return {"status": "message-too-short"}

    if inbound.is_group:
        if not settings.whatsapp_group_enabled or not inbound.group_id:
            return {"status": "group-disabled"}

        logger.info(
            "received whatsapp group message: group_id=%s sender=%s type=%s",
            inbound.group_id,
            inbound.sender_phone or inbound.phone,
            inbound.message_type,
        )
        await insert_whatsapp_group_message(
            settings=settings,
            group_id=inbound.group_id,
            group_name=inbound.group_name,
            sender_phone=inbound.sender_phone or inbound.phone,
            sender_name=inbound.sender_name,
            message_type=inbound.message_type,
            content=message_text,
            message_id=inbound.message_id,
        )

        if not should_respond_to_group_message(message_text):
            await insert_whatsapp_webhook_event(
                settings=settings,
                event_type=str(payload_summary.get("event") or "unknown"),
                status="group-message-saved",
                phone=permission_phone,
                is_group=True,
                group_id=inbound.group_id,
                message_id=inbound.message_id,
                detail=str(payload_summary),
            )
            return {"status": "group-message-saved"}

        answer = await answer_whatsapp_group_message(
            settings=settings,
            group_id=inbound.group_id,
            requester_name=inbound.sender_name,
            text=message_text,
        )
        await send_evo_text(
            settings=settings,
            instance=instance,
            phone=inbound.group_id,
            text=answer,
        )
        await insert_whatsapp_webhook_event(
            settings=settings,
            event_type=str(payload_summary.get("event") or "unknown"),
            status="group-response-sent",
            phone=permission_phone,
            is_group=True,
            group_id=inbound.group_id,
            message_id=inbound.message_id,
            detail=str(payload_summary),
        )
        return {"status": "group-response-sent"}

    response = await respond_with_agent_memory(
        settings=settings,
        payload=AgentRespondRequest(
            message=message_text,
            agent_id="coevo",
            organization_id="default",
            channel="whatsapp",
            user_id=f"whatsapp:{inbound.phone}",
            user_name=inbound.sender_name,
            requester_role="host",
        ),
    )

    if should_reply_with_audio:
        try:
            audio_base64 = await synthesize_whatsapp_audio(
                settings=settings,
                text=response.assistant_message.content,
            )
            await send_evo_audio(
                settings=settings,
                instance=instance,
                phone=inbound.phone,
                audio_base64=audio_base64,
            )
            return {"status": "audio-sent"}
        except Exception:
            logger.exception("failed to send whatsapp audio response")

    try:
        await send_evo_text(
            settings=settings,
            instance=instance,
            phone=inbound.phone,
            text=response.assistant_message.content,
        )
    except Exception:
        logger.exception("failed to send whatsapp response through Evo API")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to send WhatsApp response.",
        )

    return {"status": "sent"}


@app.get(
    "/integrations/whatsapp/evo/events",
    response_model=list[WhatsAppWebhookEvent],
    dependencies=[Depends(verify_agent_api_key)],
)
async def get_evo_whatsapp_events(limit: int = 30) -> list[WhatsAppWebhookEvent]:
    safe_limit = min(max(limit, 1), 100)
    return list(await list_whatsapp_webhook_events(settings=settings, limit=safe_limit))



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

    if payload.role not in ("host", "commercial"):
        join_request = await get_meeting_join_request_by_email(
            settings=settings,
            meeting_id=meeting.id,
            email=str(payload.email),
        )
        if join_request is not None and join_request.status == "denied":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Sua entrada nesta reuniao foi recusada pelo Host.",
            )

        if join_request is None or join_request.status != "approved":
            join_request = await upsert_meeting_join_request(
                settings=settings,
                meeting_id=meeting.id,
                name=payload.name,
                email=str(payload.email),
                role=payload.role,
            )

            return LiveKitTokenResponse(
                token="",
                url=settings.livekit_url,
                room=meeting.id,
                identity="",
                role=payload.role,
                participant_access_token="",
                awaiting_approval=True,
                join_request_id=join_request.id,
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
        identity=identity,
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


@app.get(
    "/meetings/{meeting_id}/join-requests",
    response_model=list[MeetingJoinRequest],
)
async def get_join_requests(
    meeting_id: str,
    status_filter: str | None = None,
    claims: ParticipantClaims = Depends(get_participant_claims),
) -> list[MeetingJoinRequest]:
    require_sales_panel_access(claims, meeting_id)
    if status_filter and status_filter not in {"pending", "approved", "denied"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status de solicitacao invalido.",
        )
    return list(
        await list_meeting_join_requests(
            settings=settings,
            meeting_id=meeting_id,
            status=status_filter,
        )
    )


@app.get(
    "/meetings/{meeting_id}/join-requests/{request_id}",
    response_model=MeetingJoinRequest,
)
async def get_join_request_status(
    meeting_id: str,
    request_id: int,
) -> MeetingJoinRequest:
    requests = await list_meeting_join_requests(settings=settings, meeting_id=meeting_id)
    for join_request in requests:
        if join_request.id == request_id:
            return join_request
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Solicitacao de entrada nao encontrada.",
    )


@app.patch(
    "/meetings/{meeting_id}/join-requests/{request_id}",
    response_model=MeetingJoinRequest,
)
async def decide_join_request(
    meeting_id: str,
    request_id: int,
    payload: MeetingJoinRequestDecision,
    claims: ParticipantClaims = Depends(get_participant_claims),
) -> MeetingJoinRequest:
    require_sales_panel_access(claims, meeting_id)
    join_request = await update_meeting_join_request_status(
        settings=settings,
        meeting_id=meeting_id,
        request_id=request_id,
        status=payload.status,
    )
    if join_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitacao de entrada nao encontrada.",
        )
    return join_request


def dedupe_emails(values: list[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for value in values:
        email = value.strip().lower()
        if email and email not in seen:
            seen.add(email)
            deduped.append(email)
    return deduped


def normalize_lookup_value(value: str) -> str:
    return " ".join(value.strip().lower().split())


def resolve_participant_emails_by_names_or_emails(
    *,
    participants,
    values: list[str],
) -> tuple[list[str], list[str]]:
    by_email = {
        normalize_lookup_value(str(participant.email)): str(participant.email)
        for participant in participants
    }
    by_name: dict[str, list[str]] = {}
    for participant in participants:
        by_name.setdefault(normalize_lookup_value(participant.name), []).append(
            str(participant.email)
        )

    resolved: list[str] = []
    unknown: list[str] = []
    for value in values:
        normalized = normalize_lookup_value(value)
        if not normalized:
            continue
        if normalized in by_email:
            resolved.append(by_email[normalized])
            continue
        if normalized in by_name:
            resolved.extend(by_name[normalized])
            continue
        partial_name_matches = [
            email
            for name, emails in by_name.items()
            for email in emails
            if normalized in name or name in normalized
        ]
        if len(partial_name_matches) == 1:
            resolved.extend(partial_name_matches)
            continue
        unknown.append(value)

    return dedupe_emails(resolved), unknown


def resolve_voice_command_requester(
    *,
    participants,
    requester_identity: str,
    requester_name: str,
):
    for participant in participants:
        if participant.identity == requester_identity:
            return participant

    normalized_name = requester_name.strip().lower()
    if normalized_name:
        named_matches = [
            participant
            for participant in participants
            if participant.name.strip().lower() == normalized_name
        ]
        if len(named_matches) == 1:
            return named_matches[0]

    hosts = [participant for participant in participants if participant.role == "host"]
    if len(hosts) == 1:
        return hosts[0]

    if hosts:
        host_emails = {str(participant.email).lower() for participant in hosts}
        participant_roles = {participant.role for participant in participants}
        if len(host_emails) == 1 or participant_roles == {"host"}:
            return hosts[-1]

    return None


def ensure_host_requester(*, participants, requester_identity: str, requester_name: str):
    requester = None
    for participant in participants:
        if participant.identity == requester_identity:
            requester = participant
            break

    if requester is None:
        requester = resolve_voice_command_requester(
            participants=participants,
            requester_identity=requester_identity,
            requester_name=requester_name,
        )

    if requester is None or requester.role != "host":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the Host can execute this voice command.",
        )

    return requester


async def resolve_meeting_email_action(
    *,
    meeting_id: str,
    payload: MeetingEmailActionRequest,
):
    profile = await get_agent_profile(settings=settings)
    if "send_email" not in profile.enabled_actions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email action is disabled in agent settings.",
        )

    if "resend_email" not in profile.enabled_integrations:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Resend email integration is disabled in agent settings.",
        )

    participants = await list_meeting_participants(
        settings=settings,
        meeting_id=meeting_id,
    )
    requester = await get_meeting_participant_by_identity(
        settings=settings,
        meeting_id=meeting_id,
        identity=payload.requester_identity,
    )
    if requester is None:
        requester = resolve_voice_command_requester(
            participants=participants,
            requester_identity=payload.requester_identity,
            requester_name=payload.requester_name,
        )

    if requester is None:
        await insert_meeting_agent_action(
            settings=settings,
            meeting_id=meeting_id,
            requester_identity=payload.requester_identity,
            requester_name=payload.requester_name,
            action_type="send_email",
            status="blocked",
            payload=payload.model_dump(mode="json"),
            result={"reason": "requester_not_found"},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requester was not found in this meeting.",
        )

    if requester.role not in profile.voice_command_roles:
        await insert_meeting_agent_action(
            settings=settings,
            meeting_id=meeting_id,
            requester_identity=payload.requester_identity,
            requester_name=payload.requester_name,
            action_type="send_email",
            status="blocked",
            payload=payload.model_dump(mode="json"),
            result={"reason": "role_not_allowed", "role": requester.role},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requester role cannot execute this voice command.",
        )

    if requester.role != "host":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="For now, only the Host can send emails by voice.",
        )

    if payload.recipient_scope == "custom":
        recipients, unknown_recipients = resolve_participant_emails_by_names_or_emails(
            participants=participants,
            values=payload.recipients,
        )
        if unknown_recipients:
            await insert_meeting_agent_action(
                settings=settings,
                meeting_id=meeting_id,
                requester_identity=payload.requester_identity,
                requester_name=payload.requester_name,
                action_type="send_email",
                status="blocked",
                payload=payload.model_dump(mode="json"),
                result={
                    "reason": "recipients_not_in_meeting",
                    "recipients": unknown_recipients,
                },
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Emails can only be sent to people who joined this meeting. "
                    "Use participant names or emails from this meeting."
                ),
            )
    elif payload.recipient_scope == "clients":
        recipients = dedupe_emails(
            [
                str(participant.email)
                for participant in participants
                if participant.role in ("client", "observer")
            ]
        )
    elif payload.recipient_scope == "host":
        recipients = [str(requester.email)]
    else:
        recipients = dedupe_emails(
            [str(participant.email) for participant in participants]
        )

    if not recipients:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No recipients were found for this email action.",
        )

    return requester, recipients


async def send_meeting_email_payload(
    *,
    meeting_id: str,
    payload: MeetingEmailActionRequest,
    action_status: str = "sent",
) -> MeetingEmailActionResponse:
    requester, recipients = await resolve_meeting_email_action(
        meeting_id=meeting_id,
        payload=payload,
    )
    body = (
        f"{payload.body.strip()}\n\n"
        f"---\n"
        f"Enviado pelo Coevo a pedido de {requester.name} durante a reuniao."
    )
    try:
        await send_meeting_action_email(
            settings=settings,
            sender_name=requester.name,
            sender_email=requester.email,
            recipients=recipients,
            subject=payload.subject,
            body=body,
        )
    except GoogleCalendarAPIError as exc:
        await insert_meeting_agent_action(
            settings=settings,
            meeting_id=meeting_id,
            requester_identity=payload.requester_identity,
            requester_name=payload.requester_name,
            action_type="schedule_meeting",
            status="failed",
            payload=payload.model_dump(mode="json"),
            result={"reason": exc.public_detail},
        )
        logger.exception("meeting calendar action failed")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.public_detail,
        ) from exc
    except Exception as exc:
        await insert_meeting_agent_action(
            settings=settings,
            meeting_id=meeting_id,
            requester_identity=payload.requester_identity,
            requester_name=payload.requester_name,
            action_type="send_email",
            status="failed",
            payload=payload.model_dump(mode="json"),
            result={"reason": str(exc)},
        )
        logger.exception("meeting email action failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Email could not be sent.",
        ) from exc

    response = MeetingEmailActionResponse(
        sent=True,
        recipient_count=len(recipients),
        recipients=recipients,
        sender_name=requester.name,
        sender_email=requester.email,
    )
    await insert_meeting_agent_action(
        settings=settings,
        meeting_id=meeting_id,
        requester_identity=payload.requester_identity,
        requester_name=requester.name,
        action_type="send_email",
        status=action_status,
        payload=payload.model_dump(mode="json"),
        result=response.model_dump(mode="json"),
    )
    return response


async def build_meeting_summary_email_body(
    *,
    meeting_id: str,
    fallback_body: str,
) -> str:
    segments = await list_transcript_segments(settings=settings, meeting_id=meeting_id)
    transcript_lines = [
        f"{segment.speaker_name}: {segment.content}"
        for segment in segments[-120:]
    ]
    transcript = "\n".join(transcript_lines).strip()

    if not transcript:
        return (
            f"{fallback_body.strip()}\n\n"
            "Observacao: nao encontrei transcricao suficiente para gerar um resumo "
            "automatico desta reuniao."
        )

    if not settings.openai_api_key:
        return (
            "Resumo da reuniao\n\n"
            "A transcricao foi registrada, mas a chave da OpenAI nao esta configurada "
            "para gerar o resumo automatico.\n\n"
            f"Transcricao recente:\n{transcript[:6000]}"
        )

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    prompt = f"""
Voce e o Coevo. Gere um e-mail profissional em portugues do Brasil com o resumo
da reuniao abaixo.

Inclua obrigatoriamente estas secoes:
1. Resumo executivo
2. Principais pontos discutidos
3. Decisoes tomadas
4. Proximos passos
5. Pendencias e responsaveis, quando existirem

Se algum item nao aparecer na transcricao, escreva "Nao identificado na reuniao".
Seja claro, objetivo e util para todos os participantes.

Transcricao:
{transcript[:18000]}
"""
    try:
        response = await client.responses.create(
            model=settings.openai_summary_model,
            input=prompt,
        )
        summary = response.output_text.strip()
    except OpenAIError:
        logger.exception("meeting summary generation failed")
        return (
            f"{fallback_body.strip()}\n\n"
            "Observacao: nao foi possivel gerar o resumo automatico no encerramento."
        )

    return summary or fallback_body


async def send_deferred_meeting_emails(meeting_id: str) -> None:
    pending_emails = await list_pending_meeting_emails(
        settings=settings,
        meeting_id=meeting_id,
    )
    if pending_emails:
        logger.info(
            "sending deferred meeting emails",
            extra={"meeting_id": meeting_id, "count": len(pending_emails)},
        )
    for pending_email in pending_emails:
        pending_email_id = int(pending_email["id"])
        try:
            payload = MeetingEmailActionRequest.model_validate(pending_email["payload"])
            summary_body = await build_meeting_summary_email_body(
                meeting_id=meeting_id,
                fallback_body=payload.body,
            )
            payload = payload.model_copy(
                update={
                    "subject": payload.subject
                    if "resumo" in payload.subject.lower()
                    else f"Resumo da reuniao - {payload.subject}",
                    "body": summary_body,
                }
            )
            response = await send_meeting_email_payload(
                meeting_id=meeting_id,
                payload=payload,
                action_status="sent_after_meeting",
            )
            await mark_pending_meeting_email(
                settings=settings,
                pending_email_id=pending_email_id,
                status="sent",
                result=response.model_dump(mode="json"),
            )
        except Exception as exc:
            logger.exception(
                "deferred meeting email failed",
                extra={"meeting_id": meeting_id, "pending_email_id": pending_email_id},
            )
            await mark_pending_meeting_email(
                settings=settings,
                pending_email_id=pending_email_id,
                status="failed",
                result={"reason": str(exc)},
            )


@app.post(
    "/meetings/{meeting_id}/actions/email",
    response_model=MeetingEmailActionResponse,
    dependencies=[Depends(verify_agent_api_key)],
)
async def send_meeting_email_action(
    meeting_id: str,
    payload: MeetingEmailActionRequest,
) -> MeetingEmailActionResponse:
    await ensure_meeting(settings=settings, meeting_id=meeting_id)
    return await send_meeting_email_payload(meeting_id=meeting_id, payload=payload)


@app.post(
    "/meetings/{meeting_id}/actions/email/defer",
    response_model=MeetingEmailDeferResponse,
    dependencies=[Depends(verify_agent_api_key)],
)
async def defer_meeting_email_action(
    meeting_id: str,
    payload: MeetingEmailActionRequest,
) -> MeetingEmailDeferResponse:
    await ensure_meeting(settings=settings, meeting_id=meeting_id)
    requester, _ = await resolve_meeting_email_action(
        meeting_id=meeting_id,
        payload=payload,
    )
    pending_email_id = await insert_meeting_pending_email(
        settings=settings,
        meeting_id=meeting_id,
        requester_identity=payload.requester_identity,
        requester_name=requester.name,
        payload=payload.model_dump(mode="json"),
    )
    await insert_meeting_agent_action(
        settings=settings,
        meeting_id=meeting_id,
        requester_identity=payload.requester_identity,
        requester_name=requester.name,
        action_type="send_email",
        status="deferred",
        payload=payload.model_dump(mode="json"),
        result={"pending_email_id": pending_email_id},
    )
    return MeetingEmailDeferResponse(deferred=True, pending_email_id=pending_email_id)


@app.get(
    "/meetings/{meeting_id}/agent-actions",
    dependencies=[Depends(verify_agent_api_key)],
)
async def get_meeting_agent_actions(meeting_id: str) -> list[dict]:
    await ensure_meeting(settings=settings, meeting_id=meeting_id)
    return await list_meeting_agent_actions(
        settings=settings,
        meeting_id=meeting_id,
    )


@app.post(
    "/meetings/{meeting_id}/actions/web-search",
    response_model=MeetingWebSearchResponse,
    dependencies=[Depends(verify_agent_api_key)],
)
async def run_meeting_web_search(
    meeting_id: str,
    payload: MeetingWebSearchRequest,
) -> MeetingWebSearchResponse:
    await ensure_meeting(settings=settings, meeting_id=meeting_id)
    profile = await get_agent_profile(settings=settings)
    if "web_search" not in profile.enabled_actions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Web search is disabled in agent settings.",
        )

    if "web_search" not in profile.enabled_integrations:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Web search integration is disabled in agent settings.",
        )

    participants = await list_meeting_participants(
        settings=settings,
        meeting_id=meeting_id,
    )
    requester = ensure_host_requester(
        participants=participants,
        requester_identity=payload.requester_identity,
        requester_name=payload.requester_name,
    )

    try:
        results = await search_web(payload.query)
    except Exception as exc:
        await insert_meeting_agent_action(
            settings=settings,
            meeting_id=meeting_id,
            requester_identity=payload.requester_identity,
            requester_name=payload.requester_name,
            action_type="web_search",
            status="failed",
            payload=payload.model_dump(mode="json"),
            result={"reason": str(exc)},
        )
        logger.exception("meeting web search failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Web search could not be completed.",
        ) from exc

    response = MeetingWebSearchResponse(query=payload.query, results=results)
    await insert_meeting_agent_action(
        settings=settings,
        meeting_id=meeting_id,
        requester_identity=payload.requester_identity,
        requester_name=requester.name,
        action_type="web_search",
        status="completed",
        payload=payload.model_dump(mode="json"),
        result=response.model_dump(mode="json"),
    )
    return response


@app.post(
    "/meetings/{meeting_id}/agent/intervention-check",
    response_model=MeetingInterventionCheckResponse,
    dependencies=[Depends(verify_agent_api_key)],
)
async def check_agent_intervention(
    meeting_id: str,
    payload: MeetingInterventionCheckRequest,
) -> MeetingInterventionCheckResponse:
    await ensure_meeting(settings=settings, meeting_id=meeting_id)
    knowledge_context = ""
    try:
        knowledge_response = await search_knowledge(
            settings=settings,
            query=payload.transcript,
            top_k=3,
            meeting_id=meeting_id,
        )
        knowledge_context = "\n\n".join(
            f"Fonte: {result.filename}\nTrecho: {result.content}"
            for result in knowledge_response.results[:3]
        )
    except Exception:
        logger.info("intervention knowledge context unavailable", exc_info=True)

    try:
        recent_segments = await list_transcript_segments(
            settings=settings,
            meeting_id=meeting_id,
        )
        recent_context = "\n".join(
            f"{segment.speaker_name}: {segment.content}"
            for segment in recent_segments[-10:]
        )
        if recent_context:
            knowledge_context = (
                f"{knowledge_context}\n\nTranscricao recente:\n{recent_context}"
                if knowledge_context
                else f"Transcricao recente:\n{recent_context}"
            )
    except Exception:
        logger.info("intervention transcript context unavailable", exc_info=True)

    return await evaluate_intervention(
        settings=settings,
        speaker_name=payload.speaker_name,
        transcript=payload.transcript,
        knowledge_context=knowledge_context,
    )


@app.post(
    "/meetings/{meeting_id}/actions/calendar-event",
    response_model=MeetingCalendarActionResponse,
    dependencies=[Depends(verify_agent_api_key)],
)
async def create_meeting_calendar_action(
    meeting_id: str,
    payload: MeetingCalendarActionRequest,
) -> MeetingCalendarActionResponse:
    await ensure_meeting(settings=settings, meeting_id=meeting_id)
    profile = await get_agent_profile(settings=settings)
    if "schedule_meeting" not in profile.enabled_actions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Calendar action is disabled in agent settings.",
        )

    if "google_calendar" not in profile.enabled_integrations:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Google Calendar integration is disabled in agent settings.",
        )

    connection = await get_google_calendar_connection(settings=settings)
    if not google_calendar_can_create_events(connection):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Google Calendar must be reconnected to authorize event creation.",
        )

    participants = await list_meeting_participants(
        settings=settings,
        meeting_id=meeting_id,
    )
    requester = await get_meeting_participant_by_identity(
        settings=settings,
        meeting_id=meeting_id,
        identity=payload.requester_identity,
    )
    if requester is None:
        requester = resolve_voice_command_requester(
            participants=participants,
            requester_identity=payload.requester_identity,
            requester_name=payload.requester_name,
        )

    if requester is None or requester.role != "host":
        await insert_meeting_agent_action(
            settings=settings,
            meeting_id=meeting_id,
            requester_identity=payload.requester_identity,
            requester_name=payload.requester_name,
            action_type="schedule_meeting",
            status="blocked",
            payload=payload.model_dump(mode="json"),
            result={"reason": "host_not_recognized"},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the Host can schedule meetings by voice.",
        )

    if payload.attendee_scope == "custom":
        attendees = dedupe_emails([str(email) for email in payload.attendees])
    elif payload.attendee_scope == "clients":
        attendees = dedupe_emails(
            [
                str(participant.email)
                for participant in participants
                if participant.role in ("client", "observer")
            ]
        )
    elif payload.attendee_scope == "host":
        attendees = [str(requester.email)]
    else:
        attendees = dedupe_emails([str(participant.email) for participant in participants])

    if not attendees:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No attendees were found for this calendar action.",
        )

    try:
        event = await create_google_calendar_event(
            settings=settings,
            title=payload.title,
            description=(
                f"{payload.description.strip()}\n\n"
                f"Criado pelo Coevo a pedido de {requester.name} durante a reuniao."
            ),
            start_time=payload.start_time,
            duration_minutes=payload.duration_minutes,
            attendees=attendees,
        )
    except Exception as exc:
        await insert_meeting_agent_action(
            settings=settings,
            meeting_id=meeting_id,
            requester_identity=payload.requester_identity,
            requester_name=payload.requester_name,
            action_type="schedule_meeting",
            status="failed",
            payload=payload.model_dump(mode="json"),
            result={"reason": str(exc)},
        )
        logger.exception("meeting calendar action failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Calendar event could not be created.",
        ) from exc

    response = MeetingCalendarActionResponse(
        created=True,
        event_id=event.get("id", ""),
        html_link=event.get("htmlLink"),
        attendee_count=len(attendees),
        attendees=attendees,
        organizer_email=connection.get("calendar_email") if connection else None,
    )
    await insert_meeting_agent_action(
        settings=settings,
        meeting_id=meeting_id,
        requester_identity=payload.requester_identity,
        requester_name=requester.name,
        action_type="schedule_meeting",
        status="created",
        payload=payload.model_dump(mode="json"),
        result=response.model_dump(mode="json"),
    )
    return response


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


def can_read_memory_item(item: MeetingMemoryItem, claims: ParticipantClaims) -> bool:
    if item.visibility == "organization":
        return True
    if claims.role in item.allowed_role_ids:
        return True
    return claims.email.lower() in [value.lower() for value in item.allowed_user_ids]


@app.post(
    "/meetings/{meeting_id}/memory/process",
    response_model=MeetingProcessingJob,
    dependencies=[Depends(verify_agent_api_key)],
)
async def process_meeting_memory_endpoint(
    meeting_id: str,
    force: bool = False,
) -> MeetingProcessingJob:
    await ensure_meeting(settings=settings, meeting_id=meeting_id)
    job = await enqueue_meeting_memory_processing(
        settings=settings,
        meeting_id=meeting_id,
        force=force,
    )
    processed = await run_meeting_processing_job(
        settings=settings,
        job_id=job.id,
        force=force,
    )
    return processed or job


@app.post(
    "/meetings/{meeting_id}/processing/retry",
    response_model=MeetingProcessingJob,
    dependencies=[Depends(verify_agent_api_key)],
)
async def retry_meeting_processing(
    meeting_id: str,
) -> MeetingProcessingJob:
    await ensure_meeting(settings=settings, meeting_id=meeting_id)
    job = await enqueue_meeting_memory_processing(
        settings=settings,
        meeting_id=meeting_id,
        force=True,
    )
    processed = await run_meeting_processing_job(
        settings=settings,
        job_id=job.id,
        force=True,
    )
    return processed or job


@app.get(
    "/meetings/{meeting_id}/processing",
    response_model=list[MeetingProcessingJob],
    dependencies=[Depends(verify_agent_api_key)],
)
async def get_meeting_processing(
    meeting_id: str,
) -> list[MeetingProcessingJob]:
    await ensure_meeting(settings=settings, meeting_id=meeting_id)
    return list(
        await list_meeting_processing_jobs(settings=settings, meeting_id=meeting_id)
    )


@app.post(
    "/processing/run-pending",
    response_model=list[MeetingProcessingJob],
    dependencies=[Depends(verify_agent_api_key)],
)
async def run_pending_processing_jobs(limit: int = 10) -> list[MeetingProcessingJob]:
    safe_limit = min(max(limit, 1), 25)
    return await run_due_meeting_processing_jobs(settings=settings, limit=safe_limit)


@app.get(
    "/meetings/{meeting_id}/memory",
    response_model=list[MeetingMemoryItem],
)
async def get_meeting_memory(
    meeting_id: str,
    claims: ParticipantClaims = Depends(get_participant_claims),
) -> list[MeetingMemoryItem]:
    if claims.meeting_id != meeting_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Participant token does not belong to this meeting.",
        )

    await ensure_meeting(settings=settings, meeting_id=meeting_id)
    items = await require_memory_or_404(settings=settings, meeting_id=meeting_id)
    return [item for item in items if can_read_memory_item(item, claims)]


@app.post(
    "/meetings/{meeting_id}/memory/search",
    response_model=MeetingMemorySearchResponse,
)
async def search_meeting_memory_endpoint(
    meeting_id: str,
    payload: MeetingMemorySearchRequest,
    claims: ParticipantClaims = Depends(get_participant_claims),
) -> MeetingMemorySearchResponse:
    if claims.meeting_id != meeting_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Participant token does not belong to this meeting.",
        )

    await ensure_meeting(settings=settings, meeting_id=meeting_id)
    scoped_payload = payload.model_copy(
        update={"meeting_id": payload.meeting_id or None}
    )
    return await search_meeting_memory(
        settings=settings,
        payload=scoped_payload,
        requester_email=claims.email,
        requester_role=claims.role,
    )


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
