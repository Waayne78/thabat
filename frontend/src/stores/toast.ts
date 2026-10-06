import { create } from "zustand";

export interface Toast { id: number; message: string; tone: "info" | "success" | "error" }

let seq = 0;

export const useToasts = create<{ toasts: Toast[]; push: (message: string, tone?: Toast["tone"]) => void; dismiss: (id: number) => void }>((set) => ({
  toasts: [],
  push: (message, tone = "info") => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (message: string, tone?: Toast["tone"]) => useToasts.getState().push(message, tone);
