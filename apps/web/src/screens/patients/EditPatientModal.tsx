import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { SearchableSelect } from "../../components/SearchableSelect";
import { ApiError } from "../../lib/api/client";
import { useFieldRules } from "../../lib/field-rules";
import { FieldLabel, Section, TextInput, Textarea } from "../../lib/form-primitives";
import {
  updatePatient,
  updateArabicInfo,
  type PatientDetail,
  type UpdatePatientPayload,
} from "./api";

interface Props {
  patient: PatientDetail;
  open: boolean;
  onClose: () => void;
}

interface FormState {
  // Names
  prefix: string;
  firstName: string;
  secondName: string;
  thirdName: string;
  lastName: string;
  firstNameAr: string;
  secondNameAr: string;
  thirdNameAr: string;
  lastNameAr: string;

  // Demographics
  nationalId: string;
  sex: number;
  dateOfBirth: string;
  passportNumber: string;
  religion: string;

  // Contact
  mobileNumber: string;
  email: string;
  address: string;

  // Emergency contact
  contactPersonName: string;
  contactRelation: string;
  contactPhoneNumber: string;

  // Vitals baseline
  height: string;
  weight: string;
  whUnit: string;
}

const SEX_OPTIONS = [
  { v: 0, label: "Unknown" },
  { v: 1, label: "Male" },
  { v: 2, label: "Female" },
];

const WH_UNIT_OPTIONS = ["Meters/Kilograms", "Feet/Pounds"];

function blankForm(p: PatientDetail): FormState {
  return {
    prefix: p.prefix ?? "",
    firstName: p.firstName ?? "",
    secondName: p.secondName ?? "",
    thirdName: p.thirdName ?? "",
    lastName: p.lastName ?? "",
    firstNameAr: p.arabicInfo?.firstNameAr ?? "",
    secondNameAr: p.arabicInfo?.secondNameAr ?? "",
    thirdNameAr: p.arabicInfo?.thirdNameAr ?? "",
    lastNameAr: p.arabicInfo?.lastNameAr ?? "",
    nationalId: p.nationalId ?? "",
    sex: p.sex,
    dateOfBirth: p.dateOfBirth ? toDateInput(p.dateOfBirth) : "",
    passportNumber: p.passportNumber ?? "",
    religion: "", // not exposed in PatientDetail today — left blank to avoid overwriting
    mobileNumber: p.mobileNumber ?? "",
    email: p.email ?? "",
    address: p.address ?? "",
    contactPersonName: p.emergencyContact.name ?? "",
    contactRelation: p.emergencyContact.relation ?? "",
    contactPhoneNumber: p.emergencyContact.phoneNumber ?? "",
    height: p.height != null ? String(p.height) : "",
    weight: p.weight != null ? String(p.weight) : "",
    whUnit: p.whUnit ?? "Meters/Kilograms",
  };
}

