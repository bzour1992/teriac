import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmModal } from "../../components/ConfirmModal";
import { ApiError } from "../../lib/api/client";
import {
  deleteLongTermMedication,
  listLongTermMedications,
  type LongTermMedicationListItem,
} from "./history-api";
import { LongTermMedicationFormModal } from "./LongTermMedicationFormModal";

interface Props {
  patientId: string;
  title?: ReactNode;
  id?: string;
}

export function PatientLongTermMedicationsCard({ patientId, title, id }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<
    { mode: "add" } | { mode: "edit"; item: LongTermMedicationListItem } | null
  >(null);
  const [confirmDelete, setConfirmDelete] = useState<LongTermMedicationListItem | null>(null);

  const query = useQuery({
    queryKey: ["patients", "ltm", patientId],
    queryFn: ({ signal }) => listLongTermMedications(patientId, signal),
    staleTime: 30_000,
  });

  const remove = useMutation({
    mutationFn: ({ id }: { id: string }) => deleteLongTermMedication(patientId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", "ltm", patientId] });
      queryClient.invalidateQueries({ queryKey: ["patients", "detail", patientId] });
      setConfirmDelete(null);
    },
  });

  const items = query.data ?? [];

  return (
    <section id={id} className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
      <header className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3.5">
        <div className="flex items-baseline gap-3">
          <h2 className="font-serif text-xl">{title ?? "Long-term medications"}</h2>
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
        <div className="px-5 py-6 text-[13px] text-ink-3">No long-term medications recorded.</div>
      ) : (
        <ul className="divide-y divide-dashed divide-rule">
          {items.map((m) => (
            <li key={m.patientLongTermMedicineId}>
              <div className="flex items-start gap-3 px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => setForm({ mode: "edit", item: m })}
                  className="flex-1 text-start"
                >
                  <div className="text-[14px] font-medium">{m.medicineName}</div>
                  {m.scientificName && m.scientificName !== m.medicineName && (
                    <div className="text-[12px] text-ink-3" dir="auto">
                      {m.scientificName}
                    </div>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-ink-3">
                    {m.dose && <span className="font-mono">{m.dose}</span>}
                    {m.route && <span>{m.route}</span>}
                    {m.frequency != null && (
                      <span>
                        <span className="font-mono">{m.frequency}</span>
                        {m.frequencyUnit ? ` ${m.frequencyUnit}` : ""}
                      </span>
                    )}
                    {m.period && <span>{m.period}</span>}
                    {m.indication && (
                      <span className="italic" dir="auto">
                        for {m.indication}
                      </span>
                    )}
                  </div>
                  {(m.prescribedBy || m.prescriptionDate) && (
                    <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-ink-4 tnum">
                      {m.prescribedBy && <span>{m.prescribedBy}</span>}
                      {m.prescribedBy && m.prescriptionDate && <span> · </span>}
                      {m.prescriptionDate && <span>{m.prescriptionDate.slice(0, 10)}</span>}
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(m)}
                  aria-label={`Delete ${m.medicineName}`}
                  className="rounded p-1 text-ink-4 transition-colors duration-2 hover:bg-paper-3 hover:text-alert-fg"
                >
                  <span aria-hidden className="text-base">×</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <LongTermMedicationFormModal
        patientId={patientId}
        item={form?.mode === "edit" ? form.item : null}
        open={!!form}
        onClose={() => setForm(null)}
      />

      <ConfirmModal
        open={!!confirmDelete}
        destructive
        title="Remove medication?"
        body={
          confirmDelete && (
            <>
              Remove <strong>{confirmDelete.medicineName}</strong> from the long-term
              medication list. Hard delete — audit log keeps the trail.
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
          if (confirmDelete) remove.mutate({ id: confirmDelete.patientLongTermMedicineId });
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </section>
  );
}
