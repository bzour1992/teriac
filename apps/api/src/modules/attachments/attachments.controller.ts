import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { AttachmentsService } from "./attachments.service";
import { TenantContextService } from "../../common/tenant/tenant-context";
import {
  ATTACHMENT_MAX_BYTES,
  UpdateAttachmentDto,
  UploadAttachmentDto,
  type AttachmentItem,
} from "./dto/attachments.dto";

/**
 * Minimal multer file shape — we don't pull in @types/multer just for this.
 * Buffer-backed because we use `memoryStorage` to avoid disk round-trips
 * between multer and the StorageProvider.
 */
interface UploadedMulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@ApiTags("attachments")
@ApiBearerAuth()
@Controller("attachments")
export class AttachmentsController {
  constructor(
    private readonly attachments: AttachmentsService,
    private readonly tenant: TenantContextService,
  ) {}

  // ── List ───────────────────────────────────────────────────────────────

  @Get()
  list(
    @Query("entityType") entityType: string,
    @Query("entityId") entityId: string,
  ): Promise<AttachmentItem[]> {
    if (!entityType || !entityId) {
      throw new BadRequestException("entityType and entityId are required");
    }
    return this.attachments.listForEntity(entityType, entityId);
  }

  /** All attachments belonging to a patient, across every entity type that
   *  carries `PatientContext`. Drives the Files tab on patient detail. */
  @Get("patient/:patientId")
  listForPatient(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
  ): Promise<AttachmentItem[]> {
    return this.attachments.listForPatient(patientId);
  }

  /** Bulk attachment counts — `entityIds` is a CSV. Used by list screens to
   *  badge each row with its attachment count in one round trip. */
  @Get("counts")
  counts(
    @Query("entityType") entityType: string,
    @Query("entityIds") entityIdsCsv: string,
  ): Promise<Record<string, number>> {
    if (!entityType || !entityIdsCsv) {
      throw new BadRequestException("entityType and entityIds are required");
    }
    const ids = entityIdsCsv
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 200); // cap so a malicious CSV can't expand without bound
    return this.attachments.countForEntities(entityType, ids);
  }

  // ── Upload ─────────────────────────────────────────────────────────────

  @Post()
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: ATTACHMENT_MAX_BYTES, files: 1 },
    }),
  )
  upload(
    @Body() body: UploadAttachmentDto,
    @UploadedFile() file: UploadedMulterFile | undefined,
  ): Promise<AttachmentItem> {
    if (!file) throw new BadRequestException("Missing file");
    return this.attachments.upload({
      entityType: body.entityType,
      entityId: body.entityId,
      category: body.category,
      notes: body.notes,
      fileName: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
    });
  }

  // ── Download ───────────────────────────────────────────────────────────

  @Get(":id/download")
  async download(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const opened = await this.attachments.openStream(id);
    res.setHeader("Content-Type", opened.mimeType);
    // RFC 5987 encoding for non-ASCII filenames.
    const safeAscii = opened.fileName.replace(/[^\x20-\x7E]/g, "_");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(opened.fileName)}`,
    );
    opened.stream.on("error", (err) => res.destroy(err));
    opened.stream.pipe(res);
  }

  // ── Update notes ───────────────────────────────────────────────────────

  @Patch(":id")
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateAttachmentDto,
  ): Promise<AttachmentItem> {
    const claims = this.tenant.tryGet();
    const isAdmin = !!(claims?.isAdmin || claims?.isSuperAdmin);
    return this.attachments.updateNotes(id, body.notes ?? null, { isAdmin });
  }

  // ── Soft delete ────────────────────────────────────────────────────────

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> {
    const claims = this.tenant.tryGet();
    const isAdmin = !!(claims?.isAdmin || claims?.isSuperAdmin);
    const found = await this.attachments.getById(id);
    if (!found) throw new NotFoundException(`Attachment ${id} not found`);
    await this.attachments.softDelete(id, { isAdmin });
  }
}
