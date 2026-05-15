import asyncio
import contextvars
import logging
import os
import re
import time
import unicodedata

import aiohttp
from dotenv import load_dotenv
from openai.types.beta.realtime.session import InputAudioTranscription, TurnDetection

from livekit import agents
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
VAD_THRESHOLD = float(os.getenv("JARVIS_VAD_THRESHOLD", "0.72"))
VAD_PREFIX_PADDING_MS = int(os.getenv("JARVIS_VAD_PREFIX_PADDING_MS", "300"))
VAD_SILENCE_DURATION_MS = int(os.getenv("JARVIS_VAD_SILENCE_DURATION_MS", "900"))
MIN_TRANSCRIPT_CHARS = int(os.getenv("JARVIS_MIN_TRANSCRIPT_CHARS", "8"))
MIN_TRANSCRIPT_WORDS = int(os.getenv("JARVIS_MIN_TRANSCRIPT_WORDS", "2"))
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


def is_meaningful_transcript(value: str) -> bool:
    normalized = normalize_text(value)
    words = normalized.split()
    if contains_wake_word(value):
        return True

    if len(normalized.replace(" ", "")) < MIN_TRANSCRIPT_CHARS:
        return False

    return len(words) >= MIN_TRANSCRIPT_WORDS


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
    enabled_actions = profile.get("enabled_actions") or ["send_email"]
    enabled_integrations = profile.get("enabled_integrations") or ["resend_email"]
    allowed_roles = profile.get("voice_command_roles") or ["host"]

    if "schedule_meeting" not in enabled_actions:
        return False, "O agendamento por voz esta desativado nas configuracoes."

    if "google_calendar" not in enabled_integrations:
        return False, "A integracao com Google Agenda esta desativada."

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
        "ao fim da reuniao. Se ele escolher agora, peca confirmacao por voz."
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
        "Se ele escolher fim da reuniao, diga que deixara preparado e que ele pode "
        "confirmar o envio ao encerrar."
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
    return (
        "PENDING_CONFIRMATION: Evento de agenda preparado, mas ainda nao criado. "
        "Confirme em voz alta o titulo, data, horario, duracao e convidados. "
        "Pergunte: 'Posso agendar?'. So crie depois do Host confirmar por voz."
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
        return "CANCELLED: Evento de agenda pendente cancelado."

    return "NO_PENDING_CALENDAR_EVENT: Nao ha evento pendente para cancelar."


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
                prepare_meeting_email,
                send_confirmed_meeting_email,
                cancel_pending_meeting_email,
                prepare_calendar_event,
                send_confirmed_calendar_event,
                cancel_pending_calendar_event,
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
    except Exception:
        logger.warning("failed to save transcript segment", exc_info=True)


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

        if not was_called and not is_active_follow_up:
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
                "Depois de ser chamado por Coevo, trate falas subsequentes como "
                "continuidade da conversa por ate 10 segundos apos a sua resposta "
                "e enquanto a janela ativa estiver aberta. "
                "Se o participante disser 'Coevo silencie', encerre a escuta "
                "ativa e nao responda ate uma nova chamada por Coevo. "
                "Se a pergunta depender de informacao documental, "
                "consulte a ferramenta search_knowledge_base antes de responder. "
                "Se a ferramenta retornar NO_MATCH, diga que nao encontrou "
                "informacao suficiente. "
                "Para enviar e-mail, resumo, follow-up ou proximos passos, use "
                "prepare_meeting_email primeiro. Depois pergunte se o envio deve "
                "ser imediato ou ao fim da reuniao. Se o Host escolher agora, "
                "confirme por voz antes de enviar. So use "
                "send_confirmed_meeting_email quando o Host confirmar claramente "
                "por voz. Se o Host escolher fim da reuniao, diga que deixou o "
                "e-mail preparado e que ele pode confirmar o envio ao encerrar. "
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

        if (
            getattr(event, "old_state", None) == "speaking"
            and getattr(event, "new_state", None) == "listening"
            and not silenced_until_new_wake
        ):
            active_until = time.monotonic() + POST_REPLY_ACTIVE_SECONDS

    await session.start(
        room=ctx.room,
        agent=JarvisAgent(profile_instructions),
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(),
            audio_output=room_io.AudioOutputOptions(),
            text_output=room_io.TextOutputOptions(sync_transcription=True),
        ),
    )


if __name__ == "__main__":
    agents.cli.run_app(server)
