import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../lib/api/client";
import { formatDateLong } from "../../lib/format";
import {
  KNOWN_MODULE_KEYS,
  MODULE_LABELS,
  listClinicModules,
  updateClinicModule,
  type ClinicModule,
} from "./api";

interface ModuleRowState {
  moduleKey: string;
  isEnabled: boolean;
  notes: string;
  enabledAt: string | null;
}

function moduleRowsFromData(
  modules: ClinicModule[],
): ModuleRowState[] {
  const byKey = new Map(modules.map((m) => [m.moduleKey, m]));
  const allKeys = new Set<string>([
    ...KNOWN_MODULE_KEYS,
    ...modules.map((m) => m.moduleKey),
  ]);
  return Array.from(allKeys).map((key) => {
    const existing = byKey.get(key);
    return {
      moduleKey: key,
      isEnabled: existing?.isEnabled ?? false,
      notes: existing?.notes ?? "",
      enabledAt: existing?.enabledAt ?? null,
    };
  });
}

function moduleLabel(key: string): string {
  return MODULE_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

function ModuleRow({
  row,
  clinicId,
  onSaved,
}: {
  row: ModuleRowState;
  clinicId: string;
  onSaved: () => void;
}): JSX.Element {
  const [isEnabled, setIsEnabled] = useState(row.isEnabled);
  const [notes, setNotes] = useState(row.notes);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setIsEnabled(row.isEnabled);
    setNotes(row.notes);
  }, [row.isEnabled, row.notes]);

  const dirty = isEnabled !== row.isEnabled || notes.trim() !== (row.notes ?? "").trim();

  const mut = useMutation({
    mutationFn: () =>
      updateClinicModule(clinicId, row.moduleKey, {
        isEnabled,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      setSaved(true);
      setErr(null);
      setTimeout(() => setSaved(false), 1500);
      onSaved();
    },
    onError: (e) =>
      setErr(e instanceof ApiError ? e.message : (e as Error).message),
  });

  return (
    <div className="flex flex-col gap-3 border-b border-rule px-5 py-4 last:border-0 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <label className="relative inline-flex shrink-0 cursor-pointer items-center">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.target.checked)}
            className="sr-only"
          />
          <span
            className={`flex h-6 w-11 items-center rounded-full transition-colors duration-2 ${
              isEnabled ? "bg-primary" : "bg-rule-2"
            }`}
          >
            <span
              className={`mx-0.5 size-5 rounded-full bg-white shadow transition-transform duration-2 ${
                isEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </span>
        </label>
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-ink">
            {moduleLabel(row.moduleKey)}
          </div>
          <div className="font-mono text-[11px] tnum text-ink-4">
            {row.moduleKey}
            {row.enabledAt && (
              <>
                {" · enabled "}
                {formatDateLong(row.enabledAt)}
              </>
            )}
          </div>
          {err && (
            <div className="mt-1 text-[11.5px] text-alert-fg" role="alert">
              {err}
            </div>
          )}
        </div>
      </div>

      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        dir="auto"
        className="w-full rounded-[10px] border border-rule bg-card px-3 py-1.5 text-[13px] outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)] sm:w-[260px]"
      />

      <div className="flex items-center gap-2">
        {saved && (
          <span className="text-[12px] font-medium text-vital-fg">Saved ✓</span>
        )}
        <button
          type="button"
          disabled={!dirty || mut.isPending}
          onClick={() => mut.mutate()}
          className="rounded-[10px] bg-primary px-3.5 py-1.5 text-[12px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
        >
          {mut.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

export function ClinicModulesTab({
  clinicId,
}: {
  clinicId: string;
}): JSX.Element {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["superadmin", "clinic", clinicId, "modules"],
    queryFn: ({ signal }) => listClinicModules(clinicId, signal),
    staleTime: 30_000,
  });

  const rows = useMemo(
    () => moduleRowsFromData(query.data ?? []),
    [query.data],
  );

  const onSaved = (): void => {
    qc.invalidateQueries({
      queryKey: ["superadmin", "clinic", clinicId, "modules"],
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-serif text-xl font-medium tracking-tight">
          Per-clinic modules
        </h2>
        <p className="mt-0.5 text-[13px] text-ink-3">
          Toggle which specialty and feature modules are enabled for this clinic.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
        {query.isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-[10px] bg-paper-3" />
            ))}
          </div>
        ) : query.error ? (
          <p className="px-5 py-8 text-center text-[13px] text-alert-fg">
            {(query.error as Error).message}
          </p>
        ) : (
          rows.map((row) => (
            <ModuleRow
              key={row.moduleKey}
              row={row}
              clinicId={clinicId}
              onSaved={onSaved}
            />
          ))
        )}
      </div>
    </div>
  );
}
