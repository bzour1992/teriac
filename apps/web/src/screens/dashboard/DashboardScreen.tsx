import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api/client";
import { useAuth } from "../../lib/auth/store";
import { useDocumentTitle } from "../../lib/use-document-title";
import { toDisplayText } from "../../lib/rtf";
import { listSchedule, type ScheduleListItem } from "../schedule/api";
import { listPatients, getPatient } from "../patients/api";

// ── Local types ──────────────────────────────────────────────────────────────
// Re-declared instead of imported because they're internal to each list screen.

interface VisitListItem {
  patientVisitId: string;
  visitDate: string;
  visitType: number;
  outcome: number;
  chiefComplaint: string | null;
  patient: { patientId: string; fullName: string; fullNameAr: string | null };
  doctor: { userId: string; fullName: string } | null;
}

interface VisitListResponse {
  data: VisitListItem[];
  total: number;
}

interface InvoiceListResponse {
  data: unknown[];
  total: number;
  summary: { totalOutstanding: number; count: number };
}

interface DailyBilling {
  date: string;
  invoiceCount: number;
  totalCharged: number;
  totalCollected: number;
  outstanding: number;
}

// ── Time helpers ─────────────────────────────────────────────────────────────

function todayBounds(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return { from: `${y}-${m}-${d}T00:00:00.000Z`, to: `${y}-${m}-${d}T23:59:59.999Z` };
}

const SPARK_DAYS = 14;

