import asyncio
import base64
import json
from dataclasses import dataclass
from io import BytesIO
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from openai import AsyncOpenAI, OpenAIError

from app.config import Settings


@dataclass
class WhatsAppInboundMessage:
    instance: str | None
    phone: str
    sender_name: str
    text: str
    message_id: str | None = None
    audio_base64: str | None = None
    audio_mimetype: str | None = None
    has_audio: bool = False
    is_group: bool = False
    group_id: str | None = None
    group_name: str | None = None
    sender_phone: str | None = None
    message_type: str = "text"


def normalize_phone(value: str | None) -> str:
    if not value:
        return ""
    local = value.split("@", 1)[0]
    return "".join(character for character in local if character.isdigit())


def _first_text(*values: object) -> str:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _strip_data_uri(value: str) -> str:
    if "," in value and value.strip().lower().startswith("data:"):
        return value.split(",", 1)[1]
    return value


def _audio_filename(mimetype: str | None) -> str:
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
    return f"whatsapp-audio.{extension_by_type.get(clean, 'ogg')}"


def _extract_message_text(message: dict) -> str:
    extended = message.get("extendedTextMessage")
    image = message.get("imageMessage")
    video = message.get("videoMessage")
    document = message.get("documentMessage")

    return _first_text(
        message.get("conversation"),
        extended.get("text") if isinstance(extended, dict) else None,
        image.get("caption") if isinstance(image, dict) else None,
        video.get("caption") if isinstance(video, dict) else None,
        document.get("caption") if isinstance(document, dict) else None,
    )


def _detect_message_type(message: dict) -> str:
    if isinstance(message.get("audioMessage"), dict):
        return "audio"
    if isinstance(message.get("imageMessage"), dict):
        return "image"
    if isinstance(message.get("videoMessage"), dict):
        return "video"
    if isinstance(message.get("documentMessage"), dict):
        return "document"
    if _extract_message_text(message):
        return "text"
    return "unknown"


def _extract_audio_info(data: dict, message: dict) -> tuple[bool, str | None, str | None]:
    audio = message.get("audioMessage")
    if not isinstance(audio, dict):
        return False, None, None

    audio_base64 = _first_text(
        data.get("base64"),
        message.get("base64"),
        audio.get("base64"),
        audio.get("mediaBase64"),
    )
    mimetype = _first_text(
        audio.get("mimetype"),
        data.get("mimetype"),
        message.get("mimetype"),
    )

    return True, (_strip_data_uri(audio_base64) if audio_base64 else None), mimetype or None


def parse_evo_webhook_payload(payload: dict) -> WhatsAppInboundMessage | None:
    data = payload.get("data")
    if not isinstance(data, dict):
        return None

    key = data.get("key") if isinstance(data.get("key"), dict) else {}
    if key.get("fromMe") is True:
        return None

    message = data.get("message") if isinstance(data.get("message"), dict) else {}
    text = _extract_message_text(message)
    has_audio, audio_base64, audio_mimetype = _extract_audio_info(data, message)
    if not text and not has_audio:
        return None

    remote_jid = _first_text(
        key.get("remoteJid"),
        data.get("remoteJid"),
        data.get("sender"),
    )
    participant_jid = _first_text(
        key.get("participant"),
        data.get("participant"),
        data.get("sender"),
    )
    is_group = remote_jid.endswith("@g.us")
    phone = normalize_phone(participant_jid if is_group else remote_jid)
    if not phone:
        return None

    sender_name = _first_text(data.get("pushName"), data.get("senderName"), phone)
    instance = _first_text(payload.get("instance"), data.get("instance"))
    message_id = _first_text(key.get("id"), data.get("id")) or None
    group_name = _first_text(data.get("groupName"), data.get("subject")) or None

    return WhatsAppInboundMessage(
        instance=instance or None,
        phone=phone,
        sender_name=sender_name,
        text=text,
        message_id=message_id,
        audio_base64=audio_base64,
        audio_mimetype=audio_mimetype,
        has_audio=has_audio,
        is_group=is_group,
        group_id=remote_jid if is_group else None,
        group_name=group_name,
        sender_phone=phone,
        message_type=_detect_message_type(message),
    )


