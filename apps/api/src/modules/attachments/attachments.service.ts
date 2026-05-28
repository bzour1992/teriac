import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import { sql } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import { TenantDbService } from "../../db/tenant-db.service";
import { TenantContextService } from "../../common/tenant/tenant-context";
import { AuditService } from "../../common/audit/audit.service";
import { LocalStorageProvider, buildStorageKey } from "./storage/local-storage.provider";
import {
  ATTACHMENT_ENTITY_TYPES,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MIME_WHITELIST,
  type AttachmentEntityType,
  type AttachmentItem,
} from "./dto/attachments.dto";

interface AttachmentRow {
  AttachmentID: string;
  HCenterID: string;
  EntityType: string;
  EntityID: string;
  PatientContext: string | null;
  StorageBackend: string;
  StorageKey: string;
  OriginalFileName: string;
  MimeType: string;
  SizeBytes: number;
  Checksum: string | null;
  Category: string | null;
  Notes: string | null;
  UploadedBy: string;
  UploadedAt: string;
  DeletedAt: string | null;
  UploaderName: string | null;
}

/**
 * Polymorphic attachments service. Every domain (labs, echo, …) calls the
 * same endpoints; the `entityType + entityId` pair drives filtering.
 *
 * Storage is one swap away from cloud (S3 / R2) — see StorageProvider.
 * For now we inject the LocalStorageProvider directly; once we have more
 * than one backend we'll resolve per-clinic via `hcenters.StorageBackend`.
 */
@Injectable()
export class AttachmentsService {
  constructor(
    @Inject(TenantDbService) private readonly tdb: TenantDbService,
    @Inject(TenantContextService) private readonly tenant: TenantContextService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(LocalStorageProvider) private readonly storage: LocalStorageProvider,
  ) {}

  // ── Upload ──────────────────────────────────────────────────────────────

  async upload(input: {
    entityType: string;
    entityId: string;
    category?: string;
    notes?: string;
    fileName: string;
    mimeType: string;
    buffer: Buffer;
  }): Promise<AttachmentItem> {
    if (!(ATTACHMENT_ENTITY_TYPES as ReadonlyArray<string>).includes(input.entityType)) {
      throw new BadRequestException(
        `Unknown entityType "${input.entityType}". Add it to ATTACHMENT_ENTITY_TYPES.`,
      );
    }
    if (input.buffer.length === 0) {
      throw new BadRequestException("Empty file");
    }
    if (input.buffer.length > ATTACHMENT_MAX_BYTES) {
      throw new PayloadTooLargeException(
        `File exceeds ${ATTACHMENT_MAX_BYTES} bytes`,
      );
    }
    if (!ATTACHMENT_MIME_WHITELIST.includes(input.mimeType)) {
      throw new UnsupportedMediaTypeException(
        `MIME ${input.mimeType} is not allowed (PDF + common images only).`,
      );
    }

    // Resolve PatientContext where possible — the entity rows usually carry
    // PatientID directly, which makes the audit + listing screens richer.
    const patientContext = await this.resolvePatientContext(
      input.entityType as AttachmentEntityType,
      input.entityId,
    );

    const attachmentId = randomUUID();
    const hcenterId = this.tenant.hcenterId;
    const userId = this.tenant.userId;
    const key = buildStorageKey(hcenterId, attachmentId, input.fileName);
    const checksum = createHash("sha256").update(input.buffer).digest("hex");

    await this.storage.put(key, input.buffer, {
      mimeType: input.mimeType,
      size: input.buffer.length,
    });

    try {
      await this.tdb.db.execute(sql`
        INSERT INTO attachments (
          AttachmentID, HCenterID, EntityType, EntityID, PatientContext,
          StorageBackend, StorageKey, OriginalFileName, MimeType, SizeBytes,
          Checksum, Category, Notes, UploadedBy, UploadedAt
        ) VALUES (
          ${attachmentId}, ${hcenterId}, ${input.entityType}, ${input.entityId},
          ${patientContext ?? null}, ${this.storage.name}, ${key},
          ${input.fileName}, ${input.mimeType}, ${input.buffer.length},
          ${checksum}, ${input.category ?? null}, ${input.notes ?? null},
          ${userId}, NOW(3)
        )
      `);
    } catch (err) {
      // Roll back the storage write so we don't leave orphaned bytes when
      // the DB rejects the row.
      await this.storage.delete(key).catch(() => undefined);
      throw err;
    }

    await this.audit.record({
      action: "Create",
      entityType: "Attachment",
      entityId: attachmentId,
      patientContext,
      newValues: {
        entityType: input.entityType,
        entityId: input.entityId,
        category: input.category,
        mimeType: input.mimeType,
        sizeBytes: input.buffer.length,
        fileName: input.fileName,
      },
    });

    const fresh = await this.getById(attachmentId);
    if (!fresh) throw new NotFoundException("Just-uploaded attachment vanished");
    return fresh;
  }

