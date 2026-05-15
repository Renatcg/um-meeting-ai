import asyncio
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.config import Settings
from pydantic import EmailStr

from app.models import TrialRequest

RESEND_EMAILS_URL = "https://api.resend.com/emails"


def _post_resend_email(settings: Settings, payload: dict) -> None:
    if not settings.resend_api_key:
        raise RuntimeError("RESEND_API_KEY is required to send emails.")

    request = Request(
        RESEND_EMAILS_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
            "User-Agent": "CoevoMeet/0.1",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=20) as response:
            if response.status >= 300:
                response_body = response.read().decode("utf-8", errors="replace")
                raise RuntimeError(
                    f"Resend returned HTTP {response.status}: {response_body}"
                )
    except HTTPError as exc:
        response_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Resend returned HTTP {exc.code}: {response_body}") from exc
    except URLError as exc:
        raise RuntimeError(f"Could not reach Resend: {exc.reason}") from exc


def _send_trial_confirmation_email(settings: Settings, lead: TrialRequest) -> None:
    if not settings.resend_api_key:
        raise RuntimeError("RESEND_API_KEY is required to send confirmation emails.")

    subject = "Recebemos sua solicitacao do Coevo Meet"
    sender = f"{settings.resend_from_name} <{settings.resend_from_email}>"
    body = f"""Ola, {lead.full_name}.

Recebemos sua solicitacao de teste gratuito do Coevo Meet.

Seu cadastro foi realizado com sucesso. Em breve, a equipe da Coevo Labs entrara em contato para combinar os proximos passos.

Empresa: {lead.company_name}
Plano de interesse: {lead.selected_plan or "Teste gratuito"}

Obrigado pelo interesse,
Equipe Coevo Labs
"""

    payload = {
        "from": sender,
        "to": [str(lead.corporate_email)],
        "subject": subject,
        "text": body,
    }

    _post_resend_email(settings, payload)


async def send_trial_confirmation_email(
    *,
    settings: Settings,
    lead: TrialRequest,
) -> None:
    await asyncio.to_thread(_send_trial_confirmation_email, settings, lead)


def _send_meeting_action_email(
    *,
    settings: Settings,
    sender_name: str,
    sender_email: str,
    recipients: list[str],
    subject: str,
    body: str,
) -> None:
    if not recipients:
        raise RuntimeError("At least one recipient is required.")

    sender = f"{sender_name} via Coevo <{settings.resend_from_email}>"
    payload = {
        "from": sender,
        "to": recipients,
        "subject": subject,
        "text": body,
        "reply_to": sender_email,
    }
    _post_resend_email(settings, payload)


async def send_meeting_action_email(
    *,
    settings: Settings,
    sender_name: str,
    sender_email: EmailStr | str,
    recipients: list[EmailStr | str],
    subject: str,
    body: str,
) -> None:
    await asyncio.to_thread(
        _send_meeting_action_email,
        settings=settings,
        sender_name=sender_name,
        sender_email=str(sender_email),
        recipients=[str(recipient) for recipient in recipients],
        subject=subject,
        body=body,
    )