def whatsapp_phone_is_allowed(*, settings: Settings, phone: str) -> bool:
    allowed = settings.allowed_whatsapp_phones
    if not allowed:
        return False
    return normalize_phone(phone) in allowed


def _send_evo_text(
    *,
    settings: Settings,
    instance: str,
    phone: str,
    text: str,
) -> None:
    if not settings.evo_api_base_url or not settings.evo_api_key:
        raise RuntimeError("Evo API is not configured.")

    base_url = settings.evo_api_base_url.rstrip("/")
    url = f"{base_url}/message/sendText/{instance}"
    body = json.dumps(
        {
            "number": normalize_phone(phone),
            "text": text,
        }
    ).encode("utf-8")
    request = Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "apikey": settings.evo_api_key,
        },
    )

    try:
        with urlopen(request, timeout=20) as response:
            response.read()
    except HTTPError as exc:
        response_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"Evo API returned HTTP {exc.code}: {response_body}"
        ) from exc


def _send_evo_audio(
    *,
    settings: Settings,
    instance: str,
    phone: str,
    audio_base64: str,
) -> None:
    if not settings.evo_api_base_url or not settings.evo_api_key:
        raise RuntimeError("Evo API is not configured.")

    base_url = settings.evo_api_base_url.rstrip("/")
    url = f"{base_url}/message/sendWhatsAppAudio/{instance}"
    body = json.dumps(
        {
            "number": normalize_phone(phone),
            "audio": audio_base64,
        }
    ).encode("utf-8")
    request = Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "apikey": settings.evo_api_key,
        },
    )

    try:
        with urlopen(request, timeout=30) as response:
            response.read()
    except HTTPError as exc:
        response_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"Evo API audio returned HTTP {exc.code}: {response_body}"
        ) from exc


async def send_evo_text(
    *,
    settings: Settings,
    instance: str,
    phone: str,
    text: str,
) -> None:
    await asyncio.to_thread(
        _send_evo_text,
        settings=settings,
        instance=instance,
        phone=phone,
        text=text,
    )


async def send_evo_audio(
    *,
    settings: Settings,
    instance: str,
    phone: str,
    audio_base64: str,
) -> None:
    await asyncio.to_thread(
        _send_evo_audio,
        settings=settings,
        instance=instance,
        phone=phone,
        audio_base64=audio_base64,
    )


async def transcribe_whatsapp_audio(
    *,
    settings: Settings,
    audio_base64: str,
    mimetype: str | None,
) -> str:
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is required to transcribe WhatsApp audio.")

    try:
        audio_bytes = base64.b64decode(_strip_data_uri(audio_base64), validate=False)
    except Exception as exc:
        raise RuntimeError("Invalid WhatsApp audio base64.") from exc

    audio_file = BytesIO(audio_bytes)
    audio_file.name = _audio_filename(mimetype)
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    try:
        transcription = await client.audio.transcriptions.create(
            model=settings.openai_media_transcription_model,
            file=audio_file,
        )
    except OpenAIError as exc:
        raise RuntimeError("Could not transcribe WhatsApp audio.") from exc
    return transcription.text.strip()


async def synthesize_whatsapp_audio(
    *,
    settings: Settings,
    text: str,
) -> str:
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is required to synthesize WhatsApp audio.")

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    try:
        audio = await client.audio.speech.create(
            model=settings.whatsapp_tts_model,
            voice=settings.whatsapp_audio_voice,
            input=text,
            response_format="mp3",
        )
    except OpenAIError as exc:
        raise RuntimeError("Could not synthesize WhatsApp audio.") from exc

    return base64.b64encode(audio.content).decode("ascii")
