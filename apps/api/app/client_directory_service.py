import asyncio
import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.config import Settings


class ClientDirectoryError(RuntimeError):
    pass


def _read_path(payload: Any, path: str) -> Any:
    current = payload
    for part in [piece.strip() for piece in path.split(".") if piece.strip()]:
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current


def _extract_items(payload: Any, items_path: str) -> list[dict]:
    if items_path:
        payload = _read_path(payload, items_path)

    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]

    if isinstance(payload, dict):
        for key in ("clients", "customers", "data", "items", "results"):
            items = payload.get(key)
            if isinstance(items, list):
                return [item for item in items if isinstance(item, dict)]

    return []


def _field_value(item: dict, field_path: str) -> str | None:
    value = _read_path(item, field_path)
    if value is None:
        return None
    return str(value).strip()


def _fetch_external_clients(settings: Settings) -> list[dict]:
    if not settings.client_directory_api_url:
        raise ClientDirectoryError("CLIENT_DIRECTORY_API_URL is not configured.")

    headers = {"Accept": "application/json"}
    if settings.client_directory_api_key:
        if settings.client_directory_auth_scheme:
            auth_value = (
                f"{settings.client_directory_auth_scheme} "
                f"{settings.client_directory_api_key}"
            )
        else:
            auth_value = settings.client_directory_api_key
        headers[settings.client_directory_auth_header] = auth_value

    request = Request(settings.client_directory_api_url, headers=headers, method="GET")
    try:
        with urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8")
    except HTTPError as exc:
        response_body = exc.read().decode("utf-8", errors="replace")
        raise ClientDirectoryError(
            f"Client directory returned HTTP {exc.code}: {response_body[:300]}"
        ) from exc
    except URLError as exc:
        raise ClientDirectoryError(f"Client directory request failed: {exc}") from exc

    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        raise ClientDirectoryError("Client directory did not return valid JSON.") from exc

    items = _extract_items(payload, settings.client_directory_items_path)
    normalized_clients = []
    for item in items:
        external_id = _field_value(item, settings.client_directory_external_id_field)
        name = _field_value(item, settings.client_directory_name_field)
        if not external_id or not name:
            continue
        normalized_clients.append(
            {
                "external_id": external_id,
                "name": name,
                "metadata": {},
            }
        )

    return normalized_clients


async def fetch_external_clients(settings: Settings) -> list[dict]:
    return await asyncio.to_thread(_fetch_external_clients, settings)
