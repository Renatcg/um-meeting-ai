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

type MeetingSummary = {
  id: string;
  title: string;
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
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="min-h-0 flex-1 px-4 pb-3 pt-16 sm:px-6 sm:pt-20">
        <GridLayout
          tracks={tracks}
          className="um-meeting-grid h-full min-h-0"
        >
          <ParticipantTile />
        </GridLayout>
      </div>

      <footer className="um-meeting-footer grid min-h-24 shrink-0 grid-cols-1 items-center gap-4 border-t border-[#E7E7E2] bg-white px-4 py-4 text-[#11110F] md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:px-6">
        <div className="hidden min-w-0 md:block">
          <p className="truncate font-mono text-sm text-[#73736B]">
            {clock || "--:--"} | {meetingId}
          </p>
        </div>

        <MeetingControls />

        <div className="hidden justify-end gap-3 md:flex">
          <span className="rounded-full border border-[#E7E7E2] bg-[#FCFCFB] px-3 py-2 text-xs text-[#73736B]">
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
  const [meetingTitle, setMeetingTitle] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const knowledgeDocumentsRef = useRef<HTMLInputElement | null>(null);
  const knowledgeMediaRef = useRef<HTMLInputElement | null>(null);
  const knowledgeLinkRef = useRef<HTMLTextAreaElement | null>(null);
  const knowledgeTranscriptRef = useRef<HTMLTextAreaElement | null>(null);

  const entryContextReady = isHostCreator !== null;
  const inferredRole = inferParticipantRole(
    participant.email,
    isHostCreator === true,
  );
  const isHostLobby = inferredRole === "host";
  const lobbyTitle = meetingTitle || meetingId;

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
    let cancelled = false;

    async function loadMeeting() {
      try {
        const response = await fetch(`${apiUrl}/meetings/${meetingId}`);
        if (!response.ok) {
          return;
        }

        const meeting = (await response.json()) as MeetingSummary;
        if (!cancelled) {
          setMeetingTitle(meeting.title);
        }
      } catch {
        // The room can still be joined if the title lookup fails.
      }
    }

    loadMeeting();

    return () => {
      cancelled = true;
    };
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
      if (inferredRole === "host") {
        await uploadMeetingKnowledge();
      }

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

  async function uploadKnowledgeText(filename: string, content: string) {
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      return;
    }

    const formData = new FormData();
    formData.append(
      "file",
      new File([trimmedContent], filename, { type: "text/plain" }),
    );

    const response = await fetch(
      `${apiUrl}/meetings/${meetingId}/knowledge/documents`,
      {
        method: "POST",
        body: formData,
      },
    );

    if (!response.ok) {
      throw new Error("Nao foi possivel enviar a base de conhecimento.");
    }
  }

  async function uploadMeetingKnowledge() {
    const documents = Array.from(knowledgeDocumentsRef.current?.files ?? []);

    for (const file of documents) {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(
        `${apiUrl}/meetings/${meetingId}/knowledge/documents`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error("Nao foi possivel enviar a base de conhecimento.");
      }
    }

    const link = knowledgeLinkRef.current?.value ?? "";
    await uploadKnowledgeText("links-da-reuniao.txt", link);

    const transcript = knowledgeTranscriptRef.current?.value ?? "";
    await uploadKnowledgeText("contexto-da-reuniao.txt", transcript);

    const mediaFiles = Array.from(knowledgeMediaRef.current?.files ?? []);
    for (const file of mediaFiles) {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(
        `${apiUrl}/meetings/${meetingId}/knowledge/media`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error("Nao foi possivel transcrever a midia enviada.");
      }
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
      <main className="grid h-screen overflow-hidden bg-white text-[#11110F] [height:100dvh] lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="relative min-h-0 overflow-hidden">
          <button
            className="absolute left-4 top-4 z-20 rounded-lg border border-[#E7E7E2] bg-white/90 px-4 py-2 text-sm font-semibold text-[#11110F] shadow-[0_18px_70px_rgba(17,17,15,0.07)] backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-[#F97316] hover:bg-[#FFF3EA]"
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

        <aside className="hidden h-full min-h-0 flex-col overflow-hidden border-l border-[#E7E7E2] bg-[#FCFCFB] text-[#11110F] lg:flex">
          <div className="border-b border-[#E7E7E2] bg-white px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[#F97316]">
              Conversa
            </p>
            <h2 className="mt-1 text-lg font-semibold">Transcricao ao vivo</h2>
          </div>

          <div className="flex border-b border-[#E7E7E2] bg-white">
            <button
              className={`border-b-2 px-5 py-3 text-sm font-medium ${
                sidePanelTab === "transcript"
                  ? "border-[#F97316] text-[#11110F]"
                  : "border-transparent text-[#73736B] hover:text-[#11110F]"
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
                    ? "border-[#F97316] text-[#11110F]"
                    : "border-transparent text-[#73736B] hover:text-[#11110F]"
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
              <p className="text-sm leading-6 text-[#73736B]">
                A transcricao aparecera aqui quando os participantes comecarem a
                falar.
              </p>
            ) : null}

            {sidePanelTab === "transcript" ? (
              transcript.map((segment) => (
                <article
                  className="rounded-md border border-[#E7E7E2] bg-white px-4 py-3 shadow-[0_18px_70px_rgba(17,17,15,0.04)]"
                  key={segment.id}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-[#11110F]">
                      {segment.speaker_name}
                    </p>
                    <time className="shrink-0 text-xs text-[#73736B]">
                      {formatTimestamp(segment.timestamp_seconds)}
                    </time>
                  </div>
                  <p className="text-sm leading-6 text-[#383832]">
                    {segment.content}
                  </p>
                </article>
              ))
            ) : null}

            {sidePanelTab === "sales" && canViewSalesPanel ? (
              recommendations.length === 0 ? (
                <p className="text-sm leading-6 text-[#73736B]">
                  Cards privados aparecerao aqui quando houver objecao, risco ou
                  oportunidade.
                </p>
              ) : (
                recommendations.map((card) => (
                  <article
                    className="rounded-md border border-[#FDBA74] bg-[#FFF3EA] px-4 py-3"
                    key={card.id}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#11110F]">
                        {card.title}
                      </p>
                      <span className="shrink-0 rounded-sm bg-[#F97316] px-2 py-1 text-xs font-medium text-white">
                        {card.kind}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-[#383832]">
                      {card.recommendation}
                    </p>
                    <p className="mt-3 border-l-2 border-[#F97316]/60 pl-3 text-xs leading-5 text-[#73736B]">
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-5 py-10 text-[#11110F]">
      <video
        ref={previewVideoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 h-full w-full scale-x-[-1] object-cover opacity-20 grayscale"
      />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(17,17,15,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(17,17,15,0.055)_1px,transparent_1px)] bg-[length:42px_42px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(249,115,22,0.12),transparent_35%),linear-gradient(90deg,rgba(255,255,255,0.96),rgba(255,255,255,0.84))]" />

      {cameraError ? (
        <div className="absolute inset-0 bg-[#FCFCFB]" />
      ) : null}

      <form
        onSubmit={joinMeeting}
        className={`relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-[#E7E7E2] bg-white/90 p-6 shadow-[0_24px_90px_rgba(17,17,15,0.12)] backdrop-blur-xl sm:p-8 ${
          isHostLobby ? "max-w-4xl" : "max-w-2xl"
        }`}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="inline-flex rounded-full border border-[#FDBA74] bg-[#FFF3EA] px-3 py-1 font-mono text-xs uppercase text-[#F97316]">
            {isHostLobby ? `Sala ${meetingId}` : "Convite de reuniao"}
          </p>
          <button
            className="rounded-lg border border-[#E7E7E2] bg-white px-3 py-2 text-sm font-semibold text-[#11110F] transition hover:-translate-y-0.5 hover:border-[#F97316] hover:bg-[#FFF3EA]"
            type="button"
            onClick={goBackHome}
          >
            Voltar
          </button>
        </div>
        <h1 className="font-display text-3xl font-semibold leading-tight text-[#11110F]">
          {isHostLobby ? "Antes de entrar, configure a sala." : lobbyTitle}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#73736B]">
          {isHostLobby
            ? "Sua camera ja esta em preview. O link abaixo pode ser enviado para os convidados entrarem como participantes."
            : "Informe seus dados para entrar na reuniao. A traducao simultanea ainda nao esta ativa neste MVP."}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#11110F]">
              Nome
            </span>
            <input
              className="w-full rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] px-4 py-3 text-[#11110F] outline-none transition placeholder:text-[#73736B] focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/15"
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
            <span className="mb-2 block text-sm font-medium text-[#11110F]">
              E-mail
            </span>
            <input
              className="w-full rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] px-4 py-3 text-[#11110F] outline-none transition placeholder:text-[#73736B] focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/15"
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

        {isHostLobby ? (
          <div className="mt-4 rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase text-[#F97316]">
                  Papel automatico
                </p>
                <p className="mt-1 text-sm text-[#73736B]">
                  Host para quem criou a sala; Comercial pelo cadastro; demais
                  entram como Participante.
                </p>
              </div>
              <span className="rounded-full border border-[#FDBA74] bg-[#FFF3EA] px-3 py-1 font-mono text-xs uppercase text-[#F97316]">
                {entryContextReady ? roleLabel(inferredRole) : "Preparando"}
              </span>
            </div>
          </div>
        ) : null}

        {isHostLobby ? (
          <div className="mt-4 rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] p-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#11110F]">
                Link para convidar
              </span>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  className="min-w-0 flex-1 rounded-lg border border-[#E7E7E2] bg-[#F8F8F6] px-4 py-3 text-sm text-[#73736B] outline-none"
                  value={inviteLink}
                  readOnly
                />
                <button
                  className="rounded-lg border border-[#FDBA74] px-4 py-3 text-sm font-semibold text-[#F97316] transition hover:bg-[#FFF3EA]"
                  type="button"
                  onClick={copyInviteLink}
                >
                  {copiedInviteLink ? "Copiado" : "Copiar link"}
                </button>
              </div>
            </label>
          </div>
        ) : null}

        {isHostLobby ? (
          <section className="mt-4 rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase text-[#F97316]">
                  Base de conhecimento
                </p>
                <p className="mt-1 text-sm text-[#73736B]">
                  Apenas o Host pode alimentar a base antes da reuniao.
                </p>
              </div>
              <span className="rounded-full border border-[#E7E7E2] bg-white px-3 py-1 font-mono text-xs uppercase text-[#73736B]">
                Host liberado
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#11110F]">
                  Documentos
                </span>
                <input
                  ref={knowledgeDocumentsRef}
                  className="w-full rounded-lg border border-[#E7E7E2] bg-white px-4 py-3 text-sm text-[#73736B] file:mr-3 file:rounded-md file:border-0 file:bg-[#11110F] file:px-3 file:py-2 file:text-sm file:font-bold file:text-white"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.md"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#11110F]">
                  Links da web
                </span>
                <textarea
                  ref={knowledgeLinkRef}
                  className="h-24 w-full resize-none rounded-lg border border-[#E7E7E2] bg-white px-4 py-3 text-sm text-[#11110F] outline-none transition placeholder:text-[#73736B] focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/15"
                  placeholder="Cole um ou mais links, um por linha."
                />
              </label>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#11110F]">
                  Audios e videos
                </span>
                <input
                  ref={knowledgeMediaRef}
                  className="w-full rounded-lg border border-[#E7E7E2] bg-white px-4 py-3 text-sm text-[#73736B] file:mr-3 file:rounded-md file:border-0 file:bg-[#F8F8F6] file:px-3 file:py-2 file:text-sm file:font-bold file:text-[#11110F]"
                  type="file"
                  multiple
                  accept="audio/*,video/*"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#11110F]">
                  Transcricoes
                </span>
                <textarea
                  ref={knowledgeTranscriptRef}
                  className="h-24 w-full resize-none rounded-lg border border-[#E7E7E2] bg-white px-4 py-3 text-sm text-[#11110F] outline-none transition placeholder:text-[#73736B] focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/15"
                  placeholder="Cole uma transcricao, briefing ou contexto da reuniao."
                />
              </label>
            </div>
          </section>
        ) : null}

        <section className="mt-4 rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] p-4 opacity-70">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase text-[#F97316]">
                Traducao simultanea
              </p>
              <p className="mt-1 text-sm text-[#73736B]">
                Funcao planejada: cada participante fala e ouve na propria lingua.
              </p>
            </div>
            <span className="rounded-full border border-[#E7E7E2] bg-white px-3 py-1 font-mono text-xs uppercase text-[#73736B]">
              Em breve
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-3 rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] p-4 text-sm text-[#73736B]">
              <input className="h-4 w-4" type="checkbox" disabled />
              Preciso de traducao simultanea
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#11110F]">
                Lingua desejada
              </span>
              <select
                className="w-full rounded-lg border border-[#E7E7E2] bg-white px-4 py-3 text-sm text-[#73736B] outline-none disabled:cursor-not-allowed"
                disabled
                defaultValue=""
              >
                <option value="">Selecione uma lingua</option>
                <option value="pt-BR">Portugues do Brasil</option>
                <option value="en-US">Ingles</option>
                <option value="es-ES">Espanhol</option>
                <option value="fr-FR">Frances</option>
                <option value="de-DE">Alemao</option>
                <option value="it-IT">Italiano</option>
              </select>
            </label>
          </div>
        </section>

        <label className="mt-4 flex gap-3 rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] p-4 text-sm leading-6 text-[#73736B]">
          <input
            className="mt-1 h-4 w-4 accent-[#F97316]"
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
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end">
          <button
            className="rounded-lg bg-[#11110F] px-6 py-3 font-bold text-white shadow-[0_20px_70px_rgba(249,115,22,0.22)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
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
