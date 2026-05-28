import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmModal } from "../../components/ConfirmModal";
import { ApiError } from "../../lib/api/client";
import {
  deleteAllergy,
  listAllergies,
  SEVERITY_LABEL,
  type AllergyListItem,
} from "./history-api";
import { AllergyFormModal } from "./AllergyFormModal";

interface Props {
  patientId: string;
  /** Title override from the per-clinic card-rule editor. */
  title?: ReactNode;
  id?: string;
}

// Severity colour key — escalates from warn-bg to alert-fg so the eye reaches
// life-threatening allergies first.
const SEVERITY_STYLE: Record<number, { background: string; color: string }> = {
  1: { background: "var(--paper-3)", color: "var(--ink-3)" },
  2: { background: "var(--warn-bg)", color: "var(--warn-fg)" },
  3: { background: "var(--alert-bg)", color: "var(--alert-fg)" },
  4: { background: "var(--alert-fg)", color: "#ffffff" },
};

export function PatientAllergiesCard({ patientId, title, id }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<{ mode: "add" } | { mode: "edit"; item: AllergyListItem } | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] = useState<AllergyListItem | null>(null);

  const query = useQuery({
    queryKey: ["patients", "allergies", patientId],
    queryFn: ({ signal }) => listAllergies(patientId, signal),
    staleTime: 30_000,
  });

  const remove = useMutation({
    mutationFn: ({ id }: { id: string }) => deleteAllergy(patientId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", "allergies", patientId] });
      queryClient.invalidateQueries({ queryKey: ["patients", "detail", patientId] });
      setConfirmDelete(null);
    },
  });

  const allergies = query.data ?? [];
  const hasAny = allergies.length > 0;
  // Severity ≥3 is "clinically significant" enough to escalate the card rail.
  const hasSerious = allergies.some((a) => (a.severity ?? 0) >= 3);

  return (
    <section
      id={id}
      className={`relative overflow-hidden rounded-lg border bg-card shadow-1 ${
        hasSerious ? "border-alert-fg/40" : "border-rule"
      }`}
    >
      {hasAny && (
        <div
          aria-hidden
          className="absolute inset-y-0 w-[3px]"
          style={{
            insetInlineStart: 0,
            background: hasSerious ? "var(--alert-fg)" : "var(--warn-fg)",
          }}
        />
      )}
      <header className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3.5">
        <div className="flex items-baseline gap-3">
          <h2 className="font-serif text-xl">{title ?? "Allergies"}</h2>
          {hasAny && (
            <span className="inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-paper-3 px-1.5 font-mono text-[11px] font-semibold tabular-nums text-ink-2">
              {allergies.length}
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
      ) : allergies.length === 0 ? (
        <div className="px-5 py-6 text-[13px] text-ink-3">No known allergies.</div>
      ) : (
        <ul className="divide-y divide-dashed divide-rule">
          {allergies.map((a) => (
            <li key={a.allergyId}>
              <div className="group flex items-start gap-3 px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => setForm({ mode: "edit", item: a })}
                  className="flex-1 text-start"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[14px] font-medium">{a.conditionName}</span>
                    {a.severity != null && (
                      <span
                        className="rounded-full px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider"
                        style={SEVERITY_STYLE[a.severity] ?? SEVERITY_STYLE[1]}
                      >
                        {SEVERITY_LABEL[a.severity] ?? `lvl ${a.severity}`}
                      </span>
                    )}
                  </div>
                  {a.reaction && (
                    <div className="mt-0.5 text-[12.5px] text-ink-2" dir="auto">
                      {a.reaction}
                    </div>
                  )}
                  {a.treatment && (
                    <div className="mt-0.5 text-[12px] text-ink-3" dir="auto">
                      Tx: {a.treatment}
                    </div>
                  )}
                  {a.lastOccurenceDate && (
                    <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-ink-4 tnum">
                      last reaction · {a.lastOccurenceDate.slice(0, 10)}
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(a)}
                  aria-label={`Delete ${a.conditionName}`}
                  className="rounded p-1 text-ink-4 transition-colors duration-2 hover:bg-paper-3 hover:text-alert-fg"
                >
                  <span aria-hidden className="text-base">×</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AllergyFormModal
        patientId={patientId}
        allergy={form?.mode === "edit" ? form.item : null}
        open={!!form}
        onClose={() => setForm(null)}
      />

      <ConfirmModal
        open={!!confirmDelete}
        destructive
        title="Remove allergy?"
        body={
          confirmDelete && (
            <>
              Remove <strong>{confirmDelete.conditionName}</strong> from the allergy list.
              This is a hard delete — the audit log keeps a record but the row is gone.
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
          if (confirmDelete) remove.mutate({ id: confirmDelete.allergyId });
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </section>
  );
}
