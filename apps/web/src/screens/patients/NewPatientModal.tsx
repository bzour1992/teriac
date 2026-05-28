import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Modal } from "../../components/Modal";
import { SearchableSelect } from "../../components/SearchableSelect";
import { ApiError } from "../../lib/api/client";
import { useFieldRules } from "../../lib/field-rules";
import {
  FieldLabel,
  Section,
  TextInput,
  Textarea,
  anyNonEmpty,
  nonEmpty,
} from "../../lib/form-primitives";
import { createPatient, type CreatePatientPayload } from "./api";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface FormState {
  prefix: string;
  firstName: string;
  secondName: string;
  thirdName: string;
  lastName: string;
  firstNameAr: string;
  secondNameAr: string;
  thirdNameAr: string;
  lastNameAr: string;
  nationalId: string;
  sex: number;
  dateOfBirth: string;
  mobileNumber: string;
  email: string;
  address: string;
  contactPersonName: string;
  contactPhoneNumber: string;
}

const SEX_OPTIONS = [
  { v: 0, label: "Unknown" },
  { v: 1, label: "Male" },
  { v: 2, label: "Female" },
];

const EMPTY: FormState = {
  prefix: "",
  firstName: "",
  secondName: "",
  thirdName: "",
  lastName: "",
  firstNameAr: "",
  secondNameAr: "",
  thirdNameAr: "",
  lastNameAr: "",
  nationalId: "",
  sex: 0,
  dateOfBirth: "",
  mobileNumber: "",
  email: "",
  address: "",
  contactPersonName: "",
  contactPhoneNumber: "",
};

