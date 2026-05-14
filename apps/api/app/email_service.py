import asyncio
from email.message import EmailMessage
import smtplib

from app.config import Settings
from app.models import TrialRequest


def _send_trial_confirmation_email(settings: Settings, lead: TrialRequest) -> None:
    if not settings.smtp_host:
        raise RuntimeError("SMTP_HOST is required to send confirmation emails.")

    subject = "Recebemos sua solicitacao do Coevo Meet"
    sender = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    body = f"""Ola, {lead.full_name}.

Recebemos sua solicitacao de teste gratuito do Coevo Meet.

Seu cadastro foi realizado com sucesso. Em breve, a equipe da Coevo Labs entrara em contato para combinar os proximos passos.

Empresa: {lead.company_name}
Plano de interesse: {lead.selected_plan or "Teste gratuito"}

Obrigado pelo interesse,
Equipe Coevo Labs
"""

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = str(lead.corporate_email)
    message.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
        smtp.starttls()
        if settings.smtp_username and settings.smtp_password:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)


async def send_trial_confirmation_email(
    *,
    settings: Settings,
    lead: TrialRequest,
) -> None:
    await asyncio.to_thread(_send_trial_confirmation_email, settings, lead)
