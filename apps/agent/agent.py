import asyncio
import contextvars
import json
import logging
import math
import os
import re
import time
import unicodedata

import aiohttp
from dotenv import load_dotenv
from openai.types.beta.realtime.session import InputAudioTranscription, TurnDetection

from livekit import agents, rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    UserInputTranscribedEvent,
    function_tool,
    room_io,
)
from livekit.plugins import openai

from prompts import SYSTEM_PROMPT

load_dotenv("../../.env")
load_dotenv(".env")

logger = logging.getLogger(__name__)

AGENT_NAME = os.getenv("JARVIS_AGENT_NAME", "jarvis")
DISPLAY_NAME = os.getenv("JARVIS_DISPLAY_NAME", "Jarvis")
OPENAI_REALTIME_MODEL = os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime")
OPENAI_REALTIME_VOICE = os.getenv("OPENAI_REALTIME_VOICE", "ash")
OPENAI_TRANSCRIPTION_MODEL = os.getenv(
    "OPENAI_TRANSCRIPTION_MODEL",
    "gpt-4o-transcribe",
)
API_URL = os.getenv("API_URL", "http://localhost:8000").rstrip("/")
AGENT_API_KEY = os.getenv("AGENT_API_KEY")
KNOWLEDGE_MIN_SCORE = float(os.getenv("KNOWLEDGE_MIN_SCORE", "0.25"))
WAKE_WORDS = (
    "coevo",
    "co evo",
    "coebo",
    "coeva",
    "jarvis",
    "jervis",
    "jarves",
    "javes",
    "jarviz",
    "jarvys",
)
SILENCE_WORDS = ("silencie", "silencio", "silenciar", "cale", "pare")
INITIAL_ACTIVE_LISTEN_SECONDS = 15.0
POST_REPLY_ACTIVE_SECONDS = 10.0
FOLLOW_UP_SILENCE_SECONDS = 5.0
VAD_THRESHOLD = float(os.getenv("JARVIS_VAD_THRESHOLD", "0.78"))
VAD_PREFIX_PADDING_MS = int(os.getenv("JARVIS_VAD_PREFIX_PADDING_MS", "250"))
VAD_SILENCE_DURATION_MS = int(os.getenv("JARVIS_VAD_SILENCE_DURATION_MS", "950"))
MIN_TRANSCRIPT_CHARS = int(os.getenv("JARVIS_MIN_TRANSCRIPT_CHARS", "12"))
MIN_TRANSCRIPT_WORDS = int(os.getenv("JARVIS_MIN_TRANSCRIPT_WORDS", "3"))
current_meeting_id: contextvars.ContextVar[str] = contextvars.ContextVar(
    "current_meeting_id",
    default="unknown-meeting",
)
current_speaker_identity: contextvars.ContextVar[str] = contextvars.ContextVar(
    "current_speaker_identity",
    default="unknown-speaker",
)
current_speaker_name: contextvars.ContextVar[str] = contextvars.ContextVar(
    "current_speaker_name",
    default="Participante",
)
current_agent_profile: contextvars.ContextVar[dict] = contextvars.ContextVar(
    "current_agent_profile",
    default={},
)
pending_email_actions: dict[tuple[str, str], dict] = {}
pending_calendar_actions: dict[tuple[str, str], dict] = {}
calendar_flow_states: dict[str, dict] = {}
pending_interventions: dict[str, dict] = {}
last_intervention_check_by_meeting: dict[str, float] = {}
AGENT_INTERVENTION_TOPIC = "coevo-agent-intervention"
INTERVENTION_CHECK_INTERVAL_SECONDS = 45.0
CALENDAR_FLOW_TIMEOUT_SECONDS = 120.0
AGENT_ORB_VIDEO_ENABLED = os.getenv("AGENT_ORB_VIDEO_ENABLED", "true").lower() in {
    "1",
    "true",
    "yes",
}
AGENT_ORB_VIDEO_WIDTH = int(os.getenv("AGENT_ORB_VIDEO_WIDTH", "360"))
AGENT_ORB_VIDEO_HEIGHT = int(os.getenv("AGENT_ORB_VIDEO_HEIGHT", "240"))
AGENT_ORB_VIDEO_FPS = float(os.getenv("AGENT_ORB_VIDEO_FPS", "8"))


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value.lower())
    without_accents = "".join(
        character for character in normalized if unicodedata.category(character) != "Mn"
    )
    return re.sub(r"[^a-z0-9 ]+", " ", without_accents)


def contains_wake_word(value: str) -> bool:
    normalized = normalize_text(value)
    words = set(normalized.split())
    if words.intersection(WAKE_WORDS):
        return True

    return any(wake_word in normalized for wake_word in WAKE_WORDS)


def contains_silence_command(value: str) -> bool:
    normalized = normalize_text(value)
    return contains_wake_word(value) and any(
        silence_word in normalized for silence_word in SILENCE_WORDS
    )


def contains_calendar_request(value: str) -> bool:
    normalized = normalize_text(value)
    calendar_terms = (
        "agenda",
        "agende",
        "agendar",
        "marque",
        "marcar",
        "crie uma reuniao",
        "criar uma reuniao",
        "google agenda",
        "calendar",
    )
    return any(term in normalized for term in calendar_terms)


def contains_action_confirmation(value: str) -> bool:
    normalized = normalize_text(value)
    confirmation_terms = (
        "sim",
        "confirmo",
        "pode",
        "pode agendar",
        "pode marcar",
        "agende",
        "marca",
        "marque",
        "ta confirmado",
        "esta confirmado",
    )
    return any(term in normalized for term in confirmation_terms)


def contains_action_cancel(value: str) -> bool:
    normalized = normalize_text(value)
    cancel_terms = (
        "cancela",
        "cancelar",
        "nao",
        "nao agenda",
        "nao agende",
        "deixa quieto",
        "desiste",
    )
    return any(term in normalized for term in cancel_terms)


def has_pending_meeting_action(meeting_id: str) -> bool:
    return any(key[0] == meeting_id for key in pending_calendar_actions) or any(
        key[0] == meeting_id for key in pending_email_actions
    )


