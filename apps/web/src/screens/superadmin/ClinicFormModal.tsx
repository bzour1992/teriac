import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { SearchableSelect } from "../../components/SearchableSelect";
import { ApiError } from "../../lib/api/client";
import { FieldLabel, TextInput } from "../../lib/form-primitives";
import {
  createClinic,
  updateClinic,
  SUBSCRIPTION_LABEL,
  type ClinicDetail,
  type CreateClinicPayload,
  type UpdateClinicPayload,
} from "./api";

interface Props {
  open: boolean;
  /** null = create mode. A clinic detail = edit mode. */
  clinic: ClinicDetail | null;
  onClose: () => void;
  onCreated?: (hcenterId: string) => void;
}

interface FormState {
  name: string;
  nameRep: string;
  email: string;
  phone: string;
  hcenterInitials: string;
  countryId: string;
  cityId: string;
  subscriptionType: number;
  isOneDoctor: boolean;
}

function blankForm(c: ClinicDetail | null): FormState {
  if (!c) {
    return {
      name: "",
      nameRep: "",
      email: "",
      phone: "",
      hcenterInitials: "",
      countryId: "",
      cityId: "",
      subscriptionType: 2,
      isOneDoctor: false,
    };
  }
  return {
    name: c.name,
    nameRep: c.nameRep ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    hcenterInitials: c.hcenterInitials ?? "",
    countryId: c.countryId ?? "",
    cityId: c.cityId ?? "",
    subscriptionType: c.subscriptionType,
    isOneDoctor: c.isOneDoctor,
  };
}

function nn(s: string): string | null {
  const t = s.trim();
  return t.length === 0 ? null : t;
}

export function ClinicFormModal({
  open,
  clinic,
  onClose,
  onCreated,
}: Props): JSX.Element {
  const queryClient = useQueryClient();
  const isEdit = clinic !== null;
  const [form, setForm] = useState<FormState>(() => blankForm(clinic));
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(blankForm(clinic));
      setServerError(null);
    }
  }, [open, clinic]);

  const f =
    <K extends keyof FormState>(key: K) =>
    (value: FormState[K]) =>
      setForm((prev) => ({ ...prev, [key]: value }));

  const canSubmit = form.name.trim().length > 0;

  const mutation = useMutation({
    mutationFn: async (): Promise<string | undefined> => {
      if (!isEdit) {
        const payload: CreateClinicPayload = {
          name: form.name.trim(),
          nameRep: nn(form.nameRep),
          email: nn(form.email),
          phone: nn(form.phone),
          hcenterInitials: nn(form.hcenterInitials),
          countryId: nn(form.countryId),
          cityId: nn(form.cityId),
          subscriptionType: form.subscriptionType,
          isOneDoctor: form.isOneDoctor,
        };
        const result = await createClinic(payload);
        return result.hcenterId;
      }
      const payload: UpdateClinicPayload = {
        name: form.name.trim() || undefined,
        nameRep: nn(form.nameRep),
        email: nn(form.email),
        phone: nn(form.phone),
        hcenterInitials: nn(form.hcenterInitials),
        countryId: nn(form.countryId),
        cityId: nn(form.cityId),
        subscriptionType: form.subscriptionType,
        isOneDoctor: form.isOneDoctor,
      };
      await updateClinic(clinic.hcenterId, payload);
      return undefined;
    },
    onSuccess: (newId) => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "clinics"] });
      if (clinic) {
        queryClient.invalidateQueries({
          queryKey: ["superadmin", "clinic", clinic.hcenterId],
        });
      }
      if (newId && onCreated) onCreated(newId);
      onClose();
    },
    onError: (err) => {
      setServerError(
        err instanceof ApiError ? err.message : (err as Error).message || "Failed to save",
      );
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
      title={isEdit ? `Edit clinic — ${clinic.name}` : "New clinic"}
      size="md"
      initialFocusId="clinic-name"
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
            form="clinic-form"
            disabled={!canSubmit || mutation.isPending}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Create clinic"}
          </button>
        </>
      }
    >
      <form id="clinic-form" onSubmit={onSubmit} className="space-y-4">
        {serverError && (
          <div
            role="alert"
            className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg"
          >
            {serverError}
          </div>
        )}

        <TextInput
          id="clinic-name"
          label="Clinic name"
          required
          value={form.name}
          onChange={f("name")}
          placeholder="Al-Shifa Medical Center"
        />

        <TextInput
          label="Arabic / report name"
          value={form.nameRep}
          onChange={f("nameRep")}
          rtl
          placeholder="مركز الشفاء الطبي"
        />

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
            label="Initials"
            mono
            value={form.hcenterInitials}
            onChange={f("hcenterInitials")}
            placeholder="AS"
          />
          <div>
            <FieldLabel>Subscription</FieldLabel>
            <SearchableSelect
              value={form.subscriptionType}
              onChange={(v) =>
                setForm((prev) => ({ ...prev, subscriptionType: Number(v) }))
              }
              options={Object.entries(SUBSCRIPTION_LABEL).map(([v, label]) => ({
                value: Number(v),
                label,
              }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextInput
            label="Country ID"
            mono
            value={form.countryId}
            onChange={f("countryId")}
            placeholder="GUID"
          />
          <TextInput
            label="City ID"
            mono
            value={form.cityId}
            onChange={f("cityId")}
            placeholder="GUID"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-rule px-4 py-3 text-[13.5px] text-ink-2">
          <input
            type="checkbox"
            checked={form.isOneDoctor}
            onChange={(e) => f("isOneDoctor")(e.target.checked)}
            className="size-4 rounded border-rule text-primary focus:ring-2 focus:ring-primary-100"
          />
          Single-doctor practice
        </label>
      </form>
    </Modal>
  );
}
