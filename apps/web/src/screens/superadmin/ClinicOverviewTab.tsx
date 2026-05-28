import { formatDateLong } from "../../lib/format";
import { SUBSCRIPTION_LABEL, type ClinicDetail } from "./api";

function fmt(n: number): string {
  return n.toLocaleString();
}

interface KpiProps {
  label: string;
  value: string;
}

function MiniKpi({ label, value }: KpiProps): JSX.Element {
  return (
    <div className="relative overflow-hidden rounded-lg border border-rule bg-card shadow-1">
      <div className="absolute inset-y-0 start-0 w-[3px] bg-primary" aria-hidden />
      <div className="px-5 py-4 ps-6">
        <div className="eyebrow mb-1 text-ink-3">{label}</div>
        <div className="font-mono text-[24px] font-bold tnum text-primary">{value}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  rtl,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  rtl?: boolean;
  mono?: boolean;
}): JSX.Element {
  return (
    <div>
      <div className="eyebrow mb-1 text-ink-3">{label}</div>
      <div
        className={`text-[13.5px] ${value ? "text-ink" : "text-ink-4"} ${mono ? "font-mono tnum" : ""}`}
        dir={rtl ? "rtl" : "auto"}
      >
        {value ?? "—"}
      </div>
    </div>
  );
}

export function ClinicOverviewTab({ clinic }: { clinic: ClinicDetail }): JSX.Element {
  return (
    <div className="space-y-6">
      {/* Mini KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MiniKpi label="Users" value={fmt(clinic.userCount)} />
        <MiniKpi label="Patients" value={fmt(clinic.patientCount)} />
        <MiniKpi label="Specialties" value={fmt(clinic.specialtyCount)} />
        <MiniKpi
          label="Subscription"
          value={SUBSCRIPTION_LABEL[clinic.subscriptionType] ?? "—"}
        />
      </div>

      {/* Profile cards */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
          <div className="border-b border-rule px-5 py-4">
            <h2 className="font-serif text-xl font-medium tracking-tight">
              Clinic profile
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-5 p-5">
            <Field label="Name (EN)" value={clinic.name} />
            <Field label="Name (AR)" value={clinic.nameRep} rtl />
            <Field label="Email" value={clinic.email} />
            <Field label="Phone" value={clinic.phone} mono />
            <Field label="Initials" value={clinic.hcenterInitials} mono />
            <Field
              label="eClaim Link ID"
              value={clinic.eClaimLinkId}
              mono
            />
            <div className="col-span-2">
              <Field label="Report address" value={clinic.reportAddress} />
            </div>
            <div className="col-span-2">
              <Field
                label="Working times"
                value={clinic.reportsWorkingTimes}
              />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
          <div className="border-b border-rule px-5 py-4">
            <h2 className="font-serif text-xl font-medium tracking-tight">
              Manager & lifecycle
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-5 p-5">
            <Field label="Manager" value={clinic.clinicManager} />
            <Field label="Manager email" value={clinic.clinicManagerEmail} />
            <Field label="Manager mobile" value={clinic.clinicManagerMob} mono />
            <Field
              label="Single doctor"
              value={clinic.isOneDoctor ? "Yes" : "No"}
            />
            <Field
              label="Support start"
              value={formatDateLong(clinic.supportStartDate)}
              mono
            />
            <Field
              label="Last renewal"
              value={formatDateLong(clinic.lastRenewalDate)}
              mono
            />
            <Field
              label="Subscription"
              value={SUBSCRIPTION_LABEL[clinic.subscriptionType] ?? null}
            />
            <Field
              label="Status"
              value={clinic.isActive ? "Active" : "Inactive"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
