import type { Config } from "tailwindcss";

// Tokens sourced from the Outbox Labs Figma file (Login Screen + Homepage frames):
// a clean white SaaS surface, a single green accent used for primary actions, and
// two status-pill colors (peach for "scheduled/in-flight", slate for "sent").
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#111827",
          700: "#374151",
          500: "#6B7280",
          300: "#D1D5DB",
          200: "#E5E7EB",
          100: "#F3F4F6",
          50: "#F9FAFB",
        },
        brand: {
          50: "#EAF7EE",
          100: "#D7F0DE",
          500: "#2FA85B",
          600: "#1F9950",
          700: "#187F41",
        },
        scheduled: { bg: "#FCEADB", text: "#B4630F" },
        processing: { bg: "#E7E4FB", text: "#6D4FD6" },
        throttled: { bg: "#FEF3D6", text: "#A6720A" },
        sent: { bg: "#EEF1F4", text: "#475467" },
        failed: { bg: "#FCE8E7", text: "#C0362C" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)",
        popover: "0 8px 24px rgba(16, 24, 40, 0.12), 0 2px 6px rgba(16, 24, 40, 0.08)",
      },
      borderRadius: {
        xl: "0.875rem",
      },
    },
  },
  plugins: [],
};
export default config;
