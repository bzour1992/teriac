import { Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { patientvisits, patients, pvrevisits } from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";
import { AuditService } from "../../common/audit/audit.service";
import type { CreateRevisitDto, RevisitItem } from "./dto/revisit.dto";

@Injectable()
export class RevisitsService {
  constructor(
    private readonly tdb: TenantDbService,
    private readonly audit: AuditService,
  ) {}

  async list(visitId: string): Promise<RevisitItem[]> {
    const visit = await this.assertVisitInTenant(visitId);

    const rows = await this.tdb.db
      .select()
      .from(pvrevisits)
      .where(and(eq(pvrevisits.patientVisitId, visitId), eq(pvrevisits.isDeleted, 0)))
      .orderBy(asc(pvrevisits.revisitDate));

    return rows.map((r) => ({
      pvRevisitId: r.pvRevisitId,
      revisitDate: r.revisitDate,
      notes: r.notes ?? null,
      comments: r.comments ?? null,
    }));
  }

  async create(visitId: string, dto: CreateRevisitDto): Promise<{ pvRevisitId: string }> {
    const visit = await this.assertVisitInTenant(visitId);

    const id = randomUUID();
    await this.tdb.db.insert(pvrevisits).values({
      pvRevisitId: id,
      patientVisitId: visitId,
      revisitDate: normalizeDate(dto.revisitDate) as string,
      notes: dto.notes?.trim() ?? null,
      comments: dto.comments?.trim() ?? null,
      isDeleted: 0,
    });

    await this.audit.record({
      action: "Create",
      entityType: "Revisit",
      entityId: id,
      patientContext: visit.patientId,
      newValues: { visitId, revisitDate: dto.revisitDate },
    });

    return { pvRevisitId: id };
  }

  async delete(visitId: string, revisitId: string): Promise<void> {
    const visit = await this.assertVisitInTenant(visitId);

    const [current] = await this.tdb.db
      .select()
      .from(pvrevisits)
      .where(
        and(
          eq(pvrevisits.pvRevisitId, revisitId),
          eq(pvrevisits.patientVisitId, visitId),
          eq(pvrevisits.isDeleted, 0),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundException(`Revisit ${revisitId} not found`);

    await this.tdb.db
      .update(pvrevisits)
      .set({ isDeleted: 1 })
      .where(eq(pvrevisits.pvRevisitId, revisitId));

    await this.audit.record({
      action: "Delete",
      entityType: "Revisit",
      entityId: revisitId,
      patientContext: visit.patientId,
      previousValues: { revisitDate: current.revisitDate },
    });
  }

  private async assertVisitInTenant(visitId: string): Promise<{ patientId: string }> {
    const [row] = await this.tdb.db
      .select({ patientId: patients.patientId })
      .from(patientvisits)
      .innerJoin(patients, eq(patients.patientId, patientvisits.patientId))
      .where(
        and(
          eq(patientvisits.patientVisitId, visitId),
          eq(patientvisits.isDeleted, 0),
          eq(patients.hcenterId, this.tdb.tenantId),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException(`Visit ${visitId} not found`);
    return row;
  }
}

function normalizeDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = String(s).trim();
  return t.length === 0 ? null : t;
}
