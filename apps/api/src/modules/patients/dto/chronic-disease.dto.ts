import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

export class CreateChronicDiseaseDto {
  @ApiProperty()
  @IsUUID('all')
  medicalConditionId!: string;

  @ApiPropertyOptional({ minimum: 1900, maximum: 2100 })
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  yearDiagnosed?: number | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  monthDiagnosed?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdateChronicDiseaseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('all')
  medicalConditionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  yearDiagnosed?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  monthDiagnosed?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export interface ChronicDiseaseListItem {
  chronicDiseaseId: string;
  medicalConditionId: string;
  conditionName: string;
  yearDiagnosed: number | null;
  monthDiagnosed: number | null;
  notes: string | null;
}
