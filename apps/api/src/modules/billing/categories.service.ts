import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  transactioncategories,
  patientbillingrecords,
  hcenterfinancaltransactions,
} from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";
import { AuditService } from "../../common/audit/audit.service";
import type {
  CategoryListItem,
  CategoriesListResponse,
  CreateCategoryDto,
  UpdateCategoryDto,
  PriceTierLabels,
  UpdateTierLabelsDto,
} from "./dto/billing.dto";

@Injectable()
export class CategoriesService {
  constructor(
    private readonly tdb: TenantDbService,
    private readonly audit: AuditService,
  ) {}

  /**
   * List every category in the current clinic (including archived) plus the
   * clinic's price-tier labels in one round trip. Usage stats come from two
   * cheap aggregate queries so the admin can see what's actually being used.
   *
   * `IsArchived` was added in migration 0008 — if that hasn't been applied
   * yet the column won't exist and the IFNULL trick avoids breaking the list
   * endpoint for fresh dev databases. Bare column reference (no
   * table-qualifier) keeps the SQL portable across Drizzle's serializers.
   */
  async list(includeArchived = true): Promise<CategoriesListResponse> {
    const catRows = await this.tdb.db
      .select({
        transactionCategoryId: transactioncategories.transactionCategoryId,
        name: transactioncategories.transactionCategoryName,
        isIncome: transactioncategories.isIncome,
        isCheckup: transactioncategories.isCheckup,
        defaultPrice: transactioncategories.defaultPrice,
        price2: transactioncategories.price2,
        price3: transactioncategories.price3,
        isSystem: transactioncategories.isSystem,
      })
      .from(transactioncategories)
      .where(this.tdb.tenantClause(transactioncategories))
      .orderBy(asc(transactioncategories.transactionCategoryName));

    // Pull archived flags in a separate, optional query — if the column
    // doesn't exist (pre-migration), default everything to "not archived".
    const archivedSet = new Set<string>();
    try {
      const archRows = await this.tdb.db.execute<{ TransactionCategoryID: string }>(
        sql`SELECT TransactionCategoryID
            FROM transactioncategories
            WHERE HCenterID = ${this.tdb.tenantId}
              AND IsArchived = 1`,
      );
      // mysql2 driver returns [rows, fields]; Drizzle returns either rows
      // directly or [rows, fields]. Normalise to an array.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const arr: any[] = Array.isArray(archRows)
        ? Array.isArray(archRows[0])
          ? archRows[0]
          : archRows
        : [];
      for (const r of arr) {
        if (r?.TransactionCategoryID) archivedSet.add(r.TransactionCategoryID);
      }
    } catch {
      // Migration 0008 not yet applied — IsArchived column missing.
      // Fall through with an empty archivedSet so the list still renders.
    }

    // Usage stats — count patientbillingrecords + ledger transactions per
    // category, plus the most-recent reference date. Two grouped queries.
    const billUsage = await this.tdb.db
      .select({
        catId: patientbillingrecords.transactionCategoryId,
        n: sql<number>`COUNT(*)`.as("n"),
        lastAt: sql<string | null>`MAX(${patientbillingrecords.recordDate})`.as("lastAt"),
      })
      .from(patientbillingrecords)
      .innerJoin(
        transactioncategories,
        eq(
          transactioncategories.transactionCategoryId,
          patientbillingrecords.transactionCategoryId,
        ),
      )
      .where(this.tdb.tenantClause(transactioncategories))
      .groupBy(patientbillingrecords.transactionCategoryId);

    const txUsage = await this.tdb.db
      .select({
        catId: hcenterfinancaltransactions.transactionCategoryId,
        n: sql<number>`COUNT(*)`.as("n"),
        lastAt: sql<string | null>`MAX(${hcenterfinancaltransactions.addDate})`.as("lastAt"),
      })
      .from(hcenterfinancaltransactions)
      .where(this.tdb.tenantClause(hcenterfinancaltransactions))
      .groupBy(hcenterfinancaltransactions.transactionCategoryId);

    const usageMap = new Map<string, { count: number; lastAt: string | null }>();
    const addUsage = (
      rows: ReadonlyArray<{ catId: string | null; n: number; lastAt: string | null }>,
    ): void => {
      for (const r of rows) {
        if (!r.catId) continue;
        const cur = usageMap.get(r.catId) ?? { count: 0, lastAt: null };
        cur.count += Number(r.n);
        if (r.lastAt && (!cur.lastAt || r.lastAt > cur.lastAt)) cur.lastAt = r.lastAt;
        usageMap.set(r.catId, cur);
      }
    };
    addUsage(billUsage);
    addUsage(txUsage);

    const data: CategoryListItem[] = catRows
      .map((r) => {
        const usage = usageMap.get(r.transactionCategoryId) ?? { count: 0, lastAt: null };
        return {
          transactionCategoryId: r.transactionCategoryId,
          name: r.name,
          isIncome: r.isIncome === 1,
          isCheckup: r.isCheckup === 1,
          defaultPrice: r.defaultPrice,
          price2: r.price2 ?? null,
          price3: r.price3 ?? null,
          isSystem: r.isSystem === 1,
          isArchived: archivedSet.has(r.transactionCategoryId),
          usageCount: usage.count,
          lastUsedAt: usage.lastAt,
        };
      })
      .filter((c) => includeArchived || !c.isArchived);

    const tierLabels = await this.getTierLabels();
    return { data, tierLabels };
  }

