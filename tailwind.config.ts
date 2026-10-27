import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Design-brief palette ───────────────────────────────────────────
        canvas:  "#0F1115",   // app shell background (never pure #000)
        panel:   "#181B22",   // card / component surface
        border:  "#2C303B",   // 1 px separator between panels
        primary: "#39FF14",   // Toxic Bright Green — eco / safe state
        "primary-dim": "#2BCC10",
        "primary-glow": "rgba(57,255,20,0.18)",
        // ── Backward-compatible aliases ────────────────────────────────────
        brand: {
          50:  "#f0fdf4",
          100: "#dcfce7",
          500: "#39FF14",
          600: "#2BCC10",
          700: "#1f9a0c",
          800: "#166534",
          900: "#0e3b1e",
        },
        ink: {
          700: "#1e293b",
          800: "#151d2c",
          900: "#0c1220",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-inter)", "ui-sans-serif", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        card:        "0 1px 2px rgba(0,0,0,0.18), 0 8px 24px -12px rgba(0,0,0,0.35)",
        "card-hover": "0 2px 4px rgba(0,0,0,0.22), 0 18px 40px -16px rgba(0,0,0,0.45)",
        glow:        "0 0 0 1px rgba(57,255,20,0.22), 0 12px 32px -12px rgba(57,255,20,0.35)",
        "glow-cyan":  "0 0 0 1px rgba(6,182,212,0.22), 0 12px 32px -12px rgba(6,182,212,0.35)",
        "glow-amber": "0 0 0 1px rgba(245,158,11,0.22), 0 12px 32px -12px rgba(245,158,11,0.4)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(10px) scale(0.985)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        pop: {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "60%": { opacity: "1", transform: "scale(1.02)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.7)", opacity: "0.7" },
          "70%": { transform: "scale(1.9)", opacity: "0" },
          "100%": { transform: "scale(1.9)", opacity: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "sheen-sweep": {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(120%)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.35s ease-out both",
        rise: "rise 0.42s cubic-bezier(0.22, 1, 0.36, 1) both",
        pop: "pop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "pulse-ring": "pulse-ring 1.6s cubic-bezier(0, 0, 0.2, 1) infinite",
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
