import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  patientvisits,
  patients,
  pvassessmentconditions,
  medicalconditions,
  pvplanmedications,
} from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";
import { AuditService } from "../../common/audit/audit.service";
import type { CreateDiagnosisDto, UpdateDiagnosisDto } from "./dto/diagnosis.dto";

// Maps DTO field → DB column.
const FIELD_MAP: Record<
  Exclude<keyof UpdateDiagnosisDto, never>,
  { col: string; kind: "string-or-null" | "uuid-or-null" | "date-or-null" }
> = {
  medicalConditionId: { col: "medicalConditionId", kind: "uuid-or-null" },
  dateDiagnosed: { col: "dateDiagnosed", kind: "date-or-null" },
  ageOfOnset: { col: "ageOfOnset", kind: "string-or-null" },
  conditionStatus: { col: "conditionStatus", kind: "string-or-null" },
  comments: { col: "comments", kind: "string-or-null" },
};

interface VisitContext {
  patientVisitId: string;
  patientId: string;
}

@Injectable()
export class DiagnosesService {
  constructor(
    private readonly tdb: TenantDbService,
    private readonly audit: AuditService,
  ) {}

  async create(
    patientVisitId: string,
    dto: CreateDiagnosisDto,
  ): Promise<{ pvAssessmentConditionId: string }> {
    const visit = await this.assertVisitInTenant(patientVisitId);
    const condition = await this.assertConditionExists(dto.medicalConditionId);

    const id = randomUUID();

    await this.tdb.db.insert(pvassessmentconditions).values({
      pvAssessmentConditionId: id,
      patientVisitId: visit.patientVisitId,
      medicalConditionId: dto.medicalConditionId,
      dateDiagnosed: normalizeDate(dto.dateDiagnosed),
      ageOfOnset: nonEmpty(dto.ageOfOnset),
      conditionStatus: nonEmpty(dto.conditionStatus),
      comments: nonEmpty(dto.comments),
      isDeleted: 0,
    });

    await this.audit.record({
      action: "Create",
      entityType: "PatientVisitDiagnosis",
      entityId: id,
      patientContext: visit.patientId,
      newValues: {
        medicalConditionId: dto.medicalConditionId,
        conditionName: condition.name,
        dateDiagnosed: normalizeDate(dto.dateDiagnosed),
        ageOfOnset: nonEmpty(dto.ageOfOnset),
        conditionStatus: nonEmpty(dto.conditionStatus),
        comments: nonEmpty(dto.comments),
      },
    });

    return { pvAssessmentConditionId: id };
  }

