import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, lt } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  patientvisits,
  patients,
  patientarabicinfo,
  hcenterusers,
  hcenterspecialities,
  specialities,
  pvassessmentconditions,
  pvplanmedications,
  pvpmhconditions,
  pvpmhmedications,
  medicalconditions,
  medicines,
  aftervisitrecommendations,
} from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";
import { AuditService } from "../../common/audit/audit.service";
import type { VisitDetail } from "./dto/visit-detail.dto";
import type { UpdateVisitDto } from "./dto/update-visit.dto";
import type { CreateVisitDto } from "./dto/create-visit.dto";
import type {
  ListVisitsQueryDto,
  VisitListItem,
  VisitListResponse,
  VisitStats,
} from "./dto/list-visits.dto";
import { TenantContextService } from "../../common/tenant/tenant-context";

// Map from DTO field name → (DB column key, terminal vs non-terminal).
// The DTO uses clean names; the DB column for VisitType is the typo'd
// `intesity` for intensity and `sourceOfRefferral` etc — listed below.
const FIELD_MAP: Record<
  keyof UpdateVisitDto,
  { col: string; type: "string-or-null" | "int" | "bool"; mustNonNull?: boolean }
> = {
  chiefComplaint: { col: "chiefComplaint", type: "string-or-null" },
  historyOfPresentIllness: { col: "historyOfPresentIllness", type: "string-or-null" },
  pastMedicalHistory: { col: "pastMedicalHistory", type: "string-or-null" },
  notes: { col: "notes", type: "string-or-null" },
  recommendations: { col: "recommendations", type: "string-or-null" },
  disposition: { col: "disposition", type: "string-or-null" },
  outcome: { col: "outcome", type: "int", mustNonNull: true },
  intensity: { col: "intesity", type: "int", mustNonNull: true },
  visitType: { col: "visitType", type: "int", mustNonNull: true },
  painLevel: { col: "painLevel", type: "int", mustNonNull: true },
  isHospitalCase: { col: "isHospitalCase", type: "bool", mustNonNull: true },
  hospitalName: { col: "hospitalName", type: "string-or-null" },
  sourceOfReferral: { col: "sourceOfRefferral", type: "string-or-null" },
  transferTo: { col: "transfereTo", type: "string-or-null" },
  destinationOfReferral: { col: "destinationOfRefferal", type: "string-or-null" },
};

@Injectable()
export class VisitsService {
  constructor(
    private readonly tdb: TenantDbService,
    private readonly audit: AuditService,
    private readonly tenant: TenantContextService,
  ) {}

  async list(query: ListVisitsQueryDto): Promise<VisitListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const filters = [
      eq(patients.hcenterId, this.tdb.tenantId),
      eq(patientvisits.isDeleted, 0),
      eq(patients.isDeleted, 0),
    ];
    if (query.from) filters.push(gte(patientvisits.visitDate, query.from));
    if (query.to) filters.push(lt(patientvisits.visitDate, query.to));
    if (query.patientId) filters.push(eq(patientvisits.patientId, query.patientId));
    if (query.doctorId) filters.push(eq(patientvisits.doctor, query.doctorId));
    if (query.visitType !== undefined) filters.push(eq(patientvisits.visitType, query.visitType));
    if (query.outcome !== undefined) filters.push(eq(patientvisits.outcome, query.outcome));

    // Resolve sort. Whitelist guarded by DTO @IsIn.
    const sortDir = query.sortDir ?? "desc";
    const sortColExpr = (() => {
      switch (query.sortBy) {
        case "patient":
          return patients.lastName;
        case "doctor":
          return hcenterusers.lastName;
        case "visitDate":
        default:
          return patientvisits.visitDate;
      }
    })();
    const orderBy = sortDir === "asc" ? asc(sortColExpr) : desc(sortColExpr);

