"use client";

import {
  type ComponentProps,
  type Dispatch,
  FormEvent,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import { RoomEvent, Track } from "livekit-client";
import { useRouter } from "next/navigation";

type Step = "lobby" | "room";
type ParticipantRole = "host" | "commercial" | "client" | "observer";
type SidePanelTab = "chat" | "insights" | "memory";
type VideoEffectMode = "none" | "blur" | "coevo" | "image";
type RecordingStatus = "idle" | "starting" | "active" | "failed";

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
  awaiting_approval?: boolean;
  join_request_id?: number | null;
};

type RecordingStartResponse = {
  started: boolean;
  configured: boolean;
  recording?: MeetingRecording | null;
  detail?: string | null;
};

type MeetingRecording = {
  status: string;
  ended_at?: string | null;
  error?: string | null;
};

type MeetingJoinRequest = {
  id: number;
  meeting_id: string;
  name: string;
  email: string;
  role: ParticipantRole;
  status: "pending" | "approved" | "denied";
  created_at: string;
  updated_at: string;
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

type MeetingChatMessageResponse = {
  id: number;
  meeting_id: string;
  sender_identity: string;
  sender_name: string;
  sender_role: ParticipantRole;
  content: string;
  created_at: string;
};

type MeetingMemoryItem = {
  id: number;
  memory_type: string;
  content: string;
  source_label?: string | null;
  created_at: string;
};

type MeetingSummary = {
  id: string;
  title: string;
  created_at: string;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const CHAT_TOPIC = "um-meeting-chat";
const AGENT_INTERVENTION_TOPIC = "coevo-agent-intervention";
const HAND_RAISE_TOPIC = "coevo-hand-raise";
const COEVO_BACKGROUND_URL = "/backgrounds/coevo-meeting.svg";
const agentNameMatchers = ["coevo", "jarvis", "um copilot", "copilot"];
const commercialUserEmails = new Set(["renato@coevo.ai", "marina@coevo.ai"]);

type MeetingParticipantTileProps = ComponentProps<typeof ParticipantTile> & {
  agentParticipant?: {
    identity?: string;
    isSpeaking?: boolean;
    name?: string;
  };
  trackRef?: {
    participant?: {
      identity?: string;
      isSpeaking?: boolean;
      isLocal?: boolean;
      name?: string;
    };
    source?: Track.Source;
  };
  handRaised?: {
    raised: boolean;
    subject?: string;
  };
};

type MeetingTileItem =
  | {
      agentParticipant?: never;
      key: string;
      trackRef: NonNullable<MeetingParticipantTileProps["trackRef"]>;
    }
  | {
      agentParticipant: NonNullable<MeetingParticipantTileProps["agentParticipant"]>;
      key: string;
      trackRef?: never;
    };

type LocalParticipantWithTracks = {
  getTrackPublication?: (source: Track.Source) => {
    track?: LocalVideoTrackWithProcessor;
  };
  setCameraEnabled: (enabled: boolean) => Promise<void> | void;
  videoTrackPublications?: Map<
    string,
    {
      source?: Track.Source;
      track?: LocalVideoTrackWithProcessor;
    }
  >;
};

type LocalVideoTrackWithProcessor = {
  setProcessor?: (processor: unknown) => Promise<void> | void;
  stopProcessor?: () => Promise<void> | void;
};

type LocalParticipantWithPublish = {
  publishTrack: (
    track: MediaStreamTrack,
    options?: { source?: Track.Source },
  ) => Promise<unknown> | unknown;
};

type TrackProcessorsModule = {
  BackgroundBlur?: (blurRadius?: number) => unknown;
  BackgroundProcessor?: (options: {
    blurRadius?: number;
    imagePath?: string;
    mode: "background-blur" | "disabled" | "virtual-background";
  }) => unknown;
  VirtualBackground?: (imagePath: string) => unknown;
  supportsBackgroundProcessors?: () => boolean | Promise<boolean>;
};

type HandRaisePayload = {
  type: "hand_raise";
  identity: string;
  name: string;
  raised: boolean;
  subject?: string;
  createdAt: string;
};

type AgentInterventionPayload = {
  type: "agent_intervention";
  id: string;
  subject: string;
  rationale?: string;
  isRaised?: boolean;
  createdAt: string;
};

type RaisedHandState = {
  name: string;
  raised: boolean;
  subject?: string;
};

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

function HandRaisedIcon() {
  return (
    <svg
      aria-hidden="true"
      className="um-icon-hand"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M7.2 11.5V5.9a1.35 1.35 0 0 1 2.7 0v5.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
      <path
        d="M9.9 11V4.7a1.35 1.35 0 0 1 2.7 0V11"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
      <path
        d="M12.6 11.2V6.1a1.35 1.35 0 0 1 2.7 0v6.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
      <path
        d="M15.3 12.5V8.4a1.35 1.35 0 0 1 2.7 0v6.1c0 3.6-2.25 5.9-5.7 5.9h-.9c-2.3 0-3.95-1.05-5.15-3.05l-1.8-3.05a1.38 1.38 0 0 1 2.3-1.5l1.55 2.05"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function MicIcon({ muted = false }: { muted?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="um-control-icon"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 14.5a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5.5a3 3 0 0 0 3 3Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
      <path
        d="M5.8 10.5a6.2 6.2 0 0 0 12.4 0M12 16.8V20M9 20h6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
      {muted ? (
        <path
          d="M4 4l16 16"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2.2"
        />
      ) : null}
    </svg>
  );
}

function CameraIcon({ off = false }: { off?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="um-control-icon"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M4.8 8.3A2.3 2.3 0 0 1 7.1 6h6.2a2.3 2.3 0 0 1 2.3 2.3v7.4a2.3 2.3 0 0 1-2.3 2.3H7.1a2.3 2.3 0 0 1-2.3-2.3V8.3Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="m15.6 10 3.6-2.1v8.2L15.6 14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      {off ? (
        <path
          d="M4 4l16 16"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2.2"
        />
      ) : null}
    </svg>
  );
}

function ScreenShareIcon() {
  return (
    <svg
      aria-hidden="true"
      className="um-control-icon"
      fill="none"
      viewBox="0 0 24 24"
    >
      <rect
        height="12"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.9"
        width="16"
        x="4"
        y="5"
      />
      <path
        d="M12 14V9.5M9.8 11.7 12 9.5l2.2 2.2M9 20h6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function EffectsIcon() {
  return (
    <svg
      aria-hidden="true"
      className="um-control-icon"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m5.4 18.6 9.9-9.9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="m13.2 6.8 4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
      <path
        d="M18.4 4.2v2.1M19.45 5.25h-2.1M8.3 5.2l.45 1.15 1.15.45-1.15.45L8.3 8.4l-.45-1.15L6.7 6.8l1.15-.45.45-1.15ZM17.6 15.2l.6 1.55 1.55.6-1.55.6-.6 1.55-.6-1.55-1.55-.6 1.55-.6.6-1.55Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function LeaveIcon() {
  return (
    <svg
      aria-hidden="true"
      className="um-control-icon"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M5.5 20.5V4.8a1.3 1.3 0 0 1 1-1.25l7-1.75A1.3 1.3 0 0 1 15.1 3v18a1.3 1.3 0 0 1-1.6 1.25l-7-1.75a1.3 1.3 0 0 1-1-1.25Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M15.2 5.5h2.7a1.6 1.6 0 0 1 1.6 1.6v9.8a1.6 1.6 0 0 1-1.6 1.6h-2.7M11.2 12h.05"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      aria-hidden="true"
      className="um-control-icon"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M9.8 13.7a3.2 3.2 0 0 1 0-4.5l2.3-2.3a3.2 3.2 0 0 1 4.5 4.5l-.8.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M14.2 10.3a3.2 3.2 0 0 1 0 4.5l-2.3 2.3a3.2 3.2 0 0 1-4.5-4.5l.8-.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      aria-hidden="true"
      className="um-control-icon"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M5 12h13M13.5 6.5 19 12l-5.5 5.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      className="um-control-icon"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 5.5v13M5.5 12h13"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="um-control-icon"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M7 7l10 10M17 7 7 17"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function InsightIcon() {
  return (
    <svg className="um-control-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v2" />
      <path d="M18.4 5.6 17 7" />
      <path d="M21 12h-2" />
      <path d="M5 12H3" />
      <path d="M7 7 5.6 5.6" />
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M8.5 14.5a5 5 0 1 1 7 0c-.8.8-1.1 1.5-1.2 2.5H9.7c-.1-1-.4-1.7-1.2-2.5Z" />
    </svg>
  );
}

function MemoryIcon() {
  return (
    <svg className="um-control-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4h10a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </svg>
  );
}

function TaskIcon() {
  return (
    <svg className="um-control-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 11 11 13 15.5 8.5" />
      <path d="M5 5h14v14H5z" />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg
      aria-hidden="true"
      className="um-control-icon"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M8.5 4.5h-4v4M15.5 4.5h4v4M19.5 15.5v4h-4M4.5 15.5v4h4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M4.8 4.8 9 9M19.2 4.8 15 9M19.2 19.2 15 15M4.8 19.2 9 15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function RecordingIndicator({ status }: { status: RecordingStatus }) {
  if (status === "idle") {
    return null;
  }

  const label =
    status === "active"
      ? "REC"
      : status === "starting"
        ? "REC..."
        : "REC off";

  return (
    <span className={`um-recording-pill is-${status}`} aria-label={label}>
      <span className="um-rec-dot" />
      <span>{label}</span>
    </span>
  );
}

function deriveRecordingStatus(
  recordings: MeetingRecording[],
): RecordingStatus | null {
  if (recordings.length === 0) {
    return null;
  }

  const statuses = recordings.map((recording) =>
    recording.status.toUpperCase(),
  );

  if (
    statuses.some(
      (status) => status === "EGRESS_ACTIVE" || status === "ACTIVE",
    )
  ) {
    return "active";
  }

  if (
    statuses.some(
      (status) => status === "EGRESS_STARTING" || status === "STARTING",
    )
  ) {
    return "starting";
  }

  if (
    statuses.some((status) =>
      ["FAILED", "ABORTED", "LIMIT_REACHED"].some((marker) =>
        status.includes(marker),
      ),
    )
  ) {
    return "failed";
  }

  return "idle";
}

function formatElapsedTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function videoEffectLabel(effect: VideoEffectMode) {
  if (effect === "blur") {
    return "Blur";
  }

  if (effect === "coevo") {
    return "Fundo Coevo";
  }

  if (effect === "image") {
    return "Imagem";
  }

  return "Sem efeito";
}

function getLocalCameraTrack(localParticipant: unknown) {
  const participant = localParticipant as LocalParticipantWithTracks;
  const publication = participant.getTrackPublication?.(Track.Source.Camera);
  if (publication?.track) {
    return publication.track;
  }

  const publications = Array.from(participant.videoTrackPublications?.values() ?? []);
  return publications.find((item) => item.source === Track.Source.Camera)?.track;
}

async function createVideoProcessor(
  effect: VideoEffectMode,
  customBackgroundUrl: string | null,
) {
  const processors = (await import("@livekit/track-processors")) as TrackProcessorsModule;
  const isSupported = await processors.supportsBackgroundProcessors?.();
  if (isSupported === false) {
    throw new Error("Este dispositivo nao suporta efeitos de video.");
  }

  if (effect === "blur") {
    if (processors.BackgroundProcessor) {
      return processors.BackgroundProcessor({
        blurRadius: 12,
        mode: "background-blur",
      });
    }

    if (!processors.BackgroundBlur) {
      throw new Error("Blur de fundo indisponivel nesta versao.");
    }

    return processors.BackgroundBlur(12);
  }

  if (effect === "coevo" || effect === "image") {
    const imagePath = effect === "coevo" ? COEVO_BACKGROUND_URL : customBackgroundUrl;
    if (!imagePath) {
      throw new Error("Escolha uma imagem de fundo.");
    }

    if (processors.BackgroundProcessor) {
      return processors.BackgroundProcessor({
        imagePath,
        mode: "virtual-background",
      });
    }

    if (!processors.VirtualBackground) {
      throw new Error("Fundo virtual indisponivel nesta versao.");
    }

    return processors.VirtualBackground(imagePath);
  }

  return null;
}

async function applyVideoEffectToLocalCamera({
  customBackgroundUrl,
  effect,
  localParticipant,
}: {
  customBackgroundUrl: string | null;
  effect: VideoEffectMode;
  localParticipant: unknown;
}) {
  const participant = localParticipant as LocalParticipantWithTracks;
  let track = getLocalCameraTrack(participant);

  if (!track) {
    await participant.setCameraEnabled(true);
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    track = getLocalCameraTrack(participant);
  }

  if (!track) {
    throw new Error("Nao encontrei a camera local para aplicar o efeito.");
  }

  await track.stopProcessor?.();

  if (effect === "none") {
    return;
  }

  const processor = await createVideoProcessor(effect, customBackgroundUrl);
  if (!processor || !track.setProcessor) {
    throw new Error("Nao foi possivel aplicar este efeito.");
  }

  await track.setProcessor(processor);
}

function isAgentParticipant(name?: string, identity?: string) {
  const normalizedIdentity = identity?.toLowerCase().trim() ?? "";
  if (normalizedIdentity.startsWith("agent-")) {
    return true;
  }

  const label = `${name ?? ""} ${identity ?? ""}`.toLowerCase().trim();
  return agentNameMatchers.some((matcher) => label.includes(matcher));
}

function AgentOrb({ isSpeaking }: { isSpeaking: boolean }) {
  return (
    <div
      className={`um-agent-orb ${isSpeaking ? "is-speaking" : ""}`}
      aria-label={isSpeaking ? "Coevo esta falando" : "Coevo esta ouvindo"}
    >
      <span className="um-agent-orb-ring" />
      <span className="um-agent-orb-ring" />
      <span className="um-agent-orb-core">
        <span className="um-agent-orb-bars">
          <span />
          <span />
          <span />
        </span>
      </span>
    </div>
  );
}

function AgentPresence() {
  const participants = useParticipants();
  const agent = participants.find((roomParticipant) =>
    isAgentParticipant(roomParticipant.name, roomParticipant.identity),
  );

  if (!agent) {
    return null;
  }

  return (
    <div className="absolute right-4 top-4 z-10 rounded-2xl border border-[#4FC3F7]/25 bg-[#070A10]/88 px-4 py-3 shadow-[0_0_34px_rgba(79,195,247,0.14)] backdrop-blur-xl sm:right-6">
      <div className="flex items-center gap-3">
        <AgentOrb isSpeaking={Boolean(agent.isSpeaking)} />
        <div>
          <p className="text-sm font-semibold text-white">Coevo</p>
          <p className="text-xs text-[#B8C7D9]">
            {agent.isSpeaking ? "Falando agora" : "Ouvindo a reuniao"}
          </p>
        </div>
      </div>
    </div>
  );
}

function MeetingParticipantTile(props: MeetingParticipantTileProps) {
  const participant = props.agentParticipant ?? props.trackRef?.participant;
  const isAgent = isAgentParticipant(participant?.name, participant?.identity);
  const isLocalScreenShare =
    props.trackRef?.source === Track.Source.ScreenShare &&
    Boolean(props.trackRef?.participant.isLocal);
  const tileRef = useRef<HTMLDivElement | null>(null);
  const handRaised = Boolean(props.handRaised?.raised);
  const { agentParticipant: _agentParticipant, handRaised: _handRaised, ...tileProps } =
    props;

  async function openFullscreen() {
    await tileRef.current?.requestFullscreen?.();
  }

  if (!isAgent) {
    if (props.trackRef?.source !== Track.Source.ScreenShare) {
      return (
        <div className="um-participant-tile-wrap">
          <ParticipantTile {...tileProps} />
          {handRaised ? (
            <span
              className="um-hand-raise-badge"
              aria-label="Mao levantada"
              title="Mao levantada"
            >
              <HandRaisedIcon />
            </span>
          ) : null}
        </div>
      );
    }

    if (isLocalScreenShare) {
      return (
        <div className="um-screen-share-tile is-local-share">
          <ScreenShareIcon />
          <div>
            <p>Voce esta compartilhando a tela</p>
            <span>
              Para evitar espelhamento infinito, sua propria apresentacao fica
              oculta aqui.
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="um-screen-share-tile" ref={tileRef}>
        <ParticipantTile {...tileProps} />
        <button
          className="um-fullscreen-button"
          type="button"
          aria-label="Abrir tela compartilhada em tela cheia"
          title="Tela cheia"
          onClick={openFullscreen}
        >
          <FullscreenIcon />
        </button>
      </div>
    );
  }

  return (
    <div className={`um-agent-video-tile ${handRaised ? "has-raised-hand" : ""}`}>
      {handRaised ? (
        <span
          className="um-hand-raise-badge is-agent"
          aria-label="Coevo levantou a mao"
          title={
            props.handRaised?.subject
              ? `Coevo quer contribuir sobre: ${props.handRaised.subject}`
              : "Coevo quer contribuir"
          }
        >
          <HandRaisedIcon />
        </span>
      ) : null}
      <div className="um-agent-video-orb-wrap">
        <AgentOrb isSpeaking={Boolean(participant?.isSpeaking)} />
      </div>
      <div className="um-agent-video-label">
        <p>Coevo</p>
        <span>
          {participant?.isSpeaking ? "Falando agora" : "Ouvindo a reuniao"}
        </span>
      </div>
    </div>
  );
}

function LocalPreviewTile({
  participantName,
  stream,
}: {
  participantName: string;
  stream: MediaStream;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="um-participant-tile-wrap um-local-preview-tile">
      <video ref={videoRef} autoPlay muted playsInline />
      <span className="lk-participant-name">
        {participantName || "Voce"}
      </span>
    </div>
  );
}

function PreviewTrackPublisher({
  onPublished,
  previewStream,
}: {
  onPublished: () => void;
  previewStream: MediaStream | null;
}) {
  const room = useRoomContext();
  const hasPublishedRef = useRef(false);

  useEffect(() => {
    if (!previewStream || hasPublishedRef.current) {
      return;
    }

    async function publishPreviewTracks() {
      if (!previewStream || hasPublishedRef.current) {
        return;
      }

      hasPublishedRef.current = true;
      const publisher = room.localParticipant as unknown as LocalParticipantWithPublish;

      const tracks = previewStream.getVideoTracks();
      const results = await Promise.allSettled(
        tracks.map((track) =>
          publisher.publishTrack(track, {
            source: Track.Source.Camera,
          }),
        ),
      );
      if (results.some((result) => result.status === "fulfilled")) {
        onPublished();
      } else {
        hasPublishedRef.current = false;
      }
    }

    if (room.state === "connected") {
      void publishPreviewTracks();
    }

    room.on(RoomEvent.Connected, publishPreviewTracks);
    return () => {
      room.off(RoomEvent.Connected, publishPreviewTracks);
    };
  }, [onPublished, previewStream, room]);

  return null;
}

function trackKey(trackRef: MeetingParticipantTileProps["trackRef"], fallback: string) {
  return `${trackRef?.participant?.identity ?? fallback}-${trackRef?.source ?? fallback}`;
}

function TilePagination({
  currentPage,
  label,
  setCurrentPage,
  totalPages,
  variant,
}: {
  currentPage: number;
  label: string;
  setCurrentPage: Dispatch<SetStateAction<number>>;
  totalPages: number;
  variant: "desktop" | "mobile";
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className={`um-meeting-pagination is-${variant}`} aria-label={label}>
      <button
        className="um-page-button"
        type="button"
        aria-label="Pagina anterior"
        onClick={() => setCurrentPage((page) => Math.max(0, page - 1))}
        disabled={currentPage === 0}
      >
        {"<"}
      </button>
      <span className="font-mono text-xs font-semibold text-[#73736B]">
        {currentPage + 1}/{totalPages}
      </span>
      <button
        className="um-page-button"
        type="button"
        aria-label="Proxima pagina"
        onClick={() =>
          setCurrentPage((page) => Math.min(totalPages - 1, page + 1))
        }
        disabled={currentPage === totalPages - 1}
      >
        {">"}
      </button>
    </div>
  );
}

function renderMeetingTile(
  tile: MeetingTileItem,
  raisedHands: Record<string, RaisedHandState>,
) {
  if (tile.trackRef) {
    const identity = tile.trackRef.participant?.identity;
    return (
      <MeetingParticipantTile
        handRaised={identity ? raisedHands[identity] : undefined}
        key={tile.key}
        trackRef={tile.trackRef}
      />
    );
  }

  return (
    <MeetingParticipantTile
      agentParticipant={tile.agentParticipant}
      handRaised={
        tile.agentParticipant.identity
          ? raisedHands[tile.agentParticipant.identity]
          : undefined
      }
      key={tile.key}
    />
  );
}

function VideoEffectPicker({
  customBackgroundName,
  onCustomImageChange,
  setVideoEffect,
  videoEffect,
}: {
  customBackgroundName: string | null;
  onCustomImageChange: (file: File | null) => void;
  setVideoEffect: (effect: VideoEffectMode) => void;
  videoEffect: VideoEffectMode;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(["none", "blur", "coevo"] as VideoEffectMode[]).map((effect) => (
        <button
          className={`um-effect-option ${
            videoEffect === effect ? "is-selected" : ""
          }`}
          key={effect}
          type="button"
          onClick={() => setVideoEffect(effect)}
        >
          <span className={`um-effect-preview is-${effect}`} />
          <span>{videoEffectLabel(effect)}</span>
        </button>
      ))}

      <label
        className={`um-effect-option cursor-pointer ${
          videoEffect === "image" ? "is-selected" : ""
        }`}
      >
        <span className="um-effect-preview is-image" />
        <span className="truncate">
          {customBackgroundName ? customBackgroundName : "Imagem personalizada"}
        </span>
        <input
          className="sr-only"
          type="file"
          accept="image/*"
          onChange={(event) =>
            onCustomImageChange(event.target.files?.item(0) ?? null)
          }
        />
      </label>
    </div>
  );
}

function MeetingGrid({
  canViewSalesPanel,
  copiedInviteLink,
  customBackgroundName,
  customBackgroundUrl,
  isDesktopSidePanelVisible,
  meetingId,
  onCopyInviteLink,
  onCustomBackgroundChange,
  onEndMeeting,
  onLeaveMeeting,
  participantName,
  previewStream,
  recordingStatus,
  setVideoEffect,
  setIsDesktopSidePanelVisible,
  videoEffect,
}: {
  canViewSalesPanel: boolean;
  copiedInviteLink: boolean;
  customBackgroundName: string | null;
  customBackgroundUrl: string | null;
  isDesktopSidePanelVisible: boolean;
  meetingId: string;
  onCopyInviteLink: () => void;
  onCustomBackgroundChange: (file: File | null) => void;
  onEndMeeting: () => void | Promise<void>;
  onLeaveMeeting: () => void;
  participantName: string;
  previewStream: MediaStream | null;
  recordingStatus: RecordingStatus;
  setVideoEffect: (effect: VideoEffectMode) => void;
  setIsDesktopSidePanelVisible: Dispatch<SetStateAction<boolean>>;
  videoEffect: VideoEffectMode;
}) {
  const room = useRoomContext();
  const [clock, setClock] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [desktopPage, setDesktopPage] = useState(0);
  const [mobilePage, setMobilePage] = useState(0);
  const [raisedHands, setRaisedHands] = useState<Record<string, RaisedHandState>>({});
  const [isVideoEffectTransitioning, setIsVideoEffectTransitioning] =
    useState(false);
  const participants = useParticipants();
  const tracks = useTracks(
    [
      { source: Track.Source.ScreenShare, withPlaceholder: false },
      { source: Track.Source.Camera, withPlaceholder: true },
    ],
    { onlySubscribed: false },
  );
  const localCameraTrack = tracks.find(
    (trackRef) =>
      trackRef.participant.isLocal && trackRef.source === Track.Source.Camera,
  );
  const mobileTracks = tracks.filter(
    (trackRef) =>
      !(trackRef.participant.isLocal && trackRef.source === Track.Source.Camera),
  );
  const agentParticipant = participants.find((roomParticipant) =>
    isAgentParticipant(roomParticipant.name, roomParticipant.identity),
  );
  const agentAlreadyHasTile = tracks.some((trackRef) =>
    isAgentParticipant(trackRef.participant.name, trackRef.participant.identity),
  );
  const desktopTiles: MeetingTileItem[] = tracks.map((trackRef, index) => ({
    key: trackKey(trackRef, `desktop-${index}`),
    trackRef,
  }));
  const mobileTiles: MeetingTileItem[] = mobileTracks.map((trackRef, index) => ({
    key: trackKey(trackRef, `mobile-${index}`),
    trackRef,
  }));

  if (agentParticipant && !agentAlreadyHasTile) {
    desktopTiles.push({
      agentParticipant,
      key: "desktop-agent-orb",
    });
    mobileTiles.push({
      agentParticipant,
      key: "mobile-agent-orb",
    });
  }

  const pageSize = 4;
  const desktopTotalPages = Math.max(1, Math.ceil(desktopTiles.length / pageSize));
  const mobileTotalPages = Math.max(1, Math.ceil(mobileTiles.length / pageSize));
  const visibleDesktopTiles = desktopTiles.slice(
    desktopPage * pageSize,
    desktopPage * pageSize + pageSize,
  );
  const visibleMobileTiles = mobileTiles.slice(
    mobilePage * pageSize,
    mobilePage * pageSize + pageSize,
  );
  const shouldShowLocalPreview = Boolean(previewStream) && !localCameraTrack;

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

  useEffect(() => {
    const startedAt = Date.now();

    function updateElapsedTime() {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }

    updateElapsedTime();
    const interval = window.setInterval(updateElapsedTime, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    setDesktopPage((page) => Math.min(page, desktopTotalPages - 1));
  }, [desktopTotalPages]);

  useEffect(() => {
    setMobilePage((page) => Math.min(page, mobileTotalPages - 1));
  }, [mobileTotalPages]);

  useEffect(() => {
    const decoder = new TextDecoder();

    function handleDataReceived(...args: unknown[]) {
      const payload = args[0] as Uint8Array;
      const participant = args[1] as
        | { identity?: string; name?: string }
        | undefined;
      const topic = typeof args[3] === "string" ? args[3] : undefined;

      if (topic !== HAND_RAISE_TOPIC && topic !== AGENT_INTERVENTION_TOPIC) {
        return;
      }

      try {
        const parsed = JSON.parse(decoder.decode(payload)) as
          | HandRaisePayload
          | AgentInterventionPayload;

        if (parsed.type === "hand_raise") {
          setRaisedHands((current) => ({
            ...current,
            [parsed.identity]: {
              name: parsed.name,
              raised: parsed.raised,
              subject: parsed.subject,
            },
          }));
          return;
        }

        if (parsed.type === "agent_intervention") {
          const agentIdentity = participant?.identity ?? agentParticipant?.identity;
          if (!agentIdentity) {
            return;
          }

          setRaisedHands((current) => ({
            ...current,
            [agentIdentity]: {
              name: participant?.name ?? agentParticipant?.name ?? "Coevo",
              raised: parsed.isRaised !== false,
              subject: parsed.subject,
            },
          }));
        }
      } catch {
        // Ignore unrelated or malformed meeting data messages.
      }
    }

    room.on(RoomEvent.DataReceived, handleDataReceived);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [agentParticipant?.identity, agentParticipant?.name, room]);

  async function toggleLocalHand() {
    const identity = room.localParticipant.identity;
    const name = room.localParticipant.name || "Participante";
    const raised = !raisedHands[identity]?.raised;
    const message: HandRaisePayload = {
      type: "hand_raise",
      identity,
      name,
      raised,
      createdAt: new Date().toISOString(),
    };

    setRaisedHands((current) => ({
      ...current,
      [identity]: { name, raised },
    }));

    const publisher = room.localParticipant as unknown as {
      publishData: (
        data: Uint8Array,
        options?: { reliable?: boolean; topic?: string },
      ) => Promise<void> | void;
    };

    await publisher.publishData(
      new TextEncoder().encode(JSON.stringify(message)),
      {
        reliable: true,
        topic: HAND_RAISE_TOPIC,
      },
    );
  }

  const elapsedTime = formatElapsedTime(elapsedSeconds);
  const desktopGridDensity =
    visibleDesktopTiles.length === 1
      ? "is-page-single"
      : visibleDesktopTiles.length <= 2
        ? "is-page-compact"
        : "";

  return (
    <div className="um-meeting-layout flex h-full min-h-0 flex-col">
      <button
        className="um-side-panel-toggle hidden lg:grid"
        type="button"
        aria-label={
          isDesktopSidePanelVisible ? "Ocultar painel" : "Mostrar painel"
        }
        title={isDesktopSidePanelVisible ? "Ocultar painel" : "Mostrar painel"}
        onClick={() => setIsDesktopSidePanelVisible((isVisible) => !isVisible)}
      >
        <span
          className={`um-panel-toggle-icon ${
            isDesktopSidePanelVisible ? "is-open" : "is-closed"
          }`}
          aria-hidden="true"
        />
      </button>
      <div className="um-video-stage-shell min-h-0 flex-1 px-4 pb-3 pt-16 sm:px-6 sm:pt-20">
        <AgentPresence />
        <div className="absolute left-4 top-4 z-10 rounded-full border border-[#4FC3F7]/25 bg-[#070A10]/88 px-3 py-2 font-mono text-xs font-semibold text-white shadow-[0_0_34px_rgba(79,195,247,0.14)] backdrop-blur-xl sm:left-6">
          {elapsedTime}
        </div>
        {isVideoEffectTransitioning ? <div className="um-video-effect-mask" /> : null}
        <div className={`um-meeting-grid um-desktop-grid h-full min-h-0 ${desktopGridDensity}`}>
          {shouldShowLocalPreview && previewStream ? (
            <LocalPreviewTile
              participantName={participantName}
              stream={previewStream}
            />
          ) : null}
          {visibleDesktopTiles.map((tile) => renderMeetingTile(tile, raisedHands))}
        </div>
        <TilePagination
          currentPage={desktopPage}
          label="Paginas de videos"
          setCurrentPage={setDesktopPage}
          totalPages={desktopTotalPages}
          variant="desktop"
        />

        <div className="um-mobile-video-stage">
          {mobileTiles.length > 0 || shouldShowLocalPreview ? (
            <div className="um-meeting-grid um-mobile-grid h-full min-h-0">
              {shouldShowLocalPreview && previewStream ? (
                <LocalPreviewTile
                  participantName={participantName}
                  stream={previewStream}
                />
              ) : null}
              {visibleMobileTiles.map((tile) => renderMeetingTile(tile, raisedHands))}
            </div>
          ) : (
            <div className="um-mobile-empty-state">
              Aguardando outros participantes
            </div>
          )}
          <TilePagination
            currentPage={mobilePage}
            label="Paginas de videos no celular"
            setCurrentPage={setMobilePage}
            totalPages={mobileTotalPages}
            variant="mobile"
          />

          {localCameraTrack ? (
            <div className="um-local-pip">
              <MeetingParticipantTile
                handRaised={raisedHands[localCameraTrack.participant.identity]}
                trackRef={localCameraTrack}
              />
            </div>
          ) : null}
        </div>
      </div>

      <footer className="um-meeting-footer grid min-h-24 shrink-0 grid-cols-1 items-center gap-4 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:px-6">
        <div className="hidden min-w-0 md:block">
          <p className="flex min-w-0 items-center gap-2 truncate font-mono text-sm text-[#B8C7D9]">
            <RecordingIndicator status={recordingStatus} />
            <span className="truncate">
              {clock || "--:--"} | {elapsedTime} | {meetingId}
            </span>
            <button
              className="um-copy-link-button"
              type="button"
              aria-label="Copiar link da reuniao"
              title={copiedInviteLink ? "Link copiado" : "Copiar link da reuniao"}
              onClick={onCopyInviteLink}
            >
              <LinkIcon />
            </button>
          </p>
        </div>

        <MeetingControls
          canEndMeeting={canViewSalesPanel}
          customBackgroundName={customBackgroundName}
          customBackgroundUrl={customBackgroundUrl}
          onCustomBackgroundChange={onCustomBackgroundChange}
          onEndMeeting={onEndMeeting}
          onEffectTransitionChange={setIsVideoEffectTransitioning}
          onLeaveMeeting={onLeaveMeeting}
          setVideoEffect={setVideoEffect}
          isHandRaised={Boolean(raisedHands[room.localParticipant.identity]?.raised)}
          onToggleHand={toggleLocalHand}
          videoEffect={videoEffect}
        />

        <div className="hidden md:block" />
      </footer>

      <RoomAudioRenderer />
    </div>
  );
}

function MeetingControls({
  canEndMeeting,
  customBackgroundName,
  customBackgroundUrl,
  isHandRaised,
  onCustomBackgroundChange,
  onEndMeeting,
  onEffectTransitionChange,
  onLeaveMeeting,
  onToggleHand,
  setVideoEffect,
  videoEffect,
}: {
  canEndMeeting: boolean;
  customBackgroundName: string | null;
  customBackgroundUrl: string | null;
  isHandRaised: boolean;
  onCustomBackgroundChange: (file: File | null) => void;
  onEndMeeting: () => void | Promise<void>;
  onEffectTransitionChange: (isTransitioning: boolean) => void;
  onLeaveMeeting: () => void;
  onToggleHand: () => Promise<void> | void;
  setVideoEffect: (effect: VideoEffectMode) => void;
  videoEffect: VideoEffectMode;
}) {
  const {
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
    localParticipant,
  } = useLocalParticipant();
  const [isEffectsOpen, setIsEffectsOpen] = useState(false);
  const [effectStatus, setEffectStatus] = useState<string | null>(null);
  const [isLeaveMenuOpen, setIsLeaveMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let transitionTimer: number | undefined;

    async function applySelectedEffect() {
      if (!isCameraEnabled && videoEffect === "none") {
        return;
      }

      setEffectStatus(null);
      onEffectTransitionChange(true);

      try {
        await applyVideoEffectToLocalCamera({
          customBackgroundUrl,
          effect: videoEffect,
          localParticipant,
        });
      } catch (err) {
        if (!cancelled) {
          setEffectStatus(
            err instanceof Error ? err.message : "Nao foi possivel aplicar o efeito.",
          );
        }
      } finally {
        transitionTimer = window.setTimeout(() => {
          if (!cancelled) {
            onEffectTransitionChange(false);
          }
        }, 220);
      }
    }

    applySelectedEffect();

    return () => {
      cancelled = true;
      if (transitionTimer) {
        window.clearTimeout(transitionTimer);
      }
      onEffectTransitionChange(false);
    };
  }, [
    customBackgroundUrl,
    isCameraEnabled,
    localParticipant,
    onEffectTransitionChange,
    videoEffect,
  ]);

  return (
    <div className="um-controls-shell">
      {isEffectsOpen ? (
        <div className="um-effects-panel">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase text-[#4FC3F7]">
                Efeitos
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {videoEffectLabel(videoEffect)}
              </p>
            </div>
            <button
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white transition hover:border-[#4FC3F7] hover:bg-[#4FC3F7]/10"
              type="button"
              onClick={() => setIsEffectsOpen(false)}
            >
              Fechar
            </button>
          </div>
          <VideoEffectPicker
            customBackgroundName={customBackgroundName}
            onCustomImageChange={onCustomBackgroundChange}
            setVideoEffect={setVideoEffect}
            videoEffect={videoEffect}
          />
          {effectStatus ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
              {effectStatus}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="um-meeting-controls min-w-0" aria-label="Controles da reuniao">
        <button
          className={`um-control-button ${isMicrophoneEnabled ? "" : "is-off"}`}
          type="button"
          aria-label={isMicrophoneEnabled ? "Desligar microfone" : "Ligar microfone"}
          title={isMicrophoneEnabled ? "Desligar microfone" : "Ligar microfone"}
          onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        >
          <MicIcon muted={!isMicrophoneEnabled} />
        </button>
        <button
          className={`um-control-button ${isCameraEnabled ? "" : "is-off"}`}
          type="button"
          aria-label={isCameraEnabled ? "Desligar camera" : "Ligar camera"}
          title={isCameraEnabled ? "Desligar camera" : "Ligar camera"}
          onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
        >
          <CameraIcon off={!isCameraEnabled} />
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
          <ScreenShareIcon />
        </button>
        <button
          className={`um-control-button ${videoEffect !== "none" ? "is-on" : ""}`}
          type="button"
          aria-label="Abrir efeitos de video"
          title="Efeitos de video"
          onClick={() => setIsEffectsOpen((isOpen) => !isOpen)}
        >
          <EffectsIcon />
        </button>
        <button
          className={`um-control-button ${isHandRaised ? "is-on" : ""}`}
          type="button"
          aria-label={isHandRaised ? "Baixar mao" : "Levantar mao"}
          title={isHandRaised ? "Baixar mao" : "Levantar mao"}
          onClick={onToggleHand}
        >
          <HandRaisedIcon />
        </button>
        <div className="um-control-menu-wrap">
          <button
            className="um-control-button is-leave"
            type="button"
            aria-label="Sair ou encerrar reuniao"
            title="Sair ou encerrar"
            onClick={() => setIsLeaveMenuOpen((isOpen) => !isOpen)}
          >
            <LeaveIcon />
          </button>
          {isLeaveMenuOpen ? (
            <div className="um-control-dropdown is-leave-menu">
              <button
                type="button"
                onClick={() => {
                  setIsLeaveMenuOpen(false);
                  onLeaveMeeting();
                }}
              >
                <LeaveIcon />
                Sair
              </button>
              {canEndMeeting ? (
                <button
                  className="is-danger"
                  type="button"
                  onClick={() => {
                    setIsLeaveMenuOpen(false);
                    void onEndMeeting();
                  }}
                >
                  <LeaveIcon />
                  Encerrar
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type ChatMessage = {
  id: string;
  sender: string;
  senderRole?: ParticipantRole;
  content: string;
  createdAt: string;
  isLocal: boolean;
};

type ChatPayload = {
  type: "chat";
  id: string;
  sender: string;
  senderRole?: ParticipantRole;
  content: string;
  createdAt: string;
};

function EmptyPanelState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.03] px-5 py-8 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-full border border-[#4FC3F7]/30 bg-[#4FC3F7]/10 text-[#4FC3F7]">
        {icon}
      </div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-2 max-w-[240px] text-sm leading-6 text-[#8EA2BA]">
        {description}
      </p>
    </div>
  );
}

function MeetingChatPanel({
  connection,
  meetingId,
  participantName,
}: {
  connection: TokenResponse;
  meetingId: string;
  participantName: string;
}) {
  const room = useRoomContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMessages() {
      try {
        const response = await fetch(`${apiUrl}/meetings/${meetingId}/chat`, {
          headers: {
            Authorization: `Bearer ${connection.participant_access_token}`,
          },
        });
        if (!response.ok) {
          return;
        }

        const persistedMessages =
          (await response.json()) as MeetingChatMessageResponse[];
        if (cancelled) {
          return;
        }

        setMessages(
          persistedMessages.map((message) => ({
            id: `persisted-${message.id}`,
            sender: message.sender_name,
            senderRole: message.sender_role,
            content: message.content,
            createdAt: message.created_at,
            isLocal: message.sender_identity === room.localParticipant.identity,
          })),
        );
      } catch {
        // The live meeting chat keeps working through LiveKit even if history fails.
      }
    }

    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [connection.participant_access_token, meetingId, room.localParticipant.identity]);

  useEffect(() => {
    const decoder = new TextDecoder();

    function handleDataReceived(...args: unknown[]) {
      const payload = args[0] as Uint8Array;
      const participant = args[1] as
        | { identity?: string; name?: string }
        | undefined;
      const topic = typeof args[3] === "string" ? args[3] : undefined;

      if (topic && topic !== CHAT_TOPIC) {
        return;
      }

      try {
        const parsed = JSON.parse(decoder.decode(payload)) as ChatPayload;
        if (parsed.type !== "chat") {
          return;
        }

        setMessages((current) => {
          if (current.some((message) => message.id === parsed.id)) {
            return current;
          }

          return [
            ...current,
            {
              id: parsed.id,
              sender: parsed.sender || participant?.name || "Participante",
              senderRole: parsed.senderRole,
              content: parsed.content,
              createdAt: parsed.createdAt,
              isLocal: participant?.identity === room.localParticipant.identity,
            },
          ];
        });
      } catch {
        // Ignore data messages that are not part of the meeting chat.
      }
    }

    room.on(RoomEvent.DataReceived, handleDataReceived);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSendError(null);

    const content = draft.trim();
    if (!content) {
      return;
    }

    const message: ChatPayload = {
      type: "chat",
      id: crypto.randomUUID(),
      sender: participantName || room.localParticipant.name || "Participante",
      senderRole: connection.role,
      content,
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [
      ...current,
      {
        id: message.id,
        sender: message.sender,
        senderRole: message.senderRole,
        content: message.content,
        createdAt: message.createdAt,
        isLocal: true,
      },
    ]);
    setDraft("");

    try {
      const payload = new TextEncoder().encode(JSON.stringify(message));
      const publisher = room.localParticipant as unknown as {
        publishData: (
          data: Uint8Array,
          options?: { reliable?: boolean; topic?: string },
        ) => Promise<void> | void;
      };
      await publisher.publishData(payload, {
        reliable: true,
        topic: CHAT_TOPIC,
      });
      await fetch(`${apiUrl}/meetings/${meetingId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${connection.participant_access_token}`,
        },
        body: JSON.stringify({ content }),
      });
    } catch {
      setSendError("Nao foi possivel enviar a mensagem.");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <EmptyPanelState
            icon={<SendIcon />}
            title="A conversa escrita ainda nao comecou."
            description="Use este espaco para links, combinados rapidos e mensagens que precisam ficar no historico da reuniao."
          />
        ) : null}

        {messages.map((message) => (
          <article
            className={`rounded-lg border px-4 py-3 ${
              message.isLocal
                ? "border-[#4FC3F7]/45 bg-[#4FC3F7]/10"
                : "border-white/10 bg-white/5"
            }`}
            key={message.id}
          >
            <div className="mb-1 flex items-center justify-between gap-3">
              <p className="truncate text-sm font-semibold text-white">
                {message.sender}
              </p>
              {message.senderRole ? (
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#8EA2BA]">
                  {roleLabel(message.senderRole)}
                </span>
              ) : null}
              <time className="shrink-0 text-xs text-[#B8C7D9]">
                {new Date(message.createdAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-[#EAF6FF]">
              {message.content}
            </p>
          </article>
        ))}
      </div>

      <form
        className="border-t border-white/10 bg-[#05070B] p-4"
        onSubmit={sendMessage}
      >
        {sendError ? (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {sendError}
          </p>
        ) : null}
        <label className="block">
          <span className="sr-only">Mensagem</span>
          <div className="um-chat-compose">
            <textarea
              className="h-24 w-full resize-none bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-[#7D8CA3]"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Escreva uma mensagem..."
            />
            <div className="um-chat-compose-footer">
              <button
                className="um-chat-icon-button"
                type="button"
                aria-label="Adicionar arquivo"
                title="Adicionar arquivo"
                disabled
              >
                <PlusIcon />
              </button>
              <button
                className="um-chat-icon-button is-send"
                disabled={!draft.trim()}
                type="submit"
                aria-label="Enviar mensagem"
                title="Enviar mensagem"
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </label>
      </form>
    </div>
  );
}

function MeetingSidePanel({
  canViewSalesPanel,
  connection,
  isDesktopVisible,
  isMobileOpen,
  memoryItems,
  meetingId,
  onClose,
  participantName,
  recommendations,
  sidePanelTab,
  setSidePanelTab,
}: {
  canViewSalesPanel: boolean;
  connection: TokenResponse;
  isDesktopVisible: boolean;
  isMobileOpen: boolean;
  memoryItems: MeetingMemoryItem[];
  meetingId: string;
  onClose: () => void;
  participantName: string;
  recommendations: SalesRecommendation[];
  sidePanelTab: SidePanelTab;
  setSidePanelTab: (tab: SidePanelTab) => void;
}) {
  const [actionDraft, setActionDraft] = useState<string | null>(null);
  const activeTitle =
    sidePanelTab === "chat"
      ? "Conversa da reuniao"
      : sidePanelTab === "insights"
        ? "Insights privados"
        : "Memoria da reuniao";
  const activeKicker =
    sidePanelTab === "chat"
      ? "Conversa"
      : sidePanelTab === "insights"
        ? "Comercial"
        : "Memoria";

  function buildFollowUpText(card: SalesRecommendation) {
    return [
      `Follow-up sugerido: ${card.title}`,
      "",
      card.recommendation,
      "",
      `Evidencia: ${card.evidence}`,
    ].join("\n");
  }

  function buildTaskText(card: SalesRecommendation) {
    return [
      `Tarefa sugerida: tratar ${card.kind}`,
      "",
      card.title,
      card.recommendation,
    ].join("\n");
  }

  return (
    <aside
      className={`um-meeting-side-panel fixed inset-y-0 right-0 z-40 flex h-full w-full max-w-[360px] min-h-0 flex-col overflow-hidden border-l border-white/10 bg-[#070A10] text-white shadow-[0_24px_90px_rgba(0,0,0,0.45)] transition-transform duration-200 lg:static lg:z-auto lg:w-auto lg:max-w-none lg:translate-x-0 lg:shadow-none ${
        isMobileOpen ? "translate-x-0" : "translate-x-full"
      } ${isDesktopVisible ? "lg:flex" : "lg:hidden"}`}
    >
      <div className="border-b border-white/10 bg-[#070A10] px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#4FC3F7]">
              {activeKicker}
            </p>
            <h2 className="mt-1 text-lg font-semibold">{activeTitle}</h2>
          </div>
          <button
            className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/5 text-white transition hover:border-[#4FC3F7] hover:bg-[#4FC3F7]/10 lg:hidden"
            type="button"
            aria-label="Fechar painel"
            title="Fechar painel"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className="um-panel-tabs border-b border-white/10 bg-[#070A10] px-4 py-3">
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1">
          <button
            className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold transition ${
              sidePanelTab === "chat"
                ? "bg-[#4FC3F7] text-[#05070B] shadow-[0_0_18px_rgba(79,195,247,0.22)]"
                : "text-[#8EA2BA] hover:bg-white/5 hover:text-white"
            }`}
            type="button"
            onClick={() => setSidePanelTab("chat")}
          >
            <SendIcon />
            Conversa
          </button>
          {canViewSalesPanel ? (
            <button
              className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold transition ${
                sidePanelTab === "insights"
                  ? "bg-[#4FC3F7] text-[#05070B] shadow-[0_0_18px_rgba(79,195,247,0.22)]"
                  : "text-[#8EA2BA] hover:bg-white/5 hover:text-white"
              }`}
              type="button"
              onClick={() => setSidePanelTab("insights")}
            >
              <InsightIcon />
              Insights
            </button>
          ) : null}
          <button
            className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold transition ${
              sidePanelTab === "memory"
                ? "bg-[#4FC3F7] text-[#05070B] shadow-[0_0_18px_rgba(79,195,247,0.22)]"
                : "text-[#8EA2BA] hover:bg-white/5 hover:text-white"
            } ${canViewSalesPanel ? "" : "col-span-2"}`}
            type="button"
            onClick={() => setSidePanelTab("memory")}
          >
            <MemoryIcon />
            Memoria
          </button>
        </div>
      </div>

      {sidePanelTab === "chat" ? (
        <MeetingChatPanel
          connection={connection}
          meetingId={meetingId}
          participantName={participantName}
        />
      ) : null}

      {sidePanelTab === "insights" && canViewSalesPanel ? (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {recommendations.length === 0 ? (
            <EmptyPanelState
              icon={<InsightIcon />}
              title="Nenhum sinal comercial relevante ainda."
              description="Quando surgir objecao, risco ou oportunidade, o Coevo transforma isso em um card privado para Host e Comercial."
            />
          ) : (
            recommendations.map((card) => (
              <article
                className="rounded-xl border border-[#4FC3F7]/30 bg-[#07111A] px-4 py-4 shadow-[0_16px_44px_rgba(0,0,0,0.22)]"
                key={card.id}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">
                    {card.title}
                  </p>
                  <span className="shrink-0 rounded-sm bg-[#4FC3F7] px-2 py-1 text-xs font-medium text-[#05070B]">
                    {card.kind}
                  </span>
                </div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-wide text-[#8EA2BA]">
                    prioridade {card.severity}
                  </span>
                  <time className="text-xs text-[#6F8197]">
                    {new Date(card.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <p className="text-sm leading-6 text-[#EAF6FF]">
                  {card.recommendation}
                </p>
                <p className="mt-3 border-l-2 border-[#4FC3F7]/60 pl-3 text-xs leading-5 text-[#B8C7D9]">
                  {card.evidence}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    className="rounded-lg border border-[#4FC3F7]/30 bg-[#4FC3F7]/10 px-3 py-2 text-xs font-semibold text-[#DDF6FF] transition hover:border-[#4FC3F7] hover:bg-[#4FC3F7]/20"
                    type="button"
                    onClick={() => setActionDraft(buildFollowUpText(card))}
                  >
                    Follow-up
                  </button>
                  <button
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:border-[#4FC3F7] hover:bg-white/10"
                    type="button"
                    onClick={() => setActionDraft(buildTaskText(card))}
                  >
                    <span className="inline-flex items-center gap-1">
                      <TaskIcon />
                      Tarefa
                    </span>
                  </button>
                </div>
              </article>
            ))
          )}
          {actionDraft ? (
            <div className="rounded-xl border border-[#4FC3F7]/30 bg-[#4FC3F7]/10 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">Acao preparada</p>
                <button
                  className="text-xs font-semibold text-[#4FC3F7]"
                  type="button"
                  onClick={() => setActionDraft(null)}
                >
                  limpar
                </button>
              </div>
              <p className="whitespace-pre-wrap text-xs leading-5 text-[#DDF6FF]">
                {actionDraft}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {sidePanelTab === "memory" ? (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {memoryItems.length === 0 ? (
            <EmptyPanelState
              icon={<MemoryIcon />}
              title="Memoria ainda em formacao."
              description="Ao fim da reuniao, o Coevo organiza resumo, decisoes, proximos passos, riscos e promessas para consulta posterior."
            />
          ) : (
            memoryItems.map((item) => (
              <article
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4"
                key={item.id}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="rounded-full border border-[#4FC3F7]/30 px-2 py-1 text-[10px] uppercase tracking-wide text-[#BFEFFF]">
                    {item.memory_type.replaceAll("_", " ")}
                  </span>
                  <time className="text-xs text-[#6F8197]">
                    {new Date(item.created_at).toLocaleDateString("pt-BR")}
                  </time>
                </div>
                <p className="text-sm leading-6 text-[#EAF6FF]">{item.content}</p>
                {item.source_label ? (
                  <p className="mt-3 text-xs text-[#8EA2BA]">{item.source_label}</p>
                ) : null}
              </article>
            ))
          )}
        </div>
      ) : null}
    </aside>
  );
}

function RecordingStarter({
  connection,
  meetingId,
  onStatusChange,
}: {
  connection: TokenResponse;
  meetingId: string;
  onStatusChange: (status: RecordingStatus) => void;
}) {
  const room = useRoomContext();
  const hasRequestedRecording = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function syncRecordingStatus() {
      try {
        const response = await fetch(`${apiUrl}/meetings/${meetingId}/recordings`, {
          headers: {
            Authorization: `Bearer ${connection.participant_access_token}`,
          },
        });

        if (!response.ok) {
          return;
        }

        const recordings = (await response.json()) as MeetingRecording[];
        const nextStatus = deriveRecordingStatus(recordings);
        if (!cancelled && nextStatus) {
          onStatusChange(nextStatus);
        }
      } catch {
        // The starter request below already reports hard failures. Polling is best effort.
      }
    }

    function requestRecording() {
      if (connection.role !== "host" && connection.role !== "commercial") {
        void syncRecordingStatus();
        return;
      }

      if (hasRequestedRecording.current) {
        return;
      }

      hasRequestedRecording.current = true;
      onStatusChange("starting");
      void fetch(`${apiUrl}/meetings/${meetingId}/recording/start`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${connection.participant_access_token}`,
        },
      })
        .then(async (response) => {
          if (!response.ok) {
            onStatusChange("failed");
            return;
          }

          const payload = (await response.json()) as RecordingStartResponse;
          const statusFromRecording = payload.recording
            ? deriveRecordingStatus([payload.recording])
            : null;
          onStatusChange(
            statusFromRecording ??
              (payload.started || payload.configured ? "starting" : "failed"),
          );
          void syncRecordingStatus();
        })
        .catch(() => {
          onStatusChange("failed");
        });
    }

    if (room.state === "connected") {
      requestRecording();
    }

    room.on(RoomEvent.Connected, requestRecording);
    void syncRecordingStatus();
    const intervalId = window.setInterval(syncRecordingStatus, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      room.off(RoomEvent.Connected, requestRecording);
    };
  }, [connection, meetingId, onStatusChange, room]);

  return null;
}

function JoinRequestsHostPanel({
  connection,
  meetingId,
}: {
  connection: TokenResponse;
  meetingId: string;
}) {
  const [requests, setRequests] = useState<MeetingJoinRequest[]>([]);
  const [busyRequestId, setBusyRequestId] = useState<number | null>(null);

  useEffect(() => {
    if (connection.role !== "host" && connection.role !== "commercial") {
      return;
    }

    let cancelled = false;

    async function loadRequests() {
      try {
        const response = await fetch(
          `${apiUrl}/meetings/${meetingId}/join-requests?status_filter=pending`,
          {
            headers: {
              Authorization: `Bearer ${connection.participant_access_token}`,
            },
          },
        );

        if (!response.ok) {
          return;
        }

        const nextRequests = (await response.json()) as MeetingJoinRequest[];
        if (!cancelled) {
          setRequests(nextRequests);
        }
      } catch {
        // Admission polling should not disturb the meeting.
      }
    }

    loadRequests();
    const interval = window.setInterval(loadRequests, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [connection, meetingId]);

  async function decideRequest(requestId: number, status: "approved" | "denied") {
    setBusyRequestId(requestId);
    try {
      const response = await fetch(
        `${apiUrl}/meetings/${meetingId}/join-requests/${requestId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${connection.participant_access_token}`,
          },
          body: JSON.stringify({ status }),
        },
      );

      if (response.ok) {
        setRequests((current) =>
          current.filter((request) => request.id !== requestId),
        );
      }
    } finally {
      setBusyRequestId(null);
    }
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <div className="absolute left-1/2 top-4 z-30 w-[min(92vw,520px)] -translate-x-1/2 rounded-xl border border-[#4FC3F7]/35 bg-[#070A10]/95 p-3 text-white shadow-[0_0_44px_rgba(79,195,247,0.18)] backdrop-blur-xl">
      <p className="px-1 font-mono text-xs uppercase text-[#4FC3F7]">
        Sala de espera
      </p>
      <div className="mt-2 space-y-2">
        {requests.map((request) => (
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
            key={request.id}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">
                {request.name}
              </p>
              <p className="truncate text-xs text-[#B8C7D9]">
                {request.email}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white transition hover:border-red-300 hover:bg-red-500/10 disabled:opacity-60"
                type="button"
                disabled={busyRequestId === request.id}
                onClick={() => decideRequest(request.id, "denied")}
              >
                Recusar
              </button>
              <button
                className="rounded-lg bg-[#4FC3F7] px-3 py-2 text-xs font-bold text-[#05070B] transition hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(79,195,247,0.35)] disabled:opacity-60"
                type="button"
                disabled={busyRequestId === request.id}
                onClick={() => decideRequest(request.id, "approved")}
              >
                Permitir
              </button>
            </div>
          </div>
        ))}
      </div>
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
  const [recommendations, setRecommendations] = useState<SalesRecommendation[]>(
    [],
  );
  const [memoryItems, setMemoryItems] = useState<MeetingMemoryItem[]>([]);
  const [sidePanelTab, setSidePanelTab] = useState<SidePanelTab>("chat");
  const [isDesktopSidePanelVisible, setIsDesktopSidePanelVisible] = useState(true);
  const [isMobileSidePanelOpen, setIsMobileSidePanelOpen] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitingJoinRequestId, setWaitingJoinRequestId] = useState<number | null>(
    null,
  );
  const [waitingMessage, setWaitingMessage] = useState<string | null>(null);
  const [recordingStatus, setRecordingStatus] =
    useState<RecordingStatus>("idle");
  const [isHostCreator, setIsHostCreator] = useState<boolean | null>(null);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [videoEffect, setVideoEffect] = useState<VideoEffectMode>("none");
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState<string | null>(
    null,
  );
  const [customBackgroundName, setCustomBackgroundName] = useState<string | null>(
    null,
  );
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const preservePreviewStreamRef = useRef(false);
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

  function handleCustomBackgroundChange(file: File | null) {
    if (!file) {
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setCustomBackgroundUrl(nextUrl);
    setCustomBackgroundName(file.name);
    setVideoEffect("image");
  }

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
        let stream: MediaStream;
        stream = await navigator.mediaDevices.getUserMedia({ video: true });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        previewStreamRef.current = stream;
        setPreviewStream(stream);
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
      if (preservePreviewStreamRef.current) {
        preservePreviewStreamRef.current = false;
        return;
      }

      previewStreamRef.current?.getTracks().forEach((track) => track.stop());
      previewStreamRef.current = null;
      setPreviewStream(null);
    };
  }, [step]);

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

  useEffect(() => {
    if (step !== "room" || !connection) {
      return;
    }

    let cancelled = false;
    const participantAccessToken = connection.participant_access_token;

    async function loadMemory() {
      try {
        const response = await fetch(`${apiUrl}/meetings/${meetingId}/memory`, {
          headers: {
            Authorization: `Bearer ${participantAccessToken}`,
          },
        });

        if (!response.ok) {
          return;
        }

        const items = (await response.json()) as MeetingMemoryItem[];
        if (!cancelled) {
          setMemoryItems(items.slice(0, 12));
        }
      } catch {
        // Memory may still be processing; keep the meeting UI calm.
      }
    }

    loadMemory();
    const interval = window.setInterval(loadMemory, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [connection, meetingId, step]);

  useEffect(() => {
    return () => {
      if (customBackgroundUrl) {
        URL.revokeObjectURL(customBackgroundUrl);
      }
    };
  }, [customBackgroundUrl]);

  async function joinMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setWaitingMessage(null);

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
      if (tokenResponse.awaiting_approval && tokenResponse.join_request_id) {
        setWaitingJoinRequestId(tokenResponse.join_request_id);
        setWaitingMessage("Aguardando o Host permitir sua entrada.");
        return;
      }

      preservePreviewStreamRef.current = true;
      setConnection(tokenResponse);
      setStep("room");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setIsJoining(false);
    }
  }

  const requestRoomTokenAfterApproval = useCallback(async () => {
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
    if (tokenResponse.awaiting_approval) {
      return;
    }

    preservePreviewStreamRef.current = true;
    setConnection(tokenResponse);
    setWaitingJoinRequestId(null);
    setWaitingMessage(null);
    setStep("room");
  }, [acceptedLgpd, inferredRole, meetingId, participant.email, participant.name]);

  useEffect(() => {
    if (!waitingJoinRequestId) {
      return;
    }

    let cancelled = false;

    async function pollApproval() {
      try {
        const response = await fetch(
          `${apiUrl}/meetings/${meetingId}/join-requests/${waitingJoinRequestId}`,
        );

        if (!response.ok) {
          return;
        }

        const joinRequest = (await response.json()) as MeetingJoinRequest;
        if (cancelled) {
          return;
        }

        if (joinRequest.status === "approved") {
          setWaitingMessage("Entrada aprovada. Conectando...");
          await requestRoomTokenAfterApproval();
        } else if (joinRequest.status === "denied") {
          setWaitingJoinRequestId(null);
          setWaitingMessage(null);
          setError("Sua entrada foi recusada pelo Host.");
        }
      } catch {
        // Keep waiting; the next polling cycle can recover.
      }
    }

    pollApproval();
    const interval = window.setInterval(pollApproval, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [meetingId, requestRoomTokenAfterApproval, waitingJoinRequestId]);

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
    setPreviewStream(null);
  }

  function goBackHome() {
    stopPreview();
    router.push("/");
  }

  async function endMeeting(currentConnection = connection) {
    if (
      !currentConnection ||
      (currentConnection.role !== "host" && currentConnection.role !== "commercial")
    ) {
      return;
    }

    await fetch(`${apiUrl}/meetings/${meetingId}/end`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${currentConnection.participant_access_token}`,
      },
    });
  }

  function leaveMeeting() {
    stopPreview();
    setConnection(null);
    setStep("lobby");
    router.push("/coevo-meet?ended=true");
  }

  async function endMeetingAndLeave() {
    const shouldEnd = window.confirm(
      "Encerrar a reuniao para todos os participantes?",
    );
    if (!shouldEnd) {
      return;
    }

    try {
      await endMeeting();
    } catch {
      setError("Nao foi possivel encerrar a reuniao agora.");
      return;
    }

    setConnection(null);
    setStep("lobby");
    router.push("/coevo-meet?ended=true");
  }

  if (step === "room" && connection) {
    return (
        <LiveKitRoom
          audio
          video={!previewStream || previewStream.getVideoTracks().length === 0}
          token={connection.token}
          serverUrl={connection.url}
          data-lk-theme="default"
          className={`um-room-shell h-screen overflow-hidden bg-[#05070B] text-white [height:100dvh] ${
            isDesktopSidePanelVisible ? "" : "is-panel-hidden"
          }`}
          onDisconnected={leaveMeeting}
        >
          <RecordingStarter
            connection={connection}
            meetingId={meetingId}
            onStatusChange={setRecordingStatus}
          />
          <PreviewTrackPublisher
            previewStream={previewStream}
            onPublished={() => setPreviewStream(null)}
          />
          <section className="relative h-full min-h-0 overflow-hidden">
            <JoinRequestsHostPanel connection={connection} meetingId={meetingId} />
            <MeetingGrid
              canViewSalesPanel={canViewSalesPanel}
              copiedInviteLink={copiedInviteLink}
              customBackgroundName={customBackgroundName}
              customBackgroundUrl={customBackgroundUrl}
              isDesktopSidePanelVisible={isDesktopSidePanelVisible}
              meetingId={meetingId}
              onCopyInviteLink={copyInviteLink}
              onCustomBackgroundChange={handleCustomBackgroundChange}
              onEndMeeting={endMeetingAndLeave}
              onLeaveMeeting={leaveMeeting}
              participantName={participant.name}
              previewStream={previewStream}
              recordingStatus={recordingStatus}
              setVideoEffect={setVideoEffect}
              setIsDesktopSidePanelVisible={setIsDesktopSidePanelVisible}
              videoEffect={videoEffect}
            />
          </section>

          <MeetingSidePanel
            canViewSalesPanel={canViewSalesPanel}
            connection={connection}
            isDesktopVisible={isDesktopSidePanelVisible}
            isMobileOpen={isMobileSidePanelOpen}
            memoryItems={memoryItems}
            meetingId={meetingId}
            onClose={() => setIsMobileSidePanelOpen(false)}
            participantName={participant.name}
            recommendations={recommendations}
            sidePanelTab={sidePanelTab}
            setSidePanelTab={setSidePanelTab}
          />
        </LiveKitRoom>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-5 py-10 text-[#11110F]">
      <video
        ref={previewVideoRef}
        autoPlay
        muted
        playsInline
        className={`absolute inset-0 h-full w-full scale-x-[-1] object-cover opacity-20 grayscale ${
          videoEffect === "blur" ? "blur-sm" : ""
        }`}
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

        <section className="mt-4 rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase text-[#F97316]">
                Efeitos de video
              </p>
              <p className="mt-1 text-sm font-semibold text-[#11110F]">
                {videoEffectLabel(videoEffect)}
              </p>
            </div>
            <span className="rounded-full border border-[#E7E7E2] bg-white px-3 py-1 font-mono text-xs uppercase text-[#73736B]">
              Camera local
            </span>
          </div>
          <VideoEffectPicker
            customBackgroundName={customBackgroundName}
            onCustomImageChange={handleCustomBackgroundChange}
            setVideoEffect={setVideoEffect}
            videoEffect={videoEffect}
          />
        </section>

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

        {waitingMessage ? (
          <div className="mt-4 rounded-lg border border-[#FDBA74] bg-[#FFF3EA] px-4 py-3">
            <p className="font-mono text-xs uppercase text-[#F97316]">
              Sala de espera
            </p>
            <p className="mt-1 text-sm font-semibold text-[#11110F]">
              {waitingMessage}
            </p>
            <p className="mt-1 text-xs leading-5 text-[#73736B]">
              Mantenha esta tela aberta. Assim que o Host liberar, voce entra
              automaticamente.
            </p>
          </div>
        ) : null}

        <div className="mt-6 flex justify-end">
          <button
            className="rounded-lg bg-[#11110F] px-6 py-3 font-bold text-white shadow-[0_20px_70px_rgba(249,115,22,0.22)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={
              isJoining ||
              Boolean(waitingJoinRequestId) ||
              !acceptedLgpd ||
              !entryContextReady
            }
            type="submit"
          >
            {waitingJoinRequestId
              ? "Aguardando permissao..."
              : isJoining
                ? "Entrando..."
                : "Entrar na sala"}
          </button>
        </div>
      </form>
    </main>
  );
}
