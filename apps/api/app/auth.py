from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from fastapi import Header, HTTPException, status
from pydantic import BaseModel

from app.config import Settings, get_settings
from app.models import ParticipantRole


class ParticipantClaims(BaseModel):
    meeting_id: str
    identity: str
    name: str
    email: str
    role: ParticipantRole


def create_participant_access_token(
    *,
    settings: Settings,
    meeting_id: str,
    identity: str,
    name: str,
    email: str,
    role: ParticipantRole,
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": identity,
        "meeting_id": meeting_id,
        "name": name,
        "email": email,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=8)).timestamp()),
    }
    return jwt.encode(payload, settings.app_jwt_secret, algorithm="HS256")


def get_participant_claims(
    authorization: str | None = Header(default=None),
) -> ParticipantClaims:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing participant access token.",
        )

    token = authorization.removeprefix("Bearer ").strip()
    settings = get_settings()

    try:
        payload = jwt.decode(token, settings.app_jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid participant access token.",
        ) from exc

    return ParticipantClaims(
        meeting_id=payload["meeting_id"],
        identity=payload["sub"],
        name=payload["name"],
        email=payload["email"],
        role=payload["role"],
    )


def require_sales_panel_access(
    claims: ParticipantClaims,
    meeting_id: str,
) -> ParticipantClaims:
    if claims.meeting_id != meeting_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Participant token does not belong to this meeting.",
        )

    if claims.role not in ("host", "commercial"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sales recommendations are private to host and commercial roles.",
        )

    return claims
