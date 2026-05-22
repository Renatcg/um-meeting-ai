"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type CenterTab = "conversation" | "terminal" | "preview" | "diff" | "page";
type FileKind = "code" | "image" | "upload";
type MessageTone = "user" | "agent";

type RestorePoint = {
  id: string;
  title: string;
  detail: string;
};

type ConsoleFile = {
  id: string;
  group: string;
  name: string;
  kind: FileKind;
  status?: string;
};

type ChatMessage = {
  id: number;
  author: "Voce" | "Coevo Dev";
  tone: MessageTone;
  text: string;
};

type ChatSession = {
  id: string;
  title: string;
  age: string;
  messages: ChatMessage[];
};

type DevConsoleState = {
  chats: ChatSession[];
  restore_points: RestorePoint[];
  files: ConsoleFile[];
  terminal_lines: string[];
};

const initialRestorePoints: RestorePoint[] = [
  { id: "initial", title: "Estado inicial", detail: "antes dos ajustes" },
  { id: "hero", title: "Hero responsiva", detail: "2 arquivos alterados" },
  { id: "how", title: "Segunda dobra", detail: "build passou" },
  { id: "precommit", title: "Pre-commit", detail: "pronto para PR" },
];

const initialFiles: ConsoleFile[] = [
  {
    id: "labs-page",
    group: "Sistema",
    name: "apps/web/app/coevo-labs/page.tsx",
    kind: "code",
  },
  {
    id: "brand-logo",
    group: "Sistema",
    name: "apps/web/public/brand/logo.png",
    kind: "image",
  },
  {
    id: "antigravity",
    group: "Uploads",
    name: "referencia-antigravity.png",
    kind: "upload",
  },
  {
    id: "coevo-logo-upload",
    group: "Uploads",
    name: "coevo-labs-logo.png",
    kind: "upload",
  },
  {
    id: "dev-console-image",
    group: "Midias geradas",
    name: "dev-console-v3.png",
    kind: "image",
  },
  {
    id: "home-preview",
    group: "Midias geradas",
    name: "home-v2-preview.png",
    kind: "image",
  },
  {
    id: "changed-page",
    group: "Alterados",
    name: "page.tsx",
    kind: "code",
    status: "M",
  },
];

const initialChats: ChatSession[] = [
  {
    id: "labs",
    title: "LP Coevo Labs",
    age: "agora",
    messages: [
      {
        id: 1,
        author: "Voce",
        tone: "user",
        text: "Melhore a segunda dobra da Coevo Labs, mas crie um ponto antes.",
      },
      {
        id: 2,
        author: "Coevo Dev",
        tone: "agent",
        text: "Ponto de restauracao criado: Estado inicial. Vou ajustar espacamentos, preservar a identidade visual e validar o build antes do PR.",
      },
      {
        id: 3,
        author: "Coevo Dev",
        tone: "agent",
        text: "Clique em page.tsx ou no Preview Local para abrir em uma aba central. Se estiver bom, posso criar o commit e abrir o PR.",
      },
    ],
  },
  {
    id: "livekit",
    title: "Agente LiveKit",
    age: "2 d",
    messages: [
      {
        id: 4,
        author: "Coevo Dev",
        tone: "agent",
        text: "Contexto do agente LiveKit carregado. Posso revisar sala, audio, acoes e memoria de reunioes.",
      },
    ],
  },
  {
    id: "api",
    title: "API Railway",
    age: "3 d",
    messages: [
      {
        id: 5,
        author: "Coevo Dev",
        tone: "agent",
        text: "API Railway pronta para analise. Posso abrir endpoints, jobs e integracoes antes de propor mudancas.",
      },
    ],
  },
];

function tabClass(active: boolean) {
  return `h-9 rounded-t-lg border px-3 text-xs font-bold transition ${
    active
      ? "border-white/18 border-b-[#0A0D12] bg-[#0A0D12] text-white"
      : "border-white/10 bg-white/[0.035] text-white/48 hover:text-white"
  }`;
}