  async update(
    patientVisitId: string,
    dxId: string,
    patch: UpdateDiagnosisDto,
  ): Promise<void> {
    const visit = await this.assertVisitInTenant(patientVisitId);

    const [current] = await this.tdb.db
      .select()
      .from(pvassessmentconditions)
      .where(
        and(
          eq(pvassessmentconditions.pvAssessmentConditionId, dxId),
          eq(pvassessmentconditions.patientVisitId, visit.patientVisitId),
          eq(pvassessmentconditions.isDeleted, 0),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundException(`Diagnosis ${dxId} not found`);

    if (patch.medicalConditionId) {
      await this.assertConditionExists(patch.medicalConditionId);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setFields: Record<string, any> = {};
    const previousValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};
    const changedFields: string[] = [];

    for (const [field, spec] of Object.entries(FIELD_MAP) as Array<
      [keyof UpdateDiagnosisDto, (typeof FIELD_MAP)[keyof UpdateDiagnosisDto]]
    >) {
      const incoming = patch[field];
      if (incoming === undefined) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = (current as Record<string, any>)[spec.col];
      const a = normalize(incoming, spec.kind);
      const b = normalize(existing, spec.kind);
      if (a === b) continue;
      setFields[spec.col] = a;
      previousValues[field] = b;
      newValues[field] = a;
      changedFields.push(field);
    }

    if (changedFields.length === 0) return;

    const result = await this.tdb.db
      .update(pvassessmentconditions)
      .set(setFields)
      .where(eq(pvassessmentconditions.pvAssessmentConditionId, dxId));

    const affected = (result as unknown as { affectedRows?: number }).affectedRows ?? null;
    if (affected !== null && affected !== 1) {
      throw new ConflictException(
        `Expected to update 1 diagnosis row, but ${affected} were affected`,
      );
    }

    await this.audit.record({
      action: "Update",
      entityType: "PatientVisitDiagnosis",
      entityId: dxId,
      patientContext: visit.patientId,
      changedFields,
      previousValues,
      newValues,
    });
  }

  async delete(patientVisitId: string, dxId: string): Promise<void> {
    const visit = await this.assertVisitInTenant(patientVisitId);

    // Pull the row with condition name for audit, also verify it's on this visit.
    const [current] = await this.tdb.db
      .select({
        dx: pvassessmentconditions,
        conditionName: medicalconditions.medicalConditionName,
      })
      .from(pvassessmentconditions)
      .innerJoin(
        medicalconditions,
        eq(medicalconditions.medicalConditionId, pvassessmentconditions.medicalConditionId),
      )
      .where(
        and(
          eq(pvassessmentconditions.pvAssessmentConditionId, dxId),
          eq(pvassessmentconditions.patientVisitId, visit.patientVisitId),
          eq(pvassessmentconditions.isDeleted, 0),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundException(`Diagnosis ${dxId} not found`);

    // If any plan medication still references this diagnosis, clear the link
    // before soft-deleting so the join in visit detail doesn't dangle.
    await this.tdb.db
      .update(pvplanmedications)
      .set({ pvAssessmentConditionId: null })
      .where(eq(pvplanmedications.pvAssessmentConditionId, dxId));

    // Soft delete — pvassessmentconditions has IsDeleted column.
    const result = await this.tdb.db
      .update(pvassessmentconditions)
      .set({ isDeleted: 1 })
      .where(eq(pvassessmentconditions.pvAssessmentConditionId, dxId));

    const affected = (result as unknown as { affectedRows?: number }).affectedRows ?? null;
    if (affected !== null && affected !== 1) {
      throw new ConflictException(
        `Expected to soft-delete 1 diagnosis row, but ${affected} were affected`,
      );
    }

    const previousValues: Record<string, unknown> = {
      medicalConditionId: current.dx.medicalConditionId,
      conditionName: current.conditionName,
    };
    for (const [field, spec] of Object.entries(FIELD_MAP) as Array<
      [keyof UpdateDiagnosisDto, (typeof FIELD_MAP)[keyof UpdateDiagnosisDto]]
    >) {
      if (field === "medicalConditionId") continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = (current.dx as Record<string, any>)[spec.col];
      previousValues[field] = normalize(v, spec.kind);
    }

    await this.audit.record({
      action: "Delete",
      entityType: "PatientVisitDiagnosis",
      entityId: dxId,
      patientContext: visit.patientId,
      previousValues,
    });
  }

  // ---- guards ----

  private async assertVisitInTenant(patientVisitId: string): Promise<VisitContext> {
    const [row] = await this.tdb.db
      .select({ vid: patientvisits.patientVisitId, pid: patients.patientId })
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
    if (!row) throw new NotFoundException(`Visit ${patientVisitId} not found`);
    return { patientVisitId: row.vid, patientId: row.pid };
  }

  private async assertConditionExists(
    medicalConditionId: string,
  ): Promise<{ id: string; name: string }> {
    const [row] = await this.tdb.db
      .select({
        id: medicalconditions.medicalConditionId,
        name: medicalconditions.medicalConditionName,
      })
      .from(medicalconditions)
      .where(eq(medicalconditions.medicalConditionId, medicalConditionId))
      .limit(1);
    if (!row) {
      throw new BadRequestException(`Unknown medical condition ${medicalConditionId}`);
    }
    return row;
  }
}

function nonEmpty(s: string | null | undefined): string | null {
  if (s === null || s === undefined) return null;
  const t = String(s).trim();
  return t.length === 0 ? null : t;
}

function normalizeDate(s: string | null | undefined): string | null {
  if (!s) return null;
  // class-validator accepts ISO date or datetime; we store as MariaDB datetime(3).
  const t = String(s).trim();
  if (t.length === 0) return null;
  // Already includes time component → store verbatim.
  if (t.includes("T") || t.includes(" ")) return t;
  // Date-only → pin to midnight UTC.
  return `${t}T00:00:00.000Z`;
}

function normalize(value: unknown, kind: (typeof FIELD_MAP)[keyof typeof FIELD_MAP]["kind"]): unknown {
  if (value === undefined) return null;
  switch (kind) {
    case "string-or-null":
    case "uuid-or-null": {
      if (value === null) return null;
      const s = String(value);
      return s.length === 0 ? null : s;
    }
    case "date-or-null": {
      if (value === null) return null;
      const t = String(value);
      if (t.length === 0) return null;
      // mysql2 returns dates as JS Date when mode=string is not set, or as
      // 'YYYY-MM-DD HH:MM:SS.fff' strings via Drizzle's datetime mode='string'.
      // Normalise to ISO so prev/new comparisons are stable.
      const date = new Date(t.includes(" ") ? t.replace(" ", "T") + "Z" : t);
      return Number.isNaN(date.getTime()) ? t : date.toISOString();
    }
  }
}
