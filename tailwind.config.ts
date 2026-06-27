import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // System stack first to avoid web-font load jank on the slow Tesla browser
        // (docs/08-tesla-browser-ux.md §8.3, §8.9).
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        // Near-black night palette (docs/08 §8.4). No pure white.
        ink: {
          950: "#08090c",
          900: "#0d0f14",
          800: "#15171f",
        },
        lyric: {
          active: "#f5f6f8",
          dim: "#9aa0ad",
          faint: "#565d6b",
        },
        spotify: "#1db954",
      },
      transitionTimingFunction: {
        glide: "cubic-bezier(0.22, 0.61, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
