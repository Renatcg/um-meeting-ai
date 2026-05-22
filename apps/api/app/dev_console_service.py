from copy import deepcopy
from time import time

from app.models import (
    DevConsoleAction,
    DevConsoleChatSession,
    DevConsoleFile,
    DevConsoleMessage,
    DevConsoleRestorePoint,
    DevConsoleState,
)


_state = DevConsoleState(
    chats=[
        DevConsoleChatSession(
            id="labs",
            title="LP Coevo Labs",
            age="agora",
            messages=[
                DevConsoleMessage(
                    id=1,
                    author="Voce",
                    tone="user",
                    text="Melhore a segunda dobra da Coevo Labs, mas crie um ponto antes.",
                ),
                DevConsoleMessage(
                    id=2,
                    author="Coevo Dev",
                    tone="agent",
                    text=(
                        "Ponto de restauracao criado: Estado inicial. Vou ajustar "
                        "espacamentos, preservar a identidade visual e validar o build antes do PR."
                    ),
                ),
                DevConsoleMessage(
                    id=3,
                    author="Coevo Dev",
                    tone="agent",
                    text=(
                        "Clique em page.tsx ou no Preview Local para abrir em uma aba central. "
                        "Se estiver bom, posso criar o commit e abrir o PR."
                    ),
                ),
            ],
        ),
        DevConsoleChatSession(
            id="livekit",
            title="Agente LiveKit",
            age="2 d",
            messages=[
                DevConsoleMessage(
                    id=4,
                    author="Coevo Dev",
                    tone="agent",
                    text=(
                        "Contexto do agente LiveKit carregado. Posso revisar sala, audio, "
                        "acoes e memoria de reunioes."
                    ),
                ),
            ],
        ),
        DevConsoleChatSession(
            id="api",
            title="API Railway",
            age="3 d",
            messages=[
                DevConsoleMessage(
                    id=5,
                    author="Coevo Dev",
                    tone="agent",
                    text=(
                        "API Railway pronta para analise. Posso abrir endpoints, jobs e "
                        "integracoes antes de propor mudancas."
                    ),
                ),
            ],
        ),
    ],
    restore_points=[
        DevConsoleRestorePoint(id="initial", title="Estado inicial", detail="antes dos ajustes"),
        DevConsoleRestorePoint(id="hero", title="Hero responsiva", detail="2 arquivos alterados"),
        DevConsoleRestorePoint(id="how", title="Segunda dobra", detail="build passou"),
        DevConsoleRestorePoint(id="precommit", title="Pre-commit", detail="pronto para PR"),
    ],
    files=[
        DevConsoleFile(
            id="labs-page",
            group="Sistema",
            name="apps/web/app/coevo-labs/page.tsx",
            kind="code",
        ),
        DevConsoleFile(
            id="brand-logo",
            group="Sistema",
            name="apps/web/public/brand/logo.png",
            kind="image",
        ),
        DevConsoleFile(
            id="antigravity",
            group="Uploads",
            name="referencia-antigravity.png",
            kind="upload",
        ),
        DevConsoleFile(
            id="coevo-logo-upload",
            group="Uploads",
            name="coevo-labs-logo.png",
            kind="upload",
        ),
        DevConsoleFile(
            id="dev-console-image",
            group="Midias geradas",
            name="dev-console-v3.png",
            kind="image",
        ),
        DevConsoleFile(
            id="home-preview",
            group="Midias geradas",
            name="home-v2-preview.png",
            kind="image",
        ),
        DevConsoleFile(
            id="changed-page",
            group="Alterados",
            name="page.tsx",
            kind="code",
            status="M",
        ),
    ],
    terminal_lines=[
        "coevo-dev ~/um-meeting-ai main > iniciar tarefa /coevo-labs",
        "[ok] contexto lido",
        "[ok] apps/web/app/coevo-labs/page.tsx alterado",
        "[ok] preview local atualizado",
        "[...] aguardando revisao do diff",
    ],
)


def _next_id() -> int:
    return int(time() * 1000)


def get_dev_console_state() -> DevConsoleState:
    return deepcopy(_state)


def create_dev_console_chat() -> DevConsoleState:
    chat_id = f"chat-{_next_id()}"
    _state.chats.insert(
        0,
        DevConsoleChatSession(
            id=chat_id,
            title="Nova tarefa",
            age="agora",
            messages=[
                DevConsoleMessage(
                    id=_next_id(),
                    author="Coevo Dev",
                    tone="agent",
                    text="Novo chat criado. Descreva a mudanca que voce quer planejar ou executar.",
                )
            ],
        ),
    )
    _state.terminal_lines.append("coevo-dev ~/um-meeting-ai main > novo chat criado")
    return get_dev_console_state()


def add_dev_console_message(*, chat_id: str, message: str) -> DevConsoleState:
    chat = next((item for item in _state.chats if item.id == chat_id), None)
    if chat is None:
        chat = _state.chats[0]

    chat.messages.extend(
        [
            DevConsoleMessage(
                id=_next_id(),
                author="Voce",
                tone="user",
                text=message,
            ),
            DevConsoleMessage(
                id=_next_id() + 1,
                author="Coevo Dev",
                tone="agent",
                text=(
                    "Entendi. Registrei sua solicitacao neste chat e atualizei o terminal "
                    "com a proxima acao sugerida."
                ),
            ),
        ]
    )
    chat.age = "agora"
    _state.terminal_lines.append(f"coevo-dev ~/um-meeting-ai main > {message}")
    _state.terminal_lines.append("[...] proxima acao preparada pelo Coevo Dev")
    return get_dev_console_state()


def run_dev_console_action(
    *,
    action: DevConsoleAction,
    restore_point_id: str | None = None,
) -> tuple[DevConsoleState, str | None]:
    labels = {
        "diff": "diff aberto para revisao",
        "build": "build iniciado no sandbox",
        "commit": "ponto de commit criado",
        "pr": "preparando abertura de PR",
        "restore": f"checkpoint {restore_point_id or 'selecionado'}",
    }
    _state.terminal_lines.append(f"coevo-dev ~/um-meeting-ai main > {labels[action]}")

    active_restore_point_id = restore_point_id
    if action == "commit":
        active_restore_point_id = f"commit-{_next_id()}"
        _state.restore_points.append(
            DevConsoleRestorePoint(
                id=active_restore_point_id,
                title="Commit local",
                detail="checkpoint criado agora",
            )
        )

    return get_dev_console_state(), active_restore_point_id
