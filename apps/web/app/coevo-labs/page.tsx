import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coevo Labs | Ideias que transformam",
  description:
    "Laboratorio de inovacao do Grupo Coevo para criar, validar e escalar solucoes em rede.",
};

const navItems = ["Sobre", "Como funciona", "Recursos", "Solucoes", "Criadores"];

const orbitNodes = [
  {
    title: "Impactar",
    text: "Gere impacto real nas empresas do Grupo Coevo.",
    icon: "rocket",
    className: "left-[10%] top-[27%]",
    labelClassName: "-left-36 top-2 text-right",
  },
  {
    title: "Criar",
    text: "Desenvolva solucoes com IA e ferramentas de ponta.",
    icon: "build",
    className: "right-[23%] top-[9%]",
    labelClassName: "left-32 top-0",
  },
  {
    title: "Validar",
    text: "Solucoes com tracao podem virar produtos para o mercado.",
    icon: "chart",
    className: "right-[2%] top-[37%]",
    labelClassName: "left-32 top-24",
  },
  {
    title: "Crescer",
    text: "Criador e Coevo juntos. Receita, reconhecimento e participacao.",
    icon: "growth",
    className: "right-[18%] bottom-[12%]",
    labelClassName: "left-28 top-24",
  },
  {
    title: "Compartilhar",
    text: "Torne sua solucao disponivel para todas as empresas do grupo.",
    icon: "people",
    className: "left-[3%] bottom-[21%]",
    labelClassName: "-left-10 top-28",
  },
];

const proofItems = [
  {
    icon: "people",
    title: "+ colaborativo",
    text: "Inovacao construida em rede.",
  },
  {
    icon: "grid",
    title: "+ produtividade",
    text: "Ferramentas que aceleram resultados.",
  },
  {
    icon: "spark",
    title: "+ oportunidades",
    text: "Ideias que podem virar negocios reais.",
  },
  {
    icon: "lines",
    title: "100% Coevo",
    text: "Feito para o grupo. Aberto para o mundo.",
  },
];

function LabsLogo() {
  return (
    <div className="leading-none">
      <div className="font-display text-[2rem] font-semibold uppercase tracking-[0.42em] text-white md:text-[2.45rem]">
        Coevo
      </div>
      <div className="mt-1 pl-9 font-mono text-[0.86rem] uppercase tracking-[0.78em] text-white/80 md:text-[1rem]">
        Labs
      </div>
    </div>
  );
}

function MiniIcon({ type }: { type: string }) {
  if (type === "rocket") {
    return (
      <span className="relative h-9 w-9 rotate-45 rounded-[40%_40%_50%_50%] border-2 border-white/80">
        <span className="absolute left-2 top-2 h-2.5 w-2.5 rounded-full border border-white/80" />
        <span className="absolute -bottom-2 left-1 h-3 w-2 border-l-2 border-white/70" />
        <span className="absolute -right-2 bottom-1 h-2 w-3 border-t-2 border-white/70" />
      </span>
    );
  }

  if (type === "build") {
    return (
      <span className="relative h-9 w-9">
        <span className="absolute left-1 top-3 h-4 w-7 rounded-full border-2 border-white/80" />
        <span className="absolute left-4 top-1 h-7 w-2 rounded-full border-2 border-white/80" />
        <span className="absolute bottom-1 left-2 h-2 w-2 rounded-full bg-white/80" />
        <span className="absolute bottom-1 right-2 h-2 w-2 rounded-full bg-white/80" />
      </span>
    );
  }

  if (type === "chart") {
    return (
      <span className="relative h-9 w-9">
        <span className="absolute bottom-1 left-1 h-7 w-1.5 rounded-full bg-white/75" />
        <span className="absolute bottom-1 left-4 h-4 w-1.5 rounded-full bg-white/75" />
        <span className="absolute bottom-1 right-1 h-8 w-1.5 rounded-full bg-white/75" />
        <span className="absolute left-1 top-2 h-3 w-7 rounded-t-full border-t-2 border-white/80" />
      </span>
    );
  }

  if (type === "growth") {
    return (
      <span className="relative grid h-10 w-10 place-items-center rounded-full border-2 border-white/75">
        <span className="font-mono text-2xl leading-none text-white/80">$</span>
        <span className="absolute right-0 top-1 h-3 w-3 rounded-full border-2 border-white/80" />
      </span>
    );
  }

  if (type === "grid") {
    return (
      <span className="grid h-10 w-10 grid-cols-2 gap-1.5">
        <span className="rounded border-2 border-white/70" />
        <span className="rounded border-2 border-white/70" />
        <span className="rounded border-2 border-white/70" />
        <span className="rounded border-2 border-white/70" />
      </span>
    );
  }

  if (type === "spark") {
    return (
      <span className="relative h-11 w-11">
        <span className="absolute left-1/2 top-0 h-11 w-px -translate-x-1/2 bg-white/70" />
        <span className="absolute left-0 top-1/2 h-px w-11 -translate-y-1/2 bg-white/70" />
        <span className="absolute left-2 top-2 h-7 w-7 rotate-45 border border-white/60" />
      </span>
    );
  }

  if (type === "lines") {
    return (
      <span className="grid h-10 w-10 content-center gap-2">
        <span className="h-1 w-9 rounded-full bg-white/70" />
        <span className="h-1 w-7 rounded-full bg-white/70" />
        <span className="h-1 w-9 rounded-full bg-white/70" />
      </span>
    );
  }

  return (
    <span className="relative h-10 w-10">
      <span className="absolute left-0 top-2 h-5 w-5 rounded-full border-2 border-white/70" />
      <span className="absolute right-0 top-2 h-5 w-5 rounded-full border-2 border-white/70" />
      <span className="absolute bottom-1 left-2 h-4 w-6 rounded-t-full border-2 border-b-0 border-white/70" />
    </span>
  );
}

