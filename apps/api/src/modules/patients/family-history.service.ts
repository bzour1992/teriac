import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  medicalconditions,
  patients,
  pfihereditarydiseases,
} from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";
import { AuditService } from "../../common/audit/audit.service";
import type { CreateFamilyHistoryDto, FamilyHistoryItem } from "./dto/family-history.dto";

@Injectable()
export class FamilyHistoryService {
  constructor(
    private readonly tdb: TenantDbService,
    private readonly audit: AuditService,
  ) {}

  async list(patientId: string): Promise<FamilyHistoryItem[]> {
    await this.assertPatientInTenant(patientId);

    const rows = await this.tdb.db
      .select({
        pfiHereditaryDiseasesId: pfihereditarydiseases.pfiHereditaryDiseases,
        medicalConditionId: pfihereditarydiseases.medicalConditionId,
        conditionName: medicalconditions.medicalConditionName,
        description: pfihereditarydiseases.description,
      })
      .from(pfihereditarydiseases)
      .innerJoin(
        medicalconditions,
        eq(medicalconditions.medicalConditionId, pfihereditarydiseases.medicalConditionId),
      )
      .where(eq(pfihereditarydiseases.patientId, patientId))
      .orderBy(asc(medicalconditions.medicalConditionName));

    return rows.map((r) => ({
      pfiHereditaryDiseasesId: r.pfiHereditaryDiseasesId,
      medicalConditionId: r.medicalConditionId,
      conditionName: r.conditionName,
      description: r.description ?? null,
    }));
  }

  async create(
    patientId: string,
    dto: CreateFamilyHistoryDto,
  ): Promise<{ pfiHereditaryDiseasesId: string }> {
    await this.assertPatientInTenant(patientId);
    const condition = await this.assertConditionExists(dto.medicalConditionId);

    const id = randomUUID();
    await this.tdb.db.insert(pfihereditarydiseases).values({
      pfiHereditaryDiseases: id,
      patientId,
      medicalConditionId: dto.medicalConditionId,
      description: dto.description?.trim() ?? null,
    });

    await this.audit.record({
      action: "Create",
      entityType: "FamilyHistory",
      entityId: id,
      patientContext: patientId,
      newValues: {
        medicalConditionId: dto.medicalConditionId,
        conditionName: condition.name,
        description: dto.description ?? null,
      },
    });

    return { pfiHereditaryDiseasesId: id };
  }

  async delete(patientId: string, itemId: string): Promise<void> {
    await this.assertPatientInTenant(patientId);

    const [current] = await this.tdb.db
      .select({
        row: pfihereditarydiseases,
        conditionName: medicalconditions.medicalConditionName,
      })
      .from(pfihereditarydiseases)
      .innerJoin(
        medicalconditions,
        eq(medicalconditions.medicalConditionId, pfihereditarydiseases.medicalConditionId),
      )
      .where(
        and(
          eq(pfihereditarydiseases.pfiHereditaryDiseases, itemId),
          eq(pfihereditarydiseases.patientId, patientId),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundException(`Family history item ${itemId} not found`);

    await this.tdb.db
      .delete(pfihereditarydiseases)
      .where(eq(pfihereditarydiseases.pfiHereditaryDiseases, itemId));

    await this.audit.record({
      action: "Delete",
      entityType: "FamilyHistory",
      entityId: itemId,
      patientContext: patientId,
      previousValues: {
        medicalConditionId: current.row.medicalConditionId,
        conditionName: current.conditionName,
        description: current.row.description,
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

  private async assertConditionExists(
    medicalConditionId: string,
  ): Promise<{ name: string }> {
    const [row] = await this.tdb.db
      .select({ name: medicalconditions.medicalConditionName })
      .from(medicalconditions)
      .where(eq(medicalconditions.medicalConditionId, medicalConditionId))
      .limit(1);
    if (!row) throw new BadRequestException(`Unknown medical condition ${medicalConditionId}`);
    return row;
  }
}