  // ── List ───────────────────────────────────────────────────────────────

  async listForEntity(
    entityType: string,
    entityId: string,
  ): Promise<AttachmentItem[]> {
    const rows = await this.queryRows(sql`
      WHERE a.HCenterID    = ${this.tenant.hcenterId}
        AND a.EntityType   = ${entityType}
        AND a.EntityID     = ${entityId}
        AND a.DeletedAt IS NULL
      ORDER BY a.UploadedAt DESC
    `);
    return rows.map(mapRow);
  }

  /**
   * Bulk attachment counts for a set of entity ids of the same type. Lets
   * list screens show "📎 Files (N)" per row without N+1 fetches. Returns
   * a map keyed by entityId; entities with zero attachments are omitted.
   */
  async countForEntities(
    entityType: string,
    entityIds: string[],
  ): Promise<Record<string, number>> {
    if (entityIds.length === 0) return {};
    if (!(ATTACHMENT_ENTITY_TYPES as ReadonlyArray<string>).includes(entityType)) {
      return {};
    }
    const rows = await this.tdb.db.execute<{ EntityID: string; n: number }>(sql`
      SELECT EntityID, COUNT(*) AS n
      FROM attachments
      WHERE HCenterID  = ${this.tenant.hcenterId}
        AND EntityType = ${entityType}
        AND EntityID IN (${sql.join(entityIds.map((id) => sql`${id}`), sql`, `)})
        AND DeletedAt IS NULL
      GROUP BY EntityID
    `);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arr: any[] = Array.isArray(rows)
      ? Array.isArray(rows[0])
        ? rows[0]
        : rows
      : [];
    const out: Record<string, number> = {};
    for (const r of arr) {
      if (r?.EntityID) out[r.EntityID] = Number(r.n);
    }
    return out;
  }

  /**
   * Aggregated patient-wide listing. Returns every (live) attachment whose
   * `PatientContext` matches — regardless of which entity it was uploaded
   * against (lab request, echo, visit, glasses Rx, the patient row itself, …).
   * Used by the patient detail screen's Files tab.
   */
  async listForPatient(patientId: string): Promise<AttachmentItem[]> {
    const rows = await this.queryRows(sql`
      WHERE a.HCenterID      = ${this.tenant.hcenterId}
        AND a.PatientContext = ${patientId}
        AND a.DeletedAt IS NULL
      ORDER BY a.UploadedAt DESC
    `);
    return rows.map(mapRow);
  }

  // ── Single row (for download / metadata) ───────────────────────────────

  async getById(attachmentId: string): Promise<AttachmentItem | null> {
    const rows = await this.queryRows(sql`
      WHERE a.HCenterID    = ${this.tenant.hcenterId}
        AND a.AttachmentID = ${attachmentId}
        AND a.DeletedAt IS NULL
      LIMIT 1
    `);
    const r = rows[0];
    return r ? mapRow(r) : null;
  }

