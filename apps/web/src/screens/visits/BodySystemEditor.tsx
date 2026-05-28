import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listBodySystems, type BodySystem } from "./api";
import { ApiError } from "../../lib/api/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExistingEntry {
  bodySystemId: string;
  isNormal: boolean;
  notes: string | null;
}

interface RowState {
  isNormal: boolean;
  notes: string;
}

type DraftMap = Record<string, RowState>;

function buildDraft(systems: BodySystem[], existing: ExistingEntry[]): DraftMap {
  const byId: Record<string, ExistingEntry> = {};
  for (const e of existing) byId[e.bodySystemId] = e;
  const draft: DraftMap = {};
  for (const s of systems) {
    const found = byId[s.bodySystemId];
    draft[s.bodySystemId] = { isNormal: found ? found.isNormal : true, notes: found?.notes ?? "" };
  }
  return draft;
}

function isDirty(draft: DraftMap, systems: BodySystem[], existing: ExistingEntry[]): boolean {
  const byId: Record<string, ExistingEntry> = {};
  for (const e of existing) byId[e.bodySystemId] = e;
  for (const s of systems) {
    const row = draft[s.bodySystemId];
    if (!row) continue;
    const orig = byId[s.bodySystemId];
    if (row.isNormal !== (orig ? orig.isNormal : true)) return true;
    if (row.notes !== (orig?.notes ?? "")) return true;
  }
  return false;
}

interface Props {
  visitId: string;
  title: ReactNode;
  queryKey: string;
  fetchEntries: (visitId: string, signal?: AbortSignal) => Promise<ExistingEntry[]>;
  saveEntries: (visitId: string, items: Array<{ bodySystemId: string; isNormal: boolean; notes?: string }>) => Promise<{ lotGuid: string }>;
  saveLabel?: string;
  id?: string;
}

// ── Inline Normal/Abnormal toggle ─────────────────────────────────────────────

