import asyncio
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.config import Settings
from app.models import TrialRequest

RESEND_EMAILS_URL = "https://api.resend.com/emails"


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

    request = Request(
        RESEND_EMAILS_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
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


async def send_trial_confirmation_email(
    *,
    settings: Settings,
    lead: TrialRequest,
) -> None:
    await asyncio.to_thread(_send_trial_confirmation_email, settings, lead)
