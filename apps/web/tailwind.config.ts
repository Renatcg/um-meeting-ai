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
      },
    },
  },
  plugins: [],
};

export default config;
