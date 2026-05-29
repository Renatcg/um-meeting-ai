import asyncio
import logging
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException, status
from livekit import api

from app.config import Settings
from app.database import (
    get_active_meeting_recording,
    insert_meeting_recording,
    list_recent_recordings,
    list_meeting_recordings,
    update_meeting_recording,
)
from app.models import MeetingRecording, RecordingHealthResponse, RecordingStartResponse


logger = logging.getLogger(__name__)


ACTIVE_STATUSES = {
    "EGRESS_STARTING",
    "EGRESS_ACTIVE",
    "STARTING",
    "ACTIVE",
}
FAILED_STATUS_MARKERS = ("FAILED", "ABORTED", "LIMIT_REACHED")
TERMINAL_STATUS_MARKERS = ("COMPLETE", "COMPLETED", "END", "ENDED", "FAILED")


def _recording_configured(settings: Settings) -> bool:
    return bool(
        settings.recordings_enabled
        and settings.recording_s3_bucket
        and settings.recording_s3_access_key_id
        and settings.recording_s3_secret_access_key
    )


def recording_configured(settings: Settings) -> bool:
    return _recording_configured(settings)


def _is_failed_status(status_value: str) -> bool:
    normalized = status_value.upper()
    return any(marker in normalized for marker in FAILED_STATUS_MARKERS)


def _is_terminal_status(status_value: str) -> bool:
    normalized = status_value.upper()
    return any(marker in normalized for marker in TERMINAL_STATUS_MARKERS)


def _status_name(status_value: int | str) -> str:
    if isinstance(status_value, str):
        return status_value
    try:
        return api.EgressStatus.Name(status_value)
    except ValueError:
        return str(status_value)


def _timestamp_from_livekit(value: int | None) -> datetime | None:
    if not value:
        return None
    # LiveKit protobuf timestamps are represented as unix nanoseconds.
    seconds = value / 1_000_000_000
    return datetime.fromtimestamp(seconds, tz=timezone.utc)


def _duration_seconds(value: int | None) -> float | None:
    if not value:
        return None
    return value / 1_000_000_000


def _safe_path_segment(value: str | None, fallback: str) -> str:
    clean = "".join(
        character.lower()
        if character.isalnum() or character in {"-", "_"}
        else "-"
        for character in (value or "").strip()
    ).strip("-")
    return clean or fallback


def _recording_object_key(
    settings: Settings,
    meeting_id: str,
    organization_id: str = "default",
    client_external_id: str | None = None,
) -> str:
    prefix = settings.recording_object_prefix.strip("/ ") or "recordings"
    organization_segment = _safe_path_segment(organization_id, "default")
    client_segment = _safe_path_segment(client_external_id, "unassigned")
    return (
        f"{prefix}/{organization_segment}/clients/{client_segment}/"
        f"meetings/{meeting_id}/{uuid4().hex}.mp4"
    )


def _storage_location(settings: Settings, object_key: str) -> str:
    base_url = settings.recording_public_base_url
    if base_url:
        return f"{base_url.rstrip('/')}/{object_key}"
    bucket = settings.recording_s3_bucket or ""
    return f"s3://{bucket}/{object_key}"


def _s3_upload(settings: Settings) -> api.S3Upload:
    return api.S3Upload(
        access_key=settings.recording_s3_access_key_id or "",
        secret=settings.recording_s3_secret_access_key or "",
        region=settings.recording_s3_region,
        endpoint=settings.recording_s3_endpoint or "",
        bucket=settings.recording_s3_bucket or "",
        force_path_style=settings.recording_s3_force_path_style,
    )


async def start_meeting_recording(
    *,
    settings: Settings,
    meeting_id: str,
    organization_id: str = "default",
    client_external_id: str | None = None,
) -> RecordingStartResponse:
    if not settings.recordings_enabled:
        return RecordingStartResponse(
            started=False,
            configured=False,
            detail="Recording is disabled.",
        )

    if not _recording_configured(settings):
        return RecordingStartResponse(
            started=False,
            configured=False,
            detail="Recording storage is not configured.",
        )

    existing = await get_active_meeting_recording(
        settings=settings,
        meeting_id=meeting_id,
    )
    if existing:
        return RecordingStartResponse(
            started=False,
            configured=True,
            recording=existing,
            detail="Recording already active.",
        )

    object_key = _recording_object_key(
        settings,
        meeting_id,
        organization_id=organization_id,
        client_external_id=client_external_id,
    )
    file_output = api.EncodedFileOutput(
        file_type=api.EncodedFileType.MP4,
        filepath=object_key,
        s3=_s3_upload(settings),
    )
    request = api.RoomCompositeEgressRequest(
        room_name=meeting_id,
        layout="grid",
        file_outputs=[file_output],
    )

    livekit_api = api.LiveKitAPI(
        settings.livekit_url,
        settings.livekit_api_key,
        settings.livekit_api_secret,
    )
    try:
        info = await livekit_api.egress.start_room_composite_egress(request)
    finally:
        await livekit_api.aclose()

    recording = await insert_meeting_recording(
        settings=settings,
        meeting_id=meeting_id,
        egress_id=info.egress_id,
        status=_status_name(info.status),
        storage_provider=settings.recording_storage_provider,
        bucket=settings.recording_s3_bucket,
        object_key=object_key,
        file_type="mp4",
        location=_storage_location(settings, object_key),
    )
    return RecordingStartResponse(
        started=True,
        configured=True,
        recording=recording,
    )


