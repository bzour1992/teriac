import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api/client";
import { PageHead } from "../../layout/AppShell";
import { Modal } from "../../components/Modal";
import { SearchableSelect } from "../../components/SearchableSelect";
import { FieldLabel } from "../../lib/form-primitives";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WalletItem { walletId: string; walletName: string; isDefault: boolean; isCashBox: boolean }
interface WalletBalance { walletId: string; balance: number }
interface TransactionItem {
  hcenterFinancalTransactionId: string; addDate: string;
  transactionType: number; transactionTypeLabel: string;
  details: string; amount: number; discount: number;
  walletName: string | null; patientName: string | null;
}
interface TransactionListResponse { data: TransactionItem[]; total: number; page: number; pageSize: number }
interface PnlReport {
  totalIncome: number; totalExpenses: number; totalRefunds: number;
  totalSalary: number; totalAdjustments: number; netProfit: number; transactionCount: number;
}
interface DailyReport { date: string; income: number; expenses: number; refunds: number; net: number; count: number }
interface DoctorRevenueItem { doctorId: string; doctorName: string; totalRevenue: number; transactionCount: number }

// ── API ───────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15;
function listWallets(s?: AbortSignal): Promise<WalletItem[]> { return api("/finance/wallets", { signal: s }); }
function getBalance(id: string, s?: AbortSignal): Promise<WalletBalance> { return api(`/finance/wallets/${id}/balance`, { signal: s }); }
function getDaily(from: string, to: string, s?: AbortSignal): Promise<DailyReport[]> { return api("/finance/reports/daily", { query: { from, to }, signal: s }); }
function getPnl(from: string, to: string, s?: AbortSignal): Promise<PnlReport> { return api("/finance/reports/pnl", { query: { from, to }, signal: s }); }
function getByDoctor(from: string, to: string, s?: AbortSignal): Promise<DoctorRevenueItem[]> { return api("/finance/reports/by-doctor", { query: { from, to }, signal: s }); }
function listTransactions(p: { from?: string; to?: string; walletId?: string; type?: number; page: number; pageSize: number }, s?: AbortSignal): Promise<TransactionListResponse> {
  const q: Record<string, string> = { page: String(p.page), pageSize: String(p.pageSize) };
  if (p.from) q.from = p.from;
  if (p.to) q.to = p.to;
  if (p.walletId) q.walletId = p.walletId;
  if (p.type) q.type = String(p.type);
  return api("/finance/transactions", { query: q, signal: s });
}
function createTransaction(body: Record<string, unknown>): Promise<{ hcenterFinancalTransactionId: string }> {
  return api("/finance/transactions", { method: "POST", body });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TX_TYPE_LABEL: Record<number, string> = {
  0: "Transaction", 1: "Income", 2: "Expense",
  3: "Refund", 4: "Transfer", 5: "Salary", 6: "Adjustment",
};
const TX_STYLE: Record<number, { fg: string; bg: string }> = {
  0: { fg: "var(--ink-3)", bg: "var(--rule)" },
  1: { fg: "var(--vital-fg)", bg: "var(--vital-bg)" },
  2: { fg: "var(--alert-fg)", bg: "var(--alert-bg)" },
  3: { fg: "var(--warn-fg)", bg: "var(--warn-bg)" },
  4: { fg: "var(--info-fg)", bg: "var(--info-bg)" },
  5: { fg: "var(--warn-fg)", bg: "var(--warn-bg)" },
  6: { fg: "var(--ink-3)", bg: "var(--rule)" },
};

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtShort = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));
const fmtDay = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); };
const fmtDt = (s: string) => { const d = new Date(s.includes(" ") ? s.replace(" ", "T") + "Z" : s); return isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { day: "2-digit", month: "short" }); };
const monthAgo = () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split("T")[0]; };
const today = () => new Date().toISOString().split("T")[0];
const ISO = (d: string, end?: boolean) => `${d}T${end ? "23:59:59.999" : "00:00:00.000"}Z`;

