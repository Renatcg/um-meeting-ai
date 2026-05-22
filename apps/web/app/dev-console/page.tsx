"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CenterTab = "conversation" | "terminal" | "preview" | "diff" | "page";
type FilePreview = "code" | "image";

const restorePoints = [
  ["Estado inicial", "antes dos ajustes"],
  ["Hero responsiva", "2 arquivos alterados"],
  ["Segunda dobra", "build passou"],
  ["Pre-commit", "pronto para PR"],
];

const fileGroups = [
  {
    title: "Sistema",
    files: ["apps/web/app/coevo-labs/page.tsx", "apps/web/public/brand/logo.png"],
  },
  {
    title: "Uploads",
    files: ["referencia-antigravity.png", "coevo-labs-logo.png"],
  },
  {
    title: "Midias geradas",
    files: ["dev-console-v3.png", "home-v2-preview.png"],
  },
  {
    title: "Alterados",
    files: ["page.tsx"],
  },
];

const chatMessages = [
  {
    author: "Voce",
    tone: "user",
    text: "Melhore a segunda dobra da Coevo Labs, mas crie um ponto antes.",
  },
  {
    author: "Coevo Dev",
    tone: "agent",
    text: "Ponto de restauracao criado: Estado inicial. Vou ajustar espacamentos, preservar a identidade visual e validar o build antes do PR.",
  },
  {
    author: "Coevo Dev",
    tone: "agent",
    text: "Clique em page.tsx ou no Preview Local para abrir em uma aba central. Se estiver bom, posso criar o commit e abrir o PR.",
  },
];

function tabClass(active: boolean) {
  return `h-11 rounded-t-lg border px-4 text-sm font-bold transition ${
    active
      ? "border-white/18 border-b-[#0A0D12] bg-[#0A0D12] text-white"
      : "border-white/10 bg-white/[0.035] text-white/48 hover:text-white"
  }`;
}

