import { IsArray, IsBoolean, IsOptional, IsString, Matches, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

// Legacy Windows GUIDs from the DB may use non-standard version bytes (e.g. version 14)
// which class-validator's @IsUUID() rejects even with 'all'. Use a plain hex-GUID pattern.
const GUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export interface BodySystemEntry {
  patientBodySystemReviewId?: string;
  patientBodySystemPhysicalExamId?: string;
  bodySystemId: string;
  bodySystemName: string;
  isNormal: boolean;
  notes: string | null;
}

export class BodySystemEntryDto {
  @IsString()
  @Matches(GUID_RE, { message: "bodySystemId must be a GUID" })
  bodySystemId!: string;

  @IsBoolean()
  isNormal!: boolean;

  @IsString()
  @IsOptional()
  notes?: string | null;
}

export class SaveBodySystemDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BodySystemEntryDto)
  items!: BodySystemEntryDto[];
}