// ── KPI card ──────────────────────────────────────────────────────────────────

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "vital" | "alert" | "warn" | "primary" }) {
  const rails = { vital: "bg-vital-fg", alert: "bg-alert-fg", warn: "bg-warn-fg", primary: "bg-primary" };
  const vals  = { vital: "text-vital-fg", alert: "text-alert-fg", warn: "text-warn-fg", primary: "text-primary" };
  return (
    <div className="relative overflow-hidden rounded-lg border border-rule bg-card shadow-1">
      <div className={`absolute inset-y-0 start-0 w-[3px] ${rails[accent ?? "primary"]}`} />
      <div className="px-5 py-4 ps-6">
        <div className="eyebrow mb-0.5 text-ink-3">{label}</div>
        <div className={`font-mono text-[22px] font-bold tnum ${vals[accent ?? "primary"]}`}>{value}</div>
        {sub && <div className="mt-0.5 text-[11px] text-ink-4 tnum">{sub}</div>}
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

// ── Add Transaction modal ─────────────────────────────────────────────────────

function AddTxModal({ open, wallets, onClose }: { open: boolean; wallets: WalletItem[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ details: "", amount: "", type: "1", walletId: "", notes: "" });
  const [err, setErr] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: () => createTransaction({
      details: f.details.trim(), amount: parseFloat(f.amount) || 0,
      transactionType: Number(f.type), walletId: f.walletId || undefined,
      notes: f.notes.trim() || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance"] }); onClose(); setF({ details: "", amount: "", type: "1", walletId: "", notes: "" }); },
    onError: (e) => setErr(e instanceof ApiError ? e.message : (e as Error).message),
  });
  return (
    <Modal open={open} onClose={() => !mut.isPending && onClose()} title="New transaction" size="md" dismissOnOverlay={!mut.isPending}
      footer={<>
        <button type="button" onClick={onClose} disabled={mut.isPending} className="rounded-[10px] border border-rule bg-card px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:border-rule-2 disabled:opacity-50">Cancel</button>
        <button type="submit" form="tx-form" disabled={mut.isPending || !f.details || !f.amount} className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:bg-primary-200">{mut.isPending ? "Saving…" : "Save"}</button>
      </>}
    >
      <form id="tx-form" onSubmit={(e: FormEvent) => { e.preventDefault(); setErr(null); mut.mutate(); }} className="space-y-4">
        {err && <div role="alert" className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel required>Type</FieldLabel>
            <SearchableSelect
              value={f.type}
              onChange={(v) => setF(x => ({ ...x, type: String(v) }))}
              options={Object.entries(TX_TYPE_LABEL)
                .filter(([k]) => !["0", "4"].includes(k))
                .map(([v, l]) => ({ value: v, label: l }))}
            />
          </div>
          <div>
            <FieldLabel required>Amount</FieldLabel>
            <input type="number" min="0" step="0.01" value={f.amount} onChange={e => setF(x => ({ ...x, amount: e.target.value }))} className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 font-mono text-[13.5px] tnum outline-none focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]" />
          </div>
        </div>
        <div>
          <FieldLabel required>Description</FieldLabel>
          <input type="text" value={f.details} onChange={e => setF(x => ({ ...x, details: e.target.value }))} className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 text-[13.5px] outline-none focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]" />
        </div>
        {wallets.length > 0 && (
          <div>
            <FieldLabel>Wallet</FieldLabel>
            <SearchableSelect
              value={f.walletId}
              onChange={(v) => setF(x => ({ ...x, walletId: String(v) }))}
              emptyLabel="— None —"
              options={wallets.map(w => ({ value: w.walletId, label: w.walletName }))}
            />
          </div>
        )}
        <div>
          <FieldLabel>Notes</FieldLabel>
          <input type="text" value={f.notes} onChange={e => setF(x => ({ ...x, notes: e.target.value }))} className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 text-[13.5px] outline-none focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]" />
        </div>
      </form>
    </Modal>
  );
}

// ── Wallet card ───────────────────────────────────────────────────────────────

