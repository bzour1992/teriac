import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  medicines,
  patientlongtermmedicines,
  patients,
} from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";
import { AuditService } from "../../common/audit/audit.service";
import type {
  CreateLongTermMedicationDto,
  LongTermMedicationListItem,
  UpdateLongTermMedicationDto,
} from "./dto/long-term-medication.dto";

const FIELD_MAP: Record<
  Exclude<keyof UpdateLongTermMedicationDto, never>,
  { col: string; kind: "string-or-null" | "uuid-or-null" | "number-or-null" | "date-or-null" }
> = {
  medicineId: { col: "medicineId", kind: "uuid-or-null" },
  indication: { col: "indication", kind: "string-or-null" },
  dose: { col: "dose", kind: "string-or-null" },
  period: { col: "period", kind: "string-or-null" },
  frequency: { col: "frequency", kind: "number-or-null" },
  frequencyUnit: { col: "frequencyUnit", kind: "string-or-null" },
  quantityNumber: { col: "quantityNumber", kind: "string-or-null" },
  quantityForm: { col: "quantityForm", kind: "string-or-null" },
  route: { col: "route", kind: "string-or-null" },
  prescribedBy: { col: "prescribedBy", kind: "string-or-null" },
  prescriptionDate: { col: "prescriptionDate", kind: "date-or-null" },
  notes: { col: "notes", kind: "string-or-null" },
};

@Injectable()
export class LongTermMedicationsService {
  constructor(
    private readonly tdb: TenantDbService,
    private readonly audit: AuditService,
  ) {}

  async list(patientId: string): Promise<LongTermMedicationListItem[]> {
    await this.assertPatientInTenant(patientId);
    const rows = await this.tdb.db
      .select({
        patientLongTermMedicineId: patientlongtermmedicines.patientLongTermMedicineId,
        medicineId: patientlongtermmedicines.medicineId,
        medicineName: medicines.tradeName,
        scientificName: medicines.scientificName,
        indication: patientlongtermmedicines.indication,
        dose: patientlongtermmedicines.dose,
        period: patientlongtermmedicines.period,
        frequency: patientlongtermmedicines.frequency,
        frequencyUnit: patientlongtermmedicines.frequencyUnit,
        quantityNumber: patientlongtermmedicines.quantityNumber,
        quantityForm: patientlongtermmedicines.quantityForm,
        route: patientlongtermmedicines.route,
        prescribedBy: patientlongtermmedicines.prescribedBy,
        prescriptionDate: patientlongtermmedicines.prescriptionDate,
        notes: patientlongtermmedicines.notes,
      })
      .from(patientlongtermmedicines)
      .innerJoin(medicines, eq(medicines.medicineId, patientlongtermmedicines.medicineId))
      .where(eq(patientlongtermmedicines.patientId, patientId))
      .orderBy(
        desc(patientlongtermmedicines.prescriptionDate),
        asc(medicines.tradeName),
      );

    return rows.map((r) => ({
      patientLongTermMedicineId: r.patientLongTermMedicineId,
      medicineId: r.medicineId,
      medicineName: r.medicineName ?? r.scientificName ?? "—",
      scientificName: r.scientificName ?? null,
      indication: r.indication ?? null,
      dose: r.dose ?? null,
      period: r.period ?? null,
      frequency: r.frequency ?? null,
      frequencyUnit: r.frequencyUnit ?? null,
      quantityNumber: r.quantityNumber ?? null,
      quantityForm: r.quantityForm ?? null,
      route: r.route ?? null,
      prescribedBy: r.prescribedBy ?? null,
      prescriptionDate: r.prescriptionDate ?? null,
      notes: r.notes ?? null,
    }));
  }

  async create(
    patientId: string,
    dto: CreateLongTermMedicationDto,
  ): Promise<{ patientLongTermMedicineId: string }> {
    await this.assertPatientInTenant(patientId);
    const med = await this.assertMedicineExists(dto.medicineId);
    const id = randomUUID();

    await this.tdb.db.insert(patientlongtermmedicines).values({
      patientLongTermMedicineId: id,
      patientId,
      medicineId: dto.medicineId,
      indication: nonEmpty(dto.indication),
      dose: nonEmpty(dto.dose),
      period: nonEmpty(dto.period),
      frequency: dto.frequency ?? null,
      frequencyUnit: nonEmpty(dto.frequencyUnit),
      quantityNumber: nonEmpty(dto.quantityNumber),
      quantityForm: nonEmpty(dto.quantityForm),
      route: nonEmpty(dto.route),
      prescribedBy: nonEmpty(dto.prescribedBy),
      prescriptionDate: normalizeDate(dto.prescriptionDate),
      notes: nonEmpty(dto.notes),
    });

    await this.audit.record({
      action: "Create",
      entityType: "PatientLongTermMedication",
      entityId: id,
      patientContext: patientId,
      newValues: {
        medicineId: dto.medicineId,
        medicineName: med.tradeName ?? med.scientificName ?? null,
        indication: nonEmpty(dto.indication),
        dose: nonEmpty(dto.dose),
        period: nonEmpty(dto.period),
        frequency: dto.frequency ?? null,
        frequencyUnit: nonEmpty(dto.frequencyUnit),
        quantityNumber: nonEmpty(dto.quantityNumber),
        quantityForm: nonEmpty(dto.quantityForm),
        route: nonEmpty(dto.route),
        prescribedBy: nonEmpty(dto.prescribedBy),
        prescriptionDate: normalizeDate(dto.prescriptionDate),
        notes: nonEmpty(dto.notes),
      },
    });

    return { patientLongTermMedicineId: id };
  }