function Toggle({ isNormal, onNormal, onAbnormal }: { isNormal: boolean; onNormal: () => void; onAbnormal: () => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-[7px] border border-rule">
      <button type="button" onClick={onNormal}
        className={`px-2.5 py-0.5 text-[11px] font-medium transition-colors duration-[100ms] ${
          isNormal ? "bg-vital-bg text-vital-fg" : "bg-card text-ink-4 hover:bg-paper-3"
        }`}>
        Normal
      </button>
      <div className="w-px bg-rule" />
      <button type="button" onClick={onAbnormal}
        className={`px-2.5 py-0.5 text-[11px] font-medium transition-colors duration-[100ms] ${
          !isNormal ? "bg-alert-bg text-alert-fg" : "bg-card text-ink-4 hover:bg-paper-3"
        }`}>
        Abnormal
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BodySystemEditor({ visitId, title, queryKey, fetchEntries, saveEntries, saveLabel = "Save", id }: Props): JSX.Element {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const systemsQ = useQuery({ queryKey: ["body-systems"], queryFn: ({ signal }) => listBodySystems(signal), staleTime: 24 * 60 * 60_000 });
  const dataQ    = useQuery({ queryKey: [queryKey, visitId], queryFn: ({ signal }) => fetchEntries(visitId, signal), staleTime: 30_000 });

  const systems = useMemo(() => (systemsQ.data ?? []).slice().sort((a, b) => a.order - b.order), [systemsQ.data]);
  const existing = dataQ.data ?? [];
  const [draft, setDraft] = useState<DraftMap>(() => buildDraft(systems, existing));

  useEffect(() => {
    if (systems.length > 0) setDraft(buildDraft(systems, existing));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemsQ.data, dataQ.data]);

  const dirty         = useMemo(() => isDirty(draft, systems, existing), [draft, systems, existing]);
  const abnormalCount = useMemo(() => systems.filter(s => draft[s.bodySystemId] && !draft[s.bodySystemId].isNormal).length, [draft, systems]);
  const hasData       = existing.length > 0;

  const saveMut = useMutation({
    mutationFn: () => saveEntries(visitId, systems.map(s => ({
      bodySystemId: s.bodySystemId,
      isNormal: draft[s.bodySystemId]?.isNormal ?? true,
      notes: draft[s.bodySystemId]?.notes?.trim() || undefined,
    }))),
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey, visitId] }),
  });

  const set = (id: string, update: Partial<RowState>) =>
    setDraft(p => ({ ...p, [id]: { ...p[id], ...update } }));

  const markAllNormal = () => {
    const next: DraftMap = {};
    for (const s of systems) next[s.bodySystemId] = { isNormal: true, notes: "" };
    setDraft(next);
  };

  return (
    <div id={id} className={`overflow-hidden rounded-lg border bg-card shadow-1 ${hasData && abnormalCount > 0 ? "border-alert-fg/30" : "border-rule"}`}>

      {/* Header — always visible */}
      <div className="flex items-center gap-2.5 px-5 py-3.5">
        {/* Collapse chevron + title */}
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
          className="flex items-center gap-2 text-start focus-visible:outline-none">
          <span aria-hidden className={`text-[9px] text-ink-3 transition-transform duration-[200ms] ${open ? "rotate-90" : ""}`}>▶</span>
          <h2 className="font-serif text-[17px] font-medium tracking-tight text-ink">{title}</h2>
        </button>

        {/* Status badge */}
        {hasData && (
          abnormalCount > 0
            ? <span className="inline-flex items-center gap-1 rounded-full bg-alert-bg px-2 py-0.5 font-mono text-[10.5px] font-medium text-alert-fg">
                <span className="size-1.5 rounded-full bg-alert-fg" />{abnormalCount} abnormal
              </span>
            : <span className="inline-flex items-center gap-1 rounded-full bg-vital-bg px-2 py-0.5 font-mono text-[10.5px] font-medium text-vital-fg">
                <span className="size-1.5 rounded-full bg-vital-fg" />All normal
              </span>
        )}

        {/* Action buttons — only when open */}
        {open && (
          <div className="ms-auto flex items-center gap-2">
            <button type="button" onClick={markAllNormal} disabled={saveMut.isPending}
              className="rounded-[7px] border border-rule bg-card px-2.5 py-1 text-[11.5px] font-medium text-ink-3 hover:border-rule-2 hover:text-ink-2 disabled:opacity-50">
              All normal
            </button>
            <div className="relative">
              <button type="button" disabled={!dirty || saveMut.isPending} onClick={() => saveMut.mutate()}
                className={`rounded-[9px] px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors disabled:cursor-not-allowed ${
                  dirty && !saveMut.isPending ? "bg-primary hover:bg-primary-600" : "bg-primary-200"
                }`}>
                {saveMut.isPending ? "Saving…" : saveLabel}
              </button>
              {dirty && !saveMut.isPending && (
                <span className="absolute -top-1 -end-1 size-2 rounded-full border-2 border-card bg-warn-fg" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error banner */}
      {saveMut.error && open && (
        <div role="alert" className="border-t border-rule bg-alert-bg px-5 py-2 text-[13px] text-alert-fg">
          {saveMut.error instanceof ApiError ? saveMut.error.message : (saveMut.error as Error).message}
        </div>
      )}

      {/* Body — shown only when open */}
      {open && (
        <div className="border-t border-rule p-4">
          {systemsQ.isLoading ? (
            <div className="grid grid-cols-2 gap-1.5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-7 animate-pulse rounded bg-paper-3" />
              ))}
            </div>
          ) : systems.length === 0 ? (
            <p className="text-[13px] text-ink-3">No body systems configured.</p>
          ) : (
            <>
              {/* All-normal confirmation strip */}
              {hasData && abnormalCount === 0 && (
                <div className="mb-3 rounded-[8px] bg-vital-bg px-3 py-2 text-[12.5px] text-vital-fg">
                  ✓ All {systems.length} systems within normal limits.
                </div>
              )}

              {/* 2-column grid — rows are NOT full-width, they size to content */}
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {systems.map(s => {
                  const row = draft[s.bodySystemId] ?? { isNormal: true, notes: "" };
                  const isAbnormal = !row.isNormal;
                  return (
                    <div key={s.bodySystemId}
                      className={`rounded-[8px] ${isAbnormal ? "border border-alert-fg/20 bg-alert-bg/20" : "border border-transparent"}`}>

                      {/* Row: dot · name · toggle  — toggle is inline, not stretched */}
                      <div className="flex items-center gap-2 px-2.5 py-1.5">
                        <span className={`size-1.5 shrink-0 rounded-full transition-colors ${isAbnormal ? "bg-alert-fg" : "bg-vital-fg opacity-40"}`} />
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">{s.name}</span>
                        <Toggle
                          isNormal={!isAbnormal}
                          onNormal={() => set(s.bodySystemId, { isNormal: true })}
                          onAbnormal={() => set(s.bodySystemId, { isNormal: false })}
                        />
                      </div>

                      {/* Findings — only for abnormal */}
                      {isAbnormal && (
                        <div className="border-t border-alert-fg/15 px-2.5 pb-2.5 pt-2">
                          <textarea
                            value={row.notes}
                            onChange={e => set(s.bodySystemId, { notes: e.target.value })}
                            rows={2}
                            dir="auto"
                            placeholder="Describe findings…"
                            autoFocus
                            className="w-full resize-none rounded-[7px] border border-alert-fg/20 bg-card px-2.5 py-1.5 text-[12.5px] leading-6 text-ink outline-none transition-colors focus:border-alert-fg/50 focus:shadow-[0_0_0_2px_var(--alert-bg)] placeholder:text-ink-4"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
