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
    invitedAs: "Participante",
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
      window.sessionStorage.setItem(`um-meeting-host:${meeting.id}`, "1");
      router.push(`/meeting/${meeting.id}?host=1`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Erro inesperado.");
      setIsCreating(false);
    }
  }

  function scheduleMeeting() {
    setFeedback("Agendamento entra na proxima etapa. Por enquanto, use reuniao instantanea.");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-white text-[#11110F]">
      <div
        className="pointer-events-none fixed inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(rgba(17,17,15,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(17,17,15,.055) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
      />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_70%_0%,rgba(249,115,22,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.86),#FFFFFF_72%)]" />

      <header className="fixed left-0 right-0 top-0 z-20 flex min-h-20 items-center justify-between border-b border-[#E7E7E2] bg-white/85 px-4 py-4 backdrop-blur-xl lg:left-72 lg:px-8">
        <div className="flex items-center gap-4 lg:hidden">
          <button
            aria-label="Abrir menu"
            className="flex h-10 w-10 flex-col items-center justify-center gap-1 rounded-full border border-[#E7E7E2] bg-white transition hover:border-[#F97316]"
            type="button"
          >
            <span className="h-0.5 w-5 rounded-full bg-[#11110F]" />
            <span className="h-0.5 w-5 rounded-full bg-[#11110F]" />
            <span className="h-0.5 w-5 rounded-full bg-[#11110F]" />
          </button>
          <p className="font-display text-lg font-semibold">Coevo</p>
        </div>

        <div className="hidden lg:block">
          <p className="font-mono text-xs uppercase text-[#F97316]">Dashboard</p>
          <p className="mt-1 text-sm text-[#73736B]">Videochamadas com Jarvis</p>
        </div>

        <div className="ml-auto flex items-center gap-3 sm:gap-5">
          <p className="hidden font-mono text-xs text-[#73736B] sm:block">{currentDate}</p>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-[#11110F]">{currentUser.name}</p>
            <p className="text-xs text-[#73736B]">{currentUser.email}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#FDBA74] bg-[#FFF3EA] text-sm font-bold text-[#F97316] shadow-[0_18px_70px_rgba(17,17,15,0.07)]">
            RG
          </div>
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-0 z-30 hidden w-72 border-r border-[#E7E7E2] bg-white/90 p-5 backdrop-blur-xl lg:block">
        <div className="flex items-center gap-3 border-b border-[#E7E7E2] pb-7">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#11110F] font-display text-xl font-bold text-white shadow-[0_20px_80px_rgba(249,115,22,0.22)]">
            C
          </div>
          <div>
            <p className="font-display text-xl font-semibold leading-tight text-[#11110F]">
              Coevo
            </p>
            <p className="font-mono text-xs uppercase text-[#F97316]">Grupo Coevo</p>
          </div>
        </div>

        <nav className="mt-7 space-y-2">
          <a
            className="flex items-center gap-4 rounded-lg border border-[#FDBA74] bg-[#FFF3EA] px-4 py-3 text-sm font-semibold text-[#11110F] shadow-[0_18px_70px_rgba(17,17,15,0.07)]"
            href="#meetings"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#F97316] font-mono text-xs font-bold text-white">
              M
            </span>
            Reunioes
          </a>
          <a
            className="flex items-center gap-4 rounded-lg px-4 py-3 text-sm font-medium text-[#73736B] transition hover:bg-[#F8F8F6] hover:text-[#11110F]"
            href="#calls"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E7E7E2] font-mono text-xs">
              L
            </span>
            Ligacoes
          </a>
          <a
            className="flex items-center gap-4 rounded-lg px-4 py-3 text-sm font-medium text-[#73736B] transition hover:bg-[#F8F8F6] hover:text-[#11110F]"
            href="#knowledge"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E7E7E2] font-mono text-xs">
              B
            </span>
            Base de conhecimento
          </a>
        </nav>

        <div className="absolute bottom-5 left-5 right-5 rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] p-4">
          <p className="font-mono text-xs uppercase text-[#F97316]">Status</p>
          <p className="mt-2 text-sm font-medium text-[#11110F]">Jarvis pronto</p>
          <p className="mt-1 text-xs leading-5 text-[#73736B]">
            LiveKit, API e agente conectados para testes.
          </p>
        </div>
      </aside>

      <section
        className="relative z-10 flex min-h-screen items-start justify-center px-5 pb-16 pt-32 sm:px-8 lg:ml-72 lg:pt-36"
        id="meetings"
      >
        <div className="w-full max-w-5xl text-center">
          <p className="mx-auto mb-5 inline-flex rounded-full border border-[#FDBA74] bg-[#FFF3EA] px-4 py-2 font-mono text-xs uppercase text-[#F97316]">
            Reunioes Coevo
          </p>
          <h1 className="mx-auto max-w-4xl font-display text-5xl font-semibold leading-tight text-[#11110F] md:text-6xl">
            Videochamadas Assistidas
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[#73736B]">
            Grupo Coevo
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              className="relative overflow-hidden rounded-lg bg-[#11110F] px-7 py-4 text-base font-bold text-white shadow-[0_20px_80px_rgba(249,115,22,0.22)] transition hover:translate-y-[-1px] hover:bg-[#F97316] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isCreating}
              onClick={createInstantMeeting}
              type="button"
            >
              <span className="absolute inset-y-0 left-[-40%] w-1/3 skew-x-[-18deg] bg-white/30" />
              <span className="relative">
                {isCreating ? "Criando..." : "Criar Reuniao Instantanea"}
              </span>
            </button>
            <button
              className="rounded-lg border border-[#E7E7E2] bg-white px-7 py-4 text-base font-semibold text-[#11110F] shadow-[0_18px_70px_rgba(17,17,15,0.07)] transition hover:border-[#F97316] hover:bg-[#FFF3EA]"
              onClick={scheduleMeeting}
              type="button"
            >
              Agendar Reuniao
            </button>
          </div>

          {feedback ? (
            <p className="mx-auto mt-5 max-w-xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {feedback}
            </p>
          ) : null}

          <div className="mx-auto mt-12 h-px max-w-3xl bg-gradient-to-r from-transparent via-[#E7E7E2] to-transparent" />

          <section className="mx-auto mt-10 max-w-3xl text-left">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="font-display text-xl font-semibold text-[#11110F]">
                Reunioes para as quais voce foi convidado
              </h2>
              <p className="font-mono text-xs uppercase text-[#73736B]">
                {scheduledMeetings.length} convites
              </p>
            </div>

            <div className="overflow-hidden rounded-lg border border-[#E7E7E2] bg-white shadow-[0_18px_70px_rgba(17,17,15,0.07)]">
              {scheduledMeetings.map((meeting, index) => (
                <button
                  className={`flex w-full items-center justify-between gap-5 px-5 py-4 text-left transition hover:bg-[#F8F8F6] ${
                    index > 0 ? "border-t border-[#E7E7E2]" : ""
                  }`}
                  key={meeting.id}
                  onClick={() => router.push(`/meeting/${meeting.id}`)}
                  type="button"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-[#11110F]">
                      {meeting.title}
                    </p>
                    <p className="mt-1 text-sm text-[#73736B]">
                      Organizador: {meeting.host}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-[#11110F]">
                      {meeting.startsAt}
                    </p>
                    <p className="mt-2 inline-flex rounded-full border border-[#FDBA74] bg-[#FFF3EA] px-3 py-1 font-mono text-[11px] uppercase text-[#F97316]">
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