function OrbitCard({
  node,
}: {
  node: (typeof orbitNodes)[number];
}) {
  return (
    <div className={`absolute ${node.className}`}>
      <div className="group relative grid h-28 w-28 place-items-center rounded-[1.75rem] border border-white/15 bg-[#15171D] shadow-[0_30px_90px_rgba(0,0,0,.72),0_0_30px_rgba(255,255,255,.14)] transition duration-500 hover:-translate-y-2 hover:shadow-[0_40px_100px_rgba(0,0,0,.8),0_0_42px_rgba(255,255,255,.26)]">
        <span className="absolute inset-x-4 bottom-[-8px] h-3 rounded-full bg-white shadow-[0_0_22px_rgba(255,255,255,.95)]" />
        <span className="absolute inset-x-2 bottom-2 h-px bg-white/65 shadow-[0_0_18px_rgba(255,255,255,.85)]" />
        <MiniIcon type={node.icon} />
      </div>
      <div className={`absolute hidden w-40 md:block ${node.labelClassName}`}>
        <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-white">
          {node.title}
        </p>
        <p className="mt-2 text-sm leading-5 text-white/58">{node.text}</p>
      </div>
    </div>
  );
}

function LabsDiagram() {
  return (
    <div className="relative min-h-[560px] overflow-hidden rounded-[2rem] md:min-h-[680px]">
      <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(to_right,rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:42px_42px] [transform:perspective(900px)_rotateX(58deg)_rotateZ(-38deg)_scale(1.25)]" />
      <div className="absolute left-[45%] top-[44%] h-[1px] w-[46%] origin-left -rotate-[21deg] bg-white/55 shadow-[0_0_18px_rgba(255,255,255,.9)]" />
      <div className="absolute left-[39%] top-[45%] h-[1px] w-[41%] origin-left rotate-[31deg] bg-white/45 shadow-[0_0_18px_rgba(255,255,255,.8)]" />
      <div className="absolute left-[26%] top-[45%] h-[1px] w-[33%] origin-right rotate-[24deg] bg-white/50 shadow-[0_0_18px_rgba(255,255,255,.85)]" />
      <div className="absolute left-[24%] top-[57%] h-[1px] w-[34%] origin-right -rotate-[18deg] bg-white/45 shadow-[0_0_18px_rgba(255,255,255,.75)]" />
      <div className="absolute left-[53%] top-[32%] h-[1px] w-[26%] origin-left -rotate-[48deg] bg-white/45 shadow-[0_0_18px_rgba(255,255,255,.75)]" />

      <div className="absolute left-1/2 top-1/2 grid h-52 w-52 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[2.25rem] border border-white/18 bg-[#17191F] shadow-[0_42px_110px_rgba(0,0,0,.9),0_0_40px_rgba(255,255,255,.16)] md:h-64 md:w-64">
        <span className="absolute inset-x-7 bottom-[-10px] h-4 rounded-full bg-white shadow-[0_0_28px_rgba(255,255,255,.95)]" />
        <span className="absolute inset-x-4 bottom-4 h-px bg-white/75 shadow-[0_0_28px_rgba(255,255,255,.9)]" />
        <span className="absolute inset-10 rounded-[1.8rem] bg-white/[.03]" />
        <span className="relative grid h-28 w-28 place-items-center rounded-[1.6rem] bg-white/[.04] shadow-[inset_0_0_36px_rgba(255,255,255,.08)]">
          <span className="flex h-14 items-center gap-3">
            <span className="h-12 w-3 rounded bg-white shadow-[0_0_18px_rgba(255,255,255,.9)]" />
            <span className="h-12 w-3 rounded bg-white shadow-[0_0_18px_rgba(255,255,255,.9)]" />
            <span className="h-12 w-3 rounded bg-white shadow-[0_0_18px_rgba(255,255,255,.9)]" />
          </span>
        </span>
      </div>

      {orbitNodes.map((node) => (
        <OrbitCard key={node.title} node={node} />
      ))}
    </div>
  );
}

