import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { ConditionCombobox } from "../../components/ConditionCombobox";
import { ApiError } from "../../lib/api/client";
import { useFieldRules } from "../../lib/field-rules";
import type { MedicalConditionSuggestion } from "../../lib/coding/api";
import { TextInput, applyDefaults, nonEmpty } from "../../lib/form-primitives";
import { createFamilyHistory, type CreateFamilyHistoryPayload } from "./history-api";

interface Props {
  open: boolean;
  patientId: string;
  onClose: () => void;
}

interface FormState {
  condition: MedicalConditionSuggestion | null;
  description: string;
}

function blankForm(): FormState {
  return { condition: null, description: "" };
}

export function FamilyHistoryFormModal({ open, patientId, onClose }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const initial = useMemo(() => blankForm(), []);
  const [form, setForm] = useState<FormState>(initial);
  const [serverError, setServerError] = useState<string | null>(null);
  const rules = useFieldRules("family_history");

  useEffect(() => {
    if (!open) return;
    setForm(applyDefaults(blankForm(), rules.defaults));
    setServerError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const ruleEnforces = (field: string, value: string): boolean =>
    rules.isHidden(field) || !rules.isRequired(field) || value.trim().length > 0;

  const canSubmit =
    form.condition != null && ruleEnforces("description", form.description);

  const mutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!form.condition) throw new Error("Choose a condition first.");
      const payload: CreateFamilyHistoryPayload = {
        medicalConditionId: form.condition.medicalConditionId,
        description: nonEmpty(form.description),
      };
      await createFamilyHistory(patientId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", "family-history", patientId] });
      onClose();
    },
    onError: (err) => {
      setServerError(
        err instanceof ApiError ? err.message : (err as Error).message || "Failed to save",
      );
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
      title="Add family history"
      size="md"
      initialFocusId="fh-condition"
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
            form="family-history-form"
            disabled={mutation.isPending || !canSubmit}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {mutation.isPending ? "Saving…" : "Add"}
          </button>
        </>
      }
    >
      <form id="family-history-form" onSubmit={onSubmit} className="space-y-4">
        {serverError && (
          <div role="alert" className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
            {serverError}
          </div>
        )}

        {(() => {
          const f = rules.field("medicalConditionId", "Condition");
          return f.hidden ? null : (
            <ConditionCombobox
              id={f.id || "fh-condition"}
              label={f.label}
              required
              disabled={f.readOnly}
              category="hereditary"
              value={form.condition}
              onChange={(c) => setForm((s) => ({ ...s, condition: c }))}
            />
          );
        })()}

        {(() => {
          const f = rules.field("description", "Which family member");
          return f.hidden ? null : (
            <TextInput
              id={f.id}
              label={f.label}
              required={f.required}
              readOnly={f.readOnly}
              placeholder="e.g. Father, Maternal grandmother"
              value={form.description}
              onChange={(v) => setForm((s) => ({ ...s, description: v }))}
            />
          );
        })()}
      </form>
    </Modal>
  );
}
