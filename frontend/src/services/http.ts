import type { TokenResponse } from "@/types/api";

const BASE = "/api/v1";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fields?: { field: string; message: string }[]) {
    super(message);
  }
}

// The access token lives in memory only; the refresh token is an httpOnly cookie the JS never sees.
let accessToken: string | null = null;
let onSessionLost: (() => void) | null = null;
let refreshing: Promise<TokenResponse | null> | null = null;

export const setAccessToken = (t: string | null) => { accessToken = t; };
export const setSessionLostHandler = (fn: () => void) => { onSessionLost = fn; };

async function parse(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function toError(status: number, body: unknown): ApiError {
  const err = (body as { error?: { code?: string; message?: string; fields?: { field: string; message: string }[] } } | null)?.error;
  return new ApiError(status, err?.code ?? "unknown", err?.message ?? "Une erreur est survenue. Réessaie dans un instant.", err?.fields);
}

export function refreshSession(): Promise<TokenResponse | null> {
  // single flight: concurrent 401s share one refresh (rotation would invalidate the others)
  refreshing ??= fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "include" })
    .then(async (res) => {
      if (!res.ok) return null;
      const data = (await res.json()) as TokenResponse;
      accessToken = data.access_token;
      return data;
    })
    .catch(() => null)
    .finally(() => { refreshing = null; });
  return refreshing;
}

export async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: "include",
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "network", "Connexion impossible. Vérifie ton réseau puis réessaie.");
  }
  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
    if (await refreshSession()) return request<T>(method, path, body, false);
    onSessionLost?.();
  }
  const data = await parse(res).catch(() => null);
  if (!res.ok) throw toError(res.status, data);
  return data as T;
}

export const http = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: <T = null>(path: string) => request<T>("DELETE", path),
};
