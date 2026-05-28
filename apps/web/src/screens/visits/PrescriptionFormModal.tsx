import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { MedicineCombobox } from "../../components/MedicineCombobox";
import { ApiError } from "../../lib/api/client";
import { useFieldRules } from "../../lib/field-rules";
import { TextInput, Textarea, SelectFreeText, applyDefaults, nonEmpty } from "../../lib/form-primitives";
import type { MedicineSuggestion } from "../../lib/coding/api";
import {
  createPrescription,
  updatePrescription,
  type CreatePrescriptionPayload,
  type UpdatePrescriptionPayload,
  type VisitDetail,
  type VisitPrescription,
} from "./api";

interface Props {
  visit: VisitDetail;
  /** When set, edit mode for this Rx. When null + open, add mode. */
  rx: VisitPrescription | null;
  open: boolean;
  onClose: () => void;
}

interface FormState {
  medicine: MedicineSuggestion | null;
  pvAssessmentConditionId: string;
  indication: string;
  dose: string;
  period: string;
  frequency: string;
  frequencyUnit: string;
  quantityNumber: string;
  quantityForm: string;
  route: string;
  notes: string;
  isPrescribed: boolean;
}

const ROUTES = ["PO", "ORL", "IM", "IV", "SC", "Topical", "Inhaled", "PR"];
const FREQ_UNITS = ["per day", "per week", "per month", "every 4h", "every 6h", "every 8h", "every 12h"];
const QTY_FORMS = ["tablet", "capsule", "mL", "drop", "puff", "patch", "vial"];

function blankForm(rx: VisitPrescription | null): FormState {
  if (!rx) {
    return {
      medicine: null,
      pvAssessmentConditionId: "",
      indication: "",
      dose: "",
      period: "",
      frequency: "",
      frequencyUnit: "per day",
      quantityNumber: "",
      quantityForm: "",
      route: "",
      notes: "",
      isPrescribed: true,
    };
  }
  return {
    medicine: {
      medicineId: rx.medicineId,
      tradeName: rx.medicineName,
      scientificName: rx.scientificName,
      countryCode: null,
    },
    pvAssessmentConditionId: "",
    indication: rx.indication ?? "",
    dose: rx.dose ?? "",
    period: rx.period ?? "",
    frequency: rx.frequency != null ? String(rx.frequency) : "",
    frequencyUnit: rx.frequencyUnit ?? "per day",
    quantityNumber: rx.quantityNumber ?? "",
    quantityForm: rx.quantityForm ?? "",
    route: rx.route ?? "",
    notes: rx.notes ?? "",
    isPrescribed: rx.isPrescribed,
  };
}

