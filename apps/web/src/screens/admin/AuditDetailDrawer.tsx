import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getAuditEvent, type AuditEventDetail } from "./audit-api";

interface Props {
  auditId: number | null;
  onClose: () => void;
  onFilterByCorrelation: (correlationId: string) => void;
}

function fmtTime(s: string): string {
  const d = new Date(s.includes(" ") ? s.replace(" ", "T") + "Z" : s);
  return isNaN(d.getTime()) ? s : d.toLocaleString();
}

function actionTone(action: string): string {
  switch (action) {
    case "Create":
      return "bg-vital-bg text-vital-fg";
    case "Update":
      return "bg-primary-100 text-primary-700";
    case "Delete":
    case "LoginFailed":
      return "bg-alert-bg text-alert-fg";
    case "Export":
    case "Print":
      return "bg-primary-50 text-primary-700";
    default:
      return "bg-paper-3 text-ink-3";
  }
}

export function AuditDetailDrawer({
  auditId,
  onClose,
  onFilterByCorrelation,
}: Props): JSX.Element | null {
  const open = auditId != null;

  // Close on Esc; lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const q = useQuery({
    queryKey: ["audit", "detail", auditId],
    queryFn: ({ signal }) => getAuditEvent(auditId!, signal),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  if (!open) return null;
  const event = q.data;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Audit event detail"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] transition-opacity duration-2"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className="absolute inset-y-0 end-0 flex w-[min(560px,100vw)] flex-col border-s border-rule bg-card shadow-3"
        style={{ animation: "slideIn 220ms cubic-bezier(0.2, 0, 0, 1) both" }}
      >
        <style>{`@keyframes slideIn { from { transform: translateX(20px); opacity: 0 } to { transform: none; opacity: 1 } } html[dir="rtl"] aside { animation-name: slideInRtl } @keyframes slideInRtl { from { transform: translateX(-20px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>

        {/* Header */}
        <header className="flex items-center justify-between gap-3 border-b border-rule px-5 py-4">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
              Audit event
            </div>
            <h2 className="font-serif text-[20px] font-medium tracking-tight text-ink">
              {event?.entityType ?? "—"}
              {event?.entityId && (
                <span className="ms-2 font-mono text-[12px] font-normal text-ink-3">
                  {event.entityId.slice(0, 8)}
                </span>
              )}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="size-8 rounded-full text-ink-3 hover:bg-paper-3 hover:text-ink"
          >
            ✕
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {q.isLoading || !event ? (
            <div className="space-y-3">
              <div className="h-4 w-1/2 animate-pulse rounded bg-paper-3" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-paper-3" />
              <div className="h-32 w-full animate-pulse rounded-lg bg-paper-3" />
            </div>
          ) : (
            <DetailBody event={event} onFilterByCorrelation={onFilterByCorrelation} />
          )}
        </div>
      </aside>
    </div>
  );
}

function DetailBody({
  event,
  onFilterByCorrelation,
}: {
  event: AuditEventDetail;
  onFilterByCorrelation: (cid: string) => void;
}): JSX.Element {
  const failed = event.outcome !== "success";

  return (
    <div className="space-y-5">
      {/* Action + outcome */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider ${actionTone(
            event.action,
          )}`}
        >
          <span className="size-1.5 rounded-full bg-current" />
          {event.action}
        </span>
        {failed ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-alert-bg px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider text-alert-fg">
            <span className="size-1.5 rounded-full bg-current" />
            {event.outcome}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-vital-bg px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider text-vital-fg">
            <span className="size-1.5 rounded-full bg-current" />
            success
          </span>
        )}
      </div>

      {/* Meta grid */}
      <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-[13px]">
        <Term label="Time">{fmtTime(event.eventTime)}</Term>
        <Term label="User">
          <div>{event.user.fullName ?? event.user.userName ?? "—"}</div>
          <div className="font-mono text-[11px] text-ink-4">{event.user.userId.slice(0, 12)}…</div>
        </Term>
        <Term label="IP">
          <span className="font-mono text-[12px]">{event.ipAddress || "—"}</span>
        </Term>
        {event.userAgent && (
          <Term label="User agent">
            <span className="break-words text-[12px] text-ink-3">{event.userAgent}</span>
          </Term>
        )}
        {event.patient && (
          <Term label="Patient">
            <Link
              to={`/patients/${event.patient.patientId}`}
              className="text-primary hover:text-primary-700"
            >
              {event.patient.fullName ?? event.patient.patientId.slice(0, 8)}
            </Link>
          </Term>
        )}
        {event.entityId && (
          <Term label={`${event.entityType} ID`}>
            <span className="font-mono text-[12px]">{event.entityId}</span>
          </Term>
        )}
        <Term label="Correlation">
          <button
            type="button"
            onClick={() => onFilterByCorrelation(event.correlationId)}
            className="font-mono text-[11.5px] text-primary hover:text-primary-700"
            title="Show related events"
          >
            {event.correlationId.slice(0, 12)}…
          </button>
        </Term>
        {event.errorMessage && (
          <Term label="Error">
            <span className="text-alert-fg">{event.errorMessage}</span>
          </Term>
        )}
      </dl>

      {/* Diff */}
      {(event.changedFields?.length ?? 0) > 0 && (
        <section>
          <h3 className="mb-2 font-mono text-[11px] font-medium uppercase tracking-wider text-ink-3">
            Changed fields
          </h3>
          <div className="overflow-hidden rounded-[10px] border border-rule">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-card-2">
                  <th className="px-3 py-2 text-start font-medium text-ink-2">Field</th>
                  <th className="px-3 py-2 text-start font-medium text-ink-2">Before</th>
                  <th className="px-3 py-2 text-start font-medium text-ink-2">After</th>
                </tr>
              </thead>
              <tbody>
                {event.changedFields!.map((f) => (
                  <tr key={f} className="border-t border-rule">
                    <td className="px-3 py-2 align-top font-mono text-[11.5px] text-ink-2">{f}</td>
                    <td className="px-3 py-2 align-top text-ink-3">
                      <ValueCell v={event.previousValues?.[f]} />
                    </td>
                    <td className="px-3 py-2 align-top text-ink">
                      <ValueCell v={event.newValues?.[f]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Raw JSON fallback */}
      {(event.previousValues || event.newValues) && (event.changedFields?.length ?? 0) === 0 && (
        <section>
          <h3 className="mb-2 font-mono text-[11px] font-medium uppercase tracking-wider text-ink-3">
            Raw values
          </h3>
          {event.previousValues && (
            <pre className="overflow-x-auto rounded-[10px] border border-rule bg-card-2 px-3 py-2 font-mono text-[11.5px] text-ink-2">
{JSON.stringify(event.previousValues, null, 2)}
            </pre>
          )}
          {event.newValues && (
            <pre className="mt-2 overflow-x-auto rounded-[10px] border border-rule bg-card-2 px-3 py-2 font-mono text-[11.5px] text-ink-2">
{JSON.stringify(event.newValues, null, 2)}
            </pre>
          )}
        </section>
      )}
    </div>
  );
}

function Term({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <>
      <dt className="font-mono text-[10.5px] font-medium uppercase tracking-wider text-ink-3">
        {label}
      </dt>
      <dd className="text-ink">{children}</dd>
    </>
  );
}

function ValueCell({ v }: { v: unknown }): JSX.Element {
  if (v == null || v === "") return <span className="text-ink-4">—</span>;
  if (typeof v === "object") {
    return (
      <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px]">
        {JSON.stringify(v)}
      </pre>
    );
  }
  return <span className="break-words">{String(v)}</span>;
}