def has_pending_calendar_action(meeting_id: str) -> bool:
    return any(key[0] == meeting_id for key in pending_calendar_actions)


def get_calendar_flow_state(meeting_id: str) -> dict | None:
    state = calendar_flow_states.get(meeting_id)
    if not state:
        return None

    updated_at = float(state.get("updated_at", 0))
    if time.monotonic() - updated_at > CALENDAR_FLOW_TIMEOUT_SECONDS:
        calendar_flow_states.pop(meeting_id, None)
        return None

    return state


def set_calendar_flow_state(
    meeting_id: str,
    *,
    mode: str,
    speaker_identity: str,
    speaker_name: str,
) -> None:
    calendar_flow_states[meeting_id] = {
        "mode": mode,
        "speaker_identity": speaker_identity,
        "speaker_name": speaker_name,
        "updated_at": time.monotonic(),
    }
    pending_interventions.pop(meeting_id, None)


def clear_calendar_flow_state(meeting_id: str) -> None:
    calendar_flow_states.pop(meeting_id, None)


async def clear_pending_intervention_if_any(
    *,
    ctx: agents.JobContext,
    meeting_id: str,
) -> None:
    pending = pending_interventions.pop(meeting_id, None)
    if pending:
        await clear_agent_intervention_hand(
            ctx=ctx,
            meeting_id=meeting_id,
            subject=pending.get("subject", ""),
        )


def contains_intervention_authorization(value: str) -> bool:
    normalized = normalize_text(value)
    if not contains_wake_word(value):
        return False

    authorization_terms = (
        "pode falar",
        "pode contribuir",
        "autorizo",
        "pode intervir",
        "autorizo a intervencao",
        "pode fazer a intervencao",
    )
    return any(term in normalized for term in authorization_terms)


def is_meaningful_transcript(value: str) -> bool:
    normalized = normalize_text(value)
    words = normalized.split()
    if contains_wake_word(value):
        return True

    if len(normalized.replace(" ", "")) < MIN_TRANSCRIPT_CHARS:
        return False

    return len(words) >= MIN_TRANSCRIPT_WORDS


def render_agent_orb_frame(
    *,
    width: int,
    height: int,
    elapsed_seconds: float,
    speaking: bool,
) -> bytes:
    data = bytearray(width * height * 4)
    cx = width / 2
    cy = height / 2
    scale = min(width, height)
    pulse = (math.sin(elapsed_seconds * (7.5 if speaking else 3.2)) + 1) / 2
    core_radius = scale * (0.145 + (0.018 if speaking else 0.008) * pulse)
    inner_ring = scale * (0.21 + 0.018 * pulse)
    outer_ring = scale * (0.31 + (0.06 if speaking else 0.03) * pulse)

    for y in range(height):
        for x in range(width):
            index = (y * width + x) * 4
            r, g, b = 7, 8, 7

            if x % 32 == 0 or y % 32 == 0:
                r, g, b = 16, 18, 17

            distance = math.hypot(x - cx, y - cy)
            vignette = min(distance / (scale * 0.72), 1.0)
            glow = max(0.0, 1.0 - distance / (outer_ring * 1.95))
            ring_strength = max(0.0, 1.0 - abs(distance - inner_ring) / 2.2)
            outer_strength = max(0.0, 1.0 - abs(distance - outer_ring) / 2.0)

            if glow:
                glow_power = glow * (0.45 if speaking else 0.26)
                r += int(246 * glow_power)
                g += int(142 * glow_power)
                b += int(56 * glow_power)

            if ring_strength:
                r = min(255, r + int(255 * ring_strength))
                g = min(255, g + int(218 * ring_strength))
                b = min(255, b + int(178 * ring_strength))

            if outer_strength:
                r = min(255, r + int(235 * outer_strength * 0.7))
                g = min(255, g + int(130 * outer_strength * 0.7))
                b = min(255, b + int(40 * outer_strength * 0.7))

            if distance <= core_radius:
                r, g, b = 9, 10, 10

            r = int(r * (1.0 - vignette * 0.35))
            g = int(g * (1.0 - vignette * 0.35))
            b = int(b * (1.0 - vignette * 0.35))

            data[index] = max(0, min(255, r))
            data[index + 1] = max(0, min(255, g))
            data[index + 2] = max(0, min(255, b))
            data[index + 3] = 255

    bar_height = int(scale * (0.085 + (0.035 if speaking else 0.018) * pulse))
    bar_width = max(4, int(scale * 0.025))
    bar_gap = max(5, int(scale * 0.032))
    bar_y0 = int(cy - bar_height / 2)
    bar_y1 = int(cy + bar_height / 2)
    first_x = int(cx - bar_width * 1.5 - bar_gap)
    for bar in range(3):
        x0 = first_x + bar * (bar_width + bar_gap)
        x1 = x0 + bar_width
        for y in range(bar_y0, bar_y1):
            if y < 0 or y >= height:
                continue
            for x in range(x0, x1):
                if x < 0 or x >= width:
                    continue
                index = (y * width + x) * 4
                data[index] = 255
                data[index + 1] = 190
                data[index + 2] = 112
                data[index + 3] = 255

    return bytes(data)


async def publish_agent_orb_video(
    ctx: agents.JobContext,
    state: dict[str, bool],
) -> None:
    if not AGENT_ORB_VIDEO_ENABLED:
        return

    width = max(240, AGENT_ORB_VIDEO_WIDTH)
    height = max(160, AGENT_ORB_VIDEO_HEIGHT)
    fps = min(max(AGENT_ORB_VIDEO_FPS, 2.0), 15.0)
    source = rtc.VideoSource(width, height)
    track = rtc.LocalVideoTrack.create_video_track("coevo_orb", source)
    publication = None

    try:
        publisher = getattr(ctx.room, "local_participant", None)
        if publisher is None:
            return

        publication = await publisher.publish_track(
            track,
            rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_CAMERA),
        )
        logger.info(
            "published coevo orb video track",
            extra={"track_sid": getattr(publication, "sid", None)},
        )

        started_at = time.monotonic()
        while True:
            frame = rtc.VideoFrame(
                width,
                height,
                rtc.VideoBufferType.RGBA,
                render_agent_orb_frame(
                    width=width,
                    height=height,
                    elapsed_seconds=time.monotonic() - started_at,
                    speaking=bool(state.get("speaking")),
                ),
            )
            source.capture_frame(frame)
            await asyncio.sleep(1 / fps)
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("failed to publish coevo orb video track")
    finally:
        if publication is not None:
            try:
                await ctx.room.local_participant.unpublish_track(publication.sid)
            except Exception:
                logger.warning("failed to unpublish coevo orb video track", exc_info=True)
        await source.aclose()


