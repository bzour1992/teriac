import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSubstanceUse } from "./api";
import { SubstanceUseModal } from "./SubstanceUseModal";

interface Props {
  patientId: string;
  title?: ReactNode;
  id?: string;
}

export function PatientSubstanceUseCard({ patientId, title, id }: Props): JSX.Element {
  const [editing, setEditing] = useState(false);

  const query = useQuery({
    queryKey: ["patients", "substance-use", patientId],
    queryFn: ({ signal }) => getSubstanceUse(patientId, signal),
    staleTime: 60_000,
  });

  const data = query.data ?? null;

  // Build summary tags
  const tags: Array<{ icon: string; label: string; semantic?: "warn" | "alert" }> = [];

  if (data !== null && data !== undefined) {
    const anySmoking =
      data.stillSmoking || data.smokedBefore || data.liveWithSmokers;
    if (data.stillSmoking) {
      tags.push({ icon: "🚬", label: "Current smoker", semantic: "warn" });
    } else if (data.smokedBefore) {
      tags.push({ icon: "🚬", label: "Former smoker" });
    } else if (!anySmoking) {
      tags.push({ icon: "🚬", label: "Non-smoker" });
    }

    if (data.totalPackYear != null && data.totalPackYear > 0) {
      tags.push({
        icon: "",
        label: `${data.totalPackYear} pack-year${data.totalPackYear !== 1 ? "s" : ""}`,
      });
    }

    if (data.sheeshaHeadNumber != null && data.sheeshaHeadNumber > 0) {
      tags.push({ icon: "💨", label: "Shisha use", semantic: "warn" });
    }

    if (data.alcoholic) {
      tags.push({ icon: "🍺", label: "Alcohol use", semantic: "warn" });
    } else if (data.pastAlcoholic) {
      tags.push({ icon: "🍺", label: "Past alcohol use" });
    }

    if (data.drugUser) {
      tags.push({ icon: "💊", label: "Drug use reported", semantic: "alert" });
    }

    if (tags.length === 0) {
      tags.push({ icon: "✓", label: "No substance use noted" });
    }
  }

  return (
    <section id={id} className="relative overflow-hidden rounded-lg border border-rule bg-card shadow-1">
      <header className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3.5">
        <h2 className="font-serif text-xl">{title ?? "Substance use"}</h2>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-[10px] border border-rule bg-card px-3 py-1.5 text-[12.5px] font-medium text-ink-2 hover:border-rule-2"
        >
          {data ? "Edit" : "Record"}
        </button>
      </header>

      {query.isLoading ? (
        <div className="px-5 py-6 text-[13px] text-ink-3">Loading…</div>
      ) : query.error ? (
        <div className="px-5 py-6 text-[13px] text-alert-fg">
          {(query.error as Error).message}
        </div>
      ) : !data ? (
        <div className="px-5 py-6 text-[13px] text-ink-3">
          No substance use history recorded.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 px-5 py-4">
          {tags.map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium"
              style={
                tag.semantic === "alert"
                  ? { background: "var(--alert-bg)", color: "var(--alert-fg)" }
                  : tag.semantic === "warn"
                  ? { background: "var(--warn-bg)", color: "var(--warn-fg)" }
                  : { background: "var(--paper-3)", color: "var(--ink-2)" }
              }
            >
              {tag.icon && <span aria-hidden>{tag.icon}</span>}
              {tag.label}
            </span>
          ))}
          {data.smokingComments && (
            <div className="mt-2 w-full text-[12.5px] text-ink-3" dir="auto">
              {data.smokingComments}
            </div>
          )}
        </div>
      )}

      <SubstanceUseModal
        open={editing}
        patientId={patientId}
        initial={data}
        onClose={() => setEditing(false)}
      />
    </section>
  );
}
