import { create } from "zustand";

import type { Theme } from "@/types/api";

const KEY = "thabat-theme";
const media = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && !!media?.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

function initial(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export const useTheme = create<{ theme: Theme; setTheme: (t: Theme) => void }>((set) => ({
  theme: initial(),
  setTheme: (theme) => {
    try { localStorage.setItem(KEY, theme); } catch { /* private mode */ }
    apply(theme);
    set({ theme });
  },
}));

media?.addEventListener("change", () => apply(useTheme.getState().theme));
