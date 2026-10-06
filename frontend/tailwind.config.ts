import type { Config } from "tailwindcss";

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        paper: token("paper"),
        surface: token("surface"),
        sunken: token("sunken"),
        ink: token("ink"),
        muted: token("muted"),
        line: token("line"),
        pine: { DEFAULT: token("pine"), soft: token("pine-soft"), on: token("on-pine") },
        clay: { DEFAULT: token("clay"), soft: token("clay-soft") },
        m: { 0: token("m0"), 1: token("m1"), 2: token("m2"), 3: token("m3"), 4: token("m4") },
        state: { done: token("done"), partial: token("partial"), missed: token("missed"), review: token("review") },
      },
      fontFamily: {
        sans: ['"Schibsted Grotesk Variable"', "system-ui", "sans-serif"],
        display: ['"Schibsted Grotesk Variable"', "system-ui", "sans-serif"],
        quran: ['"Amiri Quran"', '"Traditional Arabic"', "serif"],
      },
      borderRadius: { xl: "8px", "2xl": "10px", "3xl": "14px" },
      boxShadow: {
        card: "0 1px 2px rgb(var(--shadow) / 0.08)",
        lift: "0 8px 24px -8px rgb(var(--shadow) / 0.25)",
      },
      keyframes: {
        rise: { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
        fade: { from: { opacity: "0" }, to: { opacity: "1" } },
        sheet: { from: { transform: "translateY(100%)" }, to: { transform: "none" } },
        pop: { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
        shimmer: { to: { backgroundPosition: "-200% 0" } },
        breathe: { "0%,100%": { transform: "scale(1)", opacity: ".55" }, "50%": { transform: "scale(1.12)", opacity: ".2" } },
      },
      animation: {
        rise: "rise .25s ease-out both",
        fade: "fade .3s ease both",
        sheet: "sheet .32s cubic-bezier(.2,.8,.2,1) both",
        pop: "pop .2s ease-out both",
        shimmer: "shimmer 1.6s linear infinite",
        breathe: "breathe 3.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
