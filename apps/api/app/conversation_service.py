from uuid import uuid4

from openai import AsyncOpenAI, OpenAIError

from app.config import Settings
from app.database import (
    get_agent_profile,
    get_conversation_session,
    insert_conversation_message,
    list_conversation_messages,
    search_meeting_memory_items,
    upsert_conversation_session,
)
from app.knowledge_service import embed_texts
from app.models import (
    AgentRespondRequest,
    AgentRespondResponse,
    ConversationMessage,
    ConversationSession,
    MeetingMemorySearchResult,
)


def _title_from_message(message: str) -> str:
    clean = " ".join(message.strip().split())
    if len(clean) <= 58:
        return clean
    return f"{clean[:55].rstrip()}..."


def _memory_context(results: list[MeetingMemorySearchResult]) -> str:
    if not results:
        return "Nenhuma memoria relevante encontrada."

    lines: list[str] = []
    for index, item in enumerate(results, start=1):
        source = item.meeting_title or item.meeting_id
        lines.append(
            "\n".join(
                [
                    f"[{index}] Reuniao: {source}",
                    f"Tipo: {item.memory_type}",
                    f"Conteudo: {item.content}",
                ]
            )
        )
    return "\n\n".join(lines)


def _history_context(messages: list[ConversationMessage]) -> str:
    recent = messages[-8:]
    if not recent:
        return "Sem historico anterior nesta conversa."

    return "\n".join(
        f"{'Usuario' if message.role == 'user' else 'Coevo'}: {message.content}"
        for message in recent
        if message.role in {"user", "assistant"}
    )


def _profile_context(profile) -> str:
    return "\n".join(
        [
            f"Nome: {profile.name}",
            f"Tom: {profile.tone}",
            f"Metodo comercial: {profile.sales_method}",
            (
                "Parametros: "
                f"formalidade {profile.formality}/100, energia {profile.energy}/100, "
                f"empatia {profile.empathy}/100, assertividade {profile.assertiveness}/100, "
                f"brevidade {profile.brevity}/100"
            ),
            f"Palavras-chave: {', '.join(profile.keywords) or 'clareza, contexto, proximo passo'}",
            f"Evitar: {', '.join(profile.avoid_words) or 'inventar fatos'}",
            f"Comportamentos: {', '.join(profile.behavior_tags) or 'consultivo e objetivo'}",
            f"Politica de idioma: {profile.language_policy}",
            f"Instrucoes adicionais: {profile.custom_instructions or 'nenhuma'}",
        ]
    )


def _should_search_memory(payload: AgentRespondRequest) -> bool:
    if (
        payload.context_scope.meeting_id
        or payload.context_scope.client_external_id
        or payload.context_scope.meeting_type
        or payload.context_scope.customer
    ):
        return True

    message = payload.message.strip().lower()
    words = [word for word in message.replace("?", " ").replace(".", " ").split() if word]

    if len(words) <= 4 and any(
        greeting in message
        for greeting in {
            "oi",
            "ola",
            "olá",
            "bom dia",
            "boa tarde",
            "boa noite",
            "tudo bem",
            "coevo",
        }
    ):
        return False

    memory_terms = {
        "reuniao",
        "reunião",
        "reunioes",
        "reuniões",
        "cliente",
        "clientes",
        "projeto",
        "projetos",
        "pendencia",
        "pendência",
        "pendencias",
        "pendências",
        "decisao",
        "decisão",
        "decisoes",
        "decisões",
        "resumo",
        "transcricao",
        "transcrição",
        "risco",
        "riscos",
        "objecao",
        "objeção",
        "objecoes",
        "objeções",
        "promessa",
        "promessas",
        "prazo",
        "prazos",
        "follow-up",
        "followup",
        "historico",
        "histórico",
        "memoria",
        "memória",
        "lembra",
        "lembrar",
        "ficou",
        "combinado",
        "combinamos",
        "falou",
        "disse",
        "última",
        "ultima",
        "último",
        "ultimo",
    }

    return any(term in message for term in memory_terms)


async def _search_memory(
    *,
    settings: Settings,
    payload: AgentRespondRequest,
) -> list[MeetingMemorySearchResult]:
    embeddings = await embed_texts(settings=settings, texts=[payload.message])
    if not embeddings:
        return []

    results = await search_meeting_memory_items(
        settings=settings,
        query_embedding=embeddings[0],
        top_k=8,
        organization_id=payload.organization_id,
        requester_email=str(payload.user_email) if payload.user_email else None,
        requester_role=payload.requester_role,
        meeting_id=payload.context_scope.meeting_id,
        client_external_id=payload.context_scope.client_external_id,
        meeting_type=payload.context_scope.meeting_type,
        customer=payload.context_scope.customer,
    )
    return list(results)


