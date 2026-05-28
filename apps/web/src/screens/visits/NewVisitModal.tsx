import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Modal } from "../../components/Modal";
import { SearchableSelect } from "../../components/SearchableSelect";
import { ApiError } from "../../lib/api/client";
import { useFieldRules } from "../../lib/field-rules";
import {
  FieldLabel,
  NumberSelect,
  Section,
  TextInput,
  Textarea,
  nonEmpty,
} from "../../lib/form-primitives";
import { PatientCombobox } from "../../components/PatientCombobox";
import type { PatientListItem } from "../patients/api";
import { createVisit, type CreateVisitPayload } from "./api";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pass a known patient to skip the picker. Pass null/undefined to show the PatientCombobox. */
  patient?: { patientId: string; fullName: string } | null;
}

const VISIT_TYPES = [
  { v: 1, label: "New" },
  { v: 2, label: "Follow-up" },
  { v: 3, label: "Emergency" },
  { v: 4, label: "Routine" },
  { v: 5, label: "Walk-in" },
] as const;

const INTENSITIES = [
  { v: 0, label: "—" },
  { v: 1, label: "Low" },
  { v: 2, label: "Moderate" },
  { v: 3, label: "High" },
] as const;

interface FormState {
  visitType: number;
  visitDate: string;
  intensity: number;
  painLevel: string;
  chiefComplaint: string;
  historyOfPresentIllness: string;
}

const todayLocal = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const blankForm = (): FormState => ({
  visitType: 2, // Follow-up is the most common default in practice
  visitDate: todayLocal(),
  intensity: 0,
  painLevel: "0",
  chiefComplaint: "",
  historyOfPresentIllness: "",
});

