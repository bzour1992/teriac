import { Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  aftervisitrecommendations,
  patientvisits,
  patients,
} from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";
import { TenantContextService } from "../../common/tenant/tenant-context";
import { AuditService } from "../../common/audit/audit.service";
import type {
  CreateRecommendationDto,
  RecommendationItem,
} from "./dto/recommendation.dto";

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly tdb: TenantDbService,
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  async list(visitId: string): Promise<RecommendationItem[]> {
    await this.assertVisitInTenant(visitId);

    const rows = await this.tdb.db
      .select()
      .from(aftervisitrecommendations)
      .where(eq(aftervisitrecommendations.patientVisitId, visitId))
      .orderBy(asc(aftervisitrecommendations.requestDate));

    return rows.map(mapRec);
  }

  async create(
    visitId: string,
    dto: CreateRecommendationDto,
  ): Promise<{ afterVisitRecommendationId: string }> {
    const visit = await this.assertVisitInTenant(visitId);

    const id = randomUUID();
    const now = fmtDate(new Date());

    await this.tdb.db.insert(aftervisitrecommendations).values({
      afterVisitRecommendationId: id,
      patientVisitId: visitId,
      recommended: dto.recommended.trim(),
      requestedByUserId: this.tenant.userId,
      requestDate: now,
      isDone: 0,
    });

    await this.audit.record({
      action: "Create",
      entityType: "AfterVisitRecommendation",
      entityId: id,
      patientContext: visit.patientId,
      newValues: { recommended: dto.recommended },
    });

    return { afterVisitRecommendationId: id };
  }

  async process(visitId: string, recId: string): Promise<void> {
    const visit = await this.assertVisitInTenant(visitId);

    const [current] = await this.tdb.db
      .select()
      .from(aftervisitrecommendations)
      .where(
        and(
          eq(aftervisitrecommendations.afterVisitRecommendationId, recId),
          eq(aftervisitrecommendations.patientVisitId, visitId),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundException(`Recommendation ${recId} not found`);

    const now = fmtDate(new Date());
    await this.tdb.db
      .update(aftervisitrecommendations)
      .set({ isDone: 1, processedDate: now, processedByUserId: this.tenant.userId })
      .where(eq(aftervisitrecommendations.afterVisitRecommendationId, recId));

    await this.audit.record({
      action: "Update",
      entityType: "AfterVisitRecommendation",
      entityId: recId,
      patientContext: visit.patientId,
      changedFields: ["isDone", "processedDate"],
      previousValues: { isDone: false },
      newValues: { isDone: true, processedDate: now },
    });
  }

  async delete(visitId: string, recId: string): Promise<void> {
    const visit = await this.assertVisitInTenant(visitId);

    const [current] = await this.tdb.db
      .select()
      .from(aftervisitrecommendations)
      .where(
        and(
          eq(aftervisitrecommendations.afterVisitRecommendationId, recId),
          eq(aftervisitrecommendations.patientVisitId, visitId),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundException(`Recommendation ${recId} not found`);

    await this.tdb.db
      .delete(aftervisitrecommendations)
      .where(eq(aftervisitrecommendations.afterVisitRecommendationId, recId));

    await this.audit.record({
      action: "Delete",
      entityType: "AfterVisitRecommendation",
      entityId: recId,
      patientContext: visit.patientId,
      previousValues: { recommended: current.recommended },
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

function mapRec(r: typeof aftervisitrecommendations.$inferSelect): RecommendationItem {
  return {
    afterVisitRecommendationId: r.afterVisitRecommendationId,
    recommended: r.recommended,
    isDone: r.isDone === 1,
    requestDate: r.requestDate,
    processedDate: r.processedDate ?? null,
  };
}

function fmtDate(v: Date): string {
  const y=v.getUTCFullYear(),mo=String(v.getUTCMonth()+1).padStart(2,"0"),d=String(v.getUTCDate()).padStart(2,"0");
  const h=String(v.getUTCHours()).padStart(2,"0"),mi=String(v.getUTCMinutes()).padStart(2,"0"),s=String(v.getUTCSeconds()).padStart(2,"0"),ms=String(v.getUTCMilliseconds()).padStart(3,"0");
  return `${y}-${mo}-${d} ${h}:${mi}:${s}.${ms}`;
}
