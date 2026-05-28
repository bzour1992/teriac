import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { ConditionCombobox } from "../../components/ConditionCombobox";
import { SearchableSelect } from "../../components/SearchableSelect";
import { ApiError } from "../../lib/api/client";
import { useFieldRules } from "../../lib/field-rules";
import { FieldLabel, TextInput, Textarea, applyDefaults, nonEmpty, toDateInput } from "../../lib/form-primitives";
import type { MedicalConditionSuggestion } from "../../lib/coding/api";
import {
  createAllergy,
  updateAllergy,
  type AllergyListItem,
  type AllergySeverity,
  type CreateAllergyPayload,
  type UpdateAllergyPayload,
} from "./history-api";

const SEVERITIES: Array<{ v: AllergySeverity; label: string }> = [
  { v: 1, label: "Mild" },
  { v: 2, label: "Moderate" },
  { v: 3, label: "Severe" },
  { v: 4, label: "Anaphylactic" },
];

interface Props {
  patientId: string;
  /** null + open ⇒ add mode. Non-null ⇒ edit. */
  allergy: AllergyListItem | null;
  open: boolean;
  onClose: () => void;
}

interface FormState {
  condition: MedicalConditionSuggestion | null;
  severity: AllergySeverity | "";
  lastOccurenceDate: string;
  reaction: string;
  treatment: string;
}

function blankForm(a: AllergyListItem | null): FormState {
  if (!a) {
    return {
      condition: null,
      severity: 2,
      lastOccurenceDate: "",
      reaction: "",
      treatment: "",
    };
  }
  return {
    condition: {
      medicalConditionId: a.medicalConditionId,
      name: a.conditionName,
      category: null,
      isChronic: false,
      isAllergy: true,
      isHereditary: false,
      isVerified: true,
    },
    severity: (a.severity as AllergySeverity | null) ?? "",
    lastOccurenceDate: a.lastOccurenceDate ? toDateInput(a.lastOccurenceDate) : "",
    reaction: a.reaction ?? "",
    treatment: a.treatment ?? "",
  };
}

export function AllergyFormModal({ patientId, allergy, open, onClose }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const initial = useMemo(() => blankForm(allergy), [allergy]);
  const [form, setForm] = useState<FormState>(initial);
  const [serverError, setServerError] = useState<string | null>(null);
  const rules = useFieldRules("allergy");

  useEffect(() => {
    if (!open) return;
    // Edit mode: take values from the existing record. Add mode: seed defaults
    // from the field-rule editor, falling back to blanks.
    setForm(allergy ? initial : applyDefaults(blankForm(null), rules.defaults));
    setServerError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, allergy, initial]);

  const ruleEnforces = (field: string, value: string): boolean =>
    rules.isHidden(field) || !rules.isRequired(field) || value.trim().length > 0;

  const canSubmit =
    form.condition != null &&
    ruleEnforces("severity", String(form.severity || "")) &&
    ruleEnforces("lastOccurenceDate", form.lastOccurenceDate) &&
    ruleEnforces("reaction", form.reaction) &&
    ruleEnforces("treatment", form.treatment);

  const mode: "add" | "edit" = allergy ? "edit" : "add";

  const mutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!form.condition) throw new Error("Choose an allergen first.");
      if (mode === "add") {
        const payload: CreateAllergyPayload = {
          medicalConditionId: form.condition.medicalConditionId,
          severity: (form.severity || null) as AllergySeverity | null,
          lastOccurenceDate: form.lastOccurenceDate || null,
          reaction: nonEmpty(form.reaction),
          treatment: nonEmpty(form.treatment),
        };
        await createAllergy(patientId, payload);
        return;
      }
      if (!allergy) return;
      const patch: UpdateAllergyPayload = {};
      if (form.condition.medicalConditionId !== allergy.medicalConditionId) {
        patch.medicalConditionId = form.condition.medicalConditionId;
      }
      const nextSev = (form.severity || null) as AllergySeverity | null;
      if (nextSev !== (allergy.severity as AllergySeverity | null)) patch.severity = nextSev;
      const prevDate = allergy.lastOccurenceDate ? toDateInput(allergy.lastOccurenceDate) : "";
      if (form.lastOccurenceDate !== prevDate) {
        patch.lastOccurenceDate = form.lastOccurenceDate || null;
      }
      diffString(patch, "reaction", form.reaction, allergy.reaction ?? null);
      diffString(patch, "treatment", form.treatment, allergy.treatment ?? null);
      if (Object.keys(patch).length === 0) return;
      await updateAllergy(patientId, allergy.allergyId, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", "allergies", patientId] });
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
      title={mode === "add" ? "Add allergy" : "Edit allergy"}
      size="lg"
      initialFocusId="allergy-condition"
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
            form="allergy-form"
            disabled={mutation.isPending || !canSubmit}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {mutation.isPending ? "Saving…" : mode === "add" ? "Add" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="allergy-form" onSubmit={onSubmit} className="space-y-4">
        {serverError && (
          <div role="alert" className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
            {serverError}
          </div>
        )}

        {(() => {
          const f = rules.field("medicalConditionId", "Allergen");
          return f.hidden ? null : (
            <ConditionCombobox
              id={f.id || "allergy-condition"}
              label={f.label}
              required
              disabled={f.readOnly}
              category="allergy"
              value={form.condition}
              onChange={(c) => setForm((s) => ({ ...s, condition: c }))}
            />
          );
        })()}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(() => {
            const f = rules.field("severity", "Severity");
            return f.hidden ? null : (
              <div>
                <FieldLabel htmlFor={f.id} required={f.required}>
                  {f.label}
                </FieldLabel>
                <SearchableSelect
                  id={f.id}
                  value={form.severity}
                  onChange={(v) =>
                    setForm((s) => ({
                      ...s,
                      severity: v === "" ? "" : (Number(v) as AllergySeverity),
                    }))
                  }
                  emptyLabel="—"
                  disabled={f.readOnly}
                  options={SEVERITIES.map((s) => ({ value: s.v, label: s.label }))}
                />
              </div>
            );
          })()}
          {(() => {
            const f = rules.field("lastOccurenceDate", "Last reaction");
            return f.hidden ? null : (
              <TextInput
                id={f.id}
                label={f.label}
                required={f.required}
                readOnly={f.readOnly}
                type="date"
                mono
                value={form.lastOccurenceDate}
                onChange={(v) => setForm((s) => ({ ...s, lastOccurenceDate: v }))}
              />
            );
          })()}
        </div>

        {(() => {
          const f = rules.field("reaction", "Reaction");
          return f.hidden ? null : (
            <TextInput
              id={f.id}
              label={f.label}
              required={f.required}
              readOnly={f.readOnly}
              value={form.reaction}
              onChange={(v) => setForm((s) => ({ ...s, reaction: v }))}
              placeholder="e.g. hives, anaphylaxis, GI upset"
            />
          );
        })()}

        {(() => {
          const f = rules.field("treatment", "Treatment");
          return f.hidden ? null : (
            <Textarea
              id={f.id}
              label={f.label}
              required={f.required}
              readOnly={f.readOnly}
              rows={2}
              value={form.treatment}
              onChange={(v) => setForm((s) => ({ ...s, treatment: v }))}
            />
          );
        })()}
      </form>
    </Modal>
  );
}

function diffString(
  out: UpdateAllergyPayload,
  key: "reaction" | "treatment",
  next: string,
  prev: string | null,
): void {
  const n = nonEmpty(next);
  if (n !== prev) out[key] = n;
}
