import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coevo Labs | Ideias que transformam",
  description:
    "Laboratorio de inovacao do Grupo Coevo para criar, validar e escalar solucoes em rede.",
};

const navItems = ["Sobre", "Como funciona", "Recursos", "Solucoes", "Criadores"];

export default function CoevoLabsLandingPage() {
  return (
    <main className="coevo-labs-page">
      <style>{`
        .coevo-labs-page {
          --bg: #05070c;
          --panel: #11141a;
          --panel-2: #171a20;
          --text: #f5f6f8;
          --muted: rgba(245, 246, 248, 0.64);
          --muted-2: rgba(245, 246, 248, 0.42);
          --line: rgba(245, 246, 248, 0.14);
          --line-strong: rgba(245, 246, 248, 0.44);
          --font-main: "Rajdhani", "Orbitron", "Eurostile", "Michroma", "Inter", system-ui, sans-serif;
          min-height: 100vh;
          background:
            radial-gradient(circle at 76% 28%, rgba(255,255,255,0.075), transparent 22%),
            radial-gradient(circle at 18% 38%, rgba(255,255,255,0.035), transparent 24%),
            linear-gradient(135deg, #05070c 0%, #070910 44%, #03050a 100%);
          color: var(--text);
          overflow: hidden;
        }

        .labs-hero {
          position: relative;
          isolation: isolate;
          min-height: 100vh;
          padding: clamp(22px, 2.8vw, 42px) clamp(22px, 3.2vw, 56px) 28px;
          overflow: hidden;
        }

        .labs-hero::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          opacity: .23;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px);
          background-size: 56px 56px;
          mask-image: radial-gradient(circle at 74% 47%, #000 0%, transparent 62%);
        }

        .labs-hero::after {
          content: "";
          position: absolute;
          inset: -18%;
          z-index: -2;
          background:
            linear-gradient(90deg, rgba(255,255,255,.018) 1px, transparent 1px),
            linear-gradient(rgba(255,255,255,.018) 1px, transparent 1px);
          background-size: 120px 120px;
          transform: perspective(900px) rotateX(62deg) rotateZ(-32deg) scale(1.35);
          transform-origin: 72% 46%;
          opacity: .28;
        }

        .labs-nav {
          position: relative;
          z-index: 5;
          display: grid;
          grid-template-columns: 240px 1fr auto;
          align-items: start;
          gap: 28px;
        }

        .labs-brand {
          display: inline-flex;
          width: 210px;
          height: 58px;
          align-items: flex-start;
          overflow: hidden;
        }

        .labs-brand img {
          width: 210px;
          height: auto;
          filter: invert(1) grayscale(1) contrast(1.22) brightness(1.04);
          mix-blend-mode: screen;
          transform: translateY(-32px);
        }

        .labs-links {
          display: flex;
          justify-content: center;
          gap: clamp(26px, 4vw, 64px);
          padding-top: 20px;
          font-family: var(--font-main);
          text-transform: uppercase;
          letter-spacing: .08em;
          font-size: 13px;
          font-weight: 700;
        }

        .labs-links a {
          color: rgba(255,255,255,.88);
          text-decoration: none;
          transition: color .22s ease, opacity .22s ease;
        }

        .labs-links a:hover {
          color: #fff;
          opacity: .72;
        }

        .labs-actions {
          display: flex;
          align-items: center;
          gap: 30px;
        }

        .labs-btn {
          display: inline-flex;
          min-height: 54px;
          align-items: center;
          justify-content: center;
          gap: 12px;
          border-radius: 4px;
          padding: 0 30px;
          font-family: var(--font-main);
          font-size: 13px;
          font-weight: 800;
          letter-spacing: .13em;
          text-transform: uppercase;
          text-decoration: none;
          transition: transform .22s ease, background .22s ease, border-color .22s ease, box-shadow .22s ease;
        }

        .labs-btn:hover {
          transform: translateY(-2px);
        }

        .labs-btn--ghost,
        .labs-btn--secondary {
          border: 1px solid rgba(255,255,255,.28);
          background: rgba(255,255,255,.035);
          color: #fff;
        }

        .labs-btn--primary {
          border: 1px solid rgba(255,255,255,.82);
          background: #f7f7f7;
          color: #06080d;
          box-shadow: 0 0 28px rgba(255,255,255,.12);
        }

        .labs-menu {
          display: grid;
          width: 36px;
          height: 36px;
          align-content: center;
          gap: 5px;
          border: 0;
          background: transparent;
          padding: 0;
          cursor: pointer;
        }

        .labs-menu span {
          display: block;
          width: 28px;
          height: 2px;
          border-radius: 99px;
          background: #fff;
          box-shadow: 0 0 12px rgba(255,255,255,.34);
        }

        .labs-content {
          position: relative;
          z-index: 2;
          display: grid;
          grid-template-columns: minmax(430px, .82fr) minmax(520px, 1.18fr);
          gap: clamp(20px, 4vw, 72px);
          align-items: center;
          min-height: calc(100vh - 210px);
          padding-top: clamp(18px, 3.8vw, 58px);
        }

        .labs-copy {
          max-width: 650px;
        }

        .labs-eyebrow {
          margin: 0;
          color: var(--muted-2);
          font-family: var(--font-main);
          font-size: 14px;
          font-weight: 600;
          letter-spacing: .24em;
          text-transform: uppercase;
        }

        .labs-eyebrow-line {
          width: 78px;
          height: 1px;
          margin: 26px 0 30px;
          background: rgba(255,255,255,.56);
        }

        .labs-title {
          margin: 0;
          color: #f7f8fb;
          font-family: var(--font-main);
          font-size: clamp(52px, 5.1vw, 90px);
          font-weight: 500;
          line-height: 1.17;
          letter-spacing: -.035em;
          text-shadow: 0 0 28px rgba(255,255,255,.16);
        }

        .glyph-e-inline {
          display: inline-block;
          margin: 0 .02em;
          color: rgba(255,255,255,.72);
          transform: translateY(-.04em) scaleX(1.2);
          text-shadow: 0 0 22px rgba(255,255,255,.22);
        }

        .labs-description {
          max-width: 590px;
          margin: 28px 0 0;
          color: rgba(255,255,255,.82);
          font-size: clamp(16px, 1.25vw, 20px);
          line-height: 1.55;
        }

        .labs-ctas {
          display: flex;
          flex-wrap: wrap;
          gap: 22px;
          margin-top: 58px;
        }

        .labs-visual {
          position: relative;
          min-height: 610px;
        }

        .labs-network {
          position: absolute;
          inset: 0;
          transform: translateY(8px);
        }

        .network-line {
          position: absolute;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.62), transparent);
          opacity: .86;
          box-shadow: 0 0 12px rgba(255,255,255,.28);
          transform-origin: left center;
        }

        .network-line--a { width: 270px; left: 35%; top: 34%; transform: rotate(-22deg); }
        .network-line--b { width: 250px; left: 52%; top: 30%; transform: rotate(25deg); }
        .network-line--c { width: 245px; left: 54%; top: 46%; transform: rotate(-8deg); }
        .network-line--d { width: 260px; left: 28%; top: 55%; transform: rotate(-7deg); }
        .network-line--e { width: 230px; left: 52%; top: 58%; transform: rotate(42deg); }

        .core-card,
        .labs-node {
          position: absolute;
          border: 1px solid rgba(255,255,255,.16);
          background: linear-gradient(145deg, rgba(32,35,42,.98), rgba(10,12,17,.98));
          box-shadow:
            0 26px 50px rgba(0,0,0,.55),
            inset 0 1px 0 rgba(255,255,255,.08);
        }

        .core-card {
          left: 46%;
          top: 39%;
          width: 250px;
          height: 180px;
          border-radius: 30px;
          transform: translate(-50%, -50%) rotateX(54deg) rotateZ(-45deg);
        }

        .core-card::after,
        .labs-node::after {
          content: "";
          position: absolute;
          left: 14px;
          right: 14px;
          bottom: -12px;
          height: 11px;
          border-radius: 0 0 18px 18px;
          background: rgba(255,255,255,.88);
          filter: blur(.2px) drop-shadow(0 0 16px rgba(255,255,255,.55));
        }

        .core-card__glow {
          position: absolute;
          inset: 22px;
          border-radius: 24px;
          background: radial-gradient(circle, rgba(255,255,255,.16), transparent 68%);
        }

        .core-card__icon {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          transform: rotateZ(45deg) rotateX(-54deg);
        }

        .core-card__icon span,
        .metric-icon--lines span {
          display: block;
          width: 10px;
          height: 70px;
          border-radius: 999px;
          background: #fff;
          box-shadow: 0 0 22px rgba(255,255,255,.46);
        }

        .labs-node {
          width: 118px;
          height: 92px;
          border-radius: 21px;
          transform: rotateX(54deg) rotateZ(-45deg);
        }

        .labs-node__icon {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          color: rgba(255,255,255,.9);
          font-family: var(--font-main);
          font-size: 37px;
          transform: rotateZ(45deg) rotateX(-54deg);
        }

        .node--impactar { left: 25%; top: 25%; }
        .node--criar { left: 66%; top: 11%; }
        .node--validar { left: 82%; top: 32%; }
        .node--compartilhar { left: 17%; top: 57%; }
        .node--crescer { left: 68%; top: 67%; }

        .labs-callout {
          position: absolute;
          max-width: 190px;
          color: var(--muted);
          font-size: 15px;
          line-height: 1.35;
        }

        .labs-callout strong {
          display: block;
          margin-bottom: 8px;
          color: #fff;
          font-family: var(--font-main);
          font-size: 14px;
          letter-spacing: .16em;
          text-transform: uppercase;
        }

        .callout--impactar { left: 6%; top: 31%; text-align: right; }
        .callout--criar { right: 9%; top: 10%; }
        .callout--validar { right: 3%; top: 51%; }
        .callout--compartilhar { left: 9%; top: 73%; }
        .callout--crescer { right: 7%; top: 79%; }

        .labs-metrics {
          position: relative;
          z-index: 3;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          margin-top: 18px;
          border-top: 1px solid rgba(255,255,255,.12);
          border-bottom: 1px solid rgba(255,255,255,.10);
        }

        .labs-metric {
          display: grid;
          grid-template-columns: 64px 1fr;
          gap: 22px;
          align-items: center;
          min-height: 118px;
          padding: 24px 30px;
          border-right: 1px solid rgba(255,255,255,.09);
        }

        .labs-metric:last-child {
          border-right: 0;
        }

        .labs-metric strong {
          display: block;
          margin-bottom: 6px;
          font-family: var(--font-main);
          font-size: 16px;
          font-weight: 800;
          letter-spacing: .16em;
          text-transform: uppercase;
        }

        .labs-metric p {
          margin: 0;
          color: var(--muted-2);
          font-size: 17px;
          line-height: 1.25;
        }

        .metric-icon {
          width: 52px;
          height: 52px;
          color: rgba(255,255,255,.72);
        }

        .metric-icon--people {
          position: relative;
        }

        .metric-icon--people span {
          position: absolute;
          bottom: 4px;
          width: 24px;
          height: 21px;
          border: 2px solid rgba(255,255,255,.72);
          border-radius: 999px 999px 0 0;
        }

        .metric-icon--people span:nth-child(1) { left: 0; }
        .metric-icon--people span:nth-child(2) { left: 23px; }
        .metric-icon--people span:nth-child(3) {
          left: 12px;
          top: 3px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
        }

        .metric-icon--grid {
          display: grid;
          grid-template-columns: repeat(2, 16px);
          grid-auto-rows: 16px;
          align-content: center;
          justify-content: center;
          gap: 10px;
        }

        .metric-icon--grid span {
          border: 2px solid rgba(255,255,255,.72);
          border-radius: 5px;
        }

        .metric-icon--spark {
          display: grid;
          place-items: center;
          font-size: 50px;
          line-height: 1;
        }

        .metric-icon--lines {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 7px;
        }

        .metric-icon--lines span {
          width: 38px;
          height: 4px;
        }

        .scroll-hint {
          position: relative;
          z-index: 3;
          display: inline-flex;
          margin-top: 26px;
          color: rgba(255,255,255,.44);
          font-family: var(--font-main);
          font-size: 12px;
          letter-spacing: .18em;
          text-transform: uppercase;
          text-decoration: none;
        }

        @media (max-width: 1180px) {
          .labs-nav { grid-template-columns: 190px 1fr auto; }
          .labs-brand { width: 180px; height: 52px; }
          .labs-brand img { width: 180px; transform: translateY(-27px); }
          .labs-links { gap: 24px; }
          .labs-content { grid-template-columns: 1fr; }
          .labs-visual { min-height: 540px; }
          .labs-metrics { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 760px) {
          .labs-hero { padding: 22px 18px; }
          .labs-nav { grid-template-columns: 1fr auto; }
          .labs-links { display: none; }
          .labs-btn--ghost { display: none; }
          .labs-content {
            min-height: auto;
            padding-top: 38px;
          }
          .labs-title { font-size: clamp(44px, 13vw, 66px); }
          .labs-description br { display: none; }
          .labs-ctas { margin-top: 34px; }
          .labs-btn { width: 100%; }
          .labs-visual {
            min-height: 520px;
            margin-bottom: -80px;
            transform: scale(.82);
            transform-origin: top center;
          }
          .labs-metrics { grid-template-columns: 1fr; }
          .labs-metric {
            border-right: 0;
            border-bottom: 1px solid rgba(255,255,255,.09);
          }
          .labs-metric:last-child { border-bottom: 0; }
        }
      `}</style>

      <section className="labs-hero" aria-label="Hero Coevo Labs">
        <header className="labs-nav">
          <a className="labs-brand" href="#" aria-label="Coevo Labs">
            <img
              src="/brand/coevo-labs-logo.png"
              alt="Coevo Labs"
            />
          </a>

          <nav className="labs-links" aria-label="Navegacao principal">
            {navItems.map((item) => (
              <a
                href={`#${item.toLowerCase().replaceAll(" ", "-")}`}
                key={item}
              >
                {item}
              </a>
            ))}
          </nav>

          <div className="labs-actions">
            <a className="labs-btn labs-btn--ghost" href="#criar">
              Quero criar <span>↗</span>
            </a>
            <button className="labs-menu" aria-label="Abrir menu" type="button">
              <span />
              <span />
              <span />
            </button>
          </div>
        </header>

        <div className="labs-content">
          <div className="labs-copy">
            <p className="labs-eyebrow">Coevo Labs — Inovacao em rede</p>
            <div className="labs-eyebrow-line" />

            <h1 className="labs-title">
              Ideias que
              <br />
              t<span className="glyph-e-inline">≡</span>ansformam.
              <br />
              F<span className="glyph-e-inline">≡</span>rramentas que
              <br />
              multiplicam.
            </h1>

            <p className="labs-description">
              Coevo Labs e o laboratorio de inovacao do Grupo Coevo.
              <br />
              Aqui, colaboradores criam solucoes que impulsionam nossas
              <br />
              empresas — e que podem se tornar produtos para o mundo.
            </p>

            <div className="labs-ctas">
              <a className="labs-btn labs-btn--primary" href="#criar">
                Comece a criar <span>↗</span>
              </a>
              <a className="labs-btn labs-btn--secondary" href="#solucoes">
                Conheca solucoes <span>↗</span>
              </a>
            </div>
          </div>

          <div className="labs-visual" aria-label="Rede de solucoes Coevo Labs">
            <div className="labs-network">
              <div className="network-line network-line--a" />
              <div className="network-line network-line--b" />
              <div className="network-line network-line--c" />
              <div className="network-line network-line--d" />
              <div className="network-line network-line--e" />

              <div className="core-card">
                <div className="core-card__glow" />
                <div className="core-card__icon">
                  <span />
                  <span />
                  <span />
                </div>
              </div>

              <article className="labs-node node--impactar">
                <div className="labs-node__icon">⌁</div>
              </article>
              <article className="labs-node node--criar">
                <div className="labs-node__icon">✦</div>
              </article>
              <article className="labs-node node--validar">
                <div className="labs-node__icon">⌁</div>
              </article>
              <article className="labs-node node--compartilhar">
                <div className="labs-node__icon">⌘</div>
              </article>
              <article className="labs-node node--crescer">
                <div className="labs-node__icon">$</div>
              </article>

              <div className="labs-callout callout--impactar">
                <strong>Impactar</strong>
                <span>Gere impacto real nas empresas do Grupo Coevo.</span>
              </div>
              <div className="labs-callout callout--criar">
                <strong>Criar</strong>
                <span>Desenvolva solucoes com IA e ferramentas de ponta.</span>
              </div>
              <div className="labs-callout callout--validar">
                <strong>Validar</strong>
                <span>Solucoes com tracao podem virar produtos para o mercado.</span>
              </div>
              <div className="labs-callout callout--compartilhar">
                <strong>Compartilhar</strong>
                <span>Torne sua solucao disponivel para todas as empresas do grupo.</span>
              </div>
              <div className="labs-callout callout--crescer">
                <strong>Crescer</strong>
                <span>Criador e Coevo juntos. Receita, reconhecimento e participacao.</span>
              </div>
            </div>
          </div>
        </div>

        <footer className="labs-metrics" aria-label="Destaques Coevo Labs">
          <article className="labs-metric">
            <div className="metric-icon metric-icon--people">
              <span />
              <span />
              <span />
            </div>
            <div>
              <strong>+ Colaborativo</strong>
              <p>Inovacao construida em rede.</p>
            </div>
          </article>

          <article className="labs-metric">
            <div className="metric-icon metric-icon--grid">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div>
              <strong>+ Produtividade</strong>
              <p>Ferramentas que aceleram resultados.</p>
            </div>
          </article>

          <article className="labs-metric">
            <div className="metric-icon metric-icon--spark">✧</div>
            <div>
              <strong>+ Oportunidades</strong>
              <p>Ideias que podem virar negocios reais.</p>
            </div>
          </article>

          <article className="labs-metric">
            <div className="metric-icon metric-icon--lines">
              <span />
              <span />
              <span />
            </div>
            <div>
              <strong>100% Coevo</strong>
              <p>Feito para o grupo. Aberto para o mundo.</p>
            </div>
          </article>
        </footer>

        <a className="scroll-hint" href="#sobre">
          ↓ Role para explorar
        </a>
      </section>
    </main>
  );
}
