import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

// ── HCenter ───────────────────────────────────────────────────────────────────

export interface HCenterProfile {
  hcenterId: string;
  name: string;
  nameRep: string | null;
  email: string | null;
  phone: string | null;
  reportAddress: string | null;
  reportsWorkingTimes: string | null;
  clinicManager: string | null;
  clinicManagerEmail: string | null;
  clinicManagerMob: string | null;
  hcenterInitials: string | null;
  preferredCurrency: string | null;
  isOneDoctor: boolean;
  subscriptionType: number;
}

export class UpdateHCenterDto {
  @IsString() @IsNotEmpty() @MaxLength(500) @IsOptional() name?: string;
  @IsString() @MaxLength(500) @IsOptional() nameRep?: string | null;
  @IsString() @MaxLength(250) @IsOptional() email?: string | null;
  @IsString() @MaxLength(250) @IsOptional() phone?: string | null;
  @IsString() @MaxLength(500) @IsOptional() reportAddress?: string | null;
  @IsString() @MaxLength(500) @IsOptional() reportsWorkingTimes?: string | null;
  @IsString() @MaxLength(400) @IsOptional() clinicManager?: string | null;
  @IsString() @MaxLength(400) @IsOptional() clinicManagerEmail?: string | null;
  @IsString() @MaxLength(50) @IsOptional() clinicManagerMob?: string | null;
  @IsString() @MaxLength(2) @IsOptional() hcenterInitials?: string | null;
  @IsString() @MaxLength(50) @IsOptional() preferredCurrency?: string | null;
}

// ── Settings ──────────────────────────────────────────────────────────────────

export interface HCenterSettings {
  defaultPayment: number;
  preferredCurrency: string | null;
  isHeightWeightRequired: boolean;
  areAllergiesRequired: boolean;
  areChronicDiseasesRequired: boolean;
  isPatientArabicNameRequired: boolean;
  canDoctorsEditPatientDemographicInformation: boolean;
  onlyVisitDoctorCanEditVisitRecords: boolean;
  preventEditingPatientVisitWhenStatusIsResolvedOrFailed: boolean;
  onlyCenterAdminIsAllowedToDeleteAttachments: boolean;
  numberOfOperationRooms: number;
}

export class UpdateSettingsDto {
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

// ── Users ─────────────────────────────────────────────────────────────────────

export interface AdminUserItem {
  userId: string;
  userName: string;
  fullName: string;
  userType: number;
  position: string | null;
  isAdmin: boolean;
  isFinancialAdmin: boolean;
  isActive: boolean;
  specialityName: string | null;
}

export class CreateUserDto {
  @IsString() @IsNotEmpty() @MaxLength(256) userName!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() @IsNotEmpty() @MaxLength(50) firstName!: string;
  @IsString() @IsNotEmpty() @MaxLength(50) lastName!: string;
  @IsString() @MaxLength(50) @IsOptional() secondName?: string | null;
  @IsInt() @Min(1) userType!: number;
  @IsString() @MaxLength(50) @IsOptional() position?: string | null;
  @IsBoolean() @IsOptional() isAdmin?: boolean;
  @IsBoolean() @IsOptional() isFinancialAdmin?: boolean;
  @IsUUID('all') @IsOptional() hcenterSpecialityId?: string | null;
}

export class UpdateUserDto {
  @IsString() @IsNotEmpty() @MaxLength(50) @IsOptional() firstName?: string;
  @IsString() @IsNotEmpty() @MaxLength(50) @IsOptional() lastName?: string;
  @IsString() @MaxLength(50) @IsOptional() secondName?: string | null;
  @IsInt() @Min(1) @IsOptional() userType?: number;
  @IsString() @MaxLength(50) @IsOptional() position?: string | null;
  @IsBoolean() @IsOptional() isAdmin?: boolean;
  @IsBoolean() @IsOptional() isFinancialAdmin?: boolean;
  @IsBoolean() @IsOptional() isActive?: boolean;
  @IsString() @MinLength(8) @IsOptional() password?: string | null;
  @IsUUID('all') @IsOptional() hcenterSpecialityId?: string | null;
}

// ── Permissions ───────────────────────────────────────────────────────────────

export interface PermissionItem {
  permissionId: number;
  permissionName: string;
  permissionType: number;
}

export class SetPermissionsDto {
  @IsArray()
  @IsNumber({}, { each: true })
  permissionIds!: number[];
}
