import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  exportAuditCsv,
  getAuditSummary,
  listAudit,
  type AuditEvent,
  type FacetBucket,
  type ListAuditParams,
} from "./audit-api";
import { AuditDetailDrawer } from "./AuditDetailDrawer";

// ── Constants ────────────────────────────────────────────────────────────────

const KNOWN_ACTIONS: ReadonlyArray<{ value: string; tone: ActionTone }> = [
  { value: "Create", tone: "vital" },
  { value: "Update", tone: "info" },
  { value: "Delete", tone: "alert" },
  { value: "Export", tone: "primary" },
  { value: "Print", tone: "primary" },
  { value: "Login", tone: "neutral" },
  { value: "Logout", tone: "neutral" },
  { value: "LoginFailed", tone: "alert" },
];

type ActionTone = "primary" | "vital" | "info" | "warn" | "alert" | "neutral";

const OUTCOMES = ["success", "denied", "error"] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayLocal(): string {
  return new Date().toISOString().slice(0, 10);
}
function nDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function fmtTime(s: string): string {
  const d = new Date(s.includes(" ") ? s.replace(" ", "T") + "Z" : s);
  return isNaN(d.getTime()) ? s : d.toLocaleString();
}

function actionTone(action: string): ActionTone {
  return KNOWN_ACTIONS.find((a) => a.value === action)?.tone ?? "neutral";
}

function toneClasses(tone: ActionTone): string {
  switch (tone) {
    case "vital":
      return "bg-vital-bg text-vital-fg";
    case "info":
      return "bg-primary-100 text-primary-700";
    case "warn":
      return "bg-warn-bg text-warn-fg";
    case "alert":
      return "bg-alert-bg text-alert-fg";
    case "primary":
      return "bg-primary-50 text-primary-700";
    default:
      return "bg-paper-3 text-ink-3";
  }
}

// ── Screen ───────────────────────────────────────────────────────────────────

interface FilterState {
  from: string;
  to: string;
  actions: Set<string>;
  entityTypes: Set<string>;
  userId: string;
  patientId: string;
  outcome: string;
  q: string;
}

function defaultFilters(): FilterState {
  return {
    from: nDaysAgo(7),
    to: todayLocal(),
    actions: new Set(),
    entityTypes: new Set(),
    userId: "",
    patientId: "",
    outcome: "",
    q: "",
  };
}

function toParams(f: FilterState, page: number, pageSize: number): ListAuditParams {
  return {
    from: f.from ? `${f.from} 00:00:00.000000` : undefined,
    to: f.to ? `${f.to} 23:59:59.999999` : undefined,
    action: f.actions.size > 0 ? Array.from(f.actions).join(",") : undefined,
    entityType: f.entityTypes.size > 0 ? Array.from(f.entityTypes).join(",") : undefined,
    userId: f.userId || undefined,
    patientId: f.patientId || undefined,
    outcome: f.outcome || undefined,
    q: f.q || undefined,
    page,
    pageSize,
  };
}

