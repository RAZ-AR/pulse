import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "../../packages/*/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Neutral palette — merchant app is a professional tool
        background: {
          DEFAULT: "#FFFFFF",
          dark: "#0F1115",
        },
        surface: {
          DEFAULT: "#F9FAFB",
          dark: "#181B23",
        },
        border: {
          DEFAULT: "#E5E7EB",
          dark: "#1F2937",
        },
        text: {
          primary: "#0F1115",
          secondary: "#6B7280",
        },
        // Brand accents (used sparingly in merchant)
        pulse: {
          pink: "#FF4D8F",
          blue: "#3DBEFF",
          green: "#1FE3A0",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
}

export default config
