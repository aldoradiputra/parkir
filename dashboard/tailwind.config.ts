import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          base: "#0A0A0A",
          raised: "#111111",
          overlay: "#1A1A1A",
          elevated: "#222222",
        },
        text: {
          primary: "#F5F5F0",
          secondary: "#A3A39A",
          tertiary: "#666660",
        },
        amber: {
          DEFAULT: "#F5A623",
          50: "#FEF7E8",
          100: "#FDECC6",
          200: "#FBD98D",
          300: "#F8C154",
          400: "#F5A623",
          500: "#E08E0B",
          600: "#B87008",
          700: "#8A5406",
          800: "#5C3804",
          900: "#2E1C02",
        },
        success: "#22C55E",
        error: "#EF4444",
        info: "#3B82F6",
        border: "#2A2A2A",
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "8px",
        md: "8px",
        lg: "12px",
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem", { lineHeight: "2rem" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
      },
    },
  },
  plugins: [],
};

export default config;
