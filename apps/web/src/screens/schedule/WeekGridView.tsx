import { useMemo, type CSSProperties } from "react";
import type { ScheduleListItem } from "./api";

const START_HOUR = 7;
const END_HOUR = 21; // exclusive — last row is 20:30→21:00
const SLOT_MIN = 30;
const ROW_PX = 36;
const ROWS = ((END_HOUR - START_HOUR) * 60) / SLOT_MIN; // 28

// Default clinic working window. TODO: pull from a per-clinic setting once
// `hcensystemsettings.WorkingHoursStart` / `…End` exists (CLAUDE.md §16 #8).
// For now anything outside 08:00–18:00 is dimmed.
const DEFAULT_WORK_START_HOUR = 8;
const DEFAULT_WORK_END_HOUR = 18;

const STATUS_STYLE: Record<number, { background: string; color: string; border: string }> = {
  1: { background: "var(--paper-3)", color: "var(--ink-2)", border: "var(--rule-2)" },
  2: { background: "var(--primary-100)", color: "var(--primary-800)", border: "var(--primary-300)" },
  3: { background: "var(--vital-bg)", color: "var(--vital-fg)", border: "var(--vital-fg)" },
  4: { background: "var(--warn-bg)", color: "var(--warn-fg)", border: "var(--warn-fg)" },
  5: { background: "var(--vital-bg)", color: "var(--vital-fg)", border: "var(--vital-fg)" },
  6: { background: "var(--alert-bg)", color: "var(--alert-fg)", border: "var(--alert-fg)" },
  7: { background: "var(--rule)", color: "var(--ink-4)", border: "var(--rule-2)" },
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Stored datetimes use the format "YYYY-MM-DD HH:MM:SS.fff" and represent LOCAL
// clinic time (no timezone). Parse without appending "Z" so JS interprets them as
// local instead of UTC — otherwise display would shift by the browser's UTC offset.
const parseStored = (iso: string): Date =>
  new Date(iso.includes(" ") ? iso.replace(" ", "T") : iso);


const isoLocalSlot = (day: Date, hour: number, minute: number): string => {
  const d = new Date(day);
  d.setHours(hour, minute, 0, 0);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:${pad(minute)}`;
};

interface StackedAppt extends ScheduleListItem {
  /** Pre-computed absolute top in px within the day column. */
  top: number;
  /** Pre-computed height in px. */
  height: number;
  /** True when this appointment was pushed down because the slot above was occupied. */
  cascaded: boolean;
}

interface DayBucket {
  date: Date;
  appts: ScheduleListItem[];
}

interface StackedDayBucket {
  date: Date;
  appts: StackedAppt[];
}

/**
 * Stack appointments vertically: each one takes the full column width on its
 * own row. Sorted by start time. If an appointment would overlap the previous
 * one's visual block, it cascades DOWN to start at the previous block's bottom.
 * Trades off precise time-axis alignment for readability — every appointment
 * is fully visible.
 */
function stackAppts(appts: ScheduleListItem[]): StackedAppt[] {
  if (appts.length === 0) return [];
  const sorted = [...appts].sort(
    (a, b) => parseStored(a.scheduledInDate).getTime() - parseStored(b.scheduledInDate).getTime(),
  );
  const placed: StackedAppt[] = [];
  let cursorBottom = 0;
  for (const item of sorted) {
    const start = parseStored(item.scheduledInDate);
    const end = parseStored(item.scheduledToDate);
    const minutesFromGridStart =
      start.getHours() * 60 + start.getMinutes() - START_HOUR * 60;
    const naturalTop = Math.max(0, (minutesFromGridStart / SLOT_MIN) * ROW_PX);
    const durationMin = Math.max(
      SLOT_MIN,
      Math.round((end.getTime() - start.getTime()) / 60000),
    );
    const height = (durationMin / SLOT_MIN) * ROW_PX - 2;
    const top = Math.max(naturalTop, cursorBottom);
    const cascaded = top > naturalTop;
    placed.push({ ...item, top, height, cascaded });
    cursorBottom = top + height + 2; // 2px gap between cascaded blocks
  }
  return placed;
}

const formatTimeShort = (d: Date): string =>
  d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

interface Props {
  weekStart: Date; // Monday of the displayed week
  items: ScheduleListItem[];
  onClickItem: (item: ScheduleListItem) => void;
  onClickEmptySlot: (defaultDateTimeLocal: string) => void;
  /** Working-hours window. Slots outside this range are dimmed. */
  workStartHour?: number;
  workEndHour?: number;
}

export function WeekGridView({
  weekStart,
  items,
  onClickItem,
  onClickEmptySlot,
  workStartHour = DEFAULT_WORK_START_HOUR,
  workEndHour = DEFAULT_WORK_END_HOUR,
}: Props): JSX.Element {
  const days = useMemo<StackedDayBucket[]>(() => {
    const buckets: DayBucket[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      return { date: d, appts: [] };
    });
    for (const it of items) {
      const start = parseStored(it.scheduledInDate);
      const dayIdx = Math.floor((start.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000));
      if (dayIdx >= 0 && dayIdx < 7) buckets[dayIdx].appts.push(it);
    }
    return buckets.map((b) => ({ date: b.date, appts: stackAppts(b.appts) }));
  }, [items, weekStart]);

  const rows = Array.from({ length: ROWS }, (_, i) => {
    const totalMin = START_HOUR * 60 + i * SLOT_MIN;
    return { hour: Math.floor(totalMin / 60), minute: totalMin % 60 };
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
      {/* Day headers */}
      <div
        className="grid border-b border-rule bg-card-2"
        style={{ gridTemplateColumns: `60px repeat(7, 1fr)` }}
      >
        <div /> {/* Spacer above time gutter */}
        {days.map((d, i) => {
          const isToday = d.date.getTime() === today.getTime();
          return (
            <div
              key={i}
              className={`border-s border-rule px-3 py-2 text-center ${
                isToday ? "bg-primary-50" : ""
              }`}
            >
              <div
                className={`eyebrow ${isToday ? "text-primary-700" : "text-ink-3"}`}
                style={isToday ? { color: "var(--primary-700)" } : undefined}
              >
                {DAY_LABELS[i]}
              </div>
              <div
                className={`mt-0.5 font-serif text-xl tnum ${isToday ? "" : "text-ink-2"}`}
                style={isToday ? { color: "var(--primary-700)" } : undefined}
              >
                {d.date.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid body */}
      <div className="relative">
        <div
          className="grid"
          style={{ gridTemplateColumns: `60px repeat(7, 1fr)` }}
        >
          {/* Time gutter */}
          <div className="border-e border-rule bg-card-2">
            {rows.map((r, i) => {
              const isWorking = r.hour >= workStartHour && r.hour < workEndHour;
              return (
                <div
                  key={i}
                  className={`flex h-[36px] items-start justify-end pe-2 pt-1 font-mono text-[10.5px] uppercase tracking-wider tnum ${
                    isWorking ? "text-ink-3" : "text-ink-4 opacity-50"
                  }`}
                >
                  {r.minute === 0 ? `${String(r.hour).padStart(2, "0")}:00` : ""}
                </div>
              );
            })}
          </div>

          {/* Day columns */}
          {days.map((day, di) => (
            <div key={di} className="relative border-s border-rule">
              {/* Empty-slot click targets */}
              {rows.map((r, ri) => {
                const isWorking = r.hour >= workStartHour && r.hour < workEndHour;
                return (
                  <button
                    key={ri}
                    type="button"
                    aria-label={`Add appointment at ${r.hour}:${String(r.minute).padStart(2, "0")}`}
                    onClick={() =>
                      onClickEmptySlot(isoLocalSlot(day.date, r.hour, r.minute))
                    }
                    className={`block h-[36px] w-full border-b transition-colors duration-1 ${
                      r.minute === 0 ? "border-b-rule" : "border-dashed border-rule/60"
                    } ${
                      isWorking
                        ? "hover:bg-primary-50"
                        : "bg-paper-2/40 hover:bg-paper-3"
                    }`}
                  />
                );
              })}

              {/* Appointment blocks — full column width, vertically stacked.
                  Overlapping appointments cascade downward (see `stackAppts`). */}
              {day.appts.map((appt) => {
                // Non-patient blockers (lunch, meetings, training) get a distinct
                // neutral / muted treatment so the eye can sweep past them when
                // looking for actual patient slots.
                const isBlocker = appt.notForPatient;
                const baseBg = STATUS_STYLE[appt.statusId]?.background ?? "var(--paper-3)";
                const baseFg = STATUS_STYLE[appt.statusId]?.color ?? "var(--ink-2)";
                const baseBorder = STATUS_STYLE[appt.statusId]?.border ?? "var(--rule-2)";
                const style: CSSProperties = {
                  position: "absolute",
                  top: appt.top,
                  height: Math.max(24, appt.height),
                  insetInlineStart: "2px",
                  insetInlineEnd: "2px",
                  background: isBlocker
                    ? // Diagonal stripes signal "not bookable" at a glance, on a soft neutral base.
                      `repeating-linear-gradient(135deg, var(--paper-2) 0 6px, var(--paper-3) 6px 12px)`
                    : baseBg,
                  color: isBlocker ? "var(--ink-3)" : baseFg,
                  borderInlineStart: `3px solid ${isBlocker ? "var(--ink-4)" : baseBorder}`,
                  borderColor: isBlocker ? "var(--rule-2)" : undefined,
                  borderStyle: isBlocker ? "dashed" : undefined,
                  borderWidth: isBlocker ? "1px" : undefined,
                };
                const start = parseStored(appt.scheduledInDate);
                const end = parseStored(appt.scheduledToDate);
                const compact = appt.height < 50;
                return (
                  <button
                    key={appt.scheduleItemId}
                    type="button"
                    onClick={() => onClickItem(appt)}
                    style={style}
                    title={`${formatTimeShort(start)}–${formatTimeShort(end)} · ${
                      appt.patient?.fullName ?? appt.name ?? "—"
                    }`}
                    className={[
                      "overflow-hidden rounded-[6px] px-2 py-1 text-start text-[11.5px] leading-tight transition-shadow duration-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
                      isBlocker ? "shadow-none hover:shadow-1" : "shadow-1 hover:shadow-2",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wider tnum opacity-80">
                      <span>{formatTimeShort(start)}</span>
                      {isBlocker && (
                        <span
                          aria-label="Not for patient"
                          title="Blocked slot — not for patient"
                          className="rounded-full bg-current/15 px-1 py-px text-[8.5px] font-medium uppercase tracking-wider leading-none"
                        >
                          ⊘ Block
                        </span>
                      )}
                      {appt.cascaded && (
                        <span
                          aria-label="Overlaps previous appointment"
                          className="rounded-full bg-current/15 px-1 py-px text-[8.5px] leading-none"
                          title="Overlaps previous appointment"
                        >
                          ↓
                        </span>
                      )}
                    </div>
                    <div
                      className={[
                        "truncate font-medium",
                        isBlocker ? "italic" : "",
                      ].join(" ")}
                      dir="auto"
                    >
                      {isBlocker
                        ? appt.name || "Blocked"
                        : appt.patient?.fullName || appt.name || "—"}
                    </div>
                    {!compact && appt.doctor && (
                      <div className="truncate text-[10.5px] opacity-80">
                        {appt.doctor.fullName}
                      </div>
                    )}
                    {!compact && appt.location && (
                      <div className="truncate text-[10.5px] opacity-70">{appt.location}</div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Returns the Monday of the week that contains the given local YYYY-MM-DD. */
export function mondayOfWeek(yyyymmdd: string): Date {
  const d = new Date(`${yyyymmdd}T00:00:00`);
  const dow = d.getDay(); // 0 = Sun, 1 = Mon, …
  const diff = (dow + 6) % 7; // days to subtract to land on Monday
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function weekBounds(weekStart: Date): { from: string; to: string } {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 7);
  // Stored datetimes are LOCAL clinic time — send bounds with matching components
  // so the inclusive boundaries don't shift by the user's UTC offset.
  const toBackend = (d: Date): string =>
    new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString();
  return { from: toBackend(weekStart), to: toBackend(end) };
}
