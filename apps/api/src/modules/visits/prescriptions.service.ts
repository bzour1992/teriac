import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  patientvisits,
  patients,
  pvplanmedications,
  pvassessmentconditions,
  medicines,
} from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";
import { TenantContextService } from "../../common/tenant/tenant-context";
import { AuditService } from "../../common/audit/audit.service";
import type {
  CreatePrescriptionDto,
  UpdatePrescriptionDto,
} from "./dto/prescription.dto";

// Map DTO key → DB column name + normaliser kind.
// Drizzle exposes columns with their introspect-derived camelCase names — those
// match the DB columns 1:1 here.
const FIELD_MAP: Record<
  Exclude<keyof UpdatePrescriptionDto, never>,
  { col: string; kind: "string-or-null" | "uuid-or-null" | "number-or-null" | "bool" }
> = {
  medicineId: { col: "medicineId", kind: "uuid-or-null" },
  pvAssessmentConditionId: { col: "pvAssessmentConditionId", kind: "uuid-or-null" },
  indication: { col: "indication", kind: "string-or-null" },
  dose: { col: "dose", kind: "string-or-null" },
  period: { col: "period", kind: "string-or-null" },
  frequency: { col: "frequency", kind: "number-or-null" },
  frequencyUnit: { col: "frequencyUnit", kind: "string-or-null" },
  quantityNumber: { col: "quantityNumber", kind: "string-or-null" },
  quantityForm: { col: "quantityForm", kind: "string-or-null" },
  route: { col: "route", kind: "string-or-null" },
  notes: { col: "notes", kind: "string-or-null" },
  isPrescribed: { col: "isPrescribed", kind: "bool" },
};

interface VisitContext {
  patientVisitId: string;
  patientId: string;
}

