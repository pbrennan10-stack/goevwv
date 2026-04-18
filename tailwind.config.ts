import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#059669", // emerald-600 - our accent green
          dark: "#047857",
          light: "#34d399",
          bg: "#ecfdf5",
        },
        ink: {
          DEFAULT: "#0f172a", // slate-900
          muted: "#475569",  // slate-600
          soft: "#64748b",   // slate-500
        },
        surface: {
          DEFAULT: "#ffffff",
          raised: "#f8fafc",
          sunken: "#f1f5f9",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Oxygen",
          "Ubuntu",
          "sans-serif",
        ],
      },
      maxWidth: {
        content: "1280px",
      },
    },
  },
  plugins: [],
};

export default config;