async def stop_active_meeting_recording(
    *,
    settings: Settings,
    meeting_id: str,
) -> MeetingRecording | None:
    recording = await get_active_meeting_recording(
        settings=settings,
        meeting_id=meeting_id,
    )
    if not recording:
        return None

    livekit_api = api.LiveKitAPI(
        settings.livekit_url,
        settings.livekit_api_key,
        settings.livekit_api_secret,
    )
    try:
        info = await livekit_api.egress.stop_egress(
            api.StopEgressRequest(egress_id=recording.egress_id)
        )
    finally:
        await livekit_api.aclose()

    saved = await save_egress_info(settings=settings, info=info)
    return await reconcile_recording(
        settings=settings,
        egress_id=recording.egress_id,
        current=saved,
    )


async def fetch_egress_info(
    *,
    settings: Settings,
    egress_id: str,
) -> api.EgressInfo | None:
    livekit_api = api.LiveKitAPI(
        settings.livekit_url,
        settings.livekit_api_key,
        settings.livekit_api_secret,
    )
    try:
        response = await livekit_api.egress.list_egress(
            api.ListEgressRequest(egress_id=egress_id)
        )
    finally:
        await livekit_api.aclose()

    items = list(getattr(response, "items", []) or [])
    return items[0] if items else None


async def reconcile_recording(
    *,
    settings: Settings,
    egress_id: str,
    current: MeetingRecording | None = None,
    attempts: int = 6,
    delay_seconds: float = 2.0,
) -> MeetingRecording | None:
    recording = current
    for attempt in range(max(attempts, 1)):
        if (
            recording
            and recording.location
            and recording.size_bytes
            and _is_terminal_status(recording.status)
        ):
            return recording

        if attempt:
            await asyncio.sleep(delay_seconds)

        info = await fetch_egress_info(settings=settings, egress_id=egress_id)
        if not info:
            continue

        recording = await save_egress_info(settings=settings, info=info)

    if recording and (
        not recording.location
        or not recording.size_bytes
        or _is_failed_status(recording.status)
    ):
        logger.error(
            "recording reconciliation ended without a usable recording",
            extra={
                "meeting_id": recording.meeting_id,
                "egress_id": recording.egress_id,
                "status": recording.status,
                "location": recording.location,
                "size_bytes": recording.size_bytes,
                "error": recording.error,
            },
        )
    return recording


async def save_egress_info(
    *,
    settings: Settings,
    info: api.EgressInfo,
) -> MeetingRecording | None:
    file_info = info.file or None
    location = None
    duration = None
    size = None
    if file_info:
        location = file_info.location or None
        duration = _duration_seconds(file_info.duration)
        size = int(file_info.size) if file_info.size else None

    return await update_meeting_recording(
        settings=settings,
        egress_id=info.egress_id,
        status=_status_name(info.status),
        started_at=_timestamp_from_livekit(info.started_at),
        ended_at=_timestamp_from_livekit(info.ended_at),
        duration_seconds=duration,
        size_bytes=size,
        location=location,
        error=info.error or None,
    )


async def recording_health(
    *,
    settings: Settings,
    limit: int = 50,
) -> RecordingHealthResponse:
    configured = settings.recordings_enabled and _recording_configured(settings)
    alerts: list[str] = []
    if not settings.recordings_enabled:
        alerts.append("Recording is disabled.")
    elif not _recording_configured(settings):
        alerts.append("Recording storage is not fully configured.")

    recordings = list(await list_recent_recordings(settings=settings, limit=limit))
    active = [item for item in recordings if item.status in ACTIVE_STATUSES]
    failed = [
        item
        for item in recordings
        if _is_failed_status(item.status) or bool(item.error)
    ]
    missing_file = [
        item
        for item in recordings
        if _is_terminal_status(item.status)
        and not _is_failed_status(item.status)
        and (not item.location or not item.size_bytes)
    ]

    if active:
        alerts.append(f"{len(active)} recording(s) still active or starting.")
    if failed:
        alerts.append(f"{len(failed)} recording(s) failed recently.")
    if missing_file:
        alerts.append(
            f"{len(missing_file)} completed recording(s) are missing confirmed storage file."
        )

    healthy = configured and not failed and not missing_file
    return RecordingHealthResponse(
        healthy=healthy,
        configured=bool(configured),
        active_count=len(active),
        failed_count=len(failed),
        missing_location_count=len(missing_file),
        alerts=alerts,
    )


async def get_recordings_or_404(
    *,
    settings: Settings,
    meeting_id: str,
) -> list[MeetingRecording]:
    recordings = list(
        await list_meeting_recordings(settings=settings, meeting_id=meeting_id)
    )
    if not recordings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No recordings found for this meeting.",
        )
    return recordings
