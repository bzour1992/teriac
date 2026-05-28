import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";
import { hcenters, hcentersystemsettings } from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";
import { AuditService } from "../../common/audit/audit.service";
import type {
  HCenterProfile,
  HCenterSettings,
  UpdateHCenterDto,
  UpdateSettingsDto,
} from "./dto/admin.dto";

@Injectable()
export class AdminService {
  constructor(
    private readonly tdb: TenantDbService,
    private readonly audit: AuditService,
  ) {}

  async getHCenter(): Promise<HCenterProfile> {
    const [row] = await this.tdb.db
      .select()
      .from(hcenters)
      .where(eq(hcenters.hcenterId, this.tdb.tenantId))
      .limit(1);
    if (!row) throw new NotFoundException("HCenter not found");

    return {
      hcenterId: row.hcenterId,
      name: row.hcenterName,
      nameRep: row.hcenterNameRep ?? null,
      email: row.email ?? null,
      phone: row.phone ?? null,
      reportAddress: row.reportAddress ?? null,
      reportsWorkingTimes: row.reportsWorkingTimes ?? null,
      clinicManager: row.clinicManager ?? null,
      clinicManagerEmail: row.clinicManagerEmail ?? null,
      clinicManagerMob: row.clinicManagerMob ?? null,
      hcenterInitials: row.hcenterInitials ?? null,
      preferredCurrency: null,
      isOneDoctor: row.isOneDoctor === 1,
      subscriptionType: row.subscriptionType,
    };
  }

  async updateHCenter(dto: UpdateHCenterDto): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setFields: Record<string, any> = {};
    if (dto.name !== undefined) setFields.hcenterName = dto.name;
    if (dto.nameRep !== undefined) setFields.hcenterNameRep = dto.nameRep?.trim() || null;
    if (dto.email !== undefined) setFields.email = dto.email?.trim() || null;
    if (dto.phone !== undefined) setFields.phone = dto.phone?.trim() || null;
    if (dto.reportAddress !== undefined) setFields.reportAddress = dto.reportAddress?.trim() || null;
    if (dto.reportsWorkingTimes !== undefined) setFields.reportsWorkingTimes = dto.reportsWorkingTimes?.trim() || null;
    if (dto.clinicManager !== undefined) setFields.clinicManager = dto.clinicManager?.trim() || null;
    if (dto.clinicManagerEmail !== undefined) setFields.clinicManagerEmail = dto.clinicManagerEmail?.trim() || null;
    if (dto.clinicManagerMob !== undefined) setFields.clinicManagerMob = dto.clinicManagerMob?.trim() || null;
    if (dto.hcenterInitials !== undefined) setFields.hcenterInitials = dto.hcenterInitials?.trim() || null;

    if (Object.keys(setFields).length === 0) return;

    const result = await this.tdb.db
      .update(hcenters)
      .set(setFields)
      .where(eq(hcenters.hcenterId, this.tdb.tenantId));

    const affected = (result as unknown as { affectedRows?: number }).affectedRows ?? null;
    if (affected !== null && affected !== 1) {
      throw new ConflictException("Unexpected rows affected updating HCenter");
    }

    await this.audit.record({
      action: "Update",
      entityType: "HCenter",
      entityId: this.tdb.tenantId,
      patientContext: null,
      newValues: setFields,
    });
  }

  async getSettings(): Promise<HCenterSettings> {
    const [row] = await this.tdb.db
      .select()
      .from(hcentersystemsettings)
      .where(eq(hcentersystemsettings.hcenterId, this.tdb.tenantId))
      .limit(1);
    if (!row) throw new NotFoundException("Settings not found");

    return {
      defaultPayment: row.defaultPayment,
      preferredCurrency: row.preferredCurrency ?? null,
      isHeightWeightRequired: row.isHeightWeightRequired === 1,
      areAllergiesRequired: row.areAllergiesRequired === 1,
      areChronicDiseasesRequired: row.areChronicDiseasesRequired === 1,
      isPatientArabicNameRequired: row.isPatientArabicNameRequired === 1,
      canDoctorsEditPatientDemographicInformation: row.canDoctorsEditPatientDemographicInformation === 1,
      onlyVisitDoctorCanEditVisitRecords: row.onlyVisitDoctorCanEditVisitRecords === 1,
      preventEditingPatientVisitWhenStatusIsResolvedOrFailed: row.preventEditingPatientVisitWhenStatusIsResolvedOrFailed === 1,
      onlyCenterAdminIsAllowedToDeleteAttachments: row.onlyCenterAdminIsAllowedToDeleteAttachments === 1,
      numberOfOperationRooms: row.numberOfOperationRooms,
    };
  }

  async updateSettings(dto: UpdateSettingsDto): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setFields: Record<string, any> = {};

    if (dto.defaultPayment !== undefined) setFields.defaultPayment = dto.defaultPayment;
    if (dto.preferredCurrency !== undefined) setFields.preferredCurrency = dto.preferredCurrency?.trim() || null;
    if (dto.numberOfOperationRooms !== undefined) setFields.numberOfOperationRooms = dto.numberOfOperationRooms;
    if (dto.isHeightWeightRequired !== undefined) setFields.isHeightWeightRequired = dto.isHeightWeightRequired ? 1 : 0;
    if (dto.areAllergiesRequired !== undefined) setFields.areAllergiesRequired = dto.areAllergiesRequired ? 1 : 0;
    if (dto.areChronicDiseasesRequired !== undefined) setFields.areChronicDiseasesRequired = dto.areChronicDiseasesRequired ? 1 : 0;
    if (dto.isPatientArabicNameRequired !== undefined) setFields.isPatientArabicNameRequired = dto.isPatientArabicNameRequired ? 1 : 0;
    if (dto.canDoctorsEditPatientDemographicInformation !== undefined) setFields.canDoctorsEditPatientDemographicInformation = dto.canDoctorsEditPatientDemographicInformation ? 1 : 0;
    if (dto.onlyVisitDoctorCanEditVisitRecords !== undefined) setFields.onlyVisitDoctorCanEditVisitRecords = dto.onlyVisitDoctorCanEditVisitRecords ? 1 : 0;
    if (dto.preventEditingPatientVisitWhenStatusIsResolvedOrFailed !== undefined) setFields.preventEditingPatientVisitWhenStatusIsResolvedOrFailed = dto.preventEditingPatientVisitWhenStatusIsResolvedOrFailed ? 1 : 0;
    if (dto.onlyCenterAdminIsAllowedToDeleteAttachments !== undefined) setFields.onlyCenterAdminIsAllowedToDeleteAttachments = dto.onlyCenterAdminIsAllowedToDeleteAttachments ? 1 : 0;

    if (Object.keys(setFields).length === 0) return;

    await this.tdb.db
      .update(hcentersystemsettings)
      .set(setFields)
      .where(eq(hcentersystemsettings.hcenterId, this.tdb.tenantId));

    await this.audit.record({
      action: "Update",
      entityType: "HCenterSettings",
      entityId: this.tdb.tenantId,
      patientContext: null,
      newValues: setFields,
    });
  }
}
