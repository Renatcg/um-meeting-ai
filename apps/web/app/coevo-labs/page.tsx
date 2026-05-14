import type { Metadata } from "next";
import { Michroma } from "next/font/google";
import { Fragment } from "react";

const michroma = Michroma({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Coevo Labs | Ideias que transformam",
  description:
    "Laboratorio de inovacao do Grupo Coevo para criar, validar e escalar solucoes em rede.",
};

const navItems = ["Sobre", "Como funciona", "Recursos", "Solucoes", "Criadores"];

const howSteps = [
  {
    number: "01",
    title: (
      <>
        Mapeie
        <br />
        dores e oportunidades
      </>
    ),
    text: "Identifique problemas reais e oportunidades nas rotinas das empresas do grupo.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="10.5" cy="10.5" r="5.5" />
        <path d="M15 15L21 21" />
      </svg>
    ),
  },
  {
    number: "02",
    title: (
      <>
        Crie apps, agentes
        <br />e automações
      </>
    ),
    text: "Transforme sua ideia em soluções práticas que resolvem esses desafios.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <rect x="4" y="4" width="6" height="6" rx="1.5" />
        <rect x="14" y="4" width="6" height="6" rx="1.5" />
        <rect x="4" y="14" width="6" height="6" rx="1.5" />
        <rect x="14" y="14" width="6" height="6" rx="1.5" />
      </svg>
    ),
  },
  {
    number: "03",
    title: (
      <>
        Teste
        <br />
        suas ideias
      </>
    ),
    text: "Valide hipóteses, refine funcionalidades e evolua com base em dados e feedbacks.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M9 3h6" />
        <path d="M10 3v5l-5 9.5A2.4 2.4 0 0 0 7.1 21h9.8a2.4 2.4 0 0 0 2.1-3.5L14 8V3" />
        <path d="M8 15h8" />
      </svg>
    ),
  },
  {
    number: "04",
    title: (
      <>
        Disponibilize para
        <br />
        testes no grupo
      </>
    ),
    text: "Leve sua solução para uso real nas empresas do grupo e acompanhe os resultados.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="8" cy="9" r="3" />
        <circle cx="16" cy="9" r="3" />
        <path d="M4 20c.7-3.2 2.3-5 4-5s3.3 1.8 4 5" />
        <path d="M12 20c.7-3.2 2.3-5 4-5s3.3 1.8 4 5" />
      </svg>
    ),
  },
  {
    number: "05",
    title: (
      <>
        Valide
        <br />
        impacto
      </>
    ),
    text: "Comprove ganhos em produtividade, eficiência, receita ou experiência.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="8" />
        <path d="M8.5 12.2l2.2 2.2 4.8-5" />
      </svg>
    ),
  },
  {
    number: "06",
    title: (
      <>
        Escale
        <br />
        com a gente
      </>
    ),
    text: "Soluções com aderência podem se tornar produtos de mercado em parceria com você.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M4 18L10 12L14 16L21 8" />
        <path d="M15 8h6v6" />
      </svg>
    ),
  },
];

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
          --font-main: "Rajdhani", "Orbitron", "Eurostile", "Inter", system-ui, sans-serif;
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
          padding: clamp(0px, calc(2.8vw - 30px), 12px) clamp(22px, 3.2vw, 56px) 28px;
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
          padding-top: clamp(0px, calc(3.8vw - 20px), 38px);
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
          font-size: clamp(29px, 3.6vw, 55px);
          font-weight: 400;
          line-height: 1.18;
          letter-spacing: 0;
          text-shadow: 0 0 28px rgba(255,255,255,.16);
        }

        .glyph-e {
          display: inline-block;
          position: relative;
          width: .86em;
          height: .58em;
          margin: 0 .045em;
          vertical-align: -.015em;
          background:
            linear-gradient(currentColor, currentColor) left 0 / 100% .105em no-repeat,
            linear-gradient(currentColor, currentColor) left 50% / 100% .105em no-repeat,
            linear-gradient(currentColor, currentColor) left 100% / 100% .105em no-repeat;
          border-radius: .04em;
          filter: drop-shadow(0 0 16px rgba(255,255,255,.22));
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
          min-height: 620px;
          overflow: visible;
        }

        .labs-hero-image {
          position: absolute;
          left: 50%;
          top: 48%;
          width: min(980px, 112%);
          max-width: none;
          height: auto;
          transform: translate(-47%, -50%);
          filter: drop-shadow(0 34px 90px rgba(0,0,0,.55));
          opacity: .96;
          user-select: none;
        }

        .labs-metrics {
          position: relative;
          z-index: 3;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          margin-top: 8px;
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
          display: block;
          width: 38px;
          height: 4px;
          border-radius: 999px;
          background: #fff;
          box-shadow: 0 0 22px rgba(255,255,255,.46);
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
          .labs-visual { min-height: 560px; }
          .labs-hero-image {
            left: 50%;
            top: 50%;
            width: min(980px, 120%);
            transform: translate(-50%, -50%);
          }
          .labs-metrics { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 760px) {
          .labs-hero { padding: 0 18px 22px; }
          .labs-nav { grid-template-columns: 1fr auto; }
          .labs-links { display: none; }
          .labs-btn--ghost { display: none; }
          .labs-content {
            min-height: auto;
            padding-top: 18px;
          }
          .labs-title { font-size: clamp(28px, 7.2vw, 40px); }
          .labs-description br { display: none; }
          .labs-ctas { margin-top: 34px; }
          .labs-btn { width: 100%; }
          .labs-visual {
            min-height: 360px;
            margin-bottom: -24px;
            overflow: hidden;
          }
          .labs-hero-image {
            width: 130%;
            transform: translate(-50%, -50%);
          }
          .labs-metrics { grid-template-columns: 1fr; }
          .labs-metric {
            border-right: 0;
            border-bottom: 1px solid rgba(255,255,255,.09);
          }
          .labs-metric:last-child { border-bottom: 0; }
        }

        .coevo-how-section {
          --how-bg: #f7f7f4;
          --how-text: #080808;
          --how-muted: #5f5f5f;
          --how-card: rgba(255, 255, 255, 0.72);
          --how-card-border: rgba(0, 0, 0, 0.1);
          --how-shadow: 0 24px 70px rgba(0, 0, 0, 0.06);
          position: relative;
          width: 100%;
          min-height: 100vh;
          overflow: hidden;
          background:
            radial-gradient(circle at 50% 0%, rgba(255,255,255,1) 0%, rgba(247,247,244,0.95) 42%, rgba(242,242,239,1) 100%),
            var(--how-bg);
          color: var(--how-text);
          padding: 96px 48px 72px;
        }

        .coevo-how-section::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(0,0,0,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.025) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: radial-gradient(circle at 50% 32%, black 0%, transparent 64%);
          pointer-events: none;
        }

        .coevo-how-section::after {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 12% 26%, rgba(0,0,0,0.045), transparent 18%),
            radial-gradient(circle at 88% 26%, rgba(0,0,0,0.04), transparent 18%);
          pointer-events: none;
        }

        .how-container {
          position: relative;
          z-index: 2;
          width: min(1720px, 100%);
          margin: 0 auto;
        }

        .how-header {
          max-width: 1040px;
          margin: 0 auto 72px;
          text-align: center;
        }

        .how-kicker {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 34px;
          font-family: "Michroma", sans-serif;
          font-size: 13px;
          line-height: 1;
          letter-spacing: .18em;
          color: var(--how-muted);
          text-transform: uppercase;
        }

        .kicker-symbol {
          font-size: 20px;
          letter-spacing: 0;
          transform: translateY(-1px);
        }

        .how-header h2 {
          margin: 0;
          font-family: "Michroma", sans-serif;
          font-size: clamp(36px, 4vw, 68px);
          line-height: 1.18;
          letter-spacing: -.06em;
          font-weight: 400;
          color: var(--how-text);
        }

        .how-header p {
          max-width: 790px;
          margin: 34px auto 0;
          font-family: "Inter", sans-serif;
          font-size: clamp(17px, 1.25vw, 23px);
          line-height: 1.65;
          color: var(--how-muted);
          letter-spacing: .01em;
        }

        .brand-mark {
          margin-top: 28px;
          font-family: "Michroma", sans-serif;
          font-size: 22px;
          color: rgba(0,0,0,.22);
        }

        .flow-cards {
          position: relative;
          display: grid;
          grid-template-columns:
            minmax(170px, 1fr) 28px
            minmax(170px, 1fr) 28px
            minmax(170px, 1fr) 28px
            minmax(170px, 1fr) 28px
            minmax(170px, 1fr) 28px
            minmax(170px, 1fr);
          align-items: center;
          gap: 0;
        }

        .flow-card {
          position: relative;
          min-height: 420px;
          padding: 28px 22px 34px;
          border: 1px solid var(--how-card-border);
          border-radius: 16px;
          background:
            linear-gradient(180deg, rgba(255,255,255,.86), rgba(255,255,255,.55)),
            var(--how-card);
          box-shadow: var(--how-shadow);
          backdrop-filter: blur(18px);
          overflow: hidden;
          text-align: center;
        }

        .flow-card::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background:
            radial-gradient(circle at 50% 28%, rgba(0,0,0,.05), transparent 32%),
            linear-gradient(180deg, rgba(255,255,255,.7), transparent 44%);
          pointer-events: none;
        }

        .flow-card::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 118px;
          width: 118px;
          height: 118px;
          border-radius: 999px;
          transform: translateX(-50%);
          background:
            radial-gradient(circle, rgba(255,255,255,.9) 0%, rgba(255,255,255,0) 62%);
          border: 1px solid rgba(0,0,0,.045);
          pointer-events: none;
        }

        .step-number {
          position: absolute;
          top: 22px;
          left: 22px;
          z-index: 2;
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: #050505;
          color: #fff;
          font-family: "Inter", sans-serif;
          font-weight: 700;
          font-size: 13px;
          letter-spacing: .06em;
          box-shadow:
            0 10px 24px rgba(0,0,0,.16),
            inset 0 0 0 1px rgba(255,255,255,.16);
        }

        .icon-orbit {
          position: relative;
          z-index: 2;
          width: 132px;
          height: 132px;
          display: grid;
          place-items: center;
          margin: 56px auto 38px;
        }

        .orbit-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 1px solid rgba(0,0,0,.12);
        }

        .orbit-ring::before,
        .orbit-ring::after {
          content: "";
          position: absolute;
          border-radius: 50%;
          background: rgba(0,0,0,.18);
        }

        .orbit-ring::before {
          width: 5px;
          height: 5px;
          top: 12px;
          left: 50%;
        }

        .orbit-ring::after {
          width: 4px;
          height: 4px;
          right: 14px;
          top: 50%;
        }

        .icon-orbit svg {
          position: relative;
          z-index: 2;
          width: 46px;
          height: 46px;
          stroke: #050505;
          stroke-width: 1.65;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .flow-card h3 {
          position: relative;
          z-index: 2;
          min-height: 58px;
          margin: 0;
          font-family: "Inter", sans-serif;
          font-size: clamp(14px, 1vw, 18px);
          line-height: 1.45;
          letter-spacing: .08em;
          font-weight: 800;
          text-transform: uppercase;
          color: var(--how-text);
        }

        .card-divider {
          position: relative;
          z-index: 2;
          display: block;
          width: 16px;
          height: 1px;
          margin: 26px auto;
          background: rgba(0,0,0,.48);
        }

        .flow-card p {
          position: relative;
          z-index: 2;
          max-width: 210px;
          margin: 0 auto;
          font-family: "Inter", sans-serif;
          font-size: clamp(14px, .9vw, 17px);
          line-height: 1.65;
          color: #454545;
        }

        .flow-arrow {
          position: relative;
          z-index: 4;
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          margin: 0 -6px;
          border-radius: 50%;
          border: 1px solid rgba(0,0,0,.12);
          background: rgba(255,255,255,.86);
          color: #111;
          font-size: 34px;
          line-height: 1;
          transform: translateY(-2px);
          box-shadow: 0 10px 28px rgba(0,0,0,.06);
        }

        .how-bg {
          position: absolute;
          z-index: 1;
          width: 360px;
          height: 360px;
          opacity: .22;
          background:
            linear-gradient(30deg, transparent 48%, rgba(0,0,0,.12) 49%, rgba(0,0,0,.12) 51%, transparent 52%),
            linear-gradient(150deg, transparent 48%, rgba(0,0,0,.1) 49%, rgba(0,0,0,.1) 51%, transparent 52%);
          pointer-events: none;
        }

        .how-bg::before {
          content: "";
          position: absolute;
          inset: 78px;
          border: 1px solid rgba(0,0,0,.12);
          transform: rotate(45deg);
        }

        .how-bg::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(0,0,0,.16) 1px, transparent 1px);
          background-size: 16px 16px;
          mask-image: radial-gradient(circle, black 0%, transparent 70%);
        }

        .how-bg-left {
          left: 2%;
          top: 18%;
        }

        .how-bg-right {
          right: 1%;
          top: 18%;
          transform: scaleX(-1);
        }

        @media (max-width: 1280px) {
          .coevo-how-section {
            padding-inline: 32px;
          }

          .flow-cards {
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
          }

          .flow-arrow {
            display: none;
          }
        }

        @media (max-width: 820px) {
          .coevo-how-section {
            padding: 72px 20px 56px;
          }

          .how-header {
            margin-bottom: 48px;
          }

          .how-header h2 {
            font-size: 34px;
            letter-spacing: -.04em;
          }

          .how-header p {
            font-size: 16px;
          }

          .flow-cards {
            grid-template-columns: 1fr;
          }

          .flow-card {
            min-height: auto;
            padding-bottom: 42px;
          }

          .how-bg {
            display: none;
          }
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

            <h1 className={`labs-title ${michroma.className}`}>
              Ideias que
              <br />
              transformam.
              <br />
              F<span className="glyph-e" aria-hidden="true" />rramentas que multiplicam.
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
            <img
              className="labs-hero-image"
              src="/brand/coevo-labs-hero-visual.png"
              alt="Rede visual Coevo Labs com modulos conectados para criar, impactar, validar, compartilhar e crescer"
            />
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

      <section className="coevo-how-section" id="como-funciona">
        <div className="how-bg how-bg-left" />
        <div className="how-bg how-bg-right" />

        <div className="how-container">
          <div className="how-header">
            <span className="how-kicker">
              <span className="kicker-symbol">≡</span>
              COMO FUNCIONA
            </span>

            <h2 className={michroma.className}>
              Da ideia à solução.
              <br />
              Você cria. A Coevo Labs impulsiona. O grupo cresce.
            </h2>

            <p>
              Você passa por um processo claro e colaborativo para transformar
              problemas reais do dia a dia em soluções testadas, validadas e com
              potencial para o mercado.
            </p>

            <div className={`brand-mark ${michroma.className}`}>≡</div>
          </div>

          <div className="flow-cards">
            {howSteps.map((step, index) => (
              <Fragment key={step.number}>
                <article className="flow-card">
                  <span className="step-number">{step.number}</span>

                  <div className="icon-orbit">
                    <div className="orbit-ring" />
                    {step.icon}
                  </div>

                  <h3>{step.title}</h3>

                  <span className="card-divider" />

                  <p>{step.text}</p>
                </article>

                {index < howSteps.length - 1 ? (
                  <span className="flow-arrow" key={`${step.number}-arrow`}>
                    ›
                  </span>
                ) : null}
              </Fragment>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
