import json

from openai import AsyncOpenAI, OpenAIError

from app.config import Settings
from app.models import MeetingInterventionCheckResponse


async def evaluate_intervention(
    *,
    settings: Settings,
    speaker_name: str,
    transcript: str,
    knowledge_context: str,
) -> MeetingInterventionCheckResponse:
    if not settings.openai_api_key:
        return MeetingInterventionCheckResponse(should_raise_hand=False)

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    prompt = f"""
Voce avalia se o Coevo deve levantar a mao em uma reuniao, sem interromper.

Levante a mao apenas se houver um motivo util e objetivo:
- um topico importante foi esquecido;
- uma definicao parece conflitar com documentos ou contexto da reuniao;
- uma afirmacao parece imprecisa, incompleta ou arriscada;
- ha uma oportunidade clara de contribuir sem atrapalhar.

Nao levante a mao para comentarios genericos, elogios, pequenas correcoes de estilo
ou quando nao houver evidencias suficientes.

Fala recente de {speaker_name}:
{transcript}

Contexto encontrado em documentos/transcricoes, se houver:
{knowledge_context or "Sem contexto relevante encontrado."}

Responda somente JSON valido neste formato:
{{
  "should_raise_hand": true ou false,
  "subject": "assunto curto em portugues",
  "rationale": "por que vale a intervencao em uma frase"
}}
"""
    try:
        response = await client.responses.create(
            model=settings.openai_intervention_model,
            input=prompt,
        )
    except OpenAIError:
        return MeetingInterventionCheckResponse(should_raise_hand=False)

    try:
        output_text = response.output_text.strip()
        if output_text.startswith("```"):
            output_text = output_text.strip("`")
            output_text = output_text.removeprefix("json").strip()
        payload = json.loads(output_text)
    except (json.JSONDecodeError, TypeError, AttributeError):
        return MeetingInterventionCheckResponse(should_raise_hand=False)

    should_raise_hand = bool(payload.get("should_raise_hand"))
    subject = str(payload.get("subject") or "").strip()[:180] or None
    rationale = str(payload.get("rationale") or "").strip()[:500] or None
    if not should_raise_hand or not subject:
        return MeetingInterventionCheckResponse(should_raise_hand=False)

    return MeetingInterventionCheckResponse(
        should_raise_hand=True,
        subject=subject,
        rationale=rationale,
    )
