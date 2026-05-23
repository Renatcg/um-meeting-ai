"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type CenterTab = "conversation" | "terminal" | "preview" | "diff" | "file";
type FileKind = "code" | "image" | "text";

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
  status?: string | null;
};

type DevConsoleProject = {
  id: string;
  name: string;
  repo_root?: string | null;
  default_route: string;
  owner_user_id: number;
  permission: "owner" | "edit" | "view";
  created_at: string;
  updated_at: string;
};

type ChatMessage = {
  id: number;
  author: "Voce" | "Coevo Dev";
  tone: "user" | "agent";
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
  projects: DevConsoleProject[];
  active_project_id: string;
};

type FileContent = {
  path: string;
  name: string;
  kind: FileKind;
  content: string | null;
};

const emptyState: DevConsoleState = {
  chats: [],
  restore_points: [],
  files: [],
  terminal_lines: ["coevo-dev > aguardando conexao com a API"],
  projects: [],
  active_project_id: "um-meeting-ai",
};

function tabClass(active: boolean) {
  return `h-9 rounded-t-lg border px-3 text-xs font-bold transition ${
    active
      ? "border-white/18 border-b-[#0A0D12] bg-[#0A0D12] text-white"
      : "border-white/10 bg-white/[0.035] text-white/48 hover:text-white"
  }`;
}

function publicAssetUrl(path: string) {
  const marker = "apps/web/public";
  if (!path.startsWith(marker)) {
    return null;
  }
  return path.slice(marker.length) || "/";
}

