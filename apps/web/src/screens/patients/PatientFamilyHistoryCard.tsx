import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmModal } from "../../components/ConfirmModal";
import { ApiError } from "../../lib/api/client";
import { deleteFamilyHistory, listFamilyHistory, type FamilyHistoryItem } from "./history-api";
import { FamilyHistoryFormModal } from "./FamilyHistoryFormModal";

interface Props {
  patientId: string;
  title?: ReactNode;
  id?: string;
}

export function PatientFamilyHistoryCard({ patientId, title, id }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<FamilyHistoryItem | null>(null);

  const query = useQuery({
    queryKey: ["patients", "family-history", patientId],
    queryFn: ({ signal }) => listFamilyHistory(patientId, signal),
    staleTime: 30_000,
  });

  const remove = useMutation({
    mutationFn: ({ id }: { id: string }) => deleteFamilyHistory(patientId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", "family-history", patientId] });
      setConfirmDelete(null);
    },
  });

  const items = query.data ?? [];

  return (
    <section id={id} className="rounded-lg border border-rule bg-card shadow-1">
      <header className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3.5">
        <div className="flex items-baseline gap-3">
          <h2 className="font-serif text-xl">{title ?? "Family history"}</h2>
          {items.length > 0 && (
            <span className="inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-paper-3 px-1.5 font-mono text-[11px] font-semibold tabular-nums text-ink-2">
              {items.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-[10px] bg-primary px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-primary-600"
        >
          + Add
        </button>
      </header>

      {query.isLoading ? (
        <div className="px-5 py-6 text-[13px] text-ink-3">Loading…</div>
      ) : query.error ? (
        <div className="px-5 py-6 text-[13px] text-alert-fg">
          {(query.error as Error).message}
        </div>
      ) : items.length === 0 ? (
        <div className="px-5 py-6 text-[13px] text-ink-3">No family history recorded.</div>
      ) : (
        <ul className="divide-y divide-dashed divide-rule">
          {items.map((item) => (
            <li key={item.pfiHereditaryDiseasesId}>
              <div className="flex items-start gap-3 px-5 py-3.5">
                <div className="flex-1">
                  <div className="text-[14px] font-medium">{item.conditionName}</div>
                  {item.description && (
                    <div className="mt-0.5 text-[12.5px] text-ink-3" dir="auto">
                      {item.description}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(item)}
                  aria-label={`Delete ${item.conditionName}`}
                  className="rounded p-1 text-ink-4 transition-colors duration-2 hover:bg-paper-3 hover:text-alert-fg"
                >
                  <span aria-hidden className="text-base">×</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <FamilyHistoryFormModal
        open={adding}
        patientId={patientId}
        onClose={() => setAdding(false)}
      />

      <ConfirmModal
        open={!!confirmDelete}
        destructive
        title="Remove family history?"
        body={
          confirmDelete && (
            <>
              Remove <strong>{confirmDelete.conditionName}</strong> from the family history list.
              {(remove.error as ApiError | undefined) && (
                <div className="mt-3 rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
                  {(remove.error as Error).message}
                </div>
              )}
            </>
          )
        }
        confirmLabel="Remove"
        pending={remove.isPending}
        onConfirm={() => {
          if (confirmDelete) remove.mutate({ id: confirmDelete.pfiHereditaryDiseasesId });
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </section>
  );
}
