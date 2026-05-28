import { useState } from "react";
import { PageHead } from "../../layout/AppShell";
import { useAuth, useModuleEnabled } from "../../lib/auth/store";
import { CenterTab } from "./CenterTab";
import { UsersTab } from "./UsersTab";
import { PermissionsTab } from "./PermissionsTab";
import { AuditTab } from "./AuditTab";
import { BillingCategoriesTab } from "./BillingCategoriesTab";

type Tab = "center" | "users" | "permissions" | "billing" | "audit";

const ALL_TABS: Array<{ id: Tab; label: string; adminOnly?: boolean; requiresModule?: string }> = [
  { id: "center", label: "Center" },
  { id: "users", label: "Users" },
  { id: "permissions", label: "Permissions" },
  { id: "billing", label: "Billing categories", adminOnly: true },
  { id: "audit", label: "Audit log", adminOnly: true, requiresModule: "audit" },
];

export function AdminScreen(): JSX.Element {
  const { user } = useAuth();
  const isAdmin = !!(user?.isAdmin || user?.isSuperAdmin);
  const auditOn = useModuleEnabled("audit");
  const TABS = ALL_TABS.filter((t) => {
    if (t.adminOnly && !isAdmin) return false;
    if (t.requiresModule === "audit" && !auditOn) return false;
    return true;
  });
  const [activeTab, setActiveTab] = useState<Tab>("center");

  return (
    <>
      <PageHead eyebrow="Admin" title="Center settings" />

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 border-b border-rule">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              "px-4 py-2.5 text-[13.5px] font-medium transition-colors duration-2",
              activeTab === tab.id
                ? "border-b-[3px] border-primary text-ink"
                : "border-b-[3px] border-transparent text-ink-3 hover:text-ink",
            ].join(" ")}
            aria-current={activeTab === tab.id ? "page" : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "center" && <CenterTab />}
      {activeTab === "users" && <UsersTab />}
      {activeTab === "permissions" && <PermissionsTab />}
      {activeTab === "billing" && isAdmin && <BillingCategoriesTab />}
      {activeTab === "audit" && isAdmin && auditOn && <AuditTab />}
    </>
  );
}