export default function DevConsolePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CenterTab>("conversation");
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(initialChats);
  const [activeChatId, setActiveChatId] = useState(initialChats[0].id);
  const [restorePoints, setRestorePoints] = useState(initialRestorePoints);
  const [files, setFiles] = useState<ConsoleFile[]>(initialFiles);
  const [activeRestoreId, setActiveRestoreId] = useState("precommit");
  const [selectedFileId, setSelectedFileId] = useState("changed-page");
  const [messageDraft, setMessageDraft] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("Conectando API...");
  const [terminalLines, setTerminalLines] = useState([
    "coevo-dev ~/um-meeting-ai main > iniciar tarefa /coevo-labs",
    "[ok] contexto lido",
    "[ok] apps/web/app/coevo-labs/page.tsx alterado",
    "[ok] preview local atualizado",
    "[...] aguardando revisao do diff",
  ]);

  const activeChat =
    chatSessions.find((chat) => chat.id === activeChatId) ?? chatSessions[0];
  const selectedFile =
    files.find((file) => file.id === selectedFileId) ?? files[0] ?? initialFiles[0];
  const fileGroups = useMemo(() => {
    return files.reduce<Record<string, ConsoleFile[]>>((groups, file) => {
      groups[file.group] = [...(groups[file.group] ?? []), file];
      return groups;
    }, {});
  }, [files]);

  useEffect(() => {
    async function loadState() {
      try {
        const response = await fetch(`${apiUrl}/dev-console/state`);
        if (!response.ok) {
          throw new Error("API indisponivel");
        }
        syncState((await response.json()) as DevConsoleState);
        setConnectionStatus("API conectada");
      } catch {
        setConnectionStatus("Modo local: API indisponivel");
      }
    }

    void loadState();
  }, []);

  function syncState(state: DevConsoleState) {
    setChatSessions(state.chats);
    setRestorePoints(state.restore_points);
    setFiles(state.files);
    setTerminalLines(state.terminal_lines);

    if (!state.chats.some((chat) => chat.id === activeChatId)) {
      setActiveChatId(state.chats[0]?.id ?? "labs");
    }
    if (!state.files.some((file) => file.id === selectedFileId)) {
      setSelectedFileId(state.files[0]?.id ?? "changed-page");
    }
  }

  function appendTerminal(line: string) {
    setTerminalLines((current) => [...current, line]);
  }

  async function startNewChat() {
    try {
      const response = await fetch(`${apiUrl}/dev-console/chats`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("API indisponivel");
      }
      const state = (await response.json()) as DevConsoleState;
      syncState(state);
      setActiveChatId(state.chats[0]?.id ?? activeChatId);
      setActiveTab("conversation");
      setConnectionStatus("API conectada");
      return;
    } catch {
      setConnectionStatus("Modo local: API indisponivel");
    }

    const nextChat: ChatSession = {
      id: `chat-${Date.now()}`,
      title: "Nova tarefa",
      age: "agora",
      messages: [
        {
          id: Date.now(),
          author: "Coevo Dev",
          tone: "agent",
          text: "Novo chat criado. Descreva a mudanca que voce quer planejar ou executar.",
        },
      ],
    };

    setChatSessions((current) => [nextChat, ...current]);
    setActiveChatId(nextChat.id);
    setActiveTab("conversation");
    appendTerminal("coevo-dev ~/um-meeting-ai main > novo chat criado");
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = messageDraft.trim();
    if (!text) {
      return;
    }

    try {
      const response = await fetch(
        `${apiUrl}/dev-console/chats/${activeChatId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        },
      );
      if (!response.ok) {
        throw new Error("API indisponivel");
      }
      syncState((await response.json()) as DevConsoleState);
      setMessageDraft("");
      setConnectionStatus("API conectada");
      return;
    } catch {
      setConnectionStatus("Modo local: API indisponivel");
    }

    const userMessage: ChatMessage = {
      id: Date.now(),
      author: "Voce",
      tone: "user",
      text,
    };
    const agentMessage: ChatMessage = {
      id: Date.now() + 1,
      author: "Coevo Dev",
      tone: "agent",
      text: "Entendi. Registrei sua solicitacao neste chat e atualizei o terminal com a proxima acao sugerida.",
    };

    setChatSessions((current) =>
      current.map((chat) =>
        chat.id === activeChatId
          ? {
              ...chat,
              age: "agora",
              messages: [...chat.messages, userMessage, agentMessage],
            }
          : chat,
      ),
    );
    setMessageDraft("");
    appendTerminal(`coevo-dev ~/um-meeting-ai main > ${text}`);
    appendTerminal("[...] proxima acao preparada pelo Coevo Dev");
  }

  function selectFile(file: ConsoleFile) {
    setSelectedFileId(file.id);
    setActiveTab(file.kind === "code" ? "page" : "preview");
  }

  async function runAction(
    action: "diff" | "build" | "commit" | "pr" | "restore",
    restorePointId?: string,
  ) {
    try {
      const response = await fetch(`${apiUrl}/dev-console/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          restore_point_id: restorePointId ?? null,
        }),
      });
      if (!response.ok) {
        throw new Error("API indisponivel");
      }
      const result = (await response.json()) as {
        state: DevConsoleState;
        active_restore_point_id?: string | null;
      };
      syncState(result.state);
      if (result.active_restore_point_id) {
        setActiveRestoreId(result.active_restore_point_id);
      }
      if (action === "diff") {
        setActiveTab("diff");
      }
      if (action === "build" || action === "restore") {
        setActiveTab("terminal");
      }
      setConnectionStatus("API conectada");
      return;
    } catch {
      setConnectionStatus("Modo local: API indisponivel");
    }

    const actionLabels = {
      diff: "diff aberto para revisao",
      build: "build iniciado no sandbox",
      commit: "ponto de commit criado",
      pr: "preparando abertura de PR",
      restore: `checkpoint ${restorePointId ?? "selecionado"}`,
    };

    appendTerminal(`coevo-dev ~/um-meeting-ai main > ${actionLabels[action]}`);

    if (action === "diff") {
      setActiveTab("diff");
    }
    if (action === "build") {
      setActiveTab("terminal");
    }
    if (action === "commit") {
      const nextPoint: RestorePoint = {
        id: `commit-${Date.now()}`,
        title: "Commit local",
        detail: "checkpoint criado agora",
      };
      setRestorePoints((current) => [...current, nextPoint]);
      setActiveRestoreId(nextPoint.id);
    }
  }

  return (
    <main className="h-screen overflow-hidden bg-[#05070C] text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-50"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.026) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.026) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(255,255,255,0.09),transparent_30%),radial-gradient(circle_at_18%_28%,rgba(255,255,255,0.045),transparent_24%),linear-gradient(135deg,rgba(5,7,12,0.96),#05070C_58%,#03050A)]" />

      <section className="relative z-10 grid h-screen grid-cols-1 overflow-hidden xl:grid-cols-[280px_minmax(0,1fr)_340px]">
        <aside className="hidden h-screen overflow-hidden border-r border-white/10 bg-[#080B10]/84 p-3 backdrop-blur-xl xl:grid xl:grid-rows-[210px_132px_minmax(0,1fr)_152px] xl:gap-3">
          <section className="min-h-0 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.025] p-3">
            <button
              className="flex w-full items-center gap-3 border-b border-white/10 pb-3 text-left"
              onClick={() => router.push("/home-v2")}
              type="button"
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-white font-display text-base font-bold text-[#05070C]">
                C
              </span>
              <span>
                <span className="block font-display text-sm font-semibold">Coevo Labs</span>
                <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-white/44">
                  Dev Console
                </span>
              </span>
            </button>

            <nav className="mt-3 space-y-1">
              {["Novo chat", "Pesquisar", "Projetos", "Automacoes"].map((item, index) => (
                <button
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-bold transition ${
                    index === 0
                      ? "border border-white/18 bg-white/10 text-white"
                      : "text-white/52 hover:bg-white/[0.06] hover:text-white"
                  }`}
                  key={item}
                  onClick={index === 0 ? startNewChat : undefined}
                  type="button"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-md border border-white/12 font-mono text-[10px]">
                    {item[0]}
                  </span>
                  {item}
                </button>
              ))}
            </nav>
          </section>

          <section className="min-h-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.025] p-3">
            <p className="px-1 font-mono text-[11px] uppercase tracking-[0.18em] text-white/34">
              Chats
            </p>
            <div className="mt-2 max-h-[92px] space-y-1 overflow-y-auto pr-1">
              {chatSessions.map((chat) => (
                <button
                  className={`flex w-full items-center justify-between gap-3 rounded-lg border px-2.5 py-1.5 text-left transition ${
                    activeChatId === chat.id
                      ? "border-white/18 bg-white/10"
                      : "border-white/8 bg-white/[0.025] hover:border-white/16"
                  }`}
                  key={chat.id}
                  onClick={() => {
                    setActiveChatId(chat.id);
                    setActiveTab("conversation");
                  }}
                  type="button"
                >
                  <span className="min-w-0 truncate text-[11px] font-bold">{chat.title}</span>
                  <span className="shrink-0 font-mono text-[10px] uppercase text-white/34">
                    {chat.age}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="min-h-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.025] p-3">
            <p className="px-1 font-mono text-[11px] uppercase tracking-[0.18em] text-white/34">
              Pontos de restauracao
            </p>
            <div className="mt-2 h-[calc(100%-24px)] overflow-y-auto rounded-lg border border-white/10 bg-white/[0.035] p-1.5">
              {restorePoints.map((point, index) => (
                <button
                  className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-white/[0.055] ${
                    activeRestoreId === point.id ? "bg-white/10" : ""
                  }`}
                  key={point.id}
                  onClick={() => {
                    setActiveRestoreId(point.id);
                    void runAction("restore", point.id);
                  }}
                  type="button"
                >
                  <span
                    className={`mt-1 h-2.5 w-2.5 rounded-full ${
                      activeRestoreId === point.id || index === restorePoints.length - 1
                        ? "bg-white"
                        : "bg-white/42"
                    }`}
                  />
                  <span>
                    <span className="block text-[11px] font-bold">{point.title}</span>
                    <span className="mt-0.5 block text-[11px] text-white/42">
                      {point.detail}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="min-h-0 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/34">
                  Preview local
                </p>
                <p className="text-[11px] font-bold">/coevo-labs</p>
              </div>
              <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-white/62">
                rodando
              </span>
            </div>
            <button
              className="mt-2 h-20 w-full overflow-hidden rounded-lg border border-white/10 bg-[#03050A] p-2.5 text-left"
              onClick={() => setActiveTab("preview")}
              type="button"
            >
              <span className="block h-2 w-24 rounded-full bg-white/76" />
              <span className="mt-3 block h-4 w-32 rounded-md bg-white/18" />
              <span className="mt-3 grid grid-cols-3 gap-1.5">
                <span className="h-4 rounded-md bg-white/10" />
                <span className="h-4 rounded-md bg-white/10" />
                <span className="h-4 rounded-md bg-white/10" />
              </span>
            </button>
          </section>
        </aside>

        <section className="flex h-screen min-w-0 flex-col overflow-hidden border-r border-white/10">
          <header className="shrink-0 border-b border-white/10 bg-[#05070C]/72 px-4 pt-4 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/38">
                  um-meeting-ai / main / sandbox seguro
                </p>
                <h1 className="mt-1 font-display text-xl font-semibold md:text-2xl">
                  LP Coevo Labs
                </h1>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/34">
                  {connectionStatus}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-lg border border-white/12 bg-white/[0.035] px-3 py-2 text-xs font-bold text-white/64 transition hover:text-white"
                  onClick={() => router.push("/home-v2")}
                  type="button"
                >
                  Home
                </button>
                <button className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#05070C]" type="button">
                  Nova tarefa
                </button>
              </div>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto">
              {[
                ["conversation", "Conversa"],
                ["terminal", "Terminal"],
                ["preview", "Preview Local"],
                ["diff", "Diff"],
                ["page", "page.tsx"],
              ].map(([id, label]) => (
                <button
                  className={tabClass(activeTab === id)}
                  key={id}
                  onClick={() => setActiveTab(id as CenterTab)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-hidden p-4 md:p-5">
            {activeTab === "conversation" ? (
              <div className="mx-auto max-w-5xl space-y-3">
                {activeChat.messages.map((message) => (
                  <article
                    className={`max-w-3xl ${message.tone === "user" ? "ml-auto" : ""}`}
                    key={`${message.author}-${message.text}`}
                  >
                    <p className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.14em] text-white/36">
                      {message.author}
                    </p>
                    <div
                      className={`rounded-xl border p-4 text-xs leading-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)] ${
                        message.tone === "user"
                          ? "border-white/16 bg-white text-[#05070C]"
                          : "border-white/10 bg-white/[0.045] text-white/72"
                      }`}
                    >
                      {message.text}
                    </div>
                  </article>
                ))}

                <pre className="overflow-x-auto rounded-xl border border-white/10 bg-[#03050A] p-4 font-mono text-xs leading-6 text-white/72 shadow-[0_28px_90px_rgba(0,0,0,0.32)]">
{terminalLines.slice(-5).join("\n")}
                </pre>
              </div>
            ) : null}

            {activeTab === "terminal" ? (
              <pre className="h-full overflow-x-auto rounded-xl border border-white/10 bg-[#03050A] p-5 font-mono text-xs leading-7 text-white/72">
{terminalLines.join("\n")}
              </pre>
            ) : null}

            {activeTab === "preview" ? (
              <div className="overflow-hidden rounded-xl border border-white/10 bg-white text-[#05070C] shadow-[0_28px_90px_rgba(0,0,0,0.32)]">
                <div className="flex items-center gap-2 border-b border-black/10 bg-[#F7F7F4] px-4 py-3">
                  <span className="h-3 w-3 rounded-full bg-black/20" />
                  <span className="h-3 w-3 rounded-full bg-black/20" />
                  <span className="h-3 w-3 rounded-full bg-black/20" />
                  <span className="ml-4 rounded-md bg-white px-3 py-1 font-mono text-xs text-black/48">
                    localhost:3000/coevo-labs
                  </span>
                </div>
                <div className="grid h-[calc(100vh-220px)] place-items-center bg-[#05070C] p-6 text-white">
                  <div className="max-w-3xl text-center">
                    <p className="font-mono text-xs uppercase tracking-[0.24em] text-white/44">
                      Coevo Labs
                    </p>
                    <h2 className="mt-5 font-display text-4xl font-semibold leading-tight">
                      Ideias que transformam.
                    </h2>
                    <div className="mx-auto mt-10 grid max-w-2xl grid-cols-3 gap-3">
                      <span className="h-20 rounded-lg border border-white/10 bg-white/[0.06]" />
                      <span className="h-20 rounded-lg border border-white/10 bg-white/[0.06]" />
                      <span className="h-20 rounded-lg border border-white/10 bg-white/[0.06]" />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "diff" ? (
              <pre className="h-full overflow-x-auto rounded-xl border border-white/10 bg-[#03050A] p-5 font-mono text-xs leading-6 text-white/72">
{`diff --git a/apps/web/app/coevo-labs/page.tsx b/apps/web/app/coevo-labs/page.tsx
@@ segunda dobra @@
- padding: 96px 48px 72px;
+ padding: clamp(72px, 8vw, 112px) clamp(20px, 4vw, 56px);
+ grid-template-columns responsivas para mobile;`}
              </pre>
            ) : null}

            {activeTab === "page" ? (
              <pre className="h-full overflow-x-auto rounded-xl border border-white/10 bg-[#03050A] p-5 font-mono text-xs leading-6 text-white/72">
{`export default function CoevoLabsLandingPage() {
  return (
    <main className="coevo-labs-page">
      <section className="coevo-how-section">
        <h2>Da ideia a solucao</h2>
      </section>
    </main>
  );
}`}
              </pre>
            ) : null}
          </div>

          <form className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto_auto] gap-2 border-t border-white/10 bg-[#05070C]/84 p-3 backdrop-blur-xl" onSubmit={sendMessage}>
            <button className="h-10 w-10 rounded-lg border border-white/12 bg-white/[0.035] text-lg text-white/62" onClick={startNewChat} type="button">
              +
            </button>
            <input
              className="min-w-0 rounded-lg border border-white/12 bg-white/[0.045] px-4 text-xs text-white outline-none placeholder:text-white/34 focus:border-white/34"
              placeholder="Converse com o Coevo Dev ou peca uma alteracao..."
              value={messageDraft}
              onChange={(event) => setMessageDraft(event.target.value)}
            />
            <button className="h-10 w-10 rounded-lg border border-white/12 bg-white/[0.035] text-[11px] text-white/62" type="button">
              mic
            </button>
            <button className="h-10 rounded-lg bg-white px-4 text-xs font-bold text-[#05070C]" type="submit">
              Enviar
            </button>
          </form>
        </section>

        <aside className="hidden h-screen overflow-hidden bg-[#080B10]/84 p-4 backdrop-blur-xl xl:grid xl:grid-rows-[minmax(0,1fr)_300px_auto] xl:gap-3">
          <section className="min-h-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.035]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h2 className="font-display text-base font-semibold">Arquivos usados</h2>
              <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-xs text-white/52">
                7
              </span>
            </div>
            <div className="max-h-full overflow-y-auto p-3">
              {Object.entries(fileGroups).map(([group, files]) => (
                <div className="mb-4" key={group}>
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-white/34">
                    {group}
                  </p>
                  <div className="mt-2 space-y-1">
                    {files.map((file) => (
                      <button
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs transition hover:bg-white/[0.055] ${
                          file.id === selectedFileId ? "bg-white/10 text-white" : "text-white/58"
                        }`}
                        key={file.id}
                        onClick={() => selectFile(file)}
                        type="button"
                      >
                        <span className="text-white/34">[]</span>
                        <span className="min-w-0 flex-1 truncate">{file.name}</span>
                        {file.status ? (
                          <span className="rounded-full bg-white/12 px-2 py-0.5 font-mono text-[10px] text-white/64">
                            {file.status}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.035]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h2 className="font-display text-base font-semibold">Preview do arquivo</h2>
              <button
                className="rounded-lg border border-white/12 bg-white/[0.035] px-3 py-1.5 text-xs font-bold text-white/62 transition hover:text-white"
                onClick={() => setActiveTab(selectedFile.kind === "code" ? "page" : "preview")}
                type="button"
              >
                Expandir
              </button>
            </div>
            {selectedFile.kind === "code" ? (
              <pre className="h-full overflow-hidden bg-[#03050A] p-4 font-mono text-[11px] leading-5 text-white/70">
{`export default function Page() {
  return (
    <section className="labs-hero">
      <h1>Ideias que transformam</h1>
    </section>
  );
}`}
              </pre>
            ) : (
              <div className="grid h-full place-items-center bg-[#03050A] p-4">
                <div className="w-full">
                  <div className="aspect-video w-full rounded-lg border border-white/10 bg-white/[0.08]" />
                  <p className="mt-3 truncate text-center font-mono text-[11px] text-white/42">
                    {selectedFile.name}
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="grid grid-cols-2 gap-3">
            <button className="rounded-lg border border-white/12 bg-white/[0.035] px-3 py-2.5 text-xs font-bold text-white/70" onClick={() => runAction("diff")} type="button">
              Ver diff
            </button>
            <button className="rounded-lg border border-white/12 bg-white/[0.035] px-3 py-2.5 text-xs font-bold text-white/70" onClick={() => runAction("build")} type="button">
              Rodar build
            </button>
            <button className="rounded-lg border border-white/36 bg-white/[0.035] px-3 py-2.5 text-xs font-bold text-white" onClick={() => runAction("commit")} type="button">
              Criar commit
            </button>
            <button className="rounded-lg bg-white px-3 py-2.5 text-xs font-bold text-[#05070C]" onClick={() => runAction("pr")} type="button">
              Abrir PR
            </button>
          </section>
        </aside>
      </section>
    </main>
  );
}
