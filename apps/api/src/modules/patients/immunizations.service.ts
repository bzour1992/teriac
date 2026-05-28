import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  immunizationsvaccines,
  patientimmunizations,
  patients,
} from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";
import { AuditService } from "../../common/audit/audit.service";
import type {
  CreateImmunizationDto,
  ImmunizationListItem,
} from "./dto/immunization.dto";

@Injectable()
export class ImmunizationsService {
  constructor(
    private readonly tdb: TenantDbService,
    private readonly audit: AuditService,
  ) {}

  async list(patientId: string): Promise<ImmunizationListItem[]> {
    await this.assertPatientInTenant(patientId);

    const rows = await this.tdb.db
      .select({
        patientImmunizationId: patientimmunizations.patientImmunizationId,
        immunizationsVaccineId: patientimmunizations.immunizationsVaccineId,
        vaccineName: immunizationsvaccines.immunizationsVaccineName,
        vaccineType: patientimmunizations.vaccineType,
        dose: patientimmunizations.dose,
        ageAdministered: patientimmunizations.ageAdministered,
        dateAdministered: patientimmunizations.dateAdministered,
        lotNumber: patientimmunizations.lotNumber,
        physician: patientimmunizations.physician,
      })
      .from(patientimmunizations)
      .innerJoin(
        immunizationsvaccines,
        eq(immunizationsvaccines.immunizationsVaccineId, patientimmunizations.immunizationsVaccineId),
      )
      .where(eq(patientimmunizations.patientId, patientId))
      .orderBy(asc(patientimmunizations.dateAdministered));

    return rows.map((r) => ({
      patientImmunizationId: r.patientImmunizationId,
      immunizationsVaccineId: r.immunizationsVaccineId,
      vaccineName: r.vaccineName,
      vaccineType: r.vaccineType ?? null,
      dose: r.dose ?? null,
      ageAdministered: r.ageAdministered ?? null,
      dateAdministered: r.dateAdministered ?? null,
      lotNumber: r.lotNumber ?? null,
      physician: r.physician ?? null,
    }));
  }

  async create(
    patientId: string,
    dto: CreateImmunizationDto,
  ): Promise<{ patientImmunizationId: string }> {
    await this.assertPatientInTenant(patientId);
    const vaccine = await this.assertVaccineExists(dto.immunizationsVaccineId);

    const id = randomUUID();
    await this.tdb.db.insert(patientimmunizations).values({
      patientImmunizationId: id,
      patientId,
      immunizationsVaccineId: dto.immunizationsVaccineId,
      vaccineType: dto.vaccineType?.trim() ?? null,
      dose: dto.dose?.trim() ?? null,
      ageAdministered: dto.ageAdministered?.trim() ?? null,
      dateAdministered: normalizeDate(dto.dateAdministered),
      lotNumber: dto.lotNumber?.trim() ?? null,
      physician: dto.physician?.trim() ?? null,
    });

    await this.audit.record({
      action: "Create",
      entityType: "PatientImmunization",
      entityId: id,
      patientContext: patientId,
      newValues: {
        vaccineId: dto.immunizationsVaccineId,
        vaccineName: vaccine.name,
        dose: dto.dose ?? null,
        dateAdministered: normalizeDate(dto.dateAdministered),
      },
    });

    return { patientImmunizationId: id };
  }

  async delete(patientId: string, immunizationId: string): Promise<void> {
    await this.assertPatientInTenant(patientId);

    const [current] = await this.tdb.db
      .select({
        row: patientimmunizations,
        vaccineName: immunizationsvaccines.immunizationsVaccineName,
      })
      .from(patientimmunizations)
      .innerJoin(
        immunizationsvaccines,
        eq(immunizationsvaccines.immunizationsVaccineId, patientimmunizations.immunizationsVaccineId),
      )
      .where(
        and(
          eq(patientimmunizations.patientImmunizationId, immunizationId),
          eq(patientimmunizations.patientId, patientId),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundException(`Immunization ${immunizationId} not found`);

    await this.tdb.db
      .delete(patientimmunizations)
      .where(eq(patientimmunizations.patientImmunizationId, immunizationId));

    await this.audit.record({
      action: "Delete",
      entityType: "PatientImmunization",
      entityId: immunizationId,
      patientContext: patientId,
      previousValues: {
        vaccineId: current.row.immunizationsVaccineId,
        vaccineName: current.vaccineName,
        dose: current.row.dose,
        dateAdministered: current.row.dateAdministered,
      },
    });
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

  private async assertVaccineExists(vaccineId: string): Promise<{ name: string }> {
    const [row] = await this.tdb.db
      .select({ name: immunizationsvaccines.immunizationsVaccineName })
      .from(immunizationsvaccines)
      .where(eq(immunizationsvaccines.immunizationsVaccineId, vaccineId))
      .limit(1);
    if (!row) throw new BadRequestException(`Unknown vaccine ${vaccineId}`);
    return row;
  }
}

function normalizeDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = String(s).trim();
  return t.length === 0 ? null : t;
}