export default function CoevoLabsLandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#03060D] text-white">
      <style>{`
        @keyframes labsPulse {
          0%, 100% { opacity: .38; transform: scale(.96); }
          50% { opacity: .72; transform: scale(1.04); }
        }
      `}</style>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_22%_20%,rgba(255,255,255,.08),transparent_25%),radial-gradient(circle_at_78%_44%,rgba(255,255,255,.10),transparent_30%),linear-gradient(135deg,#040813_0%,#070910_42%,#02040A_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[.045] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:54px_54px]" />
      <div className="pointer-events-none fixed -left-32 top-28 h-96 w-96 rounded-full border border-white/10 blur-sm [animation:labsPulse_7s_ease-in-out_infinite]" />

      <section className="relative mx-auto flex min-h-screen max-w-[1720px] flex-col px-6 py-8 md:px-12 lg:px-14">
        <header className="flex items-start justify-between gap-8">
          <LabsLogo />

          <nav className="hidden items-center gap-12 pt-5 lg:flex">
            {navItems.map((item) => (
              <a
                className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-white/86 transition hover:text-white"
                href={`#${item.toLowerCase().replaceAll(" ", "-")}`}
                key={item}
              >
                {item}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-10 pt-1">
            <a
              className="hidden rounded-sm border border-white/24 px-6 py-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-white transition hover:border-white hover:bg-white hover:text-[#03060D] md:inline-flex"
              href="#criar"
            >
              Quero criar
              <span className="ml-3 text-lg leading-none">↗</span>
            </a>
            <button
              aria-label="Abrir menu"
              className="grid h-12 w-12 place-items-center text-white"
              type="button"
            >
              <span className="grid gap-2">
                <span className="h-0.5 w-7 bg-white" />
                <span className="h-0.5 w-7 bg-white" />
                <span className="h-0.5 w-7 bg-white" />
              </span>
            </button>
          </div>
        </header>

        <section className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[minmax(420px,.72fr)_minmax(600px,1fr)] lg:py-10">
          <div className="relative z-10">
            <p className="font-mono text-xs uppercase tracking-[0.34em] text-white/52">
              Coevo Labs — Inovacao em rede
            </p>
            <div className="mt-4 h-px w-24 bg-white/70" />

            <h1 className="mt-10 max-w-3xl font-display text-[3.9rem] font-semibold leading-[1.04] tracking-[-0.04em] text-white md:text-[5.65rem] lg:text-[5.1rem] xl:text-[6rem]">
              Ideias que transformam. Ferramentas que multiplicam.
            </h1>

            <p className="mt-8 max-w-2xl text-lg leading-8 text-white/78 md:text-xl">
              Coevo Labs e o laboratorio de inovacao do Grupo Coevo. Aqui,
              colaboradores criam solucoes que impulsionam nossas empresas e
              que podem se tornar produtos para o mundo.
            </p>

            <div className="mt-12 flex flex-col gap-4 sm:flex-row">
              <a
                className="inline-flex items-center justify-center rounded-sm bg-white px-8 py-5 font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#03060D] shadow-[0_0_36px_rgba(255,255,255,.22)] transition hover:-translate-y-1 hover:shadow-[0_0_50px_rgba(255,255,255,.34)]"
                href="#criar"
              >
                Comece a criar
                <span className="ml-4 text-lg leading-none">↗</span>
              </a>
              <a
                className="inline-flex items-center justify-center rounded-sm border border-white/26 px-8 py-5 font-mono text-xs font-bold uppercase tracking-[0.18em] text-white transition hover:-translate-y-1 hover:border-white hover:bg-white/8"
                href="#solucoes"
              >
                Conheca solucoes
                <span className="ml-4 text-lg leading-none">↗</span>
              </a>
            </div>
          </div>

          <LabsDiagram />
        </section>

        <section className="border-y border-white/10">
          <div className="grid divide-y divide-white/10 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4">
            {proofItems.map((item) => (
              <article
                className="grid grid-cols-[4rem_1fr] items-center gap-5 px-6 py-7"
                key={item.title}
              >
                <MiniIcon type={item.icon} />
                <div>
                  <p className="font-mono text-sm font-semibold uppercase tracking-[0.2em] text-white">
                    {item.title}
                  </p>
                  <p className="mt-2 text-base leading-6 text-white/52">
                    {item.text}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <p className="mt-10 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-white/42">
          ↓ Role para explorar
        </p>
      </section>
    </main>
  );
}
