import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmModal } from "../../components/ConfirmModal";
import { createRevisit, deleteRevisit, listRevisits, type RevisitItem } from "./api";

interface Props {
  visitId: string;
  title?: ReactNode;
  id?: string;
}

/** Format a MySQL datetime string or ISO string into a human-readable date. */
function parseRevisitDate(raw: string): Date {
  // MySQL format: "YYYY-MM-DD HH:MM:SS.mmm"
  const normalized = raw.includes(" ") ? raw.replace(" ", "T") + "Z" : raw;
  return new Date(normalized);
}

function formatDate(d: Date): string {
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** How many days from now until this date. */
function relativeLabel(d: Date): string {
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = d.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays === -1) return "yesterday";
  if (diffDays > 0) return `in ${diffDays}d`;
  return `${Math.abs(diffDays)}d ago`;
}

export function RevisitsCard({ visitId, title, id }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [revisitDate, setRevisitDate] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<RevisitItem | null>(null);

  const query = useQuery({
    queryKey: ["revisits", visitId],
    queryFn: ({ signal }) => listRevisits(visitId, signal),
    staleTime: 30_000,
  });

  const invalidate = (): void => {
    queryClient.invalidateQueries({ queryKey: ["revisits", visitId] });
    queryClient.invalidateQueries({ queryKey: ["visits", "detail", visitId] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      createRevisit(visitId, {
        revisitDate,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setShowForm(false);
      setRevisitDate("");
      setNotes("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (revId: string) => deleteRevisit(visitId, revId),
    onSuccess: () => {
      invalidate();
      setConfirmDelete(null);
    },
  });

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    if (!revisitDate) return;
    createMutation.mutate();
  };

  const items = query.data ?? [];

  return (
    <>
      <div id={id} className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rule px-5 py-4">
          <h2 className="font-serif text-xl">{title ?? "Follow-up visits"}</h2>
          <button
            type="button"
            onClick={() => setShowForm((p) => !p)}
            className="rounded-[10px] bg-primary px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-primary-600"
          >
            {showForm ? "Cancel" : "+ Schedule"}
          </button>
        </div>

        {/* Inline add form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="border-b border-rule bg-card-2 px-5 py-4 space-y-3"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
                  Follow-up date
                </label>
                <input
                  type="date"
                  required
                  value={revisitDate}
                  onChange={(e) => setRevisitDate(e.target.value)}
                  className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 font-mono text-[13.5px] tnum outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                dir="auto"
                placeholder="Reason for follow-up…"
                className="w-full resize-none rounded-[10px] border border-rule bg-card px-3 py-2 text-[13.5px] leading-6 outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
              />
            </div>
            {createMutation.error && (
              <div role="alert" className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
                {(createMutation.error as Error).message}
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setRevisitDate("");
                  setNotes("");
                }}
                className="rounded-[10px] border border-rule bg-card px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:border-rule-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!revisitDate || createMutation.isPending}
                className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
              >
                {createMutation.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}

        {/* List */}
        {query.isLoading ? (
          <div className="px-5 py-4">
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-[10px] bg-paper-3" />
              ))}
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="px-5 py-4 text-[13px] text-ink-3">No follow-up visits scheduled.</div>
        ) : (
          <ul className="divide-y divide-dashed divide-rule">
            {items.map((item) => {
              const d = parseRevisitDate(item.revisitDate);
              const rel = relativeLabel(d);
              return (
                <li key={item.pvRevisitId} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 text-[13.5px]">
                      <span className="font-mono tnum font-medium">{formatDate(d)}</span>
                      {rel && (
                        <span className="font-mono text-[11.5px] text-ink-3">{rel}</span>
                      )}
                    </div>
                    {(item.notes || item.comments) && (
                      <p className="mt-0.5 text-[12.5px] text-ink-3 leading-5" dir="auto">
                        {item.notes || item.comments}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(item)}
                    aria-label="Delete follow-up"
                    className="shrink-0 rounded-full px-2 py-0.5 text-[16px] leading-5 text-ink-4 transition-colors duration-2 hover:bg-alert-bg hover:text-alert-fg"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmModal
        open={!!confirmDelete}
        destructive
        title="Remove follow-up?"
        body={
          confirmDelete && (
            <>
              Remove the follow-up scheduled for{" "}
              <strong className="font-mono tnum">
                {formatDate(parseRevisitDate(confirmDelete.revisitDate))}
              </strong>
              ? This cannot be undone.
            </>
          )
        }
        confirmLabel="Remove"
        pending={deleteMutation.isPending}
        onConfirm={() => {
          if (confirmDelete) deleteMutation.mutate(confirmDelete.pvRevisitId);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}
