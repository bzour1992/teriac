import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { ConfirmModal } from "../../components/ConfirmModal";
import { authStore } from "../../lib/auth/store";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MIME_WHITELIST,
  attachmentDownloadUrl,
  deleteAttachment,
  listAttachments,
  updateAttachment,
  uploadAttachment,
  type AttachmentItem,
} from "./attachments-api";

interface Props {
  entityType: string;
  entityId: string;
  /** Optional category tag stored alongside the file (e.g. "lab-result"). */
  category?: string;
  /** Card title override. Defaults to "Attachments". */
  title?: ReactNode;
  /** DOM anchor id — lets the card be linked from a section nav. */
  id?: string;
  /** Restrict accept attribute to a narrower subset of the global whitelist. */
  accept?: string;
}

export const HUMAN_MIME: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "image/heic": "HEIC",
  "image/heif": "HEIF",
};

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function fmtAttachmentDate(s: string): string {
  const d = new Date(s.includes(" ") ? s.replace(" ", "T") + "Z" : s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Fetch one attachment through the API with the bearer token, return a
 *  blob URL the browser can render inline. Caller is responsible for
 *  revoking the URL once it's no longer needed. */
export async function fetchAttachmentObjectUrl(attachmentId: string): Promise<string> {
  const token = authStore.getState().accessToken;
  const res = await fetch(attachmentDownloadUrl(attachmentId), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export function AttachmentsCard({
  entityType,
  entityId,
  category,
  title,
  id,
  accept,
}: Props): JSX.Element {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AttachmentItem | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<AttachmentItem | null>(null);
  const [uploadQueue, setUploadQueue] = useState<{ done: number; total: number } | null>(null);

  const QK = ["attachments", entityType, entityId] as const;
  const q = useQuery({
    queryKey: QK,
    queryFn: ({ signal }) => listAttachments(entityType, entityId, signal),
    staleTime: 60_000,
    enabled: !!entityId,
  });

  // Single-file mutation; multi-file uploads call mutateAsync in a loop so we
  // get sequential uploads with progress tracking instead of a burst.
  const upload = useMutation({
    mutationFn: (file: File) =>
      uploadAttachment({ file, entityType, entityId, category }),
  });

  const del = useMutation({
    mutationFn: (a: AttachmentItem) => deleteAttachment(a.attachmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      // Also refresh any counts queries elsewhere (e.g. lab requests list).
      qc.invalidateQueries({ queryKey: ["attachments", "counts", entityType] });
      setPendingDelete(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : String(err));
      setPendingDelete(null);
    },
  });

  const items = q.data ?? [];

  // Pre-fetch image thumbnails eagerly (small enough).
  useEffect(() => {
    const images = items.filter((a) => a.isImage && !previewUrls[a.attachmentId]);
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
          setPreviewUrls((prev) => ({ ...prev, [a.attachmentId]: url }));
        } catch {
          /* best-effort */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // Revoke blob URLs on unmount.
  useEffect(() => {
    return () => {
      for (const url of Object.values(previewUrls)) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = (file: File): string | null => {
    if (file.size > ATTACHMENT_MAX_BYTES) {
      return `${file.name}: exceeds ${fmtBytes(ATTACHMENT_MAX_BYTES)}.`;
    }
    if (!ATTACHMENT_MIME_WHITELIST.includes(file.type)) {
      return `${file.name}: unsupported type "${file.type || "unknown"}". Allowed: PDF, JPEG, PNG, WebP, HEIC.`;
    }
    return null;
  };

  /** Drop / picker entry point — handles single OR multiple files. */
  const onPick = async (files: FileList | File[]): Promise<void> => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setError(null);

    // Validate every file first, but proceed with the valid ones rather than
    // aborting the whole batch when one fails.
    const valid: File[] = [];
    const errors: string[] = [];
    for (const f of list) {
      const msg = validate(f);
      if (msg) errors.push(msg);
      else valid.push(f);
    }
    if (errors.length > 0) setError(errors.join("\n"));
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
    qc.invalidateQueries({ queryKey: ["attachments", "counts", entityType] });
  };

  const isUploading = uploadQueue != null;

  return (
    <section
      id={id}
      className="overflow-hidden rounded-lg border border-rule bg-card shadow-1"
    >
      <header className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3.5">
        <div className="flex items-baseline gap-3">
          <h2 className="font-serif text-xl leading-7">{title ?? "Attachments"}</h2>
          {items.length > 0 && (
            <span className="inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-paper-3 px-1.5 font-mono text-[11px] font-semibold tnum text-ink-2">
              {items.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="rounded-[10px] bg-primary px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-primary-600 disabled:bg-primary-200"
        >
          {isUploading
            ? `Uploading ${uploadQueue!.done}/${uploadQueue!.total}…`
            : "+ Upload"}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept ?? ATTACHMENT_MIME_WHITELIST.join(",")}
          className="hidden"
          onChange={(e) => {
            const fl = e.target.files;
            if (fl && fl.length > 0) onPick(fl);
            // Clear so picking the same files twice re-fires onChange.
            e.target.value = "";
          }}
        />
      </header>

      {/* Drop zone — also the empty / list container. */}
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
        className={`transition-colors duration-2 ${
          dragOver ? "bg-primary-50" : ""
        }`}
      >
        {error && (
          <div
            role="alert"
            className="m-4 flex items-start gap-2 rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg"
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
          <div className="px-5 py-8 text-center text-[13px] text-ink-3">
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <div aria-hidden className="text-[28px] opacity-40">📎</div>
            <p className="mt-2 text-[13px] text-ink-3">
              No files yet. Drop one or more PDFs / images here, or click <b>+ Upload</b>.
            </p>
            <p className="mt-1 text-[11.5px] text-ink-4">
              Max {fmtBytes(ATTACHMENT_MAX_BYTES)} per file.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-dashed divide-rule">
            {items.map((a) => (
              <li
                key={a.attachmentId}
                className="flex items-center gap-3 px-5 py-3"
              >
                <button
                  type="button"
                  onClick={() => setPreview(a)}
                  className="block shrink-0"
                  aria-label={`Preview ${a.originalFileName}`}
                >
                  <Thumb attachment={a} previewUrl={previewUrls[a.attachmentId]} />
                </button>
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setPreview(a)}
                    className="block max-w-full truncate text-start text-[13.5px] font-medium text-ink hover:text-primary hover:underline"
                    title={a.originalFileName}
                  >
                    {a.originalFileName}
                  </button>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-ink-3">
                    <span className="font-mono">
                      {HUMAN_MIME[a.mimeType] ?? a.mimeType}
                    </span>
                    <span aria-hidden>·</span>
                    <span className="font-mono tnum">{fmtBytes(a.sizeBytes)}</span>
                    <span aria-hidden>·</span>
                    <span>{fmtAttachmentDate(a.uploadedAt)}</span>
                    {a.uploadedByName && (
                      <>
                        <span aria-hidden>·</span>
                        <span>{a.uploadedByName}</span>
                      </>
                    )}
                  </div>
                  {a.notes && (
                    <div className="mt-1 text-[12px] text-ink-3" dir="auto">
                      {a.notes}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setPendingDelete(a)}
                  disabled={del.isPending}
                  aria-label={`Delete ${a.originalFileName}`}
                  className="rounded-[8px] border border-alert-fg/30 bg-alert-bg/30 px-2 py-1 text-[11.5px] font-medium text-alert-fg hover:bg-alert-bg disabled:opacity-50"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AttachmentPreviewModal
        attachment={
          // Re-resolve from `items` on every render so an edit elsewhere
          // (or our own notes save) flows back into the open modal.
          preview
            ? items.find((i) => i.attachmentId === preview.attachmentId) ?? preview
            : null
        }
        previewUrl={preview ? previewUrls[preview.attachmentId] : undefined}
        onClose={() => setPreview(null)}
        onNotesSaved={() => {
          qc.invalidateQueries({ queryKey: QK });
        }}
      />

      <ConfirmModal
        open={pendingDelete != null}
        title={`Delete "${pendingDelete?.originalFileName ?? ""}"?`}
        body={
          <p className="text-[13.5px] text-ink-2">
            The file will be moved to soft-delete and hidden from this list.
            Audit records of the upload + deletion are kept.
          </p>
        }
        confirmLabel="Delete"
        destructive
        pending={del.isPending}
        onConfirm={() => {
          if (pendingDelete) del.mutate(pendingDelete);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}

function Thumb({
  attachment,
  previewUrl,
}: {
  attachment: AttachmentItem;
  previewUrl: string | undefined;
}): JSX.Element {
  if (attachment.isImage && previewUrl) {
    return (
      <div className="size-12 overflow-hidden rounded-[8px] border border-rule bg-paper-2 transition-shadow hover:shadow-1">
        <img
          src={previewUrl}
          alt=""
          loading="lazy"
          className="size-full object-cover"
        />
      </div>
    );
  }
  const glyph = attachment.mimeType === "application/pdf" ? "📄" : "📎";
  return (
    <div
      aria-hidden
      className="flex size-12 items-center justify-center rounded-[8px] border border-rule bg-paper-2 text-[20px] transition-shadow hover:shadow-1"
    >
      {glyph}
    </div>
  );
}

// ── Preview modal ───────────────────────────────────────────────────────────

export function AttachmentPreviewModal({
  attachment,
  previewUrl,
  onClose,
  onNotesSaved,
}: {
  attachment: AttachmentItem | null;
  /** Cached thumbnail URL for images. PDFs always fetch fresh on open. */
  previewUrl: string | undefined;
  onClose: () => void;
  /** Called after a successful notes save so the parent can invalidate caches. */
  onNotesSaved: () => void;
}): JSX.Element | null {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<string>("");
  const [notesError, setNotesError] = useState<string | null>(null);

  const NOTES_MAX = 500;

  // Reset the editor whenever the modal opens / the underlying notes change.
  useEffect(() => {
    setNotesDraft(attachment?.notes ?? "");
    setNotesError(null);
  }, [attachment?.attachmentId, attachment?.notes]);

  const saveNotes = useMutation({
    mutationFn: (next: string | null) =>
      updateAttachment(attachment!.attachmentId, { notes: next }),
    onSuccess: () => {
      setNotesError(null);
      onNotesSaved();
    },
    onError: (err) => {
      setNotesError(err instanceof Error ? err.message : String(err));
    },
  });

  // Resolve the URL to render. Images reuse the thumbnail blob URL; PDFs
  // (and unknown types) fetch fresh so we don't keep a large blob in memory
  // until the modal opens.
  useEffect(() => {
    if (!attachment) {
      setObjectUrl(null);
      setLoadError(null);
      return;
    }
    if (attachment.isImage && previewUrl) {
      setObjectUrl(previewUrl);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    let createdUrl: string | null = null;
    (async () => {
      try {
        const url = await fetchAttachmentObjectUrl(attachment.attachmentId);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        createdUrl = url;
        setObjectUrl(url);
        setLoadError(null);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
      // Only revoke if we fetched fresh — don't kill the cached image URL.
      if (createdUrl && createdUrl !== previewUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [attachment, previewUrl]);

  if (!attachment) return null;

  const isImage = attachment.isImage;
  const isPdf = attachment.mimeType === "application/pdf";

  const onDownload = async (): Promise<void> => {
    try {
      const url = objectUrl ?? (await fetchAttachmentObjectUrl(attachment.attachmentId));
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.originalFileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Only revoke if we just created it; keep the cached one alive.
      if (!objectUrl) URL.revokeObjectURL(url);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={attachment.originalFileName}
      description={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-ink-3">
          <span className="font-mono">
            {HUMAN_MIME[attachment.mimeType] ?? attachment.mimeType}
          </span>
          <span aria-hidden>·</span>
          <span className="font-mono tnum">{fmtBytes(attachment.sizeBytes)}</span>
          <span aria-hidden>·</span>
          <span>{fmtAttachmentDate(attachment.uploadedAt)}</span>
          {attachment.uploadedByName && (
            <>
              <span aria-hidden>·</span>
              <span>{attachment.uploadedByName}</span>
            </>
          )}
        </span>
      }
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[10px] border border-rule bg-card px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:border-rule-2"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onDownload}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600"
          >
            Download
          </button>
        </>
      }
    >
      <div className="-mx-1">
        {loadError ? (
          <div
            role="alert"
            className="rounded-[10px] bg-alert-bg px-3 py-4 text-center text-[13px] text-alert-fg"
          >
            {loadError}
          </div>
        ) : !objectUrl ? (
          <div className="py-12 text-center text-[13px] text-ink-3">Loading preview…</div>
        ) : isImage ? (
          <div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-[10px] bg-paper-2 p-2">
            <img
              src={objectUrl}
              alt={attachment.originalFileName}
              className="max-h-[68vh] max-w-full object-contain"
            />
          </div>
        ) : isPdf ? (
          <iframe
            src={objectUrl}
            title={attachment.originalFileName}
            className="h-[70vh] w-full rounded-[10px] border border-rule"
          />
        ) : (
          <div className="rounded-[10px] bg-paper-2 px-3 py-12 text-center text-[13px] text-ink-3">
            Preview isn't supported for this file type. Use <b>Download</b> to view it.
          </div>
        )}
        <div className="mt-4 border-t border-rule pt-3">
          <label
            htmlFor="att-notes"
            className="mb-1 block text-[12.5px] font-medium text-ink-2"
          >
            Notes
          </label>
          <textarea
            id="att-notes"
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value.slice(0, NOTES_MAX))}
            placeholder="Add a short caption — e.g. 'CBC dated 12-May, slightly elevated WBC'."
            dir="auto"
            rows={3}
            disabled={saveNotes.isPending}
            className="block w-full resize-y rounded-[10px] border border-rule bg-card px-3 py-2 text-[13.5px] leading-5 text-ink placeholder:text-ink-4 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary-100 disabled:opacity-60"
          />
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              {notesError && (
                <p className="text-[12px] text-alert-fg" role="alert">
                  {notesError}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-[11px] tnum text-ink-4">
                {notesDraft.length}/{NOTES_MAX}
              </span>
              {notesDraft !== (attachment.notes ?? "") && (
                <button
                  type="button"
                  onClick={() => {
                    setNotesDraft(attachment.notes ?? "");
                    setNotesError(null);
                  }}
                  disabled={saveNotes.isPending}
                  className="rounded-[8px] border border-rule bg-card px-2.5 py-1 text-[12px] font-medium text-ink-2 hover:border-rule-2 disabled:opacity-60"
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                disabled={
                  saveNotes.isPending || notesDraft === (attachment.notes ?? "")
                }
                onClick={() => {
                  const trimmed = notesDraft.trim();
                  saveNotes.mutate(trimmed.length === 0 ? null : trimmed);
                }}
                className="rounded-[8px] bg-primary px-2.5 py-1 text-[12px] font-medium text-white hover:bg-primary-600 disabled:bg-primary-200"
              >
                {saveNotes.isPending ? "Saving…" : "Save notes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
