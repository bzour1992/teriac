import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface AuthUser {
  userId: string;
  userName: string;
  firstName: string | null;
  lastName: string | null;
  userType: number;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  language: string;
}

export interface AuthHCenter {
  hcenterId: string;
  hcenterName: string;
  /** Module keys this clinic has turned on (set by the superadmin). */
  enabledModules: string[];
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  hcenter: AuthHCenter | null;
  /** True while a refresh is in flight (prevents stampede). */
  refreshing: boolean;
  setSession: (s: {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
    hcenter: AuthHCenter;
  }) => void;
  setTokens: (t: { accessToken: string; refreshToken: string }) => void;
  setUser: (u: AuthUser) => void;
  logout: () => void;
  /**
   * Result of an attempted token refresh:
   *   - "ok"        — got fresh tokens; retry the original request.
   *   - "invalid"   — refresh token was rejected (401/403); user is logged out.
   *   - "transient" — network or 5xx error; tokens are kept, caller should
   *                   propagate the original error without forcing logout.
   *   - "no_token"  — there was no refresh token to begin with.
   */
  refresh: () => Promise<"ok" | "invalid" | "transient" | "no_token">;
}

const STORAGE_KEY = "teriac:auth";
const REMEMBER_KEY = "teriac:auth:remember";
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/v1";

/**
 * "Keep me logged in" preference. When `true` (default), the session is
 * persisted in localStorage and survives browser restarts. When `false`,
 * the session lives only in sessionStorage and is cleared when the tab is
 * closed. Stored in localStorage itself so we can pick the right storage on
 * load.
 */
export function setRememberPref(remember: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(REMEMBER_KEY, remember ? "true" : "false");
}

function getRememberPref(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(REMEMBER_KEY) !== "false";
}

/**
 * Storage facade that routes to localStorage or sessionStorage depending on the
 * current "remember me" preference. On read we fall back to whichever store
 * has the entry, so a previously-remembered session keeps working even if the
 * preference flag is later toggled.
 */
/**
 * Module-level promise tracker for token refresh. Replaces the previous
 * `subscribe`-based wait, which had a race: if the in-flight refresh resolved
 * between the caller checking `refreshing: true` and attaching the
 * subscription, the subscription never fired and the caller fell through with
 * a stale (still-401) access token.
 *
 * With this single shared promise, every concurrent 401 awaits the SAME
 * refresh attempt and receives the same outcome — no chance of stale-token
 * fall-through.
 */
type RefreshResult = "ok" | "invalid" | "transient" | "no_token";
let inFlightRefresh: Promise<RefreshResult> | null = null;

const dynamicStorage: Storage = {
  length: 0,
  clear: () => {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  },
  key: () => null,
  getItem: (name: string): string | null =>
    localStorage.getItem(name) ?? sessionStorage.getItem(name),
  setItem: (name: string, value: string): void => {
    if (getRememberPref()) {
      localStorage.setItem(name, value);
      sessionStorage.removeItem(name);
    } else {
      sessionStorage.setItem(name, value);
      localStorage.removeItem(name);
    }
  },
  removeItem: (name: string): void => {
    localStorage.removeItem(name);
    sessionStorage.removeItem(name);
  },
};

export const authStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      hcenter: null,
      refreshing: false,
      setSession: (s) =>
        set({
          accessToken: s.accessToken,
          refreshToken: s.refreshToken,
          user: s.user,
          hcenter: s.hcenter,
        }),
      setTokens: (t) => set({ accessToken: t.accessToken, refreshToken: t.refreshToken }),
      setUser: (u) => set({ user: u }),
      logout: () =>
        set({ accessToken: null, refreshToken: null, user: null, hcenter: null }),
      refresh: async () => {
        // Coalesce all concurrent callers onto the same in-flight promise.
        if (inFlightRefresh) return inFlightRefresh;

        const { refreshToken } = get();
        if (!refreshToken) return "no_token";

        inFlightRefresh = (async (): Promise<RefreshResult> => {
          set({ refreshing: true });
          try {
            const res = await fetch(`${API_BASE}/auth/refresh`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refreshToken }),
            });
            // 401/403 means the refresh token itself is invalid/expired — we
            // must log the user out. Any other non-2xx (5xx, 502, 504, etc.)
            // is treated as transient: keep the tokens so the next attempt
            // can retry.
            if (res.status === 401 || res.status === 403) {
              set({ refreshing: false, accessToken: null, refreshToken: null });
              return "invalid";
            }
            if (!res.ok) {
              set({ refreshing: false });
              return "transient";
            }
            const data = (await res.json()) as { token: string; refreshToken: string };
            set({
              accessToken: data.token,
              refreshToken: data.refreshToken,
              refreshing: false,
            });
            return "ok";
          } catch {
            // Network-level failure (offline, server down, abort) — DON'T
            // clear tokens; the user will reconnect and the next request can
            // retry.
            set({ refreshing: false });
            return "transient";
          } finally {
            inFlightRefresh = null;
          }
        })();
        return inFlightRefresh;
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => dynamicStorage),
      // Don't persist `refreshing` — it's an in-memory flag.
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        user: s.user,
        hcenter: s.hcenter,
      }),
    },
  ),
);

export function useAuth(): AuthState {
  return authStore();
}

export function useIsAuthenticated(): boolean {
  return authStore((s) => !!s.accessToken && !!s.user);
}

/** Returns true when the current clinic has the given module turned on. */
export function useModuleEnabled(moduleKey: string): boolean {
  return authStore((s) => s.hcenter?.enabledModules?.includes(moduleKey) ?? false);
}
