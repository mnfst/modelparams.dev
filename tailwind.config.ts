import type { Config } from "tailwindcss";

/* ── Major Third scale (1.250) ──────────────────────────────
 * base = 1rem (16px)
 * sm   = 1.250rem  (20px)   — h6
 * md   = 1.563rem  (25px)   — h5
 * lg   = 1.953rem  (31.25px) — h4
 * xl   = 2.441rem  (39px)   — h3
 * 2xl  = 3.052rem  (48.8px) — h2
 * 3xl  = 3.815rem  (61px)   — h1
 */

const config: Config = {
  content: ["./src/views/**/*.ejs", "./src/client/**/*.ts"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Outfit", "system-ui", "-apple-system", "sans-serif"],
        serif: ["Ovo", "Georgia", "Cambria", "serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "scale-sm": ["1.25rem", { lineHeight: "1.3" }],
        "scale-md": ["1.563rem", { lineHeight: "1.25" }],
        "scale-lg": ["1.953rem", { lineHeight: "1.2" }],
        "scale-xl": ["2.441rem", { lineHeight: "1.15" }],
        "scale-2xl": ["3.052rem", { lineHeight: "1.1" }],
        "scale-3xl": ["3.815rem", { lineHeight: "1.05" }],
      },
      colors: {
        accent: {
          DEFAULT: "#2530F0",
          hover: "#1a22c4",
        },
        warm: {
          hover: "#e6e1d9",
          tag: "#f0ece5",
        },
      },
    },
  },
  plugins: [],
};

export default config;
