import asyncio
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
WAKE_WORDS = ("jarvis", "jervis", "jarves", "javes", "jarviz", "jarvys")
INITIAL_ACTIVE_LISTEN_SECONDS = 15.0
POST_REPLY_ACTIVE_SECONDS = 10.0
FOLLOW_UP_SILENCE_SECONDS = 5.0


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


@function_tool(
    description=(
        "Busca informacoes na base de conhecimento carregada por PDF, DOCX, "
        "TXT e MD. Use quando o participante perguntar algo que possa estar "
        "em documentos da empresa."
    )
)
async def search_knowledge_base(query: str) -> str:
    headers = {"Content-Type": "application/json"}
    if AGENT_API_KEY:
        headers["X-Agent-API-Key"] = AGENT_API_KEY

    async with aiohttp.ClientSession() as http:
        async with http.post(
            f"{API_URL}/knowledge/search",
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


class JarvisAgent(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions=SYSTEM_PROMPT,
            tools=[search_knowledge_base],
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
    started_at = time.monotonic()
    active_until = 0.0

    session = AgentSession(
        llm=openai.realtime.RealtimeModel(
            model=OPENAI_REALTIME_MODEL,
            voice=OPENAI_REALTIME_VOICE,
            input_audio_transcription=InputAudioTranscription(
                model=OPENAI_TRANSCRIPTION_MODEL,
            ),
            turn_detection=TurnDetection(
                type="server_vad",
                threshold=0.4,
                prefix_padding_ms=500,
                silence_duration_ms=550,
                create_response=False,
                interrupt_response=True,
            ),
        ),
    )

    @session.on("user_input_transcribed")
    def on_user_input_transcribed(event: UserInputTranscribedEvent) -> None:
        nonlocal active_until

        if not event.is_final:
            return

        transcript = event.transcript.strip()
        if not transcript:
            return

        timestamp_seconds = time.monotonic() - started_at
        speaker_name = get_speaker_name(ctx, event.speaker_id)
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
        was_called = contains_wake_word(transcript)
        is_active_follow_up = now <= active_until

        if not was_called and not is_active_follow_up:
            return

        active_until = now + (
            INITIAL_ACTIVE_LISTEN_SECONDS if was_called else FOLLOW_UP_SILENCE_SECONDS
        )

        session.generate_reply(
            user_input=transcript,
            instructions=(
                "Voce e Jarvis. Responda ao participante de forma breve, em "
                "portugues do Brasil e com voz/tom masculino, calmo e profissional. "
                "Depois de ser chamado por Jarvis, trate falas subsequentes como "
                "continuidade da conversa por ate 10 segundos apos a sua resposta "
                "e enquanto a janela ativa estiver aberta. "
                "Se a pergunta depender de informacao documental, "
                "consulte a ferramenta search_knowledge_base antes de responder. "
                "Se a ferramenta retornar NO_MATCH, diga que nao encontrou "
                "informacao suficiente."
            ),
        )

    @session.on("agent_state_changed")
    def on_agent_state_changed(event) -> None:
        nonlocal active_until

        if (
            getattr(event, "old_state", None) == "speaking"
            and getattr(event, "new_state", None) == "listening"
        ):
            active_until = time.monotonic() + POST_REPLY_ACTIVE_SECONDS

    await session.start(
        room=ctx.room,
        agent=JarvisAgent(),
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(),
            audio_output=room_io.AudioOutputOptions(),
            text_output=room_io.TextOutputOptions(sync_transcription=True),
        ),
    )


if __name__ == "__main__":
    agents.cli.run_app(server)