export function NewPatientModal({ open, onClose }: Props): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [serverError, setServerError] = useState<string | null>(null);
  const rules = useFieldRules("patient");

  // Seed the form on open: blank baseline + any per-clinic defaults set in the
  // field-rule editor. Defaults apply to string fields; `sex` (numeric) is
  // ignored here — superadmins can set it via the rule's `defaultValue`
  // ("0"/"1"/"2") and we parse below.
  useEffect(() => {
    if (!open) return;
    const next: FormState = { ...EMPTY };
    for (const [key, value] of Object.entries(rules.defaults)) {
      if (key === "sex") {
        const n = Number(value);
        if (!Number.isNaN(n)) next.sex = n;
        continue;
      }
      if (key in next) {
        (next as unknown as Record<string, unknown>)[key] = value;
      }
    }
    setForm(next);
    setServerError(null);
    // Re-seed when rules.defaults arrives later (e.g. cold cache).
  }, [open, rules.defaults]);

  const enHasName = anyNonEmpty([form.firstName, form.lastName]);
  const arHasName = anyNonEmpty([form.firstNameAr, form.lastNameAr]);
  const nameOk = enHasName || arHasName;

  // Build the can-submit predicate from the rule editor: a field counts toward
  // validation only when it's visible AND marked required by the rule.
  const ruleEnforces = (field: string, value: string): boolean =>
    rules.isHidden(field) || !rules.isRequired(field) || value.trim().length > 0;

  // If a DOB is provided it must be a valid date (the date input enforces this
  // already, but guard against pasted-in garbage). Empty DOB is acceptable when
  // the rule allows it; the backend falls back to 1900-01-01.
  const dobAcceptable =
    form.dateOfBirth.length === 0 ||
    (!Number.isNaN(Date.parse(form.dateOfBirth)));

  const canSubmit =
    nameOk &&
    dobAcceptable &&
    ruleEnforces("nationalId", form.nationalId) &&
    ruleEnforces("dateOfBirth", form.dateOfBirth) &&
    ruleEnforces("prefix", form.prefix) &&
    ruleEnforces("firstName", form.firstName) &&
    ruleEnforces("secondName", form.secondName) &&
    ruleEnforces("thirdName", form.thirdName) &&
    ruleEnforces("lastName", form.lastName) &&
    ruleEnforces("firstNameAr", form.firstNameAr) &&
    ruleEnforces("secondNameAr", form.secondNameAr) &&
    ruleEnforces("thirdNameAr", form.thirdNameAr) &&
    ruleEnforces("lastNameAr", form.lastNameAr) &&
    ruleEnforces("mobileNumber", form.mobileNumber) &&
    ruleEnforces("email", form.email) &&
    ruleEnforces("address", form.address) &&
    ruleEnforces("contactPersonName", form.contactPersonName) &&
    ruleEnforces("contactPhoneNumber", form.contactPhoneNumber);

  const mutation = useMutation({
    mutationFn: (): Promise<{ patientId: string }> => {
      const payload: CreatePatientPayload = {
        // Backend fills AUTO-… / 1900-01-01 fallbacks when these are omitted.
        nationalId: nonEmpty(form.nationalId),
        sex: form.sex,
        dateOfBirth: nonEmpty(form.dateOfBirth),
        prefix: nonEmpty(form.prefix),
        firstName: nonEmpty(form.firstName),
        secondName: nonEmpty(form.secondName),
        thirdName: nonEmpty(form.thirdName),
        lastName: nonEmpty(form.lastName),
        firstNameAr: nonEmpty(form.firstNameAr),
        secondNameAr: nonEmpty(form.secondNameAr),
        thirdNameAr: nonEmpty(form.thirdNameAr),
        lastNameAr: nonEmpty(form.lastNameAr),
        mobileNumber: nonEmpty(form.mobileNumber),
        email: nonEmpty(form.email),
        address: nonEmpty(form.address),
        contactPersonName: nonEmpty(form.contactPersonName),
        contactPhoneNumber: nonEmpty(form.contactPhoneNumber),
      };
      return createPatient(payload);
    },
    onSuccess: ({ patientId }) => {
      // Refresh the list (every page key) — easier than guessing which page the user is on.
      queryClient.invalidateQueries({ queryKey: ["patients", "list"] });
      onClose();
      navigate(`/patients/${patientId}`);
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : (err as Error).message || "Failed to save");
    },
  });

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    setServerError(null);
    if (!canSubmit) return;
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      title="New patient"
      description="Register a new patient under the current healthcare center."
      size="xl"
      initialFocusId="firstNameAr"
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
            form="new-patient-form"
            disabled={mutation.isPending || !canSubmit}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {mutation.isPending ? "Creating…" : "Create patient"}
          </button>
        </>
      }
    >
      <form id="new-patient-form" onSubmit={onSubmit} className="space-y-6">
        {serverError && (
          <div role="alert" className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
            {serverError}
          </div>
        )}
        {!nameOk && (form.nationalId || form.dateOfBirth) && (
          <div className="rounded-[10px] bg-warn-bg px-3 py-2 text-[12.5px] text-warn-fg">
            Provide at least the first + last name in English or Arabic.
          </div>
        )}

        {/* English name — section collapses when every field is hidden */}
        {(["prefix", "firstName", "secondName", "thirdName", "lastName"] as const).some(
          (n) => !rules.isHidden(n),
        ) && (
          <Section title="Name (English)">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {([
                ["prefix", "Prefix", "Mr./Mrs./Dr."],
                ["firstName", "First", undefined],
                ["secondName", "Second", undefined],
                ["thirdName", "Third", undefined],
                ["lastName", "Last", undefined],
              ] as const).map(([name, fallback, placeholder]) => {
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
                    placeholder={placeholder}
                    onChange={(v) => setForm((s) => ({ ...s, [name]: v }))}
                  />
                );
              })}
            </div>
          </Section>
        )}

        {/* Arabic name — section collapses when every field is hidden */}
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
                    rtl
                  />
                );
              })}
            </div>
          </Section>
        )}

        {/* Identifiers — fully rule-driven. Missing nationalId is auto-filled by
            the backend (AUTO-…) and missing dateOfBirth defaults to 1900-01-01. */}
        {(["nationalId", "sex", "dateOfBirth"] as const).some((n) => !rules.isHidden(n)) && (
          <Section title="Identifiers">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(() => {
                const f = rules.field("nationalId", "National ID");
                return f.hidden ? null : (
                  <TextInput
                    id={f.id}
                    label={f.label}
                    required={f.required}
                    readOnly={f.readOnly}
                    value={form.nationalId}
                    mono
                    onChange={(v) => setForm((s) => ({ ...s, nationalId: v }))}
                  />
                );
              })()}
              {(() => {
                const f = rules.field("sex", "Sex");
                return f.hidden ? null : (
                  <div>
                    <FieldLabel htmlFor={f.id} required={f.required}>
                      {f.label}
                    </FieldLabel>
                    <SearchableSelect
                      id={f.id}
                      value={form.sex}
                      onChange={(v) => setForm((s) => ({ ...s, sex: Number(v) }))}
                      required={f.required}
                      disabled={f.readOnly}
                      showValue
                      options={SEX_OPTIONS.map((o) => ({ value: o.v, label: o.label }))}
                    />
                  </div>
                );
              })()}
              {(() => {
                const f = rules.field("dateOfBirth", "Date of birth");
                return f.hidden ? null : (
                  <TextInput
                    id={f.id}
                    label={f.label}
                    required={f.required}
                    readOnly={f.readOnly}
                    value={form.dateOfBirth}
                    type="date"
                    mono
                    onChange={(v) => setForm((s) => ({ ...s, dateOfBirth: v }))}
                  />
                );
              })()}
            </div>
          </Section>
        )}

        {/* Contact — collapses to nothing if all three are hidden by rule */}
        {(["mobileNumber", "email", "address"] as const).some((n) => !rules.isHidden(n)) && (
          <Section title="Contact">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(() => {
                const f = rules.field("mobileNumber", "Phone");
                return f.hidden ? null : (
                  <TextInput
                    id={f.id}
                    label={f.label}
                    required={f.required}
                    readOnly={f.readOnly}
                    value={form.mobileNumber}
                    mono
                    placeholder="0795…"
                    onChange={(v) => setForm((s) => ({ ...s, mobileNumber: v }))}
                  />
                );
              })()}
              {(() => {
                const f = rules.field("email", "Email");
                return f.hidden ? null : (
                  <TextInput
                    id={f.id}
                    label={f.label}
                    required={f.required}
                    readOnly={f.readOnly}
                    value={form.email}
                    type="email"
                    onChange={(v) => setForm((s) => ({ ...s, email: v }))}
                  />
                );
              })()}
            </div>
            {(() => {
              const f = rules.field("address", "Address");
              return f.hidden ? null : (
                <div className="mt-3">
                  <Textarea
                    id={f.id}
                    label={f.label}
                    required={f.required}
                    readOnly={f.readOnly}
                    value={form.address}
                    rows={2}
                    onChange={(v) => setForm((s) => ({ ...s, address: v }))}
                  />
                </div>
              );
            })()}
          </Section>
        )}

        {/* Emergency contact — collapses when both fields hidden */}
        {(["contactPersonName", "contactPhoneNumber"] as const).some((n) => !rules.isHidden(n)) && (
          <Section title="Emergency contact">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(() => {
                const f = rules.field("contactPersonName", "Name");
                return f.hidden ? null : (
                  <TextInput
                    id={f.id}
                    label={f.label}
                    required={f.required}
                    readOnly={f.readOnly}
                    value={form.contactPersonName}
                    onChange={(v) => setForm((s) => ({ ...s, contactPersonName: v }))}
                  />
                );
              })()}
              {(() => {
                const f = rules.field("contactPhoneNumber", "Phone");
                return f.hidden ? null : (
                  <TextInput
                    id={f.id}
                    label={f.label}
                    required={f.required}
                    readOnly={f.readOnly}
                    value={form.contactPhoneNumber}
                    mono
                    onChange={(v) => setForm((s) => ({ ...s, contactPhoneNumber: v }))}
                  />
                );
              })()}
            </div>
          </Section>
        )}
      </form>
    </Modal>
  );
}
