import { Inject, Injectable, BadRequestException } from "@nestjs/common";
import { and, count, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
import { auditLog } from "../../db/schema";
import { DRIZZLE, type Db } from "../../db/tokens";

export interface ClinicAuditSummary {
  clinicId: string;
  total: number;
  failed: number;
  oldestEvent: string | null;
  newestEvent: string | null;
  last30Days: number;
  last60Days: number;
  last90Days: number;
  byAction: Array<{ action: string; count: number }>;
}

@Injectable()
export class SuperadminAuditService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async summary(clinicId: string): Promise<ClinicAuditSummary> {
    const where = eq(auditLog.hcenterId, clinicId);
    const now = new Date();
    const cutoff = (days: number): string => {
      const d = new Date(now);
      d.setDate(d.getDate() - days);
      return d.toISOString().slice(0, 19).replace("T", " ") + ".000000";
    };
    const c30 = cutoff(30);
    const c60 = cutoff(60);
    const c90 = cutoff(90);

    const [
      totalRow,
      failedRow,
      rangeRow,
      last30Row,
      last60Row,
      last90Row,
      byAction,
    ] = await Promise.all([
      this.db.select({ n: count() }).from(auditLog).where(where),
      this.db
        .select({ n: count() })
        .from(auditLog)
        .where(and(where, sql`${auditLog.outcome} IN ('denied','error')`)),
      this.db
        .select({
          oldest: sql<string | null>`MIN(${auditLog.eventTime})`,
          newest: sql<string | null>`MAX(${auditLog.eventTime})`,
        })
        .from(auditLog)
        .where(where),
      this.db
        .select({ n: count() })
        .from(auditLog)
        .where(and(where, gte(auditLog.eventTime, c30))),
      this.db
        .select({ n: count() })
        .from(auditLog)
        .where(and(where, gte(auditLog.eventTime, c60))),
      this.db
        .select({ n: count() })
        .from(auditLog)
        .where(and(where, gte(auditLog.eventTime, c90))),
      this.db
        .select({ action: auditLog.action, n: count() })
        .from(auditLog)
        .where(where)
        .groupBy(auditLog.action)
        .orderBy(desc(count())),
    ]);

    return {
      clinicId,
      total: Number(totalRow[0]?.n ?? 0),
      failed: Number(failedRow[0]?.n ?? 0),
      oldestEvent: rangeRow[0]?.oldest ?? null,
      newestEvent: rangeRow[0]?.newest ?? null,
      last30Days: Number(last30Row[0]?.n ?? 0),
      last60Days: Number(last60Row[0]?.n ?? 0),
      last90Days: Number(last90Row[0]?.n ?? 0),
      byAction: byAction.map((r) => ({ action: r.action, count: Number(r.n) })),
    };
  }

  /**
   * Permanently delete audit_log rows for `clinicId` whose `EventTime` is
   * strictly older than `olderThanMonths` calendar months. Returns the row
   * count.
   *
   * This is destructive. Caller (SuperadminController) should have already
   * required SuperAdminGuard and a confirmation flow in the UI.
   */
  async purgeOlderThan(
    clinicId: string,
    olderThanMonths: 1 | 2 | 3,
  ): Promise<{ deleted: number; cutoff: string }> {
    if (![1, 2, 3].includes(olderThanMonths)) {
      throw new BadRequestException("olderThanMonths must be 1, 2 or 3");
    }
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - olderThanMonths);
    const cutoff = cutoffDate.toISOString().slice(0, 19).replace("T", " ") + ".000000";

    const result = await this.db
      .delete(auditLog)
      .where(and(eq(auditLog.hcenterId, clinicId), lt(auditLog.eventTime, cutoff)));

    // drizzle's MySQL driver returns [ResultSetHeader, ...] — best-effort row count.
    const affected =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as any)?.[0]?.affectedRows ?? (result as any)?.affectedRows ?? 0;
    return { deleted: Number(affected), cutoff };
  }
}
