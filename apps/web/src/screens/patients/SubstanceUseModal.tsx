import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { FieldLabel, Section, TextInput, Textarea, applyDefaults } from "../../lib/form-primitives";
import { ApiError } from "../../lib/api/client";
import { useFieldRules } from "../../lib/field-rules";
import { updateSubstanceUse, type SubstanceUse } from "./api";

interface Props {
  open: boolean;
  patientId: string;
  initial: SubstanceUse | null;
  onClose: () => void;
}

interface FormState {
  // Smoking
  liveWithSmokers: boolean;
  parentsWereSmokers: boolean;
  smokedBefore: boolean;
  stillSmoking: boolean;
  cigarettesNumber: string;
  cigarettesStartYear: string;
  cigarettesStopYear: string;
  sheeshaHeadNumber: string;
  sheeshaStartYear: string;
  sheeshaStopYear: string;
  totalPackYear: string;
  smokingComments: string;
  // Alcohol
  alcoholic: boolean;
  pastAlcoholic: boolean;
  excessiveAlcoholUse: boolean;
  beerNumber: string;
  wineNumber: string;
  liquorNumber: string;
  drinkingComments: string;
  // Drugs
  drugUser: boolean;
  drugComments: string;
}

function toForm(d: SubstanceUse | null): FormState {
  return {
    liveWithSmokers: d?.liveWithSmokers ?? false,
    parentsWereSmokers: d?.parentsWereSmokers ?? false,
    smokedBefore: d?.smokedBefore ?? false,
    stillSmoking: d?.stillSmoking ?? false,
    cigarettesNumber: d?.cigarettesNumber != null ? String(d.cigarettesNumber) : "",
    cigarettesStartYear: d?.cigarettesStartYear != null ? String(d.cigarettesStartYear) : "",
    cigarettesStopYear: d?.cigarettesStopYear != null ? String(d.cigarettesStopYear) : "",
    sheeshaHeadNumber: d?.sheeshaHeadNumber != null ? String(d.sheeshaHeadNumber) : "",
    sheeshaStartYear: d?.sheeshaStartYear != null ? String(d.sheeshaStartYear) : "",
    sheeshaStopYear: d?.sheeshaStopYear != null ? String(d.sheeshaStopYear) : "",
    totalPackYear: d?.totalPackYear != null ? String(d.totalPackYear) : "",
    smokingComments: d?.smokingComments ?? "",
    alcoholic: d?.alcoholic ?? false,
    pastAlcoholic: d?.pastAlcoholic ?? false,
    excessiveAlcoholUse: d?.excessiveAlcoholUse ?? false,
    beerNumber: d?.beerNumber != null ? String(d.beerNumber) : "",
    wineNumber: d?.wineNumber != null ? String(d.wineNumber) : "",
    liquorNumber: d?.liquorNumber != null ? String(d.liquorNumber) : "",
    drinkingComments: d?.drinkingComments ?? "",
    drugUser: d?.drugUser ?? false,
    drugComments: d?.drugComments ?? "",
  };
}

function parseIntOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

function parseFloatOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

