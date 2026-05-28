import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageHead } from "../../layout/AppShell";
import { SearchableSelect } from "../../components/SearchableSelect";
import { useDocumentTitle } from "../../lib/use-document-title";
import { useAuth } from "../../lib/auth/store";
import {
  listSchedule,
  listUsers,
  SCHEDULE_STATUSES,
  type ScheduleListItem,
} from "./api";
import { AppointmentFormModal } from "./AppointmentFormModal";
import { AppointmentDetailModal } from "./AppointmentDetailModal";
import { WeekGridView, mondayOfWeek, weekBounds } from "./WeekGridView";
import { getPatient, type PatientDetail } from "../patients/api";

const STATUS_STYLE: Record<number, { background: string; color: string }> = {
  1: { background: "var(--rule)", color: "var(--ink-3)" }, // Scheduled
  2: { background: "var(--primary-100)", color: "var(--primary-700)" }, // Confirmed
  3: { background: "var(--vital-bg)", color: "var(--vital-fg)" }, // Arrived
  4: { background: "var(--warn-bg)", color: "var(--warn-fg)" }, // InProgress
  5: { background: "var(--vital-bg)", color: "var(--vital-fg)" }, // Completed
  6: { background: "var(--alert-bg)", color: "var(--alert-fg)" }, // NoShow
  7: { background: "var(--rule)", color: "var(--ink-4)" }, // Cancelled
};

const todayLocal = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** Convert a local Date to an ISO whose UTC components mirror its local components.
 *  Stored datetimes are LOCAL clinic time, so bounds must match the same convention. */
const toBackendDateTime = (d: Date): string => {
  const offsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offsetMs).toISOString();
};

