import { useMemo, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { authStore, useAuth } from "../lib/auth/store";
import { setLanguage, getCurrentLanguage } from "../i18n";
import { useDocumentTitle } from "../lib/use-document-title";
import { QuickActions } from "./QuickActions";

interface NavItem {
  to: string;
  key: string;
  icon: string;
  /** When set, this item is hidden unless the named module is enabled for the
   *  current clinic (per superadmin module-toggle). Core nav items leave this
   *  unset and are always visible. */
  requiresModule?: string;
}

const NAV_KEYS: readonly NavItem[] = [
  { to: "/",         key: "nav.dashboard", icon: "🏠" },
  { to: "/patients", key: "nav.patients",  icon: "👥" },
  { to: "/schedule", key: "nav.schedule",  icon: "🗓" },
  { to: "/visits",   key: "nav.visits",    icon: "📋" },
  { to: "/billing",  key: "nav.billing",   icon: "💳" },
  { to: "/finance",  key: "nav.finance",   icon: "📊", requiresModule: "finance" },
  { to: "/admin",    key: "nav.admin",     icon: "⚙"  },
];

export function AppShell(): JSX.Element {
  const { t } = useTranslation();
  const { user, hcenter } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const lang = getCurrentLanguage();
  const enabledModules = hcenter?.enabledModules ?? [];
  const navItems = useMemo(
    () =>
      NAV_KEYS.filter(
        (item) => !item.requiresModule || enabledModules.includes(item.requiresModule),
      ),
    [enabledModules],
  );
  const location = useLocation();

  // Route-aware browser tab title. Suffix with the clinic (or "Teriac" fallback)
  // so users can tell tabs apart when working in multiple clinics.
  const suffix = hcenter?.hcenterName?.trim() || "Teriac";
  const pageLabel = useMemo(
    () => labelForPath(location.pathname, t),
    [location.pathname, t],
  );
  useDocumentTitle(pageLabel ? `${pageLabel} - ${suffix}` : suffix);
  const isDark =
    typeof document !== "undefined" && document.documentElement.dataset.theme === "dark";

  const toggleTheme = (): void => {
    document.documentElement.dataset.theme = isDark ? "light" : "dark";
    // Force re-render of toggle label.
    setCollapsed((c) => c);
  };

  const onLogout = (): void => {
    authStore.getState().logout();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 z-20 flex flex-col border-e border-rule bg-paper-2 transition-all duration-3 ease-standard ${
          collapsed ? "w-[68px]" : "w-[248px]"
        } hidden md:flex`}
        style={{ insetInlineStart: 0 }}
      >
        <div className="flex h-16 items-center gap-3 border-b border-rule px-5">
          <div className="size-8 shrink-0 rounded-lg bg-primary" />
          {!collapsed && <span className="font-serif text-xl font-medium">Teriac</span>}
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-3 rounded-[10px] px-3 py-2 text-[14px] transition-colors duration-2",
                      isActive
                        ? "bg-primary-50 text-primary-700 font-medium"
                        : "text-ink-2 hover:bg-paper-3",
                    ].join(" ")
                  }
                >
                  <span aria-hidden className="text-base">
                    {item.icon}
                  </span>
                  {!collapsed && <span>{t(item.key)}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="border-t border-rule px-3 py-3 text-start text-[12px] text-ink-3 hover:bg-paper-3"
        >
          {collapsed ? "→" : t("shell.collapse", { defaultValue: "← Collapse" })}
        </button>
      </aside>

      {/* Topbar + main */}
      <div
        className="flex min-h-screen flex-col"
        style={{ paddingInlineStart: `var(--sidebar-offset, 0)` }}
      >
        <header
          className="sticky top-0 z-10 h-16 border-b border-rule bg-card/80 backdrop-blur-sm"
          style={{
            paddingInlineStart: collapsed ? "68px" : "248px",
          }}
        >
          <div className="mx-auto flex h-full max-w-[1480px] items-center justify-between px-8">
            <div>
              <div className="eyebrow">{hcenter?.hcenterName ?? ""}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLanguage(lang === "en" ? "ar" : "en")}
                className="rounded-[10px] border border-rule bg-card px-3 py-1.5 font-mono text-[11.5px] font-medium uppercase tracking-wider text-ink-2 transition-colors duration-2 hover:border-rule-2"
              >
                {lang === "en" ? "AR" : "EN"}
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-[10px] border border-rule bg-card px-3 py-1.5 font-mono text-[11.5px] font-medium uppercase tracking-wider text-ink-2 transition-colors duration-2 hover:border-rule-2"
              >
                {isDark ? "☀" : "☾"}
              </button>
              <div className="ms-2 flex items-center gap-2 rounded-[10px] border border-rule bg-card px-3 py-1.5">
                <div className="size-7 rounded-full bg-gradient-to-br from-primary to-primary-700 text-center font-mono text-[12px] font-medium leading-7 text-white">
                  {user?.firstName?.[0] ?? user?.userName?.[0] ?? "U"}
                </div>
                <div className="hidden text-[13px] leading-tight md:block">
                  <div className="font-medium">
                    {user?.firstName} {user?.lastName}
                  </div>
                  <div className="text-[11px] text-ink-3">{user?.userName}</div>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="ms-1 text-[12px] text-ink-3 hover:text-ink"
                  title="Logout"
                >
                  ⏻
                </button>
              </div>
            </div>
          </div>
        </header>

        <main
          className="flex-1"
          style={{
            paddingInlineStart: collapsed ? "68px" : "248px",
          }}
        >
          <div className="mx-auto max-w-[1480px] px-8 py-8">
            <Outlet />
          </div>
        </main>
      </div>
      <QuickActions />
    </div>
  );
}

function labelForPath(pathname: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  // Strip any trailing slash and split into segments.
  const segments = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  if (segments.length === 0) return t("nav.dashboard", { defaultValue: "Dashboard" });

  const root = segments[0];
  const hasDetail = segments.length > 1;

  switch (root) {
    case "patients":
      return hasDetail
        ? t("patients.title_detail", { defaultValue: "Patient" })
        : t("nav.patients", { defaultValue: "Patients" });
    case "schedule":
      return t("nav.schedule", { defaultValue: "Schedule" });
    case "visits":
      return hasDetail
        ? t("visits.title_detail", { defaultValue: "Visit" })
        : t("nav.visits", { defaultValue: "Visits" });
    case "billing":
      return t("nav.billing", { defaultValue: "Billing" });
    case "finance":
      return t("nav.finance", { defaultValue: "Finance" });
    case "admin":
      return t("nav.admin", { defaultValue: "Admin" });
    case "login":
      return t("auth.sign_in", { defaultValue: "Sign in" });
    default:
      // Fallback: title-case the first segment.
      return root.charAt(0).toUpperCase() + root.slice(1);
  }
}

export function PageHead({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  actions?: ReactNode;
}): JSX.Element {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div>
        {eyebrow !== undefined && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="font-serif text-[32px] font-medium leading-[38px] tracking-tight">
          {title}
        </h1>
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}