@function_tool(
    description=(
        "Busca informacoes na base institucional da empresa e na base submetida "
        "para a reuniao atual. Use quando o participante perguntar algo que "
        "possa estar nos documentos, midias ou links cadastrados."
    )
)
async def search_knowledge_base(query: str) -> str:
    headers = {"Content-Type": "application/json"}
    if AGENT_API_KEY:
        headers["X-Agent-API-Key"] = AGENT_API_KEY

    async with aiohttp.ClientSession() as http:
        async with http.post(
            f"{API_URL}/meetings/{current_meeting_id.get()}/knowledge/search",
            headers=headers,
            json={"query": query, "top_k": 5},
            timeout=aiohttp.ClientTimeout(total=10),
        ) as response:
            if response.status >= 400:
                body = await response.text()
                raise RuntimeError(
                    f"Knowledge search failed with status {response.status}: {body}"
                )
            payload = await response.json()

    results = [
        result
        for result in payload.get("results", [])
        if float(result.get("score", 0)) >= KNOWLEDGE_MIN_SCORE
    ]

    if not results:
        return (
            "NO_MATCH: Nao encontrei informacao suficiente na base de conhecimento "
            "para responder com seguranca."
        )

    formatted_results = []
    for result in results:
        formatted_results.append(
            "\n".join(
                [
                    f"Fonte: {result['filename']}",
                    f"Score: {result['score']:.3f}",
                    f"Trecho: {result['content']}",
                ]
            )
        )

    return "\n\n---\n\n".join(formatted_results)


@function_tool(
    description=(
        "Busca nas memorias persistentes de reunioes passadas. Use quando o Host "
        "perguntar sobre decisoes, promessas, proximos passos, riscos, objecoes, "
        "participantes, clientes, datas, valores ou algo dito em reunioes anteriores."
    )
)
async def search_meeting_memory(query: str) -> str:
    headers = {"Content-Type": "application/json"}
    if AGENT_API_KEY:
        headers["X-Agent-API-Key"] = AGENT_API_KEY

    async with aiohttp.ClientSession() as http:
        async with http.post(
            f"{API_URL}/agent/memory/search",
            headers=headers,
            json={"query": query, "top_k": 6},
            timeout=aiohttp.ClientTimeout(total=12),
        ) as response:
            if response.status >= 400:
                body = await response.text()
                raise RuntimeError(
                    f"Meeting memory search failed with status {response.status}: {body}"
                )
            payload = await response.json()

    results = payload.get("results", [])
    if not results:
        return (
            "NO_MEMORY_MATCH: Nao encontrei memoria suficiente de reunioes "
            "passadas para responder com seguranca."
        )

    formatted_results = []
    for result in results:
        meeting_title = result.get("meeting_title") or result.get("meeting_id")
        formatted_results.append(
            "\n".join(
                [
                    f"Reuniao: {meeting_title}",
                    f"Tipo: {result.get('memory_type')}",
                    f"Conteudo: {result.get('content')}",
                ]
            )
        )
    return "\n\n---\n\n".join(formatted_results)


def voice_email_actions_enabled() -> tuple[bool, str]:
    profile = current_agent_profile.get() or {}
    enabled_actions = profile.get("enabled_actions") or ["send_email"]
    enabled_integrations = profile.get("enabled_integrations") or ["resend_email"]
    allowed_roles = profile.get("voice_command_roles") or ["host"]

    if "send_email" not in enabled_actions:
        return False, "O envio de e-mails por voz esta desativado nas configuracoes."

    if "resend_email" not in enabled_integrations:
        return False, "A integracao de e-mail esta desativada nas configuracoes."

    if "host" not in allowed_roles:
        return False, "O Host nao esta autorizado a executar comandos por voz."

    return True, ""


def voice_calendar_actions_enabled() -> tuple[bool, str]:
    profile = current_agent_profile.get() or {}
    enabled_actions = profile.get("enabled_actions") or [
        "send_email",
        "schedule_meeting",
        "web_search",
    ]
    enabled_integrations = profile.get("enabled_integrations") or [
        "resend_email",
        "google_calendar",
        "web_search",
    ]
    allowed_roles = profile.get("voice_command_roles") or ["host"]

    if "schedule_meeting" not in enabled_actions:
        return False, "O agendamento por voz esta desativado nas configuracoes."

    if "google_calendar" not in enabled_integrations:
        return False, "A integracao com Google Agenda esta desativada."

    if "host" not in allowed_roles:
        return False, "O Host nao esta autorizado a executar comandos por voz."

    return True, ""


def voice_web_search_enabled() -> tuple[bool, str]:
    profile = current_agent_profile.get() or {}
    enabled_actions = profile.get("enabled_actions") or [
        "send_email",
        "schedule_meeting",
        "web_search",
    ]
    enabled_integrations = profile.get("enabled_integrations") or [
        "resend_email",
        "google_calendar",
        "web_search",
    ]
    allowed_roles = profile.get("voice_command_roles") or ["host"]

    if "web_search" not in enabled_actions:
        return False, "A consulta na internet esta desativada nas configuracoes."

    if "web_search" not in enabled_integrations:
        return False, "A integracao de busca na internet esta desativada."

    if "host" not in allowed_roles:
        return False, "O Host nao esta autorizado a executar comandos por voz."

    return True, ""


