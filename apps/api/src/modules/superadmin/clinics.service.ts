import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, count, desc, eq, gte, like, lt, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  hcenters,
  hcenterspecialities,
  hcentersystemsettings,
  hcenterusers,
  patientinvoices,
  patients,
  patientvisits,
} from "../../db/schema";
import { DRIZZLE, type Db } from "../../db/tokens";
import { TenantContextService } from "../../common/tenant/tenant-context";
import { AuditService } from "../../common/audit/audit.service";
import type {
  ActivateClinicDto,
  ClinicDetail,
  ClinicListItem,
  ClinicListResponse,
  CreateClinicDto,
  ListClinicsQueryDto,
  SuperadminStats,
  UpdateClinicDto,
  UpdateClinicSettingsDto,
} from "./dto/superadmin.dto";

@Injectable()
export class ClinicsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  // ── Stats ─────────────────────────────────────────────────────────────────

  async getStats(): Promise<SuperadminStats> {
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    const startOfMonthStr = fmtDate(startOfMonth);

    const [
      [clinicTotal],
      [clinicActive],
      [userTotal],
      [userActive],
      [patientTotal],
      [visitTotal],
      [invoicedRow],
      patientsByClinic,
    ] = await Promise.all([
      this.db.select({ n: count() }).from(hcenters),
      this.db.select({ n: count() }).from(hcenters).where(eq(hcenters.isActive, 1)),
      this.db.select({ n: count() }).from(hcenterusers),
      this.db.select({ n: count() }).from(hcenterusers).where(eq(hcenterusers.isActive, 1)),
      this.db.select({ n: count() }).from(patients).where(eq(patients.isDeleted, 0)),
      this.db.select({ n: count() }).from(patientvisits).where(eq(patientvisits.isDeleted, 0)),
      this.db
        .select({
          total: sql<number>`COALESCE(SUM(${patientinvoices.paidByPatient} + ${patientinvoices.finalBalance}), 0)`,
        })
        .from(patientinvoices)
        .where(gte(patientinvoices.invoiceDate, startOfMonthStr)),
      this.db
        .select({
          clinicId: hcenters.hcenterId,
          clinicName: hcenters.hcenterName,
          patientCount: count(patients.patientId),
        })
        .from(hcenters)
        .leftJoin(patients, and(eq(patients.hcenterId, hcenters.hcenterId), eq(patients.isDeleted, 0)))
        .groupBy(hcenters.hcenterId)
        .orderBy(desc(count(patients.patientId)))
        .limit(10),
    ]);

    return {
      clinicCount: clinicTotal?.n ?? 0,
      activeClinicCount: clinicActive?.n ?? 0,
      totalUsers: userTotal?.n ?? 0,
      activeUsers: userActive?.n ?? 0,
      totalPatients: patientTotal?.n ?? 0,
      totalVisits: visitTotal?.n ?? 0,
      totalInvoicedThisMonth: Number(invoicedRow?.total ?? 0),
      clinicsByPatientCount: patientsByClinic.map((r) => ({
        clinicId: r.clinicId,
        clinicName: r.clinicName,
        patientCount: r.patientCount,
      })),
    };
  }

  // ── List clinics with aggregated counts ───────────────────────────────────

  async list(query: ListClinicsQueryDto): Promise<ClinicListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const offset = (page - 1) * pageSize;

    const filters = [];
    if (query.q) {
      const pat = `%${query.q.trim()}%`;
      filters.push(or(like(hcenters.hcenterName, pat), like(hcenters.hcenterNameRep, pat)));
    }
    if (query.active === "true") filters.push(eq(hcenters.isActive, 1));
    else if (query.active === "false") filters.push(eq(hcenters.isActive, 0));

    const where = filters.length > 0 ? and(...filters) : undefined;

    const [rows, [countRow]] = await Promise.all([
      this.db
        .select({
          hcenterId: hcenters.hcenterId,
          name: hcenters.hcenterName,
          nameRep: hcenters.hcenterNameRep,
          email: hcenters.email,
          phone: hcenters.phone,
          isActive: hcenters.isActive,
          subscriptionType: hcenters.subscriptionType,
          isOneDoctor: hcenters.isOneDoctor,
          countryId: hcenters.countryId,
          cityId: hcenters.cityId,
          supportStartDate: hcenters.supportStartDate,
          lastRenewalDate: hcenters.lastRenewalDate,
        })
        .from(hcenters)
        .where(where)
        .orderBy(asc(hcenters.hcenterName))
        .limit(pageSize)
        .offset(offset),
      this.db.select({ n: count() }).from(hcenters).where(where),
    ]);

    const ids = rows.map((r) => r.hcenterId);
    const counts = await this.aggregateCounts(ids);

    const data: ClinicListItem[] = rows.map((r) => ({
      hcenterId: r.hcenterId,
      name: r.name,
      nameRep: r.nameRep ?? null,
      email: r.email ?? null,
      phone: r.phone ?? null,
      isActive: r.isActive === 1,
      subscriptionType: r.subscriptionType,
      isOneDoctor: r.isOneDoctor === 1,
      countryId: r.countryId ?? null,
      cityId: r.cityId ?? null,
      supportStartDate: r.supportStartDate,
      lastRenewalDate: r.lastRenewalDate ?? null,
      userCount: counts.users[r.hcenterId] ?? 0,
      patientCount: counts.patients[r.hcenterId] ?? 0,
      specialtyCount: counts.specialties[r.hcenterId] ?? 0,
    }));

    return { data, total: countRow?.n ?? 0, page, pageSize };
  }

  private async aggregateCounts(clinicIds: string[]): Promise<{
    users: Record<string, number>;
    patients: Record<string, number>;
    specialties: Record<string, number>;
  }> {
    if (clinicIds.length === 0) return { users: {}, patients: {}, specialties: {} };

    const [users, patientsAgg, specialties] = await Promise.all([
      this.db
        .select({ hcenterId: hcenterusers.hcenterId, n: count() })
        .from(hcenterusers)
        .where(and(eq(hcenterusers.isActive, 1)))
        .groupBy(hcenterusers.hcenterId),
      this.db
        .select({ hcenterId: patients.hcenterId, n: count() })
        .from(patients)
        .where(eq(patients.isDeleted, 0))
        .groupBy(patients.hcenterId),
      this.db
        .select({ hcenterId: hcenterspecialities.hcenterId, n: count() })
        .from(hcenterspecialities)
        .groupBy(hcenterspecialities.hcenterId),
    ]);

    const mapOf = (rows: Array<{ hcenterId: string; n: number }>): Record<string, number> => {
      const m: Record<string, number> = {};
      for (const r of rows) m[r.hcenterId] = r.n;
      return m;
    };
    return { users: mapOf(users), patients: mapOf(patientsAgg), specialties: mapOf(specialties) };
  }

  // ── Single clinic detail ──────────────────────────────────────────────────

  async get(id: string): Promise<ClinicDetail> {
    const [row] = await this.db.select().from(hcenters).where(eq(hcenters.hcenterId, id)).limit(1);
    if (!row) throw new NotFoundException(`Clinic ${id} not found`);

    const counts = await this.aggregateCounts([id]);
    return {
      hcenterId: row.hcenterId,
      name: row.hcenterName,
      nameRep: row.hcenterNameRep ?? null,
      email: row.email ?? null,
      phone: row.phone ?? null,
      isActive: row.isActive === 1,
      subscriptionType: row.subscriptionType,
      isOneDoctor: row.isOneDoctor === 1,
      countryId: row.countryId ?? null,
      cityId: row.cityId ?? null,
      supportStartDate: row.supportStartDate,
      lastRenewalDate: row.lastRenewalDate ?? null,
      reportAddress: row.reportAddress ?? null,
      reportsWorkingTimes: row.reportsWorkingTimes ?? null,
      clinicManager: row.clinicManager ?? null,
      clinicManagerEmail: row.clinicManagerEmail ?? null,
      clinicManagerMob: row.clinicManagerMob ?? null,
      hcenterInitials: row.hcenterInitials ?? null,
      eClaimLinkId: row.eClaimLinkId ?? null,
      userCount: counts.users[id] ?? 0,
      patientCount: counts.patients[id] ?? 0,
      specialtyCount: counts.specialties[id] ?? 0,
    };
  }

  // ── Create / Update / Activate ────────────────────────────────────────────

  async create(dto: CreateClinicDto): Promise<{ hcenterId: string }> {
    if (!dto.countryId) {
      throw new BadRequestException("countryId is required");
    }
    const id = randomUUID();
    const now = fmtDate(new Date());

    await this.db.insert(hcenters).values({
      hcenterId: id,
      hcenterName: dto.name,
      hcenterNameRep: dto.nameRep?.trim() || null,
      email: dto.email?.trim() || null,
      phone: dto.phone?.trim() || null,
      isActive: 1,
      isOneDoctor: dto.isOneDoctor ? 1 : 0,
      subscriptionType: dto.subscriptionType ?? 1,
      countryId: dto.countryId,
      cityId: dto.cityId ?? null,
      supportStartDate: now,
      hcenterInitials: dto.hcenterInitials?.trim() || null,
      clinicManager: dto.clinicManager?.trim() || null,
      clinicManagerEmail: dto.clinicManagerEmail?.trim() || null,
      clinicManagerMob: dto.clinicManagerMob?.trim() || null,
    });

    // Auto-create empty hcentersystemsettings row so admin pages can edit it.
    await this.db.insert(hcentersystemsettings).values({
      hcenterId: id,
      isHeightWeightRequired: 0,
      isPatientAddressRequired: 0,
      isOrganizationOccupationRequired: 0,
      isGeneralAppearanceRequired: 0,
      isHumanRaceRequired: 0,
      isMaritalStatusRequired: 0,
      isPatientEnglishNameRequired: 0,
      isPatientArabicNameRequired: 0,
      isPatientChecklistRequired: 0,
      isPatientFamilyHistoryRequired: 0,
      isSystemsReviewRequired: 0,
      isSystemsPhysicalExamRequired: 0,
      areRoutinesPatternsRequired: 0,
      areHereditaryDiseasesRequired: 0,
      areAllergiesRequired: 0,
      areChronicDiseasesRequired: 0,
      defaultPayment: 1,
      preferredCurrency: "USD",
      canDoctorsEditPatientDemographicInformation: 1,
      onlyVisitDoctorCanEditVisitRecords: 0,
      preventEditingPatientVisitWhenStatusIsResolvedOrFailed: 0,
      onlyCenterAdminIsAllowedToDeleteAttachments: 0,
      numberOfOperationRooms: 0,
      useAdminInsuranceCompanies: 0,
      isLockedData: 0,
    });

    await this.audit.record({
      action: "Create",
      entityType: "HCenter",
      entityId: id,
      patientContext: null,
      newValues: { name: dto.name },
    });

    return { hcenterId: id };
  }

  async update(id: string, dto: UpdateClinicDto): Promise<void> {
    const [current] = await this.db.select().from(hcenters).where(eq(hcenters.hcenterId, id)).limit(1);
    if (!current) throw new NotFoundException(`Clinic ${id} not found`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setFields: Record<string, any> = {};
    if (dto.name !== undefined) setFields.hcenterName = dto.name;
    if (dto.nameRep !== undefined) setFields.hcenterNameRep = dto.nameRep?.trim() || null;
    if (dto.email !== undefined) setFields.email = dto.email?.trim() || null;
    if (dto.phone !== undefined) setFields.phone = dto.phone?.trim() || null;
    if (dto.isOneDoctor !== undefined) setFields.isOneDoctor = dto.isOneDoctor ? 1 : 0;
    if (dto.subscriptionType !== undefined) setFields.subscriptionType = dto.subscriptionType;
    if (dto.reportAddress !== undefined) setFields.reportAddress = dto.reportAddress?.trim() || null;
    if (dto.reportsWorkingTimes !== undefined) setFields.reportsWorkingTimes = dto.reportsWorkingTimes?.trim() || null;
    if (dto.hcenterInitials !== undefined) setFields.hcenterInitials = dto.hcenterInitials?.trim() || null;
    if (dto.clinicManager !== undefined) setFields.clinicManager = dto.clinicManager?.trim() || null;
    if (dto.clinicManagerEmail !== undefined) setFields.clinicManagerEmail = dto.clinicManagerEmail?.trim() || null;
    if (dto.clinicManagerMob !== undefined) setFields.clinicManagerMob = dto.clinicManagerMob?.trim() || null;

    if (Object.keys(setFields).length === 0) return;

    await this.db.update(hcenters).set(setFields).where(eq(hcenters.hcenterId, id));

    await this.audit.record({
      action: "Update",
      entityType: "HCenter",
      entityId: id,
      patientContext: null,
      newValues: setFields,
    });
  }

  async activate(id: string, dto: ActivateClinicDto): Promise<void> {
    const [current] = await this.db.select({ id: hcenters.hcenterId }).from(hcenters).where(eq(hcenters.hcenterId, id)).limit(1);
    if (!current) throw new NotFoundException(`Clinic ${id} not found`);

    await this.db
      .update(hcenters)
      .set({ isActive: dto.isActive ? 1 : 0 })
      .where(eq(hcenters.hcenterId, id));

    await this.audit.record({
      action: "Update",
      entityType: "HCenter",
      entityId: id,
      patientContext: null,
      newValues: { isActive: dto.isActive },
    });
  }

  // ── Settings (per clinic) ─────────────────────────────────────────────────

  async getSettings(id: string): Promise<Record<string, unknown>> {
    const [row] = await this.db
      .select()
      .from(hcentersystemsettings)
      .where(eq(hcentersystemsettings.hcenterId, id))
      .limit(1);
    if (!row) throw new NotFoundException(`Settings for clinic ${id} not found`);

    return {
      defaultPayment: row.defaultPayment,
      preferredCurrency: row.preferredCurrency ?? null,
      isHeightWeightRequired: row.isHeightWeightRequired === 1,
      areAllergiesRequired: row.areAllergiesRequired === 1,
      areChronicDiseasesRequired: row.areChronicDiseasesRequired === 1,
      isPatientArabicNameRequired: row.isPatientArabicNameRequired === 1,
      canDoctorsEditPatientDemographicInformation: row.canDoctorsEditPatientDemographicInformation === 1,
      onlyVisitDoctorCanEditVisitRecords: row.onlyVisitDoctorCanEditVisitRecords === 1,
      preventEditingPatientVisitWhenStatusIsResolvedOrFailed: row.preventEditingPatientVisitWhenStatusIsResolvedOrFailed === 1,
      onlyCenterAdminIsAllowedToDeleteAttachments: row.onlyCenterAdminIsAllowedToDeleteAttachments === 1,
      numberOfOperationRooms: row.numberOfOperationRooms,
    };
  }

  async updateSettings(id: string, dto: UpdateClinicSettingsDto): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setFields: Record<string, any> = {};
    if (dto.defaultPayment !== undefined) setFields.defaultPayment = dto.defaultPayment;
    if (dto.preferredCurrency !== undefined) setFields.preferredCurrency = dto.preferredCurrency?.trim() || null;
    if (dto.numberOfOperationRooms !== undefined) setFields.numberOfOperationRooms = dto.numberOfOperationRooms;
    if (dto.isHeightWeightRequired !== undefined) setFields.isHeightWeightRequired = dto.isHeightWeightRequired ? 1 : 0;
    if (dto.areAllergiesRequired !== undefined) setFields.areAllergiesRequired = dto.areAllergiesRequired ? 1 : 0;
    if (dto.areChronicDiseasesRequired !== undefined) setFields.areChronicDiseasesRequired = dto.areChronicDiseasesRequired ? 1 : 0;
    if (dto.isPatientArabicNameRequired !== undefined) setFields.isPatientArabicNameRequired = dto.isPatientArabicNameRequired ? 1 : 0;
    if (dto.canDoctorsEditPatientDemographicInformation !== undefined) setFields.canDoctorsEditPatientDemographicInformation = dto.canDoctorsEditPatientDemographicInformation ? 1 : 0;
    if (dto.onlyVisitDoctorCanEditVisitRecords !== undefined) setFields.onlyVisitDoctorCanEditVisitRecords = dto.onlyVisitDoctorCanEditVisitRecords ? 1 : 0;
    if (dto.preventEditingPatientVisitWhenStatusIsResolvedOrFailed !== undefined) setFields.preventEditingPatientVisitWhenStatusIsResolvedOrFailed = dto.preventEditingPatientVisitWhenStatusIsResolvedOrFailed ? 1 : 0;
    if (dto.onlyCenterAdminIsAllowedToDeleteAttachments !== undefined) setFields.onlyCenterAdminIsAllowedToDeleteAttachments = dto.onlyCenterAdminIsAllowedToDeleteAttachments ? 1 : 0;

    if (Object.keys(setFields).length === 0) return;

    await this.db
      .update(hcentersystemsettings)
      .set(setFields)
      .where(eq(hcentersystemsettings.hcenterId, id));

    await this.audit.record({
      action: "Update",
      entityType: "HCenterSettings",
      entityId: id,
      patientContext: null,
      newValues: setFields,
    });
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
