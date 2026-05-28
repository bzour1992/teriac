import { Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import {
  aftervisitrecommendations,
  allergies,
  chronicdiseases,
  hcenterusers,
  hcenters,
  hcentersystemsettings,
  medicalconditions,
  medicines,
  patientarabicinfo,
  patientbillingrecords,
  patientinvoices,
  patientlongtermmedicines,
  patientproblems,
  patientvisits,
  patients,
  pvassessmentconditions,
  pvplanmedications,
  transactioncategories,
} from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";
import type { HCenterHeader, Lang, PatientBlock } from "./templates/base.template";
import type { VisitReportData } from "./templates/visit.template";
import type { PrescriptionReportData } from "./templates/prescription.template";
import type { PatientSummaryData } from "./templates/patient-summary.template";
import type { InvoiceReportData } from "./templates/invoice.template";

@Injectable()
export class ReportsService {
  constructor(private readonly tdb: TenantDbService) {}

  // ── Shared loaders ────────────────────────────────────────────────────────

  async getHCenter(): Promise<HCenterHeader> {
    const [row] = await this.tdb.db
      .select()
      .from(hcenters)
      .where(eq(hcenters.hcenterId, this.tdb.tenantId))
      .limit(1);
    if (!row) throw new NotFoundException("HCenter not found");
    return {
      name: row.hcenterName,
      nameRep: row.hcenterNameRep ?? null,
      reportAddress: row.reportAddress ?? null,
      phone: row.phone ?? null,
      reportsWorkingTimes: row.reportsWorkingTimes ?? null,
    };
  }

  private async loadPatient(patientId: string): Promise<PatientBlock & { address?: string | null }> {
    const [row] = await this.tdb.db
      .select({
        patientId: patients.patientId,
        nationalId: patients.nationalId,
        firstName: patients.firstName,
        secondName: patients.secondName,
        thirdName: patients.thirdName,
        lastName: patients.lastName,
        sex: patients.sex,
        dateOfBirth: patients.dateOfBirth,
        mobileNumber: patients.mobileNumber,
        address: patients.address,
        firstNameAr: patientarabicinfo.firstNameAr,
        lastNameAr: patientarabicinfo.lastNameAr,
      })
      .from(patients)
      .leftJoin(patientarabicinfo, eq(patientarabicinfo.patientId, patients.patientId))
      .where(
        and(
          eq(patients.patientId, patientId),
          eq(patients.hcenterId, this.tdb.tenantId),
          eq(patients.isDeleted, 0),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException(`Patient ${patientId} not found`);

    const fullName = [row.firstName, row.secondName, row.thirdName, row.lastName]
      .filter(Boolean).join(" ").trim();
    const fullNameAr = [row.firstNameAr, row.lastNameAr].filter(Boolean).join(" ").trim() || null;

    return {
      fullName: fullName || row.nationalId,
      fullNameAr,
      nationalId: row.nationalId,
      dateOfBirth: row.dateOfBirth ?? null,
      sex: row.sex,
      mobileNumber: row.mobileNumber ?? null,
      address: (row.address as string | null | undefined) ?? null,
    };
  }

  private async loadVisit(visitId: string) {
    const [row] = await this.tdb.db
      .select({
        visitId: patientvisits.patientVisitId,
        patientId: patientvisits.patientId,
        visitDate: patientvisits.visitDate,
        visitType: patientvisits.visitType,
        outcome: patientvisits.outcome,
        painLevel: patientvisits.painLevel,
        chiefComplaint: patientvisits.chiefComplaint,
        historyOfPresentIllness: patientvisits.historyOfPresentIllness,
        pastMedicalHistory: patientvisits.pastMedicalHistory,
        notes: patientvisits.notes,
        recommendations: patientvisits.recommendations,
        disposition: patientvisits.disposition,
        doctorFirstName: hcenterusers.firstName,
        doctorLastName: hcenterusers.lastName,
      })
      .from(patientvisits)
      .leftJoin(hcenterusers, eq(hcenterusers.userId, patientvisits.doctor))
      .where(
        and(
          eq(patientvisits.patientVisitId, visitId),
          eq(patientvisits.isDeleted, 0),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException(`Visit ${visitId} not found`);

    // Verify tenant via patient
    const [pt] = await this.tdb.db
      .select({ hcenterId: patients.hcenterId })
      .from(patients)
      .where(eq(patients.patientId, row.patientId))
      .limit(1);
    if (!pt || pt.hcenterId !== this.tdb.tenantId) {
      throw new NotFoundException(`Visit ${visitId} not found`);
    }

    return {
      ...row,
      doctorName: [row.doctorFirstName, row.doctorLastName].filter(Boolean).join(" ").trim() || "—",
    };
  }

  // ── Visit report ─────────────────────────────────────────────────────────

  async getVisitReportData(visitId: string): Promise<VisitReportData> {
    const [hcenter, visit] = await Promise.all([
      this.getHCenter(),
      this.loadVisit(visitId),
    ]);
    const patient = await this.loadPatient(visit.patientId);

    const [diagnoseRows, rxRows, recRows] = await Promise.all([
      this.tdb.db
        .select({
          conditionName: medicalconditions.medicalConditionName,
          conditionStatus: pvassessmentconditions.conditionStatus,
          comments: pvassessmentconditions.comments,
        })
        .from(pvassessmentconditions)
        .innerJoin(medicalconditions, eq(medicalconditions.medicalConditionId, pvassessmentconditions.medicalConditionId))
        .where(
          and(
            eq(pvassessmentconditions.patientVisitId, visitId),
            eq(pvassessmentconditions.isDeleted, 0),
          ),
        ),
      this.tdb.db
        .select({
          medicineName: medicines.tradeName,
          scientificName: medicines.scientificName,
          dose: pvplanmedications.dose,
          period: pvplanmedications.period,
          frequency: pvplanmedications.frequency,
          frequencyUnit: pvplanmedications.frequencyUnit,
          route: pvplanmedications.route,
          indication: pvplanmedications.indication,
        })
        .from(pvplanmedications)
        .innerJoin(medicines, eq(medicines.medicineId, pvplanmedications.medicineId))
        .where(eq(pvplanmedications.patientVisitId, visitId)),
      this.tdb.db
        .select({
          recommended: aftervisitrecommendations.recommended,
          isDone: aftervisitrecommendations.isDone,
        })
        .from(aftervisitrecommendations)
        .where(eq(aftervisitrecommendations.patientVisitId, visitId)),
    ]);

    return {
      hcenter,
      patient,
      visit: {
        visitDate: visit.visitDate,
        visitType: visit.visitType,
        outcome: visit.outcome,
        painLevel: visit.painLevel,
        doctorName: visit.doctorName,
        chiefComplaint: visit.chiefComplaint ?? null,
        historyOfPresentIllness: visit.historyOfPresentIllness ?? null,
        pastMedicalHistory: visit.pastMedicalHistory ?? null,
        notes: visit.notes ?? null,
        recommendations: visit.recommendations ?? null,
        disposition: visit.disposition ?? null,
        diagnoses: diagnoseRows.map((d) => ({
          conditionName: d.conditionName,
          conditionStatus: d.conditionStatus ?? null,
          comments: d.comments ?? null,
        })),
        prescriptions: rxRows.map((r) => ({
          medicineName: r.medicineName ?? "—",
          scientificName: r.scientificName ?? null,
          dose: r.dose ?? null,
          period: r.period ?? null,
          frequency: r.frequency ?? null,
          frequencyUnit: r.frequencyUnit ?? null,
          route: r.route ?? null,
          indication: r.indication ?? null,
        })),
        afterVisitRecommendations: recRows.map((r) => ({
          recommended: r.recommended,
          isDone: r.isDone === 1,
        })),
      },
    };
  }

  // ── Prescription ─────────────────────────────────────────────────────────

  async getPrescriptionData(visitId: string): Promise<PrescriptionReportData> {
    const [hcenter, visit] = await Promise.all([
      this.getHCenter(),
      this.loadVisit(visitId),
    ]);
    const patient = await this.loadPatient(visit.patientId);

    const rxRows = await this.tdb.db
      .select({
        medicineName: medicines.tradeName,
        scientificName: medicines.scientificName,
        dose: pvplanmedications.dose,
        period: pvplanmedications.period,
        frequency: pvplanmedications.frequency,
        frequencyUnit: pvplanmedications.frequencyUnit,
        quantityNumber: pvplanmedications.quantityNumber,
        quantityForm: pvplanmedications.quantityForm,
        route: pvplanmedications.route,
        indication: pvplanmedications.indication,
        notes: pvplanmedications.notes,
      })
      .from(pvplanmedications)
      .innerJoin(medicines, eq(medicines.medicineId, pvplanmedications.medicineId))
      .where(
        and(
          eq(pvplanmedications.patientVisitId, visitId),
          eq(pvplanmedications.isPrescribed, 1),
        ),
      );

    return {
      hcenter,
      patient,
      visitDate: visit.visitDate,
      doctorName: visit.doctorName,
      prescriptions: rxRows.map((r) => ({
        medicineName: r.medicineName ?? "—",
        scientificName: r.scientificName ?? null,
        dose: r.dose ?? null,
        period: r.period ?? null,
        frequency: r.frequency ?? null,
        frequencyUnit: r.frequencyUnit ?? null,
        quantityNumber: r.quantityNumber ?? null,
        quantityForm: r.quantityForm ?? null,
        route: r.route ?? null,
        indication: r.indication ?? null,
        notes: r.notes ?? null,
      })),
    };
  }

  // ── Patient summary ───────────────────────────────────────────────────────

  async getPatientSummaryData(patientId: string): Promise<PatientSummaryData> {
    const [hcenter, patient] = await Promise.all([
      this.getHCenter(),
      this.loadPatient(patientId),
    ]);

    const [allergyRows, chronicRows, ltmRows, problemRows, visitRows] = await Promise.all([
      this.tdb.db
        .select({
          conditionName: medicalconditions.medicalConditionName,
          severity: allergies.severity,
          reaction: allergies.reaction,
        })
        .from(allergies)
        .innerJoin(medicalconditions, eq(medicalconditions.medicalConditionId, allergies.medicalConditionId))
        .where(eq(allergies.patientId, patientId)),
      this.tdb.db
        .select({
          conditionName: medicalconditions.medicalConditionName,
          yearDiagnosed: chronicdiseases.yearDiagnosed,
        })
        .from(chronicdiseases)
        .innerJoin(medicalconditions, eq(medicalconditions.medicalConditionId, chronicdiseases.medicalConditionId))
        .where(eq(chronicdiseases.patientId, patientId)),
      this.tdb.db
        .select({
          medicineName: medicines.tradeName,
          dose: patientlongtermmedicines.dose,
          indication: patientlongtermmedicines.indication,
        })
        .from(patientlongtermmedicines)
        .innerJoin(medicines, eq(medicines.medicineId, patientlongtermmedicines.medicineId))
        .where(eq(patientlongtermmedicines.patientId, patientId)),
      this.tdb.db
        .select()
        .from(patientproblems)
        .where(eq(patientproblems.patientId, patientId)),
      this.tdb.db
        .select({
          visitDate: patientvisits.visitDate,
          visitType: patientvisits.visitType,
          outcome: patientvisits.outcome,
          chiefComplaint: patientvisits.chiefComplaint,
          doctorFirstName: hcenterusers.firstName,
          doctorLastName: hcenterusers.lastName,
        })
        .from(patientvisits)
        .leftJoin(hcenterusers, eq(hcenterusers.userId, patientvisits.doctor))
        .where(
          and(
            eq(patientvisits.patientId, patientId),
            eq(patientvisits.isDeleted, 0),
          ),
        )
        .orderBy(desc(patientvisits.visitDate))
        .limit(10),
    ]);

    return {
      hcenter,
      patient,
      allergies: allergyRows.map((a) => ({
        conditionName: a.conditionName,
        severity: a.severity ?? null,
        reaction: a.reaction ?? null,
      })),
      chronicDiseases: chronicRows.map((c) => ({
        conditionName: c.conditionName,
        yearDiagnosed: c.yearDiagnosed ?? null,
      })),
      longTermMedications: ltmRows.map((m) => ({
        medicineName: m.medicineName ?? "—",
        dose: m.dose ?? null,
        indication: m.indication ?? null,
      })),
      problems: problemRows.map((p) => ({
        problemText: p.problemText,
        problemCategory: p.problemCategory,
        isActive: p.isActive === 1,
      })),
      recentVisits: visitRows.map((v) => ({
        visitDate: v.visitDate,
        doctorName: [v.doctorFirstName, v.doctorLastName].filter(Boolean).join(" ") || "—",
        visitType: v.visitType,
        outcome: v.outcome,
        chiefComplaint: v.chiefComplaint ?? null,
      })),
    };
  }

  // ── Invoice ───────────────────────────────────────────────────────────────

  async getInvoiceData(invoiceId: string): Promise<InvoiceReportData> {
    const [hcenter] = await Promise.all([this.getHCenter()]);

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

    const patient = await this.loadPatient(inv.patientId);

    const recordRows = await this.tdb.db
      .select({
        details: patientbillingrecords.details,
        expense: patientbillingrecords.expense,
        categoryName: transactioncategories.transactionCategoryName,
      })
      .from(patientbillingrecords)
      .innerJoin(transactioncategories, eq(transactioncategories.transactionCategoryId, patientbillingrecords.transactionCategoryId))
      .where(eq(patientbillingrecords.ifNumber, inv.invoiceNumber));

    const totalCharged = inv.paidByPatient + (inv.coveredByHealthInsurance ?? 0) +
      (inv.coveredByHospital ?? 0) + inv.finalBalance + inv.discount;

    return {
      hcenter,
      patient,
      invoice: {
        invoiceId: inv.patientInvoiceId,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        paidByPatient: inv.paidByPatient,
        discount: inv.discount,
        coveredByHealthInsurance: inv.coveredByHealthInsurance ?? null,
        coveredByHospital: inv.coveredByHospital ?? null,
        finalBalance: inv.finalBalance,
        totalCharged,
      },
      records: recordRows.map((r) => ({
        details: r.details,
        categoryName: r.categoryName,
        expense: r.expense,
      })),
    };
  }
}
