/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        ink: {
          950: "#15131A",
          900: "#1A1722",
          850: "#211D2A",
          800: "#272231",
          700: "#322C3E",
          600: "#413A50",
        },
        amber: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          dim: "rgb(var(--accent-dim) / <alpha-value>)",
          deep: "rgb(var(--accent-deep) / <alpha-value>)",
          glow: "rgb(var(--accent-glow) / <alpha-value>)",
        },
        mist: "#C9A9A6",
        moss: "#4A5D5A",
        cream: "#EDE7E0",
        muted: "#8A8392",
        line: "#2A2630",
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', "Georgia", "serif"],
        sans: ['"Noto Sans SC"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px -6px rgb(var(--accent) / 0.45)",
        card: "0 18px 40px -24px rgba(0,0,0,0.7)",
      },
      keyframes: {
        riseIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        flicker: {
          "0%,100%": { opacity: "0.85" },
          "50%": { opacity: "1" },
        },
        slideInLeft: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        slideInRight: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        slideUp: {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        splashShake: {
          "0%,100%": { transform: "rotate(0deg)" },
          "15%": { transform: "rotate(-5.5deg)" },
          "30%": { transform: "rotate(5.5deg)" },
          "45%": { transform: "rotate(-4deg)" },
          "60%": { transform: "rotate(4deg)" },
          "75%": { transform: "rotate(-1.5deg)" },
        },
        corkPop: {
          "0%": { transform: "translateY(0) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translateY(-95px) rotate(32deg)", opacity: "0" },
        },
        starBurst: {
          "0%": { transform: "scale(0)", opacity: "0" },
          "35%": { opacity: "1" },
          "100%": { transform: "scale(2.6)", opacity: "0" },
        },
        bubbleBurst: {
          "0%": { transform: "translate(0,0) scale(0.3)", opacity: "0" },
          "25%": { opacity: "1" },
          "100%": {
            transform: "translate(var(--bx), var(--by)) scale(1.2)",
            opacity: "0",
          },
        },
        splashFade: {
          "0%,82%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
      },
      animation: {
        riseIn: "riseIn 0.5s cubic-bezier(0.22,1,0.36,1) both",
        fadeIn: "fadeIn 0.4s ease both",
        flicker: "flicker 4s ease-in-out infinite",
        slideInLeft: "slideInLeft 0.32s cubic-bezier(0.22,1,0.36,1) both",
        slideInRight: "slideInRight 0.32s cubic-bezier(0.22,1,0.36,1) both",
        slideUp: "slideUp 0.36s cubic-bezier(0.22,1,0.36,1) both",
        splashShake: "splashShake 0.7s ease-in-out both",
        corkPop: "corkPop 0.5s cubic-bezier(0.4,0,0.2,1) both",
        starBurst: "starBurst 0.6s ease-out both",
        bubbleBurst: "bubbleBurst 1s ease-out both",
        splashFade: "splashFade 2.7s ease-in-out both",
      },
    },
  },
  plugins: [],
};
