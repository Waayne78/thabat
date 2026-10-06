import { create } from "zustand";

import { api } from "@/services/api";
import { refreshSession, setAccessToken, setSessionLostHandler } from "@/services/http";
import type { TokenResponse, User } from "@/types/api";

interface AuthState {
  user: User | null;
  status: "loading" | "authenticated" | "anonymous";
  bootstrap: () => Promise<void>;
  accept: (t: TokenResponse) => void;
  setUser: (u: User) => void;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  status: "loading",
  bootstrap: async () => {
    const data = await refreshSession();
    set(data ? { user: data.user, status: "authenticated" } : { user: null, status: "anonymous" });
  },
  accept: (t) => {
    setAccessToken(t.access_token);
    set({ user: t.user, status: "authenticated" });
  },
  setUser: (user) => set({ user }),
  logout: async () => {
    await api.logout().catch(() => null);
    setAccessToken(null);
    set({ user: null, status: "anonymous" });
  },
}));

setSessionLostHandler(() => {
  setAccessToken(null);
  useAuth.setState({ user: null, status: "anonymous" });
});