def get_pending_email_action(meeting_id: str, speaker_identity: str) -> tuple[tuple[str, str], dict] | tuple[None, None]:
    action_key = (meeting_id, speaker_identity)
    pending = pending_email_actions.get(action_key)
    if pending:
        return action_key, pending

    meeting_pending = [
        (key, value)
        for key, value in pending_email_actions.items()
        if key[0] == meeting_id
    ]
    if len(meeting_pending) == 1:
        return meeting_pending[0]

    return None, None


def get_pending_calendar_action(meeting_id: str, speaker_identity: str) -> tuple[tuple[str, str], dict] | tuple[None, None]:
    action_key = (meeting_id, speaker_identity)
    pending = pending_calendar_actions.get(action_key)
    if pending:
        return action_key, pending

    meeting_pending = [
        (key, value)
        for key, value in pending_calendar_actions.items()
        if key[0] == meeting_id
    ]
    if len(meeting_pending) == 1:
        return meeting_pending[0]

    return None, None


@function_tool(
    description=(
        "Prepara um e-mail solicitado por voz durante a reuniao. Use apenas "
        "quando o Host pedir ao Coevo para enviar e-mail, resumo, follow-up ou "
        "proximos passos. Nao envia ainda: esta ferramenta apenas deixa a acao "
        "pendente. Depois de preparar, pergunte se o Host quer enviar agora ou "
        "ao fim da reuniao. Se ele escolher agora, peca confirmacao por voz. "
        "Se ele escolher fim da reuniao, use defer_meeting_email_until_end. "
        "Quando recipient_scope for custom, recipients deve conter apenas nomes "
        "ou e-mails de pessoas que entraram nesta sala."
    )
)
async def prepare_meeting_email(
    subject: str,
    body: str,
    recipient_scope: str = "all_participants",
    recipients: list[str] | None = None,
) -> str:
    enabled, reason = voice_email_actions_enabled()
    if not enabled:
        return f"BLOCKED: {reason}"

    normalized_scope = recipient_scope
    if normalized_scope not in {"all_participants", "clients", "host", "custom"}:
        normalized_scope = "all_participants"

    meeting_id = current_meeting_id.get()
    speaker_identity = current_speaker_identity.get()
    speaker_name = current_speaker_name.get()
    pending_email_actions[(meeting_id, speaker_identity)] = {
        "requester_identity": speaker_identity,
        "requester_name": speaker_name,
        "recipient_scope": normalized_scope,
        "recipients": recipients or [],
        "subject": subject,
        "body": body,
        "delivery_timing": "ask",
    }

    return (
        "PENDING_TIMING: E-mail preparado, mas ainda nao enviado. "
        "Resuma em uma frase o assunto e os destinatarios, e pergunte: "
        "'Voce quer que eu envie agora ou ao fim da reuniao?'. "
        "Se o Host escolher envio imediato, peca confirmacao por voz antes de enviar. "
        "Se ele escolher fim da reuniao, use defer_meeting_email_until_end e diga "
        "que o envio ficou agendado para o encerramento."
    )


@function_tool(
    description=(
        "Envia o e-mail pendente depois que o Host confirmar por voz. Use apenas "
        "quando a fala atual confirmar claramente o envio, como 'sim', 'pode "
        "enviar', 'confirmo' ou equivalente."
    )
)
async def send_confirmed_meeting_email() -> str:
    enabled, reason = voice_email_actions_enabled()
    if not enabled:
        return f"BLOCKED: {reason}"

    meeting_id = current_meeting_id.get()
    speaker_identity = current_speaker_identity.get()
    action_key, pending = get_pending_email_action(meeting_id, speaker_identity)
    if not pending:
        return "NO_PENDING_EMAIL: Nao ha e-mail pendente para confirmar."

    headers = {"Content-Type": "application/json"}
    if AGENT_API_KEY:
        headers["X-Agent-API-Key"] = AGENT_API_KEY

    async with aiohttp.ClientSession() as http:
        async with http.post(
            f"{API_URL}/meetings/{meeting_id}/actions/email",
            headers=headers,
            json=pending,
            timeout=aiohttp.ClientTimeout(total=20),
        ) as response:
            body = await response.text()
            if response.status >= 400:
                return f"SEND_FAILED: {body}"
            payload = await response.json()

    if action_key:
        pending_email_actions.pop(action_key, None)
    return (
        "SENT: E-mail enviado com sucesso para "
        f"{payload.get('recipient_count', 0)} destinatarios."
    )


@function_tool(
    description=(
        "Agenda o envio do e-mail pendente para o fim da reuniao. Use quando "
        "o Host escolher explicitamente enviar ao fim da reuniao, ao encerrar "
        "ou depois que a chamada acabar."
    )
)
async def defer_meeting_email_until_end() -> str:
    enabled, reason = voice_email_actions_enabled()
    if not enabled:
        return f"BLOCKED: {reason}"

    meeting_id = current_meeting_id.get()
    speaker_identity = current_speaker_identity.get()
    action_key, pending = get_pending_email_action(meeting_id, speaker_identity)
    if not pending:
        return "NO_PENDING_EMAIL: Nao ha e-mail pendente para agendar."

    headers = {"Content-Type": "application/json"}
    if AGENT_API_KEY:
        headers["X-Agent-API-Key"] = AGENT_API_KEY

    async with aiohttp.ClientSession() as http:
        async with http.post(
            f"{API_URL}/meetings/{meeting_id}/actions/email/defer",
            headers=headers,
            json=pending,
            timeout=aiohttp.ClientTimeout(total=20),
        ) as response:
            body = await response.text()
            if response.status >= 400:
                return f"DEFER_FAILED: {body}"
            payload = await response.json()

    if action_key:
        pending_email_actions.pop(action_key, None)
    return (
        "DEFERRED: E-mail agendado para envio automatico ao fim da reuniao. "
        f"ID pendente: {payload.get('pending_email_id')}."
    )


@function_tool(
    description=(
        "Cancela o e-mail pendente quando o Host disser para cancelar, nao enviar "
        "ou descartar."
    )
)
async def cancel_pending_meeting_email() -> str:
    action_key, _ = get_pending_email_action(
        current_meeting_id.get(),
        current_speaker_identity.get(),
    )
    if action_key:
        pending_email_actions.pop(action_key, None)
        return "CANCELLED: E-mail pendente cancelado."

    return "NO_PENDING_EMAIL: Nao ha e-mail pendente para cancelar."


