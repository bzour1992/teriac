import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { SearchableSelect } from "../../components/SearchableSelect";
import { toDisplayText, isRtf } from "../../lib/rtf";
import { useFieldRules } from "../../lib/field-rules";
import { updateVisit, type UpdateVisitPayload, type VisitDetail } from "./api";
import { ApiError } from "../../lib/api/client";

interface Props {
  visit: VisitDetail;
  open: boolean;
  onClose: () => void;
}

interface FormState {
  chiefComplaint: string;
  historyOfPresentIllness: string;
  pastMedicalHistory: string;
  notes: string;
  recommendations: string;
  disposition: string;
  outcome: number;
  intensity: number;
  visitType: number;
  painLevel: number;
  isHospitalCase: boolean;
  hospitalName: string;
  sourceOfReferral: string;
  transferTo: string;
  destinationOfReferral: string;
}

const OUTCOMES: Array<{ v: number; label: string }> = [
  { v: 0, label: "Open" },
  { v: 1, label: "Resolved" },
  { v: 2, label: "Referred" },
  { v: 3, label: "Failed" },
  { v: 4, label: "Cancelled" },
  { v: 5, label: "No show" },
];
const INTENSITIES: Array<{ v: number; label: string }> = [
  { v: 0, label: "—" },
  { v: 1, label: "Low" },
  { v: 2, label: "Moderate" },
  { v: 3, label: "High" },
];
const VISIT_TYPES: Array<{ v: number; label: string }> = [
  { v: 1, label: "New" },
  { v: 2, label: "Follow-up" },
  { v: 3, label: "Emergency" },
  { v: 4, label: "Routine" },
  { v: 5, label: "Walk-in" },
];

