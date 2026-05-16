"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Section = "meetings" | "memory" | "coevo" | "knowledge" | "leads" | "users";
type CoevoConfigTab =
  | "identity"
  | "voice"
  | "behavior"
  | "actions"
  | "integrations"
  | "language";
type AgentGender = "masculine" | "feminine" | "neutral";
type WeeklyMeetingVolume = "ate-5" | "5-10" | "10-20" | "mais-20";
type ParticipantRole = "host" | "commercial" | "client" | "observer";
type AgentAction = "send_email" | "schedule_meeting" | "web_search";
type AgentIntegration = "resend_email" | "google_calendar" | "web_search";
type AgentVoice =
  | "alloy"
  | "ash"
  | "ballad"
  | "coral"
  | "echo"
  | "sage"
  | "shimmer"
  | "verse"
  | "marin"
  | "cedar";

type AgentProfile = {
  name: string;
  gender: AgentGender;
  voice: AgentVoice;
  tone: string;
  formality: number;
  energy: number;
  empathy: number;
  assertiveness: number;
  brevity: number;
  keywords: string[];
  avoid_words: string[];
  behavior_tags: string[];
  sales_method: string;
  language_policy: string;
  custom_instructions: string;
  voice_command_roles: ParticipantRole[];
  enabled_actions: AgentAction[];
  enabled_integrations: AgentIntegration[];
  require_voice_confirmation: boolean;
  updated_at?: string | null;
};

type MeetingListItem = {
  id: string;
  title: string;
  owner: string;
  dateLabel: string;
  role: string;
};

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
  phone: string;
  corporate_email: string;
  company_name: string;
  weekly_meeting_volume: WeeklyMeetingVolume;
  selected_plan?: string | null;
  source: string;
  created_at: string;
};

type LeadForm = {
  fullName: string;
  phone: string;
  corporateEmail: string;
  companyName: string;
  weeklyMeetingVolume: WeeklyMeetingVolume;
  selectedPlan: string;
};

type GoogleCalendarStatus = {
  configured: boolean;
  connected: boolean;
  calendar_email?: string | null;
  updated_at?: string | null;
  auth_url?: string | null;
};

type ConversationSession = {
  id: string;
  title: string;
  channel: string;
  user_name: string;
  updated_at: string;
  context_scope: Record<string, string>;
};

