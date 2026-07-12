import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        edison: {
          bg: "#0d0e12",
          panel: "#16181f",
          border: "#272a35",
          gold: "#e0b23c",
          cash: "#4cc2ff",
        },
      },
    },
  },
  plugins: [],
};

export default config;
