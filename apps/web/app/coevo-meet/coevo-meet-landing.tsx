"use client";

import Link from "next/link";
import { useState } from "react";

const metrics = [
  "Menos follow-up perdido",
  "Mais contexto para decidir",
  "Menos improviso comercial",
  "Mais aprendizado por reuniao",
];

const comparisons = [
  {
    old: "Reuniao comum",
    coevo: "Reuniao assistida",
    detail:
      "Sistemas tradicionais entregam video. Coevo Meet entrega inteligencia ao vivo, contexto, memoria e apoio operacional durante a conversa.",
  },
  {
    old: "Notas manuais",
    coevo: "IA acompanhando tudo",
    detail:
      "Sua equipe para de depender de anotacoes soltas e passa a operar com transcricao, base de conhecimento e sugestoes acionaveis.",
  },
  {
    old: "Vendedor sozinho",
    coevo: "Comercial com copiloto",
    detail:
      "Enquanto a conversa acontece, a IA identifica risco, objecao, oportunidade e prepara o proximo movimento.",
  },
];

const features = [
  { title: "IA participante na sala", icon: "orb" },
  { title: "Respostas por voz em tempo real", icon: "voice" },
  { title: "Transcricao processada em segundo plano", icon: "lines" },
  { title: "Painel comercial privado", icon: "panel" },
  { title: "Cards de objecao, risco e oportunidade", icon: "cards" },
  { title: "Base de conhecimento por empresa", icon: "database" },
  { title: "Base especifica por reuniao", icon: "folder" },
  { title: "Personalidade treinavel do agente", icon: "sliders" },
  { title: "Historico e memoria de reunioes", icon: "timeline" },
  { title: "Efeitos de camera e fundo corporativo", icon: "camera" },
  { title: "Compartilhamento de tela com foco total", icon: "screen" },
  { title: "Controle de acesso por papel", icon: "lock" },
];

const losses = [
  {
    title: "Sinais de compra desaparecem",
    text: "O cliente fala uma frase decisiva, o time nao registra e a oportunidade vira palpite no CRM.",
  },
  {
    title: "Objecoes viram ruido",
    text: "Preco, prazo, seguranca e autoridade aparecem na conversa, mas ninguem transforma isso em movimento comercial.",
  },
  {
    title: "Reuniao boa nao escala",
    text: "O melhor vendedor faz perguntas excelentes, mas esse padrao fica preso na cabeca dele.",
  },
  {
    title: "Gestor chega tarde",
    text: "A lideranca descobre o problema no forecast, quando a chamada que poderia salvar o deal ja acabou.",
  },
];

const sdrSteps = [
  {
    title: "Abertura com contexto do lead",
    detail:
      "Antes do SDR falar, Coevo mostra origem, dor provavel, setor, cargo e o historico que importa. A abertura deixa de ser fria.",
    screen: "Lead score 84 | Segmento SaaS B2B | Dor provavel: perda de follow-up",
  },
  {
    title: "Perguntas sugeridas conforme dor",
    detail:
      "Enquanto o prospect responde, a IA sugere perguntas que aprofundam impacto, urgencia e criterio de decisao.",
    screen: "Pergunte agora: quanto tempo o time perde recuperando contexto?",
  },
  {
    title: "Alertas quando o prospect foge do ICP",
    detail:
      "Se o lead nao tem budget, autoridade ou fit, o SDR recebe alerta discreto para qualificar sem desperdicar agenda.",
    screen: "Alerta ICP: sem decisor na sala | Risco: medio | Proxima acao: validar autoridade",
  },
  {
    title: "Resumo pronto para handoff",
    detail:
      "O closer recebe contexto claro, com dores, objecoes, prioridades e frases reais do prospect. Nada chega mastigado pela memoria.",
    screen: "Handoff: dor financeira + urgencia alta + integracao CRM como criterio",
  },
  {
    title: "Proxima acao recomendada",
    detail:
      "Coevo recomenda o proximo passo, o argumento central e o material que deve ir no follow-up.",
    screen: "Enviar case ROI + agendar demo tecnica + confirmar decisor economico",
  },
];

const companyBenefits = [
  {
    label: "Receita",
    text: "Padroniza conversas comerciais sem engessar o time e aumenta a chance de cada call virar avanco real.",
  },
  {
    label: "Operacao",
    text: "Reduz perda de contexto entre reuniao, CRM e follow-up, tirando trabalho invisivel da equipe.",
  },
  {
    label: "Treinamento",
    text: "Acelera onboarding de novos vendedores com exemplos reais, objecoes reais e playbooks vivos.",
  },
  {
    label: "Gestao",
    text: "Cria inteligencia coletiva a partir de cada chamada e mostra onde o time esta ganhando ou sangrando.",
  },
  {
    label: "Governanca",
    text: "Melhora compliance, rastreabilidade e controle de acesso em conversas sensiveis.",
  },
  {
    label: "Decisao",
    text: "Aumenta qualidade da decisao em deals complexos, com dados vivos em vez de opiniao solta.",
  },
];

