import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "../../lib/api/client";
import { PageHead } from "../../layout/AppShell";

const PAGE_SIZE = 25;
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/v1";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BillingInvoiceItem {
  patientInvoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  patient: { patientId: string; fullName: string; fullNameAr: string | null; nationalId: string };
  totalCharged: number;
  paidByPatient: number;
  discount: number;
  coveredByHealthInsurance: number | null;
  coveredByHospital: number | null;
  finalBalance: number;
}

interface BillingInvoiceListResponse {
  data: BillingInvoiceItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: { totalInvoiced: number; totalCollected: number; totalOutstanding: number; count: number };
}

interface DailyBilling {
  date: string;
  invoiceCount: number;
  totalCharged: number;
  totalCollected: number;
  outstanding: number;
}

// ── API ───────────────────────────────────────────────────────────────────────

function listInvoices(p: { from?: string; to?: string; page: number; pageSize: number }, signal?: AbortSignal): Promise<BillingInvoiceListResponse> {
  const q: Record<string, string> = { page: String(p.page), pageSize: String(p.pageSize) };
  if (p.from) q.from = p.from;
  if (p.to) q.to = p.to;
  return api("/billing/invoices", { query: q, signal });
}

function getDailyBilling(from: string, to: string, signal?: AbortSignal): Promise<DailyBilling[]> {
  return api("/billing/invoices/daily", { query: { from, to }, signal });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtShort = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));
const fmtDate = (s: string) => {
  const d = new Date(s.includes(" ") ? s.replace(" ", "T") + "Z" : s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};
const fmtDay = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); };
const monthAgo = () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split("T")[0]; };
const today = () => new Date().toISOString().split("T")[0];
const ISO = (d: string, end?: boolean) => `${d}T${end ? "23:59:59.999" : "00:00:00.000"}Z`;

// ── KPI ───────────────────────────────────────────────────────────────────────

function Kpi({ label, value, accent }: { label: string; value: string; accent?: "vital" | "alert" | "warn" | "primary" }) {
  const rails = { vital: "bg-vital-fg", alert: "bg-alert-fg", warn: "bg-warn-fg", primary: "bg-primary" };
  const vals  = { vital: "text-vital-fg", alert: "text-alert-fg", warn: "text-warn-fg", primary: "text-primary" };
  return (
    <div className="relative overflow-hidden rounded-lg border border-rule bg-card shadow-1">
      <div className={`absolute inset-y-0 start-0 w-[3px] ${rails[accent ?? "primary"]}`} />
      <div className="px-5 py-4 ps-6">
        <div className="eyebrow mb-0.5 text-ink-3">{label}</div>
        <div className={`font-mono text-[22px] font-bold tnum ${vals[accent ?? "primary"]}`}>{value}</div>
      </div>
    </div>
  );
}

// ── Chart tooltip ─────────────────────────────────────────────────────────────

