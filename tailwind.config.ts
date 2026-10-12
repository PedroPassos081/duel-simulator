import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
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
      keyframes: {
        "card-summon": {
          "0%": {
            opacity: "0",
            transform: "scale(0.35) rotate(-6deg)",
            filter: "brightness(2.2) saturate(1.3)",
          },
          "60%": {
            opacity: "1",
            transform: "scale(1.08) rotate(2deg)",
            filter: "brightness(1.4)",
          },
          "100%": {
            opacity: "1",
            transform: "scale(1) rotate(0deg)",
            filter: "brightness(1)",
          },
        },
        "overlay-fade": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "banner-drift": {
          "0%": { transform: "scale(1.02)" },
          "100%": { transform: "scale(1.12)" },
        },
        "modal-pop": {
          "0%": { opacity: "0", transform: "scale(0.85) translateY(12px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
      },
      animation: {
        "card-summon": "card-summon 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
        "overlay-fade": "overlay-fade 0.2s ease-out",
        "banner-drift": "banner-drift 18s ease-in-out infinite alternate",
        "modal-pop": "modal-pop 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
