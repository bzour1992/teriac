import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { patientlabrequests, patients } from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";
import { AuditService } from "../../common/audit/audit.service";
import type {
  CreateLabRequestDto,
  LabRequestListItem,
  UpdateLabRequestDto,
} from "./dto/lab-request.dto";

@Injectable()
export class LabRequestsService {
  constructor(
    private readonly tdb: TenantDbService,
    private readonly audit: AuditService,
  ) {}

  async list(patientId: string): Promise<LabRequestListItem[]> {
    await this.assertPatientInTenant(patientId);

    const rows = await this.tdb.db
      .select()
      .from(patientlabrequests)
      .where(eq(patientlabrequests.patientId, patientId))
      .orderBy(desc(patientlabrequests.requestDate));

    return rows.map((r) => ({
      patientLabRequestId: r.patientLabRequestId,
      labRequest: r.labRequest,
      lab: r.lab ?? null,
      requestDate: r.requestDate,
      expectedDeliveryDate: r.expectedDeliveryDate,
      isDelivered: r.isDelivered === 1,
      deliveryDate: r.deliveryDate ?? null,
    }));
  }

  async create(
    patientId: string,
    dto: CreateLabRequestDto,
  ): Promise<{ patientLabRequestId: string }> {
    await this.assertPatientInTenant(patientId);

    const id = randomUUID();
    await this.tdb.db.insert(patientlabrequests).values({
      patientLabRequestId: id,
      patientId,
      labRequest: dto.labRequest,
      lab: dto.lab?.trim() ?? null,
      requestDate: normalizeDate(dto.requestDate) as string,
      expectedDeliveryDate: normalizeDate(dto.expectedDeliveryDate) as string,
      isDelivered: 0,
      deliveryDate: null,
    });

    await this.audit.record({
      action: "Create",
      entityType: "LabRequest",
      entityId: id,
      patientContext: patientId,
      newValues: { labRequest: dto.labRequest, lab: dto.lab ?? null },
    });

    return { patientLabRequestId: id };
  }

  async update(
    patientId: string,
    requestId: string,
    dto: UpdateLabRequestDto,
  ): Promise<void> {
    await this.assertPatientInTenant(patientId);

    const [current] = await this.tdb.db
      .select()
      .from(patientlabrequests)
      .where(
        and(
          eq(patientlabrequests.patientLabRequestId, requestId),
          eq(patientlabrequests.patientId, patientId),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundException(`Lab request ${requestId} not found`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setFields: Record<string, any> = {};
    const prev: Record<string, unknown> = {};
    const next: Record<string, unknown> = {};

    if (dto.labRequest !== undefined && dto.labRequest !== current.labRequest) {
      setFields.labRequest = dto.labRequest;
      prev.labRequest = current.labRequest;
      next.labRequest = dto.labRequest;
    }
    if (dto.lab !== undefined) {
      const v = dto.lab?.trim() ?? null;
      if (v !== (current.lab ?? null)) {
        setFields.lab = v;
        prev.lab = current.lab ?? null;
        next.lab = v;
      }
    }
    if (dto.isDelivered !== undefined) {
      const v = dto.isDelivered ? 1 : 0;
      if (v !== current.isDelivered) {
        setFields.isDelivered = v;
        prev.isDelivered = current.isDelivered === 1;
        next.isDelivered = dto.isDelivered;
      }
    }
    if (dto.deliveryDate !== undefined) {
      setFields.deliveryDate = normalizeDate(dto.deliveryDate);
    }
    if (dto.expectedDeliveryDate !== undefined) {
      const v = normalizeDate(dto.expectedDeliveryDate);
      if (v !== current.expectedDeliveryDate) {
        setFields.expectedDeliveryDate = v;
      }
    }

    if (Object.keys(setFields).length === 0) return;

    const result = await this.tdb.db
      .update(patientlabrequests)
      .set(setFields)
      .where(eq(patientlabrequests.patientLabRequestId, requestId));

    const affected = (result as unknown as { affectedRows?: number }).affectedRows ?? null;
    if (affected !== null && affected !== 1) {
      throw new ConflictException(`Expected to update 1 lab request, affected ${affected}`);
    }

    await this.audit.record({
      action: "Update",
      entityType: "LabRequest",
      entityId: requestId,
      patientContext: patientId,
      changedFields: Object.keys(next),
      previousValues: prev,
      newValues: next,
    });
  }

  async delete(patientId: string, requestId: string): Promise<void> {
    await this.assertPatientInTenant(patientId);

    const [current] = await this.tdb.db
      .select()
      .from(patientlabrequests)
      .where(
        and(
          eq(patientlabrequests.patientLabRequestId, requestId),
          eq(patientlabrequests.patientId, patientId),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundException(`Lab request ${requestId} not found`);

    await this.tdb.db
      .delete(patientlabrequests)
      .where(eq(patientlabrequests.patientLabRequestId, requestId));

    await this.audit.record({
      action: "Delete",
      entityType: "LabRequest",
      entityId: requestId,
      patientContext: patientId,
      previousValues: { labRequest: current.labRequest, lab: current.lab, isDelivered: current.isDelivered === 1 },
    });
  }

  private async assertPatientInTenant(patientId: string): Promise<void> {
    const [row] = await this.tdb.db
      .select({ id: patients.patientId })
      .from(patients)
      .where(
        and(
          eq(patients.patientId, patientId),
          eq(patients.isDeleted, 0),
          eq(patients.hcenterId, this.tdb.tenantId),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException(`Patient ${patientId} not found`);
  }
}

function normalizeDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = String(s).trim();
  return t.length === 0 ? null : t;
}