type ConversationMessage = {
  id: number;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

type MemorySearchResult = {
  id: number;
  meeting_id: string;
  meeting_title?: string | null;
  memory_type: string;
  content: string;
  score: number;
};

type AppUser = {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
  created_at: string;
};

type AuthForm = {
  name: string;
  email: string;
  password: string;
};

type UserForm = AuthForm & {
  isAdmin: boolean;
};

const defaultSessionUser: AppUser = {
  id: 0,
  name: "Acesso local",
  email: "Login pendente",
  is_admin: false,
  created_at: new Date(0).toISOString(),
};

const invitedMeetings: MeetingListItem[] = [];

const emptyLeadForm: LeadForm = {
  fullName: "",
  phone: "",
  corporateEmail: "",
  companyName: "",
  weeklyMeetingVolume: "ate-5",
  selectedPlan: "Teste Gratis",
};

const emptyAuthForm: AuthForm = {
  name: "",
  email: "",
  password: "",
};

const emptyUserForm: UserForm = {
  name: "",
  email: "",
  password: "",
  isAdmin: false,
};

const defaultProfile: AgentProfile = {
  name: "Coevo",
  gender: "masculine",
  voice: "marin",
  tone: "consultivo",
  formality: 68,
  energy: 48,
  empathy: 74,
  assertiveness: 58,
  brevity: 70,
  keywords: ["clareza", "objetividade", "contexto", "proximo passo"],
  avoid_words: ["talvez", "acho", "impossivel"],
  behavior_tags: ["consultivo", "calmo", "direto"],
  sales_method: "consultivo",
  language_policy: "Responder sempre na mesma lingua usada pelo participante.",
  custom_instructions: "",
  voice_command_roles: ["host"],
  enabled_actions: ["send_email", "schedule_meeting", "web_search"],
  enabled_integrations: ["resend_email", "google_calendar", "web_search"],
  require_voice_confirmation: true,
};

const toneOptions = ["consultivo", "executivo", "acolhedor", "didatico", "provocativo"];
const salesMethods = ["consultivo", "SPIN", "MEDDIC", "BANT", "Challenger"];
const languagePolicies = [
  "Responder sempre na mesma lingua usada pelo participante.",
  "Priorizar portugues do Brasil, exceto quando o participante falar outro idioma.",
  "Manter respostas curtas e confirmar antes de traduzir.",
];
const weeklyMeetingVolumeOptions: Array<{
  value: WeeklyMeetingVolume;
  label: string;
}> = [
  { value: "ate-5", label: "Ate 5" },
  { value: "5-10", label: "5 a 10" },
  { value: "10-20", label: "10 a 20" },
  { value: "mais-20", label: "+20" },
];
const planOptions = ["Teste Gratis", "Essencial", "Business", "Enterprise"];
const commandRoleOptions: Array<{ value: ParticipantRole; label: string }> = [
  { value: "host", label: "Host" },
  { value: "commercial", label: "Comercial" },
  { value: "client", label: "Participante" },
  { value: "observer", label: "Observador" },
];
const actionOptions: Array<{ value: AgentAction; label: string; description: string }> = [
  {
    value: "send_email",
    label: "Enviar e-mails",
    description: "Resumo, follow-up, proximos passos e mensagens aos participantes.",
  },
  {
    value: "schedule_meeting",
    label: "Agendar reunioes",
    description: "Cria eventos no Google Agenda depois da confirmacao por voz.",
  },
  {
    value: "web_search",
    label: "Consultar internet",
    description: "Pesquisa informacoes atuais na web apenas quando o Host pedir.",
  },
];
const integrationOptions: Array<{
  value: AgentIntegration;
  label: string;
  description: string;
}> = [
  {
    value: "resend_email",
    label: "Resend",
    description: "Envio transacional usando o dominio verificado da Coevo.",
  },
  {
    value: "google_calendar",
    label: "Google Agenda",
    description: "Permite que o Coevo crie eventos e convites na agenda conectada.",
  },
  {
    value: "web_search",
    label: "Busca na internet",
    description: "Autoriza consultas externas sob comando do Host.",
  },
];
const coevoConfigTabs: Array<{ id: CoevoConfigTab; label: string; description: string }> = [
  { id: "identity", label: "Identidade", description: "Nome, genero e metodo" },
  { id: "voice", label: "Voz", description: "Voz e demos" },
  { id: "behavior", label: "Comportamento", description: "Tom, sliders e palavras" },
  { id: "actions", label: "Acoes", description: "Comandos por voz" },
  { id: "integrations", label: "Integracoes", description: "Resend e Google Agenda" },
  { id: "language", label: "Idioma", description: "Idioma e instrucoes livres" },
];
const keywordOptions = [
  "clareza",
  "objetividade",
  "proximo passo",
  "impacto",
  "risco",
  "valor",
  "evidencia",
  "contexto",
  "prioridade",
  "decisao",
  "ROI",
  "prazo",
];
const behaviorOptions = [
  "consultivo",
  "calmo",
  "direto",
  "curioso",
  "estrategico",
  "didatico",
  "empatico",
  "assertivo",
  "executivo",
  "socratico",
];
const avoidOptions = [
  "talvez",
  "acho",
  "impossivel",
  "obviamente",
  "sempre",
  "nunca",
  "problema",
  "barato",
];
const voices: Array<{
  id: AgentVoice;
  label: string;
  description: string;
  color: string;
}> = [
  {
    id: "marin",
    label: "Marin",
    description: "Natural, premium e equilibrada.",
    color: "bg-[#11110F] text-white",
  },
  {
    id: "cedar",
    label: "Cedar",
    description: "Grave, firme e institucional.",
    color: "bg-[#F97316] text-white",
  },
  {
    id: "ash",
    label: "Ash",
    description: "Calma e masculina.",
    color: "bg-[#FFF3EA] text-[#F97316]",
  },
  {
    id: "echo",
    label: "Echo",
    description: "Clara e objetiva.",
    color: "bg-[#F8F8F6] text-[#11110F]",
  },
  {
    id: "alloy",
    label: "Alloy",
    description: "Neutra e versatil.",
    color: "bg-[#F8F8F6] text-[#11110F]",
  },
  {
    id: "coral",
    label: "Coral",
    description: "Leve e expressiva.",
    color: "bg-[#F8F8F6] text-[#11110F]",
  },
  {
    id: "ballad",
    label: "Ballad",
    description: "Suave e narrativa.",
    color: "bg-[#F8F8F6] text-[#11110F]",
  },
  {
    id: "sage",
    label: "Sage",
    description: "Maduro e confiavel.",
    color: "bg-[#F8F8F6] text-[#11110F]",
  },
  {
    id: "shimmer",
    label: "Shimmer",
    description: "Aberta e energica.",
    color: "bg-[#F8F8F6] text-[#11110F]",
  },
  {
    id: "verse",
    label: "Verse",
    description: "Conversacional.",
    color: "bg-[#F8F8F6] text-[#11110F]",
  },
];

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
        active
          ? "border-[#F97316] bg-[#FFF3EA] text-[#F97316]"
          : "border-[#E7E7E2] bg-white text-[#73736B] hover:border-[#FDBA74] hover:text-[#11110F]"
      }`}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "CO";
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function Slider({
  label,
  value,
  onChange,
  left,
  right,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  left: string;
  right: string;
}) {
  return (
    <label className="rounded-lg border border-[#E7E7E2] bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold text-[#11110F]">{label}</span>
        <span className="font-mono text-xs text-[#F97316]">{value}</span>
      </div>
      <input
        className="mt-4 w-full accent-[#F97316]"
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="mt-2 flex justify-between text-xs text-[#73736B]">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </label>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<Section>("meetings");
  const [activeCoevoTab, setActiveCoevoTab] = useState<CoevoConfigTab>("identity");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<AppUser | null>(null);
  const [authForm, setAuthForm] = useState<AuthForm>(emptyAuthForm);
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [usersStatus, setUsersStatus] = useState<string | null>(null);
  const [userForm, setUserForm] = useState<UserForm>(emptyUserForm);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState("");
  const [profile, setProfile] = useState<AgentProfile>(defaultProfile);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [voiceDemoUrl, setVoiceDemoUrl] = useState<string | null>(null);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState<AgentVoice | null>(null);
  const [knowledgeStatus, setKnowledgeStatus] = useState<string | null>(null);
  const [isUploadingKnowledge, setIsUploadingKnowledge] = useState(false);
  const [trialRequests, setTrialRequests] = useState<TrialRequest[]>([]);
  const [trialRequestsStatus, setTrialRequestsStatus] = useState<string | null>(null);
  const [isLoadingTrialRequests, setIsLoadingTrialRequests] = useState(false);
  const [meetingHistory, setMeetingHistory] = useState<MeetingHistoryItem[]>([]);
  const [meetingHistoryStatus, setMeetingHistoryStatus] = useState<string | null>(null);
  const [isLoadingMeetingHistory, setIsLoadingMeetingHistory] = useState(false);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<number | null>(null);
  const [leadForm, setLeadForm] = useState<LeadForm>(emptyLeadForm);
  const [leadFormStatus, setLeadFormStatus] = useState<string | null>(null);
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [googleCalendar, setGoogleCalendar] = useState<GoogleCalendarStatus | null>(null);
  const [conversationSessions, setConversationSessions] = useState<ConversationSession[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
  const [memoryQuestion, setMemoryQuestion] = useState("");
  const [memoryCustomer, setMemoryCustomer] = useState("");
  const [memoryMeetingId, setMemoryMeetingId] = useState("");
  const [memoryStatus, setMemoryStatus] = useState<string | null>(null);
  const [memorySources, setMemorySources] = useState<MemorySearchResult[]>([]);
  const [isSendingMemoryQuestion, setIsSendingMemoryQuestion] = useState(false);
  const companyDocsRef = useRef<HTMLInputElement | null>(null);
  const companyMediaRef = useRef<HTMLInputElement | null>(null);
  const companyLinksRef = useRef<HTMLTextAreaElement | null>(null);
  const companyNotesRef = useRef<HTMLTextAreaElement | null>(null);
  const displayUser = sessionUser ?? defaultSessionUser;

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

  useEffect(() => {
    const token = window.localStorage.getItem("coevo-auth-token");
    if (!token) {
      return;
    }

    setAuthToken(token);
    void loadCurrentUser(token);
  }, []);

  async function loadCurrentUser(token: string) {
    try {
      const response = await fetch(`${apiUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        window.localStorage.removeItem("coevo-auth-token");
        setAuthToken(null);
        setSessionUser(null);
        return;
      }
      setSessionUser((await response.json()) as AppUser);
    } catch {
      window.localStorage.removeItem("coevo-auth-token");
      setAuthToken(null);
      setSessionUser(null);
    }
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAuthenticating(true);
    setAuthStatus(null);

    try {
      const endpoint = authMode === "login" ? "/auth/login" : "/auth/register";
      const body =
        authMode === "login"
          ? { email: authForm.email, password: authForm.password }
          : {
              name: authForm.name,
              email: authForm.email,
              password: authForm.password,
            };
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(
          authMode === "login"
            ? "Nao foi possivel entrar. Confira e-mail e senha."
            : "Nao foi possivel criar o usuario.",
        );
      }

      const result = (await response.json()) as {
        access_token: string;
        user: AppUser;
      };
      window.localStorage.setItem("coevo-auth-token", result.access_token);
      setAuthToken(result.access_token);
      setSessionUser(result.user);
      setAuthForm(emptyAuthForm);
      setAuthStatus(null);
    } catch (err) {
      setAuthStatus(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setIsAuthenticating(false);
    }
  }

  function logout() {
    window.localStorage.removeItem("coevo-auth-token");
    setAuthToken(null);
    setSessionUser(null);
    setActiveSection("meetings");
  }

  async function loadUsers() {
    if (!authToken || !sessionUser?.is_admin) {
      return;
    }

    setUsersStatus(null);
    try {
      const response = await fetch(`${apiUrl}/users`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!response.ok) {
        throw new Error("Nao foi possivel carregar os usuarios.");
      }
      setUsers((await response.json()) as AppUser[]);
    } catch (err) {
      setUsersStatus(err instanceof Error ? err.message : "Erro inesperado.");
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authToken) {
      return;
    }

    setIsSavingUser(true);
    setUsersStatus(null);
    try {
      const response = await fetch(`${apiUrl}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: userForm.name,
          email: userForm.email,
          password: userForm.password,
          is_admin: userForm.isAdmin,
        }),
      });

      if (!response.ok) {
        throw new Error("Nao foi possivel cadastrar o usuario.");
      }
      setUserForm(emptyUserForm);
      await loadUsers();
      setUsersStatus("Usuario cadastrado.");
    } catch (err) {
      setUsersStatus(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setIsSavingUser(false);
    }
  }

  async function loadGoogleCalendarStatus() {
    try {
      const response = await fetch(`${apiUrl}/integrations/google-calendar`);
      if (!response.ok) {
        return;
      }
      setGoogleCalendar((await response.json()) as GoogleCalendarStatus);
    } catch {
      setGoogleCalendar(null);
    }
  }

  async function loadTrialRequests() {
    setIsLoadingTrialRequests(true);
    setTrialRequestsStatus(null);

    try {
      const response = await fetch(`${apiUrl}/trial-requests`);
      if (!response.ok) {
        throw new Error("Nao foi possivel carregar os leads.");
      }

      setTrialRequests((await response.json()) as TrialRequest[]);
    } catch (err) {
      setTrialRequestsStatus(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setIsLoadingTrialRequests(false);
    }
  }

  async function loadMeetingHistory() {
    setIsLoadingMeetingHistory(true);
    setMeetingHistoryStatus(null);

    try {
      const response = await fetch(`${apiUrl}/meetings/history?limit=12`);
      if (!response.ok) {
        throw new Error("Nao foi possivel carregar o historico.");
      }
      setMeetingHistory((await response.json()) as MeetingHistoryItem[]);
    } catch (err) {
      setMeetingHistoryStatus(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setIsLoadingMeetingHistory(false);
    }
  }

  async function loadConversationSessions() {
    try {
      const response = await fetch(`${apiUrl}/agent/conversations?limit=20`);
      if (!response.ok) {
        throw new Error("Nao foi possivel carregar as conversas.");
      }
      setConversationSessions((await response.json()) as ConversationSession[]);
    } catch (err) {
      setMemoryStatus(err instanceof Error ? err.message : "Erro inesperado.");
    }
  }

  async function loadConversationMessages(sessionId: string) {
    setActiveConversationId(sessionId);
    setMemoryStatus(null);
    try {
      const response = await fetch(`${apiUrl}/agent/conversations/${sessionId}/messages`);
      if (!response.ok) {
        throw new Error("Nao foi possivel carregar essa conversa.");
      }
      setConversationMessages((await response.json()) as ConversationMessage[]);
    } catch (err) {
      setMemoryStatus(err instanceof Error ? err.message : "Erro inesperado.");
    }
  }

  function startNewConversation() {
    setActiveConversationId(null);
    setConversationMessages([]);
    setMemorySources([]);
    setMemoryStatus(null);
    setMemoryQuestion("");
  }

  async function askCoevo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = memoryQuestion.trim();
    if (!question) {
      return;
    }

    const optimisticMessage: ConversationMessage = {
      id: Date.now(),
      session_id: activeConversationId ?? "pending",
      role: "user",
      content: question,
      created_at: new Date().toISOString(),
    };
    setConversationMessages((current) => [...current, optimisticMessage]);
    setMemoryQuestion("");
    setMemoryStatus("Consultando memoria das reunioes...");
    setIsSendingMemoryQuestion(true);

    try {
      const response = await fetch(`${apiUrl}/agent/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: activeConversationId,
          message: question,
          user_id: "local-user",
          user_name: displayUser.name,
          user_email: displayUser.email === defaultSessionUser.email ? null : displayUser.email,
          requester_role: "host",
          context_scope: {
            meeting_id: memoryMeetingId.trim() || null,
            customer: memoryCustomer.trim() || null,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("O Coevo nao conseguiu consultar a memoria agora.");
      }

      const result = (await response.json()) as {
        session: ConversationSession;
        user_message: ConversationMessage;
        assistant_message: ConversationMessage;
        memory_results: MemorySearchResult[];
      };

      setActiveConversationId(result.session.id);
      setMemorySources(result.memory_results);
      setConversationMessages((current) => [
        ...current.filter((message) => message.id !== optimisticMessage.id),
        result.user_message,
        result.assistant_message,
      ]);
      setMemoryStatus(null);
      void loadConversationSessions();
    } catch (err) {
      setConversationMessages((current) =>
        current.filter((message) => message.id !== optimisticMessage.id),
      );
      setMemoryStatus(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setIsSendingMemoryQuestion(false);
    }
  }

  function weeklyMeetingVolumeLabel(value: WeeklyMeetingVolume) {
    return (
      weeklyMeetingVolumeOptions.find((option) => option.value === value)?.label ??
      value
    );
  }

  function formatMeetingDate(value?: string | null) {
    if (!value) {
      return "Sem data";
    }

    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  }

  function meetingStatusLabel(meeting: MeetingHistoryItem) {
    if (meeting.ended_at) {
      return "Encerrada";
    }
    if (meeting.started_at) {
      return "Em andamento";
    }
    return "Criada";
  }

  function openNewLeadModal() {
    setEditingLeadId(null);
    setLeadForm(emptyLeadForm);
    setLeadFormStatus(null);
    setIsLeadModalOpen(true);
  }

  function openEditLeadModal(lead: TrialRequest) {
    setEditingLeadId(lead.id);
    setLeadForm({
      fullName: lead.full_name,
      phone: lead.phone,
      corporateEmail: lead.corporate_email,
      companyName: lead.company_name,
      weeklyMeetingVolume: lead.weekly_meeting_volume,
      selectedPlan: lead.selected_plan ?? "",
    });
    setLeadFormStatus(null);
    setIsLeadModalOpen(true);
  }

  function updateLeadForm<K extends keyof LeadForm>(field: K, value: LeadForm[K]) {
    setLeadForm((current) => ({ ...current, [field]: value }));
    setLeadFormStatus(null);
  }

  async function saveLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingLead(true);
    setLeadFormStatus(null);

    const body = {
      full_name: leadForm.fullName,
      phone: leadForm.phone,
      corporate_email: leadForm.corporateEmail,
      company_name: leadForm.companyName,
      weekly_meeting_volume: leadForm.weeklyMeetingVolume,
      selected_plan: leadForm.selectedPlan || null,
    };

    try {
      const response = await fetch(
        editingLeadId
          ? `${apiUrl}/trial-requests/${editingLeadId}`
          : `${apiUrl}/trial-requests`,
        {
          method: editingLeadId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editingLeadId
              ? body
              : {
                  ...body,
                  lgpd_accepted: true,
                  source: "dashboard-manual",
                },
          ),
        },
      );

      if (!response.ok) {
        throw new Error(
          editingLeadId
            ? "Nao foi possivel atualizar o lead."
            : "Nao foi possivel cadastrar o lead.",
        );
      }

      await loadTrialRequests();
      setIsLeadModalOpen(false);
      setEditingLeadId(null);
      setLeadForm(emptyLeadForm);
    } catch (err) {
      setLeadFormStatus(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setIsSavingLead(false);
    }
  }

  async function deleteLead(lead: TrialRequest) {
    const shouldDelete = window.confirm(
      `Excluir o lead de ${lead.full_name}? Esta acao nao pode ser desfeita.`,
    );

    if (!shouldDelete) {
      return;
    }

    setTrialRequestsStatus(null);
    try {
      const response = await fetch(`${apiUrl}/trial-requests/${lead.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Nao foi possivel excluir o lead.");
      }

      setTrialRequests((current) =>
        current.filter((trialRequest) => trialRequest.id !== lead.id),
      );
    } catch (err) {
      setTrialRequestsStatus(err instanceof Error ? err.message : "Erro inesperado.");
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const response = await fetch(`${apiUrl}/agent/profile`);
        if (!response.ok) {
          return;
        }
        const loadedProfile = (await response.json()) as AgentProfile;
        if (!cancelled) {
          setProfile({ ...defaultProfile, ...loadedProfile });
        }
      } catch {
        // Keep the local defaults when the API is unavailable.
      }
    }

    loadProfile();
    loadGoogleCalendarStatus();
    loadConversationSessions();
    loadMeetingHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (sessionUser?.is_admin) {
      void loadUsers();
    }
  }, [sessionUser?.is_admin, authToken]);

  function toggleArrayValue(key: "keywords" | "avoid_words" | "behavior_tags", value: string) {
    setProfile((current) => {
      const values = current[key];
      const nextValues = values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value];
      return { ...current, [key]: nextValues };
    });
  }

  function toggleProfileArrayValue(
    key: "voice_command_roles" | "enabled_actions" | "enabled_integrations",
    value: ParticipantRole | AgentAction | AgentIntegration,
  ) {
    setProfile((current) => {
      if (key === "voice_command_roles") {
        const typedValue = value as ParticipantRole;
        const nextValues = current.voice_command_roles.includes(typedValue)
          ? current.voice_command_roles.filter((item) => item !== typedValue)
          : [...current.voice_command_roles, typedValue];
        return { ...current, voice_command_roles: nextValues };
      }

      if (key === "enabled_actions") {
        const typedValue = value as AgentAction;
        const nextValues = current.enabled_actions.includes(typedValue)
          ? current.enabled_actions.filter((item) => item !== typedValue)
          : [...current.enabled_actions, typedValue];
        return { ...current, enabled_actions: nextValues };
      }

      const typedValue = value as AgentIntegration;
      const nextValues = current.enabled_integrations.includes(typedValue)
        ? current.enabled_integrations.filter((item) => item !== typedValue)
        : [...current.enabled_integrations, typedValue];
      return { ...current, enabled_integrations: nextValues };
    });
  }

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

  async function saveProfile() {
    setProfileStatus("Salvando personalidade...");
    try {
      const response = await fetch(`${apiUrl}/agent/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      if (!response.ok) {
        throw new Error("Nao foi possivel salvar a personalidade.");
      }

      const savedProfile = (await response.json()) as AgentProfile;
      setProfile({ ...defaultProfile, ...savedProfile });
      setProfileStatus("Personalidade salva. O Coevo usara este perfil nas proximas reunioes.");
    } catch (err) {
      setProfileStatus(err instanceof Error ? err.message : "Erro inesperado.");
    }
  }

  async function playVoiceDemo(voice: AgentVoice) {
    setIsGeneratingVoice(voice);
    setProfileStatus(null);

    try {
      const response = await fetch(`${apiUrl}/agent/voice-demo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice,
          text: "Ola, eu sou o Coevo. Vou acompanhar a reuniao com clareza, calma e foco no que importa.",
        }),
      });

      if (!response.ok) {
        throw new Error("Nao foi possivel gerar a demo de voz.");
      }

      if (voiceDemoUrl) {
        URL.revokeObjectURL(voiceDemoUrl);
      }

      const url = URL.createObjectURL(await response.blob());
      setVoiceDemoUrl(url);
      const audio = new Audio(url);
      await audio.play();
    } catch (err) {
      setProfileStatus(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setIsGeneratingVoice(null);
    }
  }

  async function uploadTextKnowledge(filename: string, content: string) {
    const text = content.trim();
    if (!text) {
      return;
    }

    const formData = new FormData();
    formData.append("file", new File([text], filename, { type: "text/plain" }));
    const response = await fetch(`${apiUrl}/knowledge/documents`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Nao foi possivel salvar a base institucional.");
    }
  }

  async function uploadInstitutionalKnowledge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setKnowledgeStatus("Enviando base institucional...");
    setIsUploadingKnowledge(true);

    try {
      const documents = Array.from(companyDocsRef.current?.files ?? []);
      for (const file of documents) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch(`${apiUrl}/knowledge/documents`, {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          throw new Error("Nao foi possivel salvar um dos documentos.");
        }
      }

      const mediaFiles = Array.from(companyMediaRef.current?.files ?? []);
      for (const file of mediaFiles) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch(`${apiUrl}/knowledge/media`, {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          throw new Error("Nao foi possivel transcrever uma das midias.");
        }
      }

      await uploadTextKnowledge(
        "links-institucionais.txt",
        companyLinksRef.current?.value ?? "",
      );
      await uploadTextKnowledge(
        "contexto-institucional.txt",
        companyNotesRef.current?.value ?? "",
      );

      setKnowledgeStatus("Base institucional atualizada. O Coevo ja pode consultar este conteudo.");
    } catch (err) {
      setKnowledgeStatus(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setIsUploadingKnowledge(false);
    }
  }

  const navItemClass = (section: Section) =>
    `flex w-full items-center gap-4 rounded-lg px-4 py-3 text-left text-sm transition ${
      activeSection === section
        ? "border border-[#FDBA74] bg-[#FFF3EA] font-semibold text-[#11110F] shadow-[0_18px_70px_rgba(17,17,15,0.07)]"
        : "font-medium text-[#73736B] hover:bg-[#F8F8F6] hover:text-[#11110F]"
    }`;

  if (!sessionUser) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-5 py-10 text-[#11110F]">
        <div
          className="pointer-events-none fixed inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(rgba(17,17,15,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(17,17,15,.055) 1px, transparent 1px)",
            backgroundSize: "42px 42px",
          }}
        />
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_70%_0%,rgba(249,115,22,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.9),#FFFFFF_72%)]" />

        <section className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white shadow-[0_24px_90px_rgba(17,17,15,0.12)] lg:grid-cols-[1fr_440px]">
          <div className="flex min-h-[520px] flex-col justify-between bg-[#11110F] p-8 text-white">
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white font-display text-2xl font-bold text-[#11110F]">
                C
              </div>
              <p className="mt-8 font-mono text-xs uppercase tracking-[0.18em] text-[#FDBA74]">
                Coevo Meet
              </p>
              <h1 className="mt-4 max-w-xl font-display text-4xl font-semibold leading-tight">
                Acesse sua central de videochamadas assistidas por IA.
              </h1>
              <p className="mt-5 max-w-lg text-sm leading-7 text-white/68">
                Entre com login e senha para criar reunioes, consultar memoria,
                configurar o Coevo e gerenciar usuarios.
              </p>
            </div>
            <p className="text-xs leading-5 text-white/45">
              O primeiro usuario cadastrado neste ambiente sera definido como
              administrador automaticamente.
            </p>
          </div>

          <form className="p-6 sm:p-8" onSubmit={submitAuth}>
            <div className="mb-6 flex rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] p-1">
              <button
                className={`flex-1 rounded-md px-4 py-2 text-sm font-bold transition ${
                  authMode === "login"
                    ? "bg-white text-[#11110F] shadow-sm"
                    : "text-[#73736B]"
                }`}
                onClick={() => setAuthMode("login")}
                type="button"
              >
                Entrar
              </button>
              <button
                className={`flex-1 rounded-md px-4 py-2 text-sm font-bold transition ${
                  authMode === "register"
                    ? "bg-white text-[#11110F] shadow-sm"
                    : "text-[#73736B]"
                }`}
                onClick={() => setAuthMode("register")}
                type="button"
              >
                Criar conta
              </button>
            </div>

            <h2 className="font-display text-2xl font-semibold">
              {authMode === "login" ? "Acessar conta" : "Cadastrar usuario"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#73736B]">
              {authMode === "login"
                ? "Use seu e-mail e senha para acessar o dashboard."
                : "Se for o primeiro cadastro, este usuario sera o administrador."}
            </p>

            <div className="mt-6 space-y-4">
              {authMode === "register" ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">Nome</span>
                  <input
                    className="w-full rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] px-4 py-3 text-sm outline-none focus:border-[#F97316]"
                    value={authForm.name}
                    onChange={(event) =>
                      setAuthForm((current) => ({ ...current, name: event.target.value }))
                    }
                    required
                  />
                </label>
              ) : null}
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">E-mail</span>
                <input
                  className="w-full rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] px-4 py-3 text-sm outline-none focus:border-[#F97316]"
                  type="email"
                  value={authForm.email}
                  onChange={(event) =>
                    setAuthForm((current) => ({ ...current, email: event.target.value }))
                  }
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Senha</span>
                <input
                  className="w-full rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] px-4 py-3 text-sm outline-none focus:border-[#F97316]"
                  type="password"
                  minLength={authMode === "register" ? 8 : 1}
                  value={authForm.password}
                  onChange={(event) =>
                    setAuthForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  required
                />
              </label>
            </div>

            {authStatus ? (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {authStatus}
              </p>
            ) : null}

            <button
              className="mt-6 w-full rounded-lg bg-[#11110F] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#F97316] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isAuthenticating}
              type="submit"
            >
              {isAuthenticating
                ? "Aguarde..."
                : authMode === "login"
                  ? "Entrar"
                  : "Criar usuario"}
            </button>
          </form>
        </section>
      </main>
    );
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
          <p className="font-display text-lg font-semibold">Coevo</p>
        </div>

        <div className="hidden lg:block">
          <p className="font-mono text-xs uppercase text-[#F97316]">Dashboard</p>
          <p className="mt-1 text-sm text-[#73736B]">Videochamadas com Coevo</p>
        </div>

        <div className="ml-auto flex items-center gap-3 sm:gap-5">
          <p className="hidden font-mono text-xs text-[#73736B] sm:block">{currentDate}</p>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-[#11110F]">{displayUser.name}</p>
            <p className="text-xs text-[#73736B]">{displayUser.email}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#FDBA74] bg-[#FFF3EA] text-sm font-bold text-[#F97316] shadow-[0_18px_70px_rgba(17,17,15,0.07)]">
            {getInitials(displayUser.name)}
          </div>
          <button
            className="hidden rounded-lg border border-[#E7E7E2] bg-white px-3 py-2 text-xs font-bold text-[#73736B] transition hover:border-[#F97316] hover:bg-[#FFF3EA] hover:text-[#11110F] sm:block"
            onClick={logout}
            type="button"
          >
            Sair
          </button>
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
          <button className={navItemClass("meetings")} type="button" onClick={() => setActiveSection("meetings")}>
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#F97316] font-mono text-xs font-bold text-white">
              M
            </span>
            Reunioes
          </button>
          <button
            className={navItemClass("memory")}
            type="button"
            onClick={() => {
              setActiveSection("memory");
              void loadConversationSessions();
            }}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E7E7E2] font-mono text-xs">
              C
            </span>
            Conversar com Coevo
          </button>
          <button className={navItemClass("coevo")} type="button" onClick={() => setActiveSection("coevo")}>
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E7E7E2] font-mono text-xs">
              IA
            </span>
            Configurar Coevo
          </button>
          <button className={navItemClass("knowledge")} type="button" onClick={() => setActiveSection("knowledge")}>
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E7E7E2] font-mono text-xs">
              B
            </span>
            Base institucional
          </button>
          <button
            className={navItemClass("leads")}
            type="button"
            onClick={() => {
              setActiveSection("leads");
              void loadTrialRequests();
            }}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E7E7E2] font-mono text-xs">
              L
            </span>
            Leads de teste
          </button>
          {sessionUser.is_admin ? (
            <button
              className={navItemClass("users")}
              type="button"
              onClick={() => {
                setActiveSection("users");
                void loadUsers();
              }}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E7E7E2] font-mono text-xs">
                U
              </span>
              Usuarios
            </button>
          ) : null}
        </nav>

        <div className="absolute bottom-5 left-5 right-5 rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] p-4">
          <p className="font-mono text-xs uppercase text-[#F97316]">Status</p>
          <p className="mt-2 text-sm font-medium text-[#11110F]">Coevo pronto</p>
          <p className="mt-1 text-xs leading-5 text-[#73736B]">
            A personalidade salva sera usada nas proximas reunioes.
          </p>
        </div>
      </aside>

      <section className="relative z-10 min-h-screen px-5 pb-16 pt-32 sm:px-8 lg:ml-72 lg:pt-32">
        <div className="mx-auto max-w-6xl">
          {activeSection === "meetings" ? (
            <div className="text-center">
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
                  className="rounded-lg bg-[#11110F] px-7 py-4 text-base font-bold text-white shadow-[0_20px_80px_rgba(249,115,22,0.22)] transition hover:translate-y-[-1px] hover:bg-[#F97316] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isCreating}
                  onClick={createInstantMeeting}
                  type="button"
                >
                  {isCreating ? "Criando..." : "Criar Reuniao Instantanea"}
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
                    {invitedMeetings.length} convites
                  </p>
                </div>

                <div className="overflow-hidden rounded-lg border border-[#E7E7E2] bg-white shadow-[0_18px_70px_rgba(17,17,15,0.07)]">
                  {invitedMeetings.length === 0 ? (
                    <div className="px-5 py-7 text-center">
                      <p className="text-sm font-semibold text-[#11110F]">
                        Nenhum convite encontrado
                      </p>
                      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#73736B]">
                        Quando voce for convidado para uma reuniao, ela aparecera aqui.
                      </p>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="mx-auto mt-8 max-w-3xl text-left">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h2 className="font-display text-xl font-semibold text-[#11110F]">
                    Historico das reunioes que participou
                  </h2>
                  <button
                    className="rounded-md border border-[#E7E7E2] bg-white px-3 py-2 font-mono text-xs uppercase text-[#73736B] transition hover:border-[#F97316] hover:bg-[#FFF3EA] hover:text-[#11110F]"
                    disabled={isLoadingMeetingHistory}
                    onClick={loadMeetingHistory}
                    type="button"
                  >
                    {isLoadingMeetingHistory ? "Atualizando" : "Atualizar"}
                  </button>
                </div>

                <div className="overflow-hidden rounded-lg border border-[#E7E7E2] bg-white shadow-[0_18px_70px_rgba(17,17,15,0.07)]">
                  {meetingHistoryStatus ? (
                    <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">
                      {meetingHistoryStatus}
                    </div>
                  ) : null}
                  {meetingHistory.length === 0 ? (
                    <div className="px-5 py-7 text-center">
                      <p className="text-sm font-semibold text-[#11110F]">
                        Nenhuma reuniao no historico
                      </p>
                      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#73736B]">
                        As reunioes encerradas em que voce participou serao listadas aqui.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#E7E7E2]">
                      {meetingHistory.map((meeting) => (
                        <article
                          className="grid gap-4 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                          key={meeting.id}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-bold text-[#11110F]">
                                {meeting.title}
                              </p>
                              <span className="rounded-full border border-[#E7E7E2] bg-[#FCFCFB] px-2 py-1 text-[11px] font-bold uppercase text-[#73736B]">
                                {meetingStatusLabel(meeting)}
                              </span>
                              {meeting.recording_url ? (
                                <span className="rounded-full border border-[#FDBA74] bg-[#FFF3EA] px-2 py-1 text-[11px] font-bold uppercase text-[#F97316]">
                                  Gravada
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 font-mono text-xs text-[#73736B]">
                              {meeting.id}
                            </p>
                            <p className="mt-2 text-xs text-[#73736B]">
                              Criada em {formatMeetingDate(meeting.created_at)}
                              {meeting.ended_at
                                ? ` - encerrada em ${formatMeetingDate(meeting.ended_at)}`
                                : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 md:justify-end">
                            <span className="rounded-md bg-[#FCFCFB] px-3 py-2 text-xs font-semibold text-[#73736B]">
                              {meeting.participant_count} participante
                              {meeting.participant_count === 1 ? "" : "s"}
                            </span>
                            <span className="rounded-md bg-[#FCFCFB] px-3 py-2 text-xs font-semibold text-[#73736B]">
                              {meeting.transcript_count} transcricao
                              {meeting.transcript_count === 1 ? "" : "s"}
                            </span>
                            <span className="rounded-md bg-[#FCFCFB] px-3 py-2 text-xs font-semibold text-[#73736B]">
                              {meeting.memory_count} memoria
                              {meeting.memory_count === 1 ? "" : "s"}
                            </span>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : null}

          {activeSection === "memory" ? (
            <div className="space-y-6">
              <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
                <div>
                  <p className="font-mono text-xs uppercase text-[#F97316]">
                    Memoria do Coevo
                  </p>
                  <h1 className="mt-2 font-display text-4xl font-semibold text-[#11110F]">
                    Pergunte sobre reunioes passadas.
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[#73736B]">
                    O Coevo consulta transcricoes, decisoes, riscos, objecoes,
                    promessas e proximos passos ja salvos na memoria.
                  </p>
                </div>
                <button
                  className="rounded-lg border border-[#E7E7E2] bg-white px-5 py-3 text-sm font-bold text-[#11110F] shadow-[0_18px_70px_rgba(17,17,15,0.07)] transition hover:border-[#F97316] hover:bg-[#FFF3EA]"
                  onClick={startNewConversation}
                  type="button"
                >
                  Nova conversa
                </button>
              </div>

              <div className="grid min-h-[680px] gap-5 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
                <aside className="rounded-xl border border-[#E7E7E2] bg-white p-4 shadow-[0_18px_70px_rgba(17,17,15,0.07)]">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs uppercase text-[#F97316]">
                        Historico
                      </p>
                      <h2 className="mt-1 text-lg font-bold">Chats</h2>
                    </div>
                    <button
                      className="rounded-md border border-[#E7E7E2] px-3 py-2 text-xs font-bold transition hover:border-[#F97316] hover:bg-[#FFF3EA]"
                      onClick={loadConversationSessions}
                      type="button"
                    >
                      Atualizar
                    </button>
                  </div>
                  <div className="space-y-2">
                    {conversationSessions.length === 0 ? (
                      <p className="rounded-lg bg-[#FCFCFB] p-4 text-sm leading-6 text-[#73736B]">
                        Ainda nao ha conversas salvas. Faca a primeira pergunta
                        ao Coevo.
                      </p>
                    ) : null}
                    {conversationSessions.map((session) => (
                      <button
                        key={session.id}
                        className={`w-full rounded-lg border p-3 text-left transition ${
                          activeConversationId === session.id
                            ? "border-[#F97316] bg-[#FFF3EA]"
                            : "border-[#E7E7E2] bg-white hover:bg-[#FCFCFB]"
                        }`}
                        onClick={() => void loadConversationMessages(session.id)}
                        type="button"
                      >
                        <p className="line-clamp-2 text-sm font-bold text-[#11110F]">
                          {session.title}
                        </p>
                        <p className="mt-2 font-mono text-[11px] uppercase text-[#73736B]">
                          {new Intl.DateTimeFormat("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(new Date(session.updated_at))}
                        </p>
                      </button>
                    ))}
                  </div>
                </aside>

                <section className="flex min-h-[680px] flex-col overflow-hidden rounded-xl border border-[#E7E7E2] bg-white shadow-[0_18px_70px_rgba(17,17,15,0.07)]">
                  <div className="flex items-center justify-between gap-4 border-b border-[#E7E7E2] px-5 py-4">
                    <div>
                      <p className="font-mono text-xs uppercase text-[#F97316]">
                        Conversa
                      </p>
                      <h2 className="mt-1 text-xl font-bold">
                        {activeConversationId ? "Chat com memoria" : "Nova pergunta"}
                      </h2>
                    </div>
                    <div className="coevo-memory-orb" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>

                  <div className="flex-1 space-y-4 overflow-y-auto bg-[#FCFCFB] p-5">
                    {conversationMessages.length === 0 ? (
                      <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center text-center">
                        <div className="coevo-memory-orb is-large" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                        </div>
                        <h3 className="mt-6 font-display text-2xl font-semibold">
                          O Coevo lembra das reunioes.
                        </h3>
                        <p className="mt-3 text-sm leading-6 text-[#73736B]">
                          Pergunte sobre prazos, decisoes, riscos, objecoes,
                          promessas ou proximos passos que apareceram nas chamadas.
                        </p>
                      </div>
                    ) : null}
                    {conversationMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.role === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[82%] rounded-xl px-4 py-3 text-sm leading-6 shadow-sm ${
                            message.role === "user"
                              ? "bg-[#11110F] text-white"
                              : "border border-[#E7E7E2] bg-white text-[#11110F]"
                          }`}
                        >
                          {message.content}
                        </div>
                      </div>
                    ))}
                  </div>

                  <form className="border-t border-[#E7E7E2] bg-white p-4" onSubmit={askCoevo}>
                    {memoryStatus ? (
                      <p className="mb-3 rounded-lg border border-[#FDBA74] bg-[#FFF3EA] px-3 py-2 text-sm text-[#8A4B13]">
                        {memoryStatus}
                      </p>
                    ) : null}
                    <div className="flex gap-3">
                      <input
                        className="min-w-0 flex-1 rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] px-4 py-3 text-sm outline-none transition focus:border-[#F97316]"
                        value={memoryQuestion}
                        onChange={(event) => setMemoryQuestion(event.target.value)}
                        placeholder="Ex.: O que ficou pendente com a XPTO?"
                      />
                      <button
                        className="rounded-lg bg-[#11110F] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#F97316] disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isSendingMemoryQuestion}
                        type="submit"
                      >
                        {isSendingMemoryQuestion ? "..." : "Enviar"}
                      </button>
                    </div>
                  </form>
                </section>

                <aside className="space-y-4">
                  <section className="rounded-xl border border-[#E7E7E2] bg-white p-4 shadow-[0_18px_70px_rgba(17,17,15,0.07)]">
                    <p className="font-mono text-xs uppercase text-[#F97316]">
                      Contexto
                    </p>
                    <label className="mt-4 block">
                      <span className="mb-2 block text-sm font-semibold">
                        Cliente ou projeto
                      </span>
                      <input
                        className="w-full rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] px-3 py-2 text-sm outline-none focus:border-[#F97316]"
                        value={memoryCustomer}
                        onChange={(event) => setMemoryCustomer(event.target.value)}
                        placeholder="XPTO, ACME..."
                      />
                    </label>
                    <label className="mt-4 block">
                      <span className="mb-2 block text-sm font-semibold">
                        ID da reuniao
                      </span>
                      <input
                        className="w-full rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] px-3 py-2 text-sm outline-none focus:border-[#F97316]"
                        value={memoryMeetingId}
                        onChange={(event) => setMemoryMeetingId(event.target.value)}
                        placeholder="meeting-..."
                      />
                    </label>
                    <p className="mt-4 text-xs leading-5 text-[#73736B]">
                      Deixe em branco para o Coevo pesquisar em todas as memorias
                      acessiveis.
                    </p>
                  </section>

                  <section className="rounded-xl border border-[#E7E7E2] bg-white p-4 shadow-[0_18px_70px_rgba(17,17,15,0.07)]">
                    <p className="font-mono text-xs uppercase text-[#F97316]">
                      Fontes usadas
                    </p>
                    <div className="mt-4 space-y-3">
                      {memorySources.length === 0 ? (
                        <p className="text-sm leading-6 text-[#73736B]">
                          As fontes aparecem aqui depois da resposta.
                        </p>
                      ) : null}
                      {memorySources.slice(0, 5).map((source) => (
                        <div
                          key={source.id}
                          className="rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] p-3"
                        >
                          <p className="text-xs font-bold uppercase text-[#F97316]">
                            {source.memory_type}
                          </p>
                          <p className="mt-1 text-xs text-[#73736B]">
                            {source.meeting_title ?? source.meeting_id}
                          </p>
                          <p className="mt-2 line-clamp-4 text-sm leading-5 text-[#11110F]">
                            {source.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                </aside>
              </div>
            </div>
          ) : null}

          {activeSection === "users" && sessionUser.is_admin ? (
            <div className="space-y-6">
              <div>
                <p className="font-mono text-xs uppercase text-[#F97316]">
                  Administracao
                </p>
                <h1 className="mt-2 font-display text-4xl font-semibold text-[#11110F]">
                  Usuarios do Coevo Meet
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-[#73736B]">
                  Cadastre usuarios com login e senha. Administradores podem
                  criar outros administradores.
                </p>
              </div>

              <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
                <form
                  className="rounded-xl border border-[#E7E7E2] bg-white p-5 shadow-[0_18px_70px_rgba(17,17,15,0.07)]"
                  onSubmit={createUser}
                >
                  <p className="font-mono text-xs uppercase text-[#F97316]">
                    Novo usuario
                  </p>
                  <label className="mt-4 block">
                    <span className="mb-2 block text-sm font-semibold">Nome</span>
                    <input
                      className="w-full rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] px-4 py-3 text-sm outline-none focus:border-[#F97316]"
                      value={userForm.name}
                      onChange={(event) =>
                        setUserForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                  <label className="mt-4 block">
                    <span className="mb-2 block text-sm font-semibold">E-mail</span>
                    <input
                      className="w-full rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] px-4 py-3 text-sm outline-none focus:border-[#F97316]"
                      type="email"
                      value={userForm.email}
                      onChange={(event) =>
                        setUserForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                  <label className="mt-4 block">
                    <span className="mb-2 block text-sm font-semibold">Senha</span>
                    <input
                      className="w-full rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] px-4 py-3 text-sm outline-none focus:border-[#F97316]"
                      type="password"
                      minLength={8}
                      value={userForm.password}
                      onChange={(event) =>
                        setUserForm((current) => ({
                          ...current,
                          password: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                  <label className="mt-4 flex items-start gap-3 rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] p-4">
                    <input
                      className="mt-1 accent-[#F97316]"
                      type="checkbox"
                      checked={userForm.isAdmin}
                      onChange={(event) =>
                        setUserForm((current) => ({
                          ...current,
                          isAdmin: event.target.checked,
                        }))
                      }
                    />
                    <span>
                      <span className="block text-sm font-semibold">
                        Definir como administrador
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[#73736B]">
                        Administradores podem cadastrar usuarios e acessar esta area.
                      </span>
                    </span>
                  </label>
                  <button
                    className="mt-5 w-full rounded-lg bg-[#11110F] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#F97316] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSavingUser}
                    type="submit"
                  >
                    {isSavingUser ? "Cadastrando..." : "Cadastrar usuario"}
                  </button>
                  {usersStatus ? (
                    <p className="mt-4 rounded-lg border border-[#FDBA74] bg-[#FFF3EA] px-3 py-2 text-sm text-[#8A4B13]">
                      {usersStatus}
                    </p>
                  ) : null}
                </form>

                <section className="overflow-hidden rounded-xl border border-[#E7E7E2] bg-white shadow-[0_18px_70px_rgba(17,17,15,0.07)]">
                  <div className="flex items-center justify-between border-b border-[#E7E7E2] px-5 py-4">
                    <div>
                      <p className="font-mono text-xs uppercase text-[#F97316]">
                        Cadastrados
                      </p>
                      <h2 className="mt-1 text-xl font-bold">Usuarios</h2>
                    </div>
                    <button
                      className="rounded-md border border-[#E7E7E2] bg-white px-3 py-2 text-xs font-bold text-[#73736B] transition hover:border-[#F97316] hover:bg-[#FFF3EA] hover:text-[#11110F]"
                      onClick={loadUsers}
                      type="button"
                    >
                      Atualizar
                    </button>
                  </div>
                  {users.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-[#73736B]">
                      Nenhum usuario encontrado.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#E7E7E2]">
                      {users.map((user) => (
                        <article
                          className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                          key={user.id}
                        >
                          <div>
                            <p className="font-semibold text-[#11110F]">
                              {user.name}
                            </p>
                            <p className="mt-1 text-sm text-[#73736B]">
                              {user.email}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {user.is_admin ? (
                              <span className="rounded-full border border-[#FDBA74] bg-[#FFF3EA] px-3 py-1 text-xs font-bold uppercase text-[#F97316]">
                                Admin
                              </span>
                            ) : (
                              <span className="rounded-full border border-[#E7E7E2] bg-[#FCFCFB] px-3 py-1 text-xs font-bold uppercase text-[#73736B]">
                                Usuario
                              </span>
                            )}
                            <span className="rounded-full border border-[#E7E7E2] bg-white px-3 py-1 text-xs text-[#73736B]">
                              {formatMeetingDate(user.created_at)}
                            </span>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          ) : null}

          {activeSection === "leads" ? (
            <div className="space-y-6">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                  <p className="font-mono text-xs uppercase text-[#F97316]">
                    Leads
                  </p>
                  <h1 className="mt-2 font-display text-4xl font-semibold text-[#11110F]">
                    Solicitações de teste gratuito
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[#73736B]">
                    Lista de contatos capturados pela landing do Coevo Meet.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    className="rounded-lg bg-[#11110F] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_70px_rgba(17,17,15,0.07)] transition hover:bg-[#F97316]"
                    onClick={openNewLeadModal}
                    type="button"
                  >
                    Cadastrar lead
                  </button>
                  <button
                    className="rounded-lg border border-[#E7E7E2] bg-white px-5 py-3 text-sm font-semibold text-[#11110F] shadow-[0_18px_70px_rgba(17,17,15,0.07)] transition hover:border-[#F97316] hover:bg-[#FFF3EA]"
                    disabled={isLoadingTrialRequests}
                    onClick={loadTrialRequests}
                    type="button"
                  >
                    {isLoadingTrialRequests ? "Atualizando..." : "Atualizar lista"}
                  </button>
                </div>
              </div>

              {trialRequestsStatus ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {trialRequestsStatus}
                </p>
              ) : null}

              <div className="overflow-hidden rounded-xl border border-[#E7E7E2] bg-white shadow-[0_18px_70px_rgba(17,17,15,0.07)]">
                {trialRequests.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <p className="text-sm font-semibold text-[#11110F]">
                      Nenhum lead capturado ainda
                    </p>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#73736B]">
                      Quando alguem solicitar um teste gratuito pela landing, o
                      contato aparecera aqui.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1080px] text-left text-sm">
                      <thead className="border-b border-[#E7E7E2] bg-[#FCFCFB] text-xs uppercase text-[#73736B]">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Nome</th>
                          <th className="px-4 py-3 font-semibold">Empresa</th>
                          <th className="px-4 py-3 font-semibold">Plano</th>
                          <th className="px-4 py-3 font-semibold">Reunioes/semana</th>
                          <th className="px-4 py-3 font-semibold">Contato</th>
                          <th className="px-4 py-3 font-semibold">Origem</th>
                          <th className="px-4 py-3 font-semibold">Data</th>
                          <th className="px-4 py-3 font-semibold">Acoes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E7E7E2]">
                        {trialRequests.map((lead) => (
                          <tr key={lead.id} className="align-top">
                            <td className="px-4 py-4">
                              <p className="font-semibold text-[#11110F]">
                                {lead.full_name}
                              </p>
                              <p className="mt-1 text-xs text-[#73736B]">
                                {lead.corporate_email}
                              </p>
                            </td>
                            <td className="px-4 py-4 text-[#11110F]">
                              {lead.company_name}
                            </td>
                            <td className="px-4 py-4">
                              <span className="rounded-full border border-[#FDBA74] bg-[#FFF3EA] px-3 py-1 text-xs font-semibold text-[#F97316]">
                                {lead.selected_plan ?? "Sem plano"}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-[#11110F]">
                              {weeklyMeetingVolumeLabel(lead.weekly_meeting_volume)}
                            </td>
                            <td className="px-4 py-4 text-[#11110F]">
                              {lead.phone}
                            </td>
                            <td className="px-4 py-4 text-[#73736B]">
                              {lead.source}
                            </td>
                            <td className="px-4 py-4 text-[#73736B]">
                              {new Intl.DateTimeFormat("pt-BR", {
                                dateStyle: "short",
                                timeStyle: "short",
                              }).format(new Date(lead.created_at))}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  className="rounded-md border border-[#E7E7E2] bg-white px-3 py-2 text-xs font-bold text-[#11110F] transition hover:border-[#F97316] hover:bg-[#FFF3EA]"
                                  onClick={() => openEditLeadModal(lead)}
                                  type="button"
                                >
                                  Editar
                                </button>
                                <button
                                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100"
                                  onClick={() => deleteLead(lead)}
                                  type="button"
                                >
                                  Excluir
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {activeSection === "coevo" ? (
            <div className="space-y-6">
              <div>
                <p className="font-mono text-xs uppercase text-[#F97316]">Configurar Coevo</p>
                <h1 className="mt-2 font-display text-4xl font-semibold text-[#11110F]">
                  Um painel mais claro para personalidade, voz e acoes.
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-[#73736B]">
                  Use os submenus para configurar uma parte por vez. O Coevo usa
                  essas definicoes nas proximas reunioes.
                </p>
              </div>

              <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
                <aside className="rounded-xl border border-[#E7E7E2] bg-white p-3 shadow-[0_18px_70px_rgba(17,17,15,0.07)]">
                  <div className="space-y-2">
                    {coevoConfigTabs.map((tab) => (
                      <button
                        key={tab.id}
                        className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                          activeCoevoTab === tab.id
                            ? "border-[#F97316] bg-[#FFF3EA]"
                            : "border-transparent bg-white hover:border-[#E7E7E2] hover:bg-[#FCFCFB]"
                        }`}
                        type="button"
                        onClick={() => setActiveCoevoTab(tab.id)}
                      >
                        <span className="block text-sm font-bold text-[#11110F]">
                          {tab.label}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-[#73736B]">
                          {tab.description}
                        </span>
                      </button>
                    ))}
                  </div>

                  <button
                    className="mt-4 w-full rounded-lg bg-[#11110F] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#F97316]"
                    type="button"
                    onClick={saveProfile}
                  >
                    Salvar configuracoes
                  </button>
                  {profileStatus ? (
                    <p className="mt-3 rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] px-3 py-2 text-xs leading-5 text-[#73736B]">
                      {profileStatus}
                    </p>
                  ) : null}
                </aside>

                <section className="space-y-5">
                  {activeCoevoTab === "identity" ? (
                    <div className="rounded-xl border border-[#E7E7E2] bg-white p-5 shadow-[0_18px_70px_rgba(17,17,15,0.07)]">
                      <p className="font-mono text-xs uppercase text-[#F97316]">Identidade</p>
                      <h2 className="mt-2 font-display text-2xl font-semibold">
                        Como o Coevo se apresenta
                      </h2>
                    <div className="grid gap-4 md:grid-cols-3">
                      <label>
                        <span className="mb-2 block text-sm font-semibold">Nome publico</span>
                        <input
                          className="w-full rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] px-4 py-3 text-sm outline-none focus:border-[#F97316]"
                          value={profile.name}
                          onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))}
                        />
                      </label>
                      <label>
                        <span className="mb-2 block text-sm font-semibold">Genero</span>
                        <select
                          className="w-full rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] px-4 py-3 text-sm outline-none focus:border-[#F97316]"
                          value={profile.gender}
                          onChange={(event) => setProfile((current) => ({ ...current, gender: event.target.value as AgentGender }))}
                        >
                          <option value="masculine">Masculino</option>
                          <option value="feminine">Feminino</option>
                          <option value="neutral">Neutro</option>
                        </select>
                      </label>
                      <label>
                        <span className="mb-2 block text-sm font-semibold">Metodo comercial</span>
                        <select
                          className="w-full rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] px-4 py-3 text-sm outline-none focus:border-[#F97316]"
                          value={profile.sales_method}
                          onChange={(event) => setProfile((current) => ({ ...current, sales_method: event.target.value }))}
                        >
                          {salesMethods.map((method) => (
                            <option key={method} value={method}>
                              {method}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    </div>
                  ) : null}

                  {activeCoevoTab === "behavior" ? (
                    <div className="rounded-xl border border-[#E7E7E2] bg-white p-5 shadow-[0_18px_70px_rgba(17,17,15,0.07)]">
                    <h2 className="font-display text-xl font-semibold">Modo de fala</h2>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {toneOptions.map((tone) => (
                        <Chip
                          key={tone}
                          active={profile.tone === tone}
                          onClick={() => setProfile((current) => ({ ...current, tone }))}
                        >
                          {tone}
                        </Chip>
                      ))}
                    </div>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <Slider label="Formalidade" value={profile.formality} left="casual" right="executivo" onChange={(value) => setProfile((current) => ({ ...current, formality: value }))} />
                      <Slider label="Energia" value={profile.energy} left="sereno" right="vibrante" onChange={(value) => setProfile((current) => ({ ...current, energy: value }))} />
                      <Slider label="Empatia" value={profile.empathy} left="objetivo" right="acolhedor" onChange={(value) => setProfile((current) => ({ ...current, empathy: value }))} />
                      <Slider label="Assertividade" value={profile.assertiveness} left="exploratorio" right="direto" onChange={(value) => setProfile((current) => ({ ...current, assertiveness: value }))} />
                      <Slider label="Brevidade" value={profile.brevity} left="explicativo" right="curto" onChange={(value) => setProfile((current) => ({ ...current, brevity: value }))} />
                    </div>
                    </div>
                  ) : null}

                  {activeCoevoTab === "behavior" ? (
                    <div className="rounded-xl border border-[#E7E7E2] bg-white p-5 shadow-[0_18px_70px_rgba(17,17,15,0.07)]">
                    <h2 className="font-display text-xl font-semibold">Palavras e comportamento</h2>
                    <div className="mt-5 space-y-5">
                      <div>
                        <p className="mb-2 text-sm font-semibold">Palavras que deve usar</p>
                        <div className="flex flex-wrap gap-2">
                          {keywordOptions.map((word) => (
                            <Chip key={word} active={profile.keywords.includes(word)} onClick={() => toggleArrayValue("keywords", word)}>
                              {word}
                            </Chip>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-sm font-semibold">Comportamentos</p>
                        <div className="flex flex-wrap gap-2">
                          {behaviorOptions.map((word) => (
                            <Chip key={word} active={profile.behavior_tags.includes(word)} onClick={() => toggleArrayValue("behavior_tags", word)}>
                              {word}
                            </Chip>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-sm font-semibold">Palavras a evitar</p>
                        <div className="flex flex-wrap gap-2">
                          {avoidOptions.map((word) => (
                            <Chip key={word} active={profile.avoid_words.includes(word)} onClick={() => toggleArrayValue("avoid_words", word)}>
                              {word}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    </div>
                    </div>
                  ) : null}

                  {activeCoevoTab === "voice" ? (
                    <div className="rounded-xl border border-[#E7E7E2] bg-white p-5 shadow-[0_18px_70px_rgba(17,17,15,0.07)]">
                    <h2 className="font-display text-xl font-semibold">Voz</h2>
                    <p className="mt-2 text-sm leading-6 text-[#73736B]">
                      Escolha a voz que o Coevo usara nas proximas reunioes.
                    </p>
                    <div className="mt-4 grid gap-3">
                      {voices.map((voice) => (
                        <div
                          className={`rounded-lg border p-3 transition ${
                            profile.voice === voice.id
                              ? "border-[#F97316] bg-[#FFF3EA]"
                              : "border-[#E7E7E2] bg-[#FCFCFB]"
                          }`}
                          key={voice.id}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <button
                              className="min-w-0 flex-1 text-left"
                              type="button"
                              onClick={() => setProfile((current) => ({ ...current, voice: voice.id }))}
                            >
                              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${voice.color}`}>
                                {voice.label}
                              </span>
                              <span className="mt-2 block text-sm text-[#73736B]">
                                {voice.description}
                              </span>
                            </button>
                            <button
                              className="rounded-lg border border-[#E7E7E2] bg-white px-3 py-2 text-xs font-bold text-[#11110F] transition hover:border-[#F97316] hover:bg-[#FFF3EA]"
                              type="button"
                              onClick={() => playVoiceDemo(voice.id)}
                            >
                              {isGeneratingVoice === voice.id ? "..." : "Demo"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {voiceDemoUrl ? (
                      <audio className="mt-4 w-full" controls src={voiceDemoUrl}>
                        Demo de voz
                      </audio>
                    ) : null}
                    </div>
                  ) : null}

                  {activeCoevoTab === "actions" ? (
                    <div className="rounded-xl border border-[#E7E7E2] bg-white p-5 shadow-[0_18px_70px_rgba(17,17,15,0.07)]">
                    <p className="font-mono text-xs uppercase text-[#F97316]">
                      Comandos de voz
                    </p>
                    <h2 className="mt-2 font-display text-xl font-semibold">
                      Acoes que o Coevo pode executar
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[#73736B]">
                      Nesta fase, apenas o Host executa comandos. O envio usa o
                      nome/e-mail do Host como referencia e sempre exige confirmacao
                      por voz antes de disparar.
                    </p>

                    <div className="mt-5 space-y-5">
                      <div>
                        <p className="mb-2 text-sm font-semibold">
                          Quem pode dar comandos
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {commandRoleOptions.map((role) => (
                            <Chip
                              key={role.value}
                              active={profile.voice_command_roles.includes(role.value)}
                              onClick={() =>
                                toggleProfileArrayValue("voice_command_roles", role.value)
                              }
                            >
                              {role.label}
                            </Chip>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-sm font-semibold">Acoes habilitadas</p>
                        <div className="grid gap-2">
                          {actionOptions.map((action) => (
                            <button
                              key={action.value}
                              className={`rounded-lg border p-3 text-left transition ${
                                profile.enabled_actions.includes(action.value)
                                  ? "border-[#F97316] bg-[#FFF3EA]"
                                  : "border-[#E7E7E2] bg-[#FCFCFB] hover:border-[#FDBA74]"
                              }`}
                              type="button"
                              onClick={() =>
                                toggleProfileArrayValue("enabled_actions", action.value)
                              }
                            >
                              <span className="block text-sm font-bold text-[#11110F]">
                                {action.label}
                              </span>
                              <span className="mt-1 block text-xs leading-5 text-[#73736B]">
                                {action.description}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-sm font-semibold">
                          Integracoes conectadas
                        </p>
                        <div className="grid gap-2">
                          {integrationOptions.map((integration) => (
                            <button
                              key={integration.value}
                              className={`rounded-lg border p-3 text-left transition ${
                                profile.enabled_integrations.includes(integration.value)
                                  ? "border-[#F97316] bg-[#FFF3EA]"
                                  : "border-[#E7E7E2] bg-[#FCFCFB] hover:border-[#FDBA74]"
                              }`}
                              type="button"
                              onClick={() =>
                                toggleProfileArrayValue(
                                  "enabled_integrations",
                                  integration.value,
                                )
                              }
                            >
                              <span className="block text-sm font-bold text-[#11110F]">
                                {integration.label}
                              </span>
                              <span className="mt-1 block text-xs leading-5 text-[#73736B]">
                                {integration.description}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <label className="flex items-start gap-3 rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] p-3">
                        <input
                          className="mt-1 accent-[#F97316]"
                          type="checkbox"
                          checked={profile.require_voice_confirmation}
                          onChange={(event) =>
                            setProfile((current) => ({
                              ...current,
                              require_voice_confirmation: event.target.checked,
                            }))
                          }
                        />
                        <span>
                          <span className="block text-sm font-bold text-[#11110F]">
                            Exigir confirmacao por voz
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-[#73736B]">
                            O Coevo prepara o e-mail, pergunta se pode enviar e so
                            dispara depois de ouvir a confirmacao do Host.
                          </span>
                        </span>
                      </label>
                    </div>
                    </div>
                  ) : null}

                  {activeCoevoTab === "integrations" ? (
                    <div className="rounded-xl border border-[#E7E7E2] bg-white p-5 shadow-[0_18px_70px_rgba(17,17,15,0.07)]">
                      <p className="font-mono text-xs uppercase text-[#F97316]">
                        Integracoes
                      </p>
                      <h2 className="mt-2 font-display text-xl font-semibold">
                        Canais conectados ao Coevo
                      </h2>
                      <div className="mt-5 grid gap-3 md:grid-cols-2">
                        {integrationOptions.map((integration) => (
                          <button
                            key={integration.value}
                            className={`rounded-lg border p-4 text-left transition ${
                              profile.enabled_integrations.includes(integration.value)
                                ? "border-[#F97316] bg-[#FFF3EA]"
                                : "border-[#E7E7E2] bg-[#FCFCFB] hover:border-[#FDBA74]"
                            }`}
                            type="button"
                            onClick={() =>
                              toggleProfileArrayValue(
                                "enabled_integrations",
                                integration.value,
                              )
                            }
                          >
                            <span className="block text-sm font-bold text-[#11110F]">
                              {integration.label}
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-[#73736B]">
                              {integration.description}
                            </span>
                          </button>
                        ))}
                      </div>

                      <div className="mt-5 rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-bold text-[#11110F]">
                              Google Agenda
                            </p>
                            <p className="mt-1 text-xs leading-5 text-[#73736B]">
                              {googleCalendar?.connected
                                ? `Conectado em ${googleCalendar.calendar_email ?? "agenda Google"}`
                                : googleCalendar?.configured
                                  ? "Pronto para conectar via OAuth."
                                  : "Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET na API."}
                            </p>
                          </div>
                          {googleCalendar?.auth_url ? (
                            <a
                              className="rounded-lg bg-[#11110F] px-4 py-3 text-center text-xs font-bold text-white transition hover:bg-[#F97316]"
                              href={googleCalendar.auth_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {googleCalendar.connected ? "Reconectar" : "Conectar"}
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {activeCoevoTab === "language" ? (
                    <div className="rounded-xl border border-[#E7E7E2] bg-white p-5 shadow-[0_18px_70px_rgba(17,17,15,0.07)]">
                    <h2 className="font-display text-xl font-semibold">Idioma</h2>
                    <select
                      className="mt-4 w-full rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] px-4 py-3 text-sm outline-none focus:border-[#F97316]"
                      value={profile.language_policy}
                      onChange={(event) => setProfile((current) => ({ ...current, language_policy: event.target.value }))}
                    >
                      {languagePolicies.map((policy) => (
                        <option key={policy} value={policy}>
                          {policy}
                        </option>
                      ))}
                    </select>
                    <label className="mt-4 block">
                      <span className="mb-2 block text-sm font-semibold">
                        Instrucao adicional
                      </span>
                      <textarea
                        className="h-32 w-full resize-none rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] px-4 py-3 text-sm outline-none focus:border-[#F97316]"
                        value={profile.custom_instructions}
                        onChange={(event) => setProfile((current) => ({ ...current, custom_instructions: event.target.value }))}
                        placeholder="Ex.: nunca interrompa; sempre pergunte antes de aprofundar."
                      />
                    </label>
                    </div>
                  ) : null}
                </section>
              </div>
            </div>
          ) : null}

          {activeSection === "knowledge" ? (
            <div className="space-y-6">
              <div>
                <p className="font-mono text-xs uppercase text-[#F97316]">Base institucional</p>
                <h1 className="mt-2 font-display text-4xl font-semibold text-[#11110F]">
                  Ensine o Coevo sobre a empresa, produtos e posicionamento.
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-[#73736B]">
                  Esta base e generica e vale para todas as reunioes. A base enviada
                  no lobby continua sendo exclusiva daquela sala.
                </p>
              </div>

              <form
                className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"
                onSubmit={uploadInstitutionalKnowledge}
              >
                <section className="space-y-5 rounded-xl border border-[#E7E7E2] bg-white p-5 shadow-[0_18px_70px_rgba(17,17,15,0.07)]">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] p-4">
                      <span className="block text-sm font-semibold">Documentos</span>
                      <span className="mt-1 block text-xs leading-5 text-[#73736B]">
                        PDF, DOCX, TXT e MD sobre empresa, produtos, cases e playbooks.
                      </span>
                      <input
                        ref={companyDocsRef}
                        className="mt-4 w-full text-sm text-[#73736B] file:mr-3 file:rounded-md file:border-0 file:bg-[#11110F] file:px-3 file:py-2 file:text-sm file:font-bold file:text-white"
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.txt,.md"
                      />
                    </label>

                    <label className="rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] p-4">
                      <span className="block text-sm font-semibold">Audios e videos</span>
                      <span className="mt-1 block text-xs leading-5 text-[#73736B]">
                        Gravacoes de treinamento, pitch, entrevistas ou webinars.
                      </span>
                      <input
                        ref={companyMediaRef}
                        className="mt-4 w-full text-sm text-[#73736B] file:mr-3 file:rounded-md file:border-0 file:bg-[#F8F8F6] file:px-3 file:py-2 file:text-sm file:font-bold file:text-[#11110F]"
                        type="file"
                        multiple
                        accept="audio/*,video/*"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">Links da web</span>
                    <textarea
                      ref={companyLinksRef}
                      className="h-28 w-full resize-none rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] px-4 py-3 text-sm outline-none focus:border-[#F97316]"
                      placeholder="Cole links de site, paginas de produto, cases ou materiais publicos."
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">Conhecimento manual</span>
                    <textarea
                      ref={companyNotesRef}
                      className="h-40 w-full resize-none rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] px-4 py-3 text-sm outline-none focus:border-[#F97316]"
                      placeholder="Escreva aqui fatos sobre empresa, produtos, diferenciais, publico-alvo, objecoes comuns e respostas ideais."
                    />
                  </label>
                </section>

                <aside className="rounded-xl border border-[#E7E7E2] bg-white p-5 shadow-[0_18px_70px_rgba(17,17,15,0.07)]">
                  <p className="font-mono text-xs uppercase text-[#F97316]">Escopo</p>
                  <h2 className="mt-2 font-display text-2xl font-semibold">
                    Base global do Coevo
                  </h2>
                  <div className="mt-5 space-y-3">
                    {["Empresa", "Produtos", "Cases", "Playbooks", "Objecoes", "Concorrentes"].map((item) => (
                      <div className="rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] px-4 py-3 text-sm font-semibold text-[#11110F]" key={item}>
                        {item}
                      </div>
                    ))}
                  </div>
                  <button
                    className="mt-5 w-full rounded-lg bg-[#11110F] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#F97316] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isUploadingKnowledge}
                    type="submit"
                  >
                    {isUploadingKnowledge ? "Enviando..." : "Atualizar base"}
                  </button>
                  {knowledgeStatus ? (
                    <p className="mt-3 rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] px-3 py-2 text-xs leading-5 text-[#73736B]">
                      {knowledgeStatus}
                    </p>
                  ) : null}
                </aside>
              </form>
            </div>
          ) : null}
        </div>
      </section>

      {isLeadModalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#11110F]/45 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-[#E7E7E2] bg-white shadow-[0_30px_120px_rgba(17,17,15,0.22)]">
            <div className="flex items-start justify-between gap-5 border-b border-[#E7E7E2] p-6">
              <div>
                <p className="font-mono text-xs uppercase text-[#F97316]">
                  {editingLeadId ? "Editar lead" : "Novo lead"}
                </p>
                <h2 className="mt-2 font-display text-3xl font-semibold text-[#11110F]">
                  {editingLeadId
                    ? "Atualizar solicitacao"
                    : "Cadastrar solicitacao de teste"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#73736B]">
                  Registre ou ajuste os dados do contato para acompanhamento
                  comercial.
                </p>
              </div>
              <button
                aria-label="Fechar"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#E7E7E2] bg-[#FCFCFB] text-lg font-bold text-[#11110F] transition hover:border-[#F97316] hover:bg-[#FFF3EA]"
                onClick={() => setIsLeadModalOpen(false)}
                type="button"
              >
                x
              </button>
            </div>

            <form className="grid gap-4 p-6" onSubmit={saveLead}>
              <label className="grid gap-2 text-sm font-semibold text-[#11110F]">
                Nome Completo
                <input
                  className="rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] px-4 py-3 text-sm font-normal outline-none focus:border-[#F97316]"
                  minLength={3}
                  onChange={(event) => updateLeadForm("fullName", event.target.value)}
                  required
                  type="text"
                  value={leadForm.fullName}
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-[#11110F]">
                  Telefone
                  <input
                    className="rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] px-4 py-3 text-sm font-normal outline-none focus:border-[#F97316]"
                    minLength={8}
                    onChange={(event) => updateLeadForm("phone", event.target.value)}
                    required
                    type="tel"
                    value={leadForm.phone}
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-[#11110F]">
                  E-mail Corporativo
                  <input
                    className="rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] px-4 py-3 text-sm font-normal outline-none focus:border-[#F97316]"
                    onChange={(event) =>
                      updateLeadForm("corporateEmail", event.target.value)
                    }
                    required
                    type="email"
                    value={leadForm.corporateEmail}
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-semibold text-[#11110F]">
                Nome da Empresa
                <input
                  className="rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] px-4 py-3 text-sm font-normal outline-none focus:border-[#F97316]"
                  minLength={2}
                  onChange={(event) =>
                    updateLeadForm("companyName", event.target.value)
                  }
                  required
                  type="text"
                  value={leadForm.companyName}
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-[#11110F]">
                  Reunioes por semana
                  <select
                    className="rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] px-4 py-3 text-sm font-normal outline-none focus:border-[#F97316]"
                    onChange={(event) =>
                      updateLeadForm(
                        "weeklyMeetingVolume",
                        event.target.value as WeeklyMeetingVolume,
                      )
                    }
                    value={leadForm.weeklyMeetingVolume}
                  >
                    {weeklyMeetingVolumeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-semibold text-[#11110F]">
                  Plano de interesse
                  <select
                    className="rounded-lg border border-[#E7E7E2] bg-[#FCFCFB] px-4 py-3 text-sm font-normal outline-none focus:border-[#F97316]"
                    onChange={(event) =>
                      updateLeadForm("selectedPlan", event.target.value)
                    }
                    value={leadForm.selectedPlan}
                  >
                    <option value="">Sem plano definido</option>
                    {planOptions.map((plan) => (
                      <option key={plan} value={plan}>
                        {plan}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {leadFormStatus ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {leadFormStatus}
                </p>
              ) : null}

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  className="rounded-lg border border-[#E7E7E2] bg-white px-5 py-3 text-sm font-semibold text-[#11110F] transition hover:border-[#F97316] hover:bg-[#FFF3EA]"
                  onClick={() => setIsLeadModalOpen(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="rounded-lg bg-[#11110F] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#F97316] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSavingLead}
                  type="submit"
                >
                  {isSavingLead ? "Salvando..." : "Salvar lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