    const [rows, [countRow]] = await Promise.all([
      this.tdb.db
        .select({
          patientVisitId: patientvisits.patientVisitId,
          visitDate: patientvisits.visitDate,
          visitType: patientvisits.visitType,
          outcome: patientvisits.outcome,
          intensity: patientvisits.intesity,
          chiefComplaint: patientvisits.chiefComplaint,
          patientId: patients.patientId,
          patientFirst: patients.firstName,
          patientSecond: patients.secondName,
          patientThird: patients.thirdName,
          patientLast: patients.lastName,
          patientNationalId: patients.nationalId,
          patientFirstAr: patientarabicinfo.firstNameAr,
          patientLastAr: patientarabicinfo.lastNameAr,
          doctorUserId: hcenterusers.userId,
          doctorFirst: hcenterusers.firstName,
          doctorLast: hcenterusers.lastName,
        })
        .from(patientvisits)
        .innerJoin(patients, eq(patients.patientId, patientvisits.patientId))
        .leftJoin(patientarabicinfo, eq(patientarabicinfo.patientId, patients.patientId))
        .leftJoin(hcenterusers, eq(hcenterusers.userId, patientvisits.doctor))
        .where(and(...filters))
        .orderBy(orderBy)
        .limit(pageSize)
        .offset(offset),
      this.tdb.db
        .select({ n: count() })
        .from(patientvisits)
        .innerJoin(patients, eq(patients.patientId, patientvisits.patientId))
        .where(and(...filters)),
    ]);

    // Bulk-aggregate diagnoses + prescriptions for the page in two extra
    // queries (instead of N+1). Cheap enough — pageSize is ≤ 100.
    const visitIds = rows.map((r) => r.patientVisitId);
    let dxByVisit = new Map<string, { count: number; top: string | null }>();
    let rxByVisit = new Map<string, number>();
    if (visitIds.length > 0) {
      const dxRows = await this.tdb.db
        .select({
          visitId: pvassessmentconditions.patientVisitId,
          name: medicalconditions.medicalConditionName,
        })
        .from(pvassessmentconditions)
        .innerJoin(
          medicalconditions,
          eq(medicalconditions.medicalConditionId, pvassessmentconditions.medicalConditionId),
        )
        .where(
          and(
            inArray(pvassessmentconditions.patientVisitId, visitIds),
            eq(pvassessmentconditions.isDeleted, 0),
          ),
        );
      for (const d of dxRows) {
        const cur = dxByVisit.get(d.visitId) ?? { count: 0, top: null };
        cur.count++;
        if (!cur.top) cur.top = d.name;
        dxByVisit.set(d.visitId, cur);
      }
      const rxRows = await this.tdb.db
        .select({
          visitId: pvplanmedications.patientVisitId,
          n: count(),
        })
        .from(pvplanmedications)
        .where(inArray(pvplanmedications.patientVisitId, visitIds))
        .groupBy(pvplanmedications.patientVisitId);
      for (const r of rxRows) rxByVisit.set(r.visitId, Number(r.n));
    }

    const data: VisitListItem[] = rows.map((r) => ({
      patientVisitId: r.patientVisitId,
      visitDate: r.visitDate,
      visitType: r.visitType,
      outcome: r.outcome,
      intensity: r.intensity,
      chiefComplaint: r.chiefComplaint ?? null,
      patient: (() => {
        const enName = [r.patientFirst, r.patientSecond, r.patientThird, r.patientLast]
          .filter((x): x is string => !!x && x.trim().length > 0)
          .join(" ");
        const arName = [r.patientFirstAr, r.patientLastAr]
          .filter((x): x is string => !!x && x.trim().length > 0)
          .join(" ");
        return {
          patientId: r.patientId,
          fullName: enName || arName || r.patientNationalId,
          fullNameAr: arName || null,
          nationalId: r.patientNationalId,
        };
      })(),
      doctor: r.doctorUserId
        ? {
            userId: r.doctorUserId,
            fullName: [r.doctorFirst, r.doctorLast].filter(Boolean).join(" ") || "—",
          }
        : null,
      topDiagnosis: dxByVisit.get(r.patientVisitId)?.top ?? null,
      diagnosisCount: dxByVisit.get(r.patientVisitId)?.count ?? 0,
      prescriptionCount: rxByVisit.get(r.patientVisitId) ?? 0,
    }));

