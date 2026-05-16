import asyncio
import json
from dataclasses import dataclass
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from app.config import Settings


@dataclass
class WhatsAppInboundMessage:
    instance: str | None
    phone: str
    sender_name: str
    text: str
    message_id: str | None = None


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


def parse_evo_webhook_payload(payload: dict) -> WhatsAppInboundMessage | None:
    data = payload.get("data")
    if not isinstance(data, dict):
        return None

    key = data.get("key") if isinstance(data.get("key"), dict) else {}
    if key.get("fromMe") is True:
        return None

    message = data.get("message") if isinstance(data.get("message"), dict) else {}
    text = _extract_message_text(message)
    if not text:
        return None

    remote_jid = _first_text(
        key.get("remoteJid"),
        data.get("remoteJid"),
        data.get("sender"),
    )
    phone = normalize_phone(remote_jid)
    if not phone:
        return None

    sender_name = _first_text(data.get("pushName"), data.get("senderName"), phone)
    instance = _first_text(payload.get("instance"), data.get("instance"))
    message_id = _first_text(key.get("id"), data.get("id")) or None

    return WhatsAppInboundMessage(
        instance=instance or None,
        phone=phone,
        sender_name=sender_name,
        text=text,
        message_id=message_id,
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
