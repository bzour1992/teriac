import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmModal } from "../../components/ConfirmModal";
import { ApiError } from "../../lib/api/client";
import { toDateInput } from "../../lib/form-primitives";
import {
  deleteProblem,
  listProblems,
  PROBLEM_CATEGORY_LABEL,
  type ProblemListItem,
} from "./history-api";
import { ProblemFormModal } from "./ProblemFormModal";

interface Props {
  patientId: string;
  /** Optional card title override (e.g. from the per-clinic card-rule editor). */
  title?: ReactNode;
  /** DOM id — typically the card-rule key (e.g. "problems"). */
  id?: string;
}

function categoryStyle(category: number, isActive: boolean): { bg: string; fg: string } {
  if (isActive || category === 1)
    return { bg: "var(--vital-bg)", fg: "var(--vital-fg)" };
  if (category === 2)
    return { bg: "var(--paper-3)", fg: "var(--ink-3)" };
  return { bg: "var(--rule)", fg: "var(--ink-4)" };
}

export function PatientProblemsCard({ patientId, title, id }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<
    { mode: "add" } | { mode: "edit"; item: ProblemListItem } | null
  >(null);
  const [confirmDelete, setConfirmDelete] = useState<ProblemListItem | null>(null);

  const query = useQuery({
    queryKey: ["patients", "problems", patientId],
    queryFn: ({ signal }) => listProblems(patientId, signal),
    staleTime: 30_000,
  });

  const remove = useMutation({
    mutationFn: ({ id }: { id: string }) => deleteProblem(patientId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", "problems", patientId] });
      queryClient.invalidateQueries({ queryKey: ["patients", "detail", patientId] });
      setConfirmDelete(null);
    },
  });

  const unsortedProblems = query.data ?? [];
  // Most recent first: prefer lastOccurenceDate, fall back to onsetDate; missing dates sink.
  const problems = useMemo(() => {
    const rank = (p: ProblemListItem): number => {
      const d = p.lastOccurenceDate ?? p.onsetDate;
      if (!d) return -Infinity;
      const t = Date.parse(d);
      return Number.isFinite(t) ? t : -Infinity;
    };
    return [...unsortedProblems].sort((a, b) => rank(b) - rank(a));
  }, [unsortedProblems]);
  const activeCount = problems.filter((p) => p.isActive).length;

  return (
    <section id={id} className="relative overflow-hidden rounded-lg border border-rule bg-card shadow-1">
      {activeCount > 0 && (
        <div
          aria-hidden
          className="absolute inset-y-0 w-[3px]"
          style={{ insetInlineStart: 0, background: "var(--vital-fg)" }}
        />
      )}
      <header className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3.5">
        <div className="flex items-baseline gap-3">
          <h2 className="font-serif text-xl">{title ?? "Problems"}</h2>
          {problems.length > 0 && (
            <span className="inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-paper-3 px-1.5 font-mono text-[11px] font-semibold tabular-nums text-ink-2">
              {problems.length}
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
      ) : problems.length === 0 ? (
        <div className="px-5 py-6 text-[13px] text-ink-3">No problems recorded.</div>
      ) : (
        <ul className="divide-y divide-dashed divide-rule">
          {problems.map((p) => {
            const style = categoryStyle(p.problemCategory, p.isActive);
            return (
              <li key={p.patientProblemId}>
                <div className="group flex items-start gap-3 px-5 py-3.5">
                  <button
                    type="button"
                    onClick={() => setForm({ mode: "edit", item: p })}
                    className="flex-1 text-start"
                  >
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span
                        className={`text-[14px] font-medium ${p.isActive ? "" : "text-ink-2"}`}
                      >
                        {p.problemText}
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider"
                        style={{ background: style.bg, color: style.fg }}
                      >
                        {PROBLEM_CATEGORY_LABEL[p.problemCategory] ?? `cat ${p.problemCategory}`}
                      </span>
                    </div>
                    {p.onsetDate && (
                      <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-ink-4 tnum">
                        onset · {toDateInput(p.onsetDate)}
                      </div>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(p)}
                    aria-label={`Delete problem: ${p.problemText.slice(0, 40)}`}
                    className="rounded p-1 text-ink-4 transition-colors duration-2 hover:bg-paper-3 hover:text-alert-fg"
                  >
                    <span aria-hidden className="text-base">×</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ProblemFormModal
        open={!!form}
        patientId={patientId}
        item={form?.mode === "edit" ? form.item : null}
        onClose={() => setForm(null)}
      />

      <ConfirmModal
        open={!!confirmDelete}
        destructive
        title="Remove problem?"
        body={
          confirmDelete && (
            <>
              Remove{" "}
              <strong>
                {confirmDelete.problemText.length > 60
                  ? confirmDelete.problemText.slice(0, 60) + "…"
                  : confirmDelete.problemText}
              </strong>{" "}
              from the problem list.
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
          if (confirmDelete) remove.mutate({ id: confirmDelete.patientProblemId });
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </section>
  );
}
