import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmModal } from "../../components/ConfirmModal";
import { deleteBillingRecord, listBillingRecords, type BillingRecordItem } from "./billing-api";
import { AddChargeModal } from "./AddChargeModal";
import { InvoiceModal } from "./InvoiceModal";

interface Props {
  visitId: string;
  patientId: string;
  title?: ReactNode;
  id?: string;
}

const fmt = (n: number): string =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (s: string): string => {
  const d = new Date(s.includes(" ") ? s.replace(" ", "T") + "Z" : s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

export function BillingCard({ visitId, patientId, title, id }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<BillingRecordItem | null>(null);

  const recordsQ = useQuery({
    queryKey: ["billing", visitId],
    queryFn: ({ signal }) => listBillingRecords(visitId, signal),
    staleTime: 30_000,
  });

  const records = recordsQ.data ?? [];
  const unlocked = records.filter((r) => !r.isLocked);
  const locked = records.filter((r) => r.isLocked);
  const total = records.reduce((s, r) => s + r.expense, 0);

  const deleteMutation = useMutation({
    mutationFn: (r: BillingRecordItem) =>
      deleteBillingRecord(visitId, r.patientBillingRecordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", visitId] });
      setPendingDelete(null);
    },
    onError: () => {
      setPendingDelete(null);
    },
  });

  return (
    <>
      <div id={id} className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rule px-5 py-4">
          <h2 className="font-serif text-[18px] font-medium tracking-tight text-ink">{title ?? "Billing"}</h2>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded-[10px] bg-primary px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-primary-600"
          >
            + Add charge
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {recordsQ.isLoading ? (
            <div className="py-6 text-center text-[13px] text-ink-3">Loading…</div>
          ) : recordsQ.error ? (
            <div className="py-4 text-center text-[13px] text-alert-fg">
              {(recordsQ.error as Error).message}
            </div>
          ) : records.length === 0 ? (
            <div className="py-6 text-center text-[13px] text-ink-4">
              No charges recorded for this visit.
            </div>
          ) : (
            <ul className="divide-y divide-dashed divide-rule">
              {records.map((r) => (
                <RecordRow
                  key={r.patientBillingRecordId}
                  record={r}
                  onDelete={() => setPendingDelete(r)}
                />
              ))}
            </ul>
          )}

          {records.length > 0 && (
            <div className="mt-3 flex items-center justify-between border-t border-rule pt-3">
              <span className="text-[12px] font-medium uppercase tracking-wider text-ink-3">
                Total
              </span>
              <span className="font-mono text-[15px] font-semibold tnum text-ink">
                {fmt(total)}
              </span>
            </div>
          )}

          {unlocked.length > 0 && (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setInvoiceOpen(true)}
                className="rounded-[10px] border border-primary/30 bg-primary-50 px-3.5 py-2 text-[13px] font-medium text-primary-700 hover:bg-primary-100"
              >
                Create invoice → ({unlocked.length} charge{unlocked.length !== 1 ? "s" : ""})
              </button>
            </div>
          )}

          {locked.length > 0 && unlocked.length === 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-[10px] bg-vital-bg px-3 py-2 text-[12.5px] text-vital-fg">
              <span>🔒</span>
              <span>
                All charges invoiced under{" "}
                <span className="font-mono font-medium">{locked[0].ifNumber}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      <AddChargeModal open={addOpen} visitId={visitId} onClose={() => setAddOpen(false)} />

      <InvoiceModal
        open={invoiceOpen}
        visitId={visitId}
        patientId={patientId}
        unlockedRecords={unlocked}
        onClose={() => setInvoiceOpen(false)}
      />

      <ConfirmModal
        open={!!pendingDelete}
        destructive
        title="Remove charge?"
        body={
          <>
            Remove <strong>{pendingDelete?.details || pendingDelete?.categoryName}</strong> (
            <span className="font-mono tnum">{fmt(pendingDelete?.expense ?? 0)}</span>) from this
            visit?
          </>
        }
        confirmLabel="Remove"
        pending={deleteMutation.isPending}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

function RecordRow({
  record,
  onDelete,
}: {
  record: BillingRecordItem;
  onDelete: () => void;
}): JSX.Element {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span
            className={`text-[13.5px] ${record.isLocked ? "text-ink-3" : "text-ink"}`}
            dir="auto"
          >
            {record.details || record.categoryName}
          </span>
          {record.isLocked && record.ifNumber && (
            <span className="inline-flex items-center gap-1 rounded-full bg-paper-3 px-2 py-0.5 font-mono text-[10.5px] text-ink-3">
              🔒 {record.ifNumber}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[11.5px] text-ink-4">{fmtDate(record.recordDate)}</div>
      </div>
      <span className="shrink-0 font-mono text-[13.5px] font-medium tnum text-ink">
        {fmt(record.expense)}
      </span>
      {!record.isLocked && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="Remove charge"
          className="shrink-0 rounded-full p-1 text-ink-4 hover:bg-alert-bg hover:text-alert-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          ×
        </button>
      )}
    </li>
  );
}
