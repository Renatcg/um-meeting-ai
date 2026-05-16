from openai import AsyncOpenAI, OpenAIError

from app.config import Settings
from app.database import list_recent_whatsapp_group_messages
from app.models import WhatsAppGroupMessage


def should_respond_to_group_message(text: str) -> bool:
    clean = text.strip().lower()
    if not clean:
        return False

    addressed_to_coevo = any(
        marker in clean
        for marker in {
            "coevo",
            "@coevo",
        }
    )
    summary_request = any(
        marker in clean
        for marker in {
            "resuma",
            "resume",
            "resumo",
            "o que eu perdi",
            "o que perdi",
            "mensagens nao lidas",
            "mensagens não lidas",
            "ultimas mensagens",
            "últimas mensagens",
        }
    )
    return addressed_to_coevo or summary_request


def _is_summary_request(text: str) -> bool:
    clean = text.strip().lower()
    return any(
        marker in clean
        for marker in {
            "resuma",
            "resume",
            "resumo",
            "o que eu perdi",
            "o que perdi",
            "mensagens nao lidas",
            "mensagens não lidas",
            "ultimas mensagens",
            "últimas mensagens",
        }
    )


def _format_group_messages(messages: list[WhatsAppGroupMessage]) -> str:
    if not messages:
        return "Sem mensagens recentes salvas para este grupo."

    return "\n".join(
        f"- {message.created_at:%d/%m %H:%M} | {message.sender_name}: {message.content}"
        for message in messages
    )


async def answer_whatsapp_group_message(
    *,
    settings: Settings,
    group_id: str,
    requester_name: str,
    text: str,
) -> str:
    messages = list(
        await list_recent_whatsapp_group_messages(
            settings=settings,
            group_id=group_id,
            limit=settings.whatsapp_group_summary_limit,
        )
    )
    context = _format_group_messages(messages)
    wants_summary = _is_summary_request(text)

    if not settings.openai_api_key:
        if wants_summary:
            return (
                "Consigo resumir o grupo, mas a chave da OpenAI nao esta configurada. "
                f"Tenho {len(messages)} mensagens recentes salvas."
            )
        return "Estou acompanhando o grupo. Se quiser, me peca um resumo das ultimas mensagens."

    if wants_summary:
        instruction = """
Gere um resumo executivo das mensagens recentes do grupo.
Inclua:
- principais assuntos;
- decisoes ou combinados;
- pendencias e responsaveis, se existirem;
- riscos ou pontos de atencao;
- links, datas ou valores citados.
Se algo nao existir, diga que nao apareceu nas mensagens recentes.
"""
    else:
        instruction = """
Responda de forma breve e conversacional ao pedido do usuario.
Use as mensagens recentes do grupo como contexto apenas quando forem relevantes.
Se o pedido estiver vago, pergunte o que ele quer consultar no grupo.
"""

    prompt = f"""
Voce e o Coevo, assistente corporativo do Coevo Meet, atuando em um grupo de WhatsApp.
Responda em portugues do Brasil.
Nao invente informacoes fora das mensagens fornecidas.

Usuario que chamou: {requester_name}
Mensagem do usuario: {text}

Mensagens recentes do grupo:
{context}

Instrucao:
{instruction}
"""
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    try:
        response = await client.responses.create(
            model=settings.openai_summary_model,
            input=prompt,
        )
    except OpenAIError:
        return (
            "Nao consegui gerar o resumo agora. Tente novamente em alguns instantes."
        )

    return response.output_text.strip()