const publicBenefits = [
  {
    label: "Times internos",
    text: "Reunioes entre secretarias, diretorias, coordenacoes e equipes tecnicas com memoria clara do que foi decidido.",
  },
  {
    label: "Auditoria",
    text: "Reunioes sensiveis com trilha, horario, participantes, papeis e resumo institucional para prestacao de contas.",
  },
  {
    label: "Rede escolar",
    text: "Encontros entre gestores escolares, equipes pedagogicas, secretarias e regionais sem perder contexto entre uma pauta e outra.",
  },
  {
    label: "Gestao",
    text: "Planos, metas, problemas e encaminhamentos ficam registrados para que a execucao nao dependa de anotacoes soltas.",
  },
  {
    label: "Eficiencia",
    text: "Reducao de deslocamentos internos, retrabalho, reunioes repetidas e desalinhamento entre areas.",
  },
  {
    label: "Padrao",
    text: "Orientacoes internas padronizadas com base oficial, reduzindo improviso em reunioes de gestao.",
  },
];

const securityLayers = [
  "Dados, transcricoes, reunioes e arquivos criptografados em repouso e em transito",
  "Conteudo corporativo isolado, sem compartilhamento aberto com IAs externas",
  "Armazenamento protegido para impedir acesso indevido a dados sensiveis",
  "Controle interno de acesso por papel, permissao e nivel de responsabilidade",
  "Auditoria de quem acessou reunioes, transcricoes, arquivos e historicos",
  "Backups automaticos para evitar perda de dados e preservar continuidade",
];

type PricingPlan = {
  name: string;
  price: string;
  unit: string;
  users?: string;
  description: string;
  details?: string[];
  items: string[];
  limits?: string[];
  cta: string;
  microcopy?: string;
  featured?: boolean;
  badge?: string;
};

const plans: PricingPlan[] = [
  {
    name: "Teste Gratis",
    price: "R$ 0",
    unit: "degustacao",
    description: "Experimente o Coevo Meet completo em uma reuniao real.",
    details: [
      "Todos os recursos liberados para demonstracao",
      "Usuarios liberados para testar",
      "1 reuniao por semana",
      "Ate 30 minutos por reuniao",
      "Historico disponivel por 48h",
    ],
    items: [
      "IA que participa on-line da reuniao",
      "Responde por voz em tempo real",
      "Painel privado",
      "Cards de objecao, risco e oportunidade",
      "Resumo automatico",
      "Proximos passos",
      "Transcricao",
      "Follow-up sugerido",
    ],
    limits: [
      "1 reuniao por semana",
      "Ate 30 minutos",
      "Historico por 48h",
      "1 workspace gratuito por empresa",
      "Sem integracoes permanentes",
      "Sem suporte prioritario",
      "Sem SLA",
      "Sem uso recorrente em operacao comercial",
    ],
    cta: "Testar gratis",
    microcopy:
      "O plano gratuito e destinado a demonstracao do produto. Para uso recorrente, historico permanente, integracoes e gestao de equipe, escolha um plano pago.",
  },
  {
    name: "Essencial",
    price: "R$ 490",
    unit: "/mes",
    users: "ate 5 usuarios",
    description:
      "Para times pequenos que querem reunioes assistidas por IA, registro automatico, resumo, proximos passos e memoria basica das conversas.",
    items: [
      "IA que participa on-line da reuniao",
      "Responde por voz em tempo real",
      "Registro automatico da conversa",
      "Resumo automatico",
      "Proximos passos",
      "Memoria basica das reunioes",
      "Historico permanente",
      "Base de conhecimento inicial",
    ],
    cta: "Comecar com Essencial",
  },
  {
    name: "Business",
    price: "R$ 1.990",
    unit: "/mes",
    users: "ate 15 usuarios",
    description:
      "Para equipes comerciais e operacoes consultivas que precisam de IA ao vivo, voz, painel privado, cards de objecao, padronizacao e follow-up inteligente.",
    items: [
      "Tudo do Essencial",
      "IA ao vivo com voz",
      "Painel privado",
      "Cards de objecao, risco e oportunidade",
      "Follow-up inteligente",
      "Recomendacoes comerciais ao vivo",
      "Personalidade treinavel do agente",
      "Base por reuniao antes da chamada",
      "Handoff para SDR e closer",
      "Relatorios de reuniao",
      "Insights para lideranca",
      "Padronizacao de reunioes criticas",
      "Treinamento de equipes",
      "Inteligencia gerencial",
      "Playbooks por area",
    ],
    featured: true,
    badge: "Mais recomendado",
    cta: "Implantar no comercial",
  },
  {
    name: "Enterprise",
    price: "Sob Medida",
    unit: "",
    users: "sob medida",
    description:
      "Para empresas, grupos, setor publico e operacoes que precisam de governanca, integracoes, compliance, ambientes dedicados e implantacao assistida.",
    items: [
      "Tudo do Business",
      "SSO e permissoes avancadas",
      "Integracoes com CRM e BI",
      "Compliance e governanca",
      "Ambientes dedicados",
      "Implantacao assistida",
      "Logs e auditoria expandida",
      "Painel executivo",
      "SLA corporativo",
      "Suporte prioritario",
      "Politicas corporativas de IA",
    ],
    cta: "Falar com especialista",
  },
];

