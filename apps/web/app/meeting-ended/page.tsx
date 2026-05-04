import Link from "next/link";

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

const plans = [
  {
    name: "Team",
    price: "R$ 39",
    unit: "usuario/mes",
    description: "Para times que querem parar de perder contexto em reunioes.",
    items: ["Videochamadas com IA", "Transcricao", "Chat da reuniao", "Base institucional"],
  },
  {
    name: "Business",
    price: "R$ 89",
    unit: "usuario/mes",
    description: "Para comerciais que precisam vender com mais precisao.",
    items: ["Painel comercial privado", "Recomendacoes ao vivo", "RAG por produto", "Relatorios de reuniao"],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    unit: "contrato corporativo",
    description: "Para empresas que querem padronizar conversas criticas.",
    items: ["SSO e permissoes", "Politicas de IA", "Integracoes", "Governanca e auditoria"],
  },
];

const metrics = [
  "Menos follow-up perdido",
  "Mais contexto para decidir",
  "Menos improviso comercial",
  "Mais aprendizado por reuniao",
];

export default function MeetingEndedPage() {
  return (
    <main className="min-h-screen bg-[#0B0D12] text-[#FAF7EF]">
      <div className="fixed inset-0 pointer-events-none opacity-[0.055] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_12%_18%,rgba(245,199,107,.20),transparent_30%),radial-gradient(circle_at_82%_10%,rgba(96,165,250,.13),transparent_26%),radial-gradient(circle_at_72%_82%,rgba(200,164,93,.15),transparent_32%),linear-gradient(180deg,#0B0D12_0%,#111827_48%,#0B0D12_100%)]" />

      <section className="relative mx-auto flex min-h-screen max-w-[1440px] flex-col border-x border-white/10 bg-[#0B0D12]/80 shadow-[0_30px_120px_rgba(0,0,0,.45)]">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0B0D12]/72 backdrop-blur-xl">
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
                <div className="min-h-56 rounded-2xl border border-white/10 bg-[#111827] p-4">
                  <div className="mb-3 h-28 rounded-xl bg-[radial-gradient(circle_at_50%_45%,rgba(245,199,107,.38),transparent_35%),#0B0D12]" />
                  <p className="font-semibold">Cliente questiona ROI</p>
                  <p className="mt-2 text-sm leading-6 text-[#A8B0BF]">
                    Coevo detecta objecao financeira e prepara resposta baseada
                    no case correto.
                  </p>
                </div>

                <div className="min-h-56 rounded-2xl border border-white/10 bg-[#111827] p-4">
                  <div className="mb-3 grid h-28 place-items-center rounded-xl bg-[#0B0D12]">
                    <span className="h-16 w-16 rounded-full border border-[#C8A45D]/50 bg-[#F5C76B]/15 shadow-[0_0_60px_rgba(200,164,93,.20)]" />
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
                className="rounded-2xl border border-white/10 bg-white/[.06] p-5 backdrop-blur-xl"
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
                className={`rounded-2xl border p-6 ${
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
      </section>
    </main>
  );
}
