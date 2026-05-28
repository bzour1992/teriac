import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../lib/api/client";
import { SearchableSelect } from "../../components/SearchableSelect";
import { FieldLabel } from "../../lib/form-primitives";
import { PAYMENT_OPTIONS, type HCenterSettings } from "../admin/api";
import { getClinicSettings, updateClinicSettings } from "./api";

const SELECT_CLS =
  "w-full rounded-[10px] border border-rule bg-card px-3 py-2 text-[13.5px] outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]";

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between border-b border-rule py-3 last:border-0">
      <span className="text-[13.5px] text-ink-2">{label}</span>
      <label className="relative inline-flex cursor-pointer items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <span
          className={`flex h-6 w-11 items-center rounded-full transition-colors duration-2 ${
            checked ? "bg-primary" : "bg-rule-2"
          }`}
        >
          <span
            className={`mx-0.5 size-5 rounded-full bg-white shadow transition-transform duration-2 ${
              checked ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </span>
      </label>
    </div>
  );
}

interface SettingsFormState {
  defaultPayment: number;
  preferredCurrency: string;
  numberOfOperationRooms: string;
  isHeightWeightRequired: boolean;
  areAllergiesRequired: boolean;
  areChronicDiseasesRequired: boolean;
  isPatientArabicNameRequired: boolean;
  canDoctorsEditPatientDemographicInformation: boolean;
  onlyVisitDoctorCanEditVisitRecords: boolean;
  preventEditingPatientVisitWhenStatusIsResolvedOrFailed: boolean;
  onlyCenterAdminIsAllowedToDeleteAttachments: boolean;
}

function settingsToForm(s: HCenterSettings): SettingsFormState {
  return {
    defaultPayment: s.defaultPayment,
    preferredCurrency: s.preferredCurrency ?? "",
    numberOfOperationRooms: String(s.numberOfOperationRooms),
    isHeightWeightRequired: s.isHeightWeightRequired,
    areAllergiesRequired: s.areAllergiesRequired,
    areChronicDiseasesRequired: s.areChronicDiseasesRequired,
    isPatientArabicNameRequired: s.isPatientArabicNameRequired,
    canDoctorsEditPatientDemographicInformation:
      s.canDoctorsEditPatientDemographicInformation,
    onlyVisitDoctorCanEditVisitRecords: s.onlyVisitDoctorCanEditVisitRecords,
    preventEditingPatientVisitWhenStatusIsResolvedOrFailed:
      s.preventEditingPatientVisitWhenStatusIsResolvedOrFailed,
    onlyCenterAdminIsAllowedToDeleteAttachments:
      s.onlyCenterAdminIsAllowedToDeleteAttachments,
  };
}

function nn(s: string): string | null {
  const t = s.trim();
  return t.length === 0 ? null : t;
}

export function ClinicSettingsTab({ clinicId }: { clinicId: string }): JSX.Element {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [form, setForm] = useState<SettingsFormState>({
    defaultPayment: 1,
    preferredCurrency: "",
    numberOfOperationRooms: "0",
    isHeightWeightRequired: false,
    areAllergiesRequired: false,
    areChronicDiseasesRequired: false,
    isPatientArabicNameRequired: false,
    canDoctorsEditPatientDemographicInformation: false,
    onlyVisitDoctorCanEditVisitRecords: false,
    preventEditingPatientVisitWhenStatusIsResolvedOrFailed: false,
    onlyCenterAdminIsAllowedToDeleteAttachments: false,
  });

  const query = useQuery({
    queryKey: ["superadmin", "clinic", clinicId, "settings"],
    queryFn: ({ signal }) => getClinicSettings(clinicId, signal),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (query.data) setForm(settingsToForm(query.data));
  }, [query.data]);

  const toggle = (key: keyof SettingsFormState) => (v: boolean) =>
    setForm((prev) => ({ ...prev, [key]: v }));

  const mutation = useMutation({
    mutationFn: (): Promise<void> => {
      const payload: Partial<HCenterSettings> = {
        defaultPayment: form.defaultPayment,
        preferredCurrency: nn(form.preferredCurrency),
        numberOfOperationRooms: Math.max(0, Number(form.numberOfOperationRooms) || 0),
        isHeightWeightRequired: form.isHeightWeightRequired,
        areAllergiesRequired: form.areAllergiesRequired,
        areChronicDiseasesRequired: form.areChronicDiseasesRequired,
        isPatientArabicNameRequired: form.isPatientArabicNameRequired,
        canDoctorsEditPatientDemographicInformation:
          form.canDoctorsEditPatientDemographicInformation,
        onlyVisitDoctorCanEditVisitRecords: form.onlyVisitDoctorCanEditVisitRecords,
        preventEditingPatientVisitWhenStatusIsResolvedOrFailed:
          form.preventEditingPatientVisitWhenStatusIsResolvedOrFailed,
        onlyCenterAdminIsAllowedToDeleteAttachments:
          form.onlyCenterAdminIsAllowedToDeleteAttachments,
      };
      return updateClinicSettings(clinicId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["superadmin", "clinic", clinicId, "settings"],
      });
      setSaved(true);
      setServerError(null);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (err) => {
      setServerError(
        err instanceof ApiError ? err.message : (err as Error).message || "Failed to save",
      );
    },
  });

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
      <div className="border-b border-rule px-5 py-4">
        <h2 className="font-serif text-xl font-medium tracking-tight">System settings</h2>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 p-5">
        {query.isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded-[10px] bg-paper-3" />
            ))}
          </div>
        )}
        {query.error && (
          <p className="text-[13px] text-alert-fg">{(query.error as Error).message}</p>
        )}
        {!query.isLoading && !query.error && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>Default payment</FieldLabel>
                <SearchableSelect
                  value={form.defaultPayment}
                  onChange={(v) =>
                    setForm((prev) => ({
                      ...prev,
                      defaultPayment: Number(v),
                    }))
                  }
                  options={PAYMENT_OPTIONS.map((o) => ({ value: o.v, label: o.label }))}
                />
              </div>
              <div>
                <FieldLabel>Preferred currency</FieldLabel>
                <input
                  type="text"
                  value={form.preferredCurrency}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      preferredCurrency: e.target.value,
                    }))
                  }
                  placeholder="JOD"
                  maxLength={10}
                  dir="auto"
                  className={`${SELECT_CLS} font-mono uppercase`}
                />
              </div>
            </div>

            <div>
              <FieldLabel>Operation rooms</FieldLabel>
              <input
                type="number"
                min={0}
                max={99}
                value={form.numberOfOperationRooms}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    numberOfOperationRooms: e.target.value,
                  }))
                }
                className={`${SELECT_CLS} w-32 font-mono tnum`}
              />
            </div>

            <div className="rounded-[10px] border border-rule p-1 px-4">
              <p className="eyebrow py-2 text-ink-4">Required fields</p>
              <ToggleRow
                label="Height & weight required at registration"
                checked={form.isHeightWeightRequired}
                onChange={toggle("isHeightWeightRequired")}
              />
              <ToggleRow
                label="Allergies required"
                checked={form.areAllergiesRequired}
                onChange={toggle("areAllergiesRequired")}
              />
              <ToggleRow
                label="Chronic diseases required"
                checked={form.areChronicDiseasesRequired}
                onChange={toggle("areChronicDiseasesRequired")}
              />
              <ToggleRow
                label="Arabic name required"
                checked={form.isPatientArabicNameRequired}
                onChange={toggle("isPatientArabicNameRequired")}
              />
            </div>

            <div className="rounded-[10px] border border-rule p-1 px-4">
              <p className="eyebrow py-2 text-ink-4">Access controls</p>
              <ToggleRow
                label="Doctors can edit patient demographics"
                checked={form.canDoctorsEditPatientDemographicInformation}
                onChange={toggle("canDoctorsEditPatientDemographicInformation")}
              />
              <ToggleRow
                label="Only the visit doctor can edit visit records"
                checked={form.onlyVisitDoctorCanEditVisitRecords}
                onChange={toggle("onlyVisitDoctorCanEditVisitRecords")}
              />
              <ToggleRow
                label="Prevent edits when visit is resolved/failed"
                checked={form.preventEditingPatientVisitWhenStatusIsResolvedOrFailed}
                onChange={toggle(
                  "preventEditingPatientVisitWhenStatusIsResolvedOrFailed",
                )}
              />
              <ToggleRow
                label="Only center admin can delete attachments"
                checked={form.onlyCenterAdminIsAllowedToDeleteAttachments}
                onChange={toggle("onlyCenterAdminIsAllowedToDeleteAttachments")}
              />
            </div>
          </>
        )}
        {serverError && (
          <p
            role="alert"
            className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg"
          >
            {serverError}
          </p>
        )}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={mutation.isPending || query.isLoading}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {mutation.isPending ? "Saving…" : "Save settings"}
          </button>
          {saved && (
            <span className="text-[12px] font-medium text-vital-fg">Saved ✓</span>
          )}
        </div>
      </form>
    </div>
  );
}
