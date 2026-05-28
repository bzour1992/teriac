import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { hcenterfieldrules } from "../../db/schema";
import { DRIZZLE, type Db } from "../../db/tokens";
import { TenantContextService } from "../../common/tenant/tenant-context";

export type FieldVisibility = "hidden" | "visible" | "readonly";
export type FieldRequirement = "optional" | "required" | "conditional";

export interface FieldRuleDto {
  entityName: string;
  fieldName: string;
  visibility: FieldVisibility;
  requirement: FieldRequirement;
  defaultValue: string | null;
  labelEn: string | null;
  labelAr: string | null;
}

interface CacheEntry {
  expiresAt: number;
  rules: FieldRuleDto[];
}

const CACHE_TTL_MS = 5 * 60_000;

/**
 * Tenant-scoped reader for `hcenterfieldrules` — used by every authenticated
 * client (not just superadmin) to apply visibility/requirement overrides on
 * forms. The superadmin's write path invalidates this via `invalidate()`.
 */
@Injectable()
export class TenantFieldRulesService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly tenant: TenantContextService,
  ) {}

  async listForCurrentClinic(entity?: string): Promise<FieldRuleDto[]> {
    const hcenterId = this.tenant.hcenterId;
    const cacheKey = `${hcenterId}::${entity ?? "*"}`;
    const now = Date.now();

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > now) return cached.rules;

    const filters = [eq(hcenterfieldrules.hcenterId, hcenterId)];
    if (entity) filters.push(eq(hcenterfieldrules.entityName, entity));
    const rows = await this.db
      .select()
      .from(hcenterfieldrules)
      .where(and(...filters));

    const rules: FieldRuleDto[] = rows.map((r) => ({
      entityName: r.entityName,
      fieldName: r.fieldName,
      // Some legacy rows have quoted enum values — strip them.
      visibility: (r.visibility?.replace(/'/g, "") ?? "visible") as FieldVisibility,
      requirement: (r.requirement?.replace(/'/g, "") ?? "optional") as FieldRequirement,
      defaultValue: r.defaultValue ?? null,
      labelEn: r.labelEn ?? null,
      labelAr: r.labelAr ?? null,
    }));

    this.cache.set(cacheKey, { rules, expiresAt: now + CACHE_TTL_MS });
    return rules;
  }

  /** Drop the cache for one clinic (call after superadmin writes). */
  invalidate(hcenterId: string): void {
    for (const k of this.cache.keys()) {
      if (k.startsWith(`${hcenterId}::`)) this.cache.delete(k);
    }
  }
}
