import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ConfirmModal } from "../../components/ConfirmModal";
import {
  createRecommendation,
  deleteRecommendation,
  processRecommendation,
  type VisitDetail,
} from "./api";

type Rec = VisitDetail["afterVisitRecommendations"][number];

interface Props {
  visitId: string;
  initialRecs: Rec[];
  title?: ReactNode;
  id?: string;
}

export function RecommendationsCard({ visitId, initialRecs, title, id }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Rec | null>(null);

  const invalidate = (): void => {
    queryClient.invalidateQueries({ queryKey: ["visits", "detail", visitId] });
  };

  const createMutation = useMutation({
    mutationFn: () => createRecommendation(visitId, { recommended: text.trim() }),
    onSuccess: () => {
      invalidate();
      setShowForm(false);
      setText("");
    },
  });

  const processMutation = useMutation({
    mutationFn: (recId: string) => processRecommendation(visitId, recId),
    onSuccess: () => invalidate(),
  });

  const deleteMutation = useMutation({
    mutationFn: (recId: string) => deleteRecommendation(visitId, recId),
    onSuccess: () => {
      invalidate();
      setConfirmDelete(null);
    },
  });

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    if (!text.trim()) return;
    createMutation.mutate();
  };

  const pending = initialRecs.filter((r) => !r.isDone);
  const done = initialRecs.filter((r) => r.isDone);

  return (
    <>
      <div id={id} className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rule px-5 py-4">
          <h2 className="font-serif text-xl">{title ?? "Follow-up actions"}</h2>
          <button
            type="button"
            onClick={() => setShowForm((p) => !p)}
            className="rounded-[10px] bg-primary px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-primary-600"
          >
            {showForm ? "Cancel" : "+ Add"}
          </button>
        </div>

        {/* Inline add form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="border-b border-rule bg-card-2 px-5 py-4 space-y-3"
          >
            <div>
              <label className="mb-1 block text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
                Recommendation
              </label>
              <textarea
                required
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={2}
                dir="auto"
                placeholder="e.g. Go for CBC blood test…"
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
                  setText("");
                }}
                className="rounded-[10px] border border-rule bg-card px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:border-rule-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!text.trim() || createMutation.isPending}
                className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
              >
                {createMutation.isPending ? "Saving…" : "Add"}
              </button>
            </div>
          </form>
        )}

        {/* Empty state */}
        {initialRecs.length === 0 && !showForm && (
          <div className="px-5 py-4 text-[13px] text-ink-3">No follow-up actions recorded.</div>
        )}

        {/* Pending items */}
        {pending.length > 0 && (
          <ul className="divide-y divide-dashed divide-rule">
            {pending.map((r) => (
              <li key={r.afterVisitRecommendationId} className="flex items-start gap-3 px-5 py-3">
                {/* Circle icon */}
                <span
                  aria-hidden
                  className="mt-0.5 shrink-0 size-4 rounded-full border-2 border-ink-3"
                />
                <p className="flex-1 text-[13.5px] leading-6 text-ink-2" dir="auto">
                  {r.recommended}
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label="Mark as done"
                    title="Mark as done"
                    disabled={processMutation.isPending}
                    onClick={() => processMutation.mutate(r.afterVisitRecommendationId)}
                    className="rounded-full px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider text-vital-fg bg-vital-bg border border-vital-fg/30 transition-colors duration-2 hover:opacity-80 disabled:opacity-50"
                  >
                    ✓ Done
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(r)}
                    aria-label="Delete recommendation"
                    className="rounded-full px-2 py-0.5 text-[16px] leading-5 text-ink-4 transition-colors duration-2 hover:bg-alert-bg hover:text-alert-fg"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Done items */}
        {done.length > 0 && (
          <>
            {pending.length > 0 && <div className="border-t border-rule" />}
            <ul className="divide-y divide-dashed divide-rule opacity-60">
              {done.map((r) => (
                <li key={r.afterVisitRecommendationId} className="flex items-start gap-3 px-5 py-3">
                  {/* Checkmark icon */}
                  <span
                    aria-hidden
                    className="mt-0.5 shrink-0 size-4 rounded-full bg-vital-bg flex items-center justify-center text-vital-fg text-[10px] font-bold"
                  >
                    ✓
                  </span>
                  <p className="flex-1 text-[13.5px] leading-6 text-ink-3 line-through decoration-ink-4/50" dir="auto">
                    {r.recommended}
                  </p>
                  <span className="shrink-0 rounded-full bg-vital-bg px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wider text-vital-fg">
                    done
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <ConfirmModal
        open={!!confirmDelete}
        destructive
        title="Remove recommendation?"
        body={
          confirmDelete && (
            <>
              Remove{" "}
              <strong>&ldquo;{confirmDelete.recommended}&rdquo;</strong> from this visit? This
              action is logged but cannot be undone from the UI.
            </>
          )
        }
        confirmLabel="Remove"
        pending={deleteMutation.isPending}
        onConfirm={() => {
          if (confirmDelete) deleteMutation.mutate(confirmDelete.afterVisitRecommendationId);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}