const dayBounds = (yyyymmdd: string): { from: string; to: string } => {
  const start = new Date(`${yyyymmdd}T00:00:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { from: toBackendDateTime(start), to: toBackendDateTime(end) };
};

const formatTime = (iso: string): string => {
  // Stored as local clinic time (no timezone). Do NOT append "Z".
  const d = new Date(iso.includes(" ") ? iso.replace(" ", "T") : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

const friendlyDate = (yyyymmdd: string): string => {
  const d = new Date(`${yyyymmdd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return yyyymmdd;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  const dateStr = d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  if (diffDays === 0) return `Today · ${dateStr}`;
  if (diffDays === 1) return `Tomorrow · ${dateStr}`;
  if (diffDays === -1) return `Yesterday · ${dateStr}`;
  return dateStr;
};

const weekTitle = (weekStart: Date): string => {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const startStr = weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endStr = end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `Week of ${startStr} – ${endStr}`;
};

const shiftDate = (yyyymmdd: string, days: number): string => {
  const d = new Date(`${yyyymmdd}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export function ScheduleScreen(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<"day" | "week">("day");
  const [date, setDate] = useState<string>(todayLocal());
  const [doctorId, setDoctorId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<number | "">("");
  const [viewing, setViewing] = useState<ScheduleListItem | null>(null);
  const [editing, setEditing] = useState<ScheduleListItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [quickAddSlot, setQuickAddSlot] = useState<string | null>(null);
  /** When `/schedule?patientId=…` is hit (from a patient detail page), open the
   *  add-appointment form pre-loaded with that patient. We strip the param so
   *  back/forward navigation doesn't keep re-opening the modal. */
  const [prefillPatient, setPrefillPatient] = useState<PatientDetail | null>(null);
  const patientIdParam = searchParams.get("patientId");
  useEffect(() => {
    if (!patientIdParam) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await getPatient(patientIdParam);
        if (cancelled) return;
        setPrefillPatient(p);
        setAdding(true);
      } catch {
        /* if it 404s / 403s we just don't open the form */
      } finally {
        // Drop the param either way so a refresh doesn't trap the user in the modal.
        const next = new URLSearchParams(searchParams);
        next.delete("patientId");
        setSearchParams(next, { replace: true });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientIdParam]);

  const weekStart = useMemo(() => mondayOfWeek(date), [date]);
  const bounds = useMemo(
    () => (view === "week" ? weekBounds(weekStart) : dayBounds(date)),
    [view, date, weekStart],
  );

  const doctorsQ = useQuery({
    queryKey: ["users", "active"],
    queryFn: ({ signal }) => listUsers(signal),
    staleTime: 5 * 60_000,
  });
  const doctors = doctorsQ.data ?? [];

  const scheduleQ = useQuery({
    queryKey: ["schedule", bounds.from, bounds.to, doctorId, statusFilter],
    queryFn: ({ signal }) =>
      listSchedule(
        {
          from: bounds.from,
          to: bounds.to,
          doctorId: doctorId || undefined,
          status: (statusFilter || undefined) as number | undefined,
        },
        signal,
      ),
    staleTime: 30_000,
  });

  const items = scheduleQ.data ?? [];
  const counts = useMemo(() => {
    const byStatus: Record<number, number> = {};
    for (const it of items) byStatus[it.statusId] = (byStatus[it.statusId] ?? 0) + 1;
    return byStatus;
  }, [items]);

  // Browser tab title: include the active date/week + clinic suffix.
  const { hcenter } = useAuth();
  const clinicSuffix = hcenter?.hcenterName?.trim() || "Teriac";
  const titleDate =
    view === "day"
      ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })
      : (() => {
          const end = new Date(weekStart);
          end.setDate(end.getDate() + 6);
          const s = weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
          const e = end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
          return `${s}–${e}`;
        })();
  useDocumentTitle(`Schedule - ${titleDate} - ${clinicSuffix}`);

  return (
    <>
      <PageHead
        eyebrow="Schedule"
        title={
          <>
            {view === "day" ? friendlyDate(date) : weekTitle(weekStart)}{" "}
            <em className="font-serif text-ink-3">
              <span className="tnum">{items.length}</span>
            </em>
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <div
              role="tablist"
              aria-label="View"
              className="inline-flex overflow-hidden rounded-[10px] border border-rule"
            >
              <button
                type="button"
                role="tab"
                aria-selected={view === "day"}
                onClick={() => setView("day")}
                className={`px-3 py-2 text-[12.5px] font-medium ${
                  view === "day" ? "bg-primary text-white" : "bg-card text-ink-2 hover:bg-paper-3"
                }`}
              >
                Day
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === "week"}
                onClick={() => setView("week")}
                className={`border-s border-rule px-3 py-2 text-[12.5px] font-medium ${
                  view === "week" ? "bg-primary text-white" : "bg-card text-ink-2 hover:bg-paper-3"
                }`}
              >
                Week
              </button>
            </div>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600"
            >
              + New appointment
            </button>
          </div>
        }
      />

      {/* Filters card */}
      <section className="relative mb-5 rounded-lg border border-rule bg-card shadow-1">
        <header className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3">
          <div className="flex items-baseline gap-3">
            <h2 className="eyebrow text-ink-3">Filter</h2>
            {scheduleQ.isFetching ? (
              <span className="font-mono text-[11px] uppercase tracking-wider text-ink-4">
                Loading…
              </span>
            ) : (
              <span className="font-mono text-[12px] text-ink-3 tnum">
                {items.length} {items.length === 1 ? "appointment" : "appointments"}
              </span>
            )}
          </div>
          {(date !== todayLocal() || doctorId || statusFilter !== "") ? (
            <button
              type="button"
              onClick={() => {
                setDate(todayLocal());
                setDoctorId("");
                setStatusFilter("");
              }}
              className="rounded-[10px] border border-rule bg-card px-3 py-1.5 text-[12px] font-medium text-ink-3 transition-colors duration-2 hover:border-rule-2 hover:text-ink-2"
            >
              Reset filters
            </button>
          ) : (
            <span className="rounded-[10px] border border-rule bg-card px-3 py-1.5 text-[12px] font-medium text-ink-3 opacity-40">
              Reset filters
            </span>
          )}
        </header>

        <div className="grid grid-cols-1 gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-[auto_1fr_1fr_1fr]">
          {/* Date stepper */}
          <div>
            <label className="mb-1 block text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
              Navigate
            </label>
            <div className="inline-flex overflow-hidden rounded-[10px] border border-rule">
              <button
                type="button"
                aria-label="Previous"
                onClick={() => setDate(shiftDate(date, view === "week" ? -7 : -1))}
                className="px-3 py-2 text-[13px] text-ink-2 hover:bg-paper-3"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => setDate(todayLocal())}
                className="border-x border-rule px-3 py-2 text-[12px] font-medium text-ink-2 hover:bg-paper-3"
              >
                Today
              </button>
              <button
                type="button"
                aria-label="Next"
                onClick={() => setDate(shiftDate(date, view === "week" ? 7 : 1))}
                className="px-3 py-2 text-[13px] text-ink-2 hover:bg-paper-3"
              >
                ›
              </button>
            </div>
          </div>

          {/* Date input */}
          <div>
            <label htmlFor="schedule-filter-date" className="mb-1 block text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
              Date
            </label>
            <input
              id="schedule-filter-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value || todayLocal())}
              className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 font-mono text-[13px] tnum outline-none hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
            />
          </div>

          {/* Doctor */}
          <div>
            <label htmlFor="schedule-filter-doctor" className="mb-1 block text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
              Doctor
            </label>
            <SearchableSelect
              id="schedule-filter-doctor"
              value={doctorId}
              onChange={(v) => setDoctorId(String(v))}
              emptyLabel="All doctors"
              options={doctors.map((d) => ({ value: d.userId, label: d.fullName }))}
            />
          </div>

          {/* Status */}
          <div>
            <label htmlFor="schedule-filter-status" className="mb-1 block text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
              Status
            </label>
            <SearchableSelect
              id="schedule-filter-status"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v === "" ? "" : Number(v))}
              emptyLabel="All statuses"
              options={SCHEDULE_STATUSES.map((s) => ({ value: s.id, label: s.label }))}
            />
          </div>
        </div>
      </section>

      {/* Active filter chips — clearable, always visible. */}
      <ActiveFilterChips
        doctorId={doctorId}
        doctors={doctors}
        statusFilter={statusFilter}
        onClearDoctor={() => setDoctorId("")}
        onClearStatus={() => setStatusFilter("")}
      />

      {/* Today's stats strip */}
      {items.length > 0 && (
        <ScheduleStatsStrip total={items.length} counts={counts} />
      )}

      {view === "week" ? (
        scheduleQ.isLoading ? (
          <div className="rounded-lg border border-rule bg-card px-5 py-10 text-center text-[13px] text-ink-3 shadow-1">
            Loading appointments…
          </div>
        ) : scheduleQ.error ? (
          <div className="rounded-lg border border-rule bg-card px-5 py-10 text-center text-[13px] text-alert-fg shadow-1">
            {(scheduleQ.error as Error).message}
          </div>
        ) : (
          <WeekGridView
            weekStart={weekStart}
            items={items}
            onClickItem={(it) => setViewing(it)}
            onClickEmptySlot={(slot) => {
              setQuickAddSlot(slot);
              setAdding(true);
            }}
          />
        )
      ) : (
      <div className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
        {scheduleQ.isLoading ? (
          <div className="px-5 py-10 text-center text-[13px] text-ink-3">Loading appointments…</div>
        ) : scheduleQ.error ? (
          <div className="px-5 py-10 text-center text-[13px] text-alert-fg">
            {(scheduleQ.error as Error).message}
          </div>
        ) : items.length === 0 ? (
          <div className="px-5 py-12 text-center text-[14px] text-ink-3">
            No appointments scheduled for this day.
          </div>
        ) : (
          <ul className="divide-y divide-dashed divide-rule">
            {items.map((it) => (
              <ScheduleRow
                key={it.scheduleItemId}
                item={it}
                onClick={() => setViewing(it)}
                onOpenVisit={(visitId) => navigate(`/visits/${visitId}`)}
                onOpenPatient={(patientId) => navigate(`/patients/${patientId}`)}
              />
            ))}
          </ul>
        )}
      </div>
      )}

      <AppointmentFormModal
        open={adding}
        onClose={() => {
          setAdding(false);
          setQuickAddSlot(null);
          setPrefillPatient(null);
        }}
        item={null}
        defaultDateTimeLocal={quickAddSlot ?? `${date}T09:00`}
        defaultPatient={
          prefillPatient
            ? {
                patientId: prefillPatient.patientId,
                fullName: prefillPatient.fullName,
                fullNameAr: prefillPatient.fullNameAr,
                nationalId: prefillPatient.nationalId,
                sex: prefillPatient.sex,
                dateOfBirth: prefillPatient.dateOfBirth,
                mobileNumber: prefillPatient.mobileNumber,
                email: prefillPatient.email,
                photoUrl: prefillPatient.photoUrl,
              }
            : null
        }
      />
      <AppointmentFormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        item={editing}
      />
      <AppointmentDetailModal
        open={!!viewing}
        item={viewing}
        onClose={() => setViewing(null)}
        onEdit={(it) => {
          setViewing(null);
          setEditing(it);
        }}
      />
    </>
  );
}

// ── Active filter chips ──────────────────────────────────────────────────────

function ActiveFilterChips({
  doctorId,
  doctors,
  statusFilter,
  onClearDoctor,
  onClearStatus,
}: {
  doctorId: string;
  doctors: ReadonlyArray<{ userId: string; firstName?: string | null; lastName?: string | null; fullName?: string }>;
  statusFilter: number | "";
  onClearDoctor: () => void;
  onClearStatus: () => void;
}): JSX.Element | null {
  const doctor = doctorId ? doctors.find((d) => d.userId === doctorId) : null;
  const status = statusFilter ? SCHEDULE_STATUSES.find((s) => s.id === statusFilter) : null;
  if (!doctor && !status) return null;

  const docLabel =
    doctor?.fullName ||
    [doctor?.firstName, doctor?.lastName].filter(Boolean).join(" ").trim() ||
    "Doctor";

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <span className="font-mono text-[10.5px] font-medium uppercase tracking-wider text-ink-3">
        Filtered by
      </span>
      {doctor && (
        <FilterChip label="Doctor" value={docLabel} onClear={onClearDoctor} />
      )}
      {status && (
        <FilterChip
          label="Status"
          value={status.label}
          tone={status.id}
          onClear={onClearStatus}
        />
      )}
    </div>
  );
}

function FilterChip({
  label,
  value,
  tone,
  onClear,
}: {
  label: string;
  value: string;
  tone?: number;
  onClear: () => void;
}): JSX.Element {
  const style = tone ? STATUS_STYLE[tone] : { background: "var(--primary-100)", color: "var(--primary-700)" };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider"
      style={style}
    >
      <span className="opacity-60">{label}:</span>
      <span>{value}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear ${label} filter`}
        className="-me-1 ms-0.5 inline-flex size-4 items-center justify-center rounded-full hover:bg-current/10"
        title="Clear"
      >
        ✕
      </button>
    </span>
  );
}

// ── Today's stats strip ──────────────────────────────────────────────────────

function ScheduleStatsStrip({
  total,
  counts,
}: {
  total: number;
  counts: Record<number, number>;
}): JSX.Element {
  // Status IDs we want to surface explicitly, in clinical-flow order.
  const HIGHLIGHTS: Array<{ id: number; label: string }> = [
    { id: 2, label: "Confirmed" },
    { id: 3, label: "Arrived" },
    { id: 4, label: "In progress" },
    { id: 5, label: "Completed" },
    { id: 6, label: "No-show" },
    { id: 7, label: "Cancelled" },
  ];

  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
      <StatTile label="Total" value={total} tone="primary" />
      {HIGHLIGHTS.map((h) => {
        const n = counts[h.id] ?? 0;
        return (
          <StatTile
            key={h.id}
            label={h.label}
            value={n}
            tone={h.id}
            muted={n === 0}
          />
        );
      })}
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
  muted,
}: {
  label: string;
  value: number;
  tone: number | "primary";
  muted?: boolean;
}): JSX.Element {
  const style =
    tone === "primary"
      ? { background: "var(--primary-50)", color: "var(--primary-700)" }
      : STATUS_STYLE[tone] ?? { background: "var(--paper-2)", color: "var(--ink-3)" };
  return (
    <div
      className={`overflow-hidden rounded-[10px] border border-rule bg-card px-3 py-2 shadow-1 transition-opacity duration-2 ${
        muted ? "opacity-50" : ""
      }`}
    >
      <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-3">
        {label}
      </div>
      <div
        className="mt-0.5 font-serif text-[22px] leading-none tnum"
        style={{ color: style.color }}
      >
        {value}
      </div>
    </div>
  );
}