@function_tool(
    description=(
        "Prepara um evento no Google Agenda solicitado pelo Host por voz. "
        "Use quando o Host pedir para agendar, marcar ou criar uma reuniao futura. "
        "start_time deve estar em ISO 8601 com timezone quando possivel. Nao cria "
        "o evento ainda: exige confirmacao por voz."
    )
)
async def prepare_calendar_event(
    title: str,
    start_time: str,
    duration_minutes: int = 30,
    description: str = "",
    attendee_scope: str = "all_participants",
    attendees: list[str] | None = None,
) -> str:
    enabled, reason = voice_calendar_actions_enabled()
    if not enabled:
        return f"BLOCKED: {reason}"

    normalized_scope = attendee_scope
    if normalized_scope not in {"all_participants", "clients", "host", "custom"}:
        normalized_scope = "all_participants"

    meeting_id = current_meeting_id.get()
    speaker_identity = current_speaker_identity.get()
    pending_calendar_actions[(meeting_id, speaker_identity)] = {
        "requester_identity": speaker_identity,
        "requester_name": current_speaker_name.get(),
        "title": title,
        "description": description,
        "start_time": start_time,
        "duration_minutes": duration_minutes,
        "attendee_scope": normalized_scope,
        "attendees": attendees or [],
    }
    set_calendar_flow_state(
        meeting_id,
        mode="ready_to_confirm",
        speaker_identity=speaker_identity,
        speaker_name=current_speaker_name.get(),
    )
    logger.info(
        "calendar event prepared",
        extra={
            "meeting_id": meeting_id,
            "speaker_identity": speaker_identity,
            "title": title,
            "start_time": start_time,
        },
    )
    return (
        "PENDING_CONFIRMATION: Evento de agenda preparado, mas ainda nao criado. "
        "Responda imediatamente em voz alta com uma frase curta, confirme titulo, "
        "data, horario, duracao e convidados, e pergunte: 'Posso agendar?'. "
        "So crie depois do Host confirmar por voz."
    )


@function_tool(
    description=(
        "Cria no Google Agenda o evento pendente depois que o Host confirmar por voz."
    )
)
async def send_confirmed_calendar_event() -> str:
    enabled, reason = voice_calendar_actions_enabled()
    if not enabled:
        return f"BLOCKED: {reason}"

    meeting_id = current_meeting_id.get()
    speaker_identity = current_speaker_identity.get()
    action_key, pending = get_pending_calendar_action(meeting_id, speaker_identity)
    if not pending:
        return "NO_PENDING_CALENDAR_EVENT: Nao ha evento pendente para confirmar."

    logger.info(
        "calendar event confirmation requested",
        extra={
            "meeting_id": meeting_id,
            "speaker_identity": speaker_identity,
            "title": pending.get("title"),
            "start_time": pending.get("start_time"),
        },
    )

    headers = {"Content-Type": "application/json"}
    if AGENT_API_KEY:
        headers["X-Agent-API-Key"] = AGENT_API_KEY

    async with aiohttp.ClientSession() as http:
        async with http.post(
            f"{API_URL}/meetings/{meeting_id}/actions/calendar-event",
            headers=headers,
            json=pending,
            timeout=aiohttp.ClientTimeout(total=20),
        ) as response:
            body = await response.text()
            if response.status >= 400:
                return f"SCHEDULE_FAILED: {body}"
            payload = await response.json()

    if action_key:
        pending_calendar_actions.pop(action_key, None)
    clear_calendar_flow_state(meeting_id)
    return (
        "SCHEDULED: Reuniao criada no Google Agenda com sucesso para "
        f"{payload.get('attendee_count', 0)} convidados."
    )


@function_tool(
    description="Cancela o evento de agenda pendente quando o Host pedir para cancelar."
)
async def cancel_pending_calendar_event() -> str:
    action_key, _ = get_pending_calendar_action(
        current_meeting_id.get(),
        current_speaker_identity.get(),
    )
    if action_key:
        pending_calendar_actions.pop(action_key, None)
        clear_calendar_flow_state(current_meeting_id.get())
        return "CANCELLED: Evento de agenda pendente cancelado."

    clear_calendar_flow_state(current_meeting_id.get())
    return "NO_PENDING_CALENDAR_EVENT: Nao ha evento pendente para cancelar."


@function_tool(
    description=(
        "Consulta a internet quando o Host pedir explicitamente para pesquisar, "
        "verificar algo na web, buscar noticias ou confirmar informacoes atuais. "
        "Nao use para participantes que nao sejam Host e nao use sem pedido claro."
    )
)
async def search_web_for_host(query: str) -> str:
    enabled, reason = voice_web_search_enabled()
    if not enabled:
        return f"BLOCKED: {reason}"

    headers = {"Content-Type": "application/json"}
    if AGENT_API_KEY:
        headers["X-Agent-API-Key"] = AGENT_API_KEY

    async with aiohttp.ClientSession() as http:
        async with http.post(
            f"{API_URL}/meetings/{current_meeting_id.get()}/actions/web-search",
            headers=headers,
            json={
                "requester_identity": current_speaker_identity.get(),
                "requester_name": current_speaker_name.get(),
                "query": query,
            },
            timeout=aiohttp.ClientTimeout(total=20),
        ) as response:
            body = await response.text()
            if response.status >= 400:
                return f"WEB_SEARCH_FAILED: {body}"
            payload = await response.json()

    results = payload.get("results", [])
    if not results:
        return "NO_WEB_RESULTS: Nao encontrei resultados relevantes na internet."

    formatted_results = []
    for result in results[:5]:
        formatted_results.append(
            "\n".join(
                [
                    f"Titulo: {result.get('title', '')}",
                    f"URL: {result.get('url', '')}",
                    f"Resumo: {result.get('snippet', '')}",
                ]
            )
        )

    return "\n\n---\n\n".join(formatted_results)


