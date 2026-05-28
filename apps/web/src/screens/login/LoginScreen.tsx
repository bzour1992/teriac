import { useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { login } from "../../lib/auth/api";
import { authStore, setRememberPref } from "../../lib/auth/store";
import { ApiError } from "../../lib/api/client";

interface LocationState {
  from?: { pathname?: string };
}

export function LoginScreen(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      // Pick storage BEFORE setSession so the persist middleware writes to
      // the right place on this very first write.
      setRememberPref(rememberMe);
      const res = await login(username, password);
      authStore.getState().setSession({
        accessToken: res.tokens.token,
        refreshToken: res.tokens.refreshToken,
        user: res.user,
        hcenter: res.hcenter,
      });
      const from = (location.state as LocationState | null)?.from?.pathname ?? "/";
      navigate(from, { replace: true });
    } catch (err) {
      // Log the full error to console
      console.error("Full error object:", err);
      
      if (err instanceof ApiError) {
        // Log just the message (no response property)
        console.error("API Error:", err.message);
        setError(err.message);
      } else if (err instanceof Error) {
        // Handle standard errors
        console.error("Standard error:", err.message);
        setError(`${t("login.network_error")} - ${err.message}`);
      } else {
        // Handle unknown errors
        console.error("Unknown error:", err);
        setError(t("login.network_error", { defaultValue: "Network error — try again" }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-paper">
      {/* Decorative primary wash from the inline-end corner (per design-system §8.8). */}
      <div
        className="pointer-events-none absolute -inset-1/2 -z-0 opacity-60"
        style={{
          background:
            "radial-gradient(60% 40% at 80% 20%, var(--primary-100) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1480px] items-center justify-center px-5">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary" />
            <span className="font-serif text-2xl font-medium">Teriac</span>
          </div>

          <div className="eyebrow mb-2">
            {t("login.eyebrow", { defaultValue: "Sign in" })}
          </div>
          <h1 className="font-serif text-[32px] leading-[38px] tracking-tight">
            {t("login.title", { defaultValue: "Welcome back" })}
          </h1>
          <p className="mt-2 text-[14px] text-ink-3">
            {t("login.subtitle", {
              defaultValue: "Sign in to your clinic workspace.",
            })}
          </p>

          <form
            onSubmit={onSubmit}
            className="mt-8 rounded-lg border border-rule bg-card p-6 shadow-1"
          >
            <label className="block">
              <span className="text-[13px] font-medium text-ink-2">
                {t("login.username", { defaultValue: "Username or email" })}
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                className="mt-1.5 w-full rounded-[10px] border border-rule bg-card px-3 py-2.5 text-[14px] outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-[13px] font-medium text-ink-2">
                {t("login.password", { defaultValue: "Password" })}
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="mt-1.5 w-full rounded-[10px] border border-rule bg-card px-3 py-2.5 text-[14px] outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
              />
            </label>

            <label className="mt-4 flex items-center gap-2 text-[13px] text-ink-2">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="size-4 rounded border-rule accent-primary"
              />
              <span>
                {t("login.remember_me", { defaultValue: "Keep me logged in" })}
              </span>
            </label>

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-[10px] bg-alert-bg px-3 py-2.5 text-[13px] text-alert-fg"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !username || !password}
              className="mt-6 inline-flex w-full items-center justify-center rounded-[10px] bg-primary px-4 py-2.5 text-[14px] font-medium text-white transition-colors duration-2 hover:bg-primary-600 active:translate-y-px disabled:cursor-not-allowed disabled:bg-primary-200"
            >
              {submitting
                ? t("login.submitting", { defaultValue: "Signing in…" })
                : t("login.submit", { defaultValue: "Sign in" })}
            </button>
          </form>

          <p className="mt-6 text-center text-[12px] text-ink-4">
            {t("login.support", {
              defaultValue: "Need help? Contact your clinic administrator.",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