export function AuditTab(): JSX.Element {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const params = useMemo(() => toParams(filters, page, 25), [filters, page]);

  const listQ = useQuery({
    queryKey: ["audit", "list", params],
    queryFn: ({ signal }) => listAudit(params, signal),
    staleTime: 30_000,
  });

  const summaryQ = useQuery({
    queryKey: ["audit", "summary", filters.from, filters.to],
    queryFn: ({ signal }) =>
      getAuditSummary(
        filters.from ? `${filters.from} 00:00:00.000000` : undefined,
        filters.to ? `${filters.to} 23:59:59.999999` : undefined,
        signal,
      ),
    staleTime: 60_000,
  });

  const facets = listQ.data?.facets;
  const total = listQ.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / 25));

  const onReset = (): void => {
    setFilters(defaultFilters());
    setPage(1);
  };

  const onExport = async (): Promise<void> => {
    setExporting(true);
    try {
      const blob = await exportAuditCsv({ ...params, page: undefined, pageSize: undefined });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-${filters.from}_${filters.to}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* ── KPI strip ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Events"
          value={summaryQ.data?.totals.total ?? 0}
          accent="primary"
          spark={summaryQ.data?.byDay.map((d) => d.total)}
        />
        <KpiTile
          label="Failed"
          value={summaryQ.data?.totals.failed ?? 0}
          accent={(summaryQ.data?.totals.failed ?? 0) > 0 ? "alert" : "vital"}
          spark={summaryQ.data?.byDay.map((d) => d.failed)}
        />
        <KpiTile
          label="Top action"
          value={summaryQ.data?.topAction?.action ?? "—"}
          sub={
            summaryQ.data?.topAction
              ? `${summaryQ.data.topAction.count.toLocaleString()} events`
              : ""
          }
          accent="info"
        />
        <KpiTile
          label="Top user"
          value={
            summaryQ.data?.topUser?.fullName ??
            summaryQ.data?.topUser?.userName ??
            "—"
          }
          sub={
            summaryQ.data?.topUser
              ? `${summaryQ.data.topUser.count.toLocaleString()} events`
              : ""
          }
          accent="primary"
        />
      </div>

      {/* ── Filters card ─────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <h2 className="font-mono text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
              Filter
            </h2>
            <span className="font-mono text-[11.5px] text-ink-4">{total.toLocaleString()} events</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onReset}
              className="text-[12.5px] font-medium text-primary hover:text-primary-700"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onExport}
              disabled={exporting || total === 0}
              className="rounded-[8px] border border-rule bg-card px-3 py-1.5 text-[12.5px] font-medium text-ink-2 hover:border-rule-2 disabled:opacity-50"
            >
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-3">
          {/* Date range */}
          <div className="md:col-span-1">
            <label className="mb-1 block text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
              From
            </label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => {
                setFilters((f) => ({ ...f, from: e.target.value }));
                setPage(1);
              }}
              className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 font-mono text-[13px] tnum outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
            />
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
              To
            </label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => {
                setFilters((f) => ({ ...f, to: e.target.value }));
                setPage(1);
              }}
              className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 font-mono text-[13px] tnum outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
            />
          </div>

          {/* Outcome */}
          <div className="md:col-span-1">
            <label className="mb-1 block text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
              Outcome
            </label>
            <select
              value={filters.outcome}
              onChange={(e) => {
                setFilters((f) => ({ ...f, outcome: e.target.value }));
                setPage(1);
              }}
              className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 text-[13px] outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
            >
              <option value="">All</option>
              {OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          {/* Action chips */}
          <div className="md:col-span-3">
            <label className="mb-1 block text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
              Action
            </label>
            <ChipRow
              options={KNOWN_ACTIONS.map((a) => ({
                value: a.value,
                label: a.value,
                count: countFor(facets?.actions, a.value),
                tone: a.tone,
              }))}
              selected={filters.actions}
              onToggle={(v) => {
                setFilters((f) => {
                  const next = new Set(f.actions);
                  if (next.has(v)) next.delete(v);
                  else next.add(v);
                  return { ...f, actions: next };
                });
                setPage(1);
              }}
            />
          </div>

          {/* Entity type chips */}
          <div className="md:col-span-3">
            <label className="mb-1 block text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
              Entity
            </label>
            <ChipRow
              options={(facets?.entityTypes ?? []).map((e) => ({
                value: e.value,
                label: e.label,
                count: e.count,
                tone: "primary" as ActionTone,
              }))}
              selected={filters.entityTypes}
              onToggle={(v) => {
                setFilters((f) => {
                  const next = new Set(f.entityTypes);
                  if (next.has(v)) next.delete(v);
                  else next.add(v);
                  return { ...f, entityTypes: next };
                });
                setPage(1);
              }}
              emptyHint="No entities in this date range"
            />
          </div>

          {/* Free-text ID filters */}
          <div className="md:col-span-1">
            <label className="mb-1 block text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
              User ID
            </label>
            <input
              type="text"
              value={filters.userId}
              onChange={(e) => {
                setFilters((f) => ({ ...f, userId: e.target.value }));
                setPage(1);
              }}
              placeholder="UUID"
              className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 font-mono text-[12px] outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
            />
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
              Patient ID
            </label>
            <input
              type="text"
              value={filters.patientId}
              onChange={(e) => {
                setFilters((f) => ({ ...f, patientId: e.target.value }));
                setPage(1);
              }}
              placeholder="UUID"
              className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 font-mono text-[12px] outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
            />
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
              Entity ID contains
            </label>
            <input
              type="text"
              value={filters.q}
              onChange={(e) => {
                setFilters((f) => ({ ...f, q: e.target.value }));
                setPage(1);
              }}
              placeholder="partial UUID"
              className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 font-mono text-[12px] outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
            />
          </div>
        </div>
      </section>

      {/* ── Timeline ─────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
        {listQ.isLoading ? (
          <SkeletonRows />
        ) : (listQ.data?.data.length ?? 0) === 0 ? (
          <div className="px-5 py-10 text-center">
            <div aria-hidden className="text-[28px] opacity-40">
              ✓
            </div>
            <p className="mt-2 text-[13px] text-ink-3">No audit events in this range.</p>
          </div>
        ) : (
          <ul className="divide-y divide-rule">
            {listQ.data!.data.map((e) => (
              <EventRow key={e.auditId} event={e} onOpen={() => setSelectedId(e.auditId)} />
            ))}
          </ul>
        )}

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-rule px-5 py-3">
            <span className="font-mono text-[11.5px] text-ink-3">
              Page {page} / {pageCount}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-[8px] border border-rule bg-card px-3 py-1 text-[12px] font-medium text-ink-2 hover:border-rule-2 disabled:opacity-40"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page >= pageCount}
                className="rounded-[8px] border border-rule bg-card px-3 py-1 text-[12px] font-medium text-ink-2 hover:border-rule-2 disabled:opacity-40"
              >
                →
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Detail drawer ────────────────────────────────────────────── */}
      <AuditDetailDrawer
        auditId={selectedId}
        onClose={() => setSelectedId(null)}
        onFilterByCorrelation={(cid) => {
          setFilters((f) => ({ ...defaultFilters(), from: f.from, to: f.to, ...{} }));
          // Use a fresh filter with only the correlation set so the user sees
          // all events from the same logical action.
          setFilters({
            ...defaultFilters(),
            actions: new Set(),
            entityTypes: new Set(),
            outcome: "",
            userId: "",
            patientId: "",
            q: cid,
          });
          setSelectedId(null);
          setPage(1);
        }}
      />
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  sub,
  accent,
  spark,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent: "primary" | "vital" | "warn" | "alert" | "info";
  spark?: number[];
}): JSX.Element {
  const rails: Record<string, string> = {
    primary: "bg-primary",
    vital: "bg-vital-fg",
    warn: "bg-warn-fg",
    alert: "bg-alert-fg",
    info: "bg-primary-300",
  };
  const tones: Record<string, string> = {
    primary: "text-ink",
    vital: "text-vital-fg",
    warn: "text-warn-fg",
    alert: "text-alert-fg",
    info: "text-primary-700",
  };
  const strokes: Record<string, string> = {
    primary: "var(--primary-500)",
    vital: "var(--vital-fg)",
    warn: "var(--warn-fg)",
    alert: "var(--alert-fg)",
    info: "var(--primary-500)",
  };
  return (
    <div className="relative overflow-hidden rounded-lg border border-rule bg-card shadow-1">
      <div className={`absolute inset-y-0 start-0 w-[3px] ${rails[accent]}`} />
      <div className="px-5 py-4 ps-6">
        <div className="font-mono text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
          {label}
        </div>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div
            className={`font-serif text-[26px] font-medium leading-none tnum ${tones[accent]}`}
          >
            {typeof value === "number" ? value.toLocaleString() : value}
          </div>
          {spark && spark.length > 1 && <SparkSvg values={spark} stroke={strokes[accent]} />}
        </div>
        {sub && <div className="mt-1.5 text-[12px] text-ink-3">{sub}</div>}
      </div>
    </div>
  );
}

