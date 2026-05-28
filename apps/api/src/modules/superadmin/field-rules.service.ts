import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { hcenters, hcenterfieldrules } from "../../db/schema";
import { DRIZZLE, type Db } from "../../db/tokens";
import { TenantContextService } from "../../common/tenant/tenant-context";
import { AuditService } from "../../common/audit/audit.service";
import { TenantFieldRulesService } from "../field-rules/field-rules.service";
import type { FieldRule, SetFieldRuleDto } from "./dto/superadmin.dto";

@Injectable()
export class FieldRulesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
    private readonly tenantRules: TenantFieldRulesService,
  ) {}

  async listForClinic(clinicId: string, entity?: string): Promise<FieldRule[]> {
    await this.assertClinic(clinicId);
    const filters = [eq(hcenterfieldrules.hcenterId, clinicId)];
    if (entity) filters.push(eq(hcenterfieldrules.entityName, entity));
    const rows = await this.db
      .select()
      .from(hcenterfieldrules)
      .where(and(...filters));
    return rows.map((r) => ({
      entityName: r.entityName,
      fieldName: r.fieldName,
      visibility: (r.visibility?.replace(/'/g, "") ?? "visible") as FieldRule["visibility"],
      requirement: (r.requirement?.replace(/'/g, "") ?? "optional") as FieldRule["requirement"],
      defaultValue: r.defaultValue ?? null,
      labelEn: r.labelEn ?? null,
      labelAr: r.labelAr ?? null,
    }));
  }

  async setForClinic(
    clinicId: string,
    entity: string,
    field: string,
    dto: SetFieldRuleDto,
  ): Promise<void> {
    await this.assertClinic(clinicId);
    const [existing] = await this.db
      .select()
      .from(hcenterfieldrules)
      .where(and(
        eq(hcenterfieldrules.hcenterId, clinicId),
        eq(hcenterfieldrules.entityName, entity),
        eq(hcenterfieldrules.fieldName, field),
      ))
      .limit(1);

    const now = fmtDate(new Date());

    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const setFields: Record<string, any> = { updatedAt: now, updatedBy: this.tenant.userId };
      if (dto.visibility !== undefined) setFields.visibility = dto.visibility;
      if (dto.requirement !== undefined) setFields.requirement = dto.requirement;
      if (dto.defaultValue !== undefined) setFields.defaultValue = dto.defaultValue?.trim() || null;
      if (dto.labelEn !== undefined) setFields.labelEn = dto.labelEn?.trim() || null;
      if (dto.labelAr !== undefined) setFields.labelAr = dto.labelAr?.trim() || null;
      await this.db.update(hcenterfieldrules).set(setFields).where(and(
        eq(hcenterfieldrules.hcenterId, clinicId),
        eq(hcenterfieldrules.entityName, entity),
        eq(hcenterfieldrules.fieldName, field),
      ));
    } else {
      await this.db.insert(hcenterfieldrules).values({
        hcenterId: clinicId,
        entityName: entity,
        fieldName: field,
        visibility: dto.visibility ?? "visible",
        requirement: dto.requirement ?? "optional",
        defaultValue: dto.defaultValue?.trim() || null,
        labelEn: dto.labelEn?.trim() || null,
        labelAr: dto.labelAr?.trim() || null,
        updatedBy: this.tenant.userId,
        updatedAt: now,
      });
    }

    await this.audit.record({
      action: "Update",
      entityType: "FieldRule",
      entityId: `${clinicId}:${entity}:${field}`,
      patientContext: null,
      newValues: { ...dto },
    });

    // Drop the tenant-side cache so users get the new rule immediately.
    this.tenantRules.invalidate(clinicId);
  }

  private async assertClinic(clinicId: string): Promise<void> {
    const [row] = await this.db.select({ id: hcenters.hcenterId }).from(hcenters)
      .where(eq(hcenters.hcenterId, clinicId)).limit(1);
    if (!row) throw new NotFoundException(`Clinic ${clinicId} not found`);
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
