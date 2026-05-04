import Link from "next/link";

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
  "IA participante na sala",
  "Respostas por voz em tempo real",
  "Transcricao processada em segundo plano",
  "Painel comercial privado",
  "Cards de objecao, risco e oportunidade",
  "Base de conhecimento por empresa",
  "Base especifica por reuniao",
  "Personalidade treinavel do agente",
  "Historico e memoria de reunioes",
  "Efeitos de camera e fundo corporativo",
  "Compartilhamento de tela com foco total",
  "Controle de acesso por papel",
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
  "Abertura com contexto do lead",
  "Perguntas sugeridas conforme dor",
  "Alertas quando o prospect foge do ICP",
  "Resumo pronto para handoff",
  "Proxima acao recomendada",
];

const companyBenefits = [
  "Padroniza conversas comerciais sem engessar o time",
  "Reduz perda de contexto entre reuniao, CRM e follow-up",
  "Acelera onboarding de novos vendedores",
  "Cria inteligencia coletiva a partir de cada chamada",
  "Melhora compliance, governanca e rastreabilidade",
  "Aumenta qualidade da decisao em deals complexos",
];

const publicBenefits = [
  "Atendimentos remotos com registro confiavel",
  "Auditoria de reunioes sensiveis",
  "Memoria institucional preservada",
  "Acessibilidade para cidadaos e servidores",
  "Reducao de deslocamentos e retrabalho",
  "Padronizacao de respostas com base oficial",
];

const securityLayers = [
  "Controle de acesso por host, comercial, cliente e observador",
  "Separacao entre chat aberto e painel comercial privado",
  "Base de conhecimento segmentada por empresa e por reuniao",
  "Auditoria de participantes, horarios e encerramento",
  "Politicas para impedir vazamento de recomendacoes ao cliente",
  "Arquitetura pronta para SSO, logs e governanca corporativa",
];

const plans = [
  {
    name: "Team",
    price: "R$ 39",
    unit: "usuario/mes",
    description: "Para times que querem parar de perder contexto em reunioes.",
    items: [
      "Videochamadas com IA participante",
      "Transcricao processada em segundo plano",
      "Chat da reuniao",
      "Base institucional inicial",
      "Historico de reunioes",
      "Resumo automatico",
      "Controle de host e participante",
      "Lobby com aceite LGPD",
      "Convite por link",
      "Efeitos de camera",
      "Tela de encerramento comercial",
      "Suporte de implantacao leve",
    ],
  },
  {
    name: "Business",
    price: "R$ 89",
    unit: "usuario/mes",
    description: "Para comerciais que precisam vender com mais precisao.",
    items: [
      "Tudo do Team",
      "Painel comercial privado",
      "Recomendacoes ao vivo",
      "Deteccao de objecao, risco e oportunidade",
      "RAG por produto, proposta e playbook",
      "Personalidade treinavel do agente",
      "Base por reuniao antes da chamada",
      "Handoff para SDR e closer",
      "Relatorios de reuniao",
      "Insights para lideranca",
      "Biblioteca de argumentos",
      "Templates de follow-up",
      "Governanca por papeis",
      "Prioridade de roadmap",
    ],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    unit: "contrato corporativo",
    description: "Para empresas que querem padronizar conversas criticas.",
    items: [
      "Tudo do Business",
      "SSO e permissoes avancadas",
      "Politicas corporativas de IA",
      "Ambientes por unidade ou secretaria",
      "Logs e auditoria expandida",
      "Integracoes com CRM e BI",
      "Base de conhecimento governada",
      "Retencao configuravel",
      "Suporte a compliance interno",
      "Playbooks por area",
      "Painel executivo",
      "SLA corporativo",
      "Treinamento de administradores",
      "Implantacao assistida",
      "Roadmap dedicado",
    ],
  },
];