function FeatureIcon({ icon }: { icon: string }) {
  const common =
    "relative grid h-14 w-14 place-items-center rounded-2xl border border-[#C8A45D]/35 bg-[#F5C76B]/10 text-[#F5C76B] shadow-[0_0_60px_rgba(200,164,93,.14)]";

  if (icon === "orb") {
    return (
      <span className={common}>
        <span className="h-6 w-6 rounded-full bg-[#F5C76B]" />
        <span className="absolute inset-2 rounded-full border border-[#F5C76B]/35 [animation:ping_2.4s_cubic-bezier(0,0,.2,1)_infinite]" />
      </span>
    );
  }

  if (icon === "voice") {
    return (
      <span className={common}>
        <span className="h-7 w-1 rounded-full bg-[#F5C76B] [animation:pulse_1.2s_ease-in-out_infinite]" />
        <span className="ml-1 h-10 w-1 rounded-full bg-[#F5C76B]/70 [animation:pulse_1.5s_ease-in-out_infinite]" />
        <span className="ml-1 h-5 w-1 rounded-full bg-[#F5C76B]/50 [animation:pulse_1s_ease-in-out_infinite]" />
      </span>
    );
  }

  if (icon === "lines") {
    return (
      <span className={common}>
        <span className="grid w-8 gap-1">
          <span className="h-1 w-8 rounded-full bg-[#F5C76B]" />
          <span className="h-1 w-6 rounded-full bg-[#F5C76B]/70 [animation:pulse_1.4s_ease-in-out_infinite]" />
          <span className="h-1 w-7 rounded-full bg-[#F5C76B]/45" />
        </span>
      </span>
    );
  }

  if (icon === "panel") {
    return (
      <span className={common}>
        <span className="grid h-8 w-8 grid-cols-[1fr_10px] gap-1">
          <span className="rounded-md bg-[#F5C76B]/80" />
          <span className="grid gap-1">
            <span className="rounded bg-[#60A5FA]/80" />
            <span className="rounded bg-[#10B981]/80" />
          </span>
        </span>
      </span>
    );
  }

  if (icon === "cards") {
    return (
      <span className={common}>
        <span className="absolute h-7 w-8 -rotate-6 rounded-lg border border-[#EF4444]/60 bg-[#EF4444]/20" />
        <span className="absolute h-7 w-8 rotate-6 rounded-lg border border-[#10B981]/60 bg-[#10B981]/20 [animation:pulse_1.8s_ease-in-out_infinite]" />
      </span>
    );
  }

  if (icon === "database") {
    return (
      <span className={common}>
        <span className="grid gap-1">
          <span className="h-2 w-8 rounded-full bg-[#F5C76B]" />
          <span className="h-2 w-8 rounded-full bg-[#F5C76B]/70" />
          <span className="h-2 w-8 rounded-full bg-[#F5C76B]/45" />
        </span>
      </span>
    );
  }

  if (icon === "folder") {
    return (
      <span className={common}>
        <span className="h-7 w-9 rounded-lg rounded-tl-sm bg-[#F5C76B]" />
        <span className="absolute left-4 top-4 h-2 w-5 rounded-t bg-[#F5C76B]/70" />
      </span>
    );
  }

  if (icon === "sliders") {
    return (
      <span className={common}>
        <span className="grid w-8 gap-2">
          <span className="h-px w-8 bg-[#F5C76B]" />
          <span className="h-px w-8 bg-[#F5C76B]" />
          <span className="h-px w-8 bg-[#F5C76B]" />
        </span>
        <span className="absolute left-6 top-4 h-3 w-3 rounded-full bg-[#F5C76B] [animation:pulse_1.5s_ease-in-out_infinite]" />
        <span className="absolute right-5 top-7 h-3 w-3 rounded-full bg-[#60A5FA]" />
      </span>
    );
  }

  if (icon === "timeline") {
    return (
      <span className={common}>
        <span className="h-8 w-px bg-[#F5C76B]/60" />
        <span className="absolute top-3 h-3 w-3 rounded-full bg-[#F5C76B]" />
        <span className="absolute bottom-3 h-3 w-3 rounded-full bg-[#60A5FA] [animation:pulse_1.6s_ease-in-out_infinite]" />
      </span>
    );
  }

  if (icon === "camera") {
    return (
      <span className={common}>
        <span className="h-7 w-9 rounded-lg border border-[#F5C76B] bg-[#F5C76B]/15" />
        <span className="absolute right-3 h-4 w-4 rotate-45 rounded-sm bg-[#F5C76B]" />
      </span>
    );
  }

  if (icon === "screen") {
    return (
      <span className={common}>
        <span className="h-7 w-9 rounded-md border border-[#F5C76B] bg-[#F5C76B]/10" />
        <span className="absolute bottom-3 h-px w-7 bg-[#F5C76B]" />
      </span>
    );
  }

  return (
    <span className={common}>
      <span className="h-8 w-6 rounded-md border border-[#F5C76B]" />
      <span className="absolute top-4 h-4 w-5 rounded-t-full border border-b-0 border-[#F5C76B]" />
    </span>
  );
}

type CoevoMeetLandingProps = {
  isMeetingEnded: boolean;
};

