import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { ApiError } from "../../lib/api/client";
import { FieldLabel, TextInput, nonEmpty, toDateInput } from "../../lib/form-primitives";
import {
  createLabRequest,
  updateLabRequest,
  type LabRequestListItem,
  type CreateLabRequestPayload,
  type UpdateLabRequestPayload,
} from "./history-api";

interface Props {
  open: boolean;
  patientId: string;
  item: LabRequestListItem | null;
  onClose: () => void;
}

interface FormState {
  labRequest: string;
  lab: string;
  requestDate: string;
  expectedDeliveryDate: string;
  isDelivered: boolean;
  deliveryDate: string;
}

function blankForm(item: LabRequestListItem | null): FormState {
  if (!item) {
    return {
      labRequest: "",
      lab: "",
      requestDate: new Date().toISOString().slice(0, 10),
      expectedDeliveryDate: "",
      isDelivered: false,
      deliveryDate: "",
    };
  }
  return {
    labRequest: item.labRequest,
    lab: item.lab ?? "",
    requestDate: toDateInput(item.requestDate),
    expectedDeliveryDate: toDateInput(item.expectedDeliveryDate),
    isDelivered: item.isDelivered,
    deliveryDate: toDateInput(item.deliveryDate),
  };
}

export function LabRequestFormModal({ open, patientId, item, onClose }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const initial = useMemo(() => blankForm(item), [item]);
  const [form, setForm] = useState<FormState>(initial);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    setForm(initial);
    setServerError(null);
  }, [initial, open]);

  const mode: "add" | "edit" = item ? "edit" : "add";

  const mutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const reqText = form.labRequest.trim();
      if (!reqText) throw new Error("Lab request description is required.");
      if (!form.requestDate) throw new Error("Request date is required.");
      if (!form.expectedDeliveryDate) throw new Error("Expected delivery date is required.");
      if (mode === "add") {
        const payload: CreateLabRequestPayload = {
          labRequest: reqText,
          lab: nonEmpty(form.lab),
          requestDate: form.requestDate,
          expectedDeliveryDate: form.expectedDeliveryDate,
        };
        await createLabRequest(patientId, payload);
        return;
      }
      if (!item) return;
      const patch: UpdateLabRequestPayload = {};
      if (reqText !== item.labRequest) patch.labRequest = reqText;
      const nextLab = nonEmpty(form.lab);
      if (nextLab !== (item.lab ?? null)) patch.lab = nextLab;
      if (form.isDelivered !== item.isDelivered) patch.isDelivered = form.isDelivered;
      if (form.isDelivered) {
        const nextDel = form.deliveryDate || null;
        const prevDel = toDateInput(item.deliveryDate) || null;
        if (nextDel !== prevDel) patch.deliveryDate = nextDel;
      }
      if (Object.keys(patch).length === 0) return;
      await updateLabRequest(patientId, item.patientLabRequestId, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", "lab-requests", patientId] });
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

  const canSubmit =
    form.labRequest.trim().length > 0 &&
    form.requestDate.length > 0 &&
    form.expectedDeliveryDate.length > 0;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      title={mode === "add" ? "Add lab request" : "Edit lab request"}
      size="md"
      initialFocusId="lr-request"
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
            form="lab-request-form"
            disabled={mutation.isPending || !canSubmit}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {mutation.isPending ? "Saving…" : mode === "add" ? "Add" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="lab-request-form" onSubmit={onSubmit} className="space-y-4">
        {serverError && (
          <div role="alert" className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
            {serverError}
          </div>
        )}

        <TextInput
          id="lr-request"
          label="Lab request"
          required
          value={form.labRequest}
          onChange={(v) => setForm((f) => ({ ...f, labRequest: v }))}
          placeholder="e.g. CBC, BMP, Lipid panel"
        />

        <TextInput
          label="Lab / facility"
          value={form.lab}
          onChange={(v) => setForm((f) => ({ ...f, lab: v }))}
          placeholder="e.g. National Lab, Hospital central lab"
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextInput
            label="Request date"
            required
            type="date"
            value={form.requestDate}
            onChange={(v) => setForm((f) => ({ ...f, requestDate: v }))}
            mono
          />
          <TextInput
            label="Expected delivery"
            required
            type="date"
            value={form.expectedDeliveryDate}
            onChange={(v) => setForm((f) => ({ ...f, expectedDeliveryDate: v }))}
            mono
          />
        </div>

        {mode === "edit" && (
          <>
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={form.isDelivered}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    isDelivered: e.target.checked,
                    deliveryDate: e.target.checked && !f.deliveryDate
                      ? new Date().toISOString().slice(0, 10)
                      : f.deliveryDate,
                  }))
                }
                className="size-4 rounded accent-primary"
              />
              <span className="text-[13.5px] text-ink-2">Results delivered</span>
            </label>

            {form.isDelivered && (
              <div>
                <FieldLabel>Delivery date</FieldLabel>
                <input
                  type="date"
                  value={form.deliveryDate}
                  onChange={(e) => setForm((f) => ({ ...f, deliveryDate: e.target.value }))}
                  className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 font-mono text-[13.5px] tnum outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
                />
              </div>
            )}
          </>
        )}
      </form>
    </Modal>
  );
}