export function EditPatientModal({ patient, open, onClose }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const initial = useMemo(() => blankForm(patient), [patient]);
  const [form, setForm] = useState<FormState>(initial);
  const [serverError, setServerError] = useState<string | null>(null);
  const rules = useFieldRules("patient");

  useEffect(() => {
    setForm(initial);
    setServerError(null);
  }, [initial, open]);

  // A field counts toward submit-blocking only when visible AND marked required
  // by the rule editor. Hidden fields can't be required.
  const ruleEnforces = (field: string, value: string): boolean =>
    rules.isHidden(field) || !rules.isRequired(field) || value.trim().length > 0;

  const canSubmit =
    ruleEnforces("nationalId", form.nationalId) &&
    ruleEnforces("passportNumber", form.passportNumber) &&
    ruleEnforces("prefix", form.prefix) &&
    ruleEnforces("firstName", form.firstName) &&
    ruleEnforces("secondName", form.secondName) &&
    ruleEnforces("thirdName", form.thirdName) &&
    ruleEnforces("lastName", form.lastName) &&
    ruleEnforces("firstNameAr", form.firstNameAr) &&
    ruleEnforces("secondNameAr", form.secondNameAr) &&
    ruleEnforces("thirdNameAr", form.thirdNameAr) &&
    ruleEnforces("lastNameAr", form.lastNameAr) &&
    ruleEnforces("religion", form.religion) &&
    ruleEnforces("mobileNumber", form.mobileNumber) &&
    ruleEnforces("email", form.email) &&
    ruleEnforces("address", form.address) &&
    ruleEnforces("contactPersonName", form.contactPersonName) &&
    ruleEnforces("contactRelation", form.contactRelation) &&
    ruleEnforces("contactPhoneNumber", form.contactPhoneNumber) &&
    ruleEnforces("height", form.height) &&
    ruleEnforces("weight", form.weight);

  const mutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const patch = diff(initial, form, patient);

      // Separate Arabic name fields from the main patient patch
      const { firstNameAr, secondNameAr, thirdNameAr, lastNameAr, ...mainPatch } = patch;
      const arabicChanged =
        "firstNameAr" in patch ||
        "secondNameAr" in patch ||
        "thirdNameAr" in patch ||
        "lastNameAr" in patch;

      const ops: Promise<void>[] = [];

      if (Object.keys(mainPatch).length > 0) {
        ops.push(updatePatient(patient.patientId, mainPatch));
      }

      if (arabicChanged) {
        ops.push(
          updateArabicInfo(patient.patientId, {
            firstNameAr: firstNameAr ?? null,
            secondNameAr: secondNameAr ?? null,
            thirdNameAr: thirdNameAr ?? null,
            lastNameAr: lastNameAr ?? null,
          }),
        );
      }

      if (ops.length === 0) return;
      await Promise.all(ops);
    },
    onSuccess: () => {
      // Refresh patient detail (header + summary) and any list views that may
      // show this patient's name.
      queryClient.invalidateQueries({ queryKey: ["patients", "detail", patient.patientId] });
      queryClient.invalidateQueries({ queryKey: ["patients", "list"] });
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
      title="Edit patient"
      description={patient.fullName || "—"}
      size="xl"
      initialFocusId="patient-first-name"
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
            form="edit-patient-form"
            disabled={mutation.isPending || !canSubmit}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {mutation.isPending ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="edit-patient-form" onSubmit={onSubmit} className="space-y-6">
        {serverError && (
          <div role="alert" className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
            {serverError}
          </div>
        )}

        {/* Names — EN (section collapses when every field is hidden) */}
        {(!rules.isHidden("prefix") ||
          !rules.isHidden("firstName") ||
          !rules.isHidden("secondName") ||
          !rules.isHidden("thirdName") ||
          !rules.isHidden("lastName")) && (
          <Section title="Name (English)">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {([
                ["prefix", "Prefix", "Mr./Mrs./Dr."],
                ["firstName", "First", undefined],
                ["secondName", "Second", undefined],
                ["thirdName", "Third", undefined],
                ["lastName", "Last", undefined],
              ] as const).map(([name, fallback, placeholder]) => {
                const fld = rules.field(name, fallback);
                if (fld.hidden) return null;
                return (
                  <TextInput
                    key={name}
                    id={fld.id}
                    label={fld.label}
                    required={fld.required}
                    readOnly={fld.readOnly}
                    value={form[name]}
                    placeholder={placeholder}
                    onChange={(v) => setForm((s) => ({ ...s, [name]: v }))}
                  />
                );
              })}
            </div>
          </Section>
        )}

        {/* Names — AR (section collapses when every field is hidden) */}
        {(["firstNameAr", "secondNameAr", "thirdNameAr", "lastNameAr"] as const).some(
          (n) => !rules.isHidden(n),
        ) && (
          <Section title="الاسم">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" dir="rtl">
              {([
                ["firstNameAr", "الأول"],
                ["secondNameAr", "الثاني"],
                ["thirdNameAr", "الثالث"],
                ["lastNameAr", "العائلة"],
              ] as const).map(([name, fallback]) => {
                const fld = rules.field(name, fallback);
                if (fld.hidden) return null;
                return (
                  <TextInput
                    key={name}
                    id={fld.id}
                    label={fld.label}
                    required={fld.required}
                    readOnly={fld.readOnly}
                    value={form[name]}
                    onChange={(v) => setForm((s) => ({ ...s, [name]: v }))}
                    rtl
                  />
                );
              })}
            </div>
          </Section>
        )}

        {/* Demographics — fields respect per-clinic visibility/required rules */}
        <Section title="Personal Information">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(() => {
              const fld = rules.field("nationalId", "National ID");
              return fld.hidden ? null : (
                <TextInput
                  id={fld.id}
                  label={fld.label}
                  required={fld.required}
                  readOnly={fld.readOnly}
                  value={form.nationalId}
                  mono
                  onChange={(v) => setForm((s) => ({ ...s, nationalId: v }))}
                />
              );
            })()}
            {(() => {
              const fld = rules.field("sex", "Sex");
              return fld.hidden ? null : (
                <div>
                  <FieldLabel htmlFor={fld.id} required={fld.required}>
                    {fld.label}
                  </FieldLabel>
                  <SearchableSelect
                    id={fld.id}
                    value={form.sex}
                    onChange={(v) => setForm((s) => ({ ...s, sex: Number(v) }))}
                    disabled={fld.readOnly}
                    showValue
                    options={SEX_OPTIONS.map((o) => ({ value: o.v, label: o.label }))}
                  />
                </div>
              );
            })()}
            {(() => {
              const fld = rules.field("dateOfBirth", "Date of birth");
              return fld.hidden ? null : (
                <TextInput
                  id={fld.id}
                  label={fld.label}
                  required={fld.required}
                  readOnly={fld.readOnly}
                  value={form.dateOfBirth}
                  type="date"
                  mono
                  onChange={(v) => setForm((s) => ({ ...s, dateOfBirth: v }))}
                />
              );
            })()}
            {(() => {
              const fld = rules.field("passportNumber", "Passport");
              return fld.hidden ? null : (
                <TextInput
                  id={fld.id}
                  label={fld.label}
                  required={fld.required}
                  readOnly={fld.readOnly}
                  value={form.passportNumber}
                  mono
                  onChange={(v) => setForm((s) => ({ ...s, passportNumber: v }))}
                />
              );
            })()}
            {(() => {
              const fld = rules.field("religion", "Religion");
              return fld.hidden ? null : (
                <TextInput
                  id={fld.id}
                  label={fld.label}
                  required={fld.required}
                  readOnly={fld.readOnly}
                  value={form.religion}
                  onChange={(v) => setForm((s) => ({ ...s, religion: v }))}
                />
              );
            })()}
          </div>
        </Section>

        {/* Contact */}
        {(["mobileNumber", "email", "address"] as const).some((n) => !rules.isHidden(n)) && (
          <Section title="Contact">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(() => {
                const fld = rules.field("mobileNumber", "Phone");
                return fld.hidden ? null : (
                  <TextInput
                    id={fld.id}
                    label={fld.label}
                    required={fld.required}
                    readOnly={fld.readOnly}
                    value={form.mobileNumber}
                    mono
                    onChange={(v) => setForm((s) => ({ ...s, mobileNumber: v }))}
                  />
                );
              })()}
              {(() => {
                const fld = rules.field("email", "Email");
                return fld.hidden ? null : (
                  <TextInput
                    id={fld.id}
                    label={fld.label}
                    required={fld.required}
                    readOnly={fld.readOnly}
                    value={form.email}
                    type="email"
                    onChange={(v) => setForm((s) => ({ ...s, email: v }))}
                  />
                );
              })()}
            </div>
            {(() => {
              const fld = rules.field("address", "Address");
              return fld.hidden ? null : (
                <div className="mt-3">
                  <Textarea
                    id={fld.id}
                    label={fld.label}
                    required={fld.required}
                    readOnly={fld.readOnly}
                    value={form.address}
                    rows={2}
                    onChange={(v) => setForm((s) => ({ ...s, address: v }))}
                  />
                </div>
              );
            })()}
          </Section>
        )}

        {/* Emergency contact — collapses when every field is hidden */}
        {(["contactPersonName", "contactRelation", "contactPhoneNumber"] as const).some(
          (n) => !rules.isHidden(n),
        ) && (
          <Section title="Emergency contact">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {([
                ["contactPersonName", "Name", false],
                ["contactRelation", "Relation", false],
                ["contactPhoneNumber", "Phone", true],
              ] as const).map(([name, fallback, mono]) => {
                const fld = rules.field(name, fallback);
                if (fld.hidden) return null;
                return (
                  <TextInput
                    key={name}
                    id={fld.id}
                    label={fld.label}
                    required={fld.required}
                    readOnly={fld.readOnly}
                    value={form[name]}
                    mono={mono}
                    onChange={(v) => setForm((s) => ({ ...s, [name]: v }))}
                  />
                );
              })}
            </div>
          </Section>
        )}

        {/* Baseline vitals — entire section hides when both height & weight are off */}
        {(["height", "weight"] as const).some((n) => !rules.isHidden(n)) && (
        <Section title="Vitals baseline">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {([
              ["height", "Height", "e.g. 172"],
              ["weight", "Weight", "e.g. 72"],
            ] as const).map(([name, fallback, placeholder]) => {
              const fld = rules.field(name, fallback);
              if (fld.hidden) return null;
              return (
                <TextInput
                  key={name}
                  id={fld.id}
                  label={fld.label}
                  required={fld.required}
                  readOnly={fld.readOnly}
                  value={form[name]}
                  mono
                  placeholder={placeholder}
                  onChange={(v) => setForm((s) => ({ ...s, [name]: v }))}
                />
              );
            })}
            <div>
              <FieldLabel>Units</FieldLabel>
              <SearchableSelect
                value={form.whUnit}
                onChange={(v) => setForm((f) => ({ ...f, whUnit: String(v) }))}
                options={WH_UNIT_OPTIONS.map((o) => ({ value: o, label: o }))}
              />
            </div>
          </div>
        </Section>
        )}
      </form>
    </Modal>
  );
}

