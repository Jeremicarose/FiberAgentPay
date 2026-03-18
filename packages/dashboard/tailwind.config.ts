import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ckb: {
          green: "#00CC9B",
          dark: "#0D1117",
          card: "#161B22",
          border: "#30363D",
          text: "#C9D1D9",
          muted: "#8B949E",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
