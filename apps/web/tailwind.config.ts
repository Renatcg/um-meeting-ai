import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#151517",
        mist: "#f6f4ef",
        line: "#dedbd2",
        brand: "#0f766e",
        accent: "#d97706",
        nmdi: {
          ink: "#0B0D12",
          graphite: "#111827",
          steel: "#1F2937",
          muted: "#6B7280",
          line: "#263142",
          soft: "#F4F1EA",
          ivory: "#FAF7EF",
          gold: "#C8A45D",
          amber: "#F5C76B",
          orange: "#F97316",
          blue: "#60A5FA",
          green: "#10B981",
          red: "#EF4444",
        },
      },
      boxShadow: {
        "nmdi-card": "0 16px 50px rgba(11, 13, 18, 0.12)",
        "nmdi-deep": "0 30px 120px rgba(0, 0, 0, 0.45)",
        "nmdi-glow": "0 0 60px rgba(200, 164, 93, 0.20)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