// ---- Diff ----

function diff(initial: FormState, current: FormState, patient: PatientDetail): UpdatePatientPayload {
  const out: UpdatePatientPayload = {};

  // String-or-null fields (set null when empty).
  const STR_NULL: Array<
    [keyof FormState, keyof UpdatePatientPayload]
  > = [
    ["prefix", "prefix"],
    ["firstName", "firstName"],
    ["secondName", "secondName"],
    ["thirdName", "thirdName"],
    ["lastName", "lastName"],
    ["firstNameAr", "firstNameAr"],
    ["secondNameAr", "secondNameAr"],
    ["thirdNameAr", "thirdNameAr"],
    ["lastNameAr", "lastNameAr"],
    ["passportNumber", "passportNumber"],
    ["religion", "religion"],
    ["mobileNumber", "mobileNumber"],
    ["email", "email"],
    ["address", "address"],
    ["contactPersonName", "contactPersonName"],
    ["contactRelation", "contactRelation"],
    ["contactPhoneNumber", "contactPhoneNumber"],
    ["whUnit", "whUnit"],
  ];
  for (const [src, dst] of STR_NULL) {
    if (current[src] !== initial[src]) {
      const v = String(current[src]).trim();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (out as Record<string, any>)[dst] = v.length === 0 ? null : v;
    }
  }

  // Required strings (no nulling — server will 409 if you try).
  if (current.nationalId !== initial.nationalId) {
    out.nationalId = current.nationalId.trim();
  }

  // Sex
  if (current.sex !== initial.sex) out.sex = current.sex;

  // Date of birth — keep as YYYY-MM-DD string; backend will pin midnight UTC.
  if (current.dateOfBirth !== initial.dateOfBirth && current.dateOfBirth) {
    out.dateOfBirth = current.dateOfBirth;
  }

  // Vitals doubles
  const heightInitial = patient.height != null ? String(patient.height) : "";
  if (current.height !== heightInitial) {
    out.height = parseNumOrNull(current.height);
  }
  const weightInitial = patient.weight != null ? String(patient.weight) : "";
  if (current.weight !== weightInitial) {
    out.weight = parseNumOrNull(current.weight);
  }

  return out;
}

function parseNumOrNull(s: string): number | null {
  const t = s.trim();
  if (t.length === 0) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function toDateInput(iso: string): string {
  const d = new Date(iso.includes(" ") ? iso.replace(" ", "T") + "Z" : iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Section / FieldLabel / TextInput are imported from "lib/form-primitives".
