"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ScheduledMeeting = {
  id: string;
  title: string;
  host: string;
  startsAt: string;
  invitedAs: string;
};

const currentUser = {
  name: "Renato Guimaraes",
  email: "renato@coevo.ai",
  role: "Host",
};

const scheduledMeetings: ScheduledMeeting[] = [
  {
    id: "meeting-demo-discovery",
    title: "Discovery com cliente piloto",
    host: "Marina Costa",
    startsAt: "Hoje, 14:30",
    invitedAs: "Comercial",
  },
  {
    id: "meeting-demo-follow-up",
    title: "Follow-up proposta Coevo",
    host: "Renato Guimaraes",
    startsAt: "Amanha, 09:00",
    invitedAs: "Host",
  },
  {
    id: "meeting-demo-implementation",
    title: "Alinhamento de implantacao",
    host: "Time Coevo",
    startsAt: "Segunda, 11:00",
    invitedAs: "Observador",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    const formattedDate = new Intl.DateTimeFormat("pt-BR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());
    setCurrentDate(formattedDate);
  }, []);

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
      router.push(`/meeting/${meeting.id}`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Erro inesperado.");
      setIsCreating(false);
    }
  }

  function scheduleMeeting() {
    setFeedback("Agendamento entra na proxima etapa. Por enquanto, use reuniao instantanea.");
  }

  return (
    <main className="min-h-screen bg-white text-ink">
      <header className="fixed left-0 right-0 top-0 z-20 flex h-20 items-center justify-between border-b border-neutral-200 bg-white px-6">
        <div className="flex items-center gap-5">
          <button
            aria-label="Abrir menu"
            className="flex h-10 w-10 flex-col items-center justify-center gap-1 rounded-full transition hover:bg-neutral-100"
            type="button"
          >
            <span className="h-0.5 w-5 rounded-full bg-neutral-700" />
            <span className="h-0.5 w-5 rounded-full bg-neutral-700" />
            <span className="h-0.5 w-5 rounded-full bg-neutral-700" />
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-brand text-lg font-semibold text-white">
              C
            </div>
            <div>
              <p className="text-xl font-semibold leading-tight text-ink">Coevo</p>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                UM Copilot
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <p className="hidden text-sm text-neutral-600 sm:block">{currentDate}</p>
          <div className="text-right">
            <p className="text-sm font-medium text-ink">{currentUser.name}</p>
            <p className="text-xs text-neutral-500">{currentUser.email}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-brand bg-neutral-100 text-sm font-semibold text-brand">
            RG
          </div>
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-20 hidden w-72 border-r border-neutral-200 bg-white pt-6 lg:block">
        <nav className="space-y-2 pr-4">
          <a
            className="flex items-center gap-4 rounded-r-full bg-teal-50 px-6 py-4 text-sm font-semibold text-brand"
            href="#meetings"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-white">
              M
            </span>
            Reunioes
          </a>
          <a
            className="flex items-center gap-4 rounded-r-full px-6 py-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
            href="#calls"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300">
              L
            </span>
            Ligacoes
          </a>
          <a
            className="flex items-center gap-4 rounded-r-full px-6 py-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
            href="#knowledge"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300">
              B
            </span>
            Base de conhecimento
          </a>
        </nav>
      </aside>

      <section
        className="flex min-h-screen items-start justify-center px-6 pb-16 pt-32 lg:ml-72"
        id="meetings"
      >
        <div className="w-full max-w-4xl text-center">
          <p className="mb-4 text-sm font-medium uppercase tracking-wide text-brand">
            Reunioes Coevo
          </p>
          <h1 className="mx-auto max-w-3xl text-5xl font-medium leading-tight text-ink">
            Videochamadas Assistidas
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-neutral-600">
            Grupo Coevo
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              className="rounded-full bg-brand px-7 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isCreating}
              onClick={createInstantMeeting}
              type="button"
            >
              {isCreating ? "Criando..." : "Criar Reuniao Instantanea"}
            </button>
            <button
              className="rounded-full border border-neutral-300 bg-white px-7 py-4 text-base font-semibold text-neutral-800 transition hover:bg-neutral-50"
              onClick={scheduleMeeting}
              type="button"
            >
              Agendar Reuniao
            </button>
          </div>

          {feedback ? (
            <p className="mx-auto mt-5 max-w-xl text-sm text-red-700">{feedback}</p>
          ) : null}

          <div className="mx-auto mt-12 h-px max-w-3xl bg-neutral-200" />

          <section className="mx-auto mt-10 max-w-3xl text-left">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-ink">
                Reunioes para as quais voce foi convidado
              </h2>
              <p className="text-sm text-neutral-500">{scheduledMeetings.length} convites</p>
            </div>

            <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
              {scheduledMeetings.map((meeting, index) => (
                <button
                  className={`flex w-full items-center justify-between gap-5 px-5 py-4 text-left transition hover:bg-neutral-50 ${
                    index > 0 ? "border-t border-neutral-200" : ""
                  }`}
                  key={meeting.id}
                  onClick={() => router.push(`/meeting/${meeting.id}`)}
                  type="button"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium text-ink">
                      {meeting.title}
                    </p>
                    <p className="mt-1 text-sm text-neutral-500">
                      Organizador: {meeting.host}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium text-neutral-800">
                      {meeting.startsAt}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {meeting.invitedAs}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
