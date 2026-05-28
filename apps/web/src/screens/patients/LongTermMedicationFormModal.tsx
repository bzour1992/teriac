import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { MedicineCombobox } from "../../components/MedicineCombobox";
import { ApiError } from "../../lib/api/client";
import { useFieldRules } from "../../lib/field-rules";
import { TextInput, Textarea, SelectFreeText, applyDefaults, nonEmpty, toDateInput } from "../../lib/form-primitives";
import type { MedicineSuggestion } from "../../lib/coding/api";
import {
  createLongTermMedication,
  updateLongTermMedication,
  type CreateLongTermMedicationPayload,
  type LongTermMedicationListItem,
  type UpdateLongTermMedicationPayload,
} from "./history-api";

const ROUTES = ["PO", "ORL", "IM", "IV", "SC", "Topical", "Inhaled", "PR"];
const FREQ_UNITS = ["per day", "per week", "per month", "every 4h", "every 6h", "every 8h", "every 12h"];
const QTY_FORMS = ["tablet", "capsule", "mL", "drop", "puff", "patch", "vial"];

interface Props {
  patientId: string;
  item: LongTermMedicationListItem | null;
  open: boolean;
  onClose: () => void;
}

interface FormState {
  medicine: MedicineSuggestion | null;
  indication: string;
  dose: string;
  route: string;
  frequency: string;
  frequencyUnit: string;
  period: string;
  quantityNumber: string;
  quantityForm: string;
  prescribedBy: string;
  prescriptionDate: string;
  notes: string;
}

function blankForm(m: LongTermMedicationListItem | null): FormState {
  if (!m) {
    return {
      medicine: null,
      indication: "",
      dose: "",
      route: "",
      frequency: "",
      frequencyUnit: "per day",
      period: "",
      quantityNumber: "",
      quantityForm: "",
      prescribedBy: "",
      prescriptionDate: "",
      notes: "",
    };
  }
  return {
    medicine: {
      medicineId: m.medicineId,
      tradeName: m.medicineName,
      scientificName: m.scientificName,
      countryCode: null,
    },
    indication: m.indication ?? "",
    dose: m.dose ?? "",
    route: m.route ?? "",
    frequency: m.frequency != null ? String(m.frequency) : "",
    frequencyUnit: m.frequencyUnit ?? "per day",
    period: m.period ?? "",
    quantityNumber: m.quantityNumber ?? "",
    quantityForm: m.quantityForm ?? "",
    prescribedBy: m.prescribedBy ?? "",
    prescriptionDate: m.prescriptionDate ? toDateInput(m.prescriptionDate) : "",
    notes: m.notes ?? "",
  };
}

export function LongTermMedicationFormModal({ patientId, item, open, onClose }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const initial = useMemo(() => blankForm(item), [item]);
  const [form, setForm] = useState<FormState>(initial);
  const [serverError, setServerError] = useState<string | null>(null);
  const rules = useFieldRules("long_term_medication");

  useEffect(() => {
    if (!open) return;
    setForm(item ? initial : applyDefaults(blankForm(null), rules.defaults));
    setServerError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item, initial]);

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
    ruleEnforces("prescribedBy", form.prescribedBy) &&
    ruleEnforces("prescriptionDate", form.prescriptionDate) &&
    ruleEnforces("notes", form.notes);

  const mode: "add" | "edit" = item ? "edit" : "add";

  const mutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!form.medicine) throw new Error("Choose a medicine first.");
      if (mode === "add") {
        const payload: CreateLongTermMedicationPayload = {
          medicineId: form.medicine.medicineId,
          indication: nonEmpty(form.indication),
          dose: nonEmpty(form.dose),
          period: nonEmpty(form.period),
          frequency: parseFreq(form.frequency),
          frequencyUnit: nonEmpty(form.frequencyUnit),
          quantityNumber: nonEmpty(form.quantityNumber),
          quantityForm: nonEmpty(form.quantityForm),
          route: nonEmpty(form.route),
          prescribedBy: nonEmpty(form.prescribedBy),
          prescriptionDate: form.prescriptionDate || null,
          notes: nonEmpty(form.notes),
        };
        await createLongTermMedication(patientId, payload);
        return;
      }
      if (!item) return;
      const patch: UpdateLongTermMedicationPayload = {};
      if (form.medicine.medicineId !== item.medicineId) patch.medicineId = form.medicine.medicineId;
      diffString(patch, "indication", form.indication, item.indication ?? null);
      diffString(patch, "dose", form.dose, item.dose ?? null);
      diffString(patch, "period", form.period, item.period ?? null);
      const freq = parseFreq(form.frequency);
      if (freq !== (item.frequency ?? null)) patch.frequency = freq;
      diffString(patch, "frequencyUnit", form.frequencyUnit, item.frequencyUnit ?? null);
      diffString(patch, "quantityNumber", form.quantityNumber, item.quantityNumber ?? null);
      diffString(patch, "quantityForm", form.quantityForm, item.quantityForm ?? null);
      diffString(patch, "route", form.route, item.route ?? null);
      diffString(patch, "prescribedBy", form.prescribedBy, item.prescribedBy ?? null);
      const prevDate = item.prescriptionDate ? toDateInput(item.prescriptionDate) : "";
      if (form.prescriptionDate !== prevDate) {
        patch.prescriptionDate = form.prescriptionDate || null;
      }
      diffString(patch, "notes", form.notes, item.notes ?? null);
      if (Object.keys(patch).length === 0) return;
      await updateLongTermMedication(patientId, item.patientLongTermMedicineId, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", "ltm", patientId] });
      queryClient.invalidateQueries({ queryKey: ["patients", "detail", patientId] });
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
      title={mode === "add" ? "Add long-term medication" : "Edit long-term medication"}
      size="lg"
      initialFocusId="ltm-medicine"
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
            form="ltm-form"
            disabled={mutation.isPending || !canSubmit}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {mutation.isPending ? "Saving…" : mode === "add" ? "Add" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="ltm-form" onSubmit={onSubmit} className="space-y-4">
        {serverError && (
          <div role="alert" className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
            {serverError}
          </div>
        )}

        {(() => {
          const f = rules.field("medicineId", "Medicine");
          return f.hidden ? null : (
            <MedicineCombobox
              id={f.id || "ltm-medicine"}
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
                placeholder="e.g. 6 months"
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(() => {
            const f = rules.field("prescribedBy", "Prescribed by");
            return f.hidden ? null : (
              <TextInput
                id={f.id}
                label={f.label}
                required={f.required}
                readOnly={f.readOnly}
                value={form.prescribedBy}
                placeholder="Dr. name (free text)"
                onChange={(v) => setForm((s) => ({ ...s, prescribedBy: v }))}
              />
            );
          })()}
          {(() => {
            const f = rules.field("prescriptionDate", "Prescription date");
            return f.hidden ? null : (
              <TextInput
                id={f.id}
                label={f.label}
                required={f.required}
                readOnly={f.readOnly}
                type="date"
                mono
                value={form.prescriptionDate}
                onChange={(v) => setForm((s) => ({ ...s, prescriptionDate: v }))}
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
  out: UpdateLongTermMedicationPayload,
  key:
    | "indication"
    | "dose"
    | "period"
    | "frequencyUnit"
    | "quantityNumber"
    | "quantityForm"
    | "route"
    | "prescribedBy"
    | "notes",
  next: string,
  prev: string | null,
): void {
  const n = nonEmpty(next);
  if (n !== prev) out[key] = n;
}

