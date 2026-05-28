import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { Type } from "class-transformer";

// ── Clinic profile ────────────────────────────────────────────────────────────

export interface ClinicListItem {
  hcenterId: string;
  name: string;
  nameRep: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  subscriptionType: number;
  isOneDoctor: boolean;
  countryId: string | null;
  cityId: string | null;
  supportStartDate: string;
  lastRenewalDate: string | null;
  userCount: number;
  patientCount: number;
  specialtyCount: number;
}

export interface ClinicDetail extends ClinicListItem {
  reportAddress: string | null;
  reportsWorkingTimes: string | null;
  clinicManager: string | null;
  clinicManagerEmail: string | null;
  clinicManagerMob: string | null;
  hcenterInitials: string | null;
  eClaimLinkId: string | null;
}

export interface ClinicListResponse {
  data: ClinicListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export class ListClinicsQueryDto {
  @IsString() @IsOptional() q?: string;
  @IsString() @IsOptional() active?: string;
  @IsInt() @Min(1) @IsOptional() @Type(() => Number) page?: number;
  @IsInt() @Min(1) @IsOptional() @Type(() => Number) pageSize?: number;
}

export class CreateClinicDto {
  @IsString() @IsNotEmpty() @MaxLength(500) name!: string;
  @IsString() @MaxLength(500) @IsOptional() nameRep?: string | null;
  @IsString() @MaxLength(250) @IsOptional() email?: string | null;
  @IsString() @MaxLength(250) @IsOptional() phone?: string | null;
  @IsBoolean() @IsOptional() isOneDoctor?: boolean;
  @IsInt() @Min(1) @IsOptional() subscriptionType?: number;
  @IsString() @IsOptional() countryId?: string | null;
  @IsString() @IsOptional() cityId?: string | null;
  @IsString() @MaxLength(2) @IsOptional() hcenterInitials?: string | null;
  @IsString() @MaxLength(400) @IsOptional() clinicManager?: string | null;
  @IsString() @MaxLength(400) @IsOptional() clinicManagerEmail?: string | null;
  @IsString() @MaxLength(50) @IsOptional() clinicManagerMob?: string | null;
}

export class UpdateClinicDto {
  @IsString() @IsNotEmpty() @MaxLength(500) @IsOptional() name?: string;
  @IsString() @MaxLength(500) @IsOptional() nameRep?: string | null;
  @IsString() @MaxLength(250) @IsOptional() email?: string | null;
  @IsString() @MaxLength(250) @IsOptional() phone?: string | null;
  @IsBoolean() @IsOptional() isOneDoctor?: boolean;
  @IsInt() @Min(1) @IsOptional() subscriptionType?: number;
  @IsString() @MaxLength(500) @IsOptional() reportAddress?: string | null;
  @IsString() @MaxLength(500) @IsOptional() reportsWorkingTimes?: string | null;
  @IsString() @MaxLength(2) @IsOptional() hcenterInitials?: string | null;
  @IsString() @MaxLength(400) @IsOptional() clinicManager?: string | null;
  @IsString() @MaxLength(400) @IsOptional() clinicManagerEmail?: string | null;
  @IsString() @MaxLength(50) @IsOptional() clinicManagerMob?: string | null;
}

export class ActivateClinicDto {
  @IsBoolean() isActive!: boolean;
}

// ── Clinic specialties ────────────────────────────────────────────────────────

export interface ClinicSpecialty {
  hcenterSpecialityId: string;
  specialityId: string;
  specialityName: string;
  defaultPayment: number | null;
  showOnProfile: boolean;
}

export class AddClinicSpecialtyDto {
  @IsString() @IsNotEmpty() specialityId!: string;
  @IsNumber() @Min(0) @IsOptional() defaultPayment?: number | null;
  @IsBoolean() @IsOptional() showOnProfile?: boolean;
}

// ── Master specialties ────────────────────────────────────────────────────────

export interface MasterSpecialty {
  specialityId: string;
  specialityName: string;
  description: string | null;
  specialtyGroup: string;
}

export class CreateMasterSpecialtyDto {
  @IsString() @IsNotEmpty() @MaxLength(150) specialityName!: string;
  @IsString() @IsOptional() description?: string | null;
  @IsString() @IsNotEmpty() @MaxLength(2) specialtyGroup!: string;
}

export class UpdateMasterSpecialtyDto {
  @IsString() @IsNotEmpty() @MaxLength(150) @IsOptional() specialityName?: string;
  @IsString() @IsOptional() description?: string | null;
  @IsString() @MaxLength(2) @IsOptional() specialtyGroup?: string;
}

// ── Modules ───────────────────────────────────────────────────────────────────

export const MODULE_KEYS = [
  "pediatrics",
  "obgyn",
  "fertility",
  "dermatology",
  "dentistry",
  "cardiology",
  "optometry",
  "finance",
  "reports",
  "audit",
] as const;

export interface ClinicModule {
  moduleKey: string;
  isEnabled: boolean;
  enabledAt: string | null;
  notes: string | null;
}

export class SetModuleDto {
  @IsBoolean() isEnabled!: boolean;
  @IsString() @IsOptional() @MaxLength(500) notes?: string | null;
}

// ── Field rules ───────────────────────────────────────────────────────────────

export interface FieldRule {
  entityName: string;
  fieldName: string;
  visibility: "hidden" | "visible" | "readonly";
  requirement: "optional" | "required" | "conditional";
  defaultValue: string | null;
  labelEn: string | null;
  labelAr: string | null;
}

export class SetFieldRuleDto {
  @IsIn(["hidden", "visible", "readonly"]) @IsOptional()
  visibility?: "hidden" | "visible" | "readonly";

