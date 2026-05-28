import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { SearchableSelect } from "../../components/SearchableSelect";
import { FieldLabel } from "../../lib/form-primitives";
import { ApiError } from "../../lib/api/client";
import { addBillingRecord, listCategories } from "./billing-api";

interface Props {
  open: boolean;
  visitId: string;
  onClose: () => void;
}

export function AddChargeModal({ open, visitId, onClose }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [categoryId, setCategoryId] = useState("");
  const [expense, setExpense] = useState("");
  const [details, setDetails] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  const categoriesQ = useQuery({
    queryKey: ["categories"],
    queryFn: ({ signal }) => listCategories(signal),
    staleTime: 5 * 60_000,
  });
  const categories = (categoriesQ.data?.data ?? []).filter((c) => !c.isArchived);
  const incomeCategories = categories.filter((c) => c.isIncome);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setCategoryId(incomeCategories[0]?.transactionCategoryId ?? "");
      setExpense(incomeCategories[0] ? String(incomeCategories[0].defaultPrice) : "");
      setDetails("");
      setServerError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // When category changes, pre-fill expense with defaultPrice
  const handleCategoryChange = (id: string): void => {
    setCategoryId(id);
    const cat = categories.find((c) => c.transactionCategoryId === id);
    if (cat) setExpense(String(cat.defaultPrice));
  };

  const mutation = useMutation({
    mutationFn: () =>
      addBillingRecord(visitId, {
        transactionCategoryId: categoryId,
        expense: parseFloat(expense) || 0,
        details: details.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", visitId] });
      onClose();
    },
    onError: (err) => {
      setServerError(
        err instanceof ApiError ? err.message : (err as Error).message || "Failed to add charge",
      );
    },
  });

  const canSubmit =
    categoryId.length > 0 && parseFloat(expense) >= 0 && !isNaN(parseFloat(expense));

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
      title="Add charge"
      size="sm"
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
            form="add-charge-form"
            disabled={!canSubmit || mutation.isPending}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {mutation.isPending ? "Adding…" : "Add charge"}
          </button>
        </>
      }
    >
      <form id="add-charge-form" onSubmit={onSubmit} className="space-y-4">
        {serverError && (
          <div role="alert" className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
            {serverError}
          </div>
        )}

        <div>
          <FieldLabel htmlFor="charge-category" required>
            Service / Category
          </FieldLabel>
          {categoriesQ.isLoading ? (
            <div className="rounded-[10px] border border-rule bg-card px-3 py-2 text-[13px] text-ink-3">
              Loading categories…
            </div>
          ) : (
            <SearchableSelect
              id="charge-category"
              value={categoryId}
              onChange={(v) => handleCategoryChange(String(v))}
              required
              emptyLabel="Select a category…"
              options={incomeCategories.map((c) => ({
                value: c.transactionCategoryId,
                label: c.name,
              }))}
            />
          )}
        </div>

        <div>
          <FieldLabel htmlFor="charge-expense" required>
            Amount
          </FieldLabel>
          <input
            id="charge-expense"
            type="number"
            min="0"
            step="0.01"
            value={expense}
            onChange={(e) => setExpense(e.target.value)}
            className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 font-mono text-[13.5px] tnum outline-none transition-colors duration-[150ms] hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
          />
        </div>

        <div>
          <FieldLabel htmlFor="charge-details">
            Description <span className="text-ink-4">(optional)</span>
          </FieldLabel>
          <input
            id="charge-details"
            type="text"
            value={details}
            placeholder="Leave blank to use category name"
            onChange={(e) => setDetails(e.target.value)}
            className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 text-[13.5px] outline-none transition-colors duration-[150ms] hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
          />
        </div>
      </form>
    </Modal>
  );
}