export function PrescriptionFormModal({ visit, rx, open, onClose }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const visitId = visit.patientVisitId;
  const initial = useMemo(() => blankForm(rx), [rx]);
  const [form, setForm] = useState<FormState>(initial);
  const [serverError, setServerError] = useState<string | null>(null);
  const rules = useFieldRules("prescription");

  useEffect(() => {
    if (!open) return;
    setForm(rx ? initial : applyDefaults(blankForm(null), rules.defaults));
    setServerError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rx, initial]);

  const ruleEnforces = (field: string, value: string): boolean =>
    rules.isHidden(field) || !rules.isRequired(field) || value.trim().length > 0;

  const canSubmit =
    form.medicine != null &&
    ruleEnforces("indication", form.indication) &&
    ruleEnforces("dose", form.dose) &&
    ruleEnforces("route", form.route) &&
    ruleEnforces("frequency", form.frequency) &&
    ruleEnforces("frequencyUnit", form.frequencyUnit) &&
    ruleEnforces("period", form.period) &&
    ruleEnforces("quantityNumber", form.quantityNumber) &&
    ruleEnforces("quantityForm", form.quantityForm) &&
    ruleEnforces("notes", form.notes);

  const mode: "add" | "edit" = rx ? "edit" : "add";

  const mutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!form.medicine) throw new Error("Choose a medicine first.");
      if (mode === "add") {
        const payload: CreatePrescriptionPayload = {
          medicineId: form.medicine.medicineId,
          pvAssessmentConditionId: nonEmpty(form.pvAssessmentConditionId),
          indication: nonEmpty(form.indication),
          dose: nonEmpty(form.dose),
          period: nonEmpty(form.period),
          frequency: parseFreq(form.frequency),
          frequencyUnit: nonEmpty(form.frequencyUnit),
          quantityNumber: nonEmpty(form.quantityNumber),
          quantityForm: nonEmpty(form.quantityForm),
          route: nonEmpty(form.route),
          notes: nonEmpty(form.notes),
          isPrescribed: form.isPrescribed,
        };
        await createPrescription(visitId, payload);
        return;
      }
      const patch: UpdatePrescriptionPayload = {};
      if (rx && form.medicine.medicineId !== rx.medicineId) patch.medicineId = form.medicine.medicineId;
      diffString(patch, "indication", form.indication, rx?.indication ?? null);
      diffString(patch, "dose", form.dose, rx?.dose ?? null);
      diffString(patch, "period", form.period, rx?.period ?? null);
      const freq = parseFreq(form.frequency);
      if (freq !== (rx?.frequency ?? null)) patch.frequency = freq;
      diffString(patch, "frequencyUnit", form.frequencyUnit, rx?.frequencyUnit ?? null);
      diffString(patch, "quantityNumber", form.quantityNumber, rx?.quantityNumber ?? null);
      diffString(patch, "quantityForm", form.quantityForm, rx?.quantityForm ?? null);
      diffString(patch, "route", form.route, rx?.route ?? null);
      diffString(patch, "notes", form.notes, rx?.notes ?? null);
      if (form.isPrescribed !== rx?.isPrescribed) patch.isPrescribed = form.isPrescribed;

      if (Object.keys(patch).length === 0) return;
      if (!rx) return;
      await updatePrescription(visitId, rx.pvPlanMedicationId, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visits", "detail", visitId] });
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : (err as Error).message || "Failed to save");
    },
  });

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    setServerError(null);
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      title={mode === "add" ? "Add prescription" : "Edit prescription"}
      description={`${visit.patient.fullName || "—"}`}
      size="lg"
      initialFocusId="rx-medicine"
      dismissOnOverlay={!mutation.isPending}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="rounded-[10px] border border-rule bg-card px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:border-rule-2 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="rx-form"
            disabled={mutation.isPending || !canSubmit}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {mutation.isPending ? "Saving…" : mode === "add" ? "Add" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="rx-form" onSubmit={onSubmit} className="space-y-4">
        {serverError && (
          <div role="alert" className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
            {serverError}
          </div>
        )}

        {(() => {
          const f = rules.field("medicineId", "Medicine");
          return f.hidden ? null : (
            <MedicineCombobox
              id={f.id || "rx-medicine"}
              label={f.label}
              required
              disabled={f.readOnly}
              value={form.medicine}
              onChange={(m) => setForm((s) => ({ ...s, medicine: m }))}
            />
          );
        })()}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(() => {
            const f = rules.field("dose", "Dose");
            return f.hidden ? null : (
              <TextInput
                id={f.id}
                label={f.label}
                required={f.required}
                readOnly={f.readOnly}
                value={form.dose}
                placeholder="e.g. 10 mg"
                mono
                onChange={(v) => setForm((s) => ({ ...s, dose: v }))}
              />
            );
          })()}
          {(() => {
            const f = rules.field("route", "Route");
            return f.hidden ? null : (
              <SelectFreeText
                id={f.id}
                label={f.label}
                required={f.required}
                readOnly={f.readOnly}
                value={form.route}
                options={ROUTES}
                onChange={(v) => setForm((s) => ({ ...s, route: v }))}
              />
            );
          })()}
          {(() => {
            const f = rules.field("frequency", "Frequency");
            return f.hidden ? null : (
              <TextInput
                id={f.id}
                label={f.label}
                required={f.required}
                readOnly={f.readOnly}
                value={form.frequency}
                placeholder="e.g. 2"
                mono
                onChange={(v) => setForm((s) => ({ ...s, frequency: v }))}
              />
            );
          })()}
          {(() => {
            const f = rules.field("frequencyUnit", "Frequency unit");
            return f.hidden ? null : (
              <SelectFreeText
                id={f.id}
                label={f.label}
                required={f.required}
                readOnly={f.readOnly}
                value={form.frequencyUnit}
                options={FREQ_UNITS}
                onChange={(v) => setForm((s) => ({ ...s, frequencyUnit: v }))}
              />
            );
          })()}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(() => {
            const f = rules.field("period", "Period");
            return f.hidden ? null : (
              <TextInput
                id={f.id}
                label={f.label}
                required={f.required}
                readOnly={f.readOnly}
                value={form.period}
                placeholder="e.g. 30 days"
                onChange={(v) => setForm((s) => ({ ...s, period: v }))}
              />
            );
          })()}
          {(() => {
            const f = rules.field("quantityNumber", "Quantity");
            return f.hidden ? null : (
              <TextInput
                id={f.id}
                label={f.label}
                required={f.required}
                readOnly={f.readOnly}
                value={form.quantityNumber}
                placeholder="e.g. 30"
                mono
                onChange={(v) => setForm((s) => ({ ...s, quantityNumber: v }))}
              />
            );
          })()}
          {(() => {
            const f = rules.field("quantityForm", "Form");
            return f.hidden ? null : (
              <SelectFreeText
                id={f.id}
                label={f.label}
                required={f.required}
                readOnly={f.readOnly}
                value={form.quantityForm}
                options={QTY_FORMS}
                onChange={(v) => setForm((s) => ({ ...s, quantityForm: v }))}
              />
            );
          })()}
        </div>

        {(() => {
          const f = rules.field("indication", "Indication");
          return f.hidden ? null : (
            <Textarea
              id={f.id}
              label={f.label}
              required={f.required}
              readOnly={f.readOnly}
              value={form.indication}
              placeholder="What is this prescribed for?"
              onChange={(v) => setForm((s) => ({ ...s, indication: v }))}
            />
          );
        })()}

        {(() => {
          const f = rules.field("notes", "Notes");
          return f.hidden ? null : (
            <Textarea
              id={f.id}
              label={f.label}
              required={f.required}
              readOnly={f.readOnly}
              value={form.notes}
              onChange={(v) => setForm((s) => ({ ...s, notes: v }))}
            />
          );
        })()}

        <label className="inline-flex items-center gap-2 text-[13.5px] text-ink-2">
          <input
            type="checkbox"
            checked={form.isPrescribed}
            onChange={(e) => setForm((f) => ({ ...f, isPrescribed: e.target.checked }))}
            className="size-4 rounded border-rule text-primary focus:ring-2 focus:ring-primary-100"
          />
          <span>
            Prescribed
            <span className="ms-1 text-[12px] text-ink-3">
              (uncheck to mark as a suggestion only)
            </span>
          </span>
        </label>
      </form>
    </Modal>
  );
}

// ---- helpers ----

function parseFreq(s: string): number | null {
  const t = s.trim();
  if (t.length === 0) return null;
  const n = Number(t);
  return Number.isNaN(n) ? null : n;
}

function diffString(
  out: UpdatePrescriptionPayload,
  key:
    | "indication"
    | "dose"
    | "period"
    | "frequencyUnit"
    | "quantityNumber"
    | "quantityForm"
    | "route"
    | "notes",
  next: string,
  prev: string | null,
): void {
  const n = nonEmpty(next);
  if (n !== prev) out[key] = n;
}