async def _generate_answer(
    *,
    settings: Settings,
    payload: AgentRespondRequest,
    history: list[ConversationMessage],
    memory_results: list[MeetingMemorySearchResult],
    searched_memory: bool,
) -> str:
    profile = await get_agent_profile(settings=settings)
    history_text = _history_context(history)
    profile_text = _profile_context(profile)

    if not searched_memory:
        prompt = f"""
Voce e o {profile.name}, assistente corporativo do Coevo Meet.
Converse de forma fluida, humana, consultiva e breve.

Configuracao atual do agente:
{profile_text}

Objetivo neste canal:
- entender a demanda do usuario antes de buscar memorias;
- fazer perguntas de esclarecimento quando o pedido estiver aberto;
- orientar o usuario sobre o que voce consegue fazer;
- nao despejar resumo de reuniao sem ele pedir.

Historico recente do chat:
{history_text}

Mensagem do usuario:
{payload.message}

Responda naturalmente. Se for uma saudacao, cumprimente e pergunte como pode ajudar.
Se o pedido estiver vago, pergunte qual cliente, projeto, reuniao, prazo ou objetivo ele quer consultar.
"""
        if not settings.openai_api_key:
            return (
                "Oi, eu sou o Coevo. Posso te ajudar a consultar reunioes, pendencias, "
                "decisoes e proximos passos. O que voce quer encontrar?"
            )

        client = AsyncOpenAI(api_key=settings.openai_api_key)
        try:
            response = await client.responses.create(
                model=settings.openai_summary_model,
                input=prompt,
            )
            return response.output_text.strip()
        except OpenAIError:
            return (
                "Oi, eu sou o Coevo. Me diga o que voce quer consultar ou resolver "
                "e eu te ajudo a chegar no ponto certo."
            )

    if not memory_results:
        return (
            "Nao encontrei informacao suficiente nas memorias disponiveis para responder "
            "com seguranca. Me diga o cliente, projeto, reuniao ou periodo que voce quer "
            "consultar para eu procurar melhor."
        )

    context = _memory_context(memory_results)
    prompt = f"""
Voce e o {profile.name}, assistente corporativo do Coevo Meet.
Responda em portugues do Brasil, de forma objetiva, consultiva e segura.

Configuracao atual do agente:
{profile_text}

Regra de seguranca:
- Evite inventar fatos. Se a memoria nao trouxer suporte, diga que nao encontrou informacao suficiente.

Historico recente do chat:
{history_text}

Memorias de reunioes encontradas:
{context}

Pergunta do usuario:
{payload.message}

Responda usando apenas as memorias fornecidas.
Se a pergunta for ampla, sintetize e ofereca continuar por cliente, reuniao ou periodo.
Quando fizer sentido, cite a reuniao ou o tipo de memoria usado.
"""
    if not settings.openai_api_key:
        first = memory_results[0]
        return (
            f"Encontrei um registro relevante em {first.meeting_title or first.meeting_id}: "
            f"{first.content}"
        )

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    try:
        response = await client.responses.create(
            model=settings.openai_summary_model,
            input=prompt,
        )
    except OpenAIError:
        first = memory_results[0]
        return (
            f"Encontrei memoria relevante, mas nao consegui gerar uma resposta elaborada agora. "
            f"Registro principal: {first.content}"
        )

    return response.output_text.strip()


async def respond_with_agent_memory(
    *,
    settings: Settings,
    payload: AgentRespondRequest,
) -> AgentRespondResponse:
    session_id = payload.session_id or f"chat-{uuid4().hex[:12]}"
    existing = await get_conversation_session(settings=settings, session_id=session_id)
    title = existing.title if existing else _title_from_message(payload.message)
    context_scope = payload.context_scope.model_dump(exclude_none=True)

    session = await upsert_conversation_session(
        settings=settings,
        session_id=session_id,
        organization_id=payload.organization_id,
        agent_id=payload.agent_id,
        channel=payload.channel,
        user_id=payload.user_id,
        user_name=payload.user_name,
        user_email=str(payload.user_email) if payload.user_email else None,
        title=title,
        context_scope=context_scope,
    )
    history = list(
        await list_conversation_messages(
            settings=settings,
            session_id=session.id,
            limit=40,
        )
    )
    searched_memory = _should_search_memory(payload)
    memory_results = (
        await _search_memory(settings=settings, payload=payload)
        if searched_memory
        else []
    )
    user_message = await insert_conversation_message(
        settings=settings,
        session_id=session.id,
        role="user",
        content=payload.message,
        metadata={"context_scope": context_scope},
    )
    answer = await _generate_answer(
        settings=settings,
        payload=payload,
        history=history,
        memory_results=memory_results,
        searched_memory=searched_memory,
    )
    assistant_message = await insert_conversation_message(
        settings=settings,
        session_id=session.id,
        role="assistant",
        content=answer,
        metadata={
            "memory_result_ids": [item.id for item in memory_results],
            "memory_count": len(memory_results),
            "searched_memory": searched_memory,
        },
    )

    refreshed = await get_conversation_session(settings=settings, session_id=session.id)
    return AgentRespondResponse(
        session=refreshed or session,
        user_message=user_message,
        assistant_message=assistant_message,
        memory_results=memory_results,
    )