export default function DevConsolePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CenterTab>("conversation");
  const [selectedPreview, setSelectedPreview] = useState<FilePreview>("code");

  return (
    <main className="min-h-screen overflow-hidden bg-[#05070C] text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-50"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.026) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.026) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(255,255,255,0.09),transparent_30%),radial-gradient(circle_at_18%_28%,rgba(255,255,255,0.045),transparent_24%),linear-gradient(135deg,rgba(5,7,12,0.96),#05070C_58%,#03050A)]" />

      <section className="relative z-10 grid min-h-screen grid-cols-1 xl:grid-cols-[310px_minmax(0,1fr)_380px]">
        <aside className="hidden min-h-screen border-r border-white/10 bg-[#080B10]/84 p-5 backdrop-blur-xl xl:flex xl:flex-col">
          <button
            className="flex items-center gap-3 border-b border-white/10 pb-5 text-left"
            onClick={() => router.push("/home-v2")}
            type="button"
          >
            <span className="grid h-12 w-12 place-items-center rounded-lg bg-white font-display text-xl font-bold text-[#05070C]">
              C
            </span>
            <span>
              <span className="block font-display text-lg font-semibold">Coevo Labs</span>
              <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-white/44">
                Dev Console
              </span>
            </span>
          </button>

          <nav className="mt-5 space-y-2">
            {["Novo chat", "Pesquisar", "Projetos", "Automacoes"].map((item, index) => (
              <button
                className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-bold transition ${
                  index === 0
                    ? "border border-white/18 bg-white/10 text-white"
                    : "text-white/52 hover:bg-white/[0.06] hover:text-white"
                }`}
                key={item}
                type="button"
              >
                <span className="grid h-8 w-8 place-items-center rounded-md border border-white/12 font-mono text-xs">
                  {item[0]}
                </span>
                {item}
              </button>
            ))}
          </nav>

          <section className="mt-7">
            <p className="px-2 font-mono text-xs uppercase tracking-[0.18em] text-white/34">
              Chats
            </p>
            <div className="mt-3 space-y-2">
              {["LP Coevo Labs", "Agente LiveKit", "API Railway"].map((chat, index) => (
                <button
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    index === 0
                      ? "border-white/18 bg-white/10"
                      : "border-white/8 bg-white/[0.025] hover:border-white/16"
                  }`}
                  key={chat}
                  type="button"
                >
                  <span className="block text-sm font-bold">{chat}</span>
                  <span className="mt-1 block font-mono text-[11px] uppercase text-white/34">
                    {index === 0 ? "agora" : `${index + 1} d`}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-7">
            <p className="px-2 font-mono text-xs uppercase tracking-[0.18em] text-white/34">
              Pontos de restauracao
            </p>
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.035] p-2">
              {restorePoints.map(([title, detail], index) => (
                <button
                  className="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-white/[0.055]"
                  key={title}
                  type="button"
                >
                  <span
                    className={`mt-1 h-2.5 w-2.5 rounded-full ${
                      index === restorePoints.length - 1 ? "bg-white" : "bg-white/42"
                    }`}
                  />
                  <span>
                    <span className="block text-sm font-bold">{title}</span>
                    <span className="mt-1 block text-xs text-white/42">{detail}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-auto rounded-xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-white/34">
                  Preview local
                </p>
                <p className="mt-1 text-sm font-bold">/coevo-labs</p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/62">
                rodando
              </span>
            </div>
            <button
              className="mt-4 h-32 w-full overflow-hidden rounded-lg border border-white/10 bg-[#03050A] p-3 text-left"
              onClick={() => setActiveTab("preview")}
              type="button"
            >
              <span className="block h-2 w-24 rounded-full bg-white/76" />
              <span className="mt-5 block h-7 w-40 rounded-md bg-white/18" />
              <span className="mt-5 grid grid-cols-3 gap-2">
                <span className="h-8 rounded-md bg-white/10" />
                <span className="h-8 rounded-md bg-white/10" />
                <span className="h-8 rounded-md bg-white/10" />
              </span>
            </button>
          </section>
        </aside>

        <section className="flex min-h-screen min-w-0 flex-col border-r border-white/10">
          <header className="border-b border-white/10 bg-[#05070C]/72 px-5 pt-5 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/38">
                  um-meeting-ai / main / sandbox seguro
                </p>
                <h1 className="mt-2 font-display text-2xl font-semibold md:text-3xl">
                  LP Coevo Labs
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-lg border border-white/12 bg-white/[0.035] px-4 py-2 text-sm font-bold text-white/64 transition hover:text-white"
                  onClick={() => router.push("/home-v2")}
                  type="button"
                >
                  Home
                </button>
                <button className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-[#05070C]" type="button">
                  Nova tarefa
                </button>
              </div>
            </div>

            <div className="mt-5 flex gap-2 overflow-x-auto">
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

          <div className="flex-1 overflow-y-auto p-5 md:p-8">
            {activeTab === "conversation" ? (
              <div className="mx-auto max-w-5xl space-y-5">
                {chatMessages.map((message) => (
                  <article
                    className={`max-w-3xl ${message.tone === "user" ? "ml-auto" : ""}`}
                    key={`${message.author}-${message.text}`}
                  >
                    <p className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.14em] text-white/36">
                      {message.author}
                    </p>
                    <div
                      className={`rounded-xl border p-5 text-sm leading-7 shadow-[0_24px_80px_rgba(0,0,0,0.18)] ${
                        message.tone === "user"
                          ? "border-white/16 bg-white text-[#05070C]"
                          : "border-white/10 bg-white/[0.045] text-white/72"
                      }`}
                    >
                      {message.text}
                    </div>
                  </article>
                ))}

                <pre className="overflow-x-auto rounded-xl border border-white/10 bg-[#03050A] p-5 font-mono text-sm leading-7 text-white/72 shadow-[0_28px_90px_rgba(0,0,0,0.32)]">
{`coevo-dev ~/um-meeting-ai main > iniciar tarefa /coevo-labs
✓ contexto lido
✓ apps/web/app/coevo-labs/page.tsx alterado
✓ preview local atualizado
• aguardando revisao do diff`}
                </pre>
              </div>
            ) : null}

            {activeTab === "terminal" ? (
              <pre className="min-h-[62vh] overflow-x-auto rounded-xl border border-white/10 bg-[#03050A] p-6 font-mono text-sm leading-8 text-white/72">
{`coevo-dev ~/um-meeting-ai main > status
sandbox pronto
node 20.11.1
pnpm 9.1.2
branch main

coevo-dev ~/um-meeting-ai main > diff --resumo
M apps/web/app/coevo-labs/page.tsx
1 arquivo alterado
build aguardando confirmacao`}
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
                <div className="grid min-h-[62vh] place-items-center bg-[#05070C] p-8 text-white">
                  <div className="max-w-3xl text-center">
                    <p className="font-mono text-xs uppercase tracking-[0.24em] text-white/44">
                      Coevo Labs
                    </p>
                    <h2 className="mt-6 font-display text-5xl font-semibold leading-tight">
                      Ideias que transformam.
                    </h2>
                    <div className="mx-auto mt-10 grid max-w-2xl grid-cols-3 gap-3">
                      <span className="h-24 rounded-lg border border-white/10 bg-white/[0.06]" />
                      <span className="h-24 rounded-lg border border-white/10 bg-white/[0.06]" />
                      <span className="h-24 rounded-lg border border-white/10 bg-white/[0.06]" />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "diff" ? (
              <pre className="overflow-x-auto rounded-xl border border-white/10 bg-[#03050A] p-6 font-mono text-sm leading-7 text-white/72">
{`diff --git a/apps/web/app/coevo-labs/page.tsx b/apps/web/app/coevo-labs/page.tsx
@@ segunda dobra @@
- padding: 96px 48px 72px;
+ padding: clamp(72px, 8vw, 112px) clamp(20px, 4vw, 56px);
+ grid-template-columns responsivas para mobile;`}
              </pre>
            ) : null}

            {activeTab === "page" ? (
              <pre className="overflow-x-auto rounded-xl border border-white/10 bg-[#03050A] p-6 font-mono text-sm leading-7 text-white/72">
{`export default function CoevoLabsLandingPage() {
  return (
    <main className="coevo-labs-page">
      <section className="coevo-how-section">
        <h2>Da ideia à solução</h2>
      </section>
    </main>
  );
}`}
              </pre>
            ) : null}
          </div>

          <form className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] gap-3 border-t border-white/10 bg-[#05070C]/84 p-4 backdrop-blur-xl">
            <button className="h-12 w-12 rounded-lg border border-white/12 bg-white/[0.035] text-xl text-white/62" type="button">
              +
            </button>
            <input
              className="min-w-0 rounded-lg border border-white/12 bg-white/[0.045] px-4 text-sm text-white outline-none placeholder:text-white/34 focus:border-white/34"
              placeholder="Converse com o Coevo Dev ou peça uma alteracao..."
            />
            <button className="h-12 w-12 rounded-lg border border-white/12 bg-white/[0.035] text-xs text-white/62" type="button">
              mic
            </button>
            <button className="h-12 rounded-lg bg-white px-5 text-sm font-bold text-[#05070C]" type="button">
              Enviar
            </button>
          </form>
        </section>

        <aside className="hidden min-h-screen bg-[#080B10]/84 p-5 backdrop-blur-xl xl:grid xl:grid-rows-[minmax(0,1fr)_360px_auto] xl:gap-4">
          <section className="min-h-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.035]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <h2 className="font-display text-lg font-semibold">Arquivos usados</h2>
              <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-xs text-white/52">
                7
              </span>
            </div>
            <div className="max-h-full overflow-y-auto p-4">
              {fileGroups.map((group) => (
                <div className="mb-5" key={group.title}>
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-white/34">
                    {group.title}
                  </p>
                  <div className="mt-2 space-y-1">
                    {group.files.map((file) => (
                      <button
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/[0.055] ${
                          file === "page.tsx" ? "bg-white/10 text-white" : "text-white/58"
                        }`}
                        key={file}
                        onClick={() => setSelectedPreview(file.endsWith(".png") ? "image" : "code")}
                        type="button"
                      >
                        <span className="text-white/34">▧</span>
                        <span className="min-w-0 flex-1 truncate">{file}</span>
                        {file === "page.tsx" ? (
                          <span className="rounded-full bg-white/12 px-2 py-0.5 font-mono text-[10px] text-white/64">
                            M
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
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <h2 className="font-display text-lg font-semibold">Preview do arquivo</h2>
              <button
                className="rounded-lg border border-white/12 bg-white/[0.035] px-3 py-1.5 text-xs font-bold text-white/62 transition hover:text-white"
                onClick={() => setActiveTab(selectedPreview === "code" ? "page" : "preview")}
                type="button"
              >
                Expandir
              </button>
            </div>
            {selectedPreview === "code" ? (
              <pre className="h-full overflow-hidden bg-[#03050A] p-4 font-mono text-xs leading-6 text-white/70">
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
                <div className="aspect-video w-full rounded-lg border border-white/10 bg-white/[0.08]" />
              </div>
            )}
          </section>

          <section className="grid grid-cols-2 gap-3">
            <button className="rounded-lg border border-white/12 bg-white/[0.035] px-4 py-3 text-sm font-bold text-white/70" type="button">
              Ver diff
            </button>
            <button className="rounded-lg border border-white/12 bg-white/[0.035] px-4 py-3 text-sm font-bold text-white/70" type="button">
              Rodar build
            </button>
            <button className="rounded-lg border border-white/36 bg-white/[0.035] px-4 py-3 text-sm font-bold text-white" type="button">
              Criar commit
            </button>
            <button className="rounded-lg bg-white px-4 py-3 text-sm font-bold text-[#05070C]" type="button">
              Abrir PR
            </button>
          </section>
        </aside>
      </section>
    </main>
  );
}
