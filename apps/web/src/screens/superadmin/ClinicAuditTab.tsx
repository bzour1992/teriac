import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmModal } from "../../components/ConfirmModal";
import { ApiError } from "../../lib/api/client";
import {
  getClinicAuditSummary,
  purgeClinicAuditLog,
  type ClinicAuditSummary,
} from "./api";

interface Props {
  clinicId: string;
}

function fmtDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s.includes(" ") ? s.replace(" ", "T") + "Z" : s);
  return isNaN(d.getTime())
    ? s
    : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function fmtDateOnly(d: Date): string {
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function cutoffDate(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}

const ACTION_TONE: Record<string, string> = {
  Create: "bg-vital-bg text-vital-fg",
  Update: "bg-primary-100 text-primary-700",
  Delete: "bg-alert-bg text-alert-fg",
  Export: "bg-primary-50 text-primary-700",
  Print: "bg-primary-50 text-primary-700",
  Login: "bg-paper-3 text-ink-3",
  Logout: "bg-paper-3 text-ink-3",
  LoginFailed: "bg-alert-bg text-alert-fg",
};

export function ClinicAuditTab({ clinicId }: Props): JSX.Element {
  const qc = useQueryClient();
  const [confirmMonths, setConfirmMonths] = useState<1 | 2 | 3 | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const summaryQ = useQuery({
    queryKey: ["superadmin", "clinic-audit", clinicId],
    queryFn: ({ signal }) => getClinicAuditSummary(clinicId, signal),
    staleTime: 30_000,
  });

  const purgeMut = useMutation({
    mutationFn: (months: 1 | 2 | 3) => purgeClinicAuditLog(clinicId, months),
    onSuccess: (res) => {
      setConfirmMonths(null);
      setResultMsg(
        `Deleted ${res.deleted.toLocaleString()} event(s) older than ${res.cutoff.slice(0, 10)}.`,
      );
      qc.invalidateQueries({ queryKey: ["superadmin", "clinic-audit", clinicId] });
    },
    onError: (err) => {
      setResultMsg(
        err instanceof ApiError ? err.message : (err as Error).message || "Purge failed",
      );
    },
  });

  const data = summaryQ.data;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <section className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
        <header className="border-b border-rule px-5 py-3.5">
          <h2 className="font-serif text-[18px] font-medium tracking-tight text-ink">
            Audit summary
          </h2>
          <p className="mt-0.5 text-[12.5px] text-ink-3">
            Lifetime counts and storage range for this clinic.
          </p>
        </header>

        {summaryQ.isLoading ? (
          <div className="grid grid-cols-2 gap-3 px-5 py-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-[10px] bg-paper-3" />
            ))}
          </div>
        ) : !data ? (
          <div className="px-5 py-8 text-center text-[13px] text-ink-3">
            Failed to load summary.
          </div>
        ) : (
          <>
            {/* KPI strip */}
            <div className="grid grid-cols-2 gap-3 px-5 py-4 lg:grid-cols-4">
              <SummaryTile label="Total events" value={data.total} accent="primary" />
              <SummaryTile
                label="Failed"
                value={data.failed}
                accent={data.failed > 0 ? "alert" : "vital"}
              />
              <SummaryTile label="Last 30 days" value={data.last30Days} accent="primary" />
              <SummaryTile label="Last 90 days" value={data.last90Days} accent="primary" />
            </div>

            <div className="grid grid-cols-1 gap-4 border-t border-rule px-5 py-4 sm:grid-cols-2">
              <KvRow label="Oldest event" value={fmtDate(data.oldestEvent)} />
              <KvRow label="Newest event" value={fmtDate(data.newestEvent)} />
            </div>

            {/* Action breakdown */}
            {data.byAction.length > 0 && (
              <div className="border-t border-rule px-5 py-4">
                <h3 className="mb-2 font-mono text-[11px] font-medium uppercase tracking-wider text-ink-3">
                  By action
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {data.byAction.map((a) => (
                    <span
                      key={a.action}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider ${
                        ACTION_TONE[a.action] ?? "bg-paper-3 text-ink-3"
                      }`}
                    >
                      <span className="size-1.5 rounded-full bg-current" />
                      {a.action}
                      <span className="text-ink-4">{a.count.toLocaleString()}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Retention / purge */}
      <section className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
        <header className="border-b border-rule px-5 py-3.5">
          <h2 className="font-serif text-[18px] font-medium tracking-tight text-ink">
            Retention
          </h2>
          <p className="mt-0.5 text-[12.5px] text-ink-3">
            Permanently delete audit events older than a chosen age. This is
            destructive — there is no undo. Recent events are kept.
          </p>
        </header>
        <div className="space-y-3 px-5 py-4">
          {([1, 2, 3] as const).map((m) => (
            <PurgeRow
              key={m}
              months={m}
              cutoff={cutoffDate(m)}
              onClick={() => {
                setResultMsg(null);
                setConfirmMonths(m);
              }}
              disabled={purgeMut.isPending || (data?.total ?? 0) === 0}
            />
          ))}
          {resultMsg && (
            <div
              role="status"
              className={`rounded-[10px] px-3 py-2 text-[13px] ${
                resultMsg.startsWith("Deleted")
                  ? "bg-vital-bg text-vital-fg"
                  : "bg-alert-bg text-alert-fg"
              }`}
            >
              {resultMsg}
            </div>
          )}
        </div>
      </section>

      <ConfirmModal
        open={confirmMonths != null}
        title={`Remove events older than ${confirmMonths ?? ""} month${confirmMonths === 1 ? "" : "s"}?`}
        body={
          <div className="space-y-2 text-[13.5px] text-ink-2">
            <p>
              This will permanently delete audit log rows whose <code>EventTime</code> is
              before{" "}
              <span className="font-mono font-medium text-ink">
                {confirmMonths != null ? fmtDateOnly(cutoffDate(confirmMonths)) : ""}
              </span>{" "}
              for this clinic.
            </p>
            <p className="text-ink-3">
              There is no undo. Future writes are unaffected.
            </p>
          </div>
        }
        confirmLabel="Delete events"
        destructive
        pending={purgeMut.isPending}
        onConfirm={() => {
          if (confirmMonths) purgeMut.mutate(confirmMonths);
        }}
        onCancel={() => setConfirmMonths(null)}
      />
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function SummaryTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "primary" | "vital" | "alert";
}): JSX.Element {
  const rails: Record<string, string> = {
    primary: "bg-primary",
    vital: "bg-vital-fg",
    alert: "bg-alert-fg",
  };
  const tones: Record<string, string> = {
    primary: "text-ink",
    vital: "text-vital-fg",
    alert: "text-alert-fg",
  };
  return (
    <div className="relative overflow-hidden rounded-[10px] border border-rule bg-card">
      <div className={`absolute inset-y-0 start-0 w-[3px] ${rails[accent]}`} />
      <div className="px-4 py-3 ps-5">
        <div className="font-mono text-[10.5px] font-medium uppercase tracking-wider text-ink-3">
          {label}
        </div>
        <div className={`mt-0.5 font-serif text-[24px] font-medium leading-none tnum ${tones[accent]}`}>
          {value.toLocaleString()}
        </div>
      </div>
    </div>
  );
}

function KvRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <div className="font-mono text-[10.5px] font-medium uppercase tracking-wider text-ink-3">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[12.5px] tnum text-ink">{value}</div>
    </div>
  );
}

function PurgeRow({
  months,
  cutoff,
  onClick,
  disabled,
}: {
  months: 1 | 2 | 3;
  cutoff: Date;
  onClick: () => void;
  disabled: boolean;
}): JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-rule bg-card-2 px-4 py-3">
      <div>
        <div className="text-[13.5px] font-medium text-ink">
          Older than {months} month{months === 1 ? "" : "s"}
        </div>
        <div className="mt-0.5 font-mono text-[11.5px] text-ink-3">
          cutoff &lt; {fmtDateOnly(cutoff)}
        </div>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="rounded-[10px] border border-alert-fg/40 bg-card px-3 py-1.5 text-[12.5px] font-medium text-alert-fg hover:bg-alert-bg disabled:cursor-not-allowed disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}
