import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { hcenters, hcenterspecialities, specialities } from "../../db/schema";
import { DRIZZLE, type Db } from "../../db/tokens";
import { AuditService } from "../../common/audit/audit.service";
import type {
  AddClinicSpecialtyDto,
  ClinicSpecialty,
  CreateMasterSpecialtyDto,
  MasterSpecialty,
  UpdateMasterSpecialtyDto,
} from "./dto/superadmin.dto";

@Injectable()
export class SpecialtiesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  // ── Master specialties (global) ───────────────────────────────────────────

  async listMaster(): Promise<MasterSpecialty[]> {
    const rows = await this.db.select().from(specialities).orderBy(asc(specialities.specialityName));
    return rows.map((r) => ({
      specialityId: r.specialityId,
      specialityName: r.specialityName,
      description: r.description ?? null,
      specialtyGroup: r.specialtyGroup,
    }));
  }

  async createMaster(dto: CreateMasterSpecialtyDto): Promise<{ specialityId: string }> {
    const id = randomUUID();
    await this.db.insert(specialities).values({
      specialityId: id,
      specialityName: dto.specialityName,
      description: dto.description?.trim() || null,
      specialtyGroup: dto.specialtyGroup,
    });
    await this.audit.record({
      action: "Create",
      entityType: "MasterSpecialty",
      entityId: id,
      patientContext: null,
      newValues: { specialityName: dto.specialityName },
    });
    return { specialityId: id };
  }

  async updateMaster(id: string, dto: UpdateMasterSpecialtyDto): Promise<void> {
    const [current] = await this.db.select().from(specialities).where(eq(specialities.specialityId, id)).limit(1);
    if (!current) throw new NotFoundException(`Specialty ${id} not found`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setFields: Record<string, any> = {};
    if (dto.specialityName !== undefined) setFields.specialityName = dto.specialityName;
    if (dto.description !== undefined) setFields.description = dto.description?.trim() || null;
    if (dto.specialtyGroup !== undefined) setFields.specialtyGroup = dto.specialtyGroup;
    if (Object.keys(setFields).length === 0) return;
    await this.db.update(specialities).set(setFields).where(eq(specialities.specialityId, id));
    await this.audit.record({
      action: "Update", entityType: "MasterSpecialty", entityId: id,
      patientContext: null, newValues: setFields,
    });
  }

  // ── Clinic specialties ────────────────────────────────────────────────────

  async listForClinic(clinicId: string): Promise<ClinicSpecialty[]> {
    await this.assertClinic(clinicId);
    const rows = await this.db
      .select({
        hcenterSpecialityId: hcenterspecialities.hcenterSpecialityId,
        specialityId: hcenterspecialities.specialityId,
        specialityName: specialities.specialityName,
        defaultPayment: hcenterspecialities.defaultPayment,
        showOnProfile: hcenterspecialities.showOnProfile,
      })
      .from(hcenterspecialities)
      .innerJoin(specialities, eq(specialities.specialityId, hcenterspecialities.specialityId))
      .where(eq(hcenterspecialities.hcenterId, clinicId))
      .orderBy(asc(specialities.specialityName));
    return rows.map((r) => ({
      hcenterSpecialityId: r.hcenterSpecialityId,
      specialityId: r.specialityId,
      specialityName: r.specialityName,
      defaultPayment: r.defaultPayment ?? null,
      showOnProfile: r.showOnProfile === 1,
    }));
  }

  async addToClinic(
    clinicId: string,
    dto: AddClinicSpecialtyDto,
  ): Promise<{ hcenterSpecialityId: string }> {
    await this.assertClinic(clinicId);
    // Validate master specialty exists
    const [sp] = await this.db.select({ id: specialities.specialityId }).from(specialities)
      .where(eq(specialities.specialityId, dto.specialityId)).limit(1);
    if (!sp) throw new BadRequestException(`Specialty ${dto.specialityId} not found`);

    // Don't double-add
    const [existing] = await this.db.select().from(hcenterspecialities)
      .where(and(eq(hcenterspecialities.hcenterId, clinicId), eq(hcenterspecialities.specialityId, dto.specialityId)))
      .limit(1);
    if (existing) throw new ConflictException("Specialty already added to this clinic");

    const id = randomUUID();
    await this.db.insert(hcenterspecialities).values({
      hcenterSpecialityId: id,
      hcenterId: clinicId,
      specialityId: dto.specialityId,
      defaultPayment: dto.defaultPayment ?? null,
      showOnProfile: dto.showOnProfile !== false ? 1 : 0,
    });
    await this.audit.record({
      action: "Create", entityType: "ClinicSpecialty", entityId: id,
      patientContext: null, newValues: { clinicId, specialityId: dto.specialityId },
    });
    return { hcenterSpecialityId: id };
  }

  async removeFromClinic(clinicId: string, hcenterSpecialityId: string): Promise<void> {
    await this.assertClinic(clinicId);
    const [current] = await this.db.select().from(hcenterspecialities)
      .where(and(
        eq(hcenterspecialities.hcenterSpecialityId, hcenterSpecialityId),
        eq(hcenterspecialities.hcenterId, clinicId),
      )).limit(1);
    if (!current) throw new NotFoundException("Clinic specialty not found");
    await this.db.delete(hcenterspecialities).where(eq(hcenterspecialities.hcenterSpecialityId, hcenterSpecialityId));
    await this.audit.record({
      action: "Delete", entityType: "ClinicSpecialty", entityId: hcenterSpecialityId,
      patientContext: null, previousValues: { clinicId, specialityId: current.specialityId },
    });
  }

  private async assertClinic(clinicId: string): Promise<void> {
    const [row] = await this.db.select({ id: hcenters.hcenterId }).from(hcenters)
      .where(eq(hcenters.hcenterId, clinicId)).limit(1);
    if (!row) throw new NotFoundException(`Clinic ${clinicId} not found`);
  }
}