export default function MeetingEndedPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#0B0D12] text-[#FAF7EF]">
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
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
            <p className="mb-5 inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-[#F5C76B]">
              Reuniao encerrada
            </p>
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
                  <div className="mb-3 grid h-28 place-items-center rounded-xl bg-[#0B0D12]">
                    <span className="relative h-16 w-16 rounded-full border border-[#C8A45D]/50 bg-[#F5C76B]/15 shadow-[0_0_60px_rgba(200,164,93,.20)]">
                      <span className="absolute inset-[-10px] rounded-full border border-[#F5C76B]/25 [animation:ping_2.2s_cubic-bezier(0,0,.2,1)_infinite]" />
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
                key={`${feature}-${index}`}
              >
                {feature}
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
              Nove recursos seriam pouco. Entao colocamos doze.
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <article
                className="group rounded-2xl border border-white/10 bg-white/[.055] p-5 transition duration-500 hover:-translate-y-1 hover:border-[#C8A45D]/60 hover:bg-white/[.08]"
                key={feature}
              >
                <span className="font-mono text-xs text-[#F5C76B]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="mt-6 font-display text-2xl font-semibold">
                  {feature}
                </p>
                <div className="mt-5 h-1 rounded-full bg-white/10">
                  <div className="h-1 w-1/2 rounded-full bg-gradient-to-r from-[#C8A45D] to-[#F5C76B] transition-all duration-500 group-hover:w-full" />
                </div>
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

          <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
            <div className="rounded-[1.5rem] border border-white/10 bg-[#FAF7EF] p-6 text-[#0B0D12]">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#C8A45D]">
                Playbook vivo
              </p>
              <p className="mt-6 font-display text-4xl font-semibold">
                O SDR entra menos sozinho. Sai mais preparado.
              </p>
              <p className="mt-5 leading-7 text-[#374151]">
                Coevo transforma cada call em treinamento, cada lead em dado e
                cada objecao em material para melhorar o proximo contato.
              </p>
            </div>

            <div className="space-y-3">
              {sdrSteps.map((step, index) => (
                <div
                  className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.055] p-4 transition duration-500 hover:translate-x-2 hover:border-[#60A5FA]/50"
                  key={step}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#60A5FA]/15 font-mono text-xs text-[#60A5FA]">
                    {index + 1}
                  </span>
                  <p className="font-semibold">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 px-6 py-16 md:px-10 lg:px-16">
          <div className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-[1.5rem] border border-white/10 bg-white/[.055] p-6">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#F5C76B]">
                Empresas
              </p>
              <h2 className="mt-3 font-display text-4xl font-semibold">
                Beneficios para empresas que vivem de conversa critica.
              </h2>
              <ul className="mt-8 grid gap-3">
                {companyBenefits.map((benefit) => (
                  <li
                    className="rounded-xl border border-white/10 bg-[#0B0D12]/60 px-4 py-3 text-sm font-semibold text-[#FAF7EF]/85"
                    key={benefit}
                  >
                    {benefit}
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-[1.5rem] border border-[#10B981]/20 bg-[#10B981]/[.07] p-6">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#10B981]">
                Setor publico
              </p>
              <h2 className="mt-3 font-display text-4xl font-semibold">
                Atendimento, transparencia e memoria institucional.
              </h2>
              <ul className="mt-8 grid gap-3">
                {publicBenefits.map((benefit) => (
                  <li
                    className="rounded-xl border border-[#10B981]/20 bg-[#0B0D12]/50 px-4 py-3 text-sm font-semibold text-[#FAF7EF]/85"
                    key={benefit}
                  >
                    {benefit}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="border-t border-white/10 px-6 py-16 md:px-10 lg:px-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_.9fr]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#F5C76B]">
                Cyber seguranca
              </p>
              <h2 className="mt-3 font-display text-4xl font-semibold md:text-5xl">
                IA em reuniao corporativa sem seguranca e so vazamento com
                microfone.
              </h2>
              <p className="mt-5 text-lg leading-8 text-[#A8B0BF]">
                Coevo foi pensado para separar o que cada pessoa pode ver,
                registrar auditoria e impedir que recomendacoes internas
                aparecam para quem nao deveria recebe-las.
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
                className={`rounded-2xl border p-6 transition duration-500 hover:-translate-y-1 ${
                  plan.featured
                    ? "border-[#C8A45D] bg-[#FAF7EF] text-[#0B0D12] shadow-[0_0_60px_rgba(200,164,93,.20)]"
                    : "border-white/10 bg-white/[.06] text-[#FAF7EF]"
                }`}
                key={plan.name}
              >
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#C8A45D]">
                  {plan.name}
                </p>
                <div className="mt-4">
                  <span className="font-display text-4xl font-semibold">
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
                  className={`mt-4 text-sm leading-6 ${
                    plan.featured ? "text-[#374151]" : "text-[#A8B0BF]"
                  }`}
                >
                  {plan.description}
                </p>
                <ul className="mt-6 space-y-3">
                  {plan.items.map((item) => (
                    <li className="flex gap-3 text-sm font-semibold" key={item}>
                      <span className="mt-1 h-2 w-2 rounded-full bg-[#10B981]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-white/10 px-6 py-16 text-center md:px-10 lg:px-16">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#F5C76B]">
            A proxima reuniao pode ser comum. Ou pode virar inteligencia.
          </p>
          <h2 className="mx-auto mt-4 max-w-4xl font-display text-4xl font-semibold md:text-6xl">
            Pare de pagar por videochamada muda. Coloque IA na mesa.
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