export function EditVisitModal({ visit, open, onClose }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const rules = useFieldRules("visit");

  const initial = useMemo<FormState>(
    () => ({
      chiefComplaint: toDisplayText(visit.chiefComplaint),
      historyOfPresentIllness: toDisplayText(visit.historyOfPresentIllness),
      pastMedicalHistory: toDisplayText(visit.pastMedicalHistory),
      notes: toDisplayText(visit.notes),
      recommendations: toDisplayText(visit.recommendations),
      disposition: toDisplayText(visit.disposition),
      outcome: visit.outcome,
      intensity: visit.intensity,
      visitType: visit.visitType,
      painLevel: visit.painLevel,
      isHospitalCase: visit.isHospitalCase,
      hospitalName: visit.hospitalName ?? "",
      sourceOfReferral: visit.sourceOfReferral ?? "",
      transferTo: visit.transferTo ?? "",
      destinationOfReferral: visit.destinationOfReferral ?? "",
    }),
    [visit],
  );

  const [form, setForm] = useState<FormState>(initial);
  const [serverError, setServerError] = useState<string | null>(null);
  const visitId = visit.patientVisitId;

  // Reset form when the modal opens or the visit changes underneath us.
  useEffect(() => {
    setForm(initial);
    setServerError(null);
  }, [initial, open]);

  // A field counts toward submit-blocking only when visible AND marked required
  // by the rule editor. Hidden fields can't be required.
  const ruleEnforces = (field: string, value: string): boolean =>
    rules.isHidden(field) || !rules.isRequired(field) || value.trim().length > 0;

  const canSubmit =
    ruleEnforces("chiefComplaint", form.chiefComplaint) &&
    ruleEnforces("historyOfPresentIllness", form.historyOfPresentIllness) &&
    ruleEnforces("pastMedicalHistory", form.pastMedicalHistory) &&
    ruleEnforces("notes", form.notes) &&
    ruleEnforces("recommendations", form.recommendations) &&
    ruleEnforces("disposition", form.disposition) &&
    ruleEnforces("outcome", String(form.outcome)) &&
    ruleEnforces("intensity", String(form.intensity)) &&
    ruleEnforces("visitType", String(form.visitType)) &&
    ruleEnforces("painLevel", String(form.painLevel)) &&
    // Hospital fields only matter when the encounter is marked as a hospital case.
    (!form.isHospitalCase || ruleEnforces("hospitalName", form.hospitalName)) &&
    ruleEnforces("sourceOfReferral", form.sourceOfReferral) &&
    ruleEnforces("transferTo", form.transferTo) &&
    ruleEnforces("destinationOfReferral", form.destinationOfReferral);

  const mutation = useMutation({
    mutationFn: (payload: UpdateVisitPayload) => updateVisit(visitId, payload),
    onSuccess: (fresh) => {
      queryClient.setQueryData(["visits", "detail", visitId], fresh);
      // Patient detail page caches recent visits — refresh it.
      queryClient.invalidateQueries({ queryKey: ["patients", "detail", fresh.patient.patientId] });
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Failed to save");
    },
  });

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    setServerError(null);
    const payload = diff(initial, form);
    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }
    mutation.mutate(payload);
  };

  const hadRtf =
    isRtf(visit.chiefComplaint) ||
    isRtf(visit.historyOfPresentIllness) ||
    isRtf(visit.notes) ||
    isRtf(visit.recommendations) ||
    isRtf(visit.disposition);

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      title="Edit visit"
      description={`${visit.patient.fullName || "—"} · ${formatDate(visit.visitDate)}`}
      size="xl"
      initialFocusId="visit-chief-complaint"
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
            form="edit-visit-form"
            disabled={mutation.isPending || !canSubmit}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {mutation.isPending ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="edit-visit-form" onSubmit={onSubmit} className="space-y-5">
        {hadRtf && (
          <div className="rounded-[10px] border border-warn-fg/30 bg-warn-bg px-3 py-2 text-[12.5px] text-warn-fg">
            This visit was authored in the legacy app and stored as RTF. Saving here will
            replace it with plain text — formatting will be lost.
          </div>
        )}
        {serverError && (
          <div role="alert" className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
            {serverError}
          </div>
        )}

        {/* Classifications row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(() => {
            const f = rules.field("outcome", "Outcome");
            return f.hidden ? null : (
              <Select
                id={f.id}
                label={f.label}
                required={f.required}
                disabled={f.readOnly}
                value={form.outcome}
                options={OUTCOMES}
                onChange={(v) => setForm((s) => ({ ...s, outcome: v }))}
                showValue
              />
            );
          })()}
          {(() => {
            const f = rules.field("visitType", "Visit type");
            return f.hidden ? null : (
              <Select
                id={f.id}
                label={f.label}
                required
                disabled={f.readOnly}
                value={form.visitType}
                options={VISIT_TYPES}
                onChange={(v) => setForm((s) => ({ ...s, visitType: v }))}
                showValue
              />
            );
          })()}
          {(() => {
            const f = rules.field("intensity", "Intensity");
            return f.hidden ? null : (
              <Select
                id={f.id}
                label={f.label}
                required={f.required}
                disabled={f.readOnly}
                value={form.intensity}
                options={INTENSITIES}
                onChange={(v) => setForm((s) => ({ ...s, intensity: v }))}
                showValue
              />
            );
          })()}
          {(() => {
            const f = rules.field("painLevel", "Pain level (0–10)");
            return f.hidden ? null : (
              <NumberInput
                id={f.id}
                label={f.label}
                required={f.required}
                readOnly={f.readOnly}
                value={form.painLevel}
                min={0}
                max={10}
                onChange={(v) => setForm((s) => ({ ...s, painLevel: v }))}
              />
            );
          })()}
        </div>

        {(["isHospitalCase", "hospitalName"] as const).some((n) => !rules.isHidden(n)) && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr]">
            {(() => {
              const f = rules.field("isHospitalCase", "Hospital case");
              return f.hidden ? null : (
                <CheckboxRow
                  label={f.label}
                  checked={form.isHospitalCase}
                  disabled={f.readOnly}
                  onChange={(v) => setForm((s) => ({ ...s, isHospitalCase: v }))}
                />
              );
            })()}
            {(() => {
              const f = rules.field("hospitalName", "Hospital name");
              return f.hidden ? null : (
                <TextInput
                  id={f.id}
                  label={f.label}
                  required={f.required}
                  value={form.hospitalName}
                  disabled={!form.isHospitalCase || f.readOnly}
                  onChange={(v) => setForm((s) => ({ ...s, hospitalName: v }))}
                />
              );
            })()}
          </div>
        )}

        {/* SOAP textareas — each respects rule visibility, required, read-only, label override */}
        {([
          ["chiefComplaint", "Chief complaint", 3],
          ["historyOfPresentIllness", "History of present illness", 4],
          ["pastMedicalHistory", "Past medical history", 3],
          ["notes", "Notes", 3],
          ["recommendations", "Recommendations", 3],
          ["disposition", "Disposition", 2],
        ] as const).map(([name, fallback, minRows]) => {
          const f = rules.field(name, fallback);
          if (f.hidden) return null;
          return (
            <Textarea
              key={name}
              id={f.id}
              label={f.label}
              required={f.required}
              readOnly={f.readOnly}
              value={form[name]}
              onChange={(v) => setForm((s) => ({ ...s, [name]: v }))}
              minRows={minRows}
            />
          );
        })}

        {/* Referral — section collapses when every field is hidden */}
        {(["sourceOfReferral", "transferTo", "destinationOfReferral"] as const).some(
          (n) => !rules.isHidden(n),
        ) && (
          <fieldset className="rounded-[10px] border border-rule p-4">
            <legend className="px-2 text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
              Referral
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {([
                ["sourceOfReferral", "Source"],
                ["transferTo", "Transferred to"],
                ["destinationOfReferral", "Destination"],
              ] as const).map(([name, fallback]) => {
                const f = rules.field(name, fallback);
                if (f.hidden) return null;
                return (
                  <TextInput
                    key={name}
                    id={f.id}
                    label={f.label}
                    required={f.required}
                    readOnly={f.readOnly}
                    value={form[name]}
                    onChange={(v) => setForm((s) => ({ ...s, [name]: v }))}
                  />
                );
              })}
            </div>
          </fieldset>
        )}
      </form>
    </Modal>
  );
}

