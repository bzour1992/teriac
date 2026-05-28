import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmModal } from "../../components/ConfirmModal";
import { ApiError } from "../../lib/api/client";
import { toDateInput } from "../../lib/form-primitives";
import { deleteImmunization, listImmunizations, type ImmunizationListItem } from "./history-api";
import { ImmunizationFormModal } from "./ImmunizationFormModal";

interface Props {
  patientId: string;
  title?: ReactNode;
  id?: string;
}

export function PatientImmunizationsCard({ patientId, title, id }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ImmunizationListItem | null>(null);

  const query = useQuery({
    queryKey: ["patients", "immunizations", patientId],
    queryFn: ({ signal }) => listImmunizations(patientId, signal),
    staleTime: 30_000,
  });

  const remove = useMutation({
    mutationFn: ({ id }: { id: string }) => deleteImmunization(patientId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", "immunizations", patientId] });
      setConfirmDelete(null);
    },
  });

  const items = query.data ?? [];

  return (
    <section id={id} className="rounded-lg border border-rule bg-card shadow-1">
      <header className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3.5">
        <div className="flex items-baseline gap-3">
          <h2 className="font-serif text-xl">{title ?? "Immunizations"}</h2>
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
        <div className="px-5 py-6 text-[13px] text-ink-3">No immunizations recorded.</div>
      ) : (
        <ul className="divide-y divide-dashed divide-rule">
          {items.map((item) => (
            <li key={item.patientImmunizationId}>
              <div className="flex items-start gap-3 px-5 py-3.5">
                <div className="flex-1">
                  <div className="text-[14px] font-medium">{item.vaccineName}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] text-ink-3">
                    {item.dose && <span>Dose: {item.dose}</span>}
                    {item.ageAdministered && <span>Age: {item.ageAdministered}</span>}
                    {item.physician && <span>By: {item.physician}</span>}
                  </div>
                  {item.dateAdministered && (
                    <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-ink-4 tnum">
                      {toDateInput(item.dateAdministered)}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(item)}
                  aria-label={`Delete ${item.vaccineName}`}
                  className="rounded p-1 text-ink-4 transition-colors duration-2 hover:bg-paper-3 hover:text-alert-fg"
                >
                  <span aria-hidden className="text-base">×</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ImmunizationFormModal
        open={adding}
        patientId={patientId}
        onClose={() => setAdding(false)}
      />

      <ConfirmModal
        open={!!confirmDelete}
        destructive
        title="Remove immunization?"
        body={
          confirmDelete && (
            <>
              Remove <strong>{confirmDelete.vaccineName}</strong> from the immunization record.
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
          if (confirmDelete) remove.mutate({ id: confirmDelete.patientImmunizationId });
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </section>
  );
}