function WalletCard({ wallet }: { wallet: WalletItem }) {
  const q = useQuery({ queryKey: ["finance", "wallet-balance", wallet.walletId], queryFn: ({ signal }) => getBalance(wallet.walletId, signal), staleTime: 60_000 });
  const bal = q.data?.balance ?? 0;
  return (
    <div className="rounded-lg border border-rule bg-card p-5 shadow-1">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="font-medium text-ink">{wallet.walletName}</span>
        {wallet.isCashBox && <span className="rounded-full bg-paper-3 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-3">cash</span>}
        {wallet.isDefault && <span className="rounded-full bg-primary-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary-700">default</span>}
      </div>
      <div className={`font-mono text-[26px] font-bold tnum ${bal >= 0 ? "text-vital-fg" : "text-alert-fg"}`}>
        {q.isLoading ? "—" : fmt(bal)}
      </div>
    </div>
  );
}

// ── Tx table ──────────────────────────────────────────────────────────────────

function TxTable({ txs, loading }: { txs: TransactionItem[]; loading: boolean }) {
  if (loading) return <div className="px-5 py-8 text-center text-[13px] text-ink-3">Loading…</div>;
  if (!txs.length) return <div className="px-5 py-8 text-center text-[13px] text-ink-3">No transactions in this period.</div>;
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b border-rule bg-card-2">
          {["Date", "Type", "Description", "Wallet", "Amount"].map((h, i) => (
            <th key={h} className={`px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-ink-3 ${i === 4 ? "text-end" : "text-start"} ${i === 3 ? "hidden md:table-cell" : ""}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-dashed divide-rule">
        {txs.map(tx => {
          const s = TX_STYLE[tx.transactionType] ?? { fg: "var(--ink-3)", bg: "var(--rule)" };
          const out = [2, 5].includes(tx.transactionType);
          return (
            <tr key={tx.hcenterFinancalTransactionId} className="hover:bg-card-2">
              <td className="px-4 py-3 font-mono text-[12px] tnum text-ink-2 whitespace-nowrap">{fmtDt(tx.addDate)}</td>
              <td className="px-4 py-3">
                <span className="inline-flex rounded-full px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wider" style={{ background: s.bg, color: s.fg }}>
                  {tx.transactionTypeLabel}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="font-medium text-ink">{tx.details}</div>
                {tx.patientName && <div className="text-[11.5px] text-ink-3">{tx.patientName}</div>}
              </td>
              <td className="hidden px-4 py-3 text-[12px] text-ink-3 md:table-cell">{tx.walletName ?? "—"}</td>
              <td className={`px-4 py-3 text-end font-mono font-semibold tnum ${out ? "text-alert-fg" : "text-vital-fg"}`}>
                {out ? "−" : "+"}{fmt(tx.amount)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export function FinanceScreen(): JSX.Element {
  const [tab, setTab] = useState<"overview" | "transactions" | "wallets" | "reports">("overview");
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [df, setDf] = useState(from);
  const [dt, setDt] = useState(to);
  const [typeF, setTypeF] = useState<number | "">("");
  const [walletF, setWalletF] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const deb = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(deb.current);
    deb.current = setTimeout(() => { setDf(from); setDt(to); setPage(1); }, 400);
    return () => clearTimeout(deb.current);
  }, [from, to]);

  const iF = ISO(df); const iT = ISO(dt, true);

  const walletsQ = useQuery({ queryKey: ["finance", "wallets"], queryFn: ({ signal }) => listWallets(signal), staleTime: 60_000 });
  const pnlQ     = useQuery({ queryKey: ["finance", "pnl", df, dt], queryFn: ({ signal }) => getPnl(iF, iT, signal), staleTime: 60_000 });
  const dailyQ   = useQuery({ queryKey: ["finance", "daily", df, dt], queryFn: ({ signal }) => getDaily(iF, iT, signal), staleTime: 60_000 });
  const drQ      = useQuery({ queryKey: ["finance", "by-doctor", df, dt], queryFn: ({ signal }) => getByDoctor(iF, iT, signal), staleTime: 60_000, enabled: tab === "reports" });
  const txQ      = useQuery({
    queryKey: ["finance", "transactions", df, dt, walletF, typeF, page],
    queryFn: ({ signal }) => listTransactions({ from: iF, to: iT, walletId: walletF || undefined, type: typeF || undefined, page, pageSize: PAGE_SIZE }, signal),
    placeholderData: keepPreviousData, staleTime: 30_000, enabled: tab === "transactions",
  });

  const wallets = walletsQ.data ?? [];
  const pnl = pnlQ.data;
  const daily = dailyQ.data ?? [];
  const txs = txQ.data?.data ?? [];
  const totalPages = Math.max(1, Math.ceil((txQ.data?.total ?? 0) / PAGE_SIZE));

  const TABS = ["overview", "transactions", "wallets", "reports"] as const;

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
    </div>
  );

  return (
    <>
      <PageHead eyebrow="Finance" title="Overview"
        actions={<button type="button" onClick={() => setAdding(true)} className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600">+ New transaction</button>}
      />

      {/* KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Income" value={pnl ? fmt(pnl.totalIncome) : "—"} sub={pnl ? `${pnl.transactionCount} transactions` : undefined} accent="vital" />
        <Kpi label="Expenses + Salary" value={pnl ? fmt(pnl.totalExpenses + pnl.totalSalary) : "—"} accent="alert" />
        <Kpi label="Refunds" value={pnl ? fmt(pnl.totalRefunds) : "—"} accent="warn" />
        <Kpi label="Net profit" value={pnl ? fmt(pnl.netProfit) : "—"} accent={!pnl || pnl.netProfit >= 0 ? "vital" : "alert"} />
      </div>

      {/* Tabs */}
      <div className="mb-5 flex border-b border-rule">
        {TABS.map(t => (
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
          {/* Area chart */}
          <div className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
            <div className="border-b border-rule px-5 py-4">
              <h2 className="font-serif text-[18px] font-medium">Income vs Expenses</h2>
              <p className="text-[12px] text-ink-3">Daily breakdown</p>
            </div>
            <div className="px-2 pb-4 pt-2">
              {daily.length === 0
                ? <div className="py-12 text-center text-[13px] text-ink-3">No data for this period.</div>
                : (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={daily} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gI" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0f7a4d" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#0f7a4d" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#b3261e" stopOpacity={0.14} />
                          <stop offset="95%" stopColor="#b3261e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 11, fill: "var(--ink-4)" }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "var(--ink-4)" }} axisLine={false} tickLine={false} width={52} />
                      <Tooltip content={<ChartTip />} />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                      <Area type="monotone" dataKey="income" name="Income" stroke="#0f7a4d" strokeWidth={2} fill="url(#gI)" dot={false} activeDot={{ r: 4 }} />
                      <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#b3261e" strokeWidth={2} fill="url(#gE)" dot={false} activeDot={{ r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )
              }
            </div>
          </div>

          {/* Net bar chart */}
          {daily.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
              <div className="border-b border-rule px-5 py-4">
                <h2 className="font-serif text-[18px] font-medium">Daily Net</h2>
              </div>
              <div className="px-2 pb-4 pt-2">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={daily} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 11, fill: "var(--ink-4)" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "var(--ink-4)" }} axisLine={false} tickLine={false} width={52} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="net" name="Net" fill="#155dfc" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Wallets */}
          {wallets.length > 0 && (
            <>
              <h2 className="font-serif text-[18px] font-medium text-ink">Wallets</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {wallets.map(w => <WalletCard key={w.walletId} wallet={w} />)}
              </div>
            </>
          )}

          {/* Recent txs */}
          <RecentTxs isoFrom={iF} isoTo={iT} />
        </div>
      )}

      {/* Transactions */}
      {tab === "transactions" && (
        <div>
          <div className="mb-3 flex flex-wrap gap-3">
            <div className="min-w-[180px]">
              <SearchableSelect
                value={typeF}
                onChange={(v) => setTypeF(v === "" ? "" : Number(v))}
                emptyLabel="All types"
                options={Object.entries(TX_TYPE_LABEL).map(([v, l]) => ({
                  value: Number(v),
                  label: l,
                }))}
              />
            </div>
            {wallets.length > 0 && (
              <div className="min-w-[180px]">
                <SearchableSelect
                  value={walletF}
                  onChange={(v) => setWalletF(String(v))}
                  emptyLabel="All wallets"
                  options={wallets.map(w => ({ value: w.walletId, label: w.walletName }))}
                />
              </div>
            )}
          </div>
          <div className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
            <TxTable txs={txs} loading={txQ.isLoading} />
          </div>
          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <button type="button" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded-[10px] border border-rule bg-card px-3 py-1.5 text-[12.5px] font-medium text-ink-2 hover:border-rule-2 disabled:opacity-40">‹ Prev</button>
              <span className="font-mono text-[12px] text-ink-3 tnum">Page {page} of {totalPages}</span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded-[10px] border border-rule bg-card px-3 py-1.5 text-[12.5px] font-medium text-ink-2 hover:border-rule-2 disabled:opacity-40">Next ›</button>
            </div>
          )}
        </div>
      )}

      {/* Wallets tab */}
      {tab === "wallets" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {wallets.length === 0
            ? <p className="col-span-3 py-10 text-center text-[13px] text-ink-3">No wallets configured.</p>
            : wallets.map(w => <WalletCard key={w.walletId} wallet={w} />)}
        </div>
      )}

      {/* Reports */}
      {tab === "reports" && (
        <div className="space-y-5">
          {pnl && (
            <div className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
              <div className="border-b border-rule px-5 py-4"><h2 className="font-serif text-[18px] font-medium">P&amp;L Summary</h2></div>
              <div className="divide-y divide-dashed divide-rule">
                {[
                  ["Total income", pnl.totalIncome, true as const],
                  ["Total expenses", pnl.totalExpenses, false as const],
                  ["Salary paid", pnl.totalSalary, false as const],
                  ["Refunds issued", pnl.totalRefunds, false as const],
                  ["Adjustments", pnl.totalAdjustments, null],
                ].map(([label, value, pos]) => (
                  <div key={label as string} className="flex items-center justify-between px-5 py-3">
                    <span className="text-[13px] text-ink-2">{label as string}</span>
                    <span className={`font-mono font-semibold tnum ${pos === true ? "text-vital-fg" : pos === false ? "text-alert-fg" : "text-ink"}`}>
                      {pos === false ? "−" : ""}{fmt(value as number)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between bg-card-2 px-5 py-4">
                  <span className="text-[14px] font-semibold">Net profit</span>
                  <span className={`font-mono text-[20px] font-bold tnum ${pnl.netProfit >= 0 ? "text-vital-fg" : "text-alert-fg"}`}>{fmt(pnl.netProfit)}</span>
                </div>
              </div>
            </div>
          )}

          {drQ.data && drQ.data.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
              <div className="border-b border-rule px-5 py-4"><h2 className="font-serif text-[18px] font-medium">Revenue by Doctor</h2></div>
              <div className="px-2 pb-4 pt-2">
                <ResponsiveContainer width="100%" height={Math.max(160, drQ.data.length * 44)}>
                  <BarChart data={drQ.data} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" horizontal={false} />
                    <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "var(--ink-4)" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="doctorName" width={130} tick={{ fontSize: 11, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="totalRevenue" name="Revenue" fill="#155dfc" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      <AddTxModal open={adding} wallets={wallets} onClose={() => setAdding(false)} />
    </>
  );
}

function RecentTxs({ isoFrom, isoTo }: { isoFrom: string; isoTo: string }) {
  const q = useQuery({
    queryKey: ["finance", "recent-txs", isoFrom, isoTo],
    queryFn: ({ signal }) => listTransactions({ from: isoFrom, to: isoTo, page: 1, pageSize: 8 }, signal),
    staleTime: 30_000,
  });
  return (
    <div className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
      <div className="border-b border-rule px-5 py-4"><h2 className="font-serif text-[18px] font-medium">Recent Transactions</h2></div>
      <TxTable txs={q.data?.data ?? []} loading={q.isLoading} />
    </div>
  );
}
