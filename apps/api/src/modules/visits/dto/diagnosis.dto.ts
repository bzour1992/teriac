import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export const CONDITION_STATUSES = ["Active", "Resolved", "Chronic", "Inactive"] as const;
export type ConditionStatus = (typeof CONDITION_STATUSES)[number];

export class CreateDiagnosisDto {
  @ApiProperty()
  @IsUUID('all')
  medicalConditionId!: string;

  @ApiPropertyOptional({ example: "2026-03-15", description: "ISO date or datetime" })
  @IsOptional()
  @IsDateString()
  dateDiagnosed?: string | null;

  @ApiPropertyOptional({ example: "45y" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ageOfOnset?: string | null;

  @ApiPropertyOptional({ enum: CONDITION_STATUSES })
  @IsOptional()
  @IsString()
  @IsIn(CONDITION_STATUSES as unknown as string[])
  conditionStatus?: ConditionStatus | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comments?: string | null;
}

export class UpdateDiagnosisDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('all')
  medicalConditionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateDiagnosed?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ageOfOnset?: string | null;

  @ApiPropertyOptional({ enum: CONDITION_STATUSES })
  @IsOptional()
  @IsString()
  @IsIn(CONDITION_STATUSES as unknown as string[])
  conditionStatus?: ConditionStatus | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comments?: string | null;
}
