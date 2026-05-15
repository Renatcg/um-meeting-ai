import asyncio
import json
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.config import Settings
from app.database import (
    get_google_calendar_connection,
    upsert_google_calendar_connection,
)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
GOOGLE_CALENDAR_EVENTS_URL = (
    "https://www.googleapis.com/calendar/v3/calendars/primary/events"
)
GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/userinfo.email",
]


def google_calendar_configured(settings: Settings) -> bool:
    return bool(settings.google_client_id and settings.google_client_secret)


def build_google_calendar_auth_url(settings: Settings) -> str:
    if not settings.google_client_id:
        raise RuntimeError("GOOGLE_CLIENT_ID is required.")

    query = urlencode(
        {
            "client_id": settings.google_client_id,
            "redirect_uri": settings.google_redirect_uri,
            "response_type": "code",
            "scope": " ".join(GOOGLE_SCOPES),
            "access_type": "offline",
            "prompt": "consent",
        }
    )
    return f"{GOOGLE_AUTH_URL}?{query}"


def _request_json(url: str, payload: dict | None = None, headers: dict | None = None) -> dict:
    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8") if payload is not None else None,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "CoevoMeet/0.1",
            **(headers or {}),
        },
        method="POST" if payload is not None else "GET",
    )

    try:
        with urlopen(request, timeout=20) as response:
            body = response.read().decode("utf-8", errors="replace")
            return json.loads(body) if body else {}
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Google returned HTTP {exc.code}: {body}") from exc
    except URLError as exc:
        raise RuntimeError(f"Could not reach Google: {exc.reason}") from exc


def _request_form(url: str, payload: dict) -> dict:
    request = Request(
        url,
        data=urlencode(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "CoevoMeet/0.1",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=20) as response:
            body = response.read().decode("utf-8", errors="replace")
            return json.loads(body) if body else {}
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Google returned HTTP {exc.code}: {body}") from exc
    except URLError as exc:
        raise RuntimeError(f"Could not reach Google: {exc.reason}") from exc


async def exchange_google_calendar_code(*, settings: Settings, code: str) -> dict:
    if not google_calendar_configured(settings):
        raise RuntimeError("Google Calendar OAuth is not configured.")

    token_payload = await asyncio.to_thread(
        _request_form,
        GOOGLE_TOKEN_URL,
        {
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": settings.google_redirect_uri,
            "grant_type": "authorization_code",
        },
    )
    access_token = token_payload["access_token"]
    expires_at = datetime.now(timezone.utc) + timedelta(
        seconds=int(token_payload.get("expires_in", 3600))
    )
    user_info = await asyncio.to_thread(
        _request_json,
        GOOGLE_USERINFO_URL,
        None,
        {"Authorization": f"Bearer {access_token}"},
    )
    return await upsert_google_calendar_connection(
        settings=settings,
        access_token=access_token,
        refresh_token=token_payload.get("refresh_token"),
        expires_at=expires_at,
        calendar_email=user_info.get("email"),
        scope=token_payload.get("scope"),
    )


async def get_valid_google_calendar_token(*, settings: Settings) -> dict:
    connection = await get_google_calendar_connection(settings=settings)
    if not connection:
        raise RuntimeError("Google Calendar is not connected.")

    expires_at = connection.get("expires_at")
    if (
        expires_at
        and expires_at > datetime.now(timezone.utc) + timedelta(minutes=3)
    ):
        return connection

    refresh_token = connection.get("refresh_token")
    if not refresh_token:
        raise RuntimeError("Google Calendar refresh token is missing.")

    token_payload = await asyncio.to_thread(
        _request_form,
        GOOGLE_TOKEN_URL,
        {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        },
    )
    expires_at = datetime.now(timezone.utc) + timedelta(
        seconds=int(token_payload.get("expires_in", 3600))
    )
    return await upsert_google_calendar_connection(
        settings=settings,
        access_token=token_payload["access_token"],
        refresh_token=None,
        expires_at=expires_at,
        calendar_email=connection.get("calendar_email"),
        scope=connection.get("scope"),
    )


async def create_google_calendar_event(
    *,
    settings: Settings,
    title: str,
    description: str,
    start_time: datetime,
    duration_minutes: int,
    attendees: list[str],
) -> dict:
    connection = await get_valid_google_calendar_token(settings=settings)
    end_time = start_time + timedelta(minutes=duration_minutes)
    event_payload = {
        "summary": title,
        "description": description,
        "start": {
            "dateTime": start_time.isoformat(),
            "timeZone": settings.google_calendar_time_zone,
        },
        "end": {
            "dateTime": end_time.isoformat(),
            "timeZone": settings.google_calendar_time_zone,
        },
        "attendees": [{"email": attendee} for attendee in attendees],
    }
    return await asyncio.to_thread(
        _request_json,
        GOOGLE_CALENDAR_EVENTS_URL,
        event_payload,
        {"Authorization": f"Bearer {connection['access_token']}"},
    )