  async create(dto: CreateCategoryDto): Promise<{ transactionCategoryId: string }> {
    const id = randomUUID();
    await this.tdb.db.insert(transactioncategories).values({
      transactionCategoryId: id,
      hcenterId: this.tdb.tenantId,
      transactionCategoryName: dto.name,
      isIncome: dto.isIncome !== false ? 1 : 0,
      isCheckup: dto.isCheckup ? 1 : 0,
      defaultPrice: dto.defaultPrice,
      price2: dto.price2 ?? null,
      price3: dto.price3 ?? null,
      isSystem: 0,
    });

    await this.audit.record({
      action: "Create",
      entityType: "TransactionCategory",
      entityId: id,
      patientContext: null,
      newValues: {
        name: dto.name,
        isIncome: dto.isIncome !== false,
        isCheckup: !!dto.isCheckup,
        defaultPrice: dto.defaultPrice,
        price2: dto.price2 ?? null,
        price3: dto.price3 ?? null,
      },
    });

    return { transactionCategoryId: id };
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<void> {
    const [current] = await this.tdb.db
      .select()
      .from(transactioncategories)
      .where(
        and(
          eq(transactioncategories.transactionCategoryId, id),
          this.tdb.tenantClause(transactioncategories),
        ),
      )
      .limit(1);

    if (!current) throw new NotFoundException(`Category ${id} not found`);
    // System categories: only allow the archived flag to flip (so admins can
    // hide built-ins they don't use) — name + price stays frozen.
    if (current.isSystem === 1) {
      const onlyArchive =
        dto.isArchived !== undefined &&
        dto.name === undefined &&
        dto.defaultPrice === undefined &&
        dto.price2 === undefined &&
        dto.price3 === undefined &&
        dto.isIncome === undefined &&
        dto.isCheckup === undefined;
      if (!onlyArchive) {
        throw new BadRequestException(
          "System categories cannot be edited except to archive/restore",
        );
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setFields: Record<string, any> = {};
    const newValues: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      setFields.transactionCategoryName = dto.name;
      newValues.name = dto.name;
    }
    if (dto.defaultPrice !== undefined) {
      setFields.defaultPrice = dto.defaultPrice;
      newValues.defaultPrice = dto.defaultPrice;
    }
    if (dto.price2 !== undefined) {
      setFields.price2 = dto.price2;
      newValues.price2 = dto.price2;
    }
    if (dto.price3 !== undefined) {
      setFields.price3 = dto.price3;
      newValues.price3 = dto.price3;
    }
    if (dto.isIncome !== undefined) {
      setFields.isIncome = dto.isIncome ? 1 : 0;
      newValues.isIncome = dto.isIncome;
    }
    if (dto.isCheckup !== undefined) {
      setFields.isCheckup = dto.isCheckup ? 1 : 0;
      newValues.isCheckup = dto.isCheckup;
    }

    if (Object.keys(setFields).length > 0) {
      const result = await this.tdb.db
        .update(transactioncategories)
        .set(setFields)
        .where(eq(transactioncategories.transactionCategoryId, id));

      const affected = (result as unknown as { affectedRows?: number }).affectedRows ?? null;
      if (affected !== null && affected !== 1) {
        throw new ConflictException(
          `Expected to update 1 category row, but ${affected} were affected`,
        );
      }
    }

    // isArchived lives in a column not yet in the introspected schema — write
    // it through raw SQL so we don't need to regenerate the types here.
    if (dto.isArchived !== undefined) {
      await this.tdb.db.execute(
        sql`UPDATE transactioncategories
            SET IsArchived = ${dto.isArchived ? 1 : 0}
            WHERE TransactionCategoryID = ${id}
              AND HCenterID = ${this.tdb.tenantId}`,
      );
      newValues.isArchived = dto.isArchived;
    }

    if (Object.keys(newValues).length === 0) return;

    await this.audit.record({
      action: "Update",
      entityType: "TransactionCategory",
      entityId: id,
      patientContext: null,
      newValues,
    });
  }

  /**
   * Smart delete:
   *  - If the category has zero references in patientbillingrecords AND
   *    hcenterfinancaltransactions, hard-delete the row.
   *  - Otherwise, soft-archive (set IsArchived = 1) and return that fact so
   *    the UI can confirm. Hard delete would otherwise FK-fail because both
   *    referrer tables use ON DELETE RESTRICT.
   *  - System categories can be archived but never hard-deleted.
   */
  async deleteOrArchive(
    id: string,
  ): Promise<{ deleted: boolean; archived: boolean; usageCount: number }> {
    const [current] = await this.tdb.db
      .select()
      .from(transactioncategories)
      .where(
        and(
          eq(transactioncategories.transactionCategoryId, id),
          this.tdb.tenantClause(transactioncategories),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundException(`Category ${id} not found`);

    const [billCount] = await this.tdb.db
      .select({ n: sql<number>`COUNT(*)`.as("n") })
      .from(patientbillingrecords)
      .where(eq(patientbillingrecords.transactionCategoryId, id));
    const [txCount] = await this.tdb.db
      .select({ n: sql<number>`COUNT(*)`.as("n") })
      .from(hcenterfinancaltransactions)
      .where(eq(hcenterfinancaltransactions.transactionCategoryId, id));

    const usageCount = Number(billCount?.n ?? 0) + Number(txCount?.n ?? 0);

    if (current.isSystem === 1 || usageCount > 0) {
      // Soft archive.
      await this.tdb.db.execute(
        sql`UPDATE transactioncategories
            SET IsArchived = 1
            WHERE TransactionCategoryID = ${id}
              AND HCenterID = ${this.tdb.tenantId}`,
      );
      await this.audit.record({
        action: "Update",
        entityType: "TransactionCategory",
        entityId: id,
        patientContext: null,
        newValues: { isArchived: true, reason: current.isSystem === 1 ? "system" : "in_use" },
      });
      return { deleted: false, archived: true, usageCount };
    }

    // Safe to hard delete.
    await this.tdb.db
      .delete(transactioncategories)
      .where(eq(transactioncategories.transactionCategoryId, id));
    await this.audit.record({
      action: "Delete",
      entityType: "TransactionCategory",
      entityId: id,
      patientContext: null,
      previousValues: {
        name: current.transactionCategoryName,
        defaultPrice: current.defaultPrice,
      },
    });
    return { deleted: true, archived: false, usageCount: 0 };
  }

  // ── Price-tier labels ───────────────────────────────────────────────────

  async getTierLabels(): Promise<PriceTierLabels> {
    // Pre-migration the Price2Label / Price3Label columns don't exist yet —
    // return empty labels rather than 500-ing the whole list endpoint.
    try {
      const rows = await this.tdb.db.execute<{
        Price2Label: string | null;
        Price3Label: string | null;
      }>(
        sql`SELECT Price2Label, Price3Label
            FROM hcentersystemsettings
            WHERE HCenterID = ${this.tdb.tenantId}
            LIMIT 1`,
      );
      // mysql2 returns [rows, fields]; Drizzle's .execute returns the rows
      // array directly OR a tuple depending on driver. Normalise.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const arr: any[] = Array.isArray(rows) ? (Array.isArray(rows[0]) ? rows[0] : rows) : [];
      const row = arr[0] ?? null;
      return {
        price2Label: row?.Price2Label ?? null,
        price3Label: row?.Price3Label ?? null,
      };
    } catch {
      return { price2Label: null, price3Label: null };
    }
  }

  async setTierLabels(dto: UpdateTierLabelsDto): Promise<PriceTierLabels> {
    // Coerce empty strings to NULL so the UI doesn't show stale label hints.
    const p2 = dto.price2Label?.trim() || null;
    const p3 = dto.price3Label?.trim() || null;
    await this.tdb.db.execute(
      sql`UPDATE hcentersystemsettings
          SET Price2Label = ${p2}, Price3Label = ${p3}
          WHERE HCenterID = ${this.tdb.tenantId}`,
    );
    await this.audit.record({
      action: "Update",
      entityType: "HCenterSystemSettings",
      entityId: this.tdb.tenantId,
      patientContext: null,
      newValues: { price2Label: p2, price3Label: p3 },
    });
    return this.getTierLabels();
  }
}
