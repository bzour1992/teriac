import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { hcentermodules } from "../../db/schema";
import { DRIZZLE, type Db } from "../../db/tokens";

/**
 * The 10 togglable specialty + functional modules. Mirrors `MODULE_KEYS` in the
 * superadmin DTO — keep these two lists in sync.
 */
export const TOGGLABLE_MODULE_KEYS = [
  "pediatrics",
  "obgyn",
  "fertility",
  "dermatology",
  "dentistry",
  "cardiology",
  "optometry",
  "finance",
  "reports",
  "audit",
] as const;

export type ToggleableModuleKey = (typeof TOGGLABLE_MODULE_KEYS)[number];

interface CacheEntry {
  expiresAt: number;
  enabledKeys: Set<string>;
}

/**
 * Resolves which feature modules are enabled for a given clinic.
 *
 * - Reads `hcentermodules`; rows with `isEnabled=1` are considered enabled.
 * - Rows missing from the table are reported as DISABLED. Superadmins must
 *   explicitly opt a clinic in.
 * - 15-second in-process cache per clinic to avoid hammering the DB on every
 *   request. Toggle changes propagate within that window.
 */
@Injectable()
export class ModulesAccessService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly TTL_MS = 15_000;

  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async listEnabled(hcenterId: string): Promise<Set<string>> {
    const now = Date.now();
    const cached = this.cache.get(hcenterId);
    if (cached && cached.expiresAt > now) return cached.enabledKeys;

    const rows = await this.db
      .select({ key: hcentermodules.moduleKey, enabled: hcentermodules.isEnabled })
      .from(hcentermodules)
      .where(and(eq(hcentermodules.hcenterId, hcenterId), eq(hcentermodules.isEnabled, 1)));

    const enabledKeys = new Set(rows.map((r) => r.key));
    this.cache.set(hcenterId, { enabledKeys, expiresAt: now + this.TTL_MS });
    return enabledKeys;
  }

  async isEnabled(hcenterId: string, moduleKey: string): Promise<boolean> {
    const enabled = await this.listEnabled(hcenterId);
    return enabled.has(moduleKey);
  }

  /** Manually invalidate the cache for one clinic — call after writes. */
  invalidate(hcenterId: string): void {
    this.cache.delete(hcenterId);
  }

  /** Clear all cached entries. */
  invalidateAll(): void {
    this.cache.clear();
  }
}
