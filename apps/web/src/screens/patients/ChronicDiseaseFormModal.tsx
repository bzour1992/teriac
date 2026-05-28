import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { ConditionCombobox } from "../../components/ConditionCombobox";
import { SearchableSelect } from "../../components/SearchableSelect";
import { ApiError } from "../../lib/api/client";
import { useFieldRules } from "../../lib/field-rules";
import { FieldLabel, TextInput, Textarea, applyDefaults, nonEmpty } from "../../lib/form-primitives";
import type { MedicalConditionSuggestion } from "../../lib/coding/api";
import {
  createChronicDisease,
  updateChronicDisease,
  type ChronicDiseaseListItem,
  type CreateChronicDiseasePayload,
  type UpdateChronicDiseasePayload,
} from "./history-api";

const MONTHS = [
  { v: 1, label: "Jan" },
  { v: 2, label: "Feb" },
  { v: 3, label: "Mar" },
  { v: 4, label: "Apr" },
  { v: 5, label: "May" },
  { v: 6, label: "Jun" },
  { v: 7, label: "Jul" },
  { v: 8, label: "Aug" },
  { v: 9, label: "Sep" },
  { v: 10, label: "Oct" },
  { v: 11, label: "Nov" },
  { v: 12, label: "Dec" },
];

interface Props {
  patientId: string;
  item: ChronicDiseaseListItem | null;
  open: boolean;
  onClose: () => void;
}

interface FormState {
  condition: MedicalConditionSuggestion | null;
  yearDiagnosed: string;
  monthDiagnosed: number | "";
  notes: string;
}

function blankForm(c: ChronicDiseaseListItem | null): FormState {
  if (!c) {
    return {
      condition: null,
      yearDiagnosed: "",
      monthDiagnosed: "",
      notes: "",
    };
  }
  return {
    condition: {
      medicalConditionId: c.medicalConditionId,
      name: c.conditionName,
      category: null,
      isChronic: true,
      isAllergy: false,
      isHereditary: false,
      isVerified: true,
    },
    yearDiagnosed: c.yearDiagnosed != null ? String(c.yearDiagnosed) : "",
    monthDiagnosed: c.monthDiagnosed ?? "",
    notes: c.notes ?? "",
  };
}

export function ChronicDiseaseFormModal({ patientId, item, open, onClose }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const initial = useMemo(() => blankForm(item), [item]);
  const [form, setForm] = useState<FormState>(initial);
  const [serverError, setServerError] = useState<string | null>(null);
  const rules = useFieldRules("chronic_disease");

  useEffect(() => {
    if (!open) return;
    setForm(item ? initial : applyDefaults(blankForm(null), rules.defaults));
    setServerError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item, initial]);

  const ruleEnforces = (field: string, value: string): boolean =>
    rules.isHidden(field) || !rules.isRequired(field) || value.trim().length > 0;

  const canSubmit =
    form.condition != null &&
    ruleEnforces("yearDiagnosed", form.yearDiagnosed) &&
    ruleEnforces("monthDiagnosed", String(form.monthDiagnosed || "")) &&
    ruleEnforces("notes", form.notes);

  const mode: "add" | "edit" = item ? "edit" : "add";

  const mutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!form.condition) throw new Error("Choose a condition first.");
      const y = parseYear(form.yearDiagnosed);
      if (mode === "add") {
        const payload: CreateChronicDiseasePayload = {
          medicalConditionId: form.condition.medicalConditionId,
          yearDiagnosed: y,
          monthDiagnosed: (form.monthDiagnosed || null) as number | null,
          notes: nonEmpty(form.notes),
        };
        await createChronicDisease(patientId, payload);
        return;
      }
      if (!item) return;
      const patch: UpdateChronicDiseasePayload = {};
      if (form.condition.medicalConditionId !== item.medicalConditionId) {
        patch.medicalConditionId = form.condition.medicalConditionId;
      }
      if (y !== (item.yearDiagnosed ?? null)) patch.yearDiagnosed = y;
      const nextMonth = (form.monthDiagnosed || null) as number | null;
      if (nextMonth !== (item.monthDiagnosed ?? null)) patch.monthDiagnosed = nextMonth;
      const nextNotes = nonEmpty(form.notes);
      if (nextNotes !== (item.notes ?? null)) patch.notes = nextNotes;
      if (Object.keys(patch).length === 0) return;
      await updateChronicDisease(patientId, item.chronicDiseaseId, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", "chronic", patientId] });
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
      title={mode === "add" ? "Add chronic disease" : "Edit chronic disease"}
      size="lg"
      initialFocusId="chronic-condition"
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
            form="chronic-form"
            disabled={mutation.isPending || !canSubmit}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {mutation.isPending ? "Saving…" : mode === "add" ? "Add" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="chronic-form" onSubmit={onSubmit} className="space-y-4">
        {serverError && (
          <div role="alert" className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
            {serverError}
          </div>
        )}

        {(() => {
          const f = rules.field("medicalConditionId", "Condition");
          return f.hidden ? null : (
            <ConditionCombobox
              id={f.id || "chronic-condition"}
              label={f.label}
              required
              disabled={f.readOnly}
              category="chronic"
              value={form.condition}
              onChange={(c) => setForm((s) => ({ ...s, condition: c }))}
            />
          );
        })()}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(() => {
            const f = rules.field("yearDiagnosed", "Year diagnosed");
            return f.hidden ? null : (
              <TextInput
                id={f.id}
                label={f.label}
                required={f.required}
                readOnly={f.readOnly}
                type="number"
                inputMode="numeric"
                mono
                min={1900}
                max={2100}
                placeholder="2015"
                value={form.yearDiagnosed}
                onChange={(v) => setForm((s) => ({ ...s, yearDiagnosed: v }))}
              />
            );
          })()}
          {(() => {
            const f = rules.field("monthDiagnosed", "Month");
            return f.hidden ? null : (
              <div>
                <FieldLabel htmlFor={f.id} required={f.required}>
                  {f.label}
                </FieldLabel>
                <SearchableSelect
                  id={f.id}
                  value={form.monthDiagnosed}
                  onChange={(v) =>
                    setForm((s) => ({
                      ...s,
                      monthDiagnosed: v === "" ? "" : Number(v),
                    }))
                  }
                  emptyLabel="—"
                  disabled={f.readOnly}
                  options={MONTHS.map((m) => ({ value: m.v, label: m.label }))}
                />
              </div>
            );
          })()}
        </div>

        {(() => {
          const f = rules.field("notes", "Notes");
          return f.hidden ? null : (
            <Textarea
              id={f.id}
              label={f.label}
              required={f.required}
              readOnly={f.readOnly}
              rows={3}
              value={form.notes}
              onChange={(v) => setForm((s) => ({ ...s, notes: v }))}
            />
          );
        })()}
      </form>
    </Modal>
  );
}

function parseYear(s: string): number | null {
  const t = s.trim();
  if (t.length === 0) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  if (n < 1900 || n > 2100) return null;
  return Math.trunc(n);
}
