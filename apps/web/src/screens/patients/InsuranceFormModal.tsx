import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { Section, TextInput, Textarea, applyDefaults } from "../../lib/form-primitives";
import { ApiError } from "../../lib/api/client";
import { useFieldRules } from "../../lib/field-rules";
import { createInsurance, updateInsurance, type InsuranceItem } from "./api";

interface Props {
  open: boolean;
  patientId: string;
  /** null → add mode; non-null → edit mode */
  item: InsuranceItem | null;
  onClose: () => void;
}

interface FormState {
  insuranceCompany: string;
  insuranceLevel: string;
  coveragePercentage: string;
  insuranceCardNumber: string;
  participantName: string;
  participantCompany: string;
  relationToParticipant: string;
  notes: string;
  isActive: boolean;
}

function blank(item: InsuranceItem | null): FormState {
  return {
    insuranceCompany: item?.insuranceCompany ?? "",
    insuranceLevel: item?.insuranceLevel ?? "",
    coveragePercentage:
      item?.coveragePercentage != null ? String(item.coveragePercentage) : "",
    insuranceCardNumber: item?.insuranceCardNumber ?? "",
    participantName: item?.participantName ?? "",
    participantCompany: item?.participantCompany ?? "",
    relationToParticipant: item?.relationToParticipant ?? "",
    notes: item?.notes ?? "",
    isActive: item?.isActive ?? true,
  };
}