async def fetch_agent_profile() -> dict:
    headers = {"Content-Type": "application/json"}
    if AGENT_API_KEY:
        headers["X-Agent-API-Key"] = AGENT_API_KEY

    try:
        async with aiohttp.ClientSession() as http:
            async with http.get(
                f"{API_URL}/agent/profile",
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=5),
            ) as response:
                if response.status >= 400:
                    return {}
                return await response.json()
    except Exception:
        logger.warning("failed to fetch agent profile", exc_info=True)
        return {}


def build_profile_instructions(profile: dict) -> str:
    if not profile:
        return SYSTEM_PROMPT

    keywords = ", ".join(profile.get("keywords") or [])
    avoid_words = ", ".join(profile.get("avoid_words") or [])
    behavior_tags = ", ".join(profile.get("behavior_tags") or [])
    custom_instructions = profile.get("custom_instructions") or ""

    profile_prompt = f"""
Personalidade configurada pelo usuario:
- Nome publico: {profile.get("name", "Coevo")}
- Genero/voz desejada: {profile.get("gender", "masculine")}
- Tom principal: {profile.get("tone", "consultivo")}
- Metodo comercial: {profile.get("sales_method", "consultivo")}
- Formalidade: {profile.get("formality", 68)}/100
- Energia: {profile.get("energy", 48)}/100
- Empatia: {profile.get("empathy", 74)}/100
- Assertividade: {profile.get("assertiveness", 58)}/100
- Brevidade: {profile.get("brevity", 70)}/100
- Palavras-chave preferidas: {keywords or "nenhuma configurada"}
- Palavras/expressoes a evitar: {avoid_words or "nenhuma configurada"}
- Tracos comportamentais: {behavior_tags or "nenhum configurado"}
- Politica de idioma: {profile.get("language_policy", "Responder na mesma lingua do participante.")}
- Instrucoes adicionais: {custom_instructions or "nenhuma"}
- Papeis autorizados a comandos por voz: {", ".join(profile.get("voice_command_roles") or ["host"])}
- Acoes por voz habilitadas: {", ".join(profile.get("enabled_actions") or ["send_email"])}
- Integracoes habilitadas: {", ".join(profile.get("enabled_integrations") or ["resend_email"])}
- Confirmacao por voz antes de executar: {"sim" if profile.get("require_voice_confirmation", True) else "nao"}

Use esta personalidade como guia, sem violar as regras obrigatorias acima.
""".strip()

    return f"{SYSTEM_PROMPT}\n\n{profile_prompt}"


class JarvisAgent(Agent):
    def __init__(self, instructions: str) -> None:
        super().__init__(
            instructions=instructions,
            tools=[
                search_knowledge_base,
                search_meeting_memory,
                prepare_meeting_email,
                send_confirmed_meeting_email,
                defer_meeting_email_until_end,
                cancel_pending_meeting_email,
                prepare_calendar_event,
                send_confirmed_calendar_event,
                cancel_pending_calendar_event,
                search_web_for_host,
            ],
        )


server = AgentServer()


def get_meeting_id(ctx: agents.JobContext) -> str:
    room_name = getattr(ctx.room, "name", None)
    if room_name:
        return room_name
    return "unknown-meeting"


def get_speaker_name(ctx: agents.JobContext, speaker_id: str | None) -> str:
    if not speaker_id:
        return "Participante"

    remote_participants = getattr(ctx.room, "remote_participants", {}) or {}
    participant = remote_participants.get(speaker_id)
    participant_name = getattr(participant, "name", None)
    if participant_name:
        return participant_name

    return speaker_id


async def save_transcript_segment(
    *,
    meeting_id: str,
    speaker_name: str,
    timestamp_seconds: float,
    content: str,
) -> None:
    headers = {"Content-Type": "application/json"}
    if AGENT_API_KEY:
        headers["X-Agent-API-Key"] = AGENT_API_KEY

    async with aiohttp.ClientSession() as http:
        async with http.post(
            f"{API_URL}/meetings/{meeting_id}/transcript",
            headers=headers,
            json={
                "speaker_name": speaker_name,
                "timestamp_seconds": timestamp_seconds,
                "content": content,
            },
            timeout=aiohttp.ClientTimeout(total=5),
        ) as response:
            if response.status >= 400:
                body = await response.text()
                raise RuntimeError(
                    f"Transcript save failed with status {response.status}: {body}"
                )


def log_task_failure(task: asyncio.Task[None]) -> None:
    try:
        task.result()
    except asyncio.CancelledError:
        return
    except Exception:
        logger.warning("background task failed", exc_info=True)


