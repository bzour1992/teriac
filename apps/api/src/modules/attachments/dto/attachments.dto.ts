import { IsOptional, IsString, MaxLength, IsUUID } from "class-validator";

/** Whitelist of entity types that can have attachments. Keep this lock-step
 *  with the front-end so a typo'd entity name doesn't silently orphan files. */
export const ATTACHMENT_ENTITY_TYPES = [
  "patientlabrequests",
  "patientechocardiogramtests",
  "patientvisits",
  "patients",
  "pvgprescription",
  "patientbodysystemphysicalexam",
] as const;
export type AttachmentEntityType = (typeof ATTACHMENT_ENTITY_TYPES)[number];

/** MIME types we accept on upload. Tier 1: PDFs + common image formats. */
export const ATTACHMENT_MIME_WHITELIST: ReadonlyArray<string> = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/** PATCH /v1/attachments/:id — only the notes field is editable today. */
export class UpdateAttachmentDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string | null;
}

/** Multipart upload sidecar — file is parsed out by FileInterceptor. */
export class UploadAttachmentDto {
  @IsString()
  entityType!: string;

  @IsUUID("all")
  entityId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(40)
  category?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}

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
  /** True when the file is an image we can show inline. */
  isImage: boolean;
}