@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly tdb: TenantDbService,
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  async create(
    patientVisitId: string,
    dto: CreatePrescriptionDto,
  ): Promise<{ pvPlanMedicationId: string }> {
    const visit = await this.assertVisitInTenant(patientVisitId);
    await this.assertMedicineExists(dto.medicineId);
    if (dto.pvAssessmentConditionId) {
      await this.assertAssessmentConditionOnVisit(visit.patientVisitId, dto.pvAssessmentConditionId);
    }

    const id = randomUUID();
    const isPrescribed = dto.isPrescribed ?? true;
    const now = sql`CURRENT_TIMESTAMP(3)`;

    await this.tdb.db.insert(pvplanmedications).values({
      pvPlanMedicationId: id,
      patientVisitId: visit.patientVisitId,
      medicineId: dto.medicineId,
      pvAssessmentConditionId: dto.pvAssessmentConditionId ?? null,
      indication: dto.indication ?? null,
      dose: dto.dose ?? null,
      period: dto.period ?? null,
      frequency: dto.frequency ?? null,
      frequencyUnit: dto.frequencyUnit ?? null,
      quantityNumber: dto.quantityNumber ?? null,
      quantityForm: dto.quantityForm ?? null,
      route: dto.route ?? null,
      notes: dto.notes ?? null,
      prescribedBy: isPrescribed ? this.tenant.userId : null,
      prescriptionDate: isPrescribed ? (now as unknown as string) : null,
      suggestedBy: isPrescribed ? null : this.tenant.userId,
      suggestionDate: isPrescribed ? null : (now as unknown as string),
      isPrescribed: isPrescribed ? 1 : 0,
    });

    await this.audit.record({
      action: "Create",
      entityType: "PatientVisitPrescription",
      entityId: id,
      patientContext: visit.patientId,
      newValues: {
        medicineId: dto.medicineId,
        pvAssessmentConditionId: dto.pvAssessmentConditionId ?? null,
        indication: dto.indication ?? null,
        dose: dto.dose ?? null,
        period: dto.period ?? null,
        frequency: dto.frequency ?? null,
        frequencyUnit: dto.frequencyUnit ?? null,
        quantityNumber: dto.quantityNumber ?? null,
        quantityForm: dto.quantityForm ?? null,
        route: dto.route ?? null,
        notes: dto.notes ?? null,
        isPrescribed,
      },
    });

    return { pvPlanMedicationId: id };
  }

  async update(
    patientVisitId: string,
    rxId: string,
    patch: UpdatePrescriptionDto,
  ): Promise<void> {
    const visit = await this.assertVisitInTenant(patientVisitId);

    const [current] = await this.tdb.db
      .select()
      .from(pvplanmedications)
      .where(
        and(
          eq(pvplanmedications.pvPlanMedicationId, rxId),
          eq(pvplanmedications.patientVisitId, visit.patientVisitId),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundException(`Prescription ${rxId} not found`);

    if (patch.medicineId) {
      await this.assertMedicineExists(patch.medicineId);
    }
    if (patch.pvAssessmentConditionId) {
      await this.assertAssessmentConditionOnVisit(
        visit.patientVisitId,
        patch.pvAssessmentConditionId,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setFields: Record<string, any> = {};
    const previousValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};
    const changedFields: string[] = [];

    for (const [field, spec] of Object.entries(FIELD_MAP) as Array<
      [keyof UpdatePrescriptionDto, (typeof FIELD_MAP)[keyof UpdatePrescriptionDto]]
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

    // If toggling isPrescribed we should also update the prescribedBy/suggestedBy
    // bookkeeping columns so the lineage stays correct.
    if ("isPrescribed" in setFields) {
      const isPrescribed = !!setFields["isPrescribed"];
      setFields.prescribedBy = isPrescribed ? this.tenant.userId : null;
      setFields.prescriptionDate = isPrescribed ? sql`CURRENT_TIMESTAMP(3)` : null;
      setFields.suggestedBy = isPrescribed ? null : this.tenant.userId;
      setFields.suggestionDate = isPrescribed ? null : sql`CURRENT_TIMESTAMP(3)`;
    }

    const result = await this.tdb.db
      .update(pvplanmedications)
      .set(setFields)
      .where(eq(pvplanmedications.pvPlanMedicationId, rxId));

    const affected = (result as unknown as { affectedRows?: number }).affectedRows ?? null;
    if (affected !== null && affected !== 1) {
      throw new ConflictException(
        `Expected to update 1 prescription row, but ${affected} were affected`,
      );
    }

    await this.audit.record({
      action: "Update",
      entityType: "PatientVisitPrescription",
      entityId: rxId,
      patientContext: visit.patientId,
      changedFields,
      previousValues,
      newValues,
    });
  }

  async delete(patientVisitId: string, rxId: string): Promise<void> {
    const visit = await this.assertVisitInTenant(patientVisitId);

    const [current] = await this.tdb.db
      .select()
      .from(pvplanmedications)
      .where(
        and(
          eq(pvplanmedications.pvPlanMedicationId, rxId),
          eq(pvplanmedications.patientVisitId, visit.patientVisitId),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundException(`Prescription ${rxId} not found`);

    await this.tdb.db
      .delete(pvplanmedications)
      .where(eq(pvplanmedications.pvPlanMedicationId, rxId));

    // Capture the deleted row for audit. We pluck the meaningful fields so
    // the audit row doesn't carry the opaque __sys* columns.
    const previousValues: Record<string, unknown> = {};
    for (const [field, spec] of Object.entries(FIELD_MAP) as Array<
      [keyof UpdatePrescriptionDto, (typeof FIELD_MAP)[keyof UpdatePrescriptionDto]]
    >) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = (current as Record<string, any>)[spec.col];
      previousValues[field] = normalize(v, spec.kind);
    }

    await this.audit.record({
      action: "Delete",
      entityType: "PatientVisitPrescription",
      entityId: rxId,
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

  private async assertMedicineExists(medicineId: string): Promise<void> {
    const [row] = await this.tdb.db
      .select({ id: medicines.medicineId })
      .from(medicines)
      .where(eq(medicines.medicineId, medicineId))
      .limit(1);
    if (!row) throw new BadRequestException(`Unknown medicine ${medicineId}`);
  }

  private async assertAssessmentConditionOnVisit(
    visitId: string,
    assessmentConditionId: string,
  ): Promise<void> {
    const [row] = await this.tdb.db
      .select({ id: pvassessmentconditions.pvAssessmentConditionId })
      .from(pvassessmentconditions)
      .where(
        and(
          eq(pvassessmentconditions.pvAssessmentConditionId, assessmentConditionId),
          eq(pvassessmentconditions.patientVisitId, visitId),
          eq(pvassessmentconditions.isDeleted, 0),
        ),
      )
      .limit(1);
    if (!row) {
      throw new BadRequestException(
        `Diagnosis ${assessmentConditionId} does not belong to this visit`,
      );
    }
  }
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
    case "number-or-null": {
      if (value === null) return null;
      const n = Number(value);
      return Number.isNaN(n) ? null : n;
    }
    case "bool": {
      if (value === null || value === undefined) return 0;
      // Drizzle returns tinyint(1) as 0/1 numbers. Coerce to 0|1 here so both
      // sides of the diff compare cleanly.
      return value ? 1 : 0;
    }
  }
}
