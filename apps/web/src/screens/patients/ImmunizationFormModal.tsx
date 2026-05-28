import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { SearchableSelect } from "../../components/SearchableSelect";
import { ApiError } from "../../lib/api/client";
import { FieldLabel, TextInput, nonEmpty } from "../../lib/form-primitives";
import {
  createImmunization,
  listVaccines,
  type CreateImmunizationPayload,
} from "./history-api";

interface Props {
  open: boolean;
  patientId: string;
  onClose: () => void;
}

interface FormState {
  immunizationsVaccineId: string;
  dose: string;
  ageAdministered: string;
  dateAdministered: string;
  physician: string;
}

function blankForm(): FormState {
  return {
    immunizationsVaccineId: "",
    dose: "",
    ageAdministered: "",
    dateAdministered: "",
    physician: "",
  };
}

export function ImmunizationFormModal({ open, patientId, onClose }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(blankForm());
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    setForm(blankForm());
    setServerError(null);
  }, [open]);

  const vaccinesQuery = useQuery({
    queryKey: ["vaccines"],
    queryFn: ({ signal }) => listVaccines(signal),
    staleTime: 5 * 60_000,
  });

  const vaccines = vaccinesQuery.data ?? [];

  const mutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!form.immunizationsVaccineId) throw new Error("Select a vaccine.");
      const payload: CreateImmunizationPayload = {
        immunizationsVaccineId: form.immunizationsVaccineId,
        dose: nonEmpty(form.dose),
        ageAdministered: nonEmpty(form.ageAdministered),
        dateAdministered: form.dateAdministered || null,
        physician: nonEmpty(form.physician),
      };
      await createImmunization(patientId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", "immunizations", patientId] });
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

  const canSubmit = !!form.immunizationsVaccineId;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      title="Add immunization"
      size="md"
      initialFocusId="imm-vaccine"
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
            form="immunization-form"
            disabled={mutation.isPending || !canSubmit}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {mutation.isPending ? "Saving…" : "Add"}
          </button>
        </>
      }
    >
      <form id="immunization-form" onSubmit={onSubmit} className="space-y-4">
        {serverError && (
          <div role="alert" className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
            {serverError}
          </div>
        )}

        <div>
          <FieldLabel htmlFor="imm-vaccine" required>
            Vaccine
          </FieldLabel>
          {vaccinesQuery.isLoading ? (
            <div className="rounded-[10px] border border-rule bg-card px-3 py-2 text-[13px] text-ink-3">
              Loading vaccines…
            </div>
          ) : (
            <SearchableSelect
              id="imm-vaccine"
              value={form.immunizationsVaccineId}
              onChange={(v) =>
                setForm((f) => ({ ...f, immunizationsVaccineId: String(v) }))
              }
              emptyLabel="— Select vaccine —"
              options={vaccines.map((v) => ({
                value: v.immunizationsVaccineId,
                label: v.name,
              }))}
            />
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextInput
            label="Date administered"
            type="date"
            value={form.dateAdministered}
            onChange={(v) => setForm((f) => ({ ...f, dateAdministered: v }))}
            mono
          />
          <TextInput
            label="Dose"
            placeholder="e.g. 0.5 mL"
            value={form.dose}
            onChange={(v) => setForm((f) => ({ ...f, dose: v }))}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextInput
            label="Age administered"
            placeholder="e.g. 6 months"
            value={form.ageAdministered}
            onChange={(v) => setForm((f) => ({ ...f, ageAdministered: v }))}
          />
          <TextInput
            label="Physician"
            placeholder="Administering physician"
            value={form.physician}
            onChange={(v) => setForm((f) => ({ ...f, physician: v }))}
          />
        </div>
      </form>
    </Modal>
  );
}
