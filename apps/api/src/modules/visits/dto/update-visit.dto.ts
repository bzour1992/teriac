import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateVisitDto {
  // ---- SOAP narrative ----
  @ApiPropertyOptional({ description: "Subjective: patient's chief complaint" })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  chiefComplaint?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  historyOfPresentIllness?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  pastMedicalHistory?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  notes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  recommendations?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  disposition?: string | null;

  // ---- Classifications ----
  @ApiPropertyOptional({ enum: [0, 1, 2, 3, 4, 5], description: "VisitOutcome enum" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  outcome?: number;

  @ApiPropertyOptional({ enum: [0, 1, 2, 3], description: "Intensity enum" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  intensity?: number;

  @ApiPropertyOptional({ enum: [1, 2, 3, 4, 5], description: "VisitType enum" })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  visitType?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  painLevel?: number;

  // ---- Hospital / referral ----
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isHospitalCase?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(250)
  hospitalName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(250)
  sourceOfReferral?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(250)
  transferTo?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  destinationOfReferral?: string | null;
}
