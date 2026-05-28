import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  allergies,
  medicalconditions,
  patients,
} from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";
import { AuditService } from "../../common/audit/audit.service";
import type {
  AllergyListItem,
  CreateAllergyDto,
  UpdateAllergyDto,
} from "./dto/allergy.dto";

const FIELD_MAP: Record<
  Exclude<keyof UpdateAllergyDto, never>,
  { col: string; kind: "string-or-null" | "uuid-or-null" | "int-or-null" | "date-or-null" }
> = {
  medicalConditionId: { col: "medicalConditionId", kind: "uuid-or-null" },
  severity: { col: "severity", kind: "int-or-null" },
  lastOccurenceDate: { col: "lastOccurenceDate", kind: "date-or-null" },
  reaction: { col: "reaction", kind: "string-or-null" },
  treatment: { col: "treatment", kind: "string-or-null" },
};

@Injectable()
export class AllergiesService {
  constructor(
    private readonly tdb: TenantDbService,
    private readonly audit: AuditService,
  ) {}

  async list(patientId: string): Promise<AllergyListItem[]> {
    await this.assertPatientInTenant(patientId);
    const rows = await this.tdb.db
      .select({
        allergyId: allergies.allergyId,
        medicalConditionId: allergies.medicalConditionId,
        conditionName: medicalconditions.medicalConditionName,
        severity: allergies.severity,
        lastOccurenceDate: allergies.lastOccurenceDate,
        reaction: allergies.reaction,
        treatment: allergies.treatment,
      })
      .from(allergies)
      .innerJoin(
        medicalconditions,
        eq(medicalconditions.medicalConditionId, allergies.medicalConditionId),
      )
      .where(eq(allergies.patientId, patientId))
      .orderBy(asc(medicalconditions.medicalConditionName));

    return rows.map((r) => ({
      allergyId: r.allergyId,
      medicalConditionId: r.medicalConditionId,
      conditionName: r.conditionName,
      severity: r.severity ?? null,
      lastOccurenceDate: r.lastOccurenceDate ?? null,
      reaction: r.reaction ?? null,
      treatment: r.treatment ?? null,
    }));
  }

  async create(patientId: string, dto: CreateAllergyDto): Promise<{ allergyId: string }> {
    await this.assertPatientInTenant(patientId);
    const condition = await this.assertConditionExists(dto.medicalConditionId);
    const id = randomUUID();

    await this.tdb.db.insert(allergies).values({
      allergyId: id,
      patientId,
      medicalConditionId: dto.medicalConditionId,
      severity: dto.severity ?? null,
      lastOccurenceDate: normalizeDate(dto.lastOccurenceDate),
      reaction: nonEmpty(dto.reaction),
      treatment: nonEmpty(dto.treatment),
    });

    await this.audit.record({
      action: "Create",
      entityType: "PatientAllergy",
      entityId: id,
      patientContext: patientId,
      newValues: {
        medicalConditionId: dto.medicalConditionId,
        conditionName: condition.name,
        severity: dto.severity ?? null,
        lastOccurenceDate: normalizeDate(dto.lastOccurenceDate),
        reaction: nonEmpty(dto.reaction),
        treatment: nonEmpty(dto.treatment),
      },
    });

    return { allergyId: id };
  }

  async update(
    patientId: string,
    allergyId: string,
    patch: UpdateAllergyDto,
  ): Promise<void> {
    await this.assertPatientInTenant(patientId);
    const [current] = await this.tdb.db
      .select()
      .from(allergies)
      .where(and(eq(allergies.allergyId, allergyId), eq(allergies.patientId, patientId)))
      .limit(1);
    if (!current) throw new NotFoundException(`Allergy ${allergyId} not found`);

    if (patch.medicalConditionId) {
      await this.assertConditionExists(patch.medicalConditionId);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setFields: Record<string, any> = {};
    const previousValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};
    const changedFields: string[] = [];

    for (const [field, spec] of Object.entries(FIELD_MAP) as Array<
      [keyof UpdateAllergyDto, (typeof FIELD_MAP)[keyof UpdateAllergyDto]]
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
      .update(allergies)
      .set(setFields)
      .where(eq(allergies.allergyId, allergyId));

    const affected = (result as unknown as { affectedRows?: number }).affectedRows ?? null;
    if (affected !== null && affected !== 1) {
      throw new ConflictException(
        `Expected to update 1 allergy row, but ${affected} were affected`,
      );
    }

    await this.audit.record({
      action: "Update",
      entityType: "PatientAllergy",
      entityId: allergyId,
      patientContext: patientId,
      changedFields,
      previousValues,
      newValues,
    });
  }

  async delete(patientId: string, allergyId: string): Promise<void> {
    await this.assertPatientInTenant(patientId);

    const [current] = await this.tdb.db
      .select({
        a: allergies,
        conditionName: medicalconditions.medicalConditionName,
      })
      .from(allergies)
      .innerJoin(
        medicalconditions,
        eq(medicalconditions.medicalConditionId, allergies.medicalConditionId),
      )
      .where(and(eq(allergies.allergyId, allergyId), eq(allergies.patientId, patientId)))
      .limit(1);
    if (!current) throw new NotFoundException(`Allergy ${allergyId} not found`);

    // Hard delete — `allergies` has no IsDeleted column. Audit row carries the
    // pre-deletion snapshot so the trail survives.
    await this.tdb.db.delete(allergies).where(eq(allergies.allergyId, allergyId));

    const previousValues: Record<string, unknown> = {
      medicalConditionId: current.a.medicalConditionId,
      conditionName: current.conditionName,
    };
    for (const [field, spec] of Object.entries(FIELD_MAP) as Array<
      [keyof UpdateAllergyDto, (typeof FIELD_MAP)[keyof UpdateAllergyDto]]
    >) {
      if (field === "medicalConditionId") continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = (current.a as Record<string, any>)[spec.col];
      previousValues[field] = normalize(v, spec.kind);
    }

    await this.audit.record({
      action: "Delete",
      entityType: "PatientAllergy",
      entityId: allergyId,
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
    if (!row) throw new BadRequestException(`Unknown medical condition ${medicalConditionId}`);
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
    case "int-or-null": {
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
