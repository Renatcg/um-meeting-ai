import Link from "next/link";

export default function CoevoMeetSuccessPage() {
  return (
    <main className="grid min-h-screen place-items-center overflow-hidden bg-[#0B0D12] px-6 py-12 text-[#FAF7EF]">
      <div className="pointer-events-none fixed inset-0 opacity-[0.055] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(245,199,107,.20),transparent_28%),radial-gradient(circle_at_78%_78%,rgba(96,165,250,.12),transparent_28%),linear-gradient(180deg,#0B0D12_0%,#111827_52%,#0B0D12_100%)]" />

      <section className="relative mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-white/[.055] p-8 text-center shadow-[0_30px_120px_rgba(0,0,0,.45)] backdrop-blur-2xl md:p-12">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#F5C76B]">
          Cadastro realizado
        </p>
        <h1 className="mt-5 font-display text-4xl font-semibold leading-tight md:text-6xl">
          Obrigado pelo interesse no Coevo Meet.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#A8B0BF]">
          Seu cadastro foi realizado com sucesso. Em breve, a equipe da Coevo
          Labs entrara em contato para apresentar a ferramenta de Meet e
          combinar os proximos passos.
        </p>
        <Link
          className="mt-8 inline-flex rounded-xl bg-gradient-to-r from-[#C8A45D] to-[#F5C76B] px-7 py-4 text-sm font-extrabold text-[#0B0D12] shadow-[0_0_60px_rgba(200,164,93,.20)] transition hover:translate-y-[-1px]"
          href="/coevo-meet"
        >
          Voltar para o Coevo Meet
        </Link>
      </section>
    </main>
  );
}
