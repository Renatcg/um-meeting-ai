import json
import logging

import aiohttp
from livekit import api

from app.config import Settings
from app.models import Meeting

logger = logging.getLogger(__name__)


async def dispatch_copilot(
    *,
    settings: Settings,
    meeting: Meeting,
) -> tuple[bool, str | None]:
    if not settings.copilot_auto_dispatch:
        return False, None
    if meeting.copilot_dispatched:
        return False, None

    livekit_api = api.LiveKitAPI(
        settings.livekit_url,
        settings.livekit_api_key,
        settings.livekit_api_secret,
        timeout=aiohttp.ClientTimeout(total=settings.copilot_dispatch_timeout_seconds),
    )

    try:
        await livekit_api.agent_dispatch.create_dispatch(
            api.CreateAgentDispatchRequest(
                agent_name=settings.jarvis_agent_name,
                room=meeting.id,
                metadata=json.dumps(
                    {
                        "meeting_id": meeting.id,
                        "meeting_title": meeting.title,
                        "display_name": "Jarvis",
                    }
                ),
            )
        )
        meeting.copilot_dispatched = True
        return True, None
    except Exception as exc:
        logger.warning("failed to dispatch Jarvis", exc_info=exc)
        return False, str(exc)
    finally:
        await livekit_api.aclose()