export function SubstanceUseModal({
  open,
  patientId,
  initial,
  onClose,
}: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => toForm(initial));
  const [serverError, setServerError] = useState<string | null>(null);
  const rules = useFieldRules("substance_use");

  useEffect(() => {
    if (!open) return;
    setForm(initial ? toForm(initial) : applyDefaults(toForm(null), rules.defaults));
    setServerError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const ruleEnforces = (field: string, value: string): boolean =>
    rules.isHidden(field) || !rules.isRequired(field) || value.trim().length > 0;

  const canSubmit =
    ruleEnforces("cigarettesNumber", form.cigarettesNumber) &&
    ruleEnforces("sheeshaHeadNumber", form.sheeshaHeadNumber) &&
    ruleEnforces("totalPackYear", form.totalPackYear) &&
    ruleEnforces("smokingComments", form.smokingComments) &&
    ruleEnforces("beerNumber", form.beerNumber) &&
    ruleEnforces("wineNumber", form.wineNumber) &&
    ruleEnforces("drinkingComments", form.drinkingComments) &&
    ruleEnforces("drugComments", form.drugComments);

  // Auto-compute pack-years when cigarettes or years change
  useEffect(() => {
    const cigs = parseIntOrNull(form.cigarettesNumber);
    const start = parseIntOrNull(form.cigarettesStartYear);
    const stop = parseIntOrNull(form.cigarettesStopYear);
    if (cigs != null && start != null) {
      const endYear = stop ?? new Date().getFullYear();
      const years = Math.max(0, endYear - start);
      const packYears = (cigs / 20) * years;
      setForm((f) => ({
        ...f,
        totalPackYear: packYears > 0 ? String(Math.round(packYears * 10) / 10) : "",
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.cigarettesNumber, form.cigarettesStartYear, form.cigarettesStopYear]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Partial<SubstanceUse> = {
        liveWithSmokers: form.liveWithSmokers,
        parentsWereSmokers: form.parentsWereSmokers,
        smokedBefore: form.smokedBefore,
        stillSmoking: form.stillSmoking,
        cigarettesNumber: parseIntOrNull(form.cigarettesNumber),
        cigarettesStartYear: parseIntOrNull(form.cigarettesStartYear),
        cigarettesStopYear: parseIntOrNull(form.cigarettesStopYear),
        sheeshaHeadNumber: parseIntOrNull(form.sheeshaHeadNumber),
        sheeshaStartYear: parseIntOrNull(form.sheeshaStartYear),
        sheeshaStopYear: parseIntOrNull(form.sheeshaStopYear),
        totalPackYear: parseFloatOrNull(form.totalPackYear),
        smokingComments: form.smokingComments.trim() || null,
        alcoholic: form.alcoholic,
        pastAlcoholic: form.pastAlcoholic,
        excessiveAlcoholUse: form.excessiveAlcoholUse,
        beerNumber: parseIntOrNull(form.beerNumber),
        wineNumber: parseIntOrNull(form.wineNumber),
        liquorNumber: parseIntOrNull(form.liquorNumber),
        drinkingComments: form.drinkingComments.trim() || null,
        drugUser: form.drugUser,
        drugComments: form.drugComments.trim() || null,
      };
      return updateSubstanceUse(patientId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["patients", "substance-use", patientId],
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
    setServerError(null);
    mutation.mutate();
  };

  const cb = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.checked }));

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      title="Substance use history"
      size="lg"
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
            form="substance-use-form"
            disabled={mutation.isPending || !canSubmit}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {mutation.isPending ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form id="substance-use-form" onSubmit={onSubmit} className="space-y-5">
        {serverError && (
          <div
            role="alert"
            className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg"
          >
            {serverError}
          </div>
        )}

        {/* Smoking */}
        <Section title="Smoking / tobacco">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
              <CheckboxField
                id="sub-live-smokers"
                label="Lives with smokers"
                checked={form.liveWithSmokers}
                onChange={cb("liveWithSmokers")}
              />
              <CheckboxField
                id="sub-parents-smokers"
                label="Parents were smokers"
                checked={form.parentsWereSmokers}
                onChange={cb("parentsWereSmokers")}
              />
              <CheckboxField
                id="sub-smoked-before"
                label="Has smoked before"
                checked={form.smokedBefore}
                onChange={cb("smokedBefore")}
              />
              <CheckboxField
                id="sub-still-smoking"
                label="Still smoking"
                checked={form.stillSmoking}
                onChange={cb("stillSmoking")}
              />
            </div>

            {(form.smokedBefore || form.stillSmoking) && (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {(() => {
                    const f = rules.field("cigarettesNumber", "Cigarettes/day");
                    return f.hidden ? null : (
                      <TextInput
                        id={f.id}
                        label={f.label}
                        required={f.required}
                        readOnly={f.readOnly}
                        value={form.cigarettesNumber}
                        onChange={(v) => setForm((s) => ({ ...s, cigarettesNumber: v }))}
                        mono
                        type="number"
                        placeholder="0"
                      />
                    );
                  })()}
                  <TextInput
                    label="Start year"
                    value={form.cigarettesStartYear}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, cigarettesStartYear: v }))
                    }
                    mono
                    type="number"
                    placeholder="e.g. 1998"
                  />
                  <TextInput
                    label="Stop year"
                    value={form.cigarettesStopYear}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, cigarettesStopYear: v }))
                    }
                    mono
                    type="number"
                    placeholder="If stopped"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {(() => {
                    const f = rules.field("sheeshaHeadNumber", "Shisha heads/week");
                    return f.hidden ? null : (
                      <TextInput
                        id={f.id}
                        label={f.label}
                        required={f.required}
                        readOnly={f.readOnly}
                        value={form.sheeshaHeadNumber}
                        onChange={(v) => setForm((s) => ({ ...s, sheeshaHeadNumber: v }))}
                        mono
                        type="number"
                        placeholder="0"
                      />
                    );
                  })()}
                  <TextInput
                    label="Shisha start year"
                    value={form.sheeshaStartYear}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, sheeshaStartYear: v }))
                    }
                    mono
                    type="number"
                  />
                  <TextInput
                    label="Shisha stop year"
                    value={form.sheeshaStopYear}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, sheeshaStopYear: v }))
                    }
                    mono
                    type="number"
                  />
                </div>
                {(() => {
                  const f = rules.field("totalPackYear", "Total pack-years");
                  return f.hidden ? null : (
                    <div className="max-w-[180px]">
                      <FieldLabel htmlFor={f.id} required={f.required}>
                        {f.label}
                      </FieldLabel>
                      <input
                        id={f.id}
                        type="number"
                        step="0.1"
                        readOnly={f.readOnly}
                        value={form.totalPackYear}
                        onChange={(e) =>
                          setForm((s) => ({ ...s, totalPackYear: e.target.value }))
                        }
                        className={`w-full rounded-[10px] border border-rule bg-card-2 px-3 py-2 font-mono text-[13.5px] tnum outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)] ${
                          f.readOnly ? "bg-paper-2 text-ink-3" : ""
                        }`}
                      />
                      <div className="mt-1 text-[11.5px] text-ink-4">
                        Auto-computed from cigarettes — override if needed.
                      </div>
                    </div>
                  );
                })()}
              </>
            )}

            {(() => {
              const f = rules.field("smokingComments", "Smoking notes");
              return f.hidden ? null : (
                <Textarea
                  id={f.id}
                  label={f.label}
                  required={f.required}
                  readOnly={f.readOnly}
                  value={form.smokingComments}
                  onChange={(v) => setForm((s) => ({ ...s, smokingComments: v }))}
                  rows={2}
                  placeholder="Additional smoking details…"
                />
              );
            })()}
          </div>
        </Section>

        {/* Alcohol */}
        <Section title="Alcohol">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
              <CheckboxField
                id="sub-alcoholic"
                label="Current alcohol use"
                checked={form.alcoholic}
                onChange={cb("alcoholic")}
              />
              <CheckboxField
                id="sub-past-alcoholic"
                label="Past alcohol use"
                checked={form.pastAlcoholic}
                onChange={cb("pastAlcoholic")}
              />
              <CheckboxField
                id="sub-excessive"
                label="Excessive use"
                checked={form.excessiveAlcoholUse}
                onChange={cb("excessiveAlcoholUse")}
              />
            </div>

            {(form.alcoholic || form.pastAlcoholic) && (
              <div className="grid grid-cols-3 gap-3">
                {(() => {
                  const f = rules.field("beerNumber", "Beer/week");
                  return f.hidden ? null : (
                    <TextInput
                      id={f.id}
                      label={f.label}
                      required={f.required}
                      readOnly={f.readOnly}
                      value={form.beerNumber}
                      onChange={(v) => setForm((s) => ({ ...s, beerNumber: v }))}
                      mono
                      type="number"
                      placeholder="0"
                    />
                  );
                })()}
                {(() => {
                  const f = rules.field("wineNumber", "Wine/week");
                  return f.hidden ? null : (
                    <TextInput
                      id={f.id}
                      label={f.label}
                      required={f.required}
                      readOnly={f.readOnly}
                      value={form.wineNumber}
                      onChange={(v) => setForm((s) => ({ ...s, wineNumber: v }))}
                      mono
                      type="number"
                      placeholder="0"
                    />
                  );
                })()}
                <TextInput
                  label="Liquor/week"
                  value={form.liquorNumber}
                  onChange={(v) => setForm((f) => ({ ...f, liquorNumber: v }))}
                  mono
                  type="number"
                  placeholder="0"
                />
              </div>
            )}

            {(() => {
              const f = rules.field("drinkingComments", "Alcohol notes");
              return f.hidden ? null : (
                <Textarea
                  id={f.id}
                  label={f.label}
                  required={f.required}
                  readOnly={f.readOnly}
                  value={form.drinkingComments}
                  onChange={(v) => setForm((s) => ({ ...s, drinkingComments: v }))}
                  rows={2}
                  placeholder="Additional alcohol use details…"
                />
              );
            })()}
          </div>
        </Section>

        {/* Drugs */}
        <Section title="Drugs / other substances">
          <div className="space-y-3">
            <CheckboxField
              id="sub-drug-user"
              label="Recreational / illicit drug use reported"
              checked={form.drugUser}
              onChange={cb("drugUser")}
            />
            {form.drugUser &&
              (() => {
                const f = rules.field("drugComments", "Drug comments");
                return f.hidden ? null : (
                  <Textarea
                    id={f.id}
                    label={f.label}
                    required={f.required}
                    readOnly={f.readOnly}
                    value={form.drugComments}
                    onChange={(v) => setForm((s) => ({ ...s, drugComments: v }))}
                    rows={2}
                    placeholder="Substance(s), frequency, etc."
                  />
                );
              })()}
          </div>
        </Section>
      </form>
    </Modal>
  );
}

function CheckboxField({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}): JSX.Element {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-rule accent-primary"
      />
      {label}
    </label>
  );
}