    return { data, total: countRow?.n ?? 0, page, pageSize };
  }

  /** Lightweight counts used by the KPI strip on the visits list screen.
   *  Honors the same filters as `list()` (minus pagination + sort). */
  async stats(query: ListVisitsQueryDto): Promise<VisitStats> {
    const filters = [
      eq(patients.hcenterId, this.tdb.tenantId),
      eq(patientvisits.isDeleted, 0),
      eq(patients.isDeleted, 0),
    ];
    if (query.from) filters.push(gte(patientvisits.visitDate, query.from));
    if (query.to) filters.push(lt(patientvisits.visitDate, query.to));
    if (query.patientId) filters.push(eq(patientvisits.patientId, query.patientId));
    if (query.doctorId) filters.push(eq(patientvisits.doctor, query.doctorId));
    if (query.visitType !== undefined) filters.push(eq(patientvisits.visitType, query.visitType));
    if (query.outcome !== undefined) filters.push(eq(patientvisits.outcome, query.outcome));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const fmtLocal = (d: Date): string => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day} 00:00:00.000`;
    };

    const byOutcomeRows = await this.tdb.db
      .select({ outcome: patientvisits.outcome, n: count() })
      .from(patientvisits)
      .innerJoin(patients, eq(patients.patientId, patientvisits.patientId))
      .where(and(...filters))
      .groupBy(patientvisits.outcome);

    const todayRow = await this.tdb.db
      .select({ n: count() })
      .from(patientvisits)
      .innerJoin(patients, eq(patients.patientId, patientvisits.patientId))
      .where(
        and(
          ...filters,
          gte(patientvisits.visitDate, fmtLocal(today)),
          lt(patientvisits.visitDate, fmtLocal(tomorrow)),
        ),
      );

    const byOutcome: Record<number, number> = {};
    let total = 0;
    for (const r of byOutcomeRows) {
      const n = Number(r.n);
      byOutcome[r.outcome] = n;
      total += n;
    }
    return {
      total,
      open: byOutcome[0] ?? 0,
      resolved: byOutcome[1] ?? 0,
      noShow: byOutcome[5] ?? 0,
      today: Number(todayRow[0]?.n ?? 0),
      byOutcome,
    };
  }

  /** Streamed CSV export of the filtered visit list. Caps at MAX_EXPORT rows. */
  async *exportCsv(query: ListVisitsQueryDto): AsyncGenerator<string> {
    const MAX_EXPORT = 10_000;

    const filters = [
      eq(patients.hcenterId, this.tdb.tenantId),
      eq(patientvisits.isDeleted, 0),
      eq(patients.isDeleted, 0),
    ];
    if (query.from) filters.push(gte(patientvisits.visitDate, query.from));
    if (query.to) filters.push(lt(patientvisits.visitDate, query.to));
    if (query.patientId) filters.push(eq(patientvisits.patientId, query.patientId));
    if (query.doctorId) filters.push(eq(patientvisits.doctor, query.doctorId));
    if (query.visitType !== undefined) filters.push(eq(patientvisits.visitType, query.visitType));
    if (query.outcome !== undefined) filters.push(eq(patientvisits.outcome, query.outcome));

    const rows = await this.tdb.db
      .select({
        patientVisitId: patientvisits.patientVisitId,
        visitDate: patientvisits.visitDate,
        visitType: patientvisits.visitType,
        outcome: patientvisits.outcome,
        chiefComplaint: patientvisits.chiefComplaint,
        patientNationalId: patients.nationalId,
        patientFirst: patients.firstName,
        patientLast: patients.lastName,
        doctorFirst: hcenterusers.firstName,
        doctorLast: hcenterusers.lastName,
      })
      .from(patientvisits)
      .innerJoin(patients, eq(patients.patientId, patientvisits.patientId))
      .leftJoin(hcenterusers, eq(hcenterusers.userId, patientvisits.doctor))
      .where(and(...filters))
      .orderBy(desc(patientvisits.visitDate))
      .limit(MAX_EXPORT);

    const csvEscape = (v: unknown): string => {
      const s = String(v ?? "");
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    yield "visitId,visitDate,visitType,outcome,patient,nationalId,doctor,chiefComplaint\n";
    for (const r of rows) {
      const patient = [r.patientFirst, r.patientLast].filter(Boolean).join(" ");
      const doctor = [r.doctorFirst, r.doctorLast].filter(Boolean).join(" ");
      yield [
        r.patientVisitId,
        r.visitDate,
        r.visitType,
        r.outcome,
        patient,
        r.patientNationalId,
        doctor,
        // Strip newlines + truncate to keep cells well-behaved.
        (r.chiefComplaint ?? "").replace(/\r?\n/g, " ").slice(0, 400),
      ]
        .map(csvEscape)
        .join(",") + "\n";
    }
  }

  async create(dto: CreateVisitDto): Promise<{ patientVisitId: string }> {
    // Confirm the patient exists in this tenant (and isn't soft-deleted).
    const [patient] = await this.tdb.db
      .select({ id: patients.patientId })
      .from(patients)
      .where(
        and(
          eq(patients.patientId, dto.patientId),
          eq(patients.isDeleted, 0),
          eq(patients.hcenterId, this.tdb.tenantId),
        ),
      )
      .limit(1);
    if (!patient) throw new NotFoundException(`Patient ${dto.patientId} not found`);

    // Doctor defaults to the caller. If a doctorUserId was supplied, confirm it
    // belongs to this tenant.
    const doctorId = dto.doctorUserId ?? this.tenant.userId;
    const [doc] = await this.tdb.db
      .select({ id: hcenterusers.userId })
      .from(hcenterusers)
      .where(
        and(
          eq(hcenterusers.userId, doctorId),
          eq(hcenterusers.hcenterId, this.tdb.tenantId),
        ),
      )
      .limit(1);
    if (!doc) {
      throw new BadRequestException(
        `Doctor ${doctorId} is not a member of this HCenter`,
      );
    }

    const id = randomUUID();
    const visitDate = formatMysqlDateTime(dto.visitDate ?? new Date());
    if (!visitDate) throw new BadRequestException("visitDate is invalid");

    await this.tdb.db.insert(patientvisits).values({
      patientVisitId: id,
      patientId: dto.patientId,
      doctor: doctorId,
      visitDate,
      outcome: 0, // Open
      intesity: dto.intensity ?? 0,
      visitType: dto.visitType,
      painLevel: dto.painLevel ?? 0,
      isHospitalCase: 0,
      visitCreationMethod: 1, // Manual
      isDeleted: 0,
      chiefComplaint: dto.chiefComplaint ?? null,
      historyOfPresentIllness: dto.historyOfPresentIllness ?? null,
      dateAdded: formatMysqlDateTime(new Date()) ?? undefined,
    });

    await this.audit.record({
      action: "Create",
      entityType: "PatientVisit",
      entityId: id,
      patientContext: dto.patientId,
      newValues: {
        patientId: dto.patientId,
        doctorUserId: doctorId,
        visitType: dto.visitType,
        visitDate,
        intensity: dto.intensity ?? 0,
        painLevel: dto.painLevel ?? 0,
        creationMethod: "Manual",
      },
    });

    return { patientVisitId: id };
  }

  async getById(patientVisitId: string): Promise<VisitDetail> {
    // Visit + patient (with arabic info) + doctor (with optional specialty). Tenant
    // is enforced through patient.HCenterID since patientvisits has no HCenterID
    // column (CLAUDE.md §16 open question #6).
    const [row] = await this.tdb.db
      .select({
        v: patientvisits,
        p: patients,
        ar: patientarabicinfo,
        doc: hcenterusers,
        hcs: hcenterspecialities,
        sp: specialities,
      })
      .from(patientvisits)
      .innerJoin(patients, eq(patients.patientId, patientvisits.patientId))
      .leftJoin(patientarabicinfo, eq(patientarabicinfo.patientId, patients.patientId))
      .leftJoin(hcenterusers, eq(hcenterusers.userId, patientvisits.doctor))
      .leftJoin(
        hcenterspecialities,
        eq(hcenterspecialities.hcenterSpecialityId, hcenterusers.hcenterSpecialityId),
      )
      .leftJoin(specialities, eq(specialities.specialityId, hcenterspecialities.specialityId))
      .where(
        and(
          eq(patientvisits.patientVisitId, patientVisitId),
          eq(patientvisits.isDeleted, 0),
          eq(patients.isDeleted, 0),
          eq(patients.hcenterId, this.tdb.tenantId),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException(`Visit ${patientVisitId} not found`);
    }

    const v = row.v;
    const p = row.p;
    const ar = row.ar;
    const doc = row.doc;
    const sp = row.sp;

    const enName = composeName([p.firstName, p.secondName, p.thirdName, p.lastName]);
    const arName = composeName([ar?.firstNameAr, ar?.secondNameAr, ar?.thirdNameAr, ar?.lastNameAr]);

    // Sub-records in parallel.
    const [diagnoses, prescriptions, pmhConds, pmhMeds, recs] = await Promise.all([
      this.tdb.db
        .select({
          pvAssessmentConditionId: pvassessmentconditions.pvAssessmentConditionId,
          medicalConditionId: pvassessmentconditions.medicalConditionId,
          conditionName: medicalconditions.medicalConditionName,
          dateDiagnosed: pvassessmentconditions.dateDiagnosed,
          ageOfOnset: pvassessmentconditions.ageOfOnset,
          conditionStatus: pvassessmentconditions.conditionStatus,
          comments: pvassessmentconditions.comments,
        })
        .from(pvassessmentconditions)
        .innerJoin(
          medicalconditions,
          eq(medicalconditions.medicalConditionId, pvassessmentconditions.medicalConditionId),
        )
        .where(
          and(
            eq(pvassessmentconditions.patientVisitId, v.patientVisitId),
            eq(pvassessmentconditions.isDeleted, 0),
          ),
        ),

      this.tdb.db
        .select({
          pvPlanMedicationId: pvplanmedications.pvPlanMedicationId,
          medicineId: pvplanmedications.medicineId,
          medicineName: medicines.tradeName,
          scientificName: medicines.scientificName,
          indication: pvplanmedications.indication,
          dose: pvplanmedications.dose,
          period: pvplanmedications.period,
          frequency: pvplanmedications.frequency,
          frequencyUnit: pvplanmedications.frequencyUnit,
          quantityNumber: pvplanmedications.quantityNumber,
          quantityForm: pvplanmedications.quantityForm,
          route: pvplanmedications.route,
          prescriptionDate: pvplanmedications.prescriptionDate,
          notes: pvplanmedications.notes,
          isPrescribed: pvplanmedications.isPrescribed,
          assessmentConditionId: pvplanmedications.pvAssessmentConditionId,
          diagnosisName: medicalconditions.medicalConditionName,
        })
        .from(pvplanmedications)
        .innerJoin(medicines, eq(medicines.medicineId, pvplanmedications.medicineId))
        .leftJoin(
          pvassessmentconditions,
          eq(
            pvassessmentconditions.pvAssessmentConditionId,
            pvplanmedications.pvAssessmentConditionId,
          ),
        )
        .leftJoin(
          medicalconditions,
          eq(medicalconditions.medicalConditionId, pvassessmentconditions.medicalConditionId),
        )
        .where(eq(pvplanmedications.patientVisitId, v.patientVisitId)),

      this.tdb.db
        .select({
          pvPmhConditionId: pvpmhconditions.pvpmhConditionId,
          conditionName: medicalconditions.medicalConditionName,
          dateDiagnosed: pvpmhconditions.dateDiagnosed,
          ageOfOnset: pvpmhconditions.ageOfOnset,
          conditionStatus: pvpmhconditions.conditionStatus,
        })
        .from(pvpmhconditions)
        .innerJoin(
          medicalconditions,
          eq(medicalconditions.medicalConditionId, pvpmhconditions.medicalConditionId),
        )
        .where(eq(pvpmhconditions.patientVisitId, v.patientVisitId)),

      this.tdb.db
        .select({
          pvPmhMedicationId: pvpmhmedications.pvpmhMedicationId,
          medicineName: medicines.tradeName,
          scientificName: medicines.scientificName,
          dose: pvpmhmedications.dose,
          period: pvpmhmedications.period,
          indication: pvpmhmedications.indication,
        })
        .from(pvpmhmedications)
        .innerJoin(medicines, eq(medicines.medicineId, pvpmhmedications.medicineId))
        .where(eq(pvpmhmedications.patientVisitId, v.patientVisitId)),

      this.tdb.db
        .select({
          afterVisitRecommendationId: aftervisitrecommendations.afterVisitRecommendationId,
          recommended: aftervisitrecommendations.recommended,
          isDone: aftervisitrecommendations.isDone,
          requestDate: aftervisitrecommendations.requestDate,
          processedDate: aftervisitrecommendations.processedDate,
        })
        .from(aftervisitrecommendations)
        .where(eq(aftervisitrecommendations.patientVisitId, v.patientVisitId)),
    ]);

    const detail: VisitDetail = {
      patientVisitId: v.patientVisitId,
      visitDate: v.visitDate,
      outcome: v.outcome,
      intensity: v.intesity,
      visitType: v.visitType,
      painLevel: v.painLevel,
      isHospitalCase: !!v.isHospitalCase,
      hospitalName: v.hospitalName ?? null,
      parentVisitId: v.parentVisitId ?? null,
      dateAdded: v.dateAdded ?? null,
      chiefComplaint: v.chiefComplaint ?? null,
      historyOfPresentIllness: v.historyOfPresentIllness ?? null,
      pastMedicalHistory: v.pastMedicalHistory ?? null,
      notes: v.notes ?? null,
      recommendations: v.recommendations ?? null,
      disposition: v.disposition ?? null,
      sourceOfReferral: v.sourceOfRefferral ?? null,
      transferTo: v.transfereTo ?? null,
      destinationOfReferral: v.destinationOfRefferal ?? null,
      patient: {
        patientId: p.patientId,
        nationalId: p.nationalId,
        fullName: enName || arName,
        fullNameAr: arName || null,
        sex: p.sex,
        dateOfBirth: p.dateOfBirth ?? null,
      },
      doctor: doc
        ? {
            userId: doc.userId,
            fullName: composeName([doc.firstName, doc.secondName, doc.thirdName, doc.lastName]),
            speciality: sp?.specialityName ?? null,
          }
        : null,
      diagnoses,
      prescriptions: prescriptions.map((rx) => ({
        pvPlanMedicationId: rx.pvPlanMedicationId,
        medicineId: rx.medicineId,
        medicineName: rx.medicineName ?? rx.scientificName ?? "—",
        scientificName: rx.scientificName ?? null,
        indication: rx.indication ?? null,
        dose: rx.dose ?? null,
        period: rx.period ?? null,
        frequency: rx.frequency ?? null,
        frequencyUnit: rx.frequencyUnit ?? null,
        quantityNumber: rx.quantityNumber ?? null,
        quantityForm: rx.quantityForm ?? null,
        route: rx.route ?? null,
        prescriptionDate: rx.prescriptionDate ?? null,
        notes: rx.notes ?? null,
        isPrescribed: !!rx.isPrescribed,
        diagnosisName: rx.assessmentConditionId ? rx.diagnosisName ?? null : null,
      })),
      pmhConditions: pmhConds,
      pmhMedications: pmhMeds.map((m) => ({
        pvPmhMedicationId: m.pvPmhMedicationId,
        medicineName: m.medicineName ?? m.scientificName ?? "—",
        scientificName: m.scientificName ?? null,
        dose: m.dose ?? null,
        period: m.period ?? null,
        indication: m.indication ?? null,
      })),
      afterVisitRecommendations: recs.map((r) => ({
        afterVisitRecommendationId: r.afterVisitRecommendationId,
        recommended: r.recommended,
        isDone: !!r.isDone,
        requestDate: r.requestDate,
        processedDate: r.processedDate ?? null,
      })),
    };

    // Touch a no-op to keep the import warning-free if `isNotNull` is unused in
    // a particular build configuration (drizzle's typecheck is strict).
    void isNotNull;

    await this.audit.record({
      action: "View",
      entityType: "PatientVisit",
      entityId: v.patientVisitId,
      patientContext: p.patientId,
    });

    return detail;
  }

  /**
   * Update visit-level fields. Computes a minimal diff so only changed
   * columns are written, and emits an Update audit row with the changed
   * fields + previous/new values for HIPAA traceability.
   */
  async update(patientVisitId: string, patch: UpdateVisitDto): Promise<VisitDetail> {
    // Fetch the current row (with tenant scope via patient join). Errors out 404
    // if the visit doesn't exist or belongs to another HCenter.
    const [current] = await this.tdb.db
      .select({ v: patientvisits, hcenterId: patients.hcenterId })
      .from(patientvisits)
      .innerJoin(patients, eq(patients.patientId, patientvisits.patientId))
      .where(
        and(
          eq(patientvisits.patientVisitId, patientVisitId),
          eq(patientvisits.isDeleted, 0),
          eq(patients.isDeleted, 0),
          eq(patients.hcenterId, this.tdb.tenantId),
        ),
      )
      .limit(1);

    if (!current) {
      throw new NotFoundException(`Visit ${patientVisitId} not found`);
    }

    // Build the diff: collect only fields that were sent AND differ from current.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setFields: Record<string, any> = {};
    const previousValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};
    const changedFields: string[] = [];

    for (const [field, spec] of Object.entries(FIELD_MAP) as Array<
      [keyof UpdateVisitDto, (typeof FIELD_MAP)[keyof UpdateVisitDto]]
    >) {
      const incoming = patch[field];
      // class-transformer populates declared properties as undefined when the
      // payload omits them — treat undefined as "not sent" rather than "set null".
      if (incoming === undefined) continue;
      if (spec.mustNonNull && incoming === null) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = (current.v as Record<string, any>)[spec.col];
      const normalizedIncoming = normalize(incoming, spec.type);
      const normalizedExisting = normalize(existing, spec.type);

      if (normalizedIncoming === normalizedExisting) continue;

      setFields[spec.col] = normalizedIncoming;
      previousValues[field] = normalizedExisting;
      newValues[field] = normalizedIncoming;
      changedFields.push(field);
    }

    if (changedFields.length === 0) {
      // No-op — return the fresh detail without writing.
      return this.getById(patientVisitId);
    }

    const result = await this.tdb.db
      .update(patientvisits)
      .set(setFields)
      .where(
        and(
          eq(patientvisits.patientVisitId, patientVisitId),
          eq(patientvisits.isDeleted, 0),
        ),
      );

    // mysql2 wraps affectedRows in [ResultSetHeader, ...]; Drizzle exposes it via .affectedRows.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const affected = (result as unknown as { affectedRows?: number }).affectedRows ?? null;
    if (affected !== null && affected !== 1) {
      throw new ConflictException(
        `Expected to update 1 visit row, but ${affected} were affected`,
      );
    }

    await this.audit.record({
      action: "Update",
      entityType: "PatientVisit",
      entityId: patientVisitId,
      patientContext: current.v.patientId,
      changedFields,
      previousValues,
      newValues,
    });

    return this.getById(patientVisitId);
  }
}

function normalize(value: unknown, kind: "string-or-null" | "int" | "bool"): unknown {
  if (kind === "string-or-null") {
    if (value === undefined || value === null) return null;
    const s = String(value);
    return s.length === 0 ? null : s;
  }
  if (kind === "int") {
    if (value === undefined || value === null) return null;
    return Number(value);
  }
  if (kind === "bool") {
    if (value === undefined || value === null) return 0;
    // legacy column is tinyint(1) — store as 0/1 numbers, not booleans.
    return value ? 1 : 0;
  }
  return value;
}

function composeName(parts: Array<string | null | undefined>): string {
  return parts.filter((p): p is string => !!p && p.trim().length > 0).join(" ").trim();
}

// MariaDB datetime(3) wants 'YYYY-MM-DD HH:MM:SS.fff'; ISO 8601 with T/Z breaks
// mysql2's prepared-statement path. Mirrors patients.service.ts.
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
