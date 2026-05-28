import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FieldLabel, TextInput, Textarea } from "../../lib/form-primitives";
import { SearchableSelect } from "../../components/SearchableSelect";
import { ApiError } from "../../lib/api/client";
import {
  getHCenter,
  getSettings,
  updateHCenter,
  updateSettings,
  PAYMENT_OPTIONS,
  type HCenterProfile,
  type HCenterSettings,
  type UpdateHCenterPayload,
} from "./api";

const SELECT_CLS =
  "w-full rounded-[10px] border border-rule bg-card px-3 py-2 text-[13.5px] outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]";

// ── Inline toast ──────────────────────────────────────────────────────────────

function useSavedToast(): [boolean, () => void] {
  const [saved, setSaved] = useState(false);
  const flash = (): void => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  return [saved, flash];
}

// ── Toggle row ────────────────────────────────────────────────────────────────

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

// ── Center Profile card ────────────────────────────────────────────────────────

interface ProfileFormState {
  name: string;
  nameRep: string;
  email: string;
  phone: string;
  hcenterInitials: string;
  clinicManager: string;
  clinicManagerEmail: string;
  clinicManagerMob: string;
  reportAddress: string;
  reportsWorkingTimes: string;
}

function profileToForm(p: HCenterProfile): ProfileFormState {
  return {
    name: p.name ?? "",
    nameRep: p.nameRep ?? "",
    email: p.email ?? "",
    phone: p.phone ?? "",
    hcenterInitials: p.hcenterInitials ?? "",
    clinicManager: p.clinicManager ?? "",
    clinicManagerEmail: p.clinicManagerEmail ?? "",
    clinicManagerMob: p.clinicManagerMob ?? "",
    reportAddress: p.reportAddress ?? "",
    reportsWorkingTimes: p.reportsWorkingTimes ?? "",
  };
}

function nn(s: string): string | null {
  const t = s.trim();
  return t.length === 0 ? null : t;
}

function CenterProfileCard(): JSX.Element {
  const queryClient = useQueryClient();
  const [saved, flash] = useSavedToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileFormState>({
    name: "",
    nameRep: "",
    email: "",
    phone: "",
    hcenterInitials: "",
    clinicManager: "",
    clinicManagerEmail: "",
    clinicManagerMob: "",
    reportAddress: "",
    reportsWorkingTimes: "",
  });

  const query = useQuery({
    queryKey: ["admin", "hcenter"],
    queryFn: ({ signal }) => getHCenter(signal),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (query.data) setForm(profileToForm(query.data));
  }, [query.data]);

  const f = (key: keyof ProfileFormState) => (v: string) =>
    setForm((prev) => ({ ...prev, [key]: v }));

  const mutation = useMutation({
    mutationFn: (): Promise<void> => {
      const payload: UpdateHCenterPayload = {
        name: form.name.trim() || undefined,
        nameRep: nn(form.nameRep),
        email: nn(form.email),
        phone: nn(form.phone),
        hcenterInitials: nn(form.hcenterInitials),
        clinicManager: nn(form.clinicManager),
        clinicManagerEmail: nn(form.clinicManagerEmail),
        clinicManagerMob: nn(form.clinicManagerMob),
        reportAddress: nn(form.reportAddress),
        reportsWorkingTimes: nn(form.reportsWorkingTimes),
      };
      return updateHCenter(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "hcenter"] });
      flash();
      setServerError(null);
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
    <div className="flex flex-col overflow-hidden rounded-lg border border-rule bg-card shadow-1">
      <div className="border-b border-rule px-5 py-4">
        <h2 className="font-serif text-xl font-medium tracking-tight">Center profile</h2>
      </div>
      <form onSubmit={onSubmit} className="flex-1 space-y-4 p-5">
        {query.isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-[10px] bg-paper-3" />
            ))}
          </div>
        )}
        {query.error && (
          <p className="text-[13px] text-alert-fg">
            {(query.error as Error).message}
          </p>
        )}
        {!query.isLoading && !query.error && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput
                label="Center name (EN)"
                required
                value={form.name}
                onChange={f("name")}
                placeholder="Al-Shifa Medical Center"
              />
              <TextInput
                label="Name in reports (AR)"
                value={form.nameRep}
                onChange={f("nameRep")}
                rtl
                placeholder="مركز الشفاء الطبي"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput
                label="Email"
                value={form.email}
                onChange={f("email")}
                placeholder="info@clinic.com"
              />
              <TextInput
                label="Phone"
                mono
                value={form.phone}
                onChange={f("phone")}
                placeholder="+962 6 000 0000"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput
                label="Center initials"
                mono
                value={form.hcenterInitials}
                onChange={f("hcenterInitials")}
                placeholder="AS"
              />
              <TextInput
                label="Clinic manager"
                value={form.clinicManager}
                onChange={f("clinicManager")}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput
                label="Manager email"
                value={form.clinicManagerEmail}
                onChange={f("clinicManagerEmail")}
              />
              <TextInput
                label="Manager mobile"
                mono
                value={form.clinicManagerMob}
                onChange={f("clinicManagerMob")}
              />
            </div>
            <Textarea
              label="Report address"
              value={form.reportAddress}
              onChange={f("reportAddress")}
              rows={2}
              placeholder="123 Main St, Amman, Jordan"
            />
            <TextInput
              label="Working times (for reports)"
              value={form.reportsWorkingTimes}
              onChange={f("reportsWorkingTimes")}
              placeholder="Sun–Thu 8am–5pm"
            />
          </>
        )}
        {serverError && (
          <p role="alert" className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
            {serverError}
          </p>
        )}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={mutation.isPending || query.isLoading}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {mutation.isPending ? "Saving…" : "Save changes"}
          </button>
          {saved && (
            <span className="text-[12px] font-medium text-vital-fg">Saved ✓</span>
          )}
        </div>
      </form>
    </div>
  );
}

