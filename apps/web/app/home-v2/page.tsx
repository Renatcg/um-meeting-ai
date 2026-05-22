"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type MeetingHistoryItem = {
  id: string;
  title: string;
  created_at: string;
  started_at?: string | null;
  ended_at?: string | null;
  recording_url?: string | null;
  participant_count: number;
  transcript_count: number;
  memory_count: number;
};

type TrialRequest = {
  id: number;
  full_name: string;
  company_name: string;
  selected_plan?: string | null;
  created_at: string;
};

type ConversationSession = {
  id: string;
  title: string;
  channel: string;
  user_name: string;
  updated_at: string;
};

type Section = "home" | "meetings" | "memory" | "leads" | "knowledge" | "dev";

function formatDate(value?: string | null) {
  if (!value) {
    return "Sem data";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(meeting: MeetingHistoryItem) {
  if (meeting.ended_at) {
    return "Encerrada";
  }
  if (meeting.started_at) {
    return "Em andamento";
  }
  return "Criada";
}

export default function HomeV2Page() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<Section>("home");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [meetingHistory, setMeetingHistory] = useState<MeetingHistoryItem[]>([]);
  const [trialRequests, setTrialRequests] = useState<TrialRequest[]>([]);
  const [conversationSessions, setConversationSessions] = useState<ConversationSession[]>([]);
  const [meetingStatus, setMeetingStatus] = useState<string | null>(null);

  useEffect(() => {
    async function loadHomeData() {
      try {
        const [meetingsResponse, leadsResponse, conversationsResponse] = await Promise.all([
          fetch(`${apiUrl}/meetings/history?limit=8`),
          fetch(`${apiUrl}/trial-requests`),
          fetch(`${apiUrl}/agent/conversations?limit=8`),
        ]);

        if (meetingsResponse.ok) {
          setMeetingHistory((await meetingsResponse.json()) as MeetingHistoryItem[]);
        }
        if (leadsResponse.ok) {
          setTrialRequests((await leadsResponse.json()) as TrialRequest[]);
        }
        if (conversationsResponse.ok) {
          setConversationSessions(
            (await conversationsResponse.json()) as ConversationSession[],
          );
        }
      } catch {
        setMeetingStatus("Alguns dados reais nao puderam ser carregados agora.");
      }
    }

    void loadHomeData();
  }, []);

  const totals = useMemo(() => {
    return {
      meetings: meetingHistory.length,
      memories: meetingHistory.reduce((sum, meeting) => sum + meeting.memory_count, 0),
      transcripts: meetingHistory.reduce(
        (sum, meeting) => sum + meeting.transcript_count,
        0,
      ),
      recordings: meetingHistory.filter((meeting) => meeting.recording_url).length,
      leads: trialRequests.length,
      conversations: conversationSessions.length,
    };
  }, [conversationSessions.length, meetingHistory, trialRequests.length]);

  async function createInstantMeeting() {
    setFeedback(null);
    setIsCreating(true);

    try {
      const response = await fetch(`${apiUrl}/meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Reuniao instantanea Coevo" }),
      });

      if (!response.ok) {
        throw new Error("Nao foi possivel criar a reuniao.");
      }

      const meeting = (await response.json()) as { id: string };
      window.sessionStorage.setItem(`um-meeting-host:${meeting.id}`, "1");
      router.push(`/meeting/${meeting.id}?host=1`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Erro inesperado.");
      setIsCreating(false);
    }
  }

  function navClass(section: Section) {
    return `rounded-full border px-4 py-2 text-sm font-bold transition ${
      activeSection === section
        ? "border-white/80 bg-white text-[#05070C]"
        : "border-white/14 bg-white/[0.035] text-white/68 hover:border-white/34 hover:text-white"
    }`;
  }

  function selectSection(section: Section) {
    setActiveSection(section);
    setIsMenuOpen(false);
  }

  const latestMeeting = meetingHistory[0];
  const latestLead = trialRequests[0];

  return (
    <main className="min-h-screen overflow-hidden bg-[#05070C] text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.028) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_78%_15%,rgba(255,255,255,0.09),transparent_28%),radial-gradient(circle_at_18%_30%,rgba(255,255,255,0.045),transparent_25%),linear-gradient(135deg,rgba(5,7,12,0.94),#05070C_58%,#03050A)]" />

      <header className="fixed left-0 right-0 top-0 z-30 flex min-h-20 items-center gap-4 border-b border-white/10 bg-[#05070C]/84 px-4 py-4 backdrop-blur-xl lg:px-8">
        <button
          aria-label="Abrir menu"
          className="grid h-11 w-11 place-items-center rounded-lg border border-white/14 bg-white/[0.035] text-xl text-white transition hover:border-white/32 hover:bg-white/10"
          onClick={() => setIsMenuOpen(true)}
          type="button"
        >
          =
        </button>

        <button
          className="flex items-center gap-3 text-left"
          onClick={() => selectSection("home")}
          type="button"
        >
          <span className="grid h-11 w-11 place-items-center rounded-lg border border-white/16 bg-white text-lg font-bold text-[#05070C] shadow-[0_20px_80px_rgba(255,255,255,0.08)]">
            C
          </span>
          <span>
            <span className="block font-display text-lg font-semibold leading-tight">
              Coevo
            </span>
            <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-white/48">
              Meet
            </span>
          </span>
        </button>

        <nav className="mx-auto hidden items-center gap-2 xl:flex">
          <button className={navClass("meetings")} onClick={() => selectSection("meetings")} type="button">
            Reunioes
          </button>
          <button className={navClass("memory")} onClick={() => selectSection("memory")} type="button">
            Memorias
          </button>
          <button className={navClass("leads")} onClick={() => selectSection("leads")} type="button">
            Leads
          </button>
          <button className={navClass("knowledge")} onClick={() => selectSection("knowledge")} type="button">
            Conhecimento
          </button>
          <button className={navClass("dev")} onClick={() => router.push("/dev-console")} type="button">
            Dev Console
          </button>
        </nav>

        <button
          className="hidden rounded-full border border-white/14 bg-white/[0.035] px-4 py-2 text-sm font-bold text-white/72 transition hover:border-white/34 hover:text-white md:block"
          type="button"
        >
          Buscar
        </button>
        <div className="grid h-11 w-11 place-items-center rounded-full border border-white/16 bg-white/10 text-sm font-bold">
          RG
        </div>
      </header>

      {isMenuOpen ? (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-black/48 backdrop-blur-sm"
          onClick={() => setIsMenuOpen(false)}
          type="button"
        />
      ) : null}

      <aside
        className={`fixed bottom-0 left-0 top-0 z-50 w-[min(22rem,calc(100vw-2rem))] border-r border-white/12 bg-[#080B10]/96 p-5 shadow-[28px_0_90px_rgba(0,0,0,0.42)] backdrop-blur-xl transition-transform duration-300 ${
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-white/10 pb-7">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-white font-display text-xl font-bold text-[#05070C]">
            C
          </div>
          <div>
            <p className="font-display text-xl font-semibold">Coevo Meet</p>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/44">
              Menu recolhivel
            </p>
          </div>
          <button
            aria-label="Fechar menu"
            className="ml-auto rounded-lg border border-white/12 px-3 py-2 text-white/64 transition hover:bg-white/10 hover:text-white"
            onClick={() => setIsMenuOpen(false)}
            type="button"
          >
            x
          </button>
        </div>

        <nav className="mt-7 space-y-2">
          {[
            ["home", "H", "Home"],
            ["meetings", "M", "Reunioes"],
            ["memory", "C", "Conversar com Coevo"],
            ["leads", "L", "Leads"],
            ["knowledge", "B", "Base de conhecimento"],
            ["dev", "D", "Dev Console"],
          ].map(([section, icon, label]) => (
            <button
              className={`flex w-full items-center gap-4 rounded-lg px-4 py-3 text-left text-sm transition ${
                activeSection === section
                  ? "border border-white/28 bg-white/10 font-semibold text-white"
                  : "font-medium text-white/58 hover:bg-white/7 hover:text-white"
              }`}
              key={section}
              onClick={() =>
                section === "dev"
                  ? router.push("/dev-console")
                  : selectSection(section as Section)
              }
              type="button"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-md border border-white/14 font-mono text-xs">
                {icon}
              </span>
              {label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-5 left-5 right-5 rounded-lg border border-white/12 bg-white/[0.035] p-4">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/44">
            Home sem menu fixo
          </p>
          <p className="mt-2 text-sm font-medium">A pagina usa 100% da largura.</p>
          <p className="mt-1 text-xs leading-5 text-white/48">
            O menu aparece apenas quando voce precisa navegar por areas.
          </p>
        </div>
      </aside>

      <section className="relative z-10 px-5 pb-16 pt-32 sm:px-8">
        <div className="mx-auto max-w-[1540px]">
          <section className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_420px] lg:items-end">
            <div>
              <p className="inline-flex rounded-full border border-white/14 bg-white/[0.035] px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-white/52">
                Central Coevo
              </p>
              <h1 className="mt-6 max-w-5xl font-display text-5xl font-semibold leading-[1.05] tracking-[-0.03em] md:text-7xl">
                Sua central de reunioes, memorias e agentes.
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-white/62">
                A Home nova ocupa toda a tela, preserva os fluxos reais do sistema
                e deixa o menu como uma camada contextual.
              </p>
            </div>

            <div className="rounded-xl border border-white/12 bg-white/[0.045] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/42">
                Acao rapida
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <button
                  className="rounded-lg bg-white px-5 py-4 text-sm font-bold text-[#05070C] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isCreating}
                  onClick={createInstantMeeting}
                  type="button"
                >
                  {isCreating ? "Criando..." : "Nova reuniao"}
                </button>
                <button
                  className="rounded-lg border border-white/14 bg-white/[0.035] px-5 py-4 text-sm font-bold text-white transition hover:border-white/34 hover:bg-white/10"
                  onClick={() => selectSection("memory")}
                  type="button"
                >
                  Conversar com Coevo
                </button>
              </div>
              {feedback ? (
                <p className="mt-4 rounded-lg border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {feedback}
                </p>
              ) : null}
            </div>
          </section>

          <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            {[
              ["Reunioes", totals.meetings],
              ["Memorias", totals.memories],
              ["Transcricoes", totals.transcripts],
              ["Gravacoes", totals.recordings],
              ["Leads", totals.leads],
              ["Conversas", totals.conversations],
            ].map(([label, value]) => (
              <div
                className="rounded-xl border border-white/10 bg-white/[0.045] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.18)]"
                key={label}
              >
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-white/40">
                  {label}
                </p>
                <p className="mt-3 font-display text-4xl font-semibold">{value}</p>
              </div>
            ))}
          </section>

          {meetingStatus ? (
            <p className="mt-6 rounded-lg border border-white/12 bg-white/[0.045] px-4 py-3 text-sm text-white/62">
              {meetingStatus}
            </p>
          ) : null}

          <section className="mt-8 grid gap-5 xl:grid-cols-[1.2fr_0.95fr_0.85fr]">
            <article className="rounded-xl border border-white/10 bg-white/[0.045] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.24)]">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/40">
                    Proxima acao
                  </p>
                  <h2 className="mt-3 font-display text-3xl font-semibold">
                    {latestMeeting?.title ?? "Crie uma reuniao assistida por IA"}
                  </h2>
                </div>
                <span className="rounded-full border border-white/14 bg-white/[0.035] px-3 py-1 text-xs font-bold text-white/58">
                  {latestMeeting ? statusLabel(latestMeeting) : "Pronto"}
                </span>
              </div>
              <p className="mt-5 max-w-2xl text-sm leading-6 text-white/58">
                {latestMeeting
                  ? `Ultima reuniao criada em ${formatDate(latestMeeting.created_at)}.`
                  : "Inicie uma sala, convide participantes e deixe o Coevo acompanhar a conversa."}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-[#05070C]/50 p-4">
                  <p className="font-mono text-xs text-white/38">Participantes</p>
                  <p className="mt-2 text-2xl font-semibold">
                    {latestMeeting?.participant_count ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#05070C]/50 p-4">
                  <p className="font-mono text-xs text-white/38">Transcricoes</p>
                  <p className="mt-2 text-2xl font-semibold">
                    {latestMeeting?.transcript_count ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#05070C]/50 p-4">
                  <p className="font-mono text-xs text-white/38">Memorias</p>
                  <p className="mt-2 text-2xl font-semibold">
                    {latestMeeting?.memory_count ?? 0}
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-xl border border-white/10 bg-white/[0.045] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.24)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/40">
                    Memorias recentes
                  </p>
                  <h2 className="mt-3 font-display text-2xl font-semibold">
                    Pergunte ao Coevo
                  </h2>
                </div>
                <button
                  className="rounded-lg border border-white/14 bg-white/[0.035] px-3 py-2 text-xs font-bold text-white/68 transition hover:border-white/34 hover:text-white"
                  onClick={() => selectSection("memory")}
                  type="button"
                >
                  Abrir
                </button>
              </div>
              <div className="mt-5 rounded-lg border border-white/10 bg-[#05070C]/55 px-4 py-3 text-sm text-white/46">
                Pergunte sobre reunioes passadas, prazos, riscos ou promessas.
              </div>
              <div className="mt-5 space-y-3">
                {conversationSessions.slice(0, 3).map((session) => (
                  <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3" key={session.id}>
                    <p className="line-clamp-1 text-sm font-bold">{session.title}</p>
                    <p className="mt-1 font-mono text-[11px] uppercase text-white/36">
                      {formatDate(session.updated_at)}
                    </p>
                  </div>
                ))}
                {conversationSessions.length === 0 ? (
                  <p className="rounded-lg border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-white/52">
                    As conversas reais com o Coevo aparecem aqui quando existirem.
                  </p>
                ) : null}
              </div>
            </article>

            <article className="rounded-xl border border-white/10 bg-white/[0.045] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.24)]">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/40">
                Dev Console
              </p>
              <h2 className="mt-3 font-display text-2xl font-semibold">
                Console de desenvolvimento
              </h2>
              <div className="mt-5 rounded-lg border border-white/10 bg-[#03050A] p-4 font-mono text-xs leading-6 text-white/70">
                <p>
                  <span className="text-white">coevo-dev</span>{" "}
                  <span className="text-[#8CB8FF]">~/um-meeting-ai</span> main &gt;
                </p>
                <p className="mt-3 text-white/42">pontos de restauracao</p>
                <p className="text-white/42">preview local</p>
                <p className="text-white/42">diff antes do commit</p>
              </div>
              <button
                className="mt-5 w-full rounded-lg border border-white/14 bg-white/[0.035] px-5 py-3 text-sm font-bold text-white transition hover:border-white/34 hover:bg-white/10"
                onClick={() => router.push("/dev-console")}
                type="button"
              >
                Ver conceito
              </button>
            </article>
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <article className="rounded-xl border border-white/10 bg-white/[0.045] p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/40">
                    Leads
                  </p>
                  <h2 className="mt-3 font-display text-2xl font-semibold">
                    Pipeline comercial
                  </h2>
                </div>
                <button
                  className="rounded-lg border border-white/14 bg-white/[0.035] px-3 py-2 text-xs font-bold text-white/68 transition hover:border-white/34 hover:text-white"
                  onClick={() => selectSection("leads")}
                  type="button"
                >
                  Abrir
                </button>
              </div>
              <p className="mt-4 text-sm leading-6 text-white/56">
                {latestLead
                  ? `${latestLead.full_name} de ${latestLead.company_name} e o lead mais recente.`
                  : "Os leads reais cadastrados aparecem aqui quando existirem."}
              </p>
            </article>

            <article className="rounded-xl border border-white/10 bg-white/[0.045] p-6">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/40">
                Historico real
              </p>
              <div className="mt-5 divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">
                {meetingHistory.slice(0, 4).map((meeting) => (
                  <div className="grid gap-3 bg-[#05070C]/42 p-4 md:grid-cols-[minmax(0,1fr)_auto]" key={meeting.id}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{meeting.title}</p>
                      <p className="mt-1 font-mono text-xs text-white/36">
                        {formatDate(meeting.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/52">
                        {meeting.memory_count} memorias
                      </span>
                      <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/52">
                        {meeting.transcript_count} transcricoes
                      </span>
                    </div>
                  </div>
                ))}
                {meetingHistory.length === 0 ? (
                  <p className="bg-[#05070C]/42 p-5 text-sm leading-6 text-white/52">
                    Nenhuma reuniao real carregada ainda.
                  </p>
                ) : null}
              </div>
            </article>
          </section>

          {activeSection !== "home" ? (
            <section className="mt-8 rounded-xl border border-white/10 bg-white/[0.045] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.22)]">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/40">
                Area selecionada
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold">
                {activeSection === "dev"
                  ? "Dev Console"
                  : activeSection === "memory"
                    ? "Memorias"
                    : activeSection === "meetings"
                      ? "Reunioes"
                      : activeSection === "leads"
                        ? "Leads"
                        : "Base de conhecimento"}
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-white/56">
                Esta nova Home ainda e uma camada paralela. Os fluxos completos
                continuam funcionando na Home atual enquanto validamos o novo formato.
              </p>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
