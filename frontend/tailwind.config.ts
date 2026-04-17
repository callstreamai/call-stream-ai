import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "#000000",
        foreground: "#ffffff",
        card: "#111111",
        "card-hover": "#1a1a1a",
        border: "#222222",
        "border-light": "#333333",
        accent: "#3b82f6",
        "accent-hover": "#2563eb",
        muted: "#888888",
        success: "#22c55e",
        warning: "#eab308",
        danger: "#ef4444",
      },
    },
  },
  plugins: [],
};

export default config;