export function NewVisitModal({ open, onClose, patient }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(blankForm);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pickedPatient, setPickedPatient] = useState<PatientListItem | null>(null);
  const rules = useFieldRules("visit");

  // Rule helper — a field counts toward validation only when visible + required.
  const ruleEnforces = (field: string, value: string): boolean =>
    rules.isHidden(field) || !rules.isRequired(field) || value.trim().length > 0;

  // visitType/intensity always carry a numeric value from the dropdown, so they
  // can't really be "empty" — but if a rule marks them required we still want
  // the principle to apply, so stringify and check.
  const canSubmit =
    ruleEnforces("visitDate", form.visitDate) &&
    ruleEnforces("painLevel", form.painLevel) &&
    ruleEnforces("chiefComplaint", form.chiefComplaint) &&
    ruleEnforces("historyOfPresentIllness", form.historyOfPresentIllness) &&
    ruleEnforces("visitType", String(form.visitType)) &&
    ruleEnforces("intensity", String(form.intensity));

  // The effective patient: prop takes precedence; fall back to picker selection.
  const effectivePatient = patient ?? (pickedPatient
    ? { patientId: pickedPatient.patientId, fullName: pickedPatient.fullName }
    : null);

  // Seed the form on open: blank baseline + per-clinic defaults from the
  // field-rule editor. String fields take their default verbatim; numeric
  // fields (visitType, intensity, painLevel) parse the string default.
  useEffect(() => {
    if (!open) return;
    const next = blankForm();
    for (const [key, value] of Object.entries(rules.defaults)) {
      if (key === "visitType" || key === "intensity") {
        const n = Number(value);
        if (!Number.isNaN(n)) (next as unknown as Record<string, unknown>)[key] = n;
        continue;
      }
      if (key === "painLevel") {
        // FormState stores painLevel as a string for the <input type="number">.
        next.painLevel = value;
        continue;
      }
      if (key in next) {
        (next as unknown as Record<string, unknown>)[key] = value;
      }
    }
    setForm(next);
    setServerError(null);
    setPickedPatient(null);
  }, [open, rules.defaults]);

  const pain = Math.max(0, Math.min(10, Number(form.painLevel) || 0));

  const mutation = useMutation({
    mutationFn: (): Promise<{ patientVisitId: string }> => {
      if (!effectivePatient) throw new Error("No patient selected");
      const payload: CreateVisitPayload = {
        patientId: effectivePatient.patientId,
        visitType: form.visitType,
        visitDate: form.visitDate,
        intensity: form.intensity,
        painLevel: pain,
        chiefComplaint: nonEmpty(form.chiefComplaint),
        historyOfPresentIllness: nonEmpty(form.historyOfPresentIllness),
      };
      return createVisit(payload);
    },
    onSuccess: ({ patientVisitId }) => {
      if (effectivePatient) {
        queryClient.invalidateQueries({ queryKey: ["patients", "detail", effectivePatient.patientId] });
      }
      queryClient.invalidateQueries({ queryKey: ["visits", "list"] });
      onClose();
      navigate(`/visits/${patientVisitId}`);
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
      title="New visit"
      description={effectivePatient?.fullName ?? undefined}
      size="lg"
      initialFocusId={patient ? "visitType" : "new-visit-patient"}
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
            form="new-visit-form"
            disabled={mutation.isPending || !effectivePatient || !canSubmit}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {mutation.isPending ? "Creating…" : "Start visit"}
          </button>
        </>
      }
    >
      <form id="new-visit-form" onSubmit={onSubmit} className="space-y-4">
        {serverError && (
          <div role="alert" className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
            {serverError}
          </div>
        )}

        {/* Patient picker — only shown when no patient was passed as prop */}
        {!patient && (
          <Section title="Patient">
            <PatientCombobox
              id="new-visit-patient"
              label="Patient"
              required
              value={pickedPatient}
              onChange={setPickedPatient}
            />
          </Section>
        )}

        <Section title="Classification">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            {/* visitType is system-required (backend DTO @IsInt + @Min(1)) so it stays. */}
            <div>
              <FieldLabel htmlFor="visitType" required>
                {rules.label("visitType", "Type")}
              </FieldLabel>
              <SearchableSelect
                id="visitType"
                value={form.visitType}
                onChange={(v) => setForm((f) => ({ ...f, visitType: Number(v) }))}
                required
                disabled={rules.isReadonly("visitType")}
                showValue
                options={VISIT_TYPES.map((o) => ({ value: o.v, label: o.label }))}
              />
            </div>
            {(() => {
              const f = rules.field("visitDate", "Date");
              return f.hidden ? null : (
                <TextInput
                  id={f.id}
                  label={f.label}
                  type="date"
                  required
                  readOnly={f.readOnly}
                  value={form.visitDate}
                  mono
                  onChange={(v) => setForm((s) => ({ ...s, visitDate: v }))}
                />
              );
            })()}
            {(() => {
              const f = rules.field("intensity", "Intensity");
              return f.hidden ? null : (
                <div>
                  <FieldLabel htmlFor={f.id} required={f.required}>
                    {f.label}
                  </FieldLabel>
                  <NumberSelect
                    value={form.intensity}
                    options={INTENSITIES}
                    onChange={(v) => setForm((s) => ({ ...s, intensity: v }))}
                    showValue
                  />
                </div>
              );
            })()}
            {(() => {
              const f = rules.field("painLevel", "Pain (0–10)");
              return f.hidden ? null : (
                <TextInput
                  id={f.id}
                  label={f.label}
                  type="number"
                  required={f.required}
                  readOnly={f.readOnly}
                  mono
                  value={form.painLevel}
                  onChange={(v) => setForm((s) => ({ ...s, painLevel: v }))}
                />
              );
            })()}
          </div>
        </Section>

        {(() => {
          const f = rules.field("chiefComplaint", "Chief complaint");
          return f.hidden ? null : (
            <Textarea
              id={f.id}
              label={f.label}
              required={f.required}
              readOnly={f.readOnly}
              value={form.chiefComplaint}
              rows={3}
              placeholder="Why is the patient here today?"
              onChange={(v) => setForm((s) => ({ ...s, chiefComplaint: v }))}
            />
          );
        })()}

        {(() => {
          const f = rules.field("historyOfPresentIllness", "History of present illness");
          return f.hidden ? null : (
            <Textarea
              id={f.id}
              label={f.label}
              required={f.required}
              readOnly={f.readOnly}
              value={form.historyOfPresentIllness}
              rows={4}
              onChange={(v) => setForm((s) => ({ ...s, historyOfPresentIllness: v }))}
            />
          );
        })()}
      </form>
    </Modal>
  );
}
