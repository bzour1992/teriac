import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  chronicdiseases,
  medicalconditions,
  patients,
} from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";
import { AuditService } from "../../common/audit/audit.service";
import type {
  ChronicDiseaseListItem,
  CreateChronicDiseaseDto,
  UpdateChronicDiseaseDto,
} from "./dto/chronic-disease.dto";

const FIELD_MAP: Record<
  Exclude<keyof UpdateChronicDiseaseDto, never>,
  { col: string; kind: "string-or-null" | "uuid-or-null" | "int-or-null" }
> = {
  medicalConditionId: { col: "medicalConditionId", kind: "uuid-or-null" },
  yearDiagnosed: { col: "yearDiagnosed", kind: "int-or-null" },
  monthDiagnosed: { col: "monthDiagnosed", kind: "int-or-null" },
  notes: { col: "notes", kind: "string-or-null" },
};

@Injectable()
export class ChronicDiseasesService {
  constructor(
    private readonly tdb: TenantDbService,
    private readonly audit: AuditService,
  ) {}

  async list(patientId: string): Promise<ChronicDiseaseListItem[]> {
    await this.assertPatientInTenant(patientId);
    const rows = await this.tdb.db
      .select({
        chronicDiseaseId: chronicdiseases.chronicDiseaseId,
        medicalConditionId: chronicdiseases.medicalConditionId,
        conditionName: medicalconditions.medicalConditionName,
        yearDiagnosed: chronicdiseases.yearDiagnosed,
        monthDiagnosed: chronicdiseases.monthDiagnosed,
        notes: chronicdiseases.notes,
      })
      .from(chronicdiseases)
      .innerJoin(
        medicalconditions,
        eq(medicalconditions.medicalConditionId, chronicdiseases.medicalConditionId),
      )
      .where(eq(chronicdiseases.patientId, patientId))
      .orderBy(desc(chronicdiseases.yearDiagnosed), asc(medicalconditions.medicalConditionName));

    return rows.map((r) => ({
      chronicDiseaseId: r.chronicDiseaseId,
      medicalConditionId: r.medicalConditionId,
      conditionName: r.conditionName,
      yearDiagnosed: r.yearDiagnosed ?? null,
      monthDiagnosed: r.monthDiagnosed ?? null,
      notes: r.notes ?? null,
    }));
  }

  async create(
    patientId: string,
    dto: CreateChronicDiseaseDto,
  ): Promise<{ chronicDiseaseId: string }> {
    await this.assertPatientInTenant(patientId);
    const condition = await this.assertConditionExists(dto.medicalConditionId);
    const id = randomUUID();

    await this.tdb.db.insert(chronicdiseases).values({
      chronicDiseaseId: id,
      patientId,
      medicalConditionId: dto.medicalConditionId,
      yearDiagnosed: dto.yearDiagnosed ?? null,
      monthDiagnosed: dto.monthDiagnosed ?? null,
      notes: nonEmpty(dto.notes),
    });

    await this.audit.record({
      action: "Create",
      entityType: "PatientChronicDisease",
      entityId: id,
      patientContext: patientId,
      newValues: {
        medicalConditionId: dto.medicalConditionId,
        conditionName: condition.name,
        yearDiagnosed: dto.yearDiagnosed ?? null,
        monthDiagnosed: dto.monthDiagnosed ?? null,
        notes: nonEmpty(dto.notes),
      },
    });

    return { chronicDiseaseId: id };
  }

  async update(
    patientId: string,
    chronicId: string,
    patch: UpdateChronicDiseaseDto,
  ): Promise<void> {
    await this.assertPatientInTenant(patientId);
    const [current] = await this.tdb.db
      .select()
      .from(chronicdiseases)
      .where(
        and(
          eq(chronicdiseases.chronicDiseaseId, chronicId),
          eq(chronicdiseases.patientId, patientId),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundException(`Chronic disease ${chronicId} not found`);

    if (patch.medicalConditionId) {
      await this.assertConditionExists(patch.medicalConditionId);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setFields: Record<string, any> = {};
    const previousValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};
    const changedFields: string[] = [];

    for (const [field, spec] of Object.entries(FIELD_MAP) as Array<
      [keyof UpdateChronicDiseaseDto, (typeof FIELD_MAP)[keyof UpdateChronicDiseaseDto]]
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
      .update(chronicdiseases)
      .set(setFields)
      .where(eq(chronicdiseases.chronicDiseaseId, chronicId));

    const affected = (result as unknown as { affectedRows?: number }).affectedRows ?? null;
    if (affected !== null && affected !== 1) {
      throw new ConflictException(
        `Expected to update 1 chronic disease row, but ${affected} were affected`,
      );
    }

    await this.audit.record({
      action: "Update",
      entityType: "PatientChronicDisease",
      entityId: chronicId,
      patientContext: patientId,
      changedFields,
      previousValues,
      newValues,
    });
  }

  async delete(patientId: string, chronicId: string): Promise<void> {
    await this.assertPatientInTenant(patientId);

    const [current] = await this.tdb.db
      .select({
        c: chronicdiseases,
        conditionName: medicalconditions.medicalConditionName,
      })
      .from(chronicdiseases)
      .innerJoin(
        medicalconditions,
        eq(medicalconditions.medicalConditionId, chronicdiseases.medicalConditionId),
      )
      .where(
        and(
          eq(chronicdiseases.chronicDiseaseId, chronicId),
          eq(chronicdiseases.patientId, patientId),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundException(`Chronic disease ${chronicId} not found`);

    await this.tdb.db
      .delete(chronicdiseases)
      .where(eq(chronicdiseases.chronicDiseaseId, chronicId));

    const previousValues: Record<string, unknown> = {
      medicalConditionId: current.c.medicalConditionId,
      conditionName: current.conditionName,
    };
    for (const [field, spec] of Object.entries(FIELD_MAP) as Array<
      [keyof UpdateChronicDiseaseDto, (typeof FIELD_MAP)[keyof UpdateChronicDiseaseDto]]
    >) {
      if (field === "medicalConditionId") continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = (current.c as Record<string, any>)[spec.col];
      previousValues[field] = normalize(v, spec.kind);
    }

    await this.audit.record({
      action: "Delete",
      entityType: "PatientChronicDisease",
      entityId: chronicId,
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
  }
}
