import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { SearchableSelect } from "../../components/SearchableSelect";
import { ApiError } from "../../lib/api/client";
import { FieldLabel, TextInput, Textarea, nonEmpty, toDateInput } from "../../lib/form-primitives";
import {
  createProblem,
  updateProblem,
  PROBLEM_CATEGORY_LABEL,
  type ProblemListItem,
  type CreateProblemPayload,
  type UpdateProblemPayload,
} from "./history-api";

const CATEGORIES = [1, 2, 3, 4] as const;

interface Props {
  open: boolean;
  patientId: string;
  item: ProblemListItem | null;
  onClose: () => void;
}

interface FormState {
  problemText: string;
  problemCategory: number;
  onsetDate: string;
  isActive: boolean;
}

function blankForm(item: ProblemListItem | null): FormState {
  if (!item) {
    return {
      problemText: "",
      problemCategory: 1,
      onsetDate: "",
      isActive: true,
    };
  }
  return {
    problemText: item.problemText,
    problemCategory: item.problemCategory,
    onsetDate: toDateInput(item.onsetDate),
    isActive: item.isActive,
  };
}

export function ProblemFormModal({ open, patientId, item, onClose }: Props): JSX.Element {
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
      const text = form.problemText.trim();
      if (!text) throw new Error("Problem description is required.");
      if (mode === "add") {
        const payload: CreateProblemPayload = {
          problemText: text,
          problemCategory: form.problemCategory,
          onsetDate: form.onsetDate || null,
          isActive: form.isActive,
        };
        await createProblem(patientId, payload);
        return;
      }
      if (!item) return;
      const patch: UpdateProblemPayload = {};
      if (text !== item.problemText) patch.problemText = text;
      if (form.problemCategory !== item.problemCategory) patch.problemCategory = form.problemCategory;
      const nextOnset = form.onsetDate || null;
      const prevOnset = toDateInput(item.onsetDate) || null;
      if (nextOnset !== prevOnset) patch.onsetDate = nextOnset;
      if (form.isActive !== item.isActive) patch.isActive = form.isActive;
      if (Object.keys(patch).length === 0) return;
      await updateProblem(patientId, item.patientProblemId, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", "problems", patientId] });
      queryClient.invalidateQueries({ queryKey: ["patients", "detail", patientId] });
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

  const canSubmit = form.problemText.trim().length > 0;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      title={mode === "add" ? "Add problem" : "Edit problem"}
      size="md"
      initialFocusId="problem-text"
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
            form="problem-form"
            disabled={mutation.isPending || !canSubmit}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {mutation.isPending ? "Saving…" : mode === "add" ? "Add" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="problem-form" onSubmit={onSubmit} className="space-y-4">
        {serverError && (
          <div role="alert" className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
            {serverError}
          </div>
        )}

        <Textarea
          id="problem-text"
          label="Problem description"
          value={form.problemText}
          onChange={(v) => setForm((f) => ({ ...f, problemText: v }))}
          placeholder="Describe the problem…"
          rows={3}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>Category</FieldLabel>
            <SearchableSelect
              value={form.problemCategory}
              onChange={(v) =>
                setForm((f) => ({ ...f, problemCategory: Number(v) }))
              }
              options={CATEGORIES.map((c) => ({
                value: c,
                label: PROBLEM_CATEGORY_LABEL[c],
              }))}
            />
          </div>
          <TextInput
            label="Onset date"
            type="date"
            value={form.onsetDate}
            onChange={(v) => setForm((f) => ({ ...f, onsetDate: v }))}
            mono
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            className="size-4 rounded accent-primary"
          />
          <span className="text-[13.5px] text-ink-2">Active problem</span>
        </label>
      </form>
    </Modal>
  );
}
