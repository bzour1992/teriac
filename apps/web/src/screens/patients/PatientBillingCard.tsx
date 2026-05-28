import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listPatientInvoices, type InvoiceListItem } from "../visits/billing-api";

interface Props {
  patientId: string;
  id?: string;
  title?: ReactNode;
}

function fmtMoney(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseStored(s: string): Date {
  return new Date(s.includes(" ") ? s.replace(" ", "T") : s);
}

function fmtDate(s: string): string {
  return parseStored(s).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function PatientBillingCard({ patientId, id, title }: Props): JSX.Element {
  const q = useQuery({
    queryKey: ["patients", "invoices", patientId],
    queryFn: ({ signal }) => listPatientInvoices(patientId, signal),
    staleTime: 60_000,
  });

  const stats = useMemo(() => {
    const rows: InvoiceListItem[] = q.data ?? [];
    const total = rows.length;
    const outstanding = rows.reduce((s, r) => s + (r.finalBalance > 0 ? r.finalBalance : 0), 0);
    const lifetimePaid = rows.reduce((s, r) => s + r.paidByPatient, 0);
    const lifetimeCharged = rows.reduce((s, r) => s + r.totalCharged, 0);
    const lastInvoice = rows[0] ?? null; // already sorted desc by date on the server
    return { total, outstanding, lifetimePaid, lifetimeCharged, lastInvoice };
  }, [q.data]);

  const recent = (q.data ?? []).slice(0, 5);

  return (
    <section
      id={id}
      className="overflow-hidden rounded-lg border border-rule bg-card shadow-1"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <h2 className="font-serif text-[18px] font-medium tracking-tight text-ink">
            {title ?? "Billing"}
          </h2>
          {stats.total > 0 && (
            <span className="inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 font-mono text-[11px] font-medium tnum text-primary-700">
              {stats.total}
            </span>
          )}
        </div>
        <Link
          to="/billing"
          className="text-[12.5px] font-medium text-primary hover:text-primary-700"
        >
          Open billing →
        </Link>
      </header>

      {q.isLoading ? (
        <SkeletonBody />
      ) : stats.total === 0 ? (
        <div className="px-5 py-10 text-center">
          <div aria-hidden className="text-[28px] opacity-40">
            💳
          </div>
          <p className="mt-2 text-[13px] text-ink-3">No invoices yet.</p>
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-3 px-5 py-4">
            <KpiTile
              label="Outstanding"
              value={fmtMoney(stats.outstanding)}
              accent={stats.outstanding > 0 ? "alert" : "vital"}
            />
            <KpiTile
              label="Lifetime paid"
              value={fmtMoney(stats.lifetimePaid)}
              accent="vital"
            />
            <KpiTile
              label="Lifetime charged"
              value={fmtMoney(stats.lifetimeCharged)}
              accent="primary"
            />
          </div>

          {/* Recent invoices */}
          <div className="border-t border-rule">
            <div className="px-5 py-2 font-mono text-[10.5px] font-medium uppercase tracking-wider text-ink-3">
              Recent invoices
            </div>
            <ul className="divide-y divide-rule">
              {recent.map((inv) => (
                <li key={inv.patientInvoiceId}>
                  <div className="grid grid-cols-[110px_1fr_auto] items-center gap-3 px-5 py-2.5">
                    <span className="font-mono text-[11.5px] tnum text-ink-3">
                      {fmtDate(inv.invoiceDate)}
                    </span>
                    <span className="truncate text-[13px] text-ink">
                      <span className="font-mono text-[12px] text-ink-2">#{inv.invoiceNumber}</span>
                      {inv.discount > 0 && (
                        <span className="ms-2 text-[11.5px] text-ink-3">
                          (disc {fmtMoney(inv.discount)})
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2 font-mono text-[12.5px] tnum">
                      <span className="text-ink-3">
                        {fmtMoney(inv.totalCharged)}
                      </span>
                      {inv.finalBalance > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warn-bg px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-warn-fg">
                          <span className="size-1.5 rounded-full bg-current" />
                          {fmtMoney(inv.finalBalance)} due
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-vital-bg px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-vital-fg">
                          <span className="size-1.5 rounded-full bg-current" />
                          paid
                        </span>
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            {stats.total > recent.length && (
              <div className="border-t border-rule px-5 py-2 text-end">
                <Link
                  to="/billing"
                  className="text-[12px] text-primary hover:text-primary-700"
                >
                  View all {stats.total} invoices →
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "primary" | "vital" | "warn" | "alert";
}): JSX.Element {
  const rails: Record<string, string> = {
    primary: "bg-primary",
    vital: "bg-vital-fg",
    warn: "bg-warn-fg",
    alert: "bg-alert-fg",
  };
  const tones: Record<string, string> = {
    primary: "text-ink",
    vital: "text-vital-fg",
    warn: "text-warn-fg",
    alert: "text-alert-fg",
  };
  return (
    <div className="relative overflow-hidden rounded-[10px] border border-rule bg-card-2">
      <div className={`absolute inset-y-0 start-0 w-[3px] ${rails[accent]}`} />
      <div className="px-3 py-2.5 ps-4">
        <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-3">
          {label}
        </div>
        <div
          className={`mt-0.5 font-serif text-[20px] font-medium leading-none tnum ${tones[accent]}`}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function SkeletonBody(): JSX.Element {
  return (
    <div className="space-y-3 px-5 py-4">
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-[10px] bg-paper-3" />
        ))}
      </div>
      <div className="space-y-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-7 animate-pulse rounded bg-paper-3" />
        ))}
      </div>
    </div>
  );
}
