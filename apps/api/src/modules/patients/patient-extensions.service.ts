import { Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  patientarabicinfo,
  patientadditionalinfo,
  patientinsurancedetails,
  patients,
  patientsaddetails,
  patientspecialnotes,
} from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";
import { AuditService } from "../../common/audit/audit.service";
import type {
  AdditionalInfoDto,
  ArabicInfoDto,
  CreateInsuranceDto,
  CreateNoteDto,
  InsuranceItemDto,
  PatientNoteDto,
  SubstanceUseDto,
  UpdateAdditionalInfoDto,
  UpdateArabicInfoDto,
  UpdateInsuranceDto,
  UpdateSubstanceUseDto,
} from "./dto/patient-extensions.dto";

@Injectable()
export class PatientExtensionsService {
  constructor(
    private readonly tdb: TenantDbService,
    private readonly audit: AuditService,
  ) {}

  // ── Guards ────────────────────────────────────────────────────────────────

  private async assertPatient(patientId: string): Promise<void> {
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

  // ── Arabic info ───────────────────────────────────────────────────────────

  async getArabicInfo(patientId: string): Promise<ArabicInfoDto> {
    await this.assertPatient(patientId);
    const [row] = await this.tdb.db
      .select()
      .from(patientarabicinfo)
      .where(eq(patientarabicinfo.patientId, patientId))
      .limit(1);
    return {
      firstNameAr: row?.firstNameAr ?? null,
      secondNameAr: row?.secondNameAr ?? null,
      thirdNameAr: row?.thirdNameAr ?? null,
      lastNameAr: row?.lastNameAr ?? null,
    };
  }

  async upsertArabicInfo(patientId: string, dto: UpdateArabicInfoDto): Promise<void> {
    await this.assertPatient(patientId);
    const [existing] = await this.tdb.db
      .select({ id: patientarabicinfo.patientId })
      .from(patientarabicinfo)
      .where(eq(patientarabicinfo.patientId, patientId))
      .limit(1);

    const vals = {
      firstNameAr: dto.firstNameAr?.trim() || null,
      secondNameAr: dto.secondNameAr?.trim() || null,
      thirdNameAr: dto.thirdNameAr?.trim() || null,
      lastNameAr: dto.lastNameAr?.trim() || null,
    };

    if (existing) {
      await this.tdb.db
        .update(patientarabicinfo)
        .set(vals)
        .where(eq(patientarabicinfo.patientId, patientId));
    } else {
      await this.tdb.db.insert(patientarabicinfo).values({ patientId, ...vals });
    }

    await this.audit.record({
      action: "Update",
      entityType: "PatientArabicInfo",
      entityId: patientId,
      patientContext: patientId,
      newValues: vals,
    });
  }

  // ── Additional info ───────────────────────────────────────────────────────

  async getAdditionalInfo(patientId: string): Promise<AdditionalInfoDto | null> {
    await this.assertPatient(patientId);
    const [row] = await this.tdb.db
      .select()
      .from(patientadditionalinfo)
      .where(eq(patientadditionalinfo.patientId, patientId))
      .limit(1);
    if (!row) return null;
    return {
      occupation: row.occupation ?? null,
      organization: row.organization ?? null,
      dailyRoutine: row.dailyRoutine ?? null,
      dietaryPatterns: row.dietaryPatterns ?? null,
      sleepPatterns: row.sleepPatterns ?? null,
      exercisePatterns: row.exercisePatterns ?? null,
      poBox: row.poBox ?? null,
      zipCode: row.zipCode ?? null,
      homeEnvironment: row.homeEnvironment ?? null,
    };
  }

  async upsertAdditionalInfo(patientId: string, dto: UpdateAdditionalInfoDto): Promise<void> {
    await this.assertPatient(patientId);
    const [existing] = await this.tdb.db
      .select({ id: patientadditionalinfo.patientId })
      .from(patientadditionalinfo)
      .where(eq(patientadditionalinfo.patientId, patientId))
      .limit(1);

    const vals = {
      occupation: dto.occupation?.trim() || null,
      organization: dto.organization?.trim() || null,
      dailyRoutine: dto.dailyRoutine?.trim() || null,
      dietaryPatterns: dto.dietaryPatterns?.trim() || null,
      sleepPatterns: dto.sleepPatterns?.trim() || null,
      exercisePatterns: dto.exercisePatterns?.trim() || null,
      poBox: dto.poBox?.trim() || null,
      zipCode: dto.zipCode?.trim() || null,
      homeEnvironment: dto.homeEnvironment?.trim() || null,
    };

    if (existing) {
      await this.tdb.db
        .update(patientadditionalinfo)
        .set(vals)
        .where(eq(patientadditionalinfo.patientId, patientId));
    } else {
      await this.tdb.db.insert(patientadditionalinfo).values({ patientId, ...vals });
    }

    await this.audit.record({
      action: "Update",
      entityType: "PatientAdditionalInfo",
      entityId: patientId,
      patientContext: patientId,
      newValues: { occupation: vals.occupation, organization: vals.organization },
    });
  }

  // ── Substance use ─────────────────────────────────────────────────────────

  async getSubstanceUse(patientId: string): Promise<SubstanceUseDto | null> {
    await this.assertPatient(patientId);
    const [row] = await this.tdb.db
      .select()
      .from(patientsaddetails)
      .where(eq(patientsaddetails.patientId, patientId))
      .limit(1);
    if (!row) return null;
    return {
      liveWithSmokers: row.liveWithSmokers === 1,
      parentsWereSmokers: row.parentsWereSmokers === 1,
      smokedBefore: row.smokedBofore === 1,        // typo in DB
      stillSmoking: row.stillSmoking === 1,
      cigarettesNumber: row.cigarettesNumber ?? null,
      cigarettesStartYear: row.cigarettesStartYear ?? null,
      cigarettesStopYear: row.cigarettesStopYear ?? null,
      sheeshaHeadNumber: row.sheeshaHeadNumber ?? null,
      sheeshaStartYear: row.sheeshaStartYear ?? null,
      sheeshaStopYear: row.sheeshaStopYear ?? null,
      totalPackYear: row.totalPackYear ?? null,
      smokingComments: row.smokingComments ?? null,
      alcoholic: row.alcoholic === 1,
      pastAlcoholic: row.pastAlcoholic === 1,
      excessiveAlcoholUse: row.excessiveAlcoholUse === 1,
      beerNumber: row.beerNumber ?? null,
      wineNumber: row.wineNumber ?? null,
      liquorNumber: row.liquorNumber ?? null,
      drinkingComments: row.drinkingComments ?? null,
      drugUser: row.drugUser === 1,
      drugComments: row.drugComments ?? null,
    };
  }

  async upsertSubstanceUse(patientId: string, dto: UpdateSubstanceUseDto): Promise<void> {
    await this.assertPatient(patientId);
    const [existing] = await this.tdb.db
      .select({ id: patientsaddetails.patientId })
      .from(patientsaddetails)
      .where(eq(patientsaddetails.patientId, patientId))
      .limit(1);

    const vals = {
      liveWithSmokers: (dto.liveWithSmokers ?? false) ? 1 : 0,
      parentsWereSmokers: (dto.parentsWereSmokers ?? false) ? 1 : 0,
      smokedBofore: (dto.smokedBefore ?? false) ? 1 : 0,   // typo column name
      stillSmoking: (dto.stillSmoking ?? false) ? 1 : 0,
      cigarettesNumber: dto.cigarettesNumber ?? null,
      cigarettesStartYear: dto.cigarettesStartYear ?? null,
      cigarettesStopYear: dto.cigarettesStopYear ?? null,
      sheeshaHeadNumber: dto.sheeshaHeadNumber ?? null,
      sheeshaStartYear: dto.sheeshaStartYear ?? null,
      sheeshaStopYear: dto.sheeshaStopYear ?? null,
      totalPackYear: dto.totalPackYear ?? null,
      smokingComments: dto.smokingComments?.trim() || null,
      alcoholic: (dto.alcoholic ?? false) ? 1 : 0,
      pastAlcoholic: (dto.pastAlcoholic ?? false) ? 1 : 0,
      excessiveAlcoholUse: (dto.excessiveAlcoholUse ?? false) ? 1 : 0,
      beerNumber: dto.beerNumber ?? null,
      wineNumber: dto.wineNumber ?? null,
      liquorNumber: dto.liquorNumber ?? null,
      drinkingComments: dto.drinkingComments?.trim() || null,
      drugUser: (dto.drugUser ?? false) ? 1 : 0,
      drugComments: dto.drugComments?.trim() || null,
    };

    if (existing) {
      await this.tdb.db
        .update(patientsaddetails)
        .set(vals)
        .where(eq(patientsaddetails.patientId, patientId));
    } else {
      await this.tdb.db.insert(patientsaddetails).values({ patientId, ...vals });
    }

    await this.audit.record({
      action: "Update",
      entityType: "PatientSubstanceUse",
      entityId: patientId,
      patientContext: patientId,
      newValues: {
        stillSmoking: dto.stillSmoking, alcoholic: dto.alcoholic, drugUser: dto.drugUser,
      },
    });
  }

  // ── Insurance ─────────────────────────────────────────────────────────────

  async listInsurance(patientId: string): Promise<InsuranceItemDto[]> {
    await this.assertPatient(patientId);
    const rows = await this.tdb.db
      .select()
      .from(patientinsurancedetails)
      .where(eq(patientinsurancedetails.patientId, patientId))
      .orderBy(asc(patientinsurancedetails.isActive));

    return rows
      .sort((a, b) => (b.isActive ?? 0) - (a.isActive ?? 0))
      .map((r) => ({
        patientInsuranceDetailId: r.patientInsuranceDetailId,
        insuranceCompany: r.insuranceCompany,
        insuranceLevel: r.insuranceLevel ?? null,
        coveragePercentage: r.coveragePercentage ?? null,
        insuranceCardNumber: r.insuranceCardNumber ?? null,
        isActive: r.isActive === 1,
        participantName: r.participantName ?? null,
        participantCompany: r.participantCompany ?? null,
        relationToParticipant: r.relationToParticipant ?? null,
        formNumber: r.formNumber ?? null,
        notes: r.notes ?? null,
      }));
  }

  async createInsurance(
    patientId: string,
    dto: CreateInsuranceDto,
  ): Promise<{ patientInsuranceDetailId: string }> {
    await this.assertPatient(patientId);
    const id = randomUUID();
    await this.tdb.db.insert(patientinsurancedetails).values({
      patientInsuranceDetailId: id,
      patientId,
      insuranceCompany: dto.insuranceCompany,
      insuranceLevel: dto.insuranceLevel?.trim() || null,
      coveragePercentage: dto.coveragePercentage ?? null,
      insuranceCardNumber: dto.insuranceCardNumber?.trim() || null,
      isActive: dto.isActive !== false ? 1 : 0,
      participantName: dto.participantName?.trim() || null,
      participantCompany: dto.participantCompany?.trim() || null,
      relationToParticipant: dto.relationToParticipant?.trim() || null,
      formNumber: dto.formNumber?.trim() || null,
      notes: dto.notes?.trim() || null,
    });
    await this.audit.record({
      action: "Create",
      entityType: "PatientInsurance",
      entityId: id,
      patientContext: patientId,
      newValues: { insuranceCompany: dto.insuranceCompany, isActive: dto.isActive !== false },
    });
    return { patientInsuranceDetailId: id };
  }

  async updateInsurance(
    patientId: string,
    insuranceId: string,
    dto: UpdateInsuranceDto,
  ): Promise<void> {
    await this.assertPatient(patientId);
    const [current] = await this.tdb.db
      .select()
      .from(patientinsurancedetails)
      .where(
        and(
          eq(patientinsurancedetails.patientInsuranceDetailId, insuranceId),
          eq(patientinsurancedetails.patientId, patientId),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundException(`Insurance ${insuranceId} not found`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setFields: Record<string, any> = {};
    if (dto.insuranceCompany !== undefined) setFields.insuranceCompany = dto.insuranceCompany;
    if (dto.insuranceLevel !== undefined) setFields.insuranceLevel = dto.insuranceLevel?.trim() || null;
    if (dto.coveragePercentage !== undefined) setFields.coveragePercentage = dto.coveragePercentage;
    if (dto.insuranceCardNumber !== undefined) setFields.insuranceCardNumber = dto.insuranceCardNumber?.trim() || null;
    if (dto.isActive !== undefined) setFields.isActive = dto.isActive ? 1 : 0;
    if (dto.participantName !== undefined) setFields.participantName = dto.participantName?.trim() || null;
    if (dto.participantCompany !== undefined) setFields.participantCompany = dto.participantCompany?.trim() || null;
    if (dto.relationToParticipant !== undefined) setFields.relationToParticipant = dto.relationToParticipant?.trim() || null;
    if (dto.formNumber !== undefined) setFields.formNumber = dto.formNumber?.trim() || null;
    if (dto.notes !== undefined) setFields.notes = dto.notes?.trim() || null;

    if (Object.keys(setFields).length === 0) return;
    await this.tdb.db
      .update(patientinsurancedetails)
      .set(setFields)
      .where(eq(patientinsurancedetails.patientInsuranceDetailId, insuranceId));

    await this.audit.record({
      action: "Update",
      entityType: "PatientInsurance",
      entityId: insuranceId,
      patientContext: patientId,
      newValues: setFields,
    });
  }

  async deleteInsurance(patientId: string, insuranceId: string): Promise<void> {
    await this.assertPatient(patientId);
    const [current] = await this.tdb.db
      .select()
      .from(patientinsurancedetails)
      .where(
        and(
          eq(patientinsurancedetails.patientInsuranceDetailId, insuranceId),
          eq(patientinsurancedetails.patientId, patientId),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundException(`Insurance ${insuranceId} not found`);

    await this.tdb.db
      .delete(patientinsurancedetails)
      .where(eq(patientinsurancedetails.patientInsuranceDetailId, insuranceId));

    await this.audit.record({
      action: "Delete",
      entityType: "PatientInsurance",
      entityId: insuranceId,
      patientContext: patientId,
      previousValues: { insuranceCompany: current.insuranceCompany },
    });
  }

  // ── Special notes ─────────────────────────────────────────────────────────

  async listNotes(patientId: string): Promise<PatientNoteDto[]> {
    await this.assertPatient(patientId);
    const rows = await this.tdb.db
      .select()
      .from(patientspecialnotes)
      .where(eq(patientspecialnotes.patientId, patientId));
    return rows.map((r) => ({ patientSpecialNoteId: r.patientSpecialNoteId, note: r.note }));
  }

  async createNote(patientId: string, dto: CreateNoteDto): Promise<{ patientSpecialNoteId: string }> {
    await this.assertPatient(patientId);
    const id = randomUUID();
    await this.tdb.db.insert(patientspecialnotes).values({
      patientSpecialNoteId: id,
      patientId,
      note: dto.note.trim(),
    });
    await this.audit.record({
      action: "Create",
      entityType: "PatientNote",
      entityId: id,
      patientContext: patientId,
      newValues: { note: dto.note },
    });
    return { patientSpecialNoteId: id };
  }

  async deleteNote(patientId: string, noteId: string): Promise<void> {
    await this.assertPatient(patientId);
    const [current] = await this.tdb.db
      .select()
      .from(patientspecialnotes)
      .where(
        and(
          eq(patientspecialnotes.patientSpecialNoteId, noteId),
          eq(patientspecialnotes.patientId, patientId),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundException(`Note ${noteId} not found`);

    await this.tdb.db
      .delete(patientspecialnotes)
      .where(eq(patientspecialnotes.patientSpecialNoteId, noteId));

    await this.audit.record({
      action: "Delete",
      entityType: "PatientNote",
      entityId: noteId,
      patientContext: patientId,
      previousValues: { note: current.note },
    });
  }
}
