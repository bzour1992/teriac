import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmModal } from "../../components/ConfirmModal";
import { ApiError } from "../../lib/api/client";
import { deleteInsurance, listInsurance, type InsuranceItem } from "./api";
import { InsuranceFormModal } from "./InsuranceFormModal";

interface Props {
  patientId: string;
  title?: ReactNode;
  id?: string;
}

export function PatientInsuranceCard({ patientId, title, id }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState<
    { mode: "add" } | { mode: "edit"; item: InsuranceItem } | null
  >(null);
  const [confirmDelete, setConfirmDelete] = useState<InsuranceItem | null>(null);

  const query = useQuery({
    queryKey: ["patients", "insurance", patientId],
    queryFn: ({ signal }) => listInsurance(patientId, signal),
    staleTime: 30_000,
  });

  const remove = useMutation({
    mutationFn: (iid: string) => deleteInsurance(patientId, iid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", "insurance", patientId] });
      queryClient.invalidateQueries({ queryKey: ["patients", "detail", patientId] });
      setConfirmDelete(null);
    },
  });

  const items = query.data ?? [];

  return (
    <section id={id} className="relative overflow-hidden rounded-lg border border-rule bg-card shadow-1">
      <header className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3.5">
        <div className="flex items-baseline gap-3">
          <h2 className="font-serif text-xl">{title ?? "Insurance"}</h2>
          {items.length > 0 && (
            <span className="inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-paper-3 px-1.5 font-mono text-[11px] font-semibold tabular-nums text-ink-2">
              {items.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setFormState({ mode: "add" })}
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
        <div className="px-5 py-6 text-[13px] text-ink-3">No insurance records.</div>
      ) : (
        <ul className="divide-y divide-dashed divide-rule">
          {items.map((item) => (
            <li key={item.patientInsuranceDetailId}>
              <div className="group flex items-start gap-3 px-5 py-3.5">
                {/* Status dot */}
                <span
                  aria-hidden
                  className="mt-1 size-2 shrink-0 rounded-full"
                  style={{
                    background: item.isActive
                      ? "var(--vital-fg)"
                      : "var(--ink-4)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setFormState({ mode: "edit", item })}
                  className="flex-1 text-start"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span
                      className={`text-[14px] font-medium ${
                        item.isActive ? "" : "text-ink-3"
                      }`}
                    >
                      {item.insuranceCompany}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider"
                      style={
                        item.isActive
                          ? {
                              background: "var(--vital-bg)",
                              color: "var(--vital-fg)",
                            }
                          : {
                              background: "var(--paper-3)",
                              color: "var(--ink-3)",
                            }
                      }
                    >
                      {item.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-[12.5px] text-ink-3">
                    {item.insuranceLevel && <span>Level: {item.insuranceLevel}</span>}
                    {item.coveragePercentage != null && (
                      <span className="tnum">{item.coveragePercentage}% coverage</span>
                    )}
                    {item.insuranceCardNumber && (
                      <span className="font-mono text-[11.5px]">
                        #{item.insuranceCardNumber}
                      </span>
                    )}
                  </div>
                  {item.participantName && (
                    <div className="mt-0.5 text-[12px] text-ink-4">
                      Participant: {item.participantName}
                      {item.relationToParticipant && (
                        <> ({item.relationToParticipant})</>
                      )}
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(item)}
                  aria-label={`Delete ${item.insuranceCompany}`}
                  className="rounded p-1 text-ink-4 transition-colors duration-2 hover:bg-paper-3 hover:text-alert-fg"
                >
                  <span aria-hidden className="text-base">×</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <InsuranceFormModal
        open={!!formState}
        patientId={patientId}
        item={formState?.mode === "edit" ? formState.item : null}
        onClose={() => setFormState(null)}
      />

      <ConfirmModal
        open={!!confirmDelete}
        destructive
        title="Remove insurance record?"
        body={
          confirmDelete && (
            <>
              Remove{" "}
              <strong>{confirmDelete.insuranceCompany}</strong> from the insurance
              list. This cannot be undone.
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
          if (confirmDelete) {
            remove.mutate(confirmDelete.patientInsuranceDetailId);
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </section>
  );
}