// ---- Diff helper ----
function diff(initial: FormState, current: FormState): UpdateVisitPayload {
  const out: UpdateVisitPayload = {};
  const strKeys: Array<keyof Pick<
    FormState,
    | "chiefComplaint"
    | "historyOfPresentIllness"
    | "pastMedicalHistory"
    | "notes"
    | "recommendations"
    | "disposition"
    | "hospitalName"
    | "sourceOfReferral"
    | "transferTo"
    | "destinationOfReferral"
  >> = [
    "chiefComplaint",
    "historyOfPresentIllness",
    "pastMedicalHistory",
    "notes",
    "recommendations",
    "disposition",
    "hospitalName",
    "sourceOfReferral",
    "transferTo",
    "destinationOfReferral",
  ];
  for (const k of strKeys) {
    if (current[k] !== initial[k]) {
      const v = current[k].trim();
      out[k] = v.length === 0 ? null : v;
    }
  }
  if (current.outcome !== initial.outcome) out.outcome = current.outcome;
  if (current.intensity !== initial.intensity) out.intensity = current.intensity;
  if (current.visitType !== initial.visitType) out.visitType = current.visitType;
  if (current.painLevel !== initial.painLevel) out.painLevel = current.painLevel;
  if (current.isHospitalCase !== initial.isHospitalCase) out.isHospitalCase = current.isHospitalCase;
  return out;
}

function formatDate(iso: string): string {
  const d = new Date(iso.includes(" ") ? iso.replace(" ", "T") + "Z" : iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

// ---- Field components ----

function FieldLabel({
  children,
  htmlFor,
  required,
}: {
  children: ReactNode;
  htmlFor?: string;
  required?: boolean;
}): JSX.Element {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-[11.5px] font-medium uppercase tracking-wider text-ink-3"
    >
      {children}
      {required && <span className="ms-0.5 text-alert-fg">*</span>}
    </label>
  );
}

function Textarea({
  id,
  label,
  value,
  onChange,
  minRows = 3,
  required,
  readOnly,
}: {
  id?: string;
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  minRows?: number;
  required?: boolean;
  readOnly?: boolean;
}): JSX.Element {
  return (
    <div>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <textarea
        id={id}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        rows={minRows}
        dir="auto"
        className={`w-full resize-y rounded-[10px] border border-rule bg-card-2 px-3 py-2.5 text-[13.5px] leading-6 outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:bg-card focus:shadow-[0_0_0_3px_var(--primary-100)] ${
          readOnly ? "bg-paper-2 text-ink-3" : ""
        }`}
      />
    </div>
  );
}

function TextInput({
  id,
  label,
  value,
  onChange,
  disabled,
  required,
  readOnly,
}: {
  id?: string;
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  required?: boolean;
  readOnly?: boolean;
}): JSX.Element {
  return (
    <div>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        readOnly={readOnly}
        dir="auto"
        className={`w-full rounded-[10px] border border-rule bg-card px-3 py-2 text-[13.5px] outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)] disabled:bg-paper-2 disabled:text-ink-3 ${
          readOnly ? "bg-paper-2 text-ink-3" : ""
        }`}
      />
    </div>
  );
}

function NumberInput({
  id,
  label,
  value,
  onChange,
  min,
  max,
  required,
  readOnly,
}: {
  id?: string;
  label: ReactNode;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  required?: boolean;
  readOnly?: boolean;
}): JSX.Element {
  return (
    <div>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <input
        id={id}
        type="number"
        value={value}
        readOnly={readOnly}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isNaN(n)) return;
          onChange(Math.max(min, Math.min(max, n)));
        }}
        min={min}
        max={max}
        className={`w-full rounded-[10px] border border-rule bg-card px-3 py-2 font-mono text-[13.5px] tnum outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)] ${
          readOnly ? "bg-paper-2 text-ink-3" : ""
        }`}
      />
    </div>
  );
}

function Select({
  id,
  label,
  value,
  options,
  onChange,
  required,
  disabled,
  showValue,
}: {
  id?: string;
  label: ReactNode;
  value: number;
  options: Array<{ v: number; label: string }>;
  onChange: (v: number) => void;
  required?: boolean;
  disabled?: boolean;
  showValue?: boolean;
}): JSX.Element {
  return (
    <div>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <SearchableSelect
        id={id}
        value={value}
        onChange={(v) => onChange(Number(v))}
        disabled={disabled}
        showValue={showValue}
        options={options.map((o) => ({ value: o.v, label: o.label }))}
      />
    </div>
  );
}

function CheckboxRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}): JSX.Element {
  return (
    <label className="inline-flex h-full items-end gap-2 text-[13.5px] text-ink-2">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mb-2 size-4 rounded border-rule text-primary focus:ring-2 focus:ring-primary-100"
      />
      <span className="mb-2">{label}</span>
    </label>
  );
}
