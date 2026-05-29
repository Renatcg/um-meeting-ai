from __future__ import annotations

import asyncio
import json
import logging
from typing import Any
from uuid import uuid4
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import websockets
from websockets.exceptions import ConnectionClosed

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)

MCP_PROTOCOL_VERSION = "2024-11-05"


COEVO_ASK_TOOL = {
    "name": "coevo.ask",
    "description": (
        "Converse com o Coevo, usando a mesma personalidade, memoria, "
        "permissoes e configuracoes do sistema Coevo Meet. Use esta ferramenta "
        "para perguntas sobre reunioes, clientes, decisoes, pendencias, "
        "follow-ups, e-mails e memoria corporativa. Para criar eventos no "
        "Google Agenda, use a ferramenta coevo.schedule_meeting."
    ),
    "inputSchema": {
        "type": "object",
        "properties": {
            "message": {
                "type": "string",
                "description": "Pedido completo do usuario para o Coevo.",
            },
            "user_name": {
                "type": "string",
                "description": "Nome do usuario, se o agente original souber.",
            },
            "user_id": {
                "type": "string",
                "description": "Identificador do usuario, se disponivel.",
            },
            "organization_id": {
                "type": "string",
                "description": "Organizacao do usuario, se disponivel.",
            },
            "context": {
                "type": "string",
                "description": "Contexto adicional observado pelo agente original.",
            },
        },
        "required": ["message"],
    },
}


COEVO_SCHEDULE_MEETING_TOOL = {
    "name": "coevo.schedule_meeting",
    "description": (
        "Cria um evento no Google Agenda conectado ao Coevo. Use somente quando "
        "o usuario tiver pedido para agendar e confirmado por voz. Antes de "
        "chamar, colete titulo, data, horario, duracao e convidados."
    ),
    "inputSchema": {
        "type": "object",
        "properties": {
            "title": {
                "type": "string",
                "description": "Titulo do evento.",
            },
            "start_time": {
                "type": "string",
                "description": (
                    "Data e hora de inicio em ISO 8601. Exemplo: "
                    "2026-05-30T14:00:00-03:00."
                ),
            },
            "duration_minutes": {
                "type": "integer",
                "description": "Duracao do evento em minutos.",
                "default": 30,
            },
            "attendees": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Lista de e-mails dos convidados.",
            },
            "description": {
                "type": "string",
                "description": "Descricao opcional do evento.",
            },
            "user_name": {
                "type": "string",
                "description": "Nome de quem pediu o agendamento.",
            },
        },
        "required": ["title", "start_time"],
    },
}


MCP_TOOLS = [COEVO_ASK_TOOL, COEVO_SCHEDULE_MEETING_TOOL]


def _json_dumps(payload: dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


class CoevoAPIError(RuntimeError):
    def __init__(self, detail: str, status_code: int | None = None) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


def _api_base_url(settings: Settings) -> str:
    return settings.api_url.rstrip("/")


def _request_json_sync(
    *,
    settings: Settings,
    path: str,
    payload: dict[str, Any],
    authenticated: bool = False,
) -> dict[str, Any]:
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "CoevoXiaoZhiMCP/0.1",
    }
    if authenticated and settings.agent_api_key:
        headers["X-Agent-API-Key"] = settings.agent_api_key

    request = Request(
        f"{_api_base_url(settings)}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8", errors="replace")
            return json.loads(body) if body else {}
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        detail = body
        try:
            parsed = json.loads(body)
            detail = str(parsed.get("detail") or parsed)
        except json.JSONDecodeError:
            pass
        raise CoevoAPIError(detail=detail, status_code=exc.code) from exc
    except URLError as exc:
        raise CoevoAPIError(detail=f"Nao consegui acessar a API principal: {exc.reason}") from exc


async def _request_json(
    *,
    settings: Settings,
    path: str,
    payload: dict[str, Any],
    authenticated: bool = False,
) -> dict[str, Any]:
    return await asyncio.to_thread(
        _request_json_sync,
        settings=settings,
        path=path,
        payload=payload,
        authenticated=authenticated,
    )


def _json_rpc_response(request_id: Any, result: dict[str, Any]) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def _json_rpc_error(request_id: Any, code: int, message: str) -> dict[str, Any]:
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "error": {"code": code, "message": message},
    }