function sparkWindow(): { from: string; to: string; days: string[] } {
  const days: string[] = [];
  const now = new Date();
  for (let i = SPARK_DAYS - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push(toYmd(d));
  }
  return {
    from: `${days[0]}T00:00:00.000Z`,
    to: `${days[days.length - 1]}T23:59:59.999Z`,
    days,
  };
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Bucket an array of items into per-day counts aligned to `days`. */
function bucketByDay<T>(items: T[], dateOf: (t: T) => string, days: string[]): number[] {
  const map = new Map<string, number>(days.map((d) => [d, 0]));
  for (const it of items) {
    const raw = dateOf(it);
    if (!raw) continue;
    const key = parseStored(raw).toISOString().slice(0, 10);
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
  }
  return days.map((d) => map.get(d) ?? 0);
}

function parseStored(s: string): Date {
  return new Date(s.includes(" ") ? s.replace(" ", "T") : s);
}

function fmtTime(s: string): string {
  return parseStored(s).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function fmtDateLong(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function greetingKey(): "morning" | "afternoon" | "evening" {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

// ── Screen ───────────────────────────────────────────────────────────────────

export function DashboardScreen(): JSX.Element {
  const { t } = useTranslation();
  const { user, hcenter } = useAuth();
  const navigate = useNavigate();

  useDocumentTitle(t("dashboard.title", { defaultValue: "Dashboard" }));

  const { from: todayFrom, to: todayTo } = useMemo(() => todayBounds(), []);
  const spark = useMemo(() => sparkWindow(), []);

  // ── Queries ──────────────────────────────────────────────────────────────
  const todaySchedule = useQuery({
    queryKey: ["dashboard", "today-schedule", todayFrom, todayTo],
    queryFn: ({ signal }) => listSchedule({ from: todayFrom, to: todayTo }, signal),
    staleTime: 60_000,
  });

  // 14-day sparkline source data — bucketed client-side, no new endpoints.
  const sparkSchedule = useQuery({
    queryKey: ["dashboard", "spark-schedule", spark.from, spark.to],
    queryFn: ({ signal }) => listSchedule({ from: spark.from, to: spark.to }, signal),
    staleTime: 5 * 60_000,
  });

  const sparkVisits = useQuery<VisitListResponse>({
    queryKey: ["dashboard", "spark-visits", spark.from, spark.to],
    queryFn: ({ signal }) =>
      api("/visits", {
        query: { from: spark.from, to: spark.to, page: "1", pageSize: "500" },
        signal,
      }),
    staleTime: 5 * 60_000,
  });

  const sparkBilling = useQuery<DailyBilling[]>({
    queryKey: ["dashboard", "spark-billing", spark.from, spark.to],
    queryFn: ({ signal }) =>
      api("/billing/invoices/daily", {
        query: { from: spark.from.slice(0, 10), to: spark.to.slice(0, 10) },
        signal,
      }),
    staleTime: 5 * 60_000,
  });

  const apptsTrend = useMemo(
    () => bucketByDay(sparkSchedule.data ?? [], (s) => s.scheduledInDate, spark.days),
    [sparkSchedule.data, spark.days],
  );
  const visitsTrend = useMemo(
    () => bucketByDay(sparkVisits.data?.data ?? [], (v) => v.visitDate, spark.days),
    [sparkVisits.data, spark.days],
  );
  const outstandingTrend = useMemo(() => {
    const map = new Map<string, number>(spark.days.map((d) => [d, 0]));
    for (const row of sparkBilling.data ?? []) {
      const key = row.date.slice(0, 10);
      if (map.has(key)) map.set(key, row.outstanding);
    }
    return spark.days.map((d) => map.get(d) ?? 0);
  }, [sparkBilling.data, spark.days]);

  const recentVisits = useQuery<VisitListResponse>({
    queryKey: ["dashboard", "recent-visits"],
    queryFn: ({ signal }) => api("/visits", { query: { page: "1", pageSize: "8" }, signal }),
    staleTime: 60_000,
  });

  const todayVisits = useQuery<VisitListResponse>({
    queryKey: ["dashboard", "today-visits", todayFrom, todayTo],
    queryFn: ({ signal }) =>
      api("/visits", {
        query: { from: todayFrom, to: todayTo, page: "1", pageSize: "1" },
        signal,
      }),
    staleTime: 60_000,
  });

  const activePatients = useQuery({
    queryKey: ["dashboard", "active-patients"],
    queryFn: ({ signal }) => listPatients({ page: 1, pageSize: 1 }, signal),
    staleTime: 5 * 60_000,
  });

  const unpaidInvoices = useQuery<InvoiceListResponse>({
    queryKey: ["dashboard", "unpaid-invoices"],
    queryFn: ({ signal }) =>
      api("/billing/invoices", { query: { page: "1", pageSize: "1" }, signal }),
    staleTime: 60_000,
  });

  // Today's appointments split into upcoming / past for the schedule panel.
  const scheduleSorted = useMemo(() => {
    const items = todaySchedule.data ?? [];
    return [...items].sort((a, b) => parseStored(a.scheduledInDate).getTime() - parseStored(b.scheduledInDate).getTime());
  }, [todaySchedule.data]);

  // Patient summary fetches for the alert queue — one per unique patient on today's schedule.
  const todayPatientIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of scheduleSorted) {
      if (a.patient?.patientId) ids.add(a.patient.patientId);
    }
    return Array.from(ids).slice(0, 10); // cap to avoid N+1 explosion
  }, [scheduleSorted]);

  const patientSummaries = useQueries({
    queries: todayPatientIds.map((pid) => ({
      queryKey: ["dashboard", "patient-summary", pid],
      queryFn: ({ signal }: { signal?: AbortSignal }) => getPatient(pid, signal),
      staleTime: 5 * 60_000,
    })),
  });

  // Build alert list: any today-patient with at-risk indicators.
  const alerts = useMemo(() => {
    const list: Array<{
      patientId: string;
      fullName: string;
      allergyCount: number;
      chronicDiseaseCount: number;
      activeProblemCount: number;
    }> = [];
    for (const q of patientSummaries) {
      const p = q.data;
      if (!p) continue;
      const s = p.summary;
      if (s.allergyCount > 0 || s.chronicDiseaseCount > 0 || s.activeProblemCount > 0) {
        list.push({
          patientId: p.patientId,
          fullName: p.fullName ?? "—",
          allergyCount: s.allergyCount,
          chronicDiseaseCount: s.chronicDiseaseCount,
          activeProblemCount: s.activeProblemCount,
        });
      }
    }
    // Sort: allergies first (severest), then chronic count, then active problems.
    list.sort((a, b) => {
      const score = (x: typeof a) =>
        x.allergyCount * 100 + x.chronicDiseaseCount * 10 + x.activeProblemCount;
      return score(b) - score(a);
    });
    return list.slice(0, 8);
  }, [patientSummaries]);

  // ── KPI computations ─────────────────────────────────────────────────────
  const kpis = [
    {
      label: t("dashboard.kpi_today_appointments", { defaultValue: "Today's appointments" }),
      value: todaySchedule.isLoading ? "—" : String(scheduleSorted.length),
      sub: todaySchedule.isLoading
        ? ""
        : t("dashboard.kpi_today_appt_sub", {
            defaultValue: "{{count}} scheduled",
            count: scheduleSorted.length,
          }),
      to: "/schedule",
      accent: "primary" as const,
      trend: apptsTrend,
    },
    {
      label: t("dashboard.kpi_today_visits", { defaultValue: "Today's visits" }),
      value: todayVisits.isLoading ? "—" : String(todayVisits.data?.total ?? 0),
      sub: t("dashboard.kpi_today_visits_sub", { defaultValue: "Encounters recorded" }),
      to: `/visits?from=${todayFrom.slice(0, 10)}&to=${todayTo.slice(0, 10)}`,
      accent: "vital" as const,
      trend: visitsTrend,
    },
    {
      label: t("dashboard.kpi_active_patients", { defaultValue: "Active patients" }),
      value: activePatients.isLoading ? "—" : String(activePatients.data?.total ?? 0),
      sub: t("dashboard.kpi_active_patients_sub", { defaultValue: "In your clinic" }),
      to: "/patients",
      accent: "primary" as const,
      // No daily trend data for total patients; sparkline is omitted.
      trend: undefined,
    },
    {
      label: t("dashboard.kpi_unpaid_invoices", { defaultValue: "Outstanding" }),
      value: unpaidInvoices.isLoading
        ? "—"
        : fmtMoney(unpaidInvoices.data?.summary.totalOutstanding ?? 0),
      sub: t("dashboard.kpi_unpaid_sub", {
        defaultValue: "{{count}} invoice(s)",
        count: unpaidInvoices.data?.summary.count ?? 0,
      }),
      to: "/billing",
      accent: (unpaidInvoices.data?.summary.totalOutstanding ?? 0) > 0
        ? ("warn" as const)
        : ("vital" as const),
      trend: outstandingTrend,
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────
  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  const clinicName = hcenter?.hcenterName ?? "—";
  const dateLine = fmtDateLong(new Date());

  return (
    <div className="space-y-5">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <header className="relative overflow-hidden rounded-xl border border-rule bg-card px-7 py-6 shadow-1">
        {/* Decorative radial wash */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 end-0 w-[40%] opacity-60"
          style={{
            background:
              "radial-gradient(circle at 80% 50%, var(--primary-100) 0%, transparent 70%)",
          }}
        />
        <div className="relative">
          <div className="eyebrow text-ink-3">{dateLine}</div>
          <h1 className="mt-1 font-serif text-[32px] font-medium leading-tight tracking-tight text-ink">
            {clinicName}
          </h1>
          {userName && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-paper-3 px-3 py-1 text-[12.5px] text-ink-2">
              <span className="size-1.5 rounded-full bg-vital-fg" />
              <span className="text-ink-3">
                {t(`dashboard.greeting_${greetingKey()}`, {
                  defaultValue: greetingKey() === "morning"
                    ? "Good morning,"
                    : greetingKey() === "afternoon"
                      ? "Good afternoon,"
                      : "Good evening,",
                })}
              </span>
              <span className="font-medium text-ink">{userName}</span>
            </div>
          )}
        </div>
      </header>

      {/* ── KPI strip ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* ── Two-column body ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.55fr_1fr]">
        {/* Left column: Today's schedule + recent visits */}
        <div className="space-y-5">
          <SchedulePanel
            items={scheduleSorted}
            loading={todaySchedule.isLoading}
            onOpen={(s) => {
              if (s.patientVisitId) navigate(`/visits/${s.patientVisitId}`);
              else if (s.patient?.patientId) navigate(`/patients/${s.patient.patientId}`);
              else navigate("/schedule");
            }}
          />
          <RecentVisitsPanel
            items={recentVisits.data?.data ?? []}
            loading={recentVisits.isLoading}
          />
        </div>

        {/* Right column: Alerts + Quick actions */}
        <div className="space-y-5">
          <AlertsPanel
            items={alerts}
            loading={
              todaySchedule.isLoading ||
              patientSummaries.some((q) => q.isLoading)
            }
            todayCount={scheduleSorted.length}
          />
          <QuickActions />
        </div>
      </div>
    </div>
  );
}

// ── KPI ──────────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  to,
  accent,
  trend,
}: {
  label: string;
  value: string;
  sub: string;
  to: string;
  accent: "primary" | "vital" | "warn" | "alert";
  /** Last-N daily values for the sparkline. Pass `undefined` to omit. */
  trend?: number[];
}): JSX.Element {
  const rails = {
    primary: "bg-primary",
    vital: "bg-vital-fg",
    warn: "bg-warn-fg",
    alert: "bg-alert-fg",
  } as const;
  const tones = {
    primary: "text-ink",
    vital: "text-vital-fg",
    warn: "text-warn-fg",
    alert: "text-alert-fg",
  } as const;
  const strokes = {
    primary: "var(--primary-500)",
    vital: "var(--vital-fg)",
    warn: "var(--warn-fg)",
    alert: "var(--alert-fg)",
  } as const;
  return (
    <Link
      to={to}
      className="group relative block overflow-hidden rounded-lg border border-rule bg-card shadow-1 transition-shadow duration-3 hover:shadow-2"
    >
      <div className={`absolute inset-y-0 start-0 w-[3px] ${rails[accent]}`} />
      <div className="px-5 py-4 ps-6">
        <div className="eyebrow mb-1 text-ink-3">{label}</div>
        <div className="flex items-end justify-between gap-3">
          <div className={`font-serif text-[36px] font-medium leading-none tnum ${tones[accent]}`}>
            {value}
          </div>
          {trend && trend.length > 1 && (
            <Sparkline values={trend} stroke={strokes[accent]} />
          )}
        </div>
        <div className="mt-1.5 text-[12.5px] text-ink-3 group-hover:text-ink-2">{sub}</div>
      </div>
    </Link>
  );
}

/** 64×22 single-line sparkline per design-system §8.4. */
function Sparkline({ values, stroke }: { values: number[]; stroke: string }): JSX.Element {
  const W = 64;
  const H = 22;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const stepX = values.length > 1 ? W / (values.length - 1) : 0;
  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = H - ((v - min) / span) * H;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  // Subtle area fill under the line — uses currentColor so we can opacity it.
  const lastX = (values.length - 1) * stepX;
  const area = `M0,${H} L${points.replace(/ /g, " L")} L${lastX.toFixed(2)},${H} Z`;
  return (
    <svg
      aria-hidden
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="shrink-0 overflow-visible"
      style={{ color: stroke }}
    >
      <path d={area} fill="currentColor" opacity={0.08} />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Schedule panel ───────────────────────────────────────────────────────────

function SchedulePanel({
  items,
  loading,
  onOpen,
}: {
  items: ScheduleListItem[];
  loading: boolean;
  onOpen: (s: ScheduleListItem) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const now = Date.now();
  // First show items at/after now; older today-items come last (already passed).
  const upcoming = items.filter((i) => parseStored(i.scheduledToDate).getTime() >= now);
  const past = items.filter((i) => parseStored(i.scheduledToDate).getTime() < now);
  const ordered = [...upcoming, ...past].slice(0, 8);

  return (
    <PanelCard
      title={t("dashboard.schedule_title", { defaultValue: "Today's schedule" })}
      action={
        <Link to="/schedule" className="text-[12.5px] font-medium text-primary hover:text-primary-700">
          {t("dashboard.view_all", { defaultValue: "View all" })} →
        </Link>
      }
      badge={items.length}
    >
      {loading ? (
        <SkeletonRows />
      ) : ordered.length === 0 ? (
        <Empty
          icon="📅"
          message={t("dashboard.schedule_empty", { defaultValue: "Nothing scheduled today." })}
        />
      ) : (
        <ul className="divide-y divide-rule">
          {ordered.map((s) => {
            const past = parseStored(s.scheduledToDate).getTime() < now;
            return (
              <li
                key={s.scheduleItemId}
                role="button"
                tabIndex={0}
                onClick={() => onOpen(s)}
                onKeyDown={(e) => e.key === "Enter" && onOpen(s)}
                className={`grid cursor-pointer grid-cols-[60px_1fr_auto] items-center gap-3 px-5 py-3 transition-colors duration-2 hover:bg-card-2 ${
                  past ? "opacity-65" : ""
                }`}
              >
                <div className="font-mono text-[13px] font-semibold tnum text-ink-2">
                  {fmtTime(s.scheduledInDate)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-medium text-ink">
                    {s.patient?.fullName ?? s.name ?? t("dashboard.no_name", { defaultValue: "Unknown" })}
                  </div>
                  <div className="truncate text-[12px] text-ink-3">
                    {s.doctor?.fullName ?? "—"}
                    {s.location ? ` · ${s.location}` : ""}
                  </div>
                </div>
                <StatusPill statusId={s.statusId} />
              </li>
            );
          })}
        </ul>
      )}
    </PanelCard>
  );
}

const STATUS_LABEL: Record<number, { label: string; bg: string; fg: string }> = {
  1: { label: "Scheduled", bg: "bg-rule", fg: "text-ink-3" },
  2: { label: "Confirmed", bg: "bg-primary-100", fg: "text-primary-700" },
  3: { label: "Arrived", bg: "bg-vital-bg", fg: "text-vital-fg" },
  4: { label: "In progress", bg: "bg-warn-bg", fg: "text-warn-fg" },
  5: { label: "Completed", bg: "bg-vital-bg", fg: "text-vital-fg" },
  6: { label: "No-show", bg: "bg-alert-bg", fg: "text-alert-fg" },
  7: { label: "Cancelled", bg: "bg-alert-bg", fg: "text-alert-fg" },
};

function StatusPill({ statusId }: { statusId: number }): JSX.Element {
  const s = STATUS_LABEL[statusId] ?? STATUS_LABEL[1];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ${s.bg} px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wider ${s.fg}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

// ── Recent visits ────────────────────────────────────────────────────────────

function RecentVisitsPanel({
  items,
  loading,
}: {
  items: VisitListItem[];
  loading: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <PanelCard
      title={t("dashboard.recent_visits", { defaultValue: "Recent visits" })}
      action={
        <Link to="/visits" className="text-[12.5px] font-medium text-primary hover:text-primary-700">
          {t("dashboard.view_all", { defaultValue: "View all" })} →
        </Link>
      }
    >
      {loading ? (
        <SkeletonRows />
      ) : items.length === 0 ? (
        <Empty
          icon="📋"
          message={t("dashboard.recent_visits_empty", { defaultValue: "No visits yet." })}
        />
      ) : (
        <ul className="divide-y divide-rule">
          {items.map((v) => (
            <li key={v.patientVisitId}>
              <Link
                to={`/visits/${v.patientVisitId}`}
                className="grid grid-cols-[80px_1fr_auto] items-center gap-3 px-5 py-3 transition-colors duration-2 hover:bg-card-2"
              >
                <div className="font-mono text-[11.5px] tnum text-ink-3">
                  {fmtDateShort(v.visitDate)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-medium text-ink">{v.patient.fullName}</div>
                  <div className="truncate text-[12px] text-ink-3">
                    {toDisplayText(v.chiefComplaint) ||
                      t("dashboard.no_complaint", { defaultValue: "—" })}
                  </div>
                </div>
                <OutcomePill outcome={v.outcome} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}

const OUTCOME: Record<number, { label: string; bg: string; fg: string }> = {
  0: { label: "Open", bg: "bg-warn-bg", fg: "text-warn-fg" },
  1: { label: "Resolved", bg: "bg-vital-bg", fg: "text-vital-fg" },
  2: { label: "Referred", bg: "bg-primary-100", fg: "text-primary-700" },
  3: { label: "Failed", bg: "bg-alert-bg", fg: "text-alert-fg" },
  4: { label: "Cancelled", bg: "bg-rule", fg: "text-ink-3" },
  5: { label: "No-show", bg: "bg-alert-bg", fg: "text-alert-fg" },
};

function OutcomePill({ outcome }: { outcome: number }): JSX.Element {
  const o = OUTCOME[outcome] ?? OUTCOME[0];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ${o.bg} px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wider ${o.fg}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {o.label}
    </span>
  );
}

function fmtDateShort(s: string): string {
  return parseStored(s).toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

// ── Alerts panel ─────────────────────────────────────────────────────────────

function AlertsPanel({
  items,
  loading,
  todayCount,
}: {
  items: Array<{
    patientId: string;
    fullName: string;
    allergyCount: number;
    chronicDiseaseCount: number;
    activeProblemCount: number;
  }>;
  loading: boolean;
  todayCount: number;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <PanelCard
      title={t("dashboard.alerts_title", { defaultValue: "Patient alerts" })}
      subtitle={
        todayCount > 0
          ? t("dashboard.alerts_sub", {
              defaultValue: "Among today's {{count}} scheduled patients",
              count: todayCount,
            })
          : t("dashboard.alerts_sub_empty", { defaultValue: "Pulled from today's schedule" })
      }
    >
      {loading ? (
        <SkeletonRows />
      ) : items.length === 0 ? (
        <Empty
          icon="✓"
          message={t("dashboard.alerts_empty", {
            defaultValue: "No flagged conditions on today's roster.",
          })}
        />
      ) : (
        <ul className="divide-y divide-rule">
          {items.map((a) => (
            <li key={a.patientId}>
              <Link
                to={`/patients/${a.patientId}`}
                className="block px-5 py-3 transition-colors duration-2 hover:bg-card-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium text-ink">{a.fullName}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {a.allergyCount > 0 && (
                        <FlagChip
                          tone="alert"
                          label={t("dashboard.flag_allergies", {
                            defaultValue: "{{count}} allergies",
                            count: a.allergyCount,
                          })}
                        />
                      )}
                      {a.chronicDiseaseCount > 0 && (
                        <FlagChip
                          tone="warn"
                          label={t("dashboard.flag_chronic", {
                            defaultValue: "{{count}} chronic",
                            count: a.chronicDiseaseCount,
                          })}
                        />
                      )}
                      {a.activeProblemCount > 0 && (
                        <FlagChip
                          tone="info"
                          label={t("dashboard.flag_problems", {
                            defaultValue: "{{count}} active problems",
                            count: a.activeProblemCount,
                          })}
                        />
                      )}
                    </div>
                  </div>
                  <span aria-hidden className="text-ink-4">→</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}

function FlagChip({ tone, label }: { tone: "alert" | "warn" | "info"; label: string }): JSX.Element {
  const cls = {
    alert: "bg-alert-bg text-alert-fg",
    warn: "bg-warn-bg text-warn-fg",
    info: "bg-primary-100 text-primary-700",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ${cls} px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wider`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

// ── Quick actions ────────────────────────────────────────────────────────────

function QuickActions(): JSX.Element {
  const { t } = useTranslation();
  return (
    <PanelCard title={t("dashboard.quick_actions", { defaultValue: "Quick actions" })}>
      <div className="grid grid-cols-2 gap-2 px-5 py-4">
        <ActionLink to="/patients" icon="👤" label={t("dashboard.qa_patients", { defaultValue: "Patients" })} />
        <ActionLink to="/schedule" icon="📅" label={t("dashboard.qa_schedule", { defaultValue: "Schedule" })} />
        <ActionLink to="/visits" icon="📋" label={t("dashboard.qa_visits", { defaultValue: "Visits" })} />
        <ActionLink to="/billing" icon="💳" label={t("dashboard.qa_billing", { defaultValue: "Billing" })} />
      </div>
    </PanelCard>
  );
}

function ActionLink({ to, icon, label }: { to: string; icon: string; label: string }): JSX.Element {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-[10px] border border-rule bg-card-2 px-3 py-2.5 text-[13px] font-medium text-ink-2 transition-colors duration-2 hover:border-primary hover:bg-primary-50 hover:text-primary-700"
    >
      <span aria-hidden className="text-[14px]">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

// ── Panel card primitive ─────────────────────────────────────────────────────

function PanelCard({
  title,
  subtitle,
  badge,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: number;
  action?: JSX.Element;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
      <header className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3.5">
        <div className="min-w-0 flex items-center gap-2.5">
          <h2 className="font-serif text-[18px] font-medium tracking-tight text-ink">{title}</h2>
          {badge !== undefined && badge > 0 && (
            <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-primary-100 px-2 py-0.5 font-mono text-[11px] font-semibold tnum text-primary-700">
              {badge}
            </span>
          )}
          {subtitle && <span className="truncate text-[12.5px] text-ink-3">· {subtitle}</span>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function SkeletonRows(): JSX.Element {
  return (
    <div className="divide-y divide-rule">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3">
          <div className="h-3 w-14 animate-pulse rounded bg-paper-3" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-1/2 animate-pulse rounded bg-paper-3" />
            <div className="h-2.5 w-2/3 animate-pulse rounded bg-paper-3" />
          </div>
          <div className="h-4 w-16 animate-pulse rounded-full bg-paper-3" />
        </div>
      ))}
    </div>
  );
}

function Empty({ icon, message }: { icon: string; message: string }): JSX.Element {
  return (
    <div className="px-5 py-10 text-center">
      <div aria-hidden className="text-[28px] opacity-40">{icon}</div>
      <p className="mt-2 text-[13px] text-ink-3">{message}</p>
    </div>
  );
}

// ── Misc helpers ─────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