export function InsuranceFormModal({
  open,
  patientId,
  item,
  onClose,
}: Props): JSX.Element {
  const isEdit = item !== null;
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => blank(item));
  const [serverError, setServerError] = useState<string | null>(null);
  const rules = useFieldRules("insurance");

  useEffect(() => {
    if (!open) return;
    setForm(item ? blank(item) : applyDefaults(blank(null), rules.defaults));
    setServerError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item]);

  const ruleEnforces = (field: string, value: string): boolean =>
    rules.isHidden(field) || !rules.isRequired(field) || value.trim().length > 0;

  // insuranceCompany is the natural system-required identifier for a policy;
  // the rest follow rule-driven required flags.
  const canSubmit =
    form.insuranceCompany.trim().length > 0 &&
    ruleEnforces("insuranceLevel", form.insuranceLevel) &&
    ruleEnforces("coveragePercentage", form.coveragePercentage) &&
    ruleEnforces("insuranceCardNumber", form.insuranceCardNumber) &&
    ruleEnforces("participantName", form.participantName) &&
    ruleEnforces("participantCompany", form.participantCompany) &&
    ruleEnforces("relationToParticipant", form.relationToParticipant) &&
    ruleEnforces("notes", form.notes);

  const mutation = useMutation({
    mutationFn: async () => {
      const coverage = form.coveragePercentage.trim();
      const payload = {
        insuranceCompany: form.insuranceCompany.trim(),
        insuranceLevel: form.insuranceLevel.trim() || null,
        coveragePercentage: coverage ? Number(coverage) : null,
        insuranceCardNumber: form.insuranceCardNumber.trim() || null,
        participantName: form.participantName.trim() || null,
        participantCompany: form.participantCompany.trim() || null,
        relationToParticipant: form.relationToParticipant.trim() || null,
        notes: form.notes.trim() || null,
        isActive: form.isActive,
      };
      if (isEdit) {
        await updateInsurance(patientId, item.patientInsuranceDetailId, payload);
      } else {
        await createInsurance(patientId, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["patients", "insurance", patientId],
      });
      queryClient.invalidateQueries({
        queryKey: ["patients", "detail", patientId],
      });
      onClose();
    },
    onError: (err) => {
      setServerError(
        err instanceof ApiError ? err.message : (err as Error).message || "Failed to save",
      );
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.insuranceCompany.trim()) return;
    setServerError(null);
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      title={isEdit ? "Edit insurance" : "Add insurance"}
      description={isEdit ? item.insuranceCompany : undefined}
      size="lg"
      initialFocusId="ins-company"
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
            form="insurance-form"
            disabled={mutation.isPending || !canSubmit}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Add insurance"}
          </button>
        </>
      }
    >
      <form id="insurance-form" onSubmit={onSubmit} className="space-y-5">
        {serverError && (
          <div
            role="alert"
            className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg"
          >
            {serverError}
          </div>
        )}

        <Section title="Policy details">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextInput
              id="ins-company"
              label="Insurance company"
              value={form.insuranceCompany}
              onChange={(v) => setForm((f) => ({ ...f, insuranceCompany: v }))}
              required
              placeholder="e.g. Blue Shield"
            />
            {(() => {
              const f = rules.field("insuranceLevel", "Plan level");
              return f.hidden ? null : (
                <TextInput
                  id={f.id}
                  label={f.label}
                  required={f.required}
                  readOnly={f.readOnly}
                  value={form.insuranceLevel}
                  onChange={(v) => setForm((s) => ({ ...s, insuranceLevel: v }))}
                  placeholder="e.g. Premium, Basic"
                />
              );
            })()}
            {(() => {
              const f = rules.field("coveragePercentage", "Coverage %");
              return f.hidden ? null : (
                <TextInput
                  id={f.id}
                  label={f.label}
                  required={f.required}
                  readOnly={f.readOnly}
                  value={form.coveragePercentage}
                  onChange={(v) => setForm((s) => ({ ...s, coveragePercentage: v }))}
                  mono
                  placeholder="e.g. 80"
                  type="number"
                />
              );
            })()}
            {(() => {
              const f = rules.field("insuranceCardNumber", "Card number");
              return f.hidden ? null : (
                <TextInput
                  id={f.id}
                  label={f.label}
                  required={f.required}
                  readOnly={f.readOnly}
                  value={form.insuranceCardNumber}
                  onChange={(v) => setForm((s) => ({ ...s, insuranceCardNumber: v }))}
                  mono
                  placeholder="e.g. INS-1234567"
                />
              );
            })()}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              id="ins-active"
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                setForm((f) => ({ ...f, isActive: e.target.checked }))
              }
              className="h-4 w-4 rounded border-rule accent-primary"
            />
            <label htmlFor="ins-active" className="text-[13.5px] text-ink-2">
              Active policy
            </label>
          </div>
        </Section>

        {(["participantName", "participantCompany", "relationToParticipant"] as const).some(
          (n) => !rules.isHidden(n),
        ) && (
          <Section title="Participant (if patient is a dependent)">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(() => {
                const f = rules.field("participantName", "Participant name");
                return f.hidden ? null : (
                  <TextInput
                    id={f.id}
                    label={f.label}
                    required={f.required}
                    readOnly={f.readOnly}
                    value={form.participantName}
                    onChange={(v) => setForm((s) => ({ ...s, participantName: v }))}
                  />
                );
              })()}
              {(() => {
                const f = rules.field("participantCompany", "Participant company");
                return f.hidden ? null : (
                  <TextInput
                    id={f.id}
                    label={f.label}
                    required={f.required}
                    readOnly={f.readOnly}
                    value={form.participantCompany}
                    onChange={(v) => setForm((s) => ({ ...s, participantCompany: v }))}
                  />
                );
              })()}
              {(() => {
                const f = rules.field("relationToParticipant", "Relation");
                return f.hidden ? null : (
                  <TextInput
                    id={f.id}
                    label={f.label}
                    required={f.required}
                    readOnly={f.readOnly}
                    value={form.relationToParticipant}
                    onChange={(v) => setForm((s) => ({ ...s, relationToParticipant: v }))}
                    placeholder="e.g. Spouse, Child"
                  />
                );
              })()}
            </div>
          </Section>
        )}

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
              rows={2}
              placeholder="Any additional coverage notes…"
            />
          );
        })()}
      </form>
    </Modal>
  );
}