function SparkSvg({ values, stroke }: { values: number[]; stroke: string }): JSX.Element {
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
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden style={{ color: stroke }}>
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

function ChipRow({
  options,
  selected,
  onToggle,
  emptyHint,
}: {
  options: Array<{ value: string; label: string; count: number; tone: ActionTone }>;
  selected: Set<string>;
  onToggle: (v: string) => void;
  emptyHint?: string;
}): JSX.Element {
  if (options.length === 0) {
    return <p className="text-[12px] text-ink-4">{emptyHint ?? "—"}</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((o) => {
        const on = selected.has(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider transition-colors duration-2 ${
              on ? toneClasses(o.tone) : "bg-paper-3 text-ink-3 hover:bg-paper-2"
            }`}
          >
            <span className={`size-1.5 rounded-full ${on ? "bg-current" : "bg-ink-4"}`} />
            {o.label}
            <span className="text-ink-4">{o.count}</span>
          </button>
        );
      })}
    </div>
  );
}

function countFor(facet: FacetBucket[] | undefined, value: string): number {
  return facet?.find((f) => f.value === value)?.count ?? 0;
}

function EventRow({ event, onOpen }: { event: AuditEvent; onOpen: () => void }): JSX.Element {
  const tone = actionTone(event.action);
  const failed = event.outcome !== "success";
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="grid w-full grid-cols-[150px_120px_1fr_auto] items-center gap-3 px-5 py-3 text-start transition-colors duration-2 hover:bg-card-2"
      >
        <span className="font-mono text-[11.5px] tnum text-ink-3">{fmtTime(event.eventTime)}</span>
        <span
          className={`inline-flex items-center gap-1 self-start rounded-full px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wider ${toneClasses(
            tone,
          )}`}
        >
          <span className="size-1.5 rounded-full bg-current" />
          {event.action}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13.5px] text-ink">
            <span className="font-medium">{event.user.fullName ?? event.user.userName ?? event.user.userId.slice(0, 8)}</span>
            <span className="text-ink-3">{" "}· {event.entityType}</span>
            {event.entityId && (
              <span className="ms-1.5 font-mono text-[11px] text-ink-4">
                {event.entityId.slice(0, 8)}
              </span>
            )}
          </div>
          {event.patient && (
            <div className="truncate text-[12px] text-ink-3">
              ↳ {event.patient.fullName ?? event.patient.patientId.slice(0, 8)}
            </div>
          )}
        </div>
        {failed && (
          <span
            className={`inline-flex items-center gap-1 rounded-full bg-alert-bg px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wider text-alert-fg`}
          >
            <span className="size-1.5 rounded-full bg-current" />
            {event.outcome}
          </span>
        )}
      </button>
    </li>
  );
}

function SkeletonRows(): JSX.Element {
  return (
    <div className="divide-y divide-rule">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="grid grid-cols-[150px_120px_1fr] items-center gap-3 px-5 py-3">
          <div className="h-3 w-28 animate-pulse rounded bg-paper-3" />
          <div className="h-4 w-20 animate-pulse rounded-full bg-paper-3" />
          <div className="space-y-1.5">
            <div className="h-3 w-2/3 animate-pulse rounded bg-paper-3" />
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-paper-3" />
          </div>
        </div>
      ))}
    </div>
  );
}
