// Lightweight typed fetch wrapper.
// Adds Authorization header, parses JSON, throws on non-2xx.
// Handles 401 by attempting one refresh, then falling back to logout.

import { authStore } from "../auth/store";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  /** Skip auth header. For /auth/login, /auth/refresh, /health. */
  anonymous?: boolean;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  return doRequest<T>(path, options, /* allowRetry */ true);
}

async function doRequest<T>(path: string, options: ApiOptions, allowRetry: boolean): Promise<T> {
  const url = buildUrl(path, options.query);
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  if (!options.anonymous) {
    const token = authStore.getState().accessToken;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
    credentials: "omit",
  });

  if (res.status === 401 && !options.anonymous && allowRetry) {
    const result = await authStore.getState().refresh();
    if (result === "ok") {
      // Retry once with the fresh token. If that *also* 401s the token is
      // structurally bad (signature mismatch, secret rotation, etc.); the
      // recursive call below sees allowRetry=false and a 401 will fall into
      // the !res.ok branch, throwing without another refresh loop.
      try {
        return await doRequest<T>(path, options, false);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          // Even a freshly-minted token was rejected — sign out cleanly so the
          // user sees the login screen instead of a confusing "Invalid token".
          authStore.getState().logout();
        }
        throw err;
      }
    }
    // Only log out when the refresh token itself is invalid. Network blips and
    // 5xx during refresh are transient — keep the session and let the next
    // call try again. The original 401 still bubbles up as an ApiError.
    if (result === "invalid" || result === "no_token") {
      authStore.getState().logout();
    }
    throw new ApiError(401, "Unauthorized");
  }

  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(res.status, extractMessage(body, res.statusText), body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function buildUrl(path: string, query?: ApiOptions["query"]): string {
  const url = new URL(path.startsWith("/") ? `${BASE_URL}${path}` : `${BASE_URL}/${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function extractMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "message" in body) {
    const m = (body as { message: unknown }).message;
    if (typeof m === "string") return m;
    if (Array.isArray(m) && m.every((x) => typeof x === "string")) return m.join("; ");
  }
  return fallback;
}