function getAuthHeaders(): HeadersInit {
  if (typeof window === "undefined") {
    return {};
  }

  const token = window.localStorage.getItem("coevo-auth-token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function authStatusMessage(status: number) {
  if (status === 401) {
    return "Login necessario para acessar o Dev Console";
  }
  if (status === 403) {
    return "Sem permissao para este projeto";
  }
  return "API indisponivel";
}

async function responseErrorMessage(response: Response) {
  if (response.status === 401 || response.status === 403) {
    return authStatusMessage(response.status);
  }

  try {
    const payload = (await response.json()) as { detail?: string };
    return payload.detail || authStatusMessage(response.status);
  } catch {
    return authStatusMessage(response.status);
  }
}

export default function DevConsolePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CenterTab>("conversation");
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [restorePoints, setRestorePoints] = useState<RestorePoint[]>([]);
  const [files, setFiles] = useState<ConsoleFile[]>([]);
  const [projects, setProjects] = useState<DevConsoleProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState("um-meeting-ai");
  const [activeRestoreId, setActiveRestoreId] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<FileContent | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("Conectando API...");
  const [terminalLines, setTerminalLines] = useState(emptyState.terminal_lines);
  const [diff, setDiff] = useState("Carregue o diff real do projeto pelo botao Ver diff.");

  const activeChat = chatSessions.find((chat) => chat.id === activeChatId) ?? null;
  const selectedFile = files.find((file) => file.id === selectedFileId) ?? files[0] ?? null;
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0] ?? null;
  const selectedPublicImage = selectedFile ? publicAssetUrl(selectedFile.name) : null;

  const fileGroups = useMemo(() => {
    return files.reduce<Record<string, ConsoleFile[]>>((groups, file) => {
      groups[file.group] = [...(groups[file.group] ?? []), file];
      return groups;
    }, {});
  }, [files]);

  useEffect(() => {
    async function loadState() {
      try {
        const response = await fetch(
          `${apiUrl}/dev-console/state?project_id=${encodeURIComponent(activeProjectId)}`,
          {
            cache: "no-store",
            headers: getAuthHeaders(),
          },
        );
        if (!response.ok) {
          throw new Error(await responseErrorMessage(response));
        }
        syncState((await response.json()) as DevConsoleState);
        setConnectionStatus("API conectada");
      } catch (error) {
        syncState(emptyState);
        setConnectionStatus(error instanceof Error ? error.message : "API indisponivel");
      }
    }

    void loadState();
  }, [activeProjectId]);

  useEffect(() => {
    if (!selectedFile) {
      setSelectedFileContent(null);
      return;
    }
    void loadFile(selectedFile);
  }, [selectedFile?.id, activeProjectId]);

  function syncState(state: DevConsoleState) {
    setChatSessions(state.chats);
    setRestorePoints(state.restore_points);
    setFiles(state.files);
    setProjects(state.projects);
    setActiveProjectId(state.active_project_id);
    setTerminalLines(state.terminal_lines.length ? state.terminal_lines : emptyState.terminal_lines);

    setActiveChatId((current) =>
      current && state.chats.some((chat) => chat.id === current)
        ? current
        : state.chats[0]?.id ?? null,
    );
    setSelectedFileId((current) =>
      current && state.files.some((file) => file.id === current)
        ? current
        : state.files[0]?.id ?? null,
    );
    setActiveRestoreId((current) =>
      current && state.restore_points.some((point) => point.id === current)
        ? current
        : state.restore_points[0]?.id ?? null,
    );
  }

  async function loadFile(file: ConsoleFile) {
    if (file.kind === "image") {
      setSelectedFileContent({
        path: file.name,
        name: file.name.split("/").pop() ?? file.name,
        kind: "image",
        content: null,
      });
      return;
    }

    try {
      const encodedPath = file.name.split("/").map(encodeURIComponent).join("/");
      const response = await fetch(
        `${apiUrl}/dev-console/files/${encodedPath}?project_id=${encodeURIComponent(activeProjectId)}`,
        {
          cache: "no-store",
          headers: getAuthHeaders(),
        },
      );
      if (!response.ok) {
        throw new Error(await responseErrorMessage(response));
      }
      setSelectedFileContent((await response.json()) as FileContent);
      setConnectionStatus("API conectada");
    } catch (error) {
      setSelectedFileContent({
        path: file.name,
        name: file.name.split("/").pop() ?? file.name,
        kind: file.kind,
        content: "Nao foi possivel carregar este arquivo pela API.",
      });
      setConnectionStatus(error instanceof Error ? error.message : "API indisponivel");
    }
  }

  function selectFile(file: ConsoleFile) {
    setSelectedFileId(file.id);
    setActiveTab("file");
  }

  function startNewChat() {
    const nextChat: ChatSession = {
      id: `chat-${Date.now()}`,
      title: "Nova conversa",
      age: "agora",
      messages: [],
    };
    setChatSessions((current) => [nextChat, ...current]);
    setActiveChatId(nextChat.id);
    setActiveTab("conversation");
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = messageDraft.trim();
    if (!text || !activeChatId) {
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now(),
      author: "Voce",
      tone: "user",
      text,
    };
    setChatSessions((current) =>
      current.map((chat) =>
        chat.id === activeChatId
          ? {
              ...chat,
              age: "agora",
              title: chat.messages.length ? chat.title : text.slice(0, 42),
              messages: [...chat.messages, userMessage],
            }
          : chat,
      ),
    );
    setMessageDraft("");
  }

  async function runAction(action: "diff" | "build" | "commit" | "pr" | "restore", restorePointId?: string) {
    if (action === "diff") {
      try {
        const query = selectedFile ? `?path=${encodeURIComponent(selectedFile.name)}` : "";
        const separator = query ? "&" : "?";
        const response = await fetch(
          `${apiUrl}/dev-console/diff${query}${separator}project_id=${encodeURIComponent(activeProjectId)}`,
          {
            cache: "no-store",
            headers: getAuthHeaders(),
          },
        );
        if (!response.ok) {
          throw new Error(await responseErrorMessage(response));
        }
        const result = (await response.json()) as { diff: string; terminal_lines: string[] };
        setDiff(result.diff);
        setTerminalLines(result.terminal_lines);
        setActiveTab("diff");
        setConnectionStatus("API conectada");
      } catch (error) {
        setDiff("Nao foi possivel carregar o diff real pela API.");
        setActiveTab("diff");
        setConnectionStatus(error instanceof Error ? error.message : "API indisponivel");
      }
      return;
    }

    if (action === "restore") {
      setActiveRestoreId(restorePointId ?? null);
      setActiveTab("terminal");
      return;
    }

    setTerminalLines((current) => [
      ...current,
      `[bloqueado] ${action}: executor seguro ainda nao conectado`,
    ]);
    setActiveTab("terminal");
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
              {chatSessions.length ? (
                chatSessions.map((chat) => (
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
                ))
              ) : (
                <p className="rounded-lg border border-white/8 bg-white/[0.025] px-3 py-2 text-[11px] text-white/42">
                  Nenhuma conversa salva ainda.
                </p>
              )}
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
                  onClick={() => runAction("restore", point.id)}
                  type="button"
                >
                  <span
                    className={`mt-1 h-2.5 w-2.5 rounded-full ${
                      activeRestoreId === point.id || index === 0 ? "bg-white" : "bg-white/42"
                    }`}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-bold">{point.title}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-white/42">
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
                real
              </span>
            </div>
            <button
              className="mt-2 h-20 w-full overflow-hidden rounded-lg border border-white/10 bg-[#03050A] text-left"
              onClick={() => setActiveTab("preview")}
              type="button"
            >
              <iframe className="h-[240px] w-[300%] origin-top-left scale-[0.33]" src="/coevo-labs" title="Preview local reduzido" />
            </button>
          </section>
        </aside>

        <section className="flex h-screen min-w-0 flex-col overflow-hidden border-r border-white/10">
          <header className="shrink-0 border-b border-white/10 bg-[#05070C]/72 px-4 pt-4 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/38">
                  {activeProject?.id ?? activeProjectId} / main / sandbox seguro
                </p>
                <h1 className="mt-1 font-display text-xl font-semibold md:text-2xl">
                  {activeProject?.name ?? "Coevo Dev Console"}
                </h1>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/34">
                  {connectionStatus}
                  {activeProject ? ` / ${activeProject.permission}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {projects.length > 1 ? (
                  <select
                    className="h-9 rounded-lg border border-white/12 bg-white/[0.035] px-3 text-xs font-bold text-white/72 outline-none"
                    value={activeProjectId}
                    onChange={(event) => setActiveProjectId(event.target.value)}
                  >
                    {projects.map((project) => (
                      <option className="bg-[#080B10] text-white" key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                <button
                  className="rounded-lg border border-white/12 bg-white/[0.035] px-3 py-2 text-xs font-bold text-white/64 transition hover:text-white"
                  onClick={() => router.push("/home-v2")}
                  type="button"
                >
                  Home
                </button>
                <button className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#05070C]" onClick={startNewChat} type="button">
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
                ["file", selectedFile?.name.split("/").pop() ?? "Arquivo"],
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
              <div className="mx-auto flex h-full max-w-5xl flex-col">
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
                  {activeChat?.messages.length ? (
                    activeChat.messages.map((message) => (
                      <article
                        className={`max-w-3xl ${message.tone === "user" ? "ml-auto" : ""}`}
                        key={`${message.id}-${message.author}`}
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
                    ))
                  ) : activeChat ? (
                    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-5 text-sm text-white/58">
                      Converse aqui para registrar o pedido. A resposta automatica do Coevo Dev ainda nao foi ligada ao executor seguro.
                    </div>
                  ) : (
                    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-5 text-sm text-white/58">
                      Crie uma nova conversa para falar com o Coevo Dev. Por enquanto, a parte real conectada e leitura de arquivos, status e diff.
                    </div>
                  )}

                  <pre className="overflow-x-auto rounded-xl border border-white/10 bg-[#03050A] p-4 font-mono text-xs leading-6 text-white/72 shadow-[0_28px_90px_rgba(0,0,0,0.32)]">
{terminalLines.slice(-8).join("\n")}
                  </pre>
                </div>
              </div>
            ) : null}

            {activeTab === "terminal" ? (
              <pre className="h-full overflow-auto rounded-xl border border-white/10 bg-[#03050A] p-5 font-mono text-xs leading-7 text-white/72">
{terminalLines.join("\n")}
              </pre>
            ) : null}

            {activeTab === "preview" ? (
              <div className="h-full overflow-hidden rounded-xl border border-white/10 bg-white shadow-[0_28px_90px_rgba(0,0,0,0.32)]">
                <div className="flex items-center gap-2 border-b border-black/10 bg-[#F7F7F4] px-4 py-3">
                  <span className="h-3 w-3 rounded-full bg-black/20" />
                  <span className="h-3 w-3 rounded-full bg-black/20" />
                  <span className="h-3 w-3 rounded-full bg-black/20" />
                  <span className="ml-4 rounded-md bg-white px-3 py-1 font-mono text-xs text-black/48">
                    /coevo-labs
                  </span>
                </div>
                <iframe className="h-[calc(100%-45px)] w-full" src="/coevo-labs" title="Preview local da Coevo Labs" />
              </div>
            ) : null}

            {activeTab === "diff" ? (
              <pre className="h-full overflow-auto rounded-xl border border-white/10 bg-[#03050A] p-5 font-mono text-xs leading-6 text-white/72">
{diff}
              </pre>
            ) : null}

            {activeTab === "file" ? (
              selectedFile?.kind === "image" && selectedPublicImage ? (
                <div className="grid h-full place-items-center rounded-xl border border-white/10 bg-[#03050A] p-5">
                  <img alt={selectedFile.name} className="max-h-full max-w-full object-contain" src={selectedPublicImage} />
                </div>
              ) : (
                <pre className="h-full overflow-auto rounded-xl border border-white/10 bg-[#03050A] p-5 font-mono text-xs leading-6 text-white/72">
{selectedFileContent?.content ?? "Selecione um arquivo para visualizar."}
                </pre>
              )
            ) : null}
          </div>

          <form className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto_auto] gap-2 border-t border-white/10 bg-[#05070C]/84 p-3 backdrop-blur-xl" onSubmit={sendMessage}>
            <button className="h-10 w-10 rounded-lg border border-white/12 bg-white/[0.035] text-lg text-white/62" onClick={startNewChat} type="button">
              +
            </button>
            <input
              className="min-w-0 rounded-lg border border-white/12 bg-white/[0.045] px-4 text-xs text-white outline-none placeholder:text-white/34 focus:border-white/34"
              disabled={!activeChatId}
              placeholder={activeChatId ? "Converse com o Coevo Dev..." : "Crie uma nova conversa para enviar mensagens"}
              value={messageDraft}
              onChange={(event) => setMessageDraft(event.target.value)}
            />
            <button className="h-10 w-10 rounded-lg border border-white/12 bg-white/[0.035] text-[11px] text-white/62" type="button">
              mic
            </button>
            <button className="h-10 rounded-lg bg-white px-4 text-xs font-bold text-[#05070C] disabled:opacity-45" disabled={!activeChatId} type="submit">
              Enviar
            </button>
          </form>
        </section>

        <aside className="hidden h-screen overflow-hidden bg-[#080B10]/84 p-4 backdrop-blur-xl xl:grid xl:grid-rows-[minmax(0,1fr)_300px_auto] xl:gap-3">
          <section className="min-h-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.035]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h2 className="font-display text-base font-semibold">Arquivos usados</h2>
              <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-xs text-white/52">
                {files.length}
              </span>
            </div>
            <div className="max-h-full overflow-y-auto p-3">
              {Object.entries(fileGroups).length ? (
                Object.entries(fileGroups).map(([group, groupedFiles]) => (
                  <div className="mb-4" key={group}>
                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-white/34">
                      {group}
                    </p>
                    <div className="mt-2 space-y-1">
                      {groupedFiles.map((file) => (
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
                ))
              ) : (
                <p className="rounded-lg border border-white/8 bg-white/[0.025] p-3 text-xs text-white/42">
                  Nenhum arquivo retornado pela API.
                </p>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.035]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h2 className="font-display text-base font-semibold">Preview do arquivo</h2>
              <button
                className="rounded-lg border border-white/12 bg-white/[0.035] px-3 py-1.5 text-xs font-bold text-white/62 transition hover:text-white"
                onClick={() => setActiveTab("file")}
                type="button"
              >
                Expandir
              </button>
            </div>
            {selectedFile?.kind === "image" && selectedPublicImage ? (
              <div className="grid h-full place-items-center bg-[#03050A] p-4">
                <img alt={selectedFile.name} className="max-h-full max-w-full object-contain" src={selectedPublicImage} />
              </div>
            ) : (
              <pre className="h-full overflow-hidden bg-[#03050A] p-4 font-mono text-[11px] leading-5 text-white/70">
{selectedFileContent?.content ?? "Selecione um arquivo."}
              </pre>
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
