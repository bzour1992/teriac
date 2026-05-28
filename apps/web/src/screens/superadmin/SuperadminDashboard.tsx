import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getSuperadminStats, listClinics, type ClinicListItem } from "./api";
import { formatDateLong } from "../../lib/format";

function fmtNumber(n: number): string {
  return n.toLocaleString();
}

function fmtMoney(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface KpiProps {
  label: string;
  value: string;
  sub?: string;
  accent?: "primary" | "vital" | "warn" | "alert";
}

function Kpi({ label, value, sub, accent = "primary" }: KpiProps): JSX.Element {
  const railCls = {
    primary: "bg-primary",
    vital: "bg-vital-fg",
    warn: "bg-warn-fg",
    alert: "bg-alert-fg",
  }[accent];
  const valueCls = {
    primary: "text-primary",
    vital: "text-vital-fg",
    warn: "text-warn-fg",
    alert: "text-alert-fg",
  }[accent];
  return (
    <div className="relative overflow-hidden rounded-lg border border-rule bg-card shadow-1">
      <div className={`absolute inset-y-0 start-0 w-[3px] ${railCls}`} aria-hidden />
      <div className="px-5 py-4 ps-6">
        <div className="eyebrow mb-1 text-ink-3">{label}</div>
        <div className={`font-mono text-[26px] font-bold tnum ${valueCls}`}>{value}</div>
        {sub !== undefined && (
          <div className="mt-0.5 text-[11px] text-ink-4 tnum">{sub}</div>
        )}
      </div>
    </div>
  );
}

function ChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}): JSX.Element | null {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-rule bg-card px-3 py-2 text-[12px] shadow-2">
      <div className="mb-1.5 font-medium text-ink">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 tnum">
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ background: p.color }}
          />
          <span className="text-ink-3">{p.name}</span>
          <span className="ms-auto ps-4 font-semibold text-ink">{fmtNumber(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function RecentActivity({ clinics }: { clinics: ClinicListItem[] }): JSX.Element {
  if (clinics.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-[13px] text-ink-3">
        No recent clinic activity.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-rule">
      {clinics.slice(0, 8).map((c) => (
        <li
          key={c.hcenterId}
          className="flex items-center gap-4 px-5 py-3 text-[13px]"
        >
          <span
            className={`size-2 shrink-0 rounded-full ${
              c.isActive ? "bg-vital-fg" : "bg-ink-4"
            }`}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-ink">{c.name}</div>
            <div className="text-[11.5px] text-ink-3">
              {c.userCount} users · {c.patientCount} patients
            </div>
          </div>
          <div className="font-mono text-[11.5px] tnum text-ink-3">
            {formatDateLong(c.supportStartDate)}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SuperadminDashboard(): JSX.Element {
  const { t } = useTranslation();
  const statsQuery = useQuery({
    queryKey: ["superadmin", "stats"],
    queryFn: ({ signal }) => getSuperadminStats(signal),
    staleTime: 60_000,
  });

  const clinicsQuery = useQuery({
    queryKey: ["superadmin", "clinics", "recent"],
    queryFn: ({ signal }) => listClinics({ page: 1, pageSize: 10 }, signal),
    staleTime: 60_000,
  });

  const stats = statsQuery.data;
  const clinics = clinicsQuery.data?.data ?? [];
  const chartData = (stats?.clinicsByPatientCount ?? []).map((c) => ({
    name: c.clinicName,
    patients: c.patientCount,
  }));

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow mb-2 text-alert-fg">
          {t("superadmin.eyebrow", { defaultValue: "Overview" })}
        </div>
        <h2 className="font-serif text-[28px] font-medium leading-[34px] tracking-tight">
          {t("superadmin.dashboard.title", { defaultValue: "Platform overview" })}
        </h2>
      </div>

      {statsQuery.error && (
        <div
          role="alert"
          className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg"
        >
          {(statsQuery.error as Error).message}
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label={t("superadmin.kpi.clinics", { defaultValue: "Clinics" })}
          value={stats ? fmtNumber(stats.clinicCount) : "—"}
          accent="primary"
        />
        <Kpi
          label={t("superadmin.kpi.active_clinics", { defaultValue: "Active clinics" })}
          value={stats ? fmtNumber(stats.activeClinicCount) : "—"}
          accent="vital"
        />
        <Kpi
          label={t("superadmin.kpi.users", { defaultValue: "Users" })}
          value={stats ? fmtNumber(stats.totalUsers) : "—"}
          sub={stats ? `${fmtNumber(stats.activeUsers)} active` : undefined}
        />
        <Kpi
          label={t("superadmin.kpi.patients", { defaultValue: "Patients" })}
          value={stats ? fmtNumber(stats.totalPatients) : "—"}
        />
        <Kpi
          label={t("superadmin.kpi.visits", { defaultValue: "Visits" })}
          value={stats ? fmtNumber(stats.totalVisits) : "—"}
        />
        <Kpi
          label={t("superadmin.kpi.monthly_invoiced", {
            defaultValue: "Invoiced (mo)",
          })}
          value={stats ? fmtMoney(stats.totalInvoicedThisMonth) : "—"}
          accent="warn"
        />
      </div>

      {/* Chart + Activity */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.55fr_1fr]">
        {/* Bar chart: clinics by patient count */}
        <div className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
          <div className="border-b border-rule px-5 py-4">
            <h2 className="font-serif text-xl font-medium tracking-tight">
              {t("superadmin.dashboard.patients_by_clinic", {
                defaultValue: "Patients by clinic",
              })}
            </h2>
            <p className="mt-0.5 text-[12px] text-ink-3">
              {t("superadmin.dashboard.top_clinics_by_patient_count", {
                defaultValue: "Top clinics by patient count",
              })}
            </p>
          </div>
          <div className="px-5 py-5">
            {statsQuery.isLoading ? (
              <div className="h-[320px] animate-pulse rounded-[10px] bg-paper-3" />
            ) : chartData.length === 0 ? (
              <p className="py-12 text-center text-[13px] text-ink-3">
                {t("common.no_data", { defaultValue: "No data" })}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--rule)"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    stroke="var(--ink-3)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: "var(--rule)" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="var(--ink-3)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: "var(--rule)" }}
                    width={140}
                  />
                  <Tooltip content={<ChartTip />} cursor={{ fill: "var(--paper-3)" }} />
                  <Bar
                    dataKey="patients"
                    name={t("superadmin.kpi.patients", { defaultValue: "Patients" })}
                    fill="var(--primary-500)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent clinic activity */}
        <div className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
          <div className="border-b border-rule px-5 py-4">
            <h2 className="font-serif text-xl font-medium tracking-tight">
              {t("superadmin.dashboard.recent_activity", {
                defaultValue: "Recent clinics",
              })}
            </h2>
          </div>
          {clinicsQuery.isLoading ? (
            <div className="space-y-2 px-5 py-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-8 animate-pulse rounded-[10px] bg-paper-3"
                />
              ))}
            </div>
          ) : (
            <RecentActivity clinics={clinics} />
          )}
        </div>
      </div>
    </div>
  );
}
