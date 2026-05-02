"use client";

import { FormEvent, useEffect, useState } from "react";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";

type Step = "profile" | "consent" | "room";
type ParticipantRole = "host" | "commercial" | "client" | "observer";
type SidePanelTab = "transcript" | "sales";

type Participant = {
  name: string;
  email: string;
  role: ParticipantRole;
};

type TokenResponse = {
  token: string;
  url: string;
  room: string;
  role: ParticipantRole;
  participant_access_token: string;
};

type TranscriptSegment = {
  id: number;
  meeting_id: string;
  speaker_name: string;
  timestamp_seconds: number;
  content: string;
  created_at: string;
};

type SalesRecommendation = {
  id: number;
  meeting_id: string;
  transcript_segment_id: number;
  kind: "objection" | "risk" | "opportunity";
  severity: "low" | "medium" | "high";
  title: string;
  recommendation: string;
  evidence: string;
  created_at: string;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function formatTimestamp(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export default function MeetingClient({ meetingId }: { meetingId: string }) {
  const [step, setStep] = useState<Step>("profile");
  const [participant, setParticipant] = useState<Participant>({
    name: "",
    email: "",
    role: "client",
  });
  const [acceptedLgpd, setAcceptedLgpd] = useState(false);
  const [connection, setConnection] = useState<TokenResponse | null>(null);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [recommendations, setRecommendations] = useState<SalesRecommendation[]>(
    [],
  );
  const [sidePanelTab, setSidePanelTab] = useState<SidePanelTab>("transcript");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canViewSalesPanel =
    connection?.role === "host" || connection?.role === "commercial";

  useEffect(() => {
    if (step !== "room") {
      return;
    }

    let cancelled = false;

    async function loadTranscript() {
      try {
        const response = await fetch(`${apiUrl}/meetings/${meetingId}/transcript`);
        if (!response.ok) {
          return;
        }

        const segments = (await response.json()) as TranscriptSegment[];
        if (!cancelled) {
          setTranscript(segments);
        }
      } catch {
        // Keep the meeting experience running even if transcript polling fails.
      }
    }

    loadTranscript();
    const interval = window.setInterval(loadTranscript, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [meetingId, step]);

  useEffect(() => {
    if (step !== "room" || !connection || !canViewSalesPanel) {
      return;
    }

    let cancelled = false;

    async function loadRecommendations() {
      try {
        const response = await fetch(
          `${apiUrl}/meetings/${meetingId}/sales-recommendations`,
          {
            headers: {
              Authorization: `Bearer ${connection.participant_access_token}`,
            },
          },
        );

        if (!response.ok) {
          return;
        }

        const cards = (await response.json()) as SalesRecommendation[];
        if (!cancelled) {
          setRecommendations(cards);
        }
      } catch {
        // Sales cards are private support; keep the meeting running if polling fails.
      }
    }

    loadRecommendations();
    const interval = window.setInterval(loadRecommendations, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [canViewSalesPanel, connection, meetingId, step]);

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStep("consent");
  }

  async function joinMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!acceptedLgpd) {
      setError("Voce precisa aceitar os termos de privacidade para entrar.");
      return;
    }

    setIsJoining(true);

    try {
      const response = await fetch(`${apiUrl}/meetings/${meetingId}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: participant.name,
          email: participant.email,
          role: participant.role,
          lgpd_accepted: acceptedLgpd,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          detail?: string;
        } | null;
        throw new Error(body?.detail ?? "Nao foi possivel entrar na reuniao.");
      }

      const tokenResponse = (await response.json()) as TokenResponse;
      setConnection(tokenResponse);
      setStep("room");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setIsJoining(false);
    }
  }

  if (step === "room" && connection) {
    return (
      <main className="grid h-screen bg-neutral-950 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-h-0">
          <LiveKitRoom
            audio
            video
            token={connection.token}
            serverUrl={connection.url}
            data-lk-theme="default"
            className="h-full"
            onDisconnected={() => setStep("profile")}
          >
            <VideoConference />
          </LiveKitRoom>
        </section>

        <aside className="flex min-h-0 flex-col border-l border-neutral-800 bg-neutral-950 text-white">
          <div className="border-b border-neutral-800 px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-teal-300">
              Conversa
            </p>
          <h2 className="mt-1 text-lg font-semibold">Transcricao ao vivo</h2>
          </div>

          <div className="flex border-b border-neutral-800">
            <button
              className={`border-b-2 px-5 py-3 text-sm font-medium ${
                sidePanelTab === "transcript"
                  ? "border-teal-300 text-teal-100"
                  : "border-transparent text-neutral-400 hover:text-white"
              }`}
              type="button"
              onClick={() => setSidePanelTab("transcript")}
            >
              Transcricao
            </button>
            {canViewSalesPanel ? (
              <button
                className={`border-b-2 px-5 py-3 text-sm font-medium ${
                  sidePanelTab === "sales"
                    ? "border-amber-300 text-amber-100"
                    : "border-transparent text-neutral-400 hover:text-white"
                }`}
                type="button"
                onClick={() => setSidePanelTab("sales")}
              >
                Comercial
              </button>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {sidePanelTab === "transcript" && transcript.length === 0 ? (
              <p className="text-sm leading-6 text-neutral-400">
                A transcricao aparecera aqui quando os participantes comecarem a
                falar.
              </p>
            ) : null}

            {sidePanelTab === "transcript" ? (
              transcript.map((segment) => (
                <article
                  className="rounded-md border border-neutral-800 bg-neutral-900 px-4 py-3"
                  key={segment.id}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-white">
                      {segment.speaker_name}
                    </p>
                    <time className="shrink-0 text-xs text-neutral-400">
                      {formatTimestamp(segment.timestamp_seconds)}
                    </time>
                  </div>
                  <p className="text-sm leading-6 text-neutral-200">
                    {segment.content}
                  </p>
                </article>
              ))
            ) : null}

            {sidePanelTab === "sales" && canViewSalesPanel ? (
              recommendations.length === 0 ? (
                <p className="text-sm leading-6 text-neutral-400">
                  Cards privados aparecerao aqui quando houver objecao, risco ou
                  oportunidade.
                </p>
              ) : (
                recommendations.map((card) => (
                  <article
                    className="rounded-md border border-amber-400/30 bg-amber-950/40 px-4 py-3"
                    key={card.id}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-amber-100">
                        {card.title}
                      </p>
                      <span className="shrink-0 rounded-sm bg-amber-300 px-2 py-1 text-xs font-medium text-neutral-950">
                        {card.kind}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-neutral-100">
                      {card.recommendation}
                    </p>
                    <p className="mt-3 border-l-2 border-amber-300/60 pl-3 text-xs leading-5 text-neutral-300">
                      {card.evidence}
                    </p>
                  </article>
                ))
              )
            ) : null}
          </div>
        </aside>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <section className="w-full max-w-2xl">
        <div className="mb-8">
          <p className="mb-3 text-sm font-medium uppercase tracking-wide text-brand">
            Sala {meetingId}
          </p>
          <h1 className="text-4xl font-semibold text-ink">
            Entre na reuniao com audio e video.
          </h1>
        </div>

        {step === "profile" ? (
          <form
            onSubmit={submitProfile}
            className="rounded-lg border border-line bg-white p-6 shadow-sm"
          >
            <h2 className="text-xl font-semibold text-ink">Seus dados</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Informe nome e e-mail para identificacao na sala.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">
                  Nome
                </span>
                <input
                  className="w-full rounded-md border border-line px-4 py-3 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  value={participant.name}
                  onChange={(event) =>
                    setParticipant((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  minLength={2}
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">
                  E-mail
                </span>
                <input
                  className="w-full rounded-md border border-line px-4 py-3 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  type="email"
                  value={participant.email}
                  onChange={(event) =>
                    setParticipant((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  required
                />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-medium text-ink">
                Papel na reuniao
              </span>
              <select
                className="w-full rounded-md border border-line bg-white px-4 py-3 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                value={participant.role}
                onChange={(event) =>
                  setParticipant((current) => ({
                    ...current,
                    role: event.target.value as ParticipantRole,
                  }))
                }
              >
                <option value="client">Cliente</option>
                <option value="commercial">Comercial</option>
                <option value="host">Host</option>
                <option value="observer">Observador</option>
              </select>
            </label>

            <div className="mt-6 flex justify-end">
              <button
                className="rounded-md bg-brand px-5 py-3 font-medium text-white transition hover:bg-teal-800"
                type="submit"
              >
                Continuar
              </button>
            </div>
          </form>
        ) : null}

        {step === "consent" ? (
          <form
            onSubmit={joinMeeting}
            className="rounded-lg border border-line bg-white p-6 shadow-sm"
          >
            <h2 className="text-xl font-semibold text-ink">
              Aceite LGPD obrigatorio
            </h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Para entrar, voce concorda com o tratamento dos seus dados de
              identificacao e midia da reuniao para viabilizar a chamada,
              transcricao futura, seguranca e melhoria do servico.
            </p>

            <label className="mt-6 flex gap-3 rounded-md border border-line bg-mist p-4 text-sm leading-6 text-neutral-700">
              <input
                className="mt-1 h-4 w-4 accent-brand"
                type="checkbox"
                checked={acceptedLgpd}
                onChange={(event) => setAcceptedLgpd(event.target.checked)}
              />
              <span>
                Li e aceito o tratamento de dados conforme a LGPD para participar
                desta reuniao.
              </span>
            </label>

            {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

            <div className="mt-6 flex flex-wrap justify-between gap-3">
              <button
                className="rounded-md border border-line px-5 py-3 font-medium text-ink transition hover:bg-mist"
                type="button"
                onClick={() => setStep("profile")}
              >
                Voltar
              </button>
              <button
                className="rounded-md bg-brand px-5 py-3 font-medium text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isJoining || !acceptedLgpd}
                type="submit"
              >
                {isJoining ? "Entrando..." : "Entrar na sala"}
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </main>
  );
}
