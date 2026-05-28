import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

// Severity enum — unverified against legacy app (CLAUDE.md §16). Best guess:
//   1 = Mild, 2 = Moderate, 3 = Severe, 4 = Anaphylactic / life-threatening
export const ALLERGY_SEVERITIES = [1, 2, 3, 4] as const;
export type AllergySeverity = (typeof ALLERGY_SEVERITIES)[number];

export class CreateAllergyDto {
  @ApiProperty()
  @IsUUID('all')
  medicalConditionId!: string;

  @ApiPropertyOptional({ enum: ALLERGY_SEVERITIES })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  severity?: AllergySeverity | null;

  @ApiPropertyOptional({ description: "ISO date — when the most recent reaction happened" })
  @IsOptional()
  @IsDateString()
  lastOccurenceDate?: string | null;

  @ApiPropertyOptional({ description: "Reaction description (e.g. 'hives', 'anaphylaxis')" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reaction?: string | null;

  @ApiPropertyOptional({ description: "Past treatment summary" })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  treatment?: string | null;
}

export class UpdateAllergyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('all')
  medicalConditionId?: string;

  @ApiPropertyOptional({ enum: ALLERGY_SEVERITIES })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  severity?: AllergySeverity | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  lastOccurenceDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reaction?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  treatment?: string | null;
}

export interface AllergyListItem {
  allergyId: string;
  medicalConditionId: string;
  conditionName: string;
  severity: number | null;
  lastOccurenceDate: string | null;
  reaction: string | null;
  treatment: string | null;
}
