import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          // Text and buttons: emerald-700 passes WCAG AA (5.5:1 on white);
          // the lighter emerald-600 ("bright") is for fills with no text
          // (chart bars, focus rings, slider thumbs), which need only 3:1.
          DEFAULT: "#047857",
          dark: "#065f46",
          bright: "#059669",
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
