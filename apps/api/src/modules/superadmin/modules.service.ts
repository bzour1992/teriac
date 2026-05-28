import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { hcenters, hcentermodules } from "../../db/schema";
import { DRIZZLE, type Db } from "../../db/tokens";
import { TenantContextService } from "../../common/tenant/tenant-context";
import { AuditService } from "../../common/audit/audit.service";
import { ModulesAccessService } from "../../common/modules/modules-access.service";
import { MODULE_KEYS, type ClinicModule, type SetModuleDto } from "./dto/superadmin.dto";

@Injectable()
export class ClinicModulesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
    private readonly modulesAccess: ModulesAccessService,
  ) {}

  /**
   * Returns one row per known module key. If a row is missing from
   * hcentermodules for a clinic, it's reported as disabled.
   */
  async listForClinic(clinicId: string): Promise<ClinicModule[]> {
    await this.assertClinic(clinicId);
    const rows = await this.db
      .select()
      .from(hcentermodules)
      .where(eq(hcentermodules.hcenterId, clinicId));

    const byKey: Record<string, typeof rows[number]> = {};
    for (const r of rows) byKey[r.moduleKey] = r;

    return MODULE_KEYS.map((k) => {
      const r = byKey[k];
      return {
        moduleKey: k,
        isEnabled: r?.isEnabled === 1,
        enabledAt: r?.enabledAt ?? null,
        notes: r?.notes ?? null,
      };
    });
  }

  async setForClinic(clinicId: string, moduleKey: string, dto: SetModuleDto): Promise<void> {
    await this.assertClinic(clinicId);
    if (!MODULE_KEYS.includes(moduleKey as typeof MODULE_KEYS[number])) {
      throw new NotFoundException(`Unknown module ${moduleKey}`);
    }

    const [existing] = await this.db
      .select()
      .from(hcentermodules)
      .where(and(eq(hcentermodules.hcenterId, clinicId), eq(hcentermodules.moduleKey, moduleKey)))
      .limit(1);

    const now = fmtDate(new Date());
    const userId = this.tenant.userId;

    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const setFields: Record<string, any> = {
        isEnabled: dto.isEnabled ? 1 : 0,
        notes: dto.notes?.trim() ?? null,
      };
      if (dto.isEnabled && existing.isEnabled !== 1) {
        setFields.enabledAt = now;
        setFields.enabledBy = userId;
      } else if (!dto.isEnabled && existing.isEnabled === 1) {
        setFields.disabledAt = now;
        setFields.disabledBy = userId;
      }
      await this.db
        .update(hcentermodules)
        .set(setFields)
        .where(and(eq(hcentermodules.hcenterId, clinicId), eq(hcentermodules.moduleKey, moduleKey)));
    } else {
      await this.db.insert(hcentermodules).values({
        hcenterId: clinicId,
        moduleKey,
        isEnabled: dto.isEnabled ? 1 : 0,
        enabledAt: dto.isEnabled ? now : null,
        enabledBy: dto.isEnabled ? userId : null,
        notes: dto.notes?.trim() ?? null,
      });
    }

    await this.audit.record({
      action: "Update",
      entityType: "ClinicModule",
      entityId: `${clinicId}:${moduleKey}`,
      patientContext: null,
      newValues: { isEnabled: dto.isEnabled, notes: dto.notes ?? null },
    });

    // Bust the in-process module cache so the change takes effect immediately
    // (otherwise users keep their previously-cached access for up to 15s).
    this.modulesAccess.invalidate(clinicId);
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
