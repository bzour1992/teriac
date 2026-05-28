import { Injectable, NotFoundException } from "@nestjs/common";
import { and, count, desc, eq, gte, lt, sql, sum } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  hcenterfinancaltransactions,
  hcenterusers,
  patients,
  patientarabicinfo,
  transactioncategories,
  wallets,
} from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";
import { TenantContextService } from "../../common/tenant/tenant-context";
import { AuditService } from "../../common/audit/audit.service";
import type {
  CreateTransactionDto,
  DailyReport,
  DoctorRevenueItem,
  ListTransactionsQueryDto,
  PnlReport,
  TransactionItem,
  TransactionListResponse,
  UpdateTransactionDto,
} from "./dto/finance.dto";
import { TRANSACTION_TYPE_LABEL } from "./dto/finance.dto";

@Injectable()
export class TransactionsService {
  constructor(
    private readonly tdb: TenantDbService,
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListTransactionsQueryDto): Promise<TransactionListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const offset = (page - 1) * pageSize;

    const filters = [eq(hcenterfinancaltransactions.hcenterId, this.tdb.tenantId)];
    if (query.from) filters.push(gte(hcenterfinancaltransactions.addDate, query.from));
    if (query.to) filters.push(lt(hcenterfinancaltransactions.addDate, query.to));
    if (query.walletId) filters.push(eq(hcenterfinancaltransactions.walletId, query.walletId));
    if (query.type) filters.push(eq(hcenterfinancaltransactions.transactionType, query.type));

    const [rows, [countRow]] = await Promise.all([
      this.tdb.db
        .select({
          id: hcenterfinancaltransactions.hcenterFinancalTransactionId,
          addDate: hcenterfinancaltransactions.addDate,
          transactionType: hcenterfinancaltransactions.transactionType,
          details: hcenterfinancaltransactions.details,
          amount: hcenterfinancaltransactions.amount,
          discount: hcenterfinancaltransactions.discount,
          notes: hcenterfinancaltransactions.notes,
          ifNumber: hcenterfinancaltransactions.ifNumber,
          walletName: wallets.walletName,
          categoryName: transactioncategories.transactionCategoryName,
          patientFirst: patients.firstName,
          patientLast: patients.lastName,
          patientFirstAr: patientarabicinfo.firstNameAr,
          patientLastAr: patientarabicinfo.lastNameAr,
          patientNationalId: patients.nationalId,
          addedFirst: hcenterusers.firstName,
          addedLast: hcenterusers.lastName,
        })
        .from(hcenterfinancaltransactions)
        .leftJoin(wallets, eq(wallets.walletId, hcenterfinancaltransactions.walletId))
        .leftJoin(transactioncategories, eq(transactioncategories.transactionCategoryId, hcenterfinancaltransactions.transactionCategoryId))
        .leftJoin(patients, eq(patients.patientId, hcenterfinancaltransactions.patientId))
        .leftJoin(patientarabicinfo, eq(patientarabicinfo.patientId, hcenterfinancaltransactions.patientId))
        .leftJoin(hcenterusers, eq(hcenterusers.userId, hcenterfinancaltransactions.addUserId))
        .where(and(...filters))
        .orderBy(desc(hcenterfinancaltransactions.addDate))
        .limit(pageSize)
        .offset(offset),
      this.tdb.db
        .select({ n: count() })
        .from(hcenterfinancaltransactions)
        .where(and(...filters)),
    ]);

    const data: TransactionItem[] = rows.map((r) => {
      const enName = [r.patientFirst, r.patientLast].filter(Boolean).join(" ");
      const arName = [r.patientFirstAr, r.patientLastAr].filter(Boolean).join(" ");
      return {
        hcenterFinancalTransactionId: r.id,
        addDate: r.addDate,
        transactionType: r.transactionType,
        transactionTypeLabel: TRANSACTION_TYPE_LABEL[r.transactionType] ?? String(r.transactionType),
        details: r.details,
        amount: r.amount,
        discount: r.discount,
        notes: r.notes ?? null,
        ifNumber: r.ifNumber ?? null,
        walletName: r.walletName ?? null,
        categoryName: r.categoryName ?? null,
        patientName: enName || arName || (r.patientNationalId ?? null),
        addedByName: [r.addedFirst, r.addedLast].filter(Boolean).join(" ") || null,
      };
    });

