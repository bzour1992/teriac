import { Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  bodysystems,
  patientbodysystemreview,
  patientvisits,
  patients,
} from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";
import { TenantContextService } from "../../common/tenant/tenant-context";
import { AuditService } from "../../common/audit/audit.service";
import type { BodySystemEntry, SaveBodySystemDto } from "./dto/body-system.dto";

@Injectable()
export class BodySystemReviewService {
  constructor(
    private readonly tdb: TenantDbService,
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  async get(visitId: string): Promise<BodySystemEntry[]> {
    const visit = await this.assertVisitInTenant(visitId);

    // Find the most recent lotGuid for this visit
    const [latest] = await this.tdb.db
      .select({ lotGuid: patientbodysystemreview.lotGuid })
      .from(patientbodysystemreview)
      .where(eq(patientbodysystemreview.patientVisitId, visitId))
      .orderBy(desc(patientbodysystemreview.recordDate))
      .limit(1);

    if (!latest) return [];

    const rows = await this.tdb.db
      .select({
        patientBodySystemReviewId: patientbodysystemreview.patientBodySystemReviewId,
        bodySystemId: patientbodysystemreview.bodySystemId,
        bodySystemName: bodysystems.bodySystemName,
        isNormal: patientbodysystemreview.isNormal,
        notes: patientbodysystemreview.notes,
      })
      .from(patientbodysystemreview)
      .innerJoin(bodysystems, eq(bodysystems.bodySystemId, patientbodysystemreview.bodySystemId))
      .where(
        and(
          eq(patientbodysystemreview.patientVisitId, visitId),
          eq(patientbodysystemreview.lotGuid, latest.lotGuid),
        ),
      );

    return rows.map((r) => ({
      patientBodySystemReviewId: r.patientBodySystemReviewId,
      bodySystemId: r.bodySystemId,
      bodySystemName: r.bodySystemName,
      isNormal: r.isNormal === 1,
      notes: r.notes ?? null,
    }));
  }

  async save(
    visitId: string,
    dto: SaveBodySystemDto,
  ): Promise<{ lotGuid: string }> {
    const visit = await this.assertVisitInTenant(visitId);

    const lotGuid = randomUUID();
    const now = fmtDate(new Date());

    for (const item of dto.items) {
      await this.tdb.db.insert(patientbodysystemreview).values({
        patientBodySystemReviewId: randomUUID(),
        patientId: visit.patientId,
        patientVisitId: visitId,
        bodySystemId: item.bodySystemId,
        isNormal: item.isNormal ? 1 : 0,
        notes: item.notes?.trim() ?? null,
        recordDate: now,
        lotGuid,
        username: this.tenant.userId,
      });
    }

    await this.audit.record({
      action: "Create",
      entityType: "BodySystemReview",
      entityId: lotGuid,
      patientContext: visit.patientId,
      newValues: { visitId, systemCount: dto.items.length, lotGuid },
    });

    return { lotGuid };
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

function fmtDate(v: Date): string {
  const y = v.getUTCFullYear();
  const mo = String(v.getUTCMonth() + 1).padStart(2, "0");
  const d  = String(v.getUTCDate()).padStart(2, "0");
  const h  = String(v.getUTCHours()).padStart(2, "0");
  const mi = String(v.getUTCMinutes()).padStart(2, "0");
  const s  = String(v.getUTCSeconds()).padStart(2, "0");
  const ms = String(v.getUTCMilliseconds()).padStart(3, "0");
  return `${y}-${mo}-${d} ${h}:${mi}:${s}.${ms}`;
}