  @IsIn(["optional", "required", "conditional"]) @IsOptional()
  requirement?: "optional" | "required" | "conditional";

  @IsString() @IsOptional() defaultValue?: string | null;
  @IsString() @MaxLength(250) @IsOptional() labelEn?: string | null;
  @IsString() @MaxLength(250) @IsOptional() labelAr?: string | null;
}

// ── Cross-tenant users ────────────────────────────────────────────────────────

export interface CrossClinicUser {
  userId: string;
  userName: string;
  fullName: string;
  userType: number;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isActive: boolean;
  hcenterId: string;
  clinicName: string;
}

export interface CrossClinicUserListResponse {
  data: CrossClinicUser[];
  total: number;
  page: number;
  pageSize: number;
}

export class ListUsersQueryDto {
  @IsString() @IsOptional() q?: string;
  @IsString() @IsOptional() clinicId?: string;
  @IsString() @IsOptional() active?: string;
  @IsInt() @Min(1) @IsOptional() @Type(() => Number) page?: number;
  @IsInt() @Min(1) @IsOptional() @Type(() => Number) pageSize?: number;
}

// ── Create user in any clinic ─────────────────────────────────────────────────

export class CreateUserInClinicDto {
  @IsString() @IsNotEmpty() @MaxLength(256) userName!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() @IsNotEmpty() @MaxLength(50) firstName!: string;
  @IsString() @IsNotEmpty() @MaxLength(50) lastName!: string;
  @IsString() @MaxLength(50) @IsOptional() secondName?: string | null;
  @IsInt() @Min(1) userType!: number;
  @IsString() @MaxLength(50) @IsOptional() position?: string | null;
  @IsBoolean() @IsOptional() isAdmin?: boolean;
  @IsBoolean() @IsOptional() isFinancialAdmin?: boolean;
  @IsBoolean() @IsOptional() isSuperAdmin?: boolean;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface SuperadminStats {
  clinicCount: number;
  activeClinicCount: number;
  totalUsers: number;
  activeUsers: number;
  totalPatients: number;
  totalVisits: number;
  totalInvoicedThisMonth: number;
  clinicsByPatientCount: Array<{ clinicId: string; clinicName: string; patientCount: number }>;
}

// ── Settings (alias to admin DTO shape) ───────────────────────────────────────

export class UpdateClinicSettingsDto {
  @IsInt() @Min(1) @IsOptional() defaultPayment?: number;
  @IsString() @MaxLength(50) @IsOptional() preferredCurrency?: string | null;
  @IsBoolean() @IsOptional() isHeightWeightRequired?: boolean;
  @IsBoolean() @IsOptional() areAllergiesRequired?: boolean;
  @IsBoolean() @IsOptional() areChronicDiseasesRequired?: boolean;
  @IsBoolean() @IsOptional() isPatientArabicNameRequired?: boolean;
  @IsBoolean() @IsOptional() canDoctorsEditPatientDemographicInformation?: boolean;
  @IsBoolean() @IsOptional() onlyVisitDoctorCanEditVisitRecords?: boolean;
  @IsBoolean() @IsOptional() preventEditingPatientVisitWhenStatusIsResolvedOrFailed?: boolean;
  @IsBoolean() @IsOptional() onlyCenterAdminIsAllowedToDeleteAttachments?: boolean;
  @IsInt() @Min(0) @IsOptional() numberOfOperationRooms?: number;
}
