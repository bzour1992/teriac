import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { ConfirmModal } from "../../components/ConfirmModal";
import { TextInput } from "../../lib/form-primitives";
import { ApiError } from "../../lib/api/client";
import {
  createBillingCategory,
  deleteBillingCategory,
  listBillingCategories,
  updateBillingCategory,
  type BillingCategoryItem,
} from "./billing-categories-api";

const QK = ["finance", "categories"] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtMoney = (n: number | null): string => {
  if (n == null) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function fmtRelative(s: string | null): string {
  if (!s) return "Never";
  const d = new Date(s.includes(" ") ? s.replace(" ", "T") : s);
  if (Number.isNaN(d.getTime())) return s;
  const days = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// ── Tab ──────────────────────────────────────────────────────────────────────

export function BillingCategoriesTab(): JSX.Element {
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<BillingCategoryItem | null>(null);
  const [confirmDel, setConfirmDel] = useState<BillingCategoryItem | null>(null);

  const q = useQuery({
    queryKey: QK,
    queryFn: ({ signal }) => listBillingCategories(signal),
    staleTime: 30_000,
  });

  const archive = useMutation({
    mutationFn: (cat: BillingCategoryItem) =>
      cat.isArchived
        ? updateBillingCategory(cat.transactionCategoryId, { isArchived: false })
        : deleteBillingCategory(cat.transactionCategoryId).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });

  const rows = useMemo(() => {
    const all = q.data?.data ?? [];
    return all
      .filter((c) => (showArchived ? true : !c.isArchived))
      .filter((c) =>
        filter === "all" ? true : filter === "income" ? c.isIncome : !c.isIncome,
      )
      .filter((c) =>
        search.trim() === "" ? true : c.name.toLowerCase().includes(search.trim().toLowerCase()),
      );
  }, [q.data, showArchived, filter, search]);

  const totalCount = q.data?.data.length ?? 0;
  const usedCount = (q.data?.data ?? []).filter((c) => c.usageCount > 0).length;
  const archivedCount = (q.data?.data ?? []).filter((c) => c.isArchived).length;

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-2">
        <Kpi label="Total" value={totalCount} tone="primary" />
        <Kpi label="In use" value={usedCount} tone="vital" />
        <Kpi label="Archived" value={archivedCount} tone="warn" />
      </div>

      {/* Filter card */}
      <section className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-mono text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
              Categories
            </h2>
            <span className="font-mono text-[11.5px] text-ink-4">{rows.length} shown</span>
          </div>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-[10px] bg-primary px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-primary-600"
          >
            + Add category
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-2 px-5 py-3">
          <FilterChip label="All" active={filter === "all"} onClick={() => setFilter("all")} />
          <FilterChip label="Income" active={filter === "income"} onClick={() => setFilter("income")} />
          <FilterChip label="Expense" active={filter === "expense"} onClick={() => setFilter("expense")} />
          <span className="mx-1 h-4 w-px bg-rule" />
          <label className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="size-3.5 rounded border-rule accent-primary"
            />
            Show archived
          </label>
          <input
            type="search"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ms-auto w-48 rounded-[10px] border border-rule bg-card px-3 py-1.5 text-[12.5px] outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
          />
        </div>

        {q.isLoading ? (
          <div className="px-5 py-10 text-center text-[13px] text-ink-3">Loading…</div>
        ) : q.error ? (
          <div className="px-5 py-10 text-center text-[13px] text-alert-fg">
            {(q.error as Error).message}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-ink-3">
            No categories match these filters.
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-rule bg-card-2">
                <Th>Name</Th>
                <Th>Type</Th>
                <Th className="text-end">Price</Th>
                <Th className="text-end">Usage</Th>
                <Th>Last used</Th>
                <Th className="text-end">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dashed divide-rule">
              {rows.map((c) => (
                <tr key={c.transactionCategoryId} className={c.isArchived ? "opacity-50" : ""}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink">{c.name}</span>
                      {c.isSystem && (
                        <span className="inline-flex items-center rounded-full bg-paper-3 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-ink-3">
                          System
                        </span>
                      )}
                      {c.isArchived && (
                        <span className="inline-flex items-center rounded-full bg-warn-bg px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-warn-fg">
                          Archived
                        </span>
                      )}
                      {c.isCheckup && (
                        <span
                          className="inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-primary-700"
                          title="Marked as a consult/check-up category"
                        >
                          Consult
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wider ${
                        c.isIncome
                          ? "bg-vital-bg text-vital-fg"
                          : "bg-paper-3 text-ink-3"
                      }`}
                    >
                      <span
                        className="size-1.5 rounded-full bg-current"
                        aria-hidden
                      />
                      {c.isIncome ? "Income" : "Expense"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end font-mono tnum text-ink-2">
                    {fmtMoney(c.defaultPrice)}
                  </td>
                  <td className="px-4 py-3 text-end font-mono tnum">
                    <span className={c.usageCount > 0 ? "text-ink-2" : "text-ink-4"}>
                      {c.usageCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-ink-3">
                    {fmtRelative(c.lastUsedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditing(c)}
                        disabled={c.isSystem}
                        title={c.isSystem ? "System categories cannot be edited" : "Edit"}
                        className="rounded-[8px] border border-rule bg-card px-2 py-1 text-[11.5px] font-medium text-ink-2 hover:border-rule-2 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (c.isArchived) {
                            archive.mutate(c);
                          } else {
                            setConfirmDel(c);
                          }
                        }}
                        disabled={archive.isPending}
                        className={`rounded-[8px] border px-2 py-1 text-[11.5px] font-medium disabled:opacity-50 ${
                          c.isArchived
                            ? "border-primary/30 bg-primary-50 text-primary-700 hover:bg-primary-100"
                            : "border-alert-fg/30 bg-alert-bg/40 text-alert-fg hover:bg-alert-bg"
                        }`}
                      >
                        {c.isArchived ? "Restore" : "Archive"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <CategoryFormModal
        open={adding}
        category={null}
        onClose={() => setAdding(false)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: QK });
          setAdding(false);
        }}
      />
      <CategoryFormModal
        open={editing != null}
        category={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: QK });
          setEditing(null);
        }}
      />
      <ConfirmModal
        open={confirmDel != null}
        title={`Archive "${confirmDel?.name ?? ""}"?`}
        body={
          confirmDel ? (
            <div className="space-y-2 text-[13.5px] text-ink-2">
              <p>
                {confirmDel.usageCount > 0
                  ? `This category is referenced by ${confirmDel.usageCount} billing record(s). It will be archived (hidden from new pickers) but historical references stay intact.`
                  : "This category has no usage yet — it will be permanently deleted."}
              </p>
            </div>
          ) : null
        }
        confirmLabel={
          confirmDel && confirmDel.usageCount === 0 ? "Delete" : "Archive"
        }
        destructive={confirmDel?.usageCount === 0}
        pending={archive.isPending}
        onConfirm={() => {
          if (confirmDel) {
            archive.mutate(confirmDel, {
              onSuccess: () => setConfirmDel(null),
            });
          }
        }}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}

// ── Add/edit modal ──────────────────────────────────────────────────────────

function CategoryFormModal({
  open,
  category,
  onClose,
  onSaved,
}: {
  open: boolean;
  category: BillingCategoryItem | null;
  onClose: () => void;
  onSaved: () => void;
}): JSX.Element {
  const [name, setName] = useState("");
  const [isIncome, setIsIncome] = useState(true);
  const [isCheckup, setIsCheckup] = useState(false);
  const [defaultPrice, setDefaultPrice] = useState("0");
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (category) {
      setName(category.name);
      setIsIncome(category.isIncome);
      setIsCheckup(category.isCheckup);
      setDefaultPrice(String(category.defaultPrice));
    } else {
      setName("");
      setIsIncome(true);
      setIsCheckup(false);
      setDefaultPrice("0");
    }
    setServerError(null);
  }, [open, category]);

  const mutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const parsedDefault = Number(defaultPrice);
      if (Number.isNaN(parsedDefault) || parsedDefault < 0) {
        throw new Error("Default price must be a non-negative number");
      }
      if (category) {
        await updateBillingCategory(category.transactionCategoryId, {
          name: name.trim(),
          isIncome,
          isCheckup,
          defaultPrice: parsedDefault,
        });
      } else {
        await createBillingCategory({
          name: name.trim(),
          isIncome,
          isCheckup,
          defaultPrice: parsedDefault,
        });
      }
    },
    onSuccess: onSaved,
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : (err as Error).message);
    },
  });

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    setServerError(null);
    mutation.mutate();
  };

  const canSubmit = name.trim().length > 0 && defaultPrice.trim().length > 0;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      title={category ? "Edit category" : "Add billing category"}
      size="md"
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
            form="cat-form"
            disabled={mutation.isPending || !canSubmit}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {mutation.isPending ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form id="cat-form" onSubmit={onSubmit} className="space-y-4">
        {serverError && (
          <div role="alert" className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
            {serverError}
          </div>
        )}

        <TextInput
          label="Name"
          required
          value={name}
          onChange={setName}
          placeholder="e.g. Consultation, Lab, Pharmacy"
        />

        <TextInput
          label="Default price"
          required
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          mono
          value={defaultPrice}
          onChange={setDefaultPrice}
        />

        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-[13.5px] text-ink-2">
            <input
              type="checkbox"
              checked={isIncome}
              onChange={(e) => setIsIncome(e.target.checked)}
              className="size-4 rounded border-rule accent-primary"
            />
            Income (uncheck for expense)
          </label>
          <label className="inline-flex items-center gap-2 text-[13.5px] text-ink-2">
            <input
              type="checkbox"
              checked={isCheckup}
              onChange={(e) => setIsCheckup(e.target.checked)}
              className="size-4 rounded border-rule accent-primary"
            />
            Consult / check-up category
          </label>
        </div>
      </form>
    </Modal>
  );
}


// ── Small bits ──────────────────────────────────────────────────────────────

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "vital" | "warn" | "alert" | "info";
}): JSX.Element {
  const cls = {
    primary: { rail: "bg-primary", text: "text-ink" },
    vital: { rail: "bg-vital-fg", text: "text-vital-fg" },
    warn: { rail: "bg-warn-fg", text: "text-warn-fg" },
    alert: { rail: "bg-alert-fg", text: "text-alert-fg" },
    info: { rail: "bg-primary-300", text: "text-primary-700" },
  }[tone];
  return (
    <div className="relative overflow-hidden rounded-[10px] border border-rule bg-card shadow-1">
      <div className={`absolute inset-y-0 start-0 w-[3px] ${cls.rail}`} />
      <div className="px-3 py-2 ps-4">
        <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-3">
          {label}
        </div>
        <div className={`mt-0.5 font-serif text-[22px] leading-none tnum ${cls.text}`}>
          {value.toLocaleString()}
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider transition-colors duration-2 ${
        active ? "bg-primary-100 text-primary-700" : "bg-paper-3 text-ink-3 hover:bg-paper-2"
      }`}
    >
      {label}
    </button>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <th
      className={`px-4 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3 ${className}`}
    >
      {children}
    </th>
  );
}