  async getRowForDownload(attachmentId: string): Promise<{
    storageKey: string;
    storageBackend: string;
    mimeType: string;
    originalFileName: string;
    patientContext: string | null;
  } | null> {
    const rows = await this.queryRows(sql`
      WHERE a.HCenterID    = ${this.tenant.hcenterId}
        AND a.AttachmentID = ${attachmentId}
        AND a.DeletedAt IS NULL
      LIMIT 1
    `);
    const r = rows[0];
    if (!r) return null;
    return {
      storageKey: r.StorageKey,
      storageBackend: r.StorageBackend,
      mimeType: r.MimeType,
      originalFileName: r.OriginalFileName,
      patientContext: r.PatientContext,
    };
  }

  async openStream(attachmentId: string): Promise<{
    stream: Readable;
    mimeType: string;
    fileName: string;
    patientContext: string | null;
  }> {
    const row = await this.getRowForDownload(attachmentId);
    if (!row) throw new NotFoundException(`Attachment ${attachmentId} not found`);
    if (row.storageBackend !== "local") {
      // Future S3/R2 path: caller should redirect to a signed URL instead.
      throw new BadRequestException(
        `Streaming download unsupported for storage backend ${row.storageBackend}; use signedUrl.`,
      );
    }
    const stream = await this.storage.getStream(row.storageKey);
    return {
      stream,
      mimeType: row.mimeType,
      fileName: row.originalFileName,
      patientContext: row.patientContext,
    };
  }

  // ── Update notes ───────────────────────────────────────────────────────

  /**
   * Update the free-form notes attached to a row. Same permission model as
   * delete: only the uploader or a clinic admin can edit. Notes are capped
   * at 500 chars by the column + DTO validator.
   */
  async updateNotes(
    attachmentId: string,
    notes: string | null,
    opts: { isAdmin: boolean },
  ): Promise<AttachmentItem> {
    const rows = await this.queryRows(sql`
      WHERE a.HCenterID    = ${this.tenant.hcenterId}
        AND a.AttachmentID = ${attachmentId}
        AND a.DeletedAt IS NULL
      LIMIT 1
    `);
    const r = rows[0];
    if (!r) throw new NotFoundException(`Attachment ${attachmentId} not found`);
    if (!opts.isAdmin && r.UploadedBy !== this.tenant.userId) {
      throw new ForbiddenException(
        "Only the uploader or a clinic admin can edit this attachment",
      );
    }
    const cleaned = typeof notes === "string" ? notes.trim() : null;
    const normalised = cleaned && cleaned.length > 0 ? cleaned : null;
    await this.tdb.db.execute(sql`
      UPDATE attachments
      SET Notes = ${normalised}
      WHERE AttachmentID = ${attachmentId}
        AND HCenterID    = ${this.tenant.hcenterId}
    `);
    await this.audit.record({
      action: "Update",
      entityType: "Attachment",
      entityId: attachmentId,
      patientContext: r.PatientContext,
      previousValues: { notes: r.Notes },
      newValues: { notes: normalised },
    });
    const fresh = await this.getById(attachmentId);
    if (!fresh) throw new NotFoundException(`Attachment ${attachmentId} vanished after update`);
    return fresh;
  }

  // ── Delete ─────────────────────────────────────────────────────────────

  async softDelete(attachmentId: string, opts: { isAdmin: boolean }): Promise<void> {
    const rows = await this.queryRows(sql`
      WHERE a.HCenterID    = ${this.tenant.hcenterId}
        AND a.AttachmentID = ${attachmentId}
        AND a.DeletedAt IS NULL
      LIMIT 1
    `);
    const r = rows[0];
    if (!r) throw new NotFoundException(`Attachment ${attachmentId} not found`);
    if (!opts.isAdmin && r.UploadedBy !== this.tenant.userId) {
      throw new ForbiddenException(
        "Only the uploader or a clinic admin can delete this attachment",
      );
    }
    await this.tdb.db.execute(sql`
      UPDATE attachments
      SET DeletedAt = NOW(3)
      WHERE AttachmentID = ${attachmentId}
        AND HCenterID    = ${this.tenant.hcenterId}
    `);
    await this.audit.record({
      action: "Delete",
      entityType: "Attachment",
      entityId: attachmentId,
      patientContext: r.PatientContext,
      previousValues: { fileName: r.OriginalFileName, sizeBytes: r.SizeBytes },
    });
  }

