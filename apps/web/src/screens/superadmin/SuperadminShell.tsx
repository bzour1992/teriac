import { useMemo } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { authStore, useAuth } from "../../lib/auth/store";
import { useDocumentTitle } from "../../lib/use-document-title";

interface NavItem {
  to: string;
  key: string;
  icon: string;
  end?: boolean;
}

const SA_NAV: readonly NavItem[] = [
  { to: "/superadmin",             key: "superadmin.nav.dashboard",   icon: "📊", end: true },
  { to: "/superadmin/clinics",     key: "superadmin.nav.clinics",     icon: "🏥" },
  { to: "/superadmin/specialties", key: "superadmin.nav.specialties", icon: "🩺" },
  { to: "/superadmin/users",       key: "superadmin.nav.users",       icon: "👥" },
];

export function SuperadminShell(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();

  // Per-section browser tab title under the super admin portal.
  const sectionLabel = useMemo(() => {
    const seg = location.pathname.replace(/^\/superadmin\/?/, "").split("/")[0];
    switch (seg) {
      case "":          return t("superadmin.nav.dashboard", { defaultValue: "Dashboard" });
      case "clinics":   return t("superadmin.nav.clinics",   { defaultValue: "Clinics" });
      case "specialties": return t("superadmin.nav.specialties", { defaultValue: "Specialties" });
      case "users":     return t("superadmin.nav.users",     { defaultValue: "Users" });
      default:          return seg.charAt(0).toUpperCase() + seg.slice(1);
    }
  }, [location.pathname, t]);
  useDocumentTitle(`${sectionLabel} - Super admin - Teriac`);

  const onLogout = (): void => {
    authStore.getState().logout();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Sidebar — fixed, dark accent */}
      <aside
        className="fixed inset-y-0 z-20 hidden w-[240px] flex-col border-e border-rule bg-paper-2 md:flex"
        style={{ insetInlineStart: 0 }}
      >
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 border-b border-rule px-5">
          <div className="size-8 shrink-0 rounded-lg bg-alert-fg" aria-hidden />
          <div>
            <div className="font-serif text-[18px] font-medium leading-tight">Teriac</div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-alert-fg">
              {t("superadmin.badge", { defaultValue: "Super Admin" })}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {SA_NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-3 rounded-[10px] px-3 py-2 text-[14px] transition-colors duration-2",
                      isActive
                        ? "bg-alert-fg/10 font-medium text-alert-fg"
                        : "text-ink-2 hover:bg-paper-3",
                    ].join(" ")
                  }
                >
                  <span aria-hidden className="text-base">{item.icon}</span>
                  <span>{t(item.key)}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Bottom: back to clinic */}
        <Link
          to="/patients"
          className="border-t border-rule px-4 py-3 text-[12.5px] text-ink-3 transition-colors hover:bg-paper-3 hover:text-ink-2"
        >
          ← {t("superadmin.back_to_clinic", { defaultValue: "Back to clinic" })}
        </Link>
      </aside>

      {/* Topbar + main */}
      <div className="flex min-h-screen flex-col" style={{ paddingInlineStart: "240px" }}>
        <header className="sticky top-0 z-10 h-16 border-b border-rule bg-card/80 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-[1480px] items-center justify-between px-8">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-alert-fg/10 px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-alert-fg">
                <span aria-hidden className="size-1.5 rounded-full bg-alert-fg" />
                {t("superadmin.title", { defaultValue: "Super Admin Portal" })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-[10px] border border-rule bg-card px-3 py-1.5">
                <div className="size-7 rounded-full bg-gradient-to-br from-alert-fg to-alert-fg/70 text-center font-mono text-[12px] font-medium leading-7 text-white">
                  {user?.firstName?.[0] ?? user?.userName?.[0] ?? "S"}
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

        <main className="flex-1">
          <div className="mx-auto max-w-[1480px] px-8 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
