import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, gte, inArray, like, lte, sql } from "drizzle-orm";
import { auditLog, hcenterusers, patients } from "../../db/schema";
import { DRIZZLE, type Db } from "../../db/tokens";
import { TenantContextService } from "../../common/tenant/tenant-context";
import type {
  AuditEventDetailDto,
  AuditEventDto,
  AuditListResponse,
  AuditSummaryResponse,
  FacetBucket,
  ListAuditDto,
} from "./dto/audit.dto";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const DEFAULT_LOOKBACK_DAYS = 7;

@Injectable()
export class AuditReadService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly tenant: TenantContextService,
  ) {}

  /** Build a WHERE expression from the filter DTO (always scoped to current hcenter). */
  private buildWhere(q: ListAuditDto) {
    const hcenterId = this.tenant.hcenterId;
    const from = q.from ?? defaultFrom();
    const to = q.to ?? defaultTo();

    const exprs = [
      eq(auditLog.hcenterId, hcenterId),
      gte(auditLog.eventTime, from),
      lte(auditLog.eventTime, to),
    ];

    const actions = csvList(q.action);
    if (actions.length > 0) exprs.push(inArray(auditLog.action, actions));

    const entityTypes = csvList(q.entityType);
    if (entityTypes.length > 0) exprs.push(inArray(auditLog.entityType, entityTypes));

    if (q.userId) exprs.push(eq(auditLog.userId, q.userId));
    if (q.patientId) exprs.push(eq(auditLog.patientContext, q.patientId));
    if (q.outcome) exprs.push(eq(auditLog.outcome, q.outcome));
    if (q.correlationId) exprs.push(eq(auditLog.correlationId, q.correlationId));
    if (q.q) exprs.push(like(auditLog.entityId, `%${q.q}%`));

    return and(...exprs);
  }

  async list(q: ListAuditDto): Promise<AuditListResponse> {
    const page = q.page ?? 1;
    const pageSize = Math.min(q.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = (page - 1) * pageSize;
    const where = this.buildWhere(q);

    // Page of rows + total in parallel with the facets.
    const [rows, totalRow, actionFacet, entityFacet, userFacet, outcomeFacet] =
      await Promise.all([
        this.db
          .select({
            auditId: auditLog.auditId,
            eventTime: auditLog.eventTime,
            userId: auditLog.userId,
            userName: hcenterusers.userName,
            firstName: hcenterusers.firstName,
            lastName: hcenterusers.lastName,
            ipAddress: auditLog.ipAddress,
            userAgent: auditLog.userAgent,
            action: auditLog.action,
            entityType: auditLog.entityType,
            entityId: auditLog.entityId,
            patientContext: auditLog.patientContext,
            patientFirst: patients.firstName,
            patientLast: patients.lastName,
            outcome: auditLog.outcome,
            errorMessage: auditLog.errorMessage,
            correlationId: auditLog.correlationId,
          })
          .from(auditLog)
          .leftJoin(hcenterusers, eq(hcenterusers.userId, auditLog.userId))
          .leftJoin(patients, eq(patients.patientId, auditLog.patientContext))
          .where(where)
          .orderBy(desc(auditLog.eventTime))
          .limit(pageSize)
          .offset(offset),
        this.db
          .select({ n: count() })
          .from(auditLog)
          .where(where),
        // Facets — group by single column across the same WHERE.
        this.db
          .select({ value: auditLog.action, n: count() })
          .from(auditLog)
          .where(where)
          .groupBy(auditLog.action),
        this.db
          .select({ value: auditLog.entityType, n: count() })
          .from(auditLog)
          .where(where)
          .groupBy(auditLog.entityType),
        this.db
          .select({
            value: auditLog.userId,
            userName: hcenterusers.userName,
            firstName: hcenterusers.firstName,
            lastName: hcenterusers.lastName,
            n: count(),
          })
          .from(auditLog)
          .leftJoin(hcenterusers, eq(hcenterusers.userId, auditLog.userId))
          .where(where)
          .groupBy(auditLog.userId, hcenterusers.userName, hcenterusers.firstName, hcenterusers.lastName)
          .orderBy(desc(count()))
          .limit(20),
        this.db
          .select({ value: auditLog.outcome, n: count() })
          .from(auditLog)
          .where(where)
          .groupBy(auditLog.outcome),
      ]);

    const data: AuditEventDto[] = rows.map((r) => ({
      auditId: r.auditId as number,
      eventTime: r.eventTime,
      user: {
        userId: r.userId,
        userName: r.userName ?? null,
        fullName: joinName(r.firstName, r.lastName),
      },
      ipAddress: r.ipAddress,
      userAgent: r.userAgent ?? null,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId ?? null,
      patient: r.patientContext
        ? {
            patientId: r.patientContext,
            fullName: joinName(r.patientFirst, r.patientLast),
          }
        : null,
      outcome: r.outcome,
      errorMessage: r.errorMessage ?? null,
      correlationId: r.correlationId,
    }));

    return {
      data,
      total: Number(totalRow[0]?.n ?? 0),
      page,
      pageSize,
      facets: {
        actions: actionFacet.map((f) => bucket(f.value, f.value, f.n)),
        entityTypes: entityFacet.map((f) => bucket(f.value, f.value, f.n)),
        users: userFacet.map((f) =>
          bucket(
            f.value,
            joinName(f.firstName, f.lastName) || f.userName || f.value,
            f.n,
          ),
        ),
        outcomes: outcomeFacet.map((f) => bucket(f.value, f.value, f.n)),
      },
    };
  }

  async getOne(auditId: number): Promise<AuditEventDetailDto | null> {
    const hcenterId = this.tenant.hcenterId;
    const rows = await this.db
      .select({
        auditId: auditLog.auditId,
        eventTime: auditLog.eventTime,
        userId: auditLog.userId,
        userName: hcenterusers.userName,
        firstName: hcenterusers.firstName,
        lastName: hcenterusers.lastName,
        ipAddress: auditLog.ipAddress,
        userAgent: auditLog.userAgent,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        patientContext: auditLog.patientContext,
        patientFirst: patients.firstName,
        patientLast: patients.lastName,
        outcome: auditLog.outcome,
        errorMessage: auditLog.errorMessage,
        correlationId: auditLog.correlationId,
        changedFields: auditLog.changedFields,
        previousValues: auditLog.previousValues,
        newValues: auditLog.newValues,
      })
      .from(auditLog)
      .leftJoin(hcenterusers, eq(hcenterusers.userId, auditLog.userId))
      .leftJoin(patients, eq(patients.patientId, auditLog.patientContext))
      .where(and(eq(auditLog.auditId, auditId), eq(auditLog.hcenterId, hcenterId)))
      .limit(1);

    const r = rows[0];
    if (!r) return null;

    return {
      auditId: r.auditId as number,
      eventTime: r.eventTime,
      user: {
        userId: r.userId,
        userName: r.userName ?? null,
        fullName: joinName(r.firstName, r.lastName),
      },
      ipAddress: r.ipAddress,
      userAgent: r.userAgent ?? null,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId ?? null,
      patient: r.patientContext
        ? {
            patientId: r.patientContext,
            fullName: joinName(r.patientFirst, r.patientLast),
          }
        : null,
      outcome: r.outcome,
      errorMessage: r.errorMessage ?? null,
      correlationId: r.correlationId,
      changedFields: tryParseStringArray(r.changedFields),
      previousValues: tryParseObject(r.previousValues),
      newValues: tryParseObject(r.newValues),
    };
  }

  async summary(from?: string, to?: string): Promise<AuditSummaryResponse> {
    const hcenterId = this.tenant.hcenterId;
    const fromISO = from ?? defaultFrom();
    const toISO = to ?? defaultTo();

    const baseWhere = and(
      eq(auditLog.hcenterId, hcenterId),
      gte(auditLog.eventTime, fromISO),
      lte(auditLog.eventTime, toISO),
    );

    const [byDay, totalRow, failedRow, topActionRow, topUserRow] = await Promise.all([
      this.db
        .select({
          date: sql<string>`DATE(${auditLog.eventTime})`.as("date"),
          total: count(),
          failed: sql<number>`SUM(CASE WHEN ${auditLog.outcome} IN ('denied','error') THEN 1 ELSE 0 END)`.as("failed"),
        })
        .from(auditLog)
        .where(baseWhere)
        .groupBy(sql`DATE(${auditLog.eventTime})`)
        .orderBy(sql`DATE(${auditLog.eventTime})`),
      this.db.select({ n: count() }).from(auditLog).where(baseWhere),
      this.db
        .select({ n: count() })
        .from(auditLog)
        .where(and(baseWhere, inArray(auditLog.outcome, ["denied", "error"]))),
      this.db
        .select({ value: auditLog.action, n: count() })
        .from(auditLog)
        .where(baseWhere)
        .groupBy(auditLog.action)
        .orderBy(desc(count()))
        .limit(1),
      this.db
        .select({
          userId: auditLog.userId,
          userName: hcenterusers.userName,
          firstName: hcenterusers.firstName,
          lastName: hcenterusers.lastName,
          n: count(),
        })
        .from(auditLog)
        .leftJoin(hcenterusers, eq(hcenterusers.userId, auditLog.userId))
        .where(baseWhere)
        .groupBy(auditLog.userId, hcenterusers.userName, hcenterusers.firstName, hcenterusers.lastName)
        .orderBy(desc(count()))
        .limit(1),
    ]);

    // Fill in zero days so the sparkline has a contiguous series.
    const days = enumerateDays(fromISO.slice(0, 10), toISO.slice(0, 10));
    const map = new Map(byDay.map((r) => [r.date, { total: Number(r.total), failed: Number(r.failed) }]));
    const fullByDay = days.map((d) => ({
      date: d,
      total: map.get(d)?.total ?? 0,
      failed: map.get(d)?.failed ?? 0,
    }));

    return {
      days,
      byDay: fullByDay,
      totals: {
        total: Number(totalRow[0]?.n ?? 0),
        failed: Number(failedRow[0]?.n ?? 0),
      },
      topAction: topActionRow[0]
        ? { action: topActionRow[0].value, count: Number(topActionRow[0].n) }
        : null,
      topUser: topUserRow[0]
        ? {
            userId: topUserRow[0].userId,
            userName: topUserRow[0].userName ?? null,
            fullName: joinName(topUserRow[0].firstName, topUserRow[0].lastName),
            count: Number(topUserRow[0].n),
          }
        : null,
    };
  }

  /** CSV stream — same filters as list(), capped at MAX_EXPORT rows. */
  async *exportRows(q: ListAuditDto): AsyncGenerator<string> {
    const MAX_EXPORT = 10_000;
    const where = this.buildWhere(q);
    const rows = await this.db
      .select({
        auditId: auditLog.auditId,
        eventTime: auditLog.eventTime,
        userId: auditLog.userId,
        userName: hcenterusers.userName,
        firstName: hcenterusers.firstName,
        lastName: hcenterusers.lastName,
        ipAddress: auditLog.ipAddress,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        patientContext: auditLog.patientContext,
        outcome: auditLog.outcome,
        errorMessage: auditLog.errorMessage,
        correlationId: auditLog.correlationId,
      })
      .from(auditLog)
      .leftJoin(hcenterusers, eq(hcenterusers.userId, auditLog.userId))
      .where(where)
      .orderBy(desc(auditLog.eventTime))
      .limit(MAX_EXPORT);

    yield "auditId,eventTime,userId,userName,fullName,ipAddress,action,entityType,entityId,patientContext,outcome,errorMessage,correlationId\n";
    for (const r of rows) {
      yield [
        r.auditId,
        r.eventTime,
        r.userId,
        r.userName ?? "",
        joinName(r.firstName, r.lastName),
        r.ipAddress,
        r.action,
        r.entityType,
        r.entityId ?? "",
        r.patientContext ?? "",
        r.outcome,
        r.errorMessage ?? "",
        r.correlationId,
      ]
        .map(csvEscape)
        .join(",") + "\n";
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function joinName(first: string | null, last: string | null): string | null {
  const f = (first ?? "").trim();
  const l = (last ?? "").trim();
  const full = [f, l].filter(Boolean).join(" ");
  return full || null;
}

function csvList(s?: string): string[] {
  if (!s) return [];
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

function bucket(value: string, label: string, n: number): FacetBucket {
  return { value, label, count: Number(n) };
}

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - DEFAULT_LOOKBACK_DAYS);
  return d.toISOString().slice(0, 10) + " 00:00:00.000000";
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ") + ".999999";
}

function enumerateDays(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function tryParseStringArray(s: string | null): string[] | null {
  if (!s) return null;
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : null;
  } catch {
    return null;
  }
}

function tryParseObject(s: string | null): Record<string, unknown> | null {
  if (!s) return null;
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
