import { api } from "../../lib/api/client";
import { authStore } from "../../lib/auth/store";

export interface AttachmentItem {
  attachmentId: string;
  entityType: string;
  entityId: string;
  patientContext: string | null;
  storageBackend: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  category: string | null;
  notes: string | null;
  uploadedBy: string;
  uploadedAt: string;
  uploadedByName: string | null;
  isImage: boolean;
}

/** Keep in sync with apps/api/src/modules/attachments/dto/attachments.dto.ts. */
export const ATTACHMENT_MIME_WHITELIST: ReadonlyArray<string> = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export function listAttachments(
  entityType: string,
  entityId: string,
  signal?: AbortSignal,
): Promise<AttachmentItem[]> {
  return api<AttachmentItem[]>("/attachments", {
    query: { entityType, entityId },
    signal,
  });
}

/** Patient-wide aggregate: every attachment whose PatientContext = patientId. */
export function listPatientAttachments(
  patientId: string,
  signal?: AbortSignal,
): Promise<AttachmentItem[]> {
  return api<AttachmentItem[]>(`/attachments/patient/${encodeURIComponent(patientId)}`, {
    signal,
  });
}

/** Bulk per-entity attachment counts — for badging list rows. */
export function getAttachmentCounts(
  entityType: string,
  entityIds: string[],
  signal?: AbortSignal,
): Promise<Record<string, number>> {
  if (entityIds.length === 0) return Promise.resolve({});
  return api<Record<string, number>>("/attachments/counts", {
    query: { entityType, entityIds: entityIds.join(",") },
    signal,
  });
}

export async function uploadAttachment(input: {
  file: File;
  entityType: string;
  entityId: string;
  category?: string;
  notes?: string;
}): Promise<AttachmentItem> {
  const token = authStore.getState().accessToken;
  const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/v1";
  const fd = new FormData();
  fd.append("file", input.file);
  fd.append("entityType", input.entityType);
  fd.append("entityId", input.entityId);
  if (input.category) fd.append("category", input.category);
  if (input.notes) fd.append("notes", input.notes);
  const res = await fetch(`${base}/attachments`, {
    method: "POST",
    body: fd,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg =
      (body && (body.message || body.error)) ||
      `Upload failed (${res.status})`;
    throw new Error(Array.isArray(msg) ? msg.join("; ") : String(msg));
  }
  return (await res.json()) as AttachmentItem;
}

/** Patch the free-form notes field on an attachment. */
export function updateAttachment(
  id: string,
  patch: { notes?: string | null },
): Promise<AttachmentItem> {
  return api<AttachmentItem>(`/attachments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
  });
}

export function deleteAttachment(id: string): Promise<void> {
  return api(`/attachments/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** URL the browser hits to stream/download the file. */
export function attachmentDownloadUrl(id: string): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/v1";
  return `${base}/attachments/${encodeURIComponent(id)}/download`;
}
