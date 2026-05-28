import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { ApiError } from "../../lib/api/client";
import { useFieldRules } from "../../lib/field-rules";
import { Textarea } from "../../lib/form-primitives";
import { toDisplayText, isRtf } from "../../lib/rtf";
import { updateVisit, type VisitDetail, type UpdateVisitPayload } from "./api";

/**
 * Focused quick-edit modal for the Subjective section. Lets clinicians update
 * Chief complaint / HPI / PMH without opening the heavy full Edit Visit modal.
 *
 * Only writes the fields that actually changed. Reads & writes go through the
 * same field-rule layer as the rest of the visit forms, so hidden fields don't
 * appear here either.
 */
interface Props {
  visit: VisitDetail;
  open: boolean;
  onClose: () => void;
}

interface FormState {
  chiefComplaint: string;
  historyOfPresentIllness: string;
  pastMedicalHistory: string;
}

const blank = (v: VisitDetail): FormState => ({
  chiefComplaint: toDisplayText(v.chiefComplaint),
  historyOfPresentIllness: toDisplayText(v.historyOfPresentIllness),
  pastMedicalHistory: toDisplayText(v.pastMedicalHistory),
});

export function EditSubjectiveModal({ visit, open, onClose }: Props): JSX.Element {
  const qc = useQueryClient();
  const rules = useFieldRules("visit");
  const [form, setForm] = useState<FormState>(() => blank(visit));
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(blank(visit));
    setServerError(null);
  }, [open, visit]);

  // Only fields the rule editor hasn't hidden are eligible for save-blocking.
  const ruleEnforces = (field: string, value: string): boolean =>
    rules.isHidden(field) || !rules.isRequired(field) || value.trim().length > 0;

  const canSubmit =
    ruleEnforces("chiefComplaint", form.chiefComplaint) &&
    ruleEnforces("historyOfPresentIllness", form.historyOfPresentIllness) &&
    ruleEnforces("pastMedicalHistory", form.pastMedicalHistory);

  // Build a minimal PATCH containing only the fields the user actually
  // changed — preserves stored RTF for unchanged fields by NOT shipping them.
  const buildPatch = (): UpdateVisitPayload | null => {
    const patch: UpdateVisitPayload = {};
    const cmp = (
      key: keyof FormState,
      stored: string | null,
    ): void => {
      const next = form[key].trim();
      // If the stored value is RTF, comparing to plain text would always
      // "differ" — but in that case the user opened the field and likely
      // intends to convert it. Only skip when the stripped versions match.
      const storedPlain = toDisplayText(stored).trim();
      if (next === storedPlain) return;
      patch[key] =
        next.length === 0
          ? null
          : isRtf(stored) || stored?.includes("\\rtf")
            ? next
            : next;
    };
    cmp("chiefComplaint", visit.chiefComplaint);
    cmp("historyOfPresentIllness", visit.historyOfPresentIllness);
    cmp("pastMedicalHistory", visit.pastMedicalHistory);
    return Object.keys(patch).length === 0 ? null : patch;
  };

  const mutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const patch = buildPatch();
      if (!patch) {
        onClose();
        return;
      }
      const fresh = await updateVisit(visit.patientVisitId, patch);
      qc.setQueryData(["visits", "detail", visit.patientVisitId], fresh);
      qc.invalidateQueries({ queryKey: ["patients", "detail", fresh.patient.patientId] });
    },
    onSuccess: () => {
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

  // If all three fields are rule-hidden, this modal would render an empty
  // form — bail out so we don't open at all.
  const anyVisible =
    !rules.isHidden("chiefComplaint") ||
    !rules.isHidden("historyOfPresentIllness") ||
    !rules.isHidden("pastMedicalHistory");

  return (
    <Modal
      open={open && anyVisible}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      title="Chief complaint & HPI"
      size="lg"
      initialFocusId="cc-field"
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
            form="edit-subjective-form"
            disabled={mutation.isPending || !canSubmit}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {mutation.isPending ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form id="edit-subjective-form" onSubmit={onSubmit} className="space-y-4">
        {serverError && (
          <div role="alert" className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
            {serverError}
          </div>
        )}

        {!rules.isHidden("chiefComplaint") && (
          <Textarea
            id="cc-field"
            label={rules.label("chiefComplaint", "Chief complaint")}
            required={rules.isRequired("chiefComplaint")}
            readOnly={rules.isReadonly("chiefComplaint")}
            rows={2}
            placeholder="What brought the patient in today?"
            value={form.chiefComplaint}
            onChange={(v) => setForm((s) => ({ ...s, chiefComplaint: v }))}
          />
        )}

        {!rules.isHidden("historyOfPresentIllness") && (
          <Textarea
            label={rules.label("historyOfPresentIllness", "History of present illness")}
            required={rules.isRequired("historyOfPresentIllness")}
            readOnly={rules.isReadonly("historyOfPresentIllness")}
            rows={5}
            placeholder="Onset, character, duration, severity, modifying factors…"
            value={form.historyOfPresentIllness}
            onChange={(v) => setForm((s) => ({ ...s, historyOfPresentIllness: v }))}
          />
        )}

        {!rules.isHidden("pastMedicalHistory") && (
          <Textarea
            label={rules.label("pastMedicalHistory", "Past medical history")}
            required={rules.isRequired("pastMedicalHistory")}
            readOnly={rules.isReadonly("pastMedicalHistory")}
            rows={4}
            placeholder="Relevant prior conditions, surgeries, hospitalizations…"
            value={form.pastMedicalHistory}
            onChange={(v) => setForm((s) => ({ ...s, pastMedicalHistory: v }))}
          />
        )}
      </form>
    </Modal>
  );
}
