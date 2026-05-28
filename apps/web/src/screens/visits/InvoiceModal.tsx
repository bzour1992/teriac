import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { FieldLabel } from "../../lib/form-primitives";
import { ApiError } from "../../lib/api/client";
import { useFieldRules } from "../../lib/field-rules";
import { createInvoice, type BillingRecordItem } from "./billing-api";

interface Props {
  open: boolean;
  visitId: string;
  patientId: string;
  unlockedRecords: BillingRecordItem[];
  onClose: () => void;
}

const fmt = (n: number): string =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function InvoiceModal({
  open,
  visitId,
  patientId,
  unlockedRecords,
  onClose,
}: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [paidByPatient, setPaidByPatient] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [coveredByInsurance, setCoveredByInsurance] = useState("0");
  const [coveredByHospital, setCoveredByHospital] = useState("0");
  const [serverError, setServerError] = useState<string | null>(null);
  const [successInvoice, setSuccessInvoice] = useState<string | null>(null);
  const rules = useFieldRules("invoice");

  // Seed rule-driven defaults when the modal opens (no existing record to
  // restore from — this modal always creates a new invoice).
  useEffect(() => {
    if (!open) return;
    if (rules.defaults.discount != null) setDiscount(rules.defaults.discount);
    if (rules.defaults.coveredByHealthInsurance != null) {
      setCoveredByInsurance(rules.defaults.coveredByHealthInsurance);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const ruleEnforces = (field: string, value: string): boolean =>
    rules.isHidden(field) || !rules.isRequired(field) || value.trim().length > 0;

  // `invoiceNumber` is auto-generated server-side, so rule-required isn't
  // applicable. Only the optional rate inputs are governed here.
  const rulesSatisfied =
    ruleEnforces("discount", discount) &&
    ruleEnforces("coveredByHealthInsurance", coveredByInsurance);

  const totalCharged = unlockedRecords.reduce((s, r) => s + r.expense, 0);
  const paid = parseFloat(paidByPatient) || 0;
  const disc = parseFloat(discount) || 0;
  const ins = parseFloat(coveredByInsurance) || 0;
  const hosp = parseFloat(coveredByHospital) || 0;
  const finalBalance = Math.max(0, totalCharged - disc - ins - hosp - paid);

  const mutation = useMutation({
    mutationFn: () =>
      createInvoice({
        patientId,
        billingRecordIds: unlockedRecords.map((r) => r.patientBillingRecordId),
        paidByPatient: paid,
        discount: disc || undefined,
        coveredByHealthInsurance: ins || undefined,
        coveredByHospital: hosp || undefined,
      }),
    onSuccess: ({ invoiceNumber }) => {
      queryClient.invalidateQueries({ queryKey: ["billing", visitId] });
      setSuccessInvoice(invoiceNumber);
    },
    onError: (err) => {
      setServerError(
        err instanceof ApiError ? err.message : (err as Error).message || "Failed to create invoice",
      );
    },
  });

  const handleClose = (): void => {
    setSuccessInvoice(null);
    setServerError(null);
    setPaidByPatient("0");
    setDiscount("0");
    setCoveredByInsurance("0");
    setCoveredByHospital("0");
    onClose();
  };

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    setServerError(null);
    mutation.mutate();
  };

  if (successInvoice) {
    return (
      <Modal
        open={open}
        onClose={handleClose}
        title="Invoice created"
        size="sm"
        footer={
          <button
            type="button"
            onClick={handleClose}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600"
          >
            Done
          </button>
        }
      >
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-vital-bg text-2xl">
            ✓
          </div>
          <div className="text-[15px] font-medium text-ink">Invoice generated</div>
          <div className="font-mono text-[20px] font-semibold tnum text-primary">
            {successInvoice}
          </div>
          <div className="text-[13px] text-ink-3">
            All charges have been locked and recorded.
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!mutation.isPending) handleClose();
      }}
      title="Create invoice"
      size="md"
      dismissOnOverlay={!mutation.isPending}
      footer={
        <>
          <button
            type="button"
            onClick={handleClose}
            disabled={mutation.isPending}
            className="rounded-[10px] border border-rule bg-card px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:border-rule-2 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="invoice-form"
            disabled={mutation.isPending || unlockedRecords.length === 0 || !rulesSatisfied}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {mutation.isPending ? "Creating…" : "Create invoice"}
          </button>
        </>
      }
    >
      <form id="invoice-form" onSubmit={onSubmit} className="space-y-5">
        {serverError && (
          <div role="alert" className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
            {serverError}
          </div>
        )}

        {/* Charges table */}
        <div className="overflow-hidden rounded-lg border border-rule">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-card-2">
                <th className="px-3 py-2 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">
                  Service
                </th>
                <th className="px-3 py-2 text-end text-[11px] font-medium uppercase tracking-wider text-ink-3">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dashed divide-rule">
              {unlockedRecords.map((r) => (
                <tr key={r.patientBillingRecordId}>
                  <td className="px-3 py-2 text-ink-2">{r.details || r.categoryName}</td>
                  <td className="px-3 py-2 text-end font-mono tnum text-ink">{fmt(r.expense)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-rule bg-card-2">
                <td className="px-3 py-2 text-[12px] font-medium uppercase tracking-wider text-ink-3">
                  Total
                </td>
                <td className="px-3 py-2 text-end font-mono text-[14px] font-semibold tnum text-ink">
                  {fmt(totalCharged)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Payment fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="inv-paid" required>
              Paid by patient
            </FieldLabel>
            <input
              id="inv-paid"
              type="number"
              min="0"
              step="0.01"
              value={paidByPatient}
              onChange={(e) => setPaidByPatient(e.target.value)}
              className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 font-mono text-[13.5px] tnum outline-none transition-colors duration-[150ms] hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
            />
          </div>
          {(() => {
            const f = rules.field("discount", "Discount");
            return f.hidden ? null : (
              <div>
                <FieldLabel htmlFor={f.id || "inv-discount"} required={f.required}>
                  {f.label}
                </FieldLabel>
                <input
                  id={f.id || "inv-discount"}
                  type="number"
                  min="0"
                  step="0.01"
                  readOnly={f.readOnly}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className={`w-full rounded-[10px] border border-rule bg-card px-3 py-2 font-mono text-[13.5px] tnum outline-none transition-colors duration-[150ms] hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)] ${
                    f.readOnly ? "bg-paper-2 text-ink-3" : ""
                  }`}
                />
              </div>
            );
          })()}
          {(() => {
            const f = rules.field("coveredByHealthInsurance", "Covered by insurance");
            return f.hidden ? null : (
              <div>
                <FieldLabel htmlFor={f.id || "inv-insurance"} required={f.required}>
                  {f.label}
                </FieldLabel>
                <input
                  id={f.id || "inv-insurance"}
                  type="number"
                  min="0"
                  step="0.01"
                  readOnly={f.readOnly}
                  value={coveredByInsurance}
                  onChange={(e) => setCoveredByInsurance(e.target.value)}
                  className={`w-full rounded-[10px] border border-rule bg-card px-3 py-2 font-mono text-[13.5px] tnum outline-none transition-colors duration-[150ms] hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)] ${
                    f.readOnly ? "bg-paper-2 text-ink-3" : ""
                  }`}
                />
              </div>
            );
          })()}
          <div>
            <FieldLabel htmlFor="inv-hospital">Covered by hospital</FieldLabel>
            <input
              id="inv-hospital"
              type="number"
              min="0"
              step="0.01"
              value={coveredByHospital}
              onChange={(e) => setCoveredByHospital(e.target.value)}
              className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 font-mono text-[13.5px] tnum outline-none transition-colors duration-[150ms] hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
            />
          </div>
        </div>

        {/* Balance summary */}
        <div className="flex items-center justify-between rounded-[10px] bg-paper-2 px-4 py-3">
          <span className="text-[13px] font-medium text-ink-2">Remaining balance</span>
          <span
            className={`font-mono text-[16px] font-semibold tnum ${
              finalBalance > 0 ? "text-warn-fg" : "text-vital-fg"
            }`}
          >
            {fmt(finalBalance)}
          </span>
        </div>
      </form>
    </Modal>
  );
}
