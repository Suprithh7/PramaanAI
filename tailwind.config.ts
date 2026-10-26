import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#f2f5f8",
          100: "#e2e9f0",
          200: "#c4d3e0",
          300: "#97b0c7",
          400: "#6488a8",
          500: "#456a8c",
          600: "#345374",
          700: "#2a425d",
          800: "#1c2f44",
          900: "#0e2033",
          950: "#081624",
        },
        parchment: "#f6f5f1",
        paper: "#fbfaf7",
        ink: "#111b25",
        brass: {
          50: "#fbf7ec",
          100: "#f5edcf",
          200: "#ead9a0",
          300: "#ddbf66",
          400: "#d2a941",
          500: "#b98a2b",
          600: "#9c6b22",
          700: "#7f5120",
          800: "#684220",
          900: "#58381f",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "Cambria", "serif"],
        mono: ["var(--font-mono)", "Consolas", "Monaco", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "0.95rem" }],
        "3xs": ["0.625rem", { lineHeight: "0.85rem" }],
      },
      letterSpacing: {
        label: "0.09em",
        wider2: "0.14em",
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(14,32,51,0.06), 0 1px 3px rgba(14,32,51,0.08)",
        "panel-lift":
          "0 1px 0 0 rgba(14,32,51,0.05), 0 10px 28px -14px rgba(8,22,36,0.3)",
        lift: "0 8px 24px rgba(8,22,36,0.18)",
        command: "0 28px 80px -24px rgba(8,22,36,0.5), 0 2px 8px rgba(8,22,36,0.12)",
      },
      borderRadius: {
        none: "0",
        sm: "2px",
        DEFAULT: "3px",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "page-in": {
          from: { opacity: "0", transform: "translateY(5px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "command-in": {
          from: { opacity: "0", transform: "translateY(-6px) scale(0.995)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "page-in": "page-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 180ms ease-out both",
        "command-in": "command-in 180ms cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 1.6s ease-in-out infinite",
      },
      backgroundImage: {
        "grid-fine":
          "linear-gradient(to right, rgba(14,32,51,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(14,32,51,0.045) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "24px 24px",
      },
    },
  },
  plugins: [],
};

export default config;
