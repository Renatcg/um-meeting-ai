import base64
from io import BytesIO

from openai import AsyncOpenAI, OpenAIError

from app.config import Settings
from app.models import AgentVoice


def audio_filename(mimetype: str | None) -> str:
    clean = (mimetype or "").split(";", 1)[0].strip().lower()
    extension_by_type = {
        "audio/mpeg": "mp3",
        "audio/mp3": "mp3",
        "audio/mp4": "mp4",
        "audio/m4a": "m4a",
        "audio/ogg": "ogg",
        "audio/opus": "ogg",
        "audio/wav": "wav",
        "audio/webm": "webm",
    }
    return f"voice-input.{extension_by_type.get(clean, 'webm')}"


async def transcribe_voice_audio(
    *,
    settings: Settings,
    audio_bytes: bytes,
    mimetype: str | None,
) -> str:
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is required to transcribe voice audio.")

    audio_file = BytesIO(audio_bytes)
    audio_file.name = audio_filename(mimetype)

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    try:
        transcription = await client.audio.transcriptions.create(
            model=settings.openai_media_transcription_model,
            file=audio_file,
        )
    except OpenAIError as exc:
        raise RuntimeError("Could not transcribe voice audio.") from exc

    return transcription.text.strip()


async def synthesize_voice_audio(
    *,
    settings: Settings,
    text: str,
    voice: AgentVoice,
) -> bytes:
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is required to synthesize voice audio.")

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    try:
        audio = await client.audio.speech.create(
            model=settings.smart_speaker_tts_model,
            voice=voice,
            input=text,
            response_format="mp3",
        )
    except OpenAIError as exc:
        raise RuntimeError("Could not synthesize voice audio.") from exc

    return audio.content


def audio_bytes_to_base64(audio_bytes: bytes) -> str:
    return base64.b64encode(audio_bytes).decode("ascii")


def audio_base64_to_bytes(audio_base64: str) -> bytes:
    value = audio_base64.strip()
    if value.lower().startswith("data:") and "," in value:
        value = value.split(",", 1)[1]
    return base64.b64decode(value, validate=False)
