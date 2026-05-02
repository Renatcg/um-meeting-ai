"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useLocalParticipant,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { useRouter } from "next/navigation";

type Step = "lobby" | "room";
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
const commercialUserEmails = new Set(["renato@coevo.ai", "marina@coevo.ai"]);

function formatTimestamp(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function inferParticipantRole(email: string, isHostCreator: boolean): ParticipantRole {
  if (isHostCreator) {
    return "host";
  }

  if (commercialUserEmails.has(email.trim().toLowerCase())) {
    return "commercial";
  }

  return "client";
}

function roleLabel(role: ParticipantRole) {
  if (role === "host") {
    return "Host";
  }

  if (role === "commercial") {
    return "Comercial";
  }

  return "Participante";
}

function MeetingGrid({ meetingId }: { meetingId: string }) {
  const [clock, setClock] = useState("");
  const tracks = useTracks(
    [
      { source: Track.Source.ScreenShare, withPlaceholder: false },
      { source: Track.Source.Camera, withPlaceholder: true },
    ],
    { onlySubscribed: false },
  );

  useEffect(() => {
    function updateClock() {
      setClock(
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    }

    updateClock();
    const interval = window.setInterval(updateClock, 30000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col bg-neutral-950">
      <div className="min-h-0 flex-1 px-4 pb-3 pt-16 sm:px-6 sm:pt-20">
        <GridLayout
          tracks={tracks}
          className="um-meeting-grid h-full min-h-0"
        >
          <ParticipantTile />
        </GridLayout>
      </div>

      <footer className="um-meeting-footer grid min-h-24 shrink-0 grid-cols-1 items-center gap-4 border-t border-white/10 bg-neutral-950 px-4 py-4 text-white md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:px-6">
        <div className="hidden min-w-0 md:block">
          <p className="truncate font-mono text-sm text-neutral-300">
            {clock || "--:--"} | {meetingId}
          </p>
        </div>

        <MeetingControls />

        <div className="hidden justify-end gap-3 md:flex">
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-neutral-300">
            Grid
          </span>
        </div>
      </footer>

      <RoomAudioRenderer />
    </div>
  );
}

function MeetingControls() {
  const room = useRoomContext();
  const {
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
    localParticipant,
  } = useLocalParticipant();

  return (
    <div className="um-meeting-controls min-w-0" aria-label="Controles da reuniao">
      <button
        className={`um-control-button ${isMicrophoneEnabled ? "" : "is-off"}`}
        type="button"
        aria-label={isMicrophoneEnabled ? "Desligar microfone" : "Ligar microfone"}
        title={isMicrophoneEnabled ? "Desligar microfone" : "Ligar microfone"}
        onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
      >
        <span aria-hidden="true">Mic</span>
      </button>
      <button
        className={`um-control-button ${isCameraEnabled ? "" : "is-off"}`}
        type="button"
        aria-label={isCameraEnabled ? "Desligar camera" : "Ligar camera"}
        title={isCameraEnabled ? "Desligar camera" : "Ligar camera"}
        onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
      >
        <span aria-hidden="true">Cam</span>
      </button>
      <button
        className={`um-control-button ${isScreenShareEnabled ? "is-on" : ""}`}
        type="button"
        aria-label={
          isScreenShareEnabled ? "Parar compartilhamento" : "Compartilhar tela"
        }
        title={isScreenShareEnabled ? "Parar compartilhamento" : "Compartilhar tela"}
        onClick={() => localParticipant.setScreenShareEnabled(!isScreenShareEnabled)}
      >
        <span aria-hidden="true">Tela</span>
      </button>
      <button
        className="um-control-button is-leave"
        type="button"
        aria-label="Sair da reuniao"
        title="Sair da reuniao"
        onClick={() => room.disconnect()}
      >
        Sair
      </button>
    </div>
  );
}

export default function MeetingClient({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("lobby");
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
  const [isHostCreator, setIsHostCreator] = useState<boolean | null>(null);
  const [inviteLink, setInviteLink] = useState("");
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);

  const entryContextReady = isHostCreator !== null;
  const inferredRole = inferParticipantRole(
    participant.email,
    isHostCreator === true,
  );

  const canViewSalesPanel =
    connection?.role === "host" || connection?.role === "commercial";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const hostStorageKey = `um-meeting-host:${meetingId}`;
    const isHostFromUrl = params.get("host") === "1";
    const isHostFromStorage = window.sessionStorage.getItem(hostStorageKey) === "1";
    setIsHostCreator(isHostFromUrl || isHostFromStorage);
    setInviteLink(`${window.location.origin}/meeting/${meetingId}`);
  }, [meetingId]);

  useEffect(() => {
    setParticipant((current) => ({
      ...current,
      role: inferParticipantRole(current.email, isHostCreator === true),
    }));
  }, [isHostCreator, participant.email]);

  useEffect(() => {
    if (step !== "lobby") {
      return;
    }

    let active = true;

    async function startPreview() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        previewStreamRef.current = stream;
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = stream;
        }
      } catch {
        if (active) {
          setCameraError(true);
        }
      }
    }

    startPreview();

    return () => {
      active = false;
      previewStreamRef.current?.getTracks().forEach((track) => track.stop());
      previewStreamRef.current = null;
    };
  }, [step]);

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
    const participantAccessToken = connection.participant_access_token;

    async function loadRecommendations() {
      try {
        const response = await fetch(
          `${apiUrl}/meetings/${meetingId}/sales-recommendations`,
          {
            headers: {
              Authorization: `Bearer ${participantAccessToken}`,
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

  async function joinMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!entryContextReady) {
      setError("Aguarde um instante enquanto preparamos a sala.");
      return;
    }

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
          role: inferredRole,
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
      previewStreamRef.current?.getTracks().forEach((track) => track.stop());
      previewStreamRef.current = null;
      setConnection(tokenResponse);
      setStep("room");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setIsJoining(false);
    }
  }

  async function copyInviteLink() {
    setCopiedInviteLink(false);

    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedInviteLink(true);
      window.setTimeout(() => setCopiedInviteLink(false), 1800);
    } catch {
      setError("Nao foi possivel copiar o link automaticamente.");
    }
  }

  function stopPreview() {
    previewStreamRef.current?.getTracks().forEach((track) => track.stop());
    previewStreamRef.current = null;
  }

  function goBackHome() {
    stopPreview();
    router.push("/");
  }

  function leaveMeeting() {
    setConnection(null);
    setStep("lobby");
    router.push("/");
  }

  if (step === "room" && connection) {
    return (
      <main className="grid h-screen overflow-hidden bg-neutral-950 [height:100dvh] lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="relative min-h-0 overflow-hidden">
          <button
            className="absolute left-4 top-4 z-20 rounded-lg border border-white/10 bg-neutral-950/80 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-nmdi-gold/50 hover:bg-neutral-900"
            type="button"
            onClick={leaveMeeting}
          >
            Sair
          </button>
          <LiveKitRoom
            audio
            video
            token={connection.token}
            serverUrl={connection.url}
            data-lk-theme="default"
            className="h-full min-h-0 overflow-hidden"
            onDisconnected={leaveMeeting}
          >
            <MeetingGrid meetingId={meetingId} />
          </LiveKitRoom>
        </section>

        <aside className="hidden h-full min-h-0 flex-col overflow-hidden border-l border-neutral-800 bg-neutral-950 text-white lg:flex">
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-nmdi-ink px-5 py-10 text-nmdi-ivory">
      <video
        ref={previewVideoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 h-full w-full scale-x-[-1] object-cover opacity-70"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(11,13,18,0.88),rgba(11,13,18,0.38)),radial-gradient(circle_at_50%_0%,rgba(200,164,93,0.18),transparent_35%)]" />

      {cameraError ? (
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] bg-[length:42px_42px]" />
      ) : null}

      <form
        onSubmit={joinMeeting}
        className="relative z-10 w-full max-w-xl rounded-lg border border-white/10 bg-nmdi-ink/[0.82] p-6 shadow-nmdi-deep backdrop-blur-xl sm:p-8"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="inline-flex rounded-full border border-nmdi-gold/30 bg-nmdi-gold/10 px-3 py-1 font-mono text-xs uppercase text-nmdi-gold">
            Sala {meetingId}
          </p>
          <button
            className="rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-nmdi-ivory transition hover:border-nmdi-gold/50 hover:bg-white/[0.06]"
            type="button"
            onClick={goBackHome}
          >
            Voltar
          </button>
        </div>
        <h1 className="font-display text-3xl font-semibold leading-tight text-nmdi-ivory">
          Antes de entrar, identifique-se.
        </h1>
        <p className="mt-2 text-sm leading-6 text-nmdi-muted">
          Sua camera ja esta em preview. O link abaixo pode ser enviado para os
          convidados entrarem como participantes.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-nmdi-ivory">
              Nome
            </span>
            <input
              className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 text-nmdi-ivory outline-none transition placeholder:text-nmdi-muted focus:border-nmdi-gold/70 focus:ring-2 focus:ring-nmdi-gold/20"
              value={participant.name}
              onChange={(event) =>
                setParticipant((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              minLength={2}
              placeholder="Seu nome"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-nmdi-ivory">
              E-mail
            </span>
            <input
              className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 text-nmdi-ivory outline-none transition placeholder:text-nmdi-muted focus:border-nmdi-gold/70 focus:ring-2 focus:ring-nmdi-gold/20"
              type="email"
              value={participant.email}
              onChange={(event) =>
                setParticipant((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              placeholder="voce@empresa.com"
              required
            />
          </label>
        </div>

        <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase text-nmdi-gold">
                Papel automatico
              </p>
              <p className="mt-1 text-sm text-nmdi-muted">
                Host para quem criou a sala; Comercial pelo cadastro; demais
                entram como Participante.
              </p>
            </div>
            <span className="rounded-full border border-nmdi-gold/30 bg-nmdi-gold/10 px-3 py-1 font-mono text-xs uppercase text-nmdi-gold">
              {entryContextReady ? roleLabel(inferredRole) : "Preparando"}
            </span>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-nmdi-ivory">
              Link para convidar
            </span>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-nmdi-ink/70 px-4 py-3 text-sm text-nmdi-muted outline-none"
                value={inviteLink}
                readOnly
              />
              <button
                className="rounded-lg border border-nmdi-gold/40 px-4 py-3 text-sm font-semibold text-nmdi-gold transition hover:bg-nmdi-gold/10"
                type="button"
                onClick={copyInviteLink}
              >
                {copiedInviteLink ? "Copiado" : "Copiar link"}
              </button>
            </div>
          </label>
        </div>

        <label className="mt-4 flex gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-nmdi-muted">
          <input
            className="mt-1 h-4 w-4 accent-nmdi-gold"
            type="checkbox"
            checked={acceptedLgpd}
            onChange={(event) => setAcceptedLgpd(event.target.checked)}
          />
          <span>
            Li e aceito o tratamento de dados conforme a LGPD para participar
            desta reuniao.
          </span>
        </label>

        {error ? (
          <p className="mt-4 rounded-lg border border-nmdi-red/25 bg-nmdi-red/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end">
          <button
            className="rounded-lg bg-gradient-to-r from-nmdi-gold to-nmdi-amber px-6 py-3 font-bold text-nmdi-ink shadow-nmdi-glow transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isJoining || !acceptedLgpd || !entryContextReady}
            type="submit"
          >
            {isJoining ? "Entrando..." : "Entrar na sala"}
          </button>
        </div>
      </form>
    </main>
  );
}