    return { data, total: countRow?.n ?? 0, page, pageSize };
  }

  async getById(txId: string): Promise<TransactionItem> {
    const [r] = await this.tdb.db
      .select({
        id: hcenterfinancaltransactions.hcenterFinancalTransactionId,
        addDate: hcenterfinancaltransactions.addDate,
        transactionType: hcenterfinancaltransactions.transactionType,
        details: hcenterfinancaltransactions.details,
        amount: hcenterfinancaltransactions.amount,
        discount: hcenterfinancaltransactions.discount,
        notes: hcenterfinancaltransactions.notes,
        ifNumber: hcenterfinancaltransactions.ifNumber,
        walletName: wallets.walletName,
        categoryName: transactioncategories.transactionCategoryName,
        patientFirst: patients.firstName,
        patientLast: patients.lastName,
        addedFirst: hcenterusers.firstName,
        addedLast: hcenterusers.lastName,
      })
      .from(hcenterfinancaltransactions)
      .leftJoin(wallets, eq(wallets.walletId, hcenterfinancaltransactions.walletId))
      .leftJoin(transactioncategories, eq(transactioncategories.transactionCategoryId, hcenterfinancaltransactions.transactionCategoryId))
      .leftJoin(patients, eq(patients.patientId, hcenterfinancaltransactions.patientId))
      .leftJoin(hcenterusers, eq(hcenterusers.userId, hcenterfinancaltransactions.addUserId))
      .where(
        and(
          eq(hcenterfinancaltransactions.hcenterFinancalTransactionId, txId),
          eq(hcenterfinancaltransactions.hcenterId, this.tdb.tenantId),
        ),
      )
      .limit(1);
    if (!r) throw new NotFoundException(`Transaction ${txId} not found`);

    return {
      hcenterFinancalTransactionId: r.id,
      addDate: r.addDate,
      transactionType: r.transactionType,
      transactionTypeLabel: TRANSACTION_TYPE_LABEL[r.transactionType] ?? String(r.transactionType),
      details: r.details,
      amount: r.amount,
      discount: r.discount,
      notes: r.notes ?? null,
      ifNumber: r.ifNumber ?? null,
      walletName: r.walletName ?? null,
      categoryName: r.categoryName ?? null,
      patientName: [r.patientFirst, r.patientLast].filter(Boolean).join(" ") || null,
      addedByName: [r.addedFirst, r.addedLast].filter(Boolean).join(" ") || null,
    };
  }

  async create(dto: CreateTransactionDto): Promise<{ hcenterFinancalTransactionId: string }> {
    const id = randomUUID();
    const now = fmtDate(new Date());

    await this.tdb.db.insert(hcenterfinancaltransactions).values({
      hcenterFinancalTransactionId: id,
      hcenterId: this.tdb.tenantId,
      details: dto.details.trim(),
      amount: dto.amount,
      discount: dto.discount ?? 0,
      transactionType: dto.transactionType,
      notes: dto.notes?.trim() ?? null,
      ifNumber: dto.ifNumber?.trim() ?? null,
      addDate: now,
      addUserId: this.tenant.userId,
      walletId: dto.walletId ?? null,
      transactionCategoryId: dto.transactionCategoryId ?? null,
      patientId: dto.patientId ?? null,
      ownerUserId: dto.ownerUserId ?? null,
      employeeName: dto.employeeName?.trim() ?? null,
    });

    await this.audit.record({
      action: "Create",
      entityType: "FinanceTransaction",
      entityId: id,
      patientContext: dto.patientId ?? null,
      newValues: {
        type: dto.transactionType,
        amount: dto.amount,
        details: dto.details,
        walletId: dto.walletId,
      },
    });
    return { hcenterFinancalTransactionId: id };
  }

  async update(txId: string, dto: UpdateTransactionDto): Promise<void> {
    const [current] = await this.tdb.db
      .select()
      .from(hcenterfinancaltransactions)
      .where(
        and(
          eq(hcenterfinancaltransactions.hcenterFinancalTransactionId, txId),
          eq(hcenterfinancaltransactions.hcenterId, this.tdb.tenantId),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundException(`Transaction ${txId} not found`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setFields: Record<string, any> = { updateDate: fmtDate(new Date()), updateUserId: this.tenant.userId };
    if (dto.details !== undefined) setFields.details = dto.details.trim();
    if (dto.amount !== undefined) setFields.amount = dto.amount;
    if (dto.notes !== undefined) setFields.notes = dto.notes?.trim() ?? null;
    if (dto.ifNumber !== undefined) setFields.ifNumber = dto.ifNumber?.trim() ?? null;

    await this.tdb.db
      .update(hcenterfinancaltransactions)
      .set(setFields)
      .where(eq(hcenterfinancaltransactions.hcenterFinancalTransactionId, txId));
  }

  // ── Reports ───────────────────────────────────────────────────────────────

  async getPnl(from: string, to: string): Promise<PnlReport> {
    const filters = [
      eq(hcenterfinancaltransactions.hcenterId, this.tdb.tenantId),
      gte(hcenterfinancaltransactions.addDate, from),
      lt(hcenterfinancaltransactions.addDate, to),
    ];

    const [row] = await this.tdb.db
      .select({
        income:      sql<number>`COALESCE(SUM(CASE WHEN ${hcenterfinancaltransactions.transactionType}=1 THEN ${hcenterfinancaltransactions.amount} ELSE 0 END),0)`,
        expenses:    sql<number>`COALESCE(SUM(CASE WHEN ${hcenterfinancaltransactions.transactionType}=2 THEN ${hcenterfinancaltransactions.amount} ELSE 0 END),0)`,
        refunds:     sql<number>`COALESCE(SUM(CASE WHEN ${hcenterfinancaltransactions.transactionType}=3 THEN ${hcenterfinancaltransactions.amount} ELSE 0 END),0)`,
        salary:      sql<number>`COALESCE(SUM(CASE WHEN ${hcenterfinancaltransactions.transactionType}=5 THEN ${hcenterfinancaltransactions.amount} ELSE 0 END),0)`,
        adjustments: sql<number>`COALESCE(SUM(CASE WHEN ${hcenterfinancaltransactions.transactionType}=6 THEN ${hcenterfinancaltransactions.amount} ELSE 0 END),0)`,
        total:       count(),
      })
      .from(hcenterfinancaltransactions)
      .where(and(...filters));

    const income = Number(row?.income ?? 0);
    const expenses = Number(row?.expenses ?? 0);
    const refunds = Number(row?.refunds ?? 0);
    const salary = Number(row?.salary ?? 0);
    const adjustments = Number(row?.adjustments ?? 0);

    return {
      from,
      to,
      totalIncome: income,
      totalExpenses: expenses,
      totalRefunds: refunds,
      totalSalary: salary,
      totalAdjustments: adjustments,
      netProfit: income - expenses - refunds - salary,
      transactionCount: row?.total ?? 0,
    };
  }

  async getDaily(from: string, to: string): Promise<DailyReport[]> {
    const rows = await this.tdb.db
      .select({
        date: sql<string>`DATE(${hcenterfinancaltransactions.addDate})`,
        income:   sql<number>`COALESCE(SUM(CASE WHEN ${hcenterfinancaltransactions.transactionType}=1 THEN ${hcenterfinancaltransactions.amount} ELSE 0 END),0)`,
        expenses: sql<number>`COALESCE(SUM(CASE WHEN ${hcenterfinancaltransactions.transactionType}=2 THEN ${hcenterfinancaltransactions.amount} ELSE 0 END),0)`,
        refunds:  sql<number>`COALESCE(SUM(CASE WHEN ${hcenterfinancaltransactions.transactionType}=3 THEN ${hcenterfinancaltransactions.amount} ELSE 0 END),0)`,
        txCount:  count(),
      })
      .from(hcenterfinancaltransactions)
      .where(
        and(
          eq(hcenterfinancaltransactions.hcenterId, this.tdb.tenantId),
          gte(hcenterfinancaltransactions.addDate, from),
          lt(hcenterfinancaltransactions.addDate, to),
          sql`${hcenterfinancaltransactions.transactionType} != 4`, // exclude transfers
        ),
      )
      .groupBy(sql`DATE(${hcenterfinancaltransactions.addDate})`)
      .orderBy(sql`DATE(${hcenterfinancaltransactions.addDate})`);

    return rows.map((r) => ({
      date: r.date,
      income: Number(r.income),
      expenses: Number(r.expenses),
      refunds: Number(r.refunds),
      net: Number(r.income) - Number(r.expenses) - Number(r.refunds),
      count: r.txCount,
    }));
  }

  async getByDoctor(from: string, to: string): Promise<DoctorRevenueItem[]> {
    const filters = [
      eq(hcenterfinancaltransactions.hcenterId, this.tdb.tenantId),
      eq(hcenterfinancaltransactions.transactionType, 1), // Income only
      gte(hcenterfinancaltransactions.addDate, from),
      lt(hcenterfinancaltransactions.addDate, to),
    ];

    const rows = await this.tdb.db
      .select({
        userId: hcenterusers.userId,
        firstName: hcenterusers.firstName,
        lastName: hcenterusers.lastName,
        totalRevenue: sum(hcenterfinancaltransactions.amount),
        txCount: count(),
      })
      .from(hcenterfinancaltransactions)
      .innerJoin(hcenterusers, eq(hcenterusers.userId, hcenterfinancaltransactions.ownerUserId))
      .where(and(...filters))
      .groupBy(hcenterusers.userId);

    return rows.map((r) => ({
      doctorId: r.userId,
      doctorName: [r.firstName, r.lastName].filter(Boolean).join(" ") || "—",
      totalRevenue: Number(r.totalRevenue ?? 0),
      transactionCount: r.txCount,
    }));
  }
}

// MariaDB datetime(3) requires 'YYYY-MM-DD HH:MM:SS.fff' — ISO 8601 with T/Z breaks the insert.
function fmtDate(v: Date): string {
  const yyyy = v.getUTCFullYear();
  const mm   = String(v.getUTCMonth() + 1).padStart(2, "0");
  const dd   = String(v.getUTCDate()).padStart(2, "0");
  const HH   = String(v.getUTCHours()).padStart(2, "0");
  const MM   = String(v.getUTCMinutes()).padStart(2, "0");
  const SS   = String(v.getUTCSeconds()).padStart(2, "0");
  const ms   = String(v.getUTCMilliseconds()).padStart(3, "0");
  return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}.${ms}`;
}
