import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api/client";

// ── Types ────────────────────────────────────────────────────────────────────

interface PatientVitalsRecord {
  pvVitalsId: string;
  recordedAt: string;
  patientVisitId: string;
  visitDate: string;
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  sbp: number | null;
  dbp: number | null;
  pulseRate: number | null;
  temperatureC: number | null;
  respiratoryRate: number | null;
  spo2: number | null;
}

interface Props {
  patientId: string;
  id?: string;
  title?: ReactNode;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseStored(s: string): Date {
  return new Date(s.includes(" ") ? s.replace(" ", "T") : s);
}

function fmtDate(s: string): string {
  return parseStored(s).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" });
}

function fmtDateMs(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" });
}

function fmtNumber(n: number, decimals = 1): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

interface Series {
  key: string;
  label: string;
  unit: string;
  /** Optional secondary line (drawn dimmer). Used for BP diastolic. */
  values: Array<{ t: number; v: number | null; visitId: string }>;
  secondary?: Array<{ t: number; v: number | null; visitId: string }>;
  stroke: string;
  /** Reference range — drawn as a faint band. */
  ref?: { low: number; high: number };
}

// ── Screen ───────────────────────────────────────────────────────────────────

export function VitalsTrendsCard({ patientId, id, title }: Props): JSX.Element {
  const q = useQuery({
    queryKey: ["patients", "vitals-trend", patientId],
    queryFn: ({ signal }) =>
      api<PatientVitalsRecord[]>(
        `/patients/${encodeURIComponent(patientId)}/vitals`,
        { signal },
      ),
    staleTime: 60_000,
  });

  const series = useMemo<Series[]>(() => {
    const rows = (q.data ?? []).slice().sort((a, b) =>
      parseStored(a.recordedAt).getTime() - parseStored(b.recordedAt).getTime(),
    );
    if (rows.length === 0) return [];
    const map = (key: keyof PatientVitalsRecord) =>
      rows.map((r) => ({
        t: parseStored(r.recordedAt).getTime(),
        v: (r[key] as number | null) ?? null,
        visitId: r.patientVisitId,
      }));
    return [
      {
        key: "bp",
        label: "Blood pressure",
        unit: "mmHg",
        values: map("sbp"),
        secondary: map("dbp"),
        stroke: "var(--alert-fg)",
        ref: { low: 90, high: 140 },
      },
      {
        key: "pulse",
        label: "Pulse",
        unit: "bpm",
        values: map("pulseRate"),
        stroke: "var(--primary-500)",
        ref: { low: 60, high: 100 },
      },
      {
        key: "temp",
        label: "Temperature",
        unit: "°C",
        values: map("temperatureC"),
        stroke: "var(--warn-fg)",
        ref: { low: 36.1, high: 37.5 },
      },
      {
        key: "spo2",
        label: "SpO₂",
        unit: "%",
        values: map("spo2"),
        stroke: "var(--vital-fg)",
        ref: { low: 95, high: 100 },
      },
      {
        key: "weight",
        label: "Weight",
        unit: "kg",
        values: map("weightKg"),
        stroke: "var(--primary-700)",
      },
      {
        key: "bmi",
        label: "BMI",
        unit: "",
        values: map("bmi"),
        stroke: "var(--primary-500)",
        ref: { low: 18.5, high: 25 },
      },
    ].filter((s) => countPoints(s) >= 2);
  }, [q.data]);

  const totalReadings = q.data?.length ?? 0;
  const newestDate = q.data?.[q.data.length - 1]?.recordedAt;

  return (
    <section
      id={id}
      className="overflow-hidden rounded-lg border border-rule bg-card shadow-1"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <h2 className="font-serif text-[18px] font-medium tracking-tight text-ink">
            {title ?? "Vitals trends"}
          </h2>
          {totalReadings > 0 && (
            <span className="inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 font-mono text-[11px] font-medium tnum text-primary-700">
              {totalReadings}
            </span>
          )}
        </div>
        {newestDate && (
          <span className="font-mono text-[11.5px] text-ink-3">
            Last reading {fmtDate(newestDate)}
          </span>
        )}
      </header>

      {q.isLoading ? (
        <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-[10px] bg-paper-3" />
          ))}
        </div>
      ) : series.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <div aria-hidden className="text-[28px] opacity-40">📈</div>
          <p className="mt-2 text-[13px] text-ink-3">
            {totalReadings === 0
              ? "No vitals recorded yet."
              : "Not enough readings to plot a trend (need at least 2)."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          {series.map((s) => (
            <TrendCard key={s.key} series={s} />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Per-metric mini chart ────────────────────────────────────────────────────

function TrendCard({ series }: { series: Series }): JSX.Element {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const W = 240;
  const H = 80;
  const padX = 6;
  const padY = 10;

  // Combine primary + secondary points for the value range.
  const allValues = [...series.values, ...(series.secondary ?? [])]
    .map((p) => p.v)
    .filter((v): v is number => v != null);
  if (allValues.length < 2) {
    // Defensive — caller already filters, but render an em-dash if not.
    return <div className="rounded-[10px] border border-rule bg-card-2 p-3 text-[13px] text-ink-3">{series.label}: not enough data</div>;
  }

  // Y range padded by ~10% so the line doesn't touch the edges.
  const dataMin = Math.min(...allValues, series.ref?.low ?? Infinity);
  const dataMax = Math.max(...allValues, series.ref?.high ?? -Infinity);
  const span = Math.max(dataMax - dataMin, 1);
  const yMin = dataMin - span * 0.1;
  const yMax = dataMax + span * 0.1;

  // X range from first to last reading.
  const firstT = series.values[0].t;
  const lastT = series.values[series.values.length - 1].t;
  const tSpan = Math.max(lastT - firstT, 1);

  const toX = (t: number): number => padX + ((t - firstT) / tSpan) * (W - 2 * padX);
  const toY = (v: number): number => H - padY - ((v - yMin) / (yMax - yMin)) * (H - 2 * padY);

  const linePath = makeLine(series.values, toX, toY);
  const secondaryPath = series.secondary ? makeLine(series.secondary, toX, toY) : null;

  // Reference band rectangle.
  const refTop = series.ref ? toY(series.ref.high) : 0;
  const refBottom = series.ref ? toY(series.ref.low) : 0;
  const refHeight = Math.abs(refBottom - refTop);

  // Hovered point info.
  const hover = hoverIdx != null ? series.values[hoverIdx] : null;
  const hoverSecondary = hoverIdx != null && series.secondary ? series.secondary[hoverIdx] : null;
  const latest = series.values[series.values.length - 1];
  const latestSecondary = series.secondary ? series.secondary[series.secondary.length - 1] : null;

  // Display value: hovered if any, else latest.
  const displayPrimary = hover ?? latest;
  const displaySecondary = hoverSecondary ?? latestSecondary;

  // Highlight colour if value is outside reference band.
  const outOfRange = (v: number | null): boolean => {
    if (v == null || !series.ref) return false;
    return v < series.ref.low || v > series.ref.high;
  };

  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    // Find the nearest point.
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < series.values.length; i++) {
      const d = Math.abs(toX(series.values[i].t) - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setHoverIdx(best);
  };

  return (
    <div className="rounded-[10px] border border-rule bg-card-2 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-mono text-[10.5px] font-medium uppercase tracking-wider text-ink-3">
          {series.label}
        </div>
        <Link
          to={`/visits/${displayPrimary.visitId}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-[10.5px] text-primary hover:text-primary-700"
        >
          open
        </Link>
      </div>

      <div className="mt-1 flex items-baseline justify-between gap-2">
        <div>
          <span
            className={`font-serif text-[24px] font-medium leading-none tnum ${
              outOfRange(displayPrimary.v) ? "text-alert-fg" : "text-ink"
            }`}
          >
            {displayPrimary.v != null ? fmtNumber(displayPrimary.v) : "—"}
            {displaySecondary && displaySecondary.v != null && (
              <span className="text-ink-3"> / {fmtNumber(displaySecondary.v)}</span>
            )}
          </span>
          {series.unit && (
            <span className="ms-1 text-[11.5px] text-ink-3">{series.unit}</span>
          )}
        </div>
        <div className="text-end font-mono text-[10.5px] text-ink-4">
          {fmtDateMs(displayPrimary.t)}
        </div>
      </div>

      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 block"
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
        role="img"
        aria-label={`${series.label} over time`}
      >
        {/* Reference band */}
        {series.ref && (
          <rect
            x={padX}
            y={refTop}
            width={W - 2 * padX}
            height={refHeight}
            fill="var(--vital-fg)"
            opacity={0.06}
          />
        )}

        {/* Secondary line (dashed) */}
        {secondaryPath && (
          <path
            d={secondaryPath}
            fill="none"
            stroke={series.stroke}
            strokeWidth={1.25}
            strokeDasharray="3 3"
            opacity={0.6}
          />
        )}

        {/* Primary line */}
        <path
          d={linePath}
          fill="none"
          stroke={series.stroke}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {series.values.map((p, i) =>
          p.v == null ? null : (
            <circle
              key={i}
              cx={toX(p.t)}
              cy={toY(p.v)}
              r={i === hoverIdx ? 3 : 1.5}
              fill={series.stroke}
              opacity={i === hoverIdx ? 1 : 0.85}
            />
          ),
        )}

        {/* Hover marker */}
        {hover && hover.v != null && (
          <line
            x1={toX(hover.t)}
            x2={toX(hover.t)}
            y1={padY}
            y2={H - padY}
            stroke="var(--ink-3)"
            strokeWidth={0.5}
            strokeDasharray="2 2"
            opacity={0.4}
          />
        )}
      </svg>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function countPoints(s: Series): number {
  return s.values.filter((p) => p.v != null).length;
}

function makeLine(
  values: Series["values"],
  toX: (t: number) => number,
  toY: (v: number) => number,
): string {
  // Skip nulls — break the line into segments around gaps.
  let path = "";
  let pen = false;
  for (const p of values) {
    if (p.v == null) {
      pen = false;
      continue;
    }
    const x = toX(p.t);
    const y = toY(p.v);
    path += pen ? ` L${x.toFixed(2)},${y.toFixed(2)}` : `M${x.toFixed(2)},${y.toFixed(2)}`;
    pen = true;
  }
  return path;
}