// ── Enhanced row ──────────────────────────────────────────────────────────────

function ScheduleRow({
  item,
  onClick,
  onOpenVisit,
  onOpenPatient,
}: {
  item: ScheduleListItem;
  onClick: () => void;
  onOpenVisit: (visitId: string) => void;
  onOpenPatient: (patientId: string) => void;
}): JSX.Element {
  // Stored as local clinic time — do NOT treat as UTC.
  const start = new Date(
    item.scheduledInDate.includes(" ")
      ? item.scheduledInDate.replace(" ", "T")
      : item.scheduledInDate,
  );
  const end = new Date(
    item.scheduledToDate.includes(" ")
      ? item.scheduledToDate.replace(" ", "T")
      : item.scheduledToDate,
  );
  const durationMin =
    !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())
      ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
      : 0;

  const arName =
    item.patient?.fullNameAr && item.patient.fullNameAr !== item.patient.fullName
      ? item.patient.fullNameAr
      : null;

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="grid w-full grid-cols-[90px_1fr_auto] items-center gap-4 px-5 py-3.5 text-start transition-colors duration-2 hover:bg-card-2 focus-visible:bg-primary-50 focus-visible:outline-none"
      >
        {/* Time column */}
        <div className="font-mono text-ink-2">
          <div className="text-[14px] font-semibold tnum">{formatTime(item.scheduledInDate)}</div>
          <div className="text-[10.5px] uppercase tracking-wider text-ink-4 tnum">
            → {formatTime(item.scheduledToDate)}
          </div>
          {durationMin > 0 && (
            <div className="mt-0.5 text-[10.5px] uppercase tracking-wider text-ink-4 tnum">
              {durationMin} min
            </div>
          )}
        </div>


        {/* Main details */}
        <div className="min-w-0">
          {item.notForPatient ? (
            <>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-paper-3 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-ink-3">
                  <span aria-hidden>⊘</span> No patient
                </span>
                <span className="text-[14px] font-medium italic text-ink-3">
                  {item.name || "Blocked slot"}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-ink-3">
                {item.doctor && <span>{item.doctor.fullName}</span>}
                {item.location && (
                  <>
                    {item.doctor && <Dot />}
                    <span>{item.location}</span>
                  </>
                )}
              </div>
              {item.notes && (
                <div className="mt-1 line-clamp-2 text-[12.5px] italic text-ink-3" dir="auto">
                  “{item.notes}”
                </div>
              )}
            </>
          ) : (
            <>
              {/* Name + national id + flags */}
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-vital-bg px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-vital-fg">
                  <span aria-hidden>●</span> Patient
                </span>
                {item.patient ? (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenPatient(item.patient!.patientId);
                    }}
                    className="text-[14.5px] font-semibold text-ink underline-offset-4 hover:text-primary hover:underline"
                    dir="auto"
                  >
                    {item.patient.fullName || "—"}
                  </span>
                ) : (
                  <span className="text-[14.5px] font-semibold text-ink" dir="auto">
                    {item.name || "—"}
                  </span>
                )}
                {arName && (
                  <span className="text-[11.5px] text-ink-3" dir="rtl">
                    {arName}
                  </span>
                )}
                {item.patient?.nationalId && (
                  <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
                    {item.patient.nationalId}
                  </span>
                )}
                {item.isSurgery && (
                  <span className="rounded-full bg-warn-bg px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-warn-fg">
                    surgery
                  </span>
                )}
                {item.isVerified && (
                  <span className="rounded-full bg-vital-bg px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-vital-fg">
                    verified
                  </span>
                )}
              </div>

              {/* Doctor · location */}
              {(item.doctor || item.location) && (
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-ink-2">
                  {item.doctor && <span>Dr. {item.doctor.fullName}</span>}
                  {item.doctor && item.location && <Dot />}
                  {item.location && <span className="text-ink-3">{item.location}</span>}
                </div>
              )}

              {/* Contact line */}
              {(item.patient?.mobileNumber || item.contactPhone || item.contactEmail) && (
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11.5px] text-ink-3">
                  {(item.patient?.mobileNumber || item.contactPhone) && (
                    <span>{item.patient?.mobileNumber || item.contactPhone}</span>
                  )}
                  {(item.patient?.mobileNumber || item.contactPhone) && item.contactEmail && <Dot />}
                  {item.contactEmail && <span className="lowercase">{item.contactEmail}</span>}
                </div>
              )}

              {/* Notes */}
              {item.notes && (
                <div
                  className="mt-1.5 line-clamp-2 rounded-[6px] bg-paper-2 px-2 py-1 text-[12px] italic leading-snug text-ink-2"
                  dir="auto"
                >
                  {item.notes}
                </div>
              )}

              {/* Open visit link */}
              {item.patientVisitId && (
                <div className="mt-1.5">
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenVisit(item.patientVisitId!);
                    }}
                    className="inline-flex items-center gap-1 font-mono text-[11px] font-medium uppercase tracking-wider text-primary-600 hover:text-primary-700 hover:underline"
                  >
                    Open visit →
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Status pill */}
        <span
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wider"
          style={STATUS_STYLE[item.statusId]}
        >
          <span aria-hidden className="size-1.5 rounded-full bg-current" />
          {SCHEDULE_STATUSES.find((s) => s.id === item.statusId)?.label ?? `S${item.statusId}`}
        </span>
      </button>
    </li>
  );
}

function Dot(): JSX.Element {
  return <span aria-hidden className="size-1 shrink-0 rounded-full bg-ink-4" />;
}
