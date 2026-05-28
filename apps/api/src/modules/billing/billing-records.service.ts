import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  hcenterusers,
  patientbillingrecords,
  patientvisits,
  patients,
  transactioncategories,
} from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";
import { TenantContextService } from "../../common/tenant/tenant-context";
import { AuditService } from "../../common/audit/audit.service";
import type { BillingRecordItem, CreateBillingRecordDto } from "./dto/billing.dto";

@Injectable()
export class BillingRecordsService {
  constructor(
    private readonly tdb: TenantDbService,
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  async listForVisit(visitId: string): Promise<BillingRecordItem[]> {
    await this.assertVisitInTenant(visitId);

    const rows = await this.tdb.db
      .select({
        patientBillingRecordId: patientbillingrecords.patientBillingRecordId,
        transactionCategoryId: patientbillingrecords.transactionCategoryId,
        categoryName: transactioncategories.transactionCategoryName,
        details: patientbillingrecords.details,
        expense: patientbillingrecords.expense,
        isLocked: patientbillingrecords.isLocked,
        recordDate: patientbillingrecords.recordDate,
        doctorId: patientbillingrecords.doctorId,
        ifNumber: patientbillingrecords.ifNumber,
      })
      .from(patientbillingrecords)
      .innerJoin(
        transactioncategories,
        eq(transactioncategories.transactionCategoryId, patientbillingrecords.transactionCategoryId),
      )
      .where(eq(patientbillingrecords.patientVisitId, visitId))
      .orderBy(asc(patientbillingrecords.recordDate));

    return rows.map((r) => ({
      patientBillingRecordId: r.patientBillingRecordId,
      transactionCategoryId: r.transactionCategoryId,
      categoryName: r.categoryName,
      details: r.details,
      expense: r.expense,
      isLocked: r.isLocked === 1,
      recordDate: r.recordDate,
      doctorId: r.doctorId ?? null,
      ifNumber: r.ifNumber ?? null,
    }));
  }

  async add(
    visitId: string,
    dto: CreateBillingRecordDto,
  ): Promise<{ patientBillingRecordId: string }> {
    const visit = await this.assertVisitInTenant(visitId);
    const category = await this.assertCategoryInTenant(dto.transactionCategoryId);

    if (dto.doctorId) {
      await this.assertDoctorInTenant(dto.doctorId);
    }

    const id = randomUUID();
    await this.tdb.db.insert(patientbillingrecords).values({
      patientBillingRecordId: id,
      patientVisitId: visitId,
      transactionCategoryId: dto.transactionCategoryId,
      recordDate: formatMysqlDateTime(new Date()) as string,
      details: dto.details?.trim() || category.name,
      expense: dto.expense,
      doctorId: dto.doctorId ?? null,
      userId: this.tenant.userId,
      isLocked: 0,
      ifNumber: dto.ifNumber?.trim() ?? null,
    });

    await this.audit.record({
      action: "Create",
      entityType: "BillingRecord",
      entityId: id,
      patientContext: visit.patientId,
      newValues: {
        visitId,
        categoryId: dto.transactionCategoryId,
        categoryName: category.name,
        expense: dto.expense,
      },
    });

    return { patientBillingRecordId: id };
  }

  async remove(visitId: string, recordId: string): Promise<void> {
    const visit = await this.assertVisitInTenant(visitId);

    const [current] = await this.tdb.db
      .select()
      .from(patientbillingrecords)
      .where(
        and(
          eq(patientbillingrecords.patientBillingRecordId, recordId),
          eq(patientbillingrecords.patientVisitId, visitId),
        ),
      )
      .limit(1);

    if (!current) throw new NotFoundException(`Billing record ${recordId} not found`);
    if (current.isLocked === 1) {
      throw new BadRequestException(
        "Cannot delete a locked billing record — it has already been invoiced",
      );
    }

    await this.tdb.db
      .delete(patientbillingrecords)
      .where(eq(patientbillingrecords.patientBillingRecordId, recordId));

    await this.audit.record({
      action: "Delete",
      entityType: "BillingRecord",
      entityId: recordId,
      patientContext: visit.patientId,
      previousValues: {
        visitId,
        categoryId: current.transactionCategoryId,
        expense: current.expense,
        details: current.details,
      },
    });
  }

  // ── Guards ────────────────────────────────────────────────────────────────

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

  private async assertCategoryInTenant(categoryId: string): Promise<{ name: string }> {
    const [row] = await this.tdb.db
      .select({ name: transactioncategories.transactionCategoryName })
      .from(transactioncategories)
      .where(
        and(
          eq(transactioncategories.transactionCategoryId, categoryId),
          this.tdb.tenantClause(transactioncategories),
        ),
      )
      .limit(1);
    if (!row) throw new BadRequestException(`Transaction category ${categoryId} not found`);
    return row;
  }

  private async assertDoctorInTenant(userId: string): Promise<void> {
    const [row] = await this.tdb.db
      .select({ id: hcenterusers.userId })
      .from(hcenterusers)
      .where(
        and(
          eq(hcenterusers.userId, userId),
          eq(hcenterusers.hcenterId, this.tdb.tenantId),
        ),
      )
      .limit(1);
    if (!row) throw new BadRequestException(`Doctor ${userId} not in this HCenter`);
  }
}

function formatMysqlDateTime(v: string | Date | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const d =
    v instanceof Date
      ? v
      : new Date(typeof v === "string" && !v.includes("T") && !v.includes(" ") ? `${v}T00:00:00.000Z` : v);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const HH = String(d.getUTCHours()).padStart(2, "0");
  const MM = String(d.getUTCMinutes()).padStart(2, "0");
  const SS = String(d.getUTCSeconds()).padStart(2, "0");
  const ms = String(d.getUTCMilliseconds()).padStart(3, "0");
  return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}.${ms}`;
}