export default function CoevoMeetLanding({
  isMeetingEnded,
}: CoevoMeetLandingProps) {
  const [activeSdrStep, setActiveSdrStep] = useState(0);
  const selectedSdrStep = sdrSteps[activeSdrStep];

  return (
    <main className="min-h-screen overflow-hidden bg-[#0B0D12] text-[#FAF7EF]">
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes voice-orb-core {
          0%, 100% { transform: scale(.94); box-shadow: 0 0 22px rgba(245,199,107,.26), inset 0 0 18px rgba(245,199,107,.16); }
          45% { transform: scale(1.06); box-shadow: 0 0 58px rgba(245,199,107,.42), inset 0 0 28px rgba(245,199,107,.26); }
          70% { transform: scale(.99); box-shadow: 0 0 36px rgba(245,199,107,.34), inset 0 0 20px rgba(245,199,107,.20); }
        }
        @keyframes voice-orb-ring {
          0% { transform: scale(.72); opacity: .62; }
          70% { transform: scale(1.42); opacity: .08; }
          100% { transform: scale(1.55); opacity: 0; }
        }
        @keyframes voice-orb-bar {
          0%, 100% { transform: scaleY(.45); opacity: .58; }
          35% { transform: scaleY(1); opacity: 1; }
          65% { transform: scaleY(.68); opacity: .74; }
        }
      `}</style>
      <div className="fixed inset-0 pointer-events-none opacity-[0.055] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_12%_18%,rgba(245,199,107,.20),transparent_30%),radial-gradient(circle_at_82%_10%,rgba(96,165,250,.13),transparent_26%),radial-gradient(circle_at_72%_82%,rgba(200,164,93,.15),transparent_32%),linear-gradient(180deg,#0B0D12_0%,#111827_48%,#0B0D12_100%)]" />

      <section className="relative mx-auto max-w-[1440px] border-x border-white/10 bg-[#0B0D12]/80 shadow-[0_30px_120px_rgba(0,0,0,.45)]">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0B0D12]/72 backdrop-blur-xl">
          <div className="flex items-center justify-between px-6 py-4 md:px-8">
            <Link className="flex items-center gap-3" href="/">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#C8A45D] to-[#F5C76B] font-display text-lg font-bold text-[#0B0D12] shadow-[0_0_60px_rgba(200,164,93,.20)]">
                C
              </span>
              <span>
                <span className="block font-display text-lg font-semibold">
                  Coevo Meet
                </span>
                <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#C8A45D]">
                  AI meeting system
                </span>
              </span>
            </Link>

            <Link
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-[#FAF7EF] transition hover:border-[#C8A45D] hover:bg-[#C8A45D] hover:text-[#0B0D12]"
              href="/"
            >
              Criar nova reuniao
            </Link>
          </div>
        </header>

        <section className="grid min-h-[calc(100vh-73px)] items-center gap-10 px-6 py-16 md:grid-cols-[minmax(0,1.05fr)_minmax(360px,.95fr)] md:px-10 lg:px-16">
          <div>
            {isMeetingEnded ? (
              <p className="mb-5 inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-[#F5C76B]">
                Reuniao encerrada
              </p>
            ) : null}
            <h1 className="max-w-4xl font-display text-5xl font-semibold leading-[1.02] text-[#FAF7EF] md:text-7xl">
              Sua empresa ainda faz videochamada como se fosse 2018?
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#A8B0BF]">
              Coevo Meet e uma plataforma corporativa para reunioes assistidas
              em tempo real por IA. Nao e mais uma sala de video. E um sistema
              de inteligencia para cada conversa importante.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="rounded-xl bg-gradient-to-r from-[#C8A45D] to-[#F5C76B] px-6 py-4 text-center text-sm font-extrabold text-[#0B0D12] shadow-[0_0_60px_rgba(200,164,93,.20)] transition hover:translate-y-[-1px]"
                href="/"
              >
                Testar Coevo Meet agora
              </Link>
              <a
                className="rounded-xl border border-white/15 bg-white/5 px-6 py-4 text-center text-sm font-bold text-[#FAF7EF] transition hover:border-[#60A5FA] hover:bg-white/10"
                href="#planos"
              >
                Ver planos corporativos
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              {metrics.map((metric) => (
                <span
                  className="rounded-full border border-white/15 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#FAF7EF]/70"
                  key={metric}
                >
                  {metric}
                </span>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-8 rounded-[2rem] bg-[#C8A45D]/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/15 bg-white/[.06] p-5 shadow-[0_30px_120px_rgba(0,0,0,.45)] backdrop-blur-2xl">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#F5C76B] to-transparent [animation:pulse_2.4s_ease-in-out_infinite]" />
              <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#F5C76B]">
                    Live intelligence
                  </p>
                  <p className="mt-1 font-display text-xl font-semibold">
                    Reuniao em andamento
                  </p>
                </div>
                <span className="rounded-full border border-[#10B981]/35 bg-[#10B981]/10 px-3 py-1 text-xs font-bold text-[#10B981]">
                  IA ativa
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="min-h-56 rounded-2xl border border-white/10 bg-[#111827] p-4 transition duration-500 hover:-translate-y-1 hover:border-[#F5C76B]/50">
                  <div className="mb-3 h-28 overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_45%,rgba(245,199,107,.38),transparent_35%),#0B0D12]">
                    <div className="h-full w-full bg-[linear-gradient(120deg,transparent,rgba(255,255,255,.14),transparent)] [animation:ping_3s_cubic-bezier(0,0,.2,1)_infinite]" />
                  </div>
                  <p className="font-semibold">Cliente questiona ROI</p>
                  <p className="mt-2 text-sm leading-6 text-[#A8B0BF]">
                    Coevo detecta objecao financeira e prepara resposta baseada
                    no case correto.
                  </p>
                </div>

                <div className="min-h-56 rounded-2xl border border-white/10 bg-[#111827] p-4 transition duration-500 hover:-translate-y-1 hover:border-[#60A5FA]/50">
                  <div className="mb-3 grid h-28 place-items-center overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_50%,rgba(245,199,107,.16),transparent_36%),#0B0D12]">
                    <span className="relative grid h-20 w-20 place-items-center rounded-full">
                      <span className="absolute inset-0 rounded-full border border-[#F5C76B]/40 [animation:voice-orb-ring_2.4s_ease-out_infinite]" />
                      <span className="absolute inset-0 rounded-full border border-[#C8A45D]/35 [animation:voice-orb-ring_2.4s_ease-out_.55s_infinite]" />
                      <span className="absolute inset-[-10px] rounded-full border border-[#F97316]/20 [animation:voice-orb-ring_2.4s_ease-out_1.1s_infinite]" />
                      <span className="absolute inset-[10px] rounded-full bg-[#F5C76B]/10 blur-xl" />
                      <span className="relative grid h-14 w-14 place-items-center rounded-full border border-[#F5C76B]/70 bg-[#0B0D12] [animation:voice-orb-core_1.8s_ease-in-out_infinite]">
                        <span className="flex h-7 items-center gap-1.5">
                          <span className="h-5 w-1.5 rounded-full bg-[#F5C76B] [animation:voice-orb-bar_.82s_ease-in-out_infinite]" />
                          <span className="h-7 w-1.5 rounded-full bg-[#F5C76B] [animation:voice-orb-bar_.96s_ease-in-out_.12s_infinite]" />
                          <span className="h-4 w-1.5 rounded-full bg-[#F5C76B] [animation:voice-orb-bar_.74s_ease-in-out_.22s_infinite]" />
                        </span>
                      </span>
                    </span>
                  </div>
                  <p className="font-semibold">Copiloto privado</p>
                  <p className="mt-2 text-sm leading-6 text-[#A8B0BF]">
                    Sugestoes aparecem para o comercial sem vazar para o cliente.
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-[#FAF7EF] p-4 text-[#0B0D12]">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#C8A45D]">
                  Proxima melhor acao
                </p>
                <p className="mt-2 text-lg font-bold">
                  Mostre o ganho operacional antes de discutir preco.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden border-t border-white/10 py-5">
          <div className="flex min-w-max gap-3 px-6 font-mono text-xs uppercase tracking-[0.18em] text-[#F5C76B] [animation:marquee_28s_linear_infinite]">
            {[...features, ...features].map((feature, index) => (
              <span
                className="rounded-full border border-white/10 bg-white/[.04] px-4 py-2"
                key={`${feature.title}-${index}`}
              >
                {feature.title}
              </span>
            ))}
          </div>
        </section>

        <section className="border-t border-white/10 px-6 py-16 md:px-10 lg:px-16">
          <div className="mb-8 max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#F5C76B]">
              Features
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold">
              Tudo que uma reuniao critica deveria ter desde o primeiro minuto.
            </h2>
            <p className="mt-4 text-lg leading-8 text-[#A8B0BF]">
              Video, contexto, memoria, controle e inteligencia comercial no
              mesmo fluxo. A chamada deixa de ser evento e vira ativo.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <article
                className="group rounded-2xl border border-white/10 bg-white/[.055] p-5 transition duration-500 hover:-translate-y-1 hover:border-[#C8A45D]/60 hover:bg-white/[.08]"
                key={feature.title}
              >
                <div className="flex items-start justify-between gap-4">
                  <FeatureIcon icon={feature.icon} />
                  <span className="font-mono text-xs text-[#F5C76B]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <p className="mt-6 font-display text-2xl font-semibold">
                  {feature.title}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-white/10 px-6 py-16 md:px-10 lg:px-16">
          <div className="grid gap-8 lg:grid-cols-[.9fr_1.1fr]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#F5C76B]">
                O prejuizo invisivel
              </p>
              <h2 className="mt-3 font-display text-4xl font-semibold">
                O que se perde com videochamadas normais?
              </h2>
              <p className="mt-5 text-lg leading-8 text-[#A8B0BF]">
                Quase tudo que importa: contexto, sinais, objecoes, autoridade,
                urgencia, risco e a frase exata que poderia virar contrato.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {losses.map((loss) => (
                <article
                  className="rounded-2xl border border-[#EF4444]/25 bg-[#EF4444]/[.08] p-5 transition duration-500 hover:border-[#EF4444]/60 hover:bg-[#EF4444]/[.12]"
                  key={loss.title}
                >
                  <p className="font-display text-xl font-semibold text-[#FAF7EF]">
                    {loss.title}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[#A8B0BF]">
                    {loss.text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 px-6 py-16 md:px-10 lg:px-16">
          <div className="mb-8 max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#F5C76B]">
              SDRs
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold">
              Ideal para SDRs que nao podem desperdicar uma conversa.
            </h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.05fr_1.15fr]">
            <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#FAF7EF] p-6 text-[#0B0D12] shadow-[0_30px_120px_rgba(0,0,0,.30)]">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#C8A45D] via-[#F5C76B] to-[#60A5FA]" />
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#C8A45D]">
                Tela do sistema
              </p>
              <div className="mt-5 rounded-2xl border border-[#0B0D12]/10 bg-[#0B0D12] p-4 text-[#FAF7EF]">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#F5C76B]">
                    Coevo SDR cockpit
                  </span>
                  <span className="rounded-full bg-[#10B981]/15 px-3 py-1 text-xs font-bold text-[#10B981]">
                    Ao vivo
                  </span>
                </div>

                <div className="mt-5 grid gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/[.06] p-4">
                    <p className="font-display text-2xl font-semibold">
                      {selectedSdrStep.title}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[#A8B0BF]">
                      {selectedSdrStep.screen}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {["Fit", "Dor", "Acao"].map((item, index) => (
                      <div
                        className="rounded-xl border border-white/10 bg-white/[.05] p-3"
                        key={item}
                      >
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A8B0BF]">
                          {item}
                        </span>
                        <div className="mt-3 h-2 rounded-full bg-white/10">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-[#C8A45D] to-[#F5C76B] transition-all duration-500"
                            style={{
                              width: `${68 + activeSdrStep * 5 + index * 4}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-[#C8A45D]/25 bg-[#C8A45D]/10 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#F5C76B]">
                      Recomendacao privada
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#FAF7EF]">
                      {selectedSdrStep.detail}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {sdrSteps.map((step, index) => (
                <button
                  className={`w-full rounded-2xl border p-4 text-left transition duration-500 hover:translate-x-2 ${
                    activeSdrStep === index
                      ? "border-[#F5C76B]/70 bg-[#F5C76B]/10"
                      : "border-white/10 bg-white/[.055] hover:border-[#60A5FA]/50"
                  }`}
                  key={step.title}
                  onClick={() => setActiveSdrStep(index)}
                  type="button"
                >
                  <span className="flex items-center gap-4">
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-mono text-xs ${
                        activeSdrStep === index
                          ? "bg-[#F5C76B] text-[#0B0D12]"
                          : "bg-[#60A5FA]/15 text-[#60A5FA]"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="font-semibold">{step.title}</span>
                  </span>
                  <span
                    className={`grid overflow-hidden pl-14 text-sm leading-6 text-[#A8B0BF] transition-all duration-500 ${
                      activeSdrStep === index
                        ? "mt-3 max-h-32 opacity-100"
                        : "max-h-0 opacity-0"
                    }`}
                  >
                    {step.detail}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 px-6 py-16 md:px-10 lg:px-16">
          <div className="grid items-center gap-10 lg:grid-cols-[.95fr_1.05fr]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#F5C76B]">
                Empresas
              </p>
              <h2 className="mt-3 font-display text-4xl font-semibold md:text-5xl">
                A empresa deixa de depender da memoria do vendedor.
              </h2>
              <p className="mt-5 text-lg leading-8 text-[#A8B0BF]">
                Coevo captura o que hoje escapa: sinais de compra, perguntas
                sem resposta, riscos, promessas feitas, pontos de autoridade e
                proximos passos. O gestor para de operar no escuro.
              </p>

              <div className="mt-8 grid grid-cols-3 gap-3">
                {["+ contexto", "+ padrao", "+ receita"].map((item) => (
                  <div
                    className="rounded-2xl border border-[#C8A45D]/25 bg-[#C8A45D]/10 p-4 text-center"
                    key={item}
                  >
                    <p className="font-display text-2xl font-semibold text-[#F5C76B]">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {companyBenefits.map((benefit) => (
                <article
                  className="rounded-2xl border border-white/10 bg-white/[.055] p-5 transition duration-500 hover:-translate-y-1 hover:border-[#C8A45D]/60 hover:bg-white/[.08]"
                  key={benefit.label}
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#F5C76B]">
                    {benefit.label}
                  </p>
                  <p className="mt-4 text-sm leading-6 text-[#A8B0BF]">
                    {benefit.text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative border-t border-white/10 px-6 py-16 md:px-10 lg:px-16">
          <div className="absolute inset-y-10 right-0 w-1/2 rounded-l-[4rem] bg-[#10B981]/[.06] blur-3xl" />
          <div className="relative grid items-center gap-10 lg:grid-cols-[1.05fr_.95fr]">
            <div className="order-2 grid gap-4 sm:grid-cols-2 lg:order-1">
              {publicBenefits.map((benefit) => (
                <article
                  className="rounded-2xl border border-[#10B981]/20 bg-[#10B981]/[.07] p-5 transition duration-500 hover:-translate-y-1 hover:border-[#10B981]/60"
                  key={benefit.label}
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#10B981]">
                    {benefit.label}
                  </p>
                  <p className="mt-4 text-sm leading-6 text-[#A8B0BF]">
                    {benefit.text}
                  </p>
                </article>
              ))}
            </div>

            <div className="order-1 lg:order-2">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#10B981]">
                Setor publico
              </p>
              <h2 className="mt-3 font-display text-4xl font-semibold md:text-5xl">
                Reunioes internas do setor publico com memoria, auditoria e
                execucao.
              </h2>
              <p className="mt-5 text-lg leading-8 text-[#A8B0BF]">
                Para orgaos, secretarias, equipes internas e redes escolares
                que precisam alinhar times, acompanhar decisoes e preservar
                conhecimento institucional. Coevo nao e atendimento ao cidadao:
                e inteligencia para reunioes de gestao, coordenacao e execucao.
              </p>

              <div className="mt-8 rounded-[1.5rem] border border-[#10B981]/25 bg-[#0B0D12]/70 p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#10B981]">
                  Impacto operacional
                </p>
                <div className="mt-5 grid gap-3">
                  {["Menos desalinhamento", "Mais continuidade", "Mais governanca"].map(
                    (item) => (
                      <div
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[.04] px-4 py-3"
                        key={item}
                      >
                        <span className="text-sm font-semibold">{item}</span>
                        <span className="h-2 w-24 rounded-full bg-gradient-to-r from-[#10B981] to-[#60A5FA]" />
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 px-6 py-16 md:px-10 lg:px-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_.9fr]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#F5C76B]">
                Seguranca dos dados
              </p>
              <h2 className="mt-3 font-display text-4xl font-semibold md:text-5xl">
                Reuniao corporativa tem dado sensivel. Aqui ele nao vira
                territorio aberto.
              </h2>
              <p className="mt-5 text-lg leading-8 text-[#A8B0BF]">
                Transcricoes, reunioes armazenadas, arquivos, historicos e
                informacoes sensiveis precisam ser protegidos por desenho. A
                proposta do Coevo e manter dados criptografados, armazenados com
                seguranca, isolados por cliente e acessiveis apenas por quem
                realmente tem permissao interna.
              </p>
              <p className="mt-4 text-lg leading-8 text-[#A8B0BF]">
                E mais: backups automaticos preservam continuidade e reduzem a
                chance de perda de dados. O cliente nao pode correr o risco de
                perder a memoria das suas reunioes.
              </p>
            </div>

            <div className="relative min-h-[420px] rounded-[1.75rem] border border-white/10 bg-[#111827] p-6 shadow-[0_30px_120px_rgba(0,0,0,.45)]">
              <div className="absolute inset-8 rounded-full border border-[#C8A45D]/20 [animation:ping_3s_cubic-bezier(0,0,.2,1)_infinite]" />
              <div className="absolute inset-20 rounded-full border border-[#60A5FA]/20 [animation:pulse_2.4s_ease-in-out_infinite]" />
              <div className="relative z-10 grid h-full content-center gap-3">
                {securityLayers.map((layer) => (
                  <div
                    className="rounded-xl border border-white/10 bg-[#0B0D12]/75 px-4 py-3 text-sm font-semibold backdrop-blur-xl"
                    key={layer}
                  >
                    {layer}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 px-6 py-16 md:px-10 lg:px-16">
          <div className="mb-8 max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#F5C76B]">
              Comparativo brutal
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold">
              O concorrente te da video. Coevo Meet te da vantagem.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {comparisons.map((item) => (
              <article
                className="rounded-2xl border border-white/10 bg-white/[.06] p-5 backdrop-blur-xl transition duration-500 hover:-translate-y-1 hover:border-[#C8A45D]/60"
                key={item.old}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#A8B0BF]">
                  Antes: {item.old}
                </p>
                <p className="mt-2 font-display text-2xl font-semibold text-[#F5C76B]">
                  Depois: {item.coevo}
                </p>
                <p className="mt-4 text-sm leading-6 text-[#A8B0BF]">
                  {item.detail}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section
          className="border-t border-white/10 px-6 py-16 md:px-10 lg:px-16"
          id="planos"
        >
          <div className="mb-8 max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#F5C76B]">
              Planos
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold">
              Pague por reunioes que trabalham. Nao por chamadas que somem.
            </h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                className={`flex rounded-2xl border p-6 transition duration-500 hover:-translate-y-1 ${
                  plan.featured
                    ? "border-[#C8A45D] bg-[#FAF7EF] text-[#0B0D12] shadow-[0_0_60px_rgba(200,164,93,.20)]"
                    : "border-white/10 bg-white/[.06] text-[#FAF7EF]"
                } flex-col`}
                key={plan.name}
              >
                <div className="flex min-h-12 items-start justify-between gap-3">
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#C8A45D]">
                    {plan.name}
                  </p>
                  {plan.badge ? (
                    <span className="rounded-full bg-[#C8A45D] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#0B0D12]">
                      {plan.badge}
                    </span>
                  ) : null}
                </div>
                <div className="mt-4">
                  <span className="font-display text-3xl font-semibold xl:text-4xl">
                    {plan.price}
                  </span>
                  <span
                    className={`ml-2 text-sm ${
                      plan.featured ? "text-[#374151]" : "text-[#A8B0BF]"
                    }`}
                  >
                    {plan.unit}
                  </span>
                </div>
                {plan.users ? (
                  <p
                    className={`mt-2 text-xs font-semibold uppercase tracking-[0.14em] ${
                      plan.featured ? "text-[#C8A45D]" : "text-[#F5C76B]"
                    }`}
                  >
                    {plan.users}
                  </p>
                ) : null}
                <p
                  className={`mt-4 text-sm leading-6 ${
                    plan.featured ? "text-[#374151]" : "text-[#A8B0BF]"
                  }`}
                >
                  {plan.description}
                </p>
                {plan.details ? (
                  <div
                    className={`mt-5 rounded-xl border p-4 ${
                      plan.featured
                        ? "border-[#0B0D12]/10 bg-[#0B0D12]/[.04]"
                        : "border-white/10 bg-[#0B0D12]/40"
                    }`}
                  >
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#C8A45D]">
                      Detalhes principais
                    </p>
                    <ul className="mt-3 space-y-2">
                      {plan.details.map((item) => (
                        <li className="flex gap-2 text-xs leading-5" key={item}>
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <ul className="mt-6 space-y-3">
                  {plan.items.map((item) => (
                    <li className="flex gap-3 text-sm font-normal" key={item}>
                      <span className="mt-1 h-2 w-2 rounded-full bg-[#10B981]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                {plan.limits ? (
                  <div className="mt-6">
                    <p
                      className={`font-mono text-[10px] uppercase tracking-[0.18em] ${
                        plan.featured ? "text-[#C8A45D]" : "text-[#F5C76B]"
                      }`}
                    >
                      Limites
                    </p>
                    <ul className="mt-3 space-y-2">
                      {plan.limits.map((item) => (
                        <li
                          className={`flex gap-2 text-xs leading-5 ${
                            plan.featured ? "text-[#374151]" : "text-[#A8B0BF]"
                          }`}
                          key={item}
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#EF4444]" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {plan.microcopy ? (
                  <p
                    className={`mt-6 rounded-xl border p-3 text-xs leading-5 ${
                      plan.featured
                        ? "border-[#0B0D12]/10 text-[#374151]"
                        : "border-white/10 text-[#A8B0BF]"
                    }`}
                  >
                    {plan.microcopy}
                  </p>
                ) : null}
                <Link
                  className={`mt-6 inline-flex w-full justify-center rounded-xl px-4 py-3 text-center text-sm font-bold transition ${
                    plan.featured
                      ? "bg-[#0B0D12] text-[#FAF7EF] hover:bg-[#1F2937]"
                      : "border border-white/15 bg-white/5 text-[#FAF7EF] hover:border-[#C8A45D] hover:bg-[#C8A45D] hover:text-[#0B0D12]"
                  } ${plan.microcopy ? "" : "mt-auto"}`}
                  href="/"
                >
                  {plan.cta}
                </Link>
              </article>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-4xl text-center text-sm leading-7 text-[#A8B0BF]">
            O Coevo Meet pode ser testado gratuitamente com todos os recursos
            liberados em uma reuniao de ate 30 minutos por semana. Quando suas
            reunioes virarem operacao, escolha um plano com historico
            permanente, gestao de equipe, integracoes e suporte.
          </p>
        </section>

        <section className="border-t border-white/10 px-6 py-16 md:px-10 lg:px-16">
          <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#F5C76B]">
                Planos em uma linha
              </p>
              <h2 className="mt-3 font-display text-4xl font-semibold">
                Compare rapido e escolha onde sua operacao entra.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-7 text-[#A8B0BF]">
              A degustacao prova o valor. Os planos pagos transformam reuniao em
              rotina operacional, com historico, gestao, integracoes e suporte.
            </p>
          </div>

          <div className="overflow-hidden pb-3">
            <div className="group/pricing grid gap-4 lg:flex lg:items-stretch">
              {plans.map((plan) => (
                <article
                  className={`flex min-h-[460px] flex-col rounded-2xl border p-5 transition-[flex,transform,opacity,box-shadow,border-color] duration-500 ease-out lg:flex-1 lg:group-hover/pricing:opacity-75 lg:hover:flex-[1.42] lg:hover:-translate-y-2 lg:hover:opacity-100 ${
                    plan.featured
                      ? "border-[#C8A45D] bg-[#FAF7EF] text-[#0B0D12] shadow-[0_0_60px_rgba(200,164,93,.20)]"
                      : "border-white/10 bg-white/[.06] text-[#FAF7EF]"
                  }`}
                  key={`inline-${plan.name}`}
                >
                  <div className="flex min-h-12 items-start justify-between gap-3">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#C8A45D]">
                      {plan.name}
                    </p>
                    {plan.badge ? (
                      <span className="rounded-full bg-[#C8A45D] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#0B0D12]">
                        {plan.badge}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4">
                    <span className="font-display text-3xl font-semibold">
                      {plan.price}
                    </span>
                    <span
                      className={`ml-2 text-sm ${
                        plan.featured ? "text-[#374151]" : "text-[#A8B0BF]"
                      }`}
                    >
                      {plan.unit}
                    </span>
                  </div>

                  <p
                    className={`mt-2 text-xs font-semibold uppercase tracking-[0.14em] ${
                      plan.featured ? "text-[#C8A45D]" : "text-[#F5C76B]"
                    }`}
                  >
                    {plan.users ?? "usuarios liberados para testar"}
                  </p>

                  <p
                    className={`mt-4 text-sm leading-6 ${
                      plan.featured ? "text-[#374151]" : "text-[#A8B0BF]"
                    }`}
                  >
                    {plan.description}
                  </p>

                  <ul className="mt-6 space-y-3">
                    {plan.items.slice(0, 5).map((item) => (
                      <li className="flex gap-3 text-sm font-normal" key={item}>
                        <span className="mt-1 h-2 w-2 rounded-full bg-[#10B981]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    className={`mt-auto inline-flex w-full justify-center rounded-xl px-4 py-3 text-center text-sm font-bold transition ${
                      plan.featured
                        ? "bg-[#0B0D12] text-[#FAF7EF] hover:bg-[#1F2937]"
                        : "border border-white/15 bg-white/5 text-[#FAF7EF] hover:border-[#C8A45D] hover:bg-[#C8A45D] hover:text-[#0B0D12]"
                    }`}
                    href="/"
                  >
                    {plan.cta}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 px-6 py-16 text-center md:px-10 lg:px-16">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#F5C76B]">
            A proxima reuniao pode ser comum. Ou pode virar inteligencia.
          </p>
          <h2 className="mx-auto mt-4 max-w-4xl font-display text-4xl font-semibold md:text-6xl">
            Pare de pagar por videochamada. Coloque IA na mesa.
          </h2>
          <Link
            className="mt-8 inline-flex rounded-xl bg-gradient-to-r from-[#C8A45D] to-[#F5C76B] px-7 py-4 text-sm font-extrabold text-[#0B0D12] shadow-[0_0_60px_rgba(200,164,93,.20)] transition hover:translate-y-[-1px]"
            href="/"
          >
            Criar uma reuniao assistida
          </Link>
        </section>
      </section>
    </main>
  );
}
