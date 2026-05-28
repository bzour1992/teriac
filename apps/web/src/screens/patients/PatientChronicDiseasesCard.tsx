import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmModal } from "../../components/ConfirmModal";
import { ApiError } from "../../lib/api/client";
import {
  deleteChronicDisease,
  listChronicDiseases,
  MONTH_LABEL,
  type ChronicDiseaseListItem,
} from "./history-api";
import { ChronicDiseaseFormModal } from "./ChronicDiseaseFormModal";

interface Props {
  patientId: string;
  title?: ReactNode;
  id?: string;
}

export function PatientChronicDiseasesCard({ patientId, title, id }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<
    { mode: "add" } | { mode: "edit"; item: ChronicDiseaseListItem } | null
  >(null);
  const [confirmDelete, setConfirmDelete] = useState<ChronicDiseaseListItem | null>(null);

  const query = useQuery({
    queryKey: ["patients", "chronic", patientId],
    queryFn: ({ signal }) => listChronicDiseases(patientId, signal),
    staleTime: 30_000,
  });

  const remove = useMutation({
    mutationFn: ({ id }: { id: string }) => deleteChronicDisease(patientId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", "chronic", patientId] });
      queryClient.invalidateQueries({ queryKey: ["patients", "detail", patientId] });
      setConfirmDelete(null);
    },
  });

  const items = query.data ?? [];

  return (
    <section id={id} className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
      <header className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3.5">
        <div className="flex items-baseline gap-3">
          <h2 className="font-serif text-xl">{title ?? "Chronic diseases"}</h2>
          {items.length > 0 && (
            <span className="inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-paper-3 px-1.5 font-mono text-[11px] font-semibold tabular-nums text-ink-2">
              {items.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setForm({ mode: "add" })}
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
        <div className="px-5 py-6 text-[13px] text-ink-3">No chronic diseases recorded.</div>
      ) : (
        <ul className="divide-y divide-dashed divide-rule">
          {items.map((c) => (
            <li key={c.chronicDiseaseId}>
              <div className="flex items-start gap-3 px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => setForm({ mode: "edit", item: c })}
                  className="flex-1 text-start"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[14px] font-medium">{c.conditionName}</span>
                    {c.yearDiagnosed != null && (
                      <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3 tnum">
                        since {c.monthDiagnosed ? `${MONTH_LABEL[c.monthDiagnosed]} ` : ""}
                        {c.yearDiagnosed}
                      </span>
                    )}
                  </div>
                  {c.notes && (
                    <div className="mt-0.5 text-[12.5px] text-ink-2" dir="auto">
                      {c.notes}
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(c)}
                  aria-label={`Delete ${c.conditionName}`}
                  className="rounded p-1 text-ink-4 transition-colors duration-2 hover:bg-paper-3 hover:text-alert-fg"
                >
                  <span aria-hidden className="text-base">×</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ChronicDiseaseFormModal
        patientId={patientId}
        item={form?.mode === "edit" ? form.item : null}
        open={!!form}
        onClose={() => setForm(null)}
      />

      <ConfirmModal
        open={!!confirmDelete}
        destructive
        title="Remove chronic disease?"
        body={
          confirmDelete && (
            <>
              Remove <strong>{confirmDelete.conditionName}</strong> from the chronic
              disease list. Hard delete — audit log keeps the trail.
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
          if (confirmDelete) remove.mutate({ id: confirmDelete.chronicDiseaseId });
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </section>
  );
}
