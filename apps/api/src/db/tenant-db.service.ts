import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { and, eq, type SQL } from "drizzle-orm";
import type { MySqlTable } from "drizzle-orm/mysql-core";
import { DRIZZLE, type Db } from "./tokens";
import { TenantContextService } from "../common/tenant/tenant-context";

/**
 * Tenant-safe Drizzle wrapper.
 *
 * Implements lines 3+4 of CLAUDE.md's "4 lines of defense" for tenant isolation:
 *   - `tenantClause(table)`  — produces a WHERE HCenterID = :tenant predicate
 *                              that callers compose into their queries
 *   - `assertSameTenant(rows)` — sanity check used by repositories that handle
 *                                bulk write paths (would catch a cross-tenant
 *                                row sneaking in before SaveChanges-equivalent)
 *
 * Repositories ALWAYS go through this service for tenant-scoped tables.
 * The raw `db` getter is available for tenant-agnostic reads only
 * (reference data: ICD codes, CPT, medicines, etc.).
 */
@Injectable()
export class TenantDbService {
  constructor(
    @Inject(DRIZZLE) public readonly db: Db,
    private readonly tenant: TenantContextService,
  ) {}

  /** The current tenant's HCenterID. Throws if accessed outside a request. */
  get tenantId(): string {
    return this.tenant.hcenterId;
  }

  /**
   * Produce a SQL predicate scoping the query to the current tenant. Compose
   * with `and(...)` alongside your own predicates.
   *
   *   const rows = await tdb.db.select()
   *     .from(patients)
   *     .where(tdb.tenantClause(patients, "hcenterId"));
   */
  tenantClause<T extends MySqlTable>(
    table: T,
    column: keyof T = "hcenterId" as keyof T,
  ): SQL {
    const col = table[column];
    if (!col) {
      throw new Error(
        `Table ${(table as { _: { name: string } })._.name} has no column "${String(column)}" — cannot scope by tenant`,
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return eq(col as any, this.tenantId);
  }

  /**
   * Combine a tenant clause with caller-supplied predicates.
   *
   *   const where = tdb.scoped(patients, eq(patients.patientId, id));
   */
  scoped<T extends MySqlTable>(table: T, ...extra: (SQL | undefined)[]): SQL {
    const clauses = [this.tenantClause(table), ...extra].filter(
      (x): x is SQL => x !== undefined,
    );
    return and(...clauses) as SQL;
  }

  /**
   * Sanity check before persisting writes. Pass the rows about to be inserted/
   * updated — throws ForbiddenException if any row carries a different
   * HCenterID than the request's tenant.
   */
  assertSameTenant(rows: ReadonlyArray<{ hcenterId?: string | null }>): void {
    const expected = this.tenantId;
    for (const row of rows) {
      if (row.hcenterId !== undefined && row.hcenterId !== null && row.hcenterId !== expected) {
        throw new ForbiddenException(
          `Tenant mismatch: row HCenterID=${row.hcenterId} does not match request tenant=${expected}`,
        );
      }
    }
  }
}
