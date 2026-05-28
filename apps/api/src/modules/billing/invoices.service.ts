import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, count, desc, eq, gte, inArray, lt, sql, sum } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  patientarabicinfo,
  patientbillingrecords,
  patientinvoices,
  patientvisits,
  patients,
  transactioncategories,
} from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";
import { TenantContextService } from "../../common/tenant/tenant-context";
import { AuditService } from "../../common/audit/audit.service";
import type {
  BillingInvoiceItem,
  BillingInvoiceListResponse,
  CreateInvoiceDto,
  InvoiceDetail,
  InvoiceListItem,
} from "./dto/billing.dto";

@Injectable()
export class InvoicesService {
  constructor(
    private readonly tdb: TenantDbService,
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  async listAll(opts: {
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }): Promise<BillingInvoiceListResponse> {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 25;
    const offset = (page - 1) * pageSize;

    const filters = [eq(patientinvoices.hcenterId, this.tdb.tenantId)];
    if (opts.from) filters.push(gte(patientinvoices.invoiceDate, opts.from));
    if (opts.to) filters.push(lt(patientinvoices.invoiceDate, opts.to));

    const [rows, [countRow], [sumRow]] = await Promise.all([
      this.tdb.db
        .select({
          patientInvoiceId: patientinvoices.patientInvoiceId,
          invoiceNumber: patientinvoices.invoiceNumber,
          invoiceDate: patientinvoices.invoiceDate,
          paidByPatient: patientinvoices.paidByPatient,
          finalBalance: patientinvoices.finalBalance,
          discount: patientinvoices.discount,
          coveredByHealthInsurance: patientinvoices.coveredByHealthInsurance,
          coveredByHospital: patientinvoices.coveredByHospital,
          patientId: patients.patientId,
          patientFirst: patients.firstName,
          patientSecond: patients.secondName,
          patientThird: patients.thirdName,
          patientLast: patients.lastName,
          patientNationalId: patients.nationalId,
          patientFirstAr: patientarabicinfo.firstNameAr,
          patientLastAr: patientarabicinfo.lastNameAr,
        })
        .from(patientinvoices)
        .innerJoin(patients, eq(patients.patientId, patientinvoices.patientId))
        .leftJoin(patientarabicinfo, eq(patientarabicinfo.patientId, patients.patientId))
        .where(and(...filters))
        .orderBy(desc(patientinvoices.invoiceDate))
        .limit(pageSize)
        .offset(offset),
      this.tdb.db
        .select({ n: count() })
        .from(patientinvoices)
        .where(and(...filters)),
      this.tdb.db
        .select({
          totalPaid: sum(patientinvoices.paidByPatient),
          totalBalance: sum(patientinvoices.finalBalance),
          totalDiscount: sum(patientinvoices.discount),
        })
        .from(patientinvoices)
        .where(and(...filters)),
    ]);

    const totalCount = countRow?.n ?? 0;
    const totalPaid = Number(sumRow?.totalPaid ?? 0);
    const totalBalance = Number(sumRow?.totalBalance ?? 0);
    const totalDiscount = Number(sumRow?.totalDiscount ?? 0);
    const totalInvoiced = totalPaid + totalBalance + totalDiscount;

    const data: BillingInvoiceItem[] = rows.map((r) => {
      const enName = [r.patientFirst, r.patientSecond, r.patientThird, r.patientLast]
        .filter((x): x is string => !!x && x.trim().length > 0)
        .join(" ");
      const arName = [r.patientFirstAr, r.patientLastAr]
        .filter((x): x is string => !!x && x.trim().length > 0)
        .join(" ");
      const totalCharged =
        r.paidByPatient +
        (r.coveredByHealthInsurance ?? 0) +
        (r.coveredByHospital ?? 0) +
        r.finalBalance +
        r.discount;
      return {
        patientInvoiceId: r.patientInvoiceId,
        invoiceNumber: r.invoiceNumber,
        invoiceDate: r.invoiceDate,
        patient: {
          patientId: r.patientId,
          fullName: enName || arName || r.patientNationalId,
          fullNameAr: arName || null,
          nationalId: r.patientNationalId,
        },
        totalCharged,
        paidByPatient: r.paidByPatient,
        discount: r.discount,
        coveredByHealthInsurance: r.coveredByHealthInsurance ?? null,
        coveredByHospital: r.coveredByHospital ?? null,
        finalBalance: r.finalBalance,
      };
    });

    return {
      data,
      total: totalCount,
      page,
      pageSize,
      summary: {
        totalInvoiced,
        totalCollected: totalPaid,
        totalOutstanding: totalBalance,
        count: totalCount,
      },
    };
  }

  async getDailyBilling(from: string, to: string): Promise<Array<{ date: string; invoiceCount: number; totalCharged: number; totalCollected: number; outstanding: number }>> {
    const rows = await this.tdb.db
      .select({
        date: sql<string>`DATE(${patientinvoices.invoiceDate})`,
        invoiceCount: count(),
        totalPaid:    sum(patientinvoices.paidByPatient),
        totalBalance: sum(patientinvoices.finalBalance),
        totalDiscount: sum(patientinvoices.discount),
      })
      .from(patientinvoices)
      .where(
        and(
          eq(patientinvoices.hcenterId, this.tdb.tenantId),
          gte(patientinvoices.invoiceDate, from),
          lt(patientinvoices.invoiceDate, to),
        ),
      )
      .groupBy(sql`DATE(${patientinvoices.invoiceDate})`)
      .orderBy(sql`DATE(${patientinvoices.invoiceDate})`);

    return rows.map((r) => {
      const paid = Number(r.totalPaid ?? 0);
      const balance = Number(r.totalBalance ?? 0);
      const discount = Number(r.totalDiscount ?? 0);
      return {
        date: r.date,
        invoiceCount: r.invoiceCount,
        totalCharged: paid + balance + discount,
        totalCollected: paid,
        outstanding: balance,
      };
    });
  }

  async listForPatient(patientId: string): Promise<InvoiceListItem[]> {
    await this.assertPatientInTenant(patientId);

    const rows = await this.tdb.db
      .select()
      .from(patientinvoices)
      .where(
        and(
          eq(patientinvoices.patientId, patientId),
          eq(patientinvoices.hcenterId, this.tdb.tenantId),
        ),
      )
      .orderBy(desc(patientinvoices.invoiceDate));

    return rows.map((r) => ({
      patientInvoiceId: r.patientInvoiceId,
      invoiceNumber: r.invoiceNumber,
      invoiceDate: r.invoiceDate,
      paidByPatient: r.paidByPatient,
      finalBalance: r.finalBalance,
      discount: r.discount,
      // Reconstruct total from stored payment breakdown
      totalCharged:
        r.paidByPatient +
        (r.coveredByHealthInsurance ?? 0) +
        (r.coveredByHospital ?? 0) +
        r.finalBalance +
        r.discount,
    }));
  }

  async getById(invoiceId: string): Promise<InvoiceDetail> {
    const [inv] = await this.tdb.db
      .select()
      .from(patientinvoices)
      .where(
        and(
          eq(patientinvoices.patientInvoiceId, invoiceId),
          eq(patientinvoices.hcenterId, this.tdb.tenantId),
        ),
      )
      .limit(1);
    if (!inv) throw new NotFoundException(`Invoice ${invoiceId} not found`);

    // Billing records are linked via ifNumber = invoiceNumber (set when locked)
    const records = await this.tdb.db
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
      .innerJoin(patientvisits, eq(patientvisits.patientVisitId, patientbillingrecords.patientVisitId))
      .where(
        and(
          eq(patientvisits.patientId, inv.patientId),
          eq(patientbillingrecords.ifNumber, inv.invoiceNumber),
        ),
      )
      .orderBy(asc(patientbillingrecords.recordDate));

    const totalCharged =
      inv.paidByPatient +
      (inv.coveredByHealthInsurance ?? 0) +
      (inv.coveredByHospital ?? 0) +
      inv.finalBalance +
      inv.discount;

    return {
      patientInvoiceId: inv.patientInvoiceId,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      paidByPatient: inv.paidByPatient,
      oldBalance: inv.oldBalance,
      finalBalance: inv.finalBalance,
      discount: inv.discount,
      totalCharged,
      coveredByHealthInsurance: inv.coveredByHealthInsurance ?? null,
      coveredByHospital: inv.coveredByHospital ?? null,
      patientInsuranceDetailId: inv.patientInsuranceDetailId ?? null,
      hospitalName: inv.hospitalName ?? null,
      records: records.map((r) => ({
        patientBillingRecordId: r.patientBillingRecordId,
        transactionCategoryId: r.transactionCategoryId,
        categoryName: r.categoryName,
        details: r.details,
        expense: r.expense,
        isLocked: r.isLocked === 1,
        recordDate: r.recordDate,
        doctorId: r.doctorId ?? null,
        ifNumber: r.ifNumber ?? null,
      })),
    };
  }

  async create(
    dto: CreateInvoiceDto,
  ): Promise<{ patientInvoiceId: string; invoiceNumber: string }> {
    await this.assertPatientInTenant(dto.patientId);

    if (dto.billingRecordIds.length === 0) {
      throw new BadRequestException("At least one billing record is required");
    }

    // Fetch and validate all requested billing records
    const rows = await this.tdb.db
      .select({
        rec: patientbillingrecords,
        patientId: patientvisits.patientId,
      })
      .from(patientbillingrecords)
      .innerJoin(
        patientvisits,
        eq(patientvisits.patientVisitId, patientbillingrecords.patientVisitId),
      )
      .where(inArray(patientbillingrecords.patientBillingRecordId, dto.billingRecordIds));

    if (rows.length !== dto.billingRecordIds.length) {
      throw new BadRequestException("One or more billing records not found");
    }

    const wrongPatient = rows.find((r) => r.patientId !== dto.patientId);
    if (wrongPatient) {
      throw new BadRequestException("All billing records must belong to the specified patient");
    }

    const alreadyLocked = rows.find((r) => r.rec.isLocked === 1);
    if (alreadyLocked) {
      throw new BadRequestException(
        `Billing record ${alreadyLocked.rec.patientBillingRecordId} is already invoiced`,
      );
    }

    // Sequential invoice number per tenant: INV-000001
    const [countRow] = await this.tdb.db
      .select({ n: count() })
      .from(patientinvoices)
      .where(eq(patientinvoices.hcenterId, this.tdb.tenantId));
    const seq = String((countRow?.n ?? 0) + 1).padStart(6, "0");
    const invoiceNumber = `INV-${seq}`;

    const totalCharged = rows.reduce((s, r) => s + r.rec.expense, 0);
    const discount = dto.discount ?? 0;
    const insur = dto.coveredByHealthInsurance ?? 0;
    const hosp = dto.coveredByHospital ?? 0;
    const finalBalance = Math.max(0, totalCharged - discount - insur - hosp - dto.paidByPatient);

    const id = randomUUID();
    const now = formatMysqlDateTime(new Date()) as string;

    await this.tdb.db.insert(patientinvoices).values({
      patientInvoiceId: id,
      patientId: dto.patientId,
      hcenterId: this.tdb.tenantId,
      addedByUserId: this.tenant.userId,
      invoiceNumber,
      invoiceDate: now,
      creationDate: now,
      paidByPatient: dto.paidByPatient,
      oldBalance: 0,
      finalBalance,
      discount,
      coveredByHealthInsurance: dto.coveredByHealthInsurance ?? null,
      coveredByHospital: dto.coveredByHospital ?? null,
      patientInsuranceDetailId: dto.patientInsuranceDetailId ?? null,
      hospitalName: dto.hospitalName ?? null,
      migrated: 0,
    });

    // Lock records and tag them with the invoice number for reverse lookup
    await this.tdb.db
      .update(patientbillingrecords)
      .set({ isLocked: 1, ifNumber: invoiceNumber })
      .where(inArray(patientbillingrecords.patientBillingRecordId, dto.billingRecordIds));

    await this.audit.record({
      action: "Create",
      entityType: "PatientInvoice",
      entityId: id,
      patientContext: dto.patientId,
      newValues: {
        invoiceNumber,
        totalCharged,
        paidByPatient: dto.paidByPatient,
        discount,
        finalBalance,
        recordCount: dto.billingRecordIds.length,
      },
    });

    return { patientInvoiceId: id, invoiceNumber };
  }

  private async assertPatientInTenant(patientId: string): Promise<void> {
    const [row] = await this.tdb.db
      .select({ id: patients.patientId })
      .from(patients)
      .where(
        and(
          eq(patients.patientId, patientId),
          eq(patients.isDeleted, 0),
          eq(patients.hcenterId, this.tdb.tenantId),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException(`Patient ${patientId} not found`);
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