function ChartTip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-rule bg-card px-3 py-2 shadow-2 text-[12px]">
      <div className="mb-1.5 font-medium text-ink">{label}</div>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 tnum">
          <span className="size-2 shrink-0 rounded-full" style={{ background: p.color }} />
          <span className="text-ink-3">{p.name}</span>
          <span className="ms-auto ps-4 font-semibold text-ink">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export function BillingScreen(): JSX.Element {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"overview" | "invoices">("overview");
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [df, setDf] = useState(from);
  const [dt, setDt] = useState(to);
  const [page, setPage] = useState(1);
  const deb = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(deb.current);
    deb.current = setTimeout(() => { setDf(from); setDt(to); setPage(1); }, 400);
    return () => clearTimeout(deb.current);
  }, [from, to]);

  const iF = ISO(df); const iT = ISO(dt, true);

  const invoicesQ = useQuery({
    queryKey: ["billing", "invoices", df, dt, page],
    queryFn: ({ signal }) => listInvoices({ from: iF, to: iT, page, pageSize: PAGE_SIZE }, signal),
    placeholderData: keepPreviousData, staleTime: 30_000,
  });
  const dailyQ = useQuery({
    queryKey: ["billing", "daily", df, dt],
    queryFn: ({ signal }) => getDailyBilling(iF, iT, signal),
    staleTime: 60_000,
  });

  const summary = invoicesQ.data?.summary;
  const invoices = invoicesQ.data?.data ?? [];
  const daily = dailyQ.data ?? [];
  const totalPages = Math.max(1, Math.ceil((invoicesQ.data?.total ?? 0) / PAGE_SIZE));

  const dateBar = (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[12.5px] font-medium text-ink-3">From</span>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="rounded-[10px] border border-rule bg-card px-3 py-2 font-mono text-[13px] tnum outline-none hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[12.5px] font-medium text-ink-3">To</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} className="rounded-[10px] border border-rule bg-card px-3 py-2 font-mono text-[13px] tnum outline-none hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]" />
      </div>
      <button type="button" onClick={() => { setFrom(monthAgo()); setTo(today()); }} className="rounded-[10px] border border-rule bg-card px-3 py-2 text-[12.5px] font-medium text-ink-3 hover:border-rule-2">Last 30 days</button>
      {(invoicesQ.isFetching || dailyQ.isFetching) && <span className="font-mono text-[11px] uppercase tracking-wider text-ink-4">Loading…</span>}
      {summary && <span className="ms-auto font-mono text-[12px] text-ink-3 tnum">{summary.count} invoice{summary.count !== 1 ? "s" : ""}</span>}
    </div>
  );

  return (
    <>
      <PageHead eyebrow="Billing" title="Invoices" />

      {/* KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Total invoiced"  value={summary ? fmt(summary.totalInvoiced)  : "—"} accent="primary" />
        <Kpi label="Collected"       value={summary ? fmt(summary.totalCollected) : "—"} accent="vital" />
        <Kpi label="Outstanding"     value={summary ? fmt(summary.totalOutstanding) : "—"} accent={summary && summary.totalOutstanding > 0 ? "warn" : "vital"} />
        <Kpi label="Invoices"        value={summary ? String(summary.count) : "—"} />
      </div>

      {/* Tabs */}
      <div className="mb-5 flex border-b border-rule">
        {(["overview", "invoices"] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-[13px] font-medium capitalize transition-colors duration-[150ms] ${tab === t ? "border-b-[3px] border-primary text-ink" : "text-ink-3 hover:text-ink"}`}>
            {t}
          </button>
        ))}
      </div>

      {dateBar}

      {/* Overview */}
      {tab === "overview" && (
        <div className="space-y-5">
          {/* Daily bar chart */}
          <div className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
            <div className="border-b border-rule px-5 py-4">
              <h2 className="font-serif text-[18px] font-medium">Daily Billing</h2>
              <p className="text-[12px] text-ink-3">Charged vs Collected per day</p>
            </div>
            <div className="px-2 pb-4 pt-2">
              {daily.length === 0
                ? <div className="py-12 text-center text-[13px] text-ink-3">No invoices in this period.</div>
                : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={daily} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 11, fill: "var(--ink-4)" }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "var(--ink-4)" }} axisLine={false} tickLine={false} width={52} />
                      <Tooltip content={<ChartTip />} />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                      <Bar dataKey="totalCharged"   name="Charged"   fill="#155dfc" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="totalCollected" name="Collected" fill="#0f7a4d" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="outstanding"    name="Outstanding" fill="#a76a0c" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )
              }
            </div>
          </div>

          {/* Recent invoices */}
          <div className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
            <div className="border-b border-rule px-5 py-4"><h2 className="font-serif text-[18px] font-medium">Recent Invoices</h2></div>
            <InvoiceTable invoices={invoices.slice(0, 8)} isLoading={invoicesQ.isLoading} navigate={navigate} />
          </div>
        </div>
      )}

      {/* Invoices list */}
      {tab === "invoices" && (
        <>
          <div className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
            <InvoiceTable invoices={invoices} isLoading={invoicesQ.isLoading} navigate={navigate} />
          </div>
          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <button type="button" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded-[10px] border border-rule bg-card px-3 py-1.5 text-[12.5px] font-medium text-ink-2 hover:border-rule-2 disabled:opacity-40">‹ Prev</button>
              <span className="font-mono text-[12px] text-ink-3 tnum">Page {page} of {totalPages}</span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded-[10px] border border-rule bg-card px-3 py-1.5 text-[12.5px] font-medium text-ink-2 hover:border-rule-2 disabled:opacity-40">Next ›</button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function InvoiceTable({ invoices, isLoading, navigate }: { invoices: BillingInvoiceItem[]; isLoading: boolean; navigate: (path: string) => void }) {
  if (isLoading) return <div className="px-5 py-10 text-center text-[13px] text-ink-3">Loading invoices…</div>;
  if (!invoices.length) return <div className="px-5 py-10 text-center text-[13px] text-ink-3">No invoices in this date range.</div>;
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b border-rule bg-card-2">
          <th className="px-4 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">Invoice #</th>
          <th className="px-4 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">Date</th>
          <th className="px-4 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">Patient</th>
          <th className="px-4 py-3 text-end text-[11px] font-medium uppercase tracking-wider text-ink-3">Total</th>
          <th className="hidden px-4 py-3 text-end text-[11px] font-medium uppercase tracking-wider text-ink-3 md:table-cell">Paid</th>
          <th className="px-4 py-3 text-end text-[11px] font-medium uppercase tracking-wider text-ink-3">Balance</th>
          <th className="px-4 py-3 text-center text-[11px] font-medium uppercase tracking-wider text-ink-3">PDF</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-dashed divide-rule">
        {invoices.map(inv => (
          <tr key={inv.patientInvoiceId} className="hover:bg-card-2">
            <td className="px-4 py-3">
              <span className="font-mono text-[12px] font-semibold text-primary-700">{inv.invoiceNumber}</span>
            </td>
            <td className="px-4 py-3 font-mono text-[12px] tnum text-ink-2 whitespace-nowrap">{fmtDate(inv.invoiceDate)}</td>
            <td className="px-4 py-3">
              <button type="button" onClick={() => navigate(`/patients/${inv.patient.patientId}`)} className="text-start hover:underline focus-visible:outline-none">
                <div className="font-medium text-ink" dir="auto">{inv.patient.fullName}</div>
                <div className="font-mono text-[11px] text-ink-4">{inv.patient.nationalId}</div>
              </button>
            </td>
            <td className="px-4 py-3 text-end font-mono font-medium tnum text-ink">{fmt(inv.totalCharged)}</td>
            <td className="hidden px-4 py-3 text-end font-mono tnum text-vital-fg md:table-cell">{fmt(inv.paidByPatient)}</td>
            <td className="px-4 py-3 text-end">
              {inv.finalBalance > 0
                ? <span className="font-mono text-[12px] font-semibold tnum text-warn-fg">{fmt(inv.finalBalance)}</span>
                : <span className="font-mono text-[12px] tnum text-vital-fg">✓ Paid</span>
              }
            </td>
            <td className="px-4 py-3 text-center">
              <a href={`${API_BASE}/reports/invoice/${inv.patientInvoiceId}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center rounded-[8px] border border-rule px-2.5 py-1 text-[11px] font-medium text-ink-3 hover:border-rule-2 hover:text-ink-2 no-underline"
                onClick={e => e.stopPropagation()}>
                Print
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
