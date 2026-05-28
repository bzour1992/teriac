import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmModal } from "../../components/ConfirmModal";
import { ApiError } from "../../lib/api/client";
import { useDocumentTitle } from "../../lib/use-document-title";
import { getClinic, setClinicActive, type ClinicDetail } from "./api";
import { ClinicFormModal } from "./ClinicFormModal";
import { ClinicOverviewTab } from "./ClinicOverviewTab";
import { ClinicSettingsTab } from "./ClinicSettingsTab";
import { ClinicSpecialtiesTab } from "./ClinicSpecialtiesTab";
import { ClinicUsersTab } from "./ClinicUsersTab";
import { ClinicModulesTab } from "./ClinicModulesTab";
import { ClinicFieldRulesTab } from "./ClinicFieldRulesTab";
import { ClinicAuditTab } from "./ClinicAuditTab";

type Tab =
  | "overview"
  | "settings"
  | "specialties"
  | "users"
  | "modules"
  | "field-rules"
  | "audit";

const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "settings", label: "Settings" },
  { id: "specialties", label: "Specialties" },
  { id: "users", label: "Users" },
  { id: "modules", label: "Modules" },
  { id: "field-rules", label: "Field rules" },
  { id: "audit", label: "Audit" },
];

function StatusPill({ active }: { active: boolean }): JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wider ${
        active ? "bg-vital-bg text-vital-fg" : "bg-paper-3 text-ink-3"
      }`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function ClinicDetailScreen(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const clinicId = id ?? "";
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);

  const query = useQuery({
    queryKey: ["superadmin", "clinic", clinicId],
    queryFn: ({ signal }) => getClinic(clinicId, signal),
    staleTime: 60_000,
    enabled: clinicId.length > 0,
  });

  // Browser tab title: dynamic clinic name once loaded.
  useDocumentTitle(
    query.data
      ? `${query.data.name} - Super admin - Teriac`
      : "Clinic - Super admin - Teriac",
  );

  const toggleMut = useMutation({
    mutationFn: (next: boolean) => setClinicActive(clinicId, next),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin", "clinic", clinicId] });
      qc.invalidateQueries({ queryKey: ["superadmin", "clinics"] });
      setConfirmToggle(false);
    },
  });

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-1/3 animate-pulse rounded bg-paper-3" />
        <div className="h-32 animate-pulse rounded-lg bg-paper-3" />
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <div className="rounded-lg border border-rule bg-card p-8 text-center shadow-1">
        <div className="eyebrow mb-2 text-alert-fg">Error</div>
        <p className="text-[13px] text-alert-fg">
          {query.error instanceof ApiError
            ? query.error.message
            : (query.error as Error | undefined)?.message ?? "Clinic not found"}
        </p>
        <Link
          to="/superadmin/clinics"
          className="mt-4 inline-block rounded-[10px] border border-rule bg-card px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:border-rule-2"
        >
          ← Back to clinics
        </Link>
      </div>
    );
  }

  const clinic: ClinicDetail = query.data;
  const nextActive = !clinic.isActive;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-rule bg-card px-6 py-5 shadow-1">
        <div className="min-w-0 flex-1">
          <div className="eyebrow mb-2 text-alert-fg">
            <Link to="/superadmin/clinics" className="hover:text-alert-fg/80">
              Clinics
            </Link>{" "}
            ·{" "}
            <span className="font-mono tnum text-ink-4">{clinic.hcenterId}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="truncate font-serif text-[28px] font-medium leading-[34px] tracking-tight">
              {clinic.name}
            </h1>
            <StatusPill active={clinic.isActive} />
          </div>
          {clinic.nameRep && (
            <div
              className="mt-1 font-serif text-[16px] text-ink-3"
              dir="rtl"
              lang="ar"
            >
              {clinic.nameRep}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-3">
            {clinic.email && (
              <span className="font-mono tnum">{clinic.email}</span>
            )}
            {clinic.email && clinic.phone && (
              <span aria-hidden className="text-ink-4">
                ·
              </span>
            )}
            {clinic.phone && (
              <span className="font-mono tnum">{clinic.phone}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="rounded-[10px] border border-rule bg-card px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:border-rule-2"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirmToggle(true)}
            className={
              clinic.isActive
                ? "rounded-[10px] bg-alert-fg px-3.5 py-2 text-[13px] font-medium text-white hover:opacity-90"
                : "rounded-[10px] bg-vital-fg px-3.5 py-2 text-[13px] font-medium text-white hover:opacity-90"
            }
          >
            {clinic.isActive ? "Deactivate" : "Activate"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-rule">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              "whitespace-nowrap px-4 py-2.5 text-[13.5px] font-medium transition-colors duration-2",
              activeTab === tab.id
                ? "border-b-[3px] border-alert-fg text-ink"
                : "border-b-[3px] border-transparent text-ink-3 hover:text-ink",
            ].join(" ")}
            aria-current={activeTab === tab.id ? "page" : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <ClinicOverviewTab clinic={clinic} />}
      {activeTab === "settings" && <ClinicSettingsTab clinicId={clinicId} />}
      {activeTab === "specialties" && (
        <ClinicSpecialtiesTab clinicId={clinicId} />
      )}
      {activeTab === "users" && <ClinicUsersTab clinicId={clinicId} />}
      {activeTab === "modules" && <ClinicModulesTab clinicId={clinicId} />}
      {activeTab === "field-rules" && (
        <ClinicFieldRulesTab clinicId={clinicId} />
      )}
      {activeTab === "audit" && <ClinicAuditTab clinicId={clinicId} />}

      <ClinicFormModal
        open={editOpen}
        clinic={clinic}
        onClose={() => setEditOpen(false)}
      />

      <ConfirmModal
        open={confirmToggle}
        title={clinic.isActive ? "Deactivate clinic?" : "Activate clinic?"}
        body={
          clinic.isActive
            ? `Deactivating ${clinic.name} will prevent its users from logging in. Patient data is preserved.`
            : `Activating ${clinic.name} will allow its users to log in again.`
        }
        confirmLabel={clinic.isActive ? "Deactivate" : "Activate"}
        destructive={clinic.isActive}
        pending={toggleMut.isPending}
        onCancel={() => !toggleMut.isPending && setConfirmToggle(false)}
        onConfirm={() => toggleMut.mutate(nextActive)}
      />
    </div>
  );
}
