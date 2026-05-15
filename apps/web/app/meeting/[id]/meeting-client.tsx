"use client";

import {
  type ComponentProps,
  type Dispatch,
  FormEvent,
  type SetStateAction,
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
type SidePanelTab = "chat" | "sales";
type VideoEffectMode = "none" | "blur" | "coevo" | "image";

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
      className="h-4 w-4"
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
      className="h-5 w-5"
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
      className="h-5 w-5"
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
      className="h-5 w-5"
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
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M6.2 17.8 17.8 6.2M8.2 5.2l.55 1.4 1.4.55-1.4.55-.55 1.4-.55-1.4-1.4-.55 1.4-.55.55-1.4ZM16.5 14.5l.75 1.9 1.9.75-1.9.75-.75 1.9-.75-1.9-1.9-.75 1.9-.75.75-1.9Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

function LeaveIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M7.5 14.5c3 2.6 6 2.6 9 0l1.4-1.2a1.7 1.7 0 0 0 .1-2.4l-1-1a1.7 1.7 0 0 0-2.2-.2l-1.2.8a1.7 1.7 0 0 1-1.9 0l-1.2-.8a1.7 1.7 0 0 0-2.2.2l-1 1a1.7 1.7 0 0 0 .1 2.4l1.1 1.2Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M5.5 6.2A2.2 2.2 0 0 1 7.7 4h8.6a2.2 2.2 0 0 1 2.2 2.2v6.5a2.2 2.2 0 0 1-2.2 2.2h-4.7L7.2 19v-4.1A2.2 2.2 0 0 1 5.5 12.7V6.2Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M8.7 8.1h6.6M8.7 11.1h4.4"
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
      className="h-5 w-5"
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

function FullscreenIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
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
    <div className="absolute right-4 top-16 z-10 rounded-2xl border border-[#E7E7E2] bg-white/92 px-4 py-3 shadow-[0_18px_70px_rgba(17,17,15,0.12)] backdrop-blur-xl sm:right-6 sm:top-20">
      <div className="flex items-center gap-3">
        <AgentOrb isSpeaking={Boolean(agent.isSpeaking)} />
        <div>
          <p className="text-sm font-semibold text-[#11110F]">Coevo</p>
          <p className="text-xs text-[#73736B]">
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
  customBackgroundName,
  customBackgroundUrl,
  meetingId,
  onCustomBackgroundChange,
  setVideoEffect,
  videoEffect,
}: {
  customBackgroundName: string | null;
  customBackgroundUrl: string | null;
  meetingId: string;
  onCustomBackgroundChange: (file: File | null) => void;
  setVideoEffect: (effect: VideoEffectMode) => void;
  videoEffect: VideoEffectMode;
}) {
  const room = useRoomContext();
  const [clock, setClock] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [desktopPage, setDesktopPage] = useState(0);
  const [mobilePage, setMobilePage] = useState(0);
  const [raisedHands, setRaisedHands] = useState<Record<string, RaisedHandState>>({});
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
    <div className="um-meeting-layout flex h-full min-h-0 flex-col bg-white">
      <div className="um-video-stage-shell min-h-0 flex-1 px-4 pb-3 pt-16 sm:px-6 sm:pt-20">
        <AgentPresence />
        <div className="absolute left-4 top-16 z-10 rounded-full border border-[#E7E7E2] bg-white/92 px-3 py-2 font-mono text-xs font-semibold text-[#11110F] shadow-[0_18px_70px_rgba(17,17,15,0.08)] backdrop-blur-xl sm:left-6 sm:top-20">
          {elapsedTime}
        </div>
        <div
          className={`um-meeting-grid um-desktop-grid h-full min-h-0 ${desktopGridDensity}`}
        >
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
          {mobileTiles.length > 0 ? (
            <div className="um-meeting-grid um-mobile-grid h-full min-h-0">
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

      <footer className="um-meeting-footer grid min-h-24 shrink-0 grid-cols-1 items-center gap-4 border-t border-[#E7E7E2] bg-white px-4 py-4 text-[#11110F] md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:px-6">
        <div className="hidden min-w-0 md:block">
          <p className="truncate font-mono text-sm text-[#73736B]">
            {clock || "--:--"} | {elapsedTime} | {meetingId}
          </p>
        </div>

        <MeetingControls
          customBackgroundName={customBackgroundName}
          customBackgroundUrl={customBackgroundUrl}
          onCustomBackgroundChange={onCustomBackgroundChange}
          setVideoEffect={setVideoEffect}
          isHandRaised={Boolean(raisedHands[room.localParticipant.identity]?.raised)}
          onToggleHand={toggleLocalHand}
          videoEffect={videoEffect}
        />

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

function MeetingControls({
  customBackgroundName,
  customBackgroundUrl,
  isHandRaised,
  onCustomBackgroundChange,
  onToggleHand,
  setVideoEffect,
  videoEffect,
}: {
  customBackgroundName: string | null;
  customBackgroundUrl: string | null;
  isHandRaised: boolean;
  onCustomBackgroundChange: (file: File | null) => void;
  onToggleHand: () => Promise<void> | void;
  setVideoEffect: (effect: VideoEffectMode) => void;
  videoEffect: VideoEffectMode;
}) {
  const room = useRoomContext();
  const {
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
    localParticipant,
  } = useLocalParticipant();
  const [isEffectsOpen, setIsEffectsOpen] = useState(false);
  const [effectStatus, setEffectStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function applySelectedEffect() {
      if (!isCameraEnabled && videoEffect === "none") {
        return;
      }

      setEffectStatus(null);

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
      }
    }

    applySelectedEffect();

    return () => {
      cancelled = true;
    };
  }, [customBackgroundUrl, isCameraEnabled, localParticipant, videoEffect]);

  return (
    <div className="um-controls-shell">
      {isEffectsOpen ? (
        <div className="um-effects-panel">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase text-[#F97316]">
                Efeitos
              </p>
              <p className="mt-1 text-sm font-semibold text-[#11110F]">
                {videoEffectLabel(videoEffect)}
              </p>
            </div>
            <button
              className="rounded-lg border border-[#E7E7E2] bg-white px-3 py-2 text-xs font-bold text-[#11110F] transition hover:border-[#F97316] hover:bg-[#FFF3EA]"
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
        <button
          className="um-control-button is-leave"
          type="button"
          aria-label="Sair da reuniao"
          title="Sair da reuniao"
          onClick={() => room.disconnect()}
        >
          <LeaveIcon />
        </button>
      </div>
    </div>
  );
}

type ChatMessage = {
  id: string;
  sender: string;
  content: string;
  createdAt: string;
  isLocal: boolean;
};

type ChatPayload = {
  type: "chat";
  id: string;
  sender: string;
  content: string;
  createdAt: string;
};

function MeetingChatPanel({ participantName }: { participantName: string }) {
  const room = useRoomContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);

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
      content,
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [
      ...current,
      {
        id: message.id,
        sender: message.sender,
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
    } catch {
      setSendError("Nao foi possivel enviar a mensagem.");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <p className="text-sm leading-6 text-[#73736B]">
            Use o chat para mensagens escritas durante a reuniao. A transcricao
            continua sendo processada em segundo plano pelo Coevo.
          </p>
        ) : null}

        {messages.map((message) => (
          <article
            className={`rounded-lg border px-4 py-3 ${
              message.isLocal
                ? "border-[#FDBA74] bg-[#FFF3EA]"
                : "border-[#E7E7E2] bg-white"
            }`}
            key={message.id}
          >
            <div className="mb-1 flex items-center justify-between gap-3">
              <p className="truncate text-sm font-semibold text-[#11110F]">
                {message.sender}
              </p>
              <time className="shrink-0 text-xs text-[#73736B]">
                {new Date(message.createdAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-[#383832]">
              {message.content}
            </p>
          </article>
        ))}
      </div>

      <form
        className="border-t border-[#E7E7E2] bg-white p-4"
        onSubmit={sendMessage}
      >
        {sendError ? (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {sendError}
          </p>
        ) : null}
        <label className="block">
          <span className="sr-only">Mensagem</span>
          <textarea
            className="h-24 w-full resize-none rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] px-4 py-3 text-sm text-[#11110F] outline-none transition placeholder:text-[#73736B] focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/15"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Escreva uma mensagem..."
          />
        </label>
        <div className="mt-3 flex justify-end">
          <button
            className="rounded-lg bg-[#11110F] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#F97316] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!draft.trim()}
            type="submit"
          >
            Enviar
          </button>
        </div>
      </form>
    </div>
  );
}

function MeetingSidePanel({
  canViewSalesPanel,
  isDesktopVisible,
  isMobileOpen,
  onClose,
  participantName,
  recommendations,
  sidePanelTab,
  setSidePanelTab,
}: {
  canViewSalesPanel: boolean;
  isDesktopVisible: boolean;
  isMobileOpen: boolean;
  onClose: () => void;
  participantName: string;
  recommendations: SalesRecommendation[];
  sidePanelTab: SidePanelTab;
  setSidePanelTab: (tab: SidePanelTab) => void;
}) {
  return (
    <aside
      className={`fixed inset-y-0 right-0 z-40 flex h-full w-full max-w-[360px] min-h-0 flex-col overflow-hidden border-l border-[#E7E7E2] bg-[#FCFCFB] text-[#11110F] shadow-[0_24px_90px_rgba(17,17,15,0.18)] transition-transform duration-200 lg:static lg:z-auto lg:w-auto lg:max-w-none lg:translate-x-0 lg:shadow-none ${
        isMobileOpen ? "translate-x-0" : "translate-x-full"
      } ${isDesktopVisible ? "lg:flex" : "lg:hidden"}`}
    >
      <div className="border-b border-[#E7E7E2] bg-white px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#F97316]">
              Conversa
            </p>
            <h2 className="mt-1 text-lg font-semibold">Chat da reuniao</h2>
          </div>
          <button
            className="grid h-10 w-10 place-items-center rounded-lg border border-[#E7E7E2] bg-white text-[#11110F] transition hover:border-[#F97316] hover:bg-[#FFF3EA] lg:hidden"
            type="button"
            aria-label="Fechar painel"
            title="Fechar painel"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className="flex border-b border-[#E7E7E2] bg-white">
        <button
          className={`border-b-2 px-5 py-3 text-sm font-medium ${
            sidePanelTab === "chat"
              ? "border-[#F97316] text-[#11110F]"
              : "border-transparent text-[#73736B] hover:text-[#11110F]"
          }`}
          type="button"
          onClick={() => setSidePanelTab("chat")}
        >
          Chat
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

      {sidePanelTab === "chat" ? (
        <MeetingChatPanel participantName={participantName} />
      ) : null}

      {sidePanelTab === "sales" && canViewSalesPanel ? (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {recommendations.length === 0 ? (
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
          )}
        </div>
      ) : null}
    </aside>
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
  const [sidePanelTab, setSidePanelTab] = useState<SidePanelTab>("chat");
  const [isDesktopSidePanelVisible, setIsDesktopSidePanelVisible] = useState(true);
  const [isMobileSidePanelOpen, setIsMobileSidePanelOpen] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHostCreator, setIsHostCreator] = useState<boolean | null>(null);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [videoEffect, setVideoEffect] = useState<VideoEffectMode>("none");
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState<string | null>(
    null,
  );
  const [customBackgroundName, setCustomBackgroundName] = useState<string | null>(
    null,
  );
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
    return () => {
      if (customBackgroundUrl) {
        URL.revokeObjectURL(customBackgroundUrl);
      }
    };
  }, [customBackgroundUrl]);

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

  function endMeetingIfGatekeeper(currentConnection = connection) {
    if (
      !currentConnection ||
      (currentConnection.role !== "host" && currentConnection.role !== "commercial")
    ) {
      return;
    }

    void fetch(`${apiUrl}/meetings/${meetingId}/end`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${currentConnection.participant_access_token}`,
      },
      keepalive: true,
    }).catch(() => {
      // Leaving the room should not be blocked if the expiration ping fails.
    });
  }

  function leaveMeeting() {
    endMeetingIfGatekeeper();
    setConnection(null);
    setStep("lobby");
    router.push("/coevo-meet?ended=true");
  }

  useEffect(() => {
    if (step !== "room" || !connection) {
      return;
    }

    function handlePageHide() {
      endMeetingIfGatekeeper(connection);
    }

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [connection, meetingId, step]);

  if (step === "room" && connection) {
    return (
        <LiveKitRoom
          audio
          video
          token={connection.token}
          serverUrl={connection.url}
          data-lk-theme="default"
          className={`um-room-shell h-screen overflow-hidden bg-white text-[#11110F] [height:100dvh] ${
            isDesktopSidePanelVisible ? "" : "is-panel-hidden"
          }`}
          onDisconnected={leaveMeeting}
        >
          <section className="relative h-full min-h-0 overflow-hidden">
            <button
              className="absolute left-4 top-4 z-20 grid h-11 w-11 place-items-center rounded-lg border border-[#E7E7E2] bg-white/90 text-[#11110F] shadow-[0_18px_70px_rgba(17,17,15,0.07)] backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-[#F97316] hover:bg-[#FFF3EA]"
              type="button"
              aria-label="Sair da reuniao"
              title="Sair da reuniao"
              onClick={leaveMeeting}
            >
              <LeaveIcon />
            </button>
            <button
              className="absolute right-4 top-4 z-20 grid h-11 w-11 place-items-center rounded-lg border border-[#E7E7E2] bg-white/90 text-[#11110F] shadow-[0_18px_70px_rgba(17,17,15,0.07)] backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-[#F97316] hover:bg-[#FFF3EA] lg:hidden"
              type="button"
              aria-label="Abrir chat"
              title="Abrir chat"
              onClick={() => setIsMobileSidePanelOpen(true)}
            >
              <ChatIcon />
            </button>
            <button
              className="absolute right-4 top-4 z-20 hidden h-11 w-11 items-center justify-center rounded-lg border border-[#E7E7E2] bg-white/90 text-[#11110F] shadow-[0_18px_70px_rgba(17,17,15,0.07)] backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-[#F97316] hover:bg-[#FFF3EA] lg:flex"
              type="button"
              aria-label={
                isDesktopSidePanelVisible ? "Ocultar painel" : "Mostrar painel"
              }
              title={
                isDesktopSidePanelVisible ? "Ocultar painel" : "Mostrar painel"
              }
              onClick={() =>
                setIsDesktopSidePanelVisible((isVisible) => !isVisible)
              }
            >
              <span
                className={`um-panel-toggle-icon ${
                  isDesktopSidePanelVisible ? "is-open" : "is-closed"
                }`}
                aria-hidden="true"
              />
            </button>
            <MeetingGrid
              customBackgroundName={customBackgroundName}
              customBackgroundUrl={customBackgroundUrl}
              meetingId={meetingId}
              onCustomBackgroundChange={handleCustomBackgroundChange}
              setVideoEffect={setVideoEffect}
              videoEffect={videoEffect}
            />
          </section>

          <MeetingSidePanel
            canViewSalesPanel={canViewSalesPanel}
            isDesktopVisible={isDesktopSidePanelVisible}
            isMobileOpen={isMobileSidePanelOpen}
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