  async update(
    patientId: string,
    medicationId: string,
    patch: UpdateLongTermMedicationDto,
  ): Promise<void> {
    await this.assertPatientInTenant(patientId);
    const [current] = await this.tdb.db
      .select()
      .from(patientlongtermmedicines)
      .where(
        and(
          eq(patientlongtermmedicines.patientLongTermMedicineId, medicationId),
          eq(patientlongtermmedicines.patientId, patientId),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundException(`Long-term medication ${medicationId} not found`);

    if (patch.medicineId) {
      await this.assertMedicineExists(patch.medicineId);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setFields: Record<string, any> = {};
    const previousValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};
    const changedFields: string[] = [];

    for (const [field, spec] of Object.entries(FIELD_MAP) as Array<
      [keyof UpdateLongTermMedicationDto, (typeof FIELD_MAP)[keyof UpdateLongTermMedicationDto]]
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
      .update(patientlongtermmedicines)
      .set(setFields)
      .where(eq(patientlongtermmedicines.patientLongTermMedicineId, medicationId));

    const affected = (result as unknown as { affectedRows?: number }).affectedRows ?? null;
    if (affected !== null && affected !== 1) {
      throw new ConflictException(
        `Expected to update 1 long-term medication row, but ${affected} were affected`,
      );
    }

    await this.audit.record({
      action: "Update",
      entityType: "PatientLongTermMedication",
      entityId: medicationId,
      patientContext: patientId,
      changedFields,
      previousValues,
      newValues,
    });
  }

  async delete(patientId: string, medicationId: string): Promise<void> {
    await this.assertPatientInTenant(patientId);

    const [current] = await this.tdb.db
      .select({
        m: patientlongtermmedicines,
        medicineName: medicines.tradeName,
        scientificName: medicines.scientificName,
      })
      .from(patientlongtermmedicines)
      .innerJoin(medicines, eq(medicines.medicineId, patientlongtermmedicines.medicineId))
      .where(
        and(
          eq(patientlongtermmedicines.patientLongTermMedicineId, medicationId),
          eq(patientlongtermmedicines.patientId, patientId),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundException(`Long-term medication ${medicationId} not found`);

    // Hard delete — table has no IsDeleted column. Audit retains the snapshot.
    await this.tdb.db
      .delete(patientlongtermmedicines)
      .where(eq(patientlongtermmedicines.patientLongTermMedicineId, medicationId));

    const previousValues: Record<string, unknown> = {
      medicineId: current.m.medicineId,
      medicineName: current.medicineName ?? current.scientificName ?? null,
    };
    for (const [field, spec] of Object.entries(FIELD_MAP) as Array<
      [keyof UpdateLongTermMedicationDto, (typeof FIELD_MAP)[keyof UpdateLongTermMedicationDto]]
    >) {
      if (field === "medicineId") continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = (current.m as Record<string, any>)[spec.col];
      previousValues[field] = normalize(v, spec.kind);
    }

    await this.audit.record({
      action: "Delete",
      entityType: "PatientLongTermMedication",
      entityId: medicationId,
      patientContext: patientId,
      previousValues,
    });
  }

  // ---- guards ----

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

  private async assertMedicineExists(
    medicineId: string,
  ): Promise<{ id: string; tradeName: string | null; scientificName: string | null }> {
    const [row] = await this.tdb.db
      .select({
        id: medicines.medicineId,
        tradeName: medicines.tradeName,
        scientificName: medicines.scientificName,
      })
      .from(medicines)
      .where(eq(medicines.medicineId, medicineId))
      .limit(1);
    if (!row) throw new BadRequestException(`Unknown medicine ${medicineId}`);
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
  const t = String(s).trim();
  if (t.length === 0) return null;
  if (t.includes("T") || t.includes(" ")) return t;
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
    case "number-or-null": {
      if (value === null) return null;
      const n = Number(value);
      return Number.isNaN(n) ? null : n;
    }
    case "date-or-null": {
      if (value === null) return null;
      const t = String(value);
      if (t.length === 0) return null;
      const date = new Date(t.includes(" ") ? t.replace(" ", "T") + "Z" : t);
      return Number.isNaN(date.getTime()) ? t : date.toISOString();
    }
  }
}