def _unwrap_message(message: dict[str, Any]) -> tuple[dict[str, Any], str | None]:
    """Accept direct JSON-RPC or common websocket envelopes."""

    payload = message.get("payload")
    if isinstance(payload, dict):
        return payload, "payload"

    data = message.get("data")
    if isinstance(data, dict):
        return data, "data"

    return message, None


def _wrap_response(response: dict[str, Any], envelope_key: str | None) -> dict[str, Any]:
    if envelope_key:
        return {"type": "mcp", envelope_key: response}
    return response


def _extract_tool_arguments(params: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    name = str(params.get("name") or params.get("tool") or "")
    raw_arguments = params.get("arguments")
    if raw_arguments is None:
        raw_arguments = params.get("input")

    if isinstance(raw_arguments, str):
        try:
            arguments = json.loads(raw_arguments)
        except json.JSONDecodeError:
            arguments = {"message": raw_arguments}
    elif isinstance(raw_arguments, dict):
        arguments = raw_arguments
    else:
        arguments = {}

    return name, arguments


def _merge_message(arguments: dict[str, Any]) -> str:
    message = str(arguments.get("message") or arguments.get("query") or "").strip()
    context = str(arguments.get("context") or "").strip()

    if context and message:
        return f"{message}\n\nContexto observado pelo agente original:\n{context}"
    if context:
        return f"Considere este contexto e responda ao usuario:\n{context}"
    return message


def _string_value(value: object, fallback: str = "") -> str:
    if value is None:
        return fallback
    return str(value).strip() or fallback


def _email_or_none(value: object) -> str | None:
    if value is None:
        return None
    email = str(value).strip()
    return email if "@" in email else None


def _attendee_list(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        raw_items = value.replace(";", ",").split(",")
    elif isinstance(value, list):
        raw_items = value
    else:
        return []

    emails: list[str] = []
    seen: set[str] = set()
    for item in raw_items:
        email = str(item).strip().lower()
        if "@" not in email or email in seen:
            continue
        seen.add(email)
        emails.append(email)
    return emails


async def _call_coevo(*, settings: Settings, arguments: dict[str, Any]) -> str:
    message = _merge_message(arguments)
    if not message:
        return "Nao recebi uma pergunta clara para o Coevo responder."

    session_seed = str(
        arguments.get("session_id")
        or arguments.get("conversation_id")
        or arguments.get("user_id")
        or uuid4().hex[:12]
    )
    user_id = str(arguments.get("user_id") or settings.xiaozhi_mcp_user_id)
    user_name = str(arguments.get("user_name") or settings.xiaozhi_mcp_user_name)
    organization_id = str(
        arguments.get("organization_id") or settings.xiaozhi_mcp_organization_id
    )

    response = await _request_json(
        settings=settings,
        path="/agent/respond",
        payload={
            "agent_id": settings.xiaozhi_mcp_agent_id,
            "organization_id": organization_id,
            "channel": "voice",
            "user_id": user_id,
            "user_name": user_name,
            "user_email": _email_or_none(
                arguments.get("user_email") or settings.xiaozhi_mcp_user_email
            ),
            "message": message,
            "session_id": f"{settings.xiaozhi_mcp_session_prefix}-{session_seed}",
            "requester_role": "host",
        },
    )
    return str(response.get("assistant_message", {}).get("content") or "").strip()


async def _schedule_meeting(*, settings: Settings, arguments: dict[str, Any]) -> str:
    title = _string_value(arguments.get("title"), "Reuniao agendada pelo Coevo")
    start_time = _string_value(arguments.get("start_time"))
    if not start_time:
        return (
            "Nao consegui entender a data e o horario do evento. Envie a data e "
            "hora no formato ISO, por exemplo 2026-05-30T14:00:00-03:00."
        )

    try:
        duration_minutes = int(arguments.get("duration_minutes") or 30)
    except (TypeError, ValueError):
        duration_minutes = 30
    duration_minutes = max(15, min(duration_minutes, 480))

    attendees = _attendee_list(arguments.get("attendees"))
    requester_name = _string_value(arguments.get("user_name"), settings.xiaozhi_mcp_user_name)
    description = _string_value(arguments.get("description"))
    try:
        response = await _request_json(
            settings=settings,
            path="/agent/actions/calendar-event",
            authenticated=True,
            payload={
                "title": title,
                "description": description,
                "start_time": start_time,
                "duration_minutes": duration_minutes,
                "attendees": attendees,
                "requester_name": requester_name,
            },
        )
    except CoevoAPIError as exc:
        logger.exception("xiaozhi mcp calendar action failed")
        return exc.detail or "Nao consegui criar o evento no Google Agenda agora."

    attendee_text = (
        f" com {len(attendees)} convidado{'s' if len(attendees) != 1 else ''}"
        if attendees
        else " sem convidados"
    )
    html_link = response.get("html_link")
    if html_link:
        return (
            f"Evento criado no Google Agenda: {title}, em {start_time}, "
            f"por {duration_minutes} minutos{attendee_text}. Link: {html_link}"
        )
    return (
        f"Evento criado no Google Agenda: {title}, em {start_time}, "
        f"por {duration_minutes} minutos{attendee_text}."
    )


async def handle_mcp_request(
    *,
    settings: Settings,
    request: dict[str, Any],
) -> dict[str, Any] | None:
    request_id = request.get("id")
    method = str(request.get("method") or "")
    params = request.get("params") if isinstance(request.get("params"), dict) else {}

    if method in {"notifications/initialized", "initialized"}:
        return None

    if method == "initialize":
        return _json_rpc_response(
            request_id,
            {
                "protocolVersion": MCP_PROTOCOL_VERSION,
                "capabilities": {"tools": {}},
                "serverInfo": {
                    "name": "coevo-mcp-service",
                    "version": "0.1.0",
                },
            },
        )

    if method in {"tools/list", "list_tools"}:
        return _json_rpc_response(request_id, {"tools": MCP_TOOLS})

    if method in {"tools/call", "call_tool"}:
        name, arguments = _extract_tool_arguments(params)
        if name not in {tool["name"] for tool in MCP_TOOLS}:
            return _json_rpc_error(
                request_id,
                -32602,
                f"Ferramenta desconhecida: {name or '(sem nome)'}",
            )

        try:
            if name == COEVO_SCHEDULE_MEETING_TOOL["name"]:
                answer = await _schedule_meeting(settings=settings, arguments=arguments)
            else:
                answer = await _call_coevo(settings=settings, arguments=arguments)
        except Exception:
            logger.exception("xiaozhi mcp tool failed: %s", name)
            return _json_rpc_error(
                request_id,
                -32000,
                "O Coevo nao conseguiu responder agora.",
            )

        return _json_rpc_response(
            request_id,
            {
                "content": [{"type": "text", "text": answer}],
                "text": answer,
                "isError": False,
            },
        )

    if request_id is None:
        logger.info("Ignoring MCP notification: %s", method or request)
        return None

    return _json_rpc_error(
        request_id,
        -32601,
        f"Metodo MCP nao suportado: {method or '(sem metodo)'}",
    )


async def run_bridge(settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    if not settings.xiaozhi_mcp_endpoint:
        raise RuntimeError("XIAOZHI_MCP_ENDPOINT is required to start the bridge.")

    endpoint = settings.xiaozhi_mcp_endpoint
    reconnect_seconds = max(2, settings.xiaozhi_mcp_reconnect_seconds)

    while True:
        try:
            logger.info("Connecting Coevo MCP bridge to XiaoZhi endpoint.")
            async with websockets.connect(endpoint, ping_interval=20, ping_timeout=20) as ws:
                logger.info("Coevo MCP bridge connected.")
                async for raw_message in ws:
                    try:
                        message = json.loads(raw_message)
                    except json.JSONDecodeError:
                        logger.warning("Ignoring non-JSON MCP message: %s", raw_message)
                        continue

                    request, envelope_key = _unwrap_message(message)
                    response = await handle_mcp_request(
                        settings=settings,
                        request=request,
                    )
                    if response is not None:
                        await ws.send(_json_dumps(_wrap_response(response, envelope_key)))
        except ConnectionClosed as exc:
            logger.warning("Coevo MCP bridge disconnected: %s", exc)
        except Exception:
            logger.exception("Coevo MCP bridge crashed.")

        logger.info("Reconnecting Coevo MCP bridge in %s seconds.", reconnect_seconds)
        await asyncio.sleep(reconnect_seconds)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_bridge())


if __name__ == "__main__":
    main()
