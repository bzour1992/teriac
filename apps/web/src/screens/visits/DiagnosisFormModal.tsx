import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { ConditionCombobox } from "../../components/ConditionCombobox";
import { Icd10Combobox } from "../../components/Icd10Combobox";
import { SearchableSelect } from "../../components/SearchableSelect";
import { ApiError } from "../../lib/api/client";
import { useFieldRules } from "../../lib/field-rules";
import { FieldLabel, TextInput, Textarea, applyDefaults, nonEmpty, toDateInput } from "../../lib/form-primitives";
import { resolveIcd10, type Icd10Suggestion, type MedicalConditionSuggestion } from "../../lib/coding/api";
import {
  createDiagnosis,
  updateDiagnosis,
  type CreateDiagnosisPayload,
  type DiagnosisStatus,
  type UpdateDiagnosisPayload,
  type VisitDetail,
  type VisitDiagnosis,
} from "./api";

const STATUS_OPTIONS: DiagnosisStatus[] = ["Active", "Resolved", "Chronic", "Inactive"];

interface Props {
  visit: VisitDetail;
  /** null + open ⇒ add mode. Non-null ⇒ edit. */
  dx: VisitDiagnosis | null;
  open: boolean;
  onClose: () => void;
}

interface FormState {
  condition: MedicalConditionSuggestion | null;
  dateDiagnosed: string;
  ageOfOnset: string;
  conditionStatus: DiagnosisStatus | "";
  comments: string;
}

function blankForm(dx: VisitDiagnosis | null): FormState {
  if (!dx) {
    return {
      condition: null,
      dateDiagnosed: "",
      ageOfOnset: "",
      conditionStatus: "Active",
      comments: "",
    };
  }
  return {
    condition: {
      medicalConditionId: dx.medicalConditionId,
      name: dx.conditionName,
      category: null,
      isChronic: dx.conditionStatus === "Chronic",
      isAllergy: false,
      isHereditary: false,
      isVerified: true,
    },
    dateDiagnosed: dx.dateDiagnosed ? toDateInput(dx.dateDiagnosed) : "",
    ageOfOnset: dx.ageOfOnset ?? "",
    conditionStatus: (dx.conditionStatus as DiagnosisStatus | null) ?? "",
    comments: dx.comments ?? "",
  };
}

