import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmModal } from "../../components/ConfirmModal";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MIME_WHITELIST,
  deleteAttachment,
  listPatientAttachments,
  uploadAttachment,
  type AttachmentItem,
} from "../attachments/attachments-api";
import {
  AttachmentPreviewModal,
  HUMAN_MIME,
  fetchAttachmentObjectUrl,
  fmtAttachmentDate,
  fmtBytes,
} from "../attachments/AttachmentsCard";

interface Props {
  patientId: string;
}

type ViewMode = "grid" | "list";
type SortKey = "newest" | "oldest" | "largest" | "name";
type TypeFilter = "all" | "pdf" | "image";

/** Friendly labels for the EntityType column. Kept in lock-step with
 *  apps/api/src/modules/attachments/dto/attachments.dto.ts. */
const SOURCE_LABELS: Record<string, string> = {
  patients: "General",
  patientlabrequests: "Lab request",
  patientechocardiogramtests: "Echo test",
  patientvisits: "Visit",
  pvgprescription: "Glasses Rx",
  patientbodysystemphysicalexam: "Physical exam",
};
const sourceLabel = (t: string): string => SOURCE_LABELS[t] ?? t;

export function PatientFilesTab({ patientId }: Props): JSX.Element {
  const qc = useQueryClient();

  // ── Server state ─────────────────────────────────────────────────────────
  const QK = ["attachments", "patient", patientId] as const;
  const q = useQuery({
    queryKey: QK,
    queryFn: ({ signal }) => listPatientAttachments(patientId, signal),
    staleTime: 30_000,
  });
  const items = q.data ?? [];

  // ── UI state ─────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<AttachmentItem | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = useState<boolean>(false);
  const [pendingSingleDelete, setPendingSingleDelete] =
    useState<AttachmentItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadQueue, setUploadQueue] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});

  const inputRef = useRef<HTMLInputElement>(null);

  // ── Mutations ────────────────────────────────────────────────────────────
  const upload = useMutation({
    mutationFn: (file: File) =>
      uploadAttachment({
        file,
        entityType: "patients",
        entityId: patientId,
        category: "general",
      }),
  });

  const removeOne = useMutation({
    mutationFn: (a: AttachmentItem) => deleteAttachment(a.attachmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      qc.invalidateQueries({ queryKey: ["attachments", "counts"] });
      // Also refresh the per-entity list the source card might be showing.
      qc.invalidateQueries({ queryKey: ["attachments"] });
      setPendingSingleDelete(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : String(err));
      setPendingSingleDelete(null);
    },
  });

  // ── Image thumbnail prefetch (only for grid view, only for images) ──────
  useEffect(() => {
    if (viewMode !== "grid") return;
    const images = items.filter((a) => a.isImage && !thumbUrls[a.attachmentId]);
    if (images.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const a of images) {
        try {
          const url = await fetchAttachmentObjectUrl(a.attachmentId);
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          setThumbUrls((prev) => ({ ...prev, [a.attachmentId]: url }));
        } catch {
          /* best-effort */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [items, viewMode, thumbUrls]);

  useEffect(() => {
    return () => {
      for (const url of Object.values(thumbUrls)) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Source options (built from data so we never show empty buckets) ─────
  const sourceOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of items) counts.set(a.entityType, (counts.get(a.entityType) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  // ── Derived: filtered + sorted ──────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = items.slice();
    if (sourceFilter !== "all") arr = arr.filter((a) => a.entityType === sourceFilter);
    if (typeFilter === "pdf") arr = arr.filter((a) => a.mimeType === "application/pdf");
    else if (typeFilter === "image") arr = arr.filter((a) => a.isImage);
    if (q.length > 0) {
      arr = arr.filter((a) => {
        const hay = `${a.originalFileName} ${a.notes ?? ""} ${sourceLabel(a.entityType)} ${a.uploadedByName ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
    }
    arr.sort((a, b) => {
      switch (sortKey) {
        case "oldest":
          return a.uploadedAt.localeCompare(b.uploadedAt);
        case "largest":
          return b.sizeBytes - a.sizeBytes;
        case "name":
          return a.originalFileName.localeCompare(b.originalFileName);
        case "newest":
        default:
          return b.uploadedAt.localeCompare(a.uploadedAt);
      }
    });
    return arr;
  }, [items, query, sourceFilter, typeFilter, sortKey]);

  // ── Selection helpers ───────────────────────────────────────────────────
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((a) => selected.has(a.attachmentId));

  const toggleOne = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllFiltered = (): void => {
    setSelected((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        for (const a of filtered) next.delete(a.attachmentId);
        return next;
      }
      const next = new Set(prev);
      for (const a of filtered) next.add(a.attachmentId);
      return next;
    });
  };
  const clearSelection = (): void => setSelected(new Set());

  // ── Stats ───────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const total = items.length;
    const bytes = items.reduce((s, a) => s + a.sizeBytes, 0);
    const visible = filtered.length;
    const visibleBytes = filtered.reduce((s, a) => s + a.sizeBytes, 0);
    return { total, bytes, visible, visibleBytes };
  }, [items, filtered]);

  // ── Upload entry point (shared by drag-drop + picker) ───────────────────
  const validate = (file: File): string | null => {
    if (file.size > ATTACHMENT_MAX_BYTES) {
      return `${file.name}: exceeds ${fmtBytes(ATTACHMENT_MAX_BYTES)}.`;
    }
    if (!ATTACHMENT_MIME_WHITELIST.includes(file.type)) {
      return `${file.name}: unsupported type "${file.type || "unknown"}".`;
    }
    return null;
  };

  const onPick = async (files: FileList | File[]): Promise<void> => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setError(null);
    const valid: File[] = [];
    const errs: string[] = [];
    for (const f of list) {
      const m = validate(f);
      if (m) errs.push(m);
      else valid.push(f);
    }
    if (errs.length > 0) setError(errs.join("\n"));
    if (valid.length === 0) return;
    setUploadQueue({ done: 0, total: valid.length });
    for (let i = 0; i < valid.length; i++) {
      try {
        await upload.mutateAsync(valid[i]);
      } catch (err) {
        setError((prev) =>
          [prev, `${valid[i].name}: ${err instanceof Error ? err.message : String(err)}`]
            .filter(Boolean)
            .join("\n"),
        );
      } finally {
        setUploadQueue({ done: i + 1, total: valid.length });
      }
    }
    setUploadQueue(null);
    qc.invalidateQueries({ queryKey: QK });
    qc.invalidateQueries({ queryKey: ["attachments", "counts"] });
  };

  // ── Bulk delete ─────────────────────────────────────────────────────────
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const runBulkDelete = async (): Promise<void> => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBulkProgress({ done: 0, total: ids.length });
    for (let i = 0; i < ids.length; i++) {
      try {
        await deleteAttachment(ids[i]);
      } catch (err) {
        setError((prev) =>
          [prev, `Delete failed: ${err instanceof Error ? err.message : String(err)}`]
            .filter(Boolean)
            .join("\n"),
        );
      } finally {
        setBulkProgress({ done: i + 1, total: ids.length });
      }
    }
    setBulkProgress(null);
    setPendingBulkDelete(false);
    clearSelection();
    qc.invalidateQueries({ queryKey: QK });
    qc.invalidateQueries({ queryKey: ["attachments", "counts"] });
    qc.invalidateQueries({ queryKey: ["attachments"] });
  };

  const isUploading = uploadQueue != null;
  const isBulkDeleting = bulkProgress != null;

  return (
    <section className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
      {/* Header — title + primary actions */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-3.5">
        <div className="flex items-baseline gap-3">
          <h2 className="font-serif text-xl leading-7">Files</h2>
          {totals.total > 0 && (
            <span className="inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-paper-3 px-1.5 font-mono text-[11px] font-semibold tnum text-ink-2">
              {totals.total}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle */}
          <div
            role="group"
            aria-label="View mode"
            className="inline-flex overflow-hidden rounded-[10px] border border-rule"
          >
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              aria-pressed={viewMode === "grid"}
              className={`px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-2 ${
                viewMode === "grid"
                  ? "bg-primary-50 text-primary-700"
                  : "bg-card text-ink-3 hover:text-ink"
              }`}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-pressed={viewMode === "list"}
              className={`border-s border-rule px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-2 ${
                viewMode === "list"
                  ? "bg-primary-50 text-primary-700"
                  : "bg-card text-ink-3 hover:text-ink"
              }`}
            >
              List
            </button>
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="rounded-[10px] bg-primary px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-primary-600 disabled:bg-primary-200"
          >
            {isUploading ? `Uploading ${uploadQueue!.done}/${uploadQueue!.total}…` : "+ Upload"}
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ATTACHMENT_MIME_WHITELIST.join(",")}
            className="hidden"
            onChange={(e) => {
              const fl = e.target.files;
              if (fl && fl.length > 0) onPick(fl);
              e.target.value = "";
            }}
          />
        </div>
      </header>

      {/* Toolbar — search, filters, sort */}
      <div className="flex flex-wrap items-center gap-2 border-b border-rule px-5 py-2.5">
        <div className="min-w-[200px] flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search filename, notes, or uploader…"
            className="block w-full rounded-[10px] border border-rule bg-card px-3 py-1.5 text-[13px] text-ink placeholder:text-ink-4 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary-100"
            dir="auto"
          />
        </div>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-[10px] border border-rule bg-card px-2.5 py-1.5 text-[12.5px] text-ink focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary-100"
        >
          <option value="all">All sources ({items.length})</option>
          {sourceOptions.map(([t, n]) => (
            <option key={t} value={t}>
              {sourceLabel(t)} ({n})
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          className="rounded-[10px] border border-rule bg-card px-2.5 py-1.5 text-[12.5px] text-ink focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary-100"
        >
          <option value="all">All types</option>
          <option value="pdf">PDFs only</option>
          <option value="image">Images only</option>
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded-[10px] border border-rule bg-card px-2.5 py-1.5 text-[12.5px] text-ink focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary-100"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="largest">Largest first</option>
          <option value="name">Name A → Z</option>
        </select>

        {(query || sourceFilter !== "all" || typeFilter !== "all" || sortKey !== "newest") && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSourceFilter("all");
              setTypeFilter("all");
              setSortKey("newest");
            }}
            className="rounded-[10px] border border-rule bg-card px-2.5 py-1.5 text-[12px] font-medium text-ink-3 hover:border-rule-2 hover:text-ink"
          >
            Reset
          </button>
        )}
      </div>

      {/* Selection action bar (sticky when there's a selection) */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule bg-primary-50 px-5 py-2">
          <div className="flex items-center gap-2 text-[12.5px] text-primary-800">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleAllFiltered}
              />
              <span>
                <b>{selected.size}</b> selected
                {filtered.length > 0 ? ` · ${allFilteredSelected ? "all" : "some"} of ${filtered.length} visible` : ""}
              </span>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-[8px] border border-rule bg-card px-2.5 py-1 text-[12px] font-medium text-ink-2 hover:border-rule-2"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setPendingBulkDelete(true)}
              disabled={isBulkDeleting}
              className="rounded-[8px] bg-alert-fg px-2.5 py-1 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {isBulkDeleting
                ? `Deleting ${bulkProgress!.done}/${bulkProgress!.total}…`
                : `Delete ${selected.size}`}
            </button>
          </div>
        </div>
      )}

      {/* Body */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length > 0) onPick(e.dataTransfer.files);
        }}
        className={`relative min-h-[160px] transition-colors duration-2 ${
          dragOver ? "bg-primary-50" : ""
        }`}
      >
        {dragOver && (
          <div className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-[10px] border-2 border-dashed border-primary text-[13px] font-medium text-primary-700">
            Drop to upload
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="mx-5 mt-4 flex items-start gap-2 rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg"
          >
            <span aria-hidden>⚠</span>
            <span className="flex-1 whitespace-pre-line">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Dismiss"
              className="opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {q.isLoading ? (
          <div className="px-5 py-12 text-center text-[13px] text-ink-3">Loading files…</div>
        ) : q.error ? (
          <div className="mx-5 my-6 rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
            {(q.error as Error).message}
          </div>
        ) : items.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div aria-hidden className="text-[32px] opacity-40">📂</div>
            <p className="mt-2 text-[13px] text-ink-3">
              No files attached to this patient yet.
            </p>
            <p className="mt-1 text-[11.5px] text-ink-4">
              Drop PDFs or images anywhere on this card, or click <b>+ Upload</b>. Max{" "}
              {fmtBytes(ATTACHMENT_MAX_BYTES)} each.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-14 text-center text-[13px] text-ink-3">
            No files match the current filters.
          </div>
        ) : viewMode === "grid" ? (
          <GridView
            items={filtered}
            thumbUrls={thumbUrls}
            selected={selected}
            onToggle={toggleOne}
            onPreview={setPreview}
            onDelete={setPendingSingleDelete}
          />
        ) : (
          <ListView
            items={filtered}
            thumbUrls={thumbUrls}
            selected={selected}
            allSelected={allFilteredSelected}
            onToggleAll={toggleAllFiltered}
            onToggle={toggleOne}
            onPreview={setPreview}
            onDelete={setPendingSingleDelete}
          />
        )}
      </div>

      {/* Footer stats */}
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-rule bg-card-2 px-5 py-2 font-mono text-[11px] uppercase tracking-wider text-ink-3 tnum">
        <span>
          {totals.visible} of {totals.total} files · {fmtBytes(totals.visibleBytes)} of{" "}
          {fmtBytes(totals.bytes)}
        </span>
        {items[0] && <span>last upload {fmtAttachmentDate(items[0].uploadedAt)}</span>}
      </footer>

      {/* Preview modal — reuses AttachmentsCard's exported component */}
      <AttachmentPreviewModal
        attachment={
          preview
            ? items.find((i) => i.attachmentId === preview.attachmentId) ?? preview
            : null
        }
        previewUrl={preview ? thumbUrls[preview.attachmentId] : undefined}
        onClose={() => setPreview(null)}
        onNotesSaved={() => qc.invalidateQueries({ queryKey: QK })}
      />

      <ConfirmModal
        open={pendingSingleDelete != null}
        title={`Delete "${pendingSingleDelete?.originalFileName ?? ""}"?`}
        body={
          <p className="text-[13.5px] text-ink-2">
            The file will be soft-deleted and hidden from this list. Audit records
            of the upload + deletion are kept.
          </p>
        }
        confirmLabel="Delete"
        destructive
        pending={removeOne.isPending}
        onConfirm={() => {
          if (pendingSingleDelete) removeOne.mutate(pendingSingleDelete);
        }}
        onCancel={() => setPendingSingleDelete(null)}
      />

      <ConfirmModal
        open={pendingBulkDelete}
        title={`Delete ${selected.size} file${selected.size === 1 ? "" : "s"}?`}
        body={
          <p className="text-[13.5px] text-ink-2">
            All selected files will be soft-deleted across whichever sources they
            were attached to. This can't be reversed from the UI.
          </p>
        }
        confirmLabel="Delete all"
        destructive
        pending={isBulkDeleting}
        onConfirm={runBulkDelete}
        onCancel={() => setPendingBulkDelete(false)}
      />
    </section>
  );
}

// ── Grid view ────────────────────────────────────────────────────────────────

function GridView({
  items,
  thumbUrls,
  selected,
  onToggle,
  onPreview,
  onDelete,
}: {
  items: AttachmentItem[];
  thumbUrls: Record<string, string>;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onPreview: (a: AttachmentItem) => void;
  onDelete: (a: AttachmentItem) => void;
}): JSX.Element {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3 p-5">
      {items.map((a) => {
        const isSel = selected.has(a.attachmentId);
        const thumb = thumbUrls[a.attachmentId];
        return (
          <li
            key={a.attachmentId}
            className={`group relative overflow-hidden rounded-[12px] border bg-card transition-shadow duration-2 hover:shadow-2 ${
              isSel ? "border-primary ring-2 ring-primary-100" : "border-rule"
            }`}
          >
            {/* Checkbox — top-start */}
            <label
              className="absolute z-10 inline-flex size-6 cursor-pointer items-center justify-center rounded-full bg-card/80 opacity-0 backdrop-blur-sm transition-opacity duration-2 group-hover:opacity-100 has-[:checked]:opacity-100"
              style={{ insetInlineStart: 8, insetBlockStart: 8 }}
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={isSel}
                onChange={() => onToggle(a.attachmentId)}
                aria-label={`Select ${a.originalFileName}`}
              />
            </label>

            {/* Source badge — top-end */}
            <span
              className="absolute z-10 rounded-full bg-card/85 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-2 backdrop-blur-sm"
              style={{ insetInlineEnd: 8, insetBlockStart: 8 }}
            >
              {sourceLabel(a.entityType)}
            </span>

            {/* Thumb / glyph clickable area */}
            <button
              type="button"
              onClick={() => onPreview(a)}
              className="block aspect-[4/3] w-full bg-paper-2"
              aria-label={`Preview ${a.originalFileName}`}
            >
              {a.isImage && thumb ? (
                <img src={thumb} alt="" loading="lazy" className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-[42px] opacity-60">
                  {a.mimeType === "application/pdf" ? "📄" : "📎"}
                </div>
              )}
            </button>

            <div className="p-2.5">
              <button
                type="button"
                onClick={() => onPreview(a)}
                className="block w-full truncate text-start text-[13px] font-medium text-ink hover:text-primary hover:underline"
                title={a.originalFileName}
              >
                {a.originalFileName}
              </button>
              <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10.5px] text-ink-3">
                <span className="font-mono">{HUMAN_MIME[a.mimeType] ?? a.mimeType}</span>
                <span aria-hidden>·</span>
                <span className="font-mono tnum">{fmtBytes(a.sizeBytes)}</span>
                <span aria-hidden>·</span>
                <span>{fmtAttachmentDate(a.uploadedAt)}</span>
              </div>
              {a.notes && (
                <div className="mt-1 line-clamp-2 text-[11.5px] text-ink-3" dir="auto">
                  {a.notes}
                </div>
              )}
              <div className="mt-2 flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => onDelete(a)}
                  aria-label={`Delete ${a.originalFileName}`}
                  className="rounded-[6px] px-1.5 py-0.5 text-[11px] font-medium text-alert-fg hover:bg-alert-bg/60"
                >
                  Delete
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ── List view ────────────────────────────────────────────────────────────────

function ListView({
  items,
  thumbUrls,
  selected,
  allSelected,
  onToggleAll,
  onToggle,
  onPreview,
  onDelete,
}: {
  items: AttachmentItem[];
  thumbUrls: Record<string, string>;
  selected: Set<string>;
  allSelected: boolean;
  onToggleAll: () => void;
  onToggle: (id: string) => void;
  onPreview: (a: AttachmentItem) => void;
  onDelete: (a: AttachmentItem) => void;
}): JSX.Element {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="bg-card-2">
          <tr className="font-mono text-[10.5px] uppercase tracking-wider text-ink-3">
            <th scope="col" className="w-[36px] px-3 py-2 text-start">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                aria-label="Select all"
              />
            </th>
            <th scope="col" className="w-[56px] px-2 py-2"></th>
            <th scope="col" className="px-2 py-2 text-start">Name</th>
            <th scope="col" className="px-2 py-2 text-start">Source</th>
            <th scope="col" className="px-2 py-2 text-start">Type</th>
            <th scope="col" className="px-2 py-2 text-end">Size</th>
            <th scope="col" className="px-2 py-2 text-start">Uploaded</th>
            <th scope="col" className="w-[80px] px-2 py-2 text-end"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => {
            const isSel = selected.has(a.attachmentId);
            const thumb = thumbUrls[a.attachmentId];
            return (
              <tr
                key={a.attachmentId}
                className={`border-t border-dashed border-rule transition-colors duration-1 hover:bg-card-2 ${
                  isSel ? "bg-primary-50/50" : ""
                }`}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => onToggle(a.attachmentId)}
                    aria-label={`Select ${a.originalFileName}`}
                  />
                </td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => onPreview(a)}
                    aria-label={`Preview ${a.originalFileName}`}
                    className="block"
                  >
                    {a.isImage && thumb ? (
                      <div className="size-10 overflow-hidden rounded-[6px] border border-rule">
                        <img src={thumb} alt="" loading="lazy" className="size-full object-cover" />
                      </div>
                    ) : (
                      <div
                        aria-hidden
                        className="flex size-10 items-center justify-center rounded-[6px] border border-rule bg-paper-2 text-[18px]"
                      >
                        {a.mimeType === "application/pdf" ? "📄" : "📎"}
                      </div>
                    )}
                  </button>
                </td>
                <td className="min-w-[180px] px-2 py-2">
                  <button
                    type="button"
                    onClick={() => onPreview(a)}
                    className="block max-w-[420px] truncate text-start text-[13px] font-medium text-ink hover:text-primary hover:underline"
                    title={a.originalFileName}
                  >
                    {a.originalFileName}
                  </button>
                  {a.notes && (
                    <div className="line-clamp-1 max-w-[420px] text-[11.5px] text-ink-3" dir="auto">
                      {a.notes}
                    </div>
                  )}
                </td>
                <td className="px-2 py-2 text-[12px] text-ink-2">{sourceLabel(a.entityType)}</td>
                <td className="px-2 py-2 font-mono text-[11.5px] text-ink-3">
                  {HUMAN_MIME[a.mimeType] ?? a.mimeType}
                </td>
                <td className="px-2 py-2 text-end font-mono text-[11.5px] tnum text-ink-2">
                  {fmtBytes(a.sizeBytes)}
                </td>
                <td className="px-2 py-2 text-[12px] text-ink-3">
                  <div>{fmtAttachmentDate(a.uploadedAt)}</div>
                  {a.uploadedByName && <div className="text-[11px] text-ink-4">{a.uploadedByName}</div>}
                </td>
                <td className="px-2 py-2 text-end">
                  <button
                    type="button"
                    onClick={() => onDelete(a)}
                    aria-label={`Delete ${a.originalFileName}`}
                    className="rounded-[6px] px-1.5 py-0.5 text-[11.5px] font-medium text-alert-fg hover:bg-alert-bg/60"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
