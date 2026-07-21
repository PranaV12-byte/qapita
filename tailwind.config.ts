import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "surface-1": "var(--surface-1)",
        "surface-2": "var(--surface-2)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        heading: "var(--text-head)",
        primary: "var(--text-primary)",
        body: "var(--text-body)",
        muted: "var(--text-muted)",
        accent: "var(--accent)",
        "accent-solid": "var(--accent-solid)",
        "accent-on": "var(--accent-on)",
        "accent-line": "var(--accent-line)",
        draft: "var(--draft)",
        certified: "var(--certified)",
        danger: "var(--danger)",
      },
      backgroundColor: {
        bg: "var(--bg)",
        "surface-1": "var(--surface-1)",
        "surface-2": "var(--surface-2)",
        "accent-solid": "var(--accent-solid)",
      },
      textColor: {
        heading: "var(--text-head)",
        primary: "var(--text-primary)",
        body: "var(--text-body)",
        muted: "var(--text-muted)",
        accent: "var(--accent)",
        "accent-on": "var(--accent-on)",
        draft: "var(--draft)",
      },
      borderColor: {
        DEFAULT: "var(--border)",
        strong: "var(--border-strong)",
        accent: "var(--accent-line)",
      },
      fontFamily: {
        head: ["var(--font-head)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