// ── System settings card ──────────────────────────────────────────────────────

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
    canDoctorsEditPatientDemographicInformation: s.canDoctorsEditPatientDemographicInformation,
    onlyVisitDoctorCanEditVisitRecords: s.onlyVisitDoctorCanEditVisitRecords,
    preventEditingPatientVisitWhenStatusIsResolvedOrFailed:
      s.preventEditingPatientVisitWhenStatusIsResolvedOrFailed,
    onlyCenterAdminIsAllowedToDeleteAttachments: s.onlyCenterAdminIsAllowedToDeleteAttachments,
  };
}

function SystemSettingsCard(): JSX.Element {
  const queryClient = useQueryClient();
  const [saved, flash] = useSavedToast();
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
    queryKey: ["admin", "settings"],
    queryFn: ({ signal }) => getSettings(signal),
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
      return updateSettings(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
      flash();
      setServerError(null);
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
    <div className="flex flex-col overflow-hidden rounded-lg border border-rule bg-card shadow-1">
      <div className="border-b border-rule px-5 py-4">
        <h2 className="font-serif text-xl font-medium tracking-tight">System settings</h2>
      </div>
      <form onSubmit={onSubmit} className="flex-1 space-y-4 p-5">
        {query.isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
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
                    setForm((prev) => ({ ...prev, defaultPayment: Number(v) }))
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
                    setForm((prev) => ({ ...prev, preferredCurrency: e.target.value }))
                  }
                  placeholder="JOD"
                  maxLength={10}
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
                  setForm((prev) => ({ ...prev, numberOfOperationRooms: e.target.value }))
                }
                className={`${SELECT_CLS} w-32 font-mono`}
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
                onChange={toggle("preventEditingPatientVisitWhenStatusIsResolvedOrFailed")}
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
          <p role="alert" className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
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

// ── CenterTab ──────────────────────────────────────────────────────────────────

export function CenterTab(): JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <CenterProfileCard />
      <SystemSettingsCard />
    </div>
  );
}
