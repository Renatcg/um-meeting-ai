from datetime import datetime, timedelta, timezone
import base64
import hashlib
import hmac
import os
from typing import Any

import jwt
from fastapi import Depends, Header, HTTPException, status
from pydantic import BaseModel

from app.config import Settings, get_settings
from app.models import ParticipantRole, UserPublic


class ParticipantClaims(BaseModel):
    meeting_id: str
    identity: str
    name: str
    email: str
    role: ParticipantRole


class AppUserClaims(BaseModel):
    user_id: int
    name: str
    email: str
    is_admin: bool = False


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 210_000)
    return (
        "pbkdf2_sha256$210000$"
        f"{base64.b64encode(salt).decode()}$"
        f"{base64.b64encode(digest).decode()}"
    )


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations, salt_b64, digest_b64 = password_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(digest_b64)
        actual = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode(),
            salt,
            int(iterations),
        )
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def create_app_access_token(*, settings: Settings, user: UserPublic) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(user.id),
        "name": user.name,
        "email": str(user.email),
        "is_admin": user.is_admin,
        "token_use": "app",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=7)).timestamp()),
    }
    return jwt.encode(payload, settings.app_jwt_secret, algorithm="HS256")


def get_current_user_claims(
    authorization: str | None = Header(default=None),
) -> AppUserClaims:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing access token.",
        )

    token = authorization.removeprefix("Bearer ").strip()
    settings = get_settings()

    try:
        payload = jwt.decode(token, settings.app_jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token.",
        ) from exc

    if payload.get("token_use") != "app":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token.",
        )

    return AppUserClaims(
        user_id=int(payload["sub"]),
        name=payload["name"],
        email=payload["email"],
        is_admin=bool(payload.get("is_admin", False)),
    )


def require_admin_user(
    claims: AppUserClaims = Depends(get_current_user_claims),
) -> AppUserClaims:
    if not claims.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can execute this action.",
        )
    return claims


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