export function DiagnosisFormModal({ visit, dx, open, onClose }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const visitId = visit.patientVisitId;
  const initial = useMemo(() => blankForm(dx), [dx]);
  const [form, setForm] = useState<FormState>(initial);
  const [serverError, setServerError] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<"condition" | "icd10">("icd10");
  const [icd10Selection, setIcd10Selection] = useState<Icd10Suggestion | null>(null);
  const [resolving, setResolving] = useState(false);
  const rules = useFieldRules("diagnosis");

  useEffect(() => {
    if (!open) return;
    setForm(dx ? initial : applyDefaults(blankForm(null), rules.defaults));
    setServerError(null);
    setIcd10Selection(null);
    // Keep last used mode so doctors don't have to re-switch each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dx, initial]);

  const ruleEnforces = (field: string, value: string): boolean =>
    rules.isHidden(field) || !rules.isRequired(field) || value.trim().length > 0;

  const canSubmit =
    form.condition != null &&
    ruleEnforces("dateDiagnosed", form.dateDiagnosed) &&
    ruleEnforces("ageOfOnset", form.ageOfOnset) &&
    ruleEnforces("comments", form.comments);

  const mode: "add" | "edit" = dx ? "edit" : "add";

  const handleIcd10Select = async (s: Icd10Suggestion | null): Promise<void> => {
    setIcd10Selection(s);
    if (!s) { setForm((f) => ({ ...f, condition: null })); return; }
    setResolving(true);
    try {
      const { medicalConditionId, conditionName, icd10Code } = await resolveIcd10(s.code, s.shortDesc);
      setForm((f) => ({
        ...f,
        condition: {
          medicalConditionId,
          name: conditionName,
          category: null,
          isChronic: false,
          isAllergy: false,
          isHereditary: false,
          isVerified: true,
        },
        comments: f.comments || icd10Code,
      }));
    } catch {
      setServerError("Failed to resolve ICD-10 code. Try Condition search instead.");
    } finally {
      setResolving(false);
    }
  };

  const mutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!form.condition) throw new Error("Choose a condition first.");
      if (mode === "add") {
        const payload: CreateDiagnosisPayload = {
          medicalConditionId: form.condition.medicalConditionId,
          dateDiagnosed: form.dateDiagnosed || null,
          ageOfOnset: nonEmpty(form.ageOfOnset),
          conditionStatus: (form.conditionStatus || null) as DiagnosisStatus | null,
          comments: nonEmpty(form.comments),
        };
        await createDiagnosis(visitId, payload);
        return;
      }
      if (!dx) return;
      const patch: UpdateDiagnosisPayload = {};
      if (form.condition.medicalConditionId !== dx.medicalConditionId) {
        patch.medicalConditionId = form.condition.medicalConditionId;
      }
      const dxDate = dx.dateDiagnosed ? toDateInput(dx.dateDiagnosed) : "";
      if (form.dateDiagnosed !== dxDate) {
        patch.dateDiagnosed = form.dateDiagnosed || null;
      }
      diffString(patch, "ageOfOnset", form.ageOfOnset, dx.ageOfOnset ?? null);
      const nextStatus = (form.conditionStatus || null) as DiagnosisStatus | null;
      if (nextStatus !== (dx.conditionStatus as DiagnosisStatus | null)) {
        patch.conditionStatus = nextStatus;
      }
      diffString(patch, "comments", form.comments, dx.comments ?? null);
      if (Object.keys(patch).length === 0) return;
      await updateDiagnosis(visitId, dx.pvAssessmentConditionId, patch);
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
      title={mode === "add" ? "Add diagnosis" : "Edit diagnosis"}
      description={visit.patient.fullName || "—"}
      size="lg"
      initialFocusId="dx-condition"
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
            form="dx-form"
            disabled={mutation.isPending || !canSubmit}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {mutation.isPending ? "Saving…" : mode === "add" ? "Add" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="dx-form" onSubmit={onSubmit} className="space-y-4">
        {serverError && (
          <div role="alert" className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
            {serverError}
          </div>
        )}

        {/* Search mode toggle */}
        <div>
          <div className="mb-2 flex items-center gap-1">
            <span className="me-2 text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
              Search by
            </span>
            {(["icd10", "condition"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setSearchMode(m);
                  setIcd10Selection(null);
                  setForm((f) => ({ ...f, condition: null }));
                }}
                className={`rounded-[8px] px-3 py-1 text-[12px] font-medium transition-colors duration-[150ms] ${
                  searchMode === m
                    ? "bg-primary text-white"
                    : "border border-rule bg-card text-ink-2 hover:border-rule-2"
                }`}
              >
                {m === "icd10" ? "ICD-10" : "Condition"}
              </button>
            ))}
          </div>

          {searchMode === "icd10" ? (
            <div>
              <Icd10Combobox
                id="dx-icd10"
                label="ICD-10 code"
                required={!form.condition}
                value={icd10Selection}
                onChange={(s) => void handleIcd10Select(s)}
                billableOnly
              />
              {resolving && (
                <p className="mt-1 text-[12px] text-ink-3">Resolving code…</p>
              )}
              {form.condition && icd10Selection && (
                <div className="mt-2 flex items-center gap-2 rounded-[8px] bg-vital-bg px-3 py-1.5">
                  <span className="font-mono text-[11.5px] font-semibold text-vital-fg">
                    {icd10Selection.code}
                  </span>
                  <span className="text-[12.5px] text-ink-2">{form.condition.name}</span>
                </div>
              )}
            </div>
          ) : (
            <ConditionCombobox
              id="dx-condition"
              label="Condition"
              required
              value={form.condition}
              onChange={(c) => setForm((f) => ({ ...f, condition: c }))}
            />
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <FieldLabel>Status</FieldLabel>
            <SearchableSelect
              value={form.conditionStatus}
              onChange={(v) =>
                setForm((f) => ({ ...f, conditionStatus: v as DiagnosisStatus | "" }))
              }
              emptyLabel="—"
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
            />
          </div>

          {(() => {
            const f = rules.field("dateDiagnosed", "Date diagnosed");
            return f.hidden ? null : (
              <TextInput
                id={f.id}
                label={f.label}
                required={f.required}
                readOnly={f.readOnly}
                type="date"
                mono
                value={form.dateDiagnosed}
                onChange={(v) => setForm((s) => ({ ...s, dateDiagnosed: v }))}
              />
            );
          })()}

          {(() => {
            const f = rules.field("ageOfOnset", "Age of onset");
            return f.hidden ? null : (
              <TextInput
                id={f.id}
                label={f.label}
                required={f.required}
                readOnly={f.readOnly}
                mono
                placeholder="e.g. 45y, 6mo"
                value={form.ageOfOnset}
                onChange={(v) => setForm((s) => ({ ...s, ageOfOnset: v }))}
              />
            );
          })()}
        </div>

        {(() => {
          const f = rules.field("comments", "Comments");
          return f.hidden ? null : (
            <Textarea
              id={f.id}
              label={f.label}
              required={f.required}
              readOnly={f.readOnly}
              rows={3}
              value={form.comments}
              onChange={(v) => setForm((s) => ({ ...s, comments: v }))}
            />
          );
        })()}
      </form>
    </Modal>
  );
}

// ---- helpers ----

function diffString(
  out: UpdateDiagnosisPayload,
  key: "ageOfOnset" | "comments",
  next: string,
  prev: string | null,
): void {
  const n = nonEmpty(next);
  if (n !== prev) out[key] = n;
}