async def publish_agent_intervention(
    *,
    ctx: agents.JobContext,
    meeting_id: str,
    subject: str,
    rationale: str,
) -> None:
    payload = {
        "type": "agent_intervention",
        "id": f"intervention-{int(time.time() * 1000)}",
        "subject": subject,
        "rationale": rationale,
        "isRaised": True,
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    pending_interventions[meeting_id] = payload
    encoded_payload = json.dumps(payload).encode("utf-8")
    try:
        publisher = getattr(ctx.room, "local_participant", None)
        if publisher is not None:
            result = publisher.publish_data(
                encoded_payload,
                reliable=True,
                topic=AGENT_INTERVENTION_TOPIC,
            )
            if asyncio.iscoroutine(result):
                await result
    except Exception:
        logger.warning("failed to publish agent intervention", exc_info=True)


async def clear_agent_intervention_hand(
    *,
    ctx: agents.JobContext,
    meeting_id: str,
    subject: str = "",
) -> None:
    payload = {
        "type": "agent_intervention",
        "id": f"intervention-clear-{int(time.time() * 1000)}",
        "subject": subject,
        "isRaised": False,
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    encoded_payload = json.dumps(payload).encode("utf-8")
    try:
        publisher = getattr(ctx.room, "local_participant", None)
        if publisher is not None:
            result = publisher.publish_data(
                encoded_payload,
                reliable=True,
                topic=AGENT_INTERVENTION_TOPIC,
            )
            if asyncio.iscoroutine(result):
                await result
    except Exception:
        logger.warning("failed to clear agent intervention hand", exc_info=True)


async def maybe_raise_agent_hand(
    *,
    ctx: agents.JobContext,
    meeting_id: str,
    speaker_name: str,
    transcript: str,
) -> None:
    if has_pending_meeting_action(meeting_id) or get_calendar_flow_state(meeting_id):
        return

    now = time.monotonic()
    if now - last_intervention_check_by_meeting.get(meeting_id, 0.0) < INTERVENTION_CHECK_INTERVAL_SECONDS:
        return
    if meeting_id in pending_interventions:
        return

    last_intervention_check_by_meeting[meeting_id] = now
    headers = {"Content-Type": "application/json"}
    if AGENT_API_KEY:
        headers["X-Agent-API-Key"] = AGENT_API_KEY

    try:
        async with aiohttp.ClientSession() as http:
            async with http.post(
                f"{API_URL}/meetings/{meeting_id}/agent/intervention-check",
                headers=headers,
                json={"speaker_name": speaker_name, "transcript": transcript},
                timeout=aiohttp.ClientTimeout(total=18),
            ) as response:
                if response.status >= 400:
                    return
                payload = await response.json()
    except Exception:
        logger.info("agent intervention check failed", exc_info=True)
        return

    if not payload.get("should_raise_hand"):
        return

    await publish_agent_intervention(
        ctx=ctx,
        meeting_id=meeting_id,
        subject=payload.get("subject") or "um ponto da reuniao",
        rationale=payload.get("rationale") or "",
    )


@server.rtc_session(agent_name=AGENT_NAME)
async def jarvis(ctx: agents.JobContext):
    meeting_id = get_meeting_id(ctx)
    current_meeting_id.set(meeting_id)
    started_at = time.monotonic()
    active_until = 0.0
    silenced_until_new_wake = False
    profile = await fetch_agent_profile()
    current_agent_profile.set(profile)
    profile_instructions = build_profile_instructions(profile)
    profile_voice = profile.get("voice") or OPENAI_REALTIME_VOICE
    orb_state = {"speaking": False}
    orb_task = asyncio.create_task(publish_agent_orb_video(ctx, orb_state))
    orb_task.add_done_callback(log_task_failure)

    session = AgentSession(
        llm=openai.realtime.RealtimeModel(
            model=OPENAI_REALTIME_MODEL,
            voice=profile_voice,
            input_audio_transcription=InputAudioTranscription(
                model=OPENAI_TRANSCRIPTION_MODEL,
            ),
            turn_detection=TurnDetection(
                type="server_vad",
                threshold=VAD_THRESHOLD,
                prefix_padding_ms=VAD_PREFIX_PADDING_MS,
                silence_duration_ms=VAD_SILENCE_DURATION_MS,
                create_response=False,
                interrupt_response=True,
            ),
        ),
    )

    @session.on("user_input_transcribed")
    def on_user_input_transcribed(event: UserInputTranscribedEvent) -> None:
        nonlocal active_until, silenced_until_new_wake

        if not event.is_final:
            return

        transcript = event.transcript.strip()
        if not transcript:
            return

        if not is_meaningful_transcript(transcript):
            return

        timestamp_seconds = time.monotonic() - started_at
        speaker_name = get_speaker_name(ctx, event.speaker_id)
        current_speaker_identity.set(event.speaker_id or "unknown-speaker")
        current_speaker_name.set(speaker_name)
        task = asyncio.create_task(
            save_transcript_segment(
                meeting_id=meeting_id,
                speaker_name=speaker_name,
                timestamp_seconds=timestamp_seconds,
                content=transcript,
            )
        )
        task.add_done_callback(log_task_failure)

        now = time.monotonic()
        if contains_silence_command(transcript):
            active_until = 0.0
            silenced_until_new_wake = True
            session.generate_reply(
                user_input=transcript,
                instructions="Responda exatamente e apenas: OK",
            )
            return

        was_called = contains_wake_word(transcript)
        if was_called:
            silenced_until_new_wake = False

        if silenced_until_new_wake:
            return

        is_active_follow_up = now <= active_until
        calendar_state = get_calendar_flow_state(meeting_id)
        is_calendar_request = contains_calendar_request(transcript)
        is_calendar_flow = is_calendar_request or bool(calendar_state) or (
            has_pending_calendar_action(meeting_id)
            and (
                contains_action_confirmation(transcript)
                or contains_action_cancel(transcript)
            )
        )

        if is_calendar_flow and (was_called or is_active_follow_up or calendar_state):
            active_until = now + 45.0
            if meeting_id in pending_interventions:
                asyncio.create_task(
                    clear_pending_intervention_if_any(ctx=ctx, meeting_id=meeting_id)
                )

            if (
                is_calendar_request
                and not calendar_state
                and not has_pending_calendar_action(meeting_id)
            ):
                set_calendar_flow_state(
                    meeting_id,
                    mode="collecting_details",
                    speaker_identity=event.speaker_id or "unknown-speaker",
                    speaker_name=speaker_name,
                )
                session.generate_reply(
                    user_input=transcript,
                    instructions=(
                        "Voce e Coevo e entrou em modo agenda. Nao use nenhuma "
                        "ferramenta nesta resposta. Responda imediatamente e em "
                        "uma frase curta: diga que vai ajudar a agendar e peca "
                        "apenas os dados essenciais que ainda faltam: titulo, "
                        "data, horario, duracao e convidados. Nao levante a mao."
                    ),
                )
                return

            session.generate_reply(
                user_input=transcript,
                instructions=(
                    "Voce e Coevo e esta em um fluxo exclusivo de Google Agenda. "
                    "Responda rapido. Nao use search_knowledge_base, "
                    "search_meeting_memory, search_web_for_host nem levante a mao. "
                    "Se o Host cancelar, use cancel_pending_calendar_event. "
                    "Se houver um evento de agenda pendente e a fala confirmar o "
                    "envio, use send_confirmed_calendar_event imediatamente. "
                    "Se ainda nao houver evento pendente e titulo, data, horario, "
                    "duracao e convidados estiverem claros, use "
                    "prepare_calendar_event. Se faltar qualquer informacao "
                    "essencial, nao use ferramenta: pergunte apenas o dado "
                    "faltante em uma frase. Nunca fique em silencio depois de "
                    "um pedido de agenda."
                ),
            )
            return

        pending_intervention_context = ""
        if contains_intervention_authorization(transcript):
            pending = pending_interventions.pop(meeting_id, None)
            if pending:
                active_until = now + FOLLOW_UP_SILENCE_SECONDS
                asyncio.create_task(
                    clear_agent_intervention_hand(
                        ctx=ctx,
                        meeting_id=meeting_id,
                        subject=pending.get("subject", ""),
                    )
                )
                session.generate_reply(
                    user_input=transcript,
                    instructions=(
                        "O Host autorizou sua intervencao. Desenvolva somente "
                        "o ponto pendente, com objetividade e sem abrir novos "
                        "assuntos. Comece dizendo: "
                        f"'Eu gostaria de contribuir sobre {pending.get('subject', 'este assunto')}'. "
                        f"Motivo: {pending.get('rationale', '')}"
                    ),
                )
                return
        elif was_called and meeting_id in pending_interventions:
            pending = pending_interventions.pop(meeting_id, None)
            if pending:
                asyncio.create_task(
                    clear_agent_intervention_hand(
                        ctx=ctx,
                        meeting_id=meeting_id,
                        subject=pending.get("subject", ""),
                    )
                )
                pending_intervention_context = (
                    "Voce tinha levantado a mao para contribuir sobre "
                    f"{pending.get('subject', 'um ponto da reuniao')}. "
                    "Como foi chamado pelo wake word, responda livremente ao "
                    "pedido atual. Se o pedido for generico, desenvolva esse "
                    "ponto pendente com objetividade. "
                )

        if not was_called and not is_active_follow_up:
            if has_pending_meeting_action(meeting_id) or contains_calendar_request(transcript):
                return
            asyncio.create_task(
                maybe_raise_agent_hand(
                    ctx=ctx,
                    meeting_id=meeting_id,
                    speaker_name=speaker_name,
                    transcript=transcript,
                )
            )
            return

        active_until = now + (
            INITIAL_ACTIVE_LISTEN_SECONDS if was_called else FOLLOW_UP_SILENCE_SECONDS
        )

        session.generate_reply(
            user_input=transcript,
            instructions=(
                "Voce e Coevo. Responda ao participante de forma breve, em "
                "tom alinhado a personalidade configurada. Responda na mesma "
                "lingua usada pelo participante que acabou de falar. Nao traduza "
                "nem mude de lingua a menos que o participante peca explicitamente. "
                f"{pending_intervention_context}"
                "Depois de ser chamado por Coevo, trate falas subsequentes como "
                "continuidade da conversa por ate 10 segundos apos a sua resposta "
                "e enquanto a janela ativa estiver aberta. "
                "Se o participante disser 'Coevo silencie', encerre a escuta "
                "ativa e nao responda ate uma nova chamada por Coevo. "
                "Se a pergunta depender de informacao documental, "
                "consulte a ferramenta search_knowledge_base antes de responder. "
                "Se a ferramenta retornar NO_MATCH, diga que nao encontrou "
                "informacao suficiente. "
                "Se a pergunta depender de historico, decisoes, pendencias, "
                "promessas, riscos ou algo dito em reunioes passadas, use "
                "search_meeting_memory antes de responder. Se retornar "
                "NO_MEMORY_MATCH, diga que nao encontrou memoria suficiente. "
                "Se o Host pedir para consultar a internet, pesquisar na web, "
                "buscar noticias ou verificar informacao atual, use "
                "search_web_for_host antes de responder. Cite fontes de forma "
                "curta usando os titulos ou URLs retornados. "
                "Para enviar e-mail, resumo, follow-up ou proximos passos, use "
                "prepare_meeting_email primeiro. Depois pergunte se o envio deve "
                "ser imediato ou ao fim da reuniao. Se o Host escolher agora, "
                "confirme por voz antes de enviar. So use "
                "send_confirmed_meeting_email quando o Host confirmar claramente "
                "por voz. Se o Host escolher fim da reuniao, diga que deixou o "
                "e-mail agendado para envio automatico ao fim da reuniao e use "
                "defer_meeting_email_until_end imediatamente. "
                "E-mails so podem ser enviados para pessoas que entraram nesta "
                "reuniao. Se o Host selecionar destinatarios, use os nomes ou "
                "e-mails informados no lobby e nunca invente destinatarios externos. "
                "Se o Host cancelar, use cancel_pending_meeting_email. Nunca diga "
                "que enviou antes da ferramenta confirmar SENT. "
                "Para agendar reunioes no Google Agenda, use prepare_calendar_event "
                "primeiro e confirme por voz antes de usar "
                "send_confirmed_calendar_event. Se o Host cancelar, use "
                "cancel_pending_calendar_event. Nunca diga que agendou antes da "
                "ferramenta confirmar SCHEDULED."
            ),
        )

    @session.on("agent_state_changed")
    def on_agent_state_changed(event) -> None:
        nonlocal active_until
        new_state = str(getattr(event, "new_state", "") or "").lower()
        orb_state["speaking"] = new_state == "speaking"

        if (
            getattr(event, "old_state", None) == "speaking"
            and getattr(event, "new_state", None) == "listening"
            and not silenced_until_new_wake
        ):
            active_until = time.monotonic() + POST_REPLY_ACTIVE_SECONDS

    try:
        await session.start(
            room=ctx.room,
            agent=JarvisAgent(profile_instructions),
            room_options=room_io.RoomOptions(
                audio_input=room_io.AudioInputOptions(),
                audio_output=room_io.AudioOutputOptions(),
                text_output=room_io.TextOutputOptions(sync_transcription=True),
            ),
        )
    finally:
        orb_task.cancel()
        try:
            await orb_task
        except asyncio.CancelledError:
            pass


if __name__ == "__main__":
    agents.cli.run_app(server)