  // ── Internals ──────────────────────────────────────────────────────────

  /**
   * Look up the patient associated with an entity row, so the attachment row
   * carries a denormalised PatientContext for the audit screen + per-patient
   * filtering. Falls back to null when the entity isn't patient-scoped.
   */
  private async resolvePatientContext(
    entityType: AttachmentEntityType,
    entityId: string,
  ): Promise<string | null> {
    const lookup: Partial<Record<AttachmentEntityType, string>> = {
      patientlabrequests: "SELECT PatientID FROM patientlabrequests WHERE PatientLabRequestID = ?",
      patientechocardiogramtests: "SELECT PatientID FROM patientechocardiogramtests WHERE PatientEchoCardiogramTestID = ?",
      patientvisits: "SELECT PatientID FROM patientvisits WHERE PatientVisitID = ?",
      patients: "SELECT PatientID FROM patients WHERE PatientID = ?",
      pvgprescription: "SELECT v.PatientID FROM pvgprescription g JOIN patientvisits v ON v.PatientVisitID = g.PatientVisitID WHERE g.PVGPrescriptionID = ?",
      patientbodysystemphysicalexam: "SELECT PatientID FROM patientbodysystemphysicalexam WHERE PatientBodySystemPhysicalExamID = ?",
    };
    const stmt = lookup[entityType];
    if (!stmt) return null;
    try {
      const result = await this.tdb.db.execute<{ PatientID: string | null }>(
        sql.raw(stmt.replace("?", `'${entityId.replace(/'/g, "''")}'`)),
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const arr: any[] = Array.isArray(result)
        ? Array.isArray(result[0])
          ? result[0]
          : result
        : [];
      return arr[0]?.PatientID ?? null;
    } catch {
      return null;
    }
  }

  private async queryRows(whereClause: ReturnType<typeof sql>): Promise<AttachmentRow[]> {
    const result = await this.tdb.db.execute<AttachmentRow>(sql`
      SELECT a.AttachmentID, a.HCenterID, a.EntityType, a.EntityID, a.PatientContext,
             a.StorageBackend, a.StorageKey, a.OriginalFileName, a.MimeType, a.SizeBytes,
             a.Checksum, a.Category, a.Notes, a.UploadedBy, a.UploadedAt, a.DeletedAt,
             CONCAT_WS(' ', u.FirstName, u.LastName) AS UploaderName
      FROM attachments a
      LEFT JOIN hcenterusers u ON u.UserId = a.UploadedBy
      ${whereClause}
    `);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arr: any[] = Array.isArray(result)
      ? Array.isArray(result[0])
        ? result[0]
        : result
      : [];
    return arr as AttachmentRow[];
  }
}

function mapRow(r: AttachmentRow): AttachmentItem {
  return {
    attachmentId: r.AttachmentID,
    entityType: r.EntityType,
    entityId: r.EntityID,
    patientContext: r.PatientContext,
    storageBackend: r.StorageBackend,
    originalFileName: r.OriginalFileName,
    mimeType: r.MimeType,
    sizeBytes: Number(r.SizeBytes),
    category: r.Category,
    notes: r.Notes,
    uploadedBy: r.UploadedBy,
    uploadedAt: r.UploadedAt,
    uploadedByName: (r.UploaderName ?? "").trim() || null,
    isImage: r.MimeType.startsWith("image/"),
  };
}
