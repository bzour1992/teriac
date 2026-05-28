import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreatePrescriptionDto {
  @ApiProperty()
  @IsUUID('all')
  medicineId!: string;

  @ApiPropertyOptional({ description: "Link to a visit assessment condition (diagnosis)." })
  @IsOptional()
  @IsUUID('all')
  pvAssessmentConditionId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  indication?: string | null;

  @ApiPropertyOptional({ description: "Free-text dose, e.g. '10 mg'" })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  dose?: string | null;

  @ApiPropertyOptional({ description: "Free-text period, e.g. 'for 30 days'" })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  period?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99)
  frequency?: number | null;

  @ApiPropertyOptional({ description: "E.g. 'per day', 'every 8h'" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  frequencyUnit?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  quantityNumber?: string | null;

  @ApiPropertyOptional({ description: "E.g. 'tablet', 'mL'" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  quantityForm?: string | null;

  @ApiPropertyOptional({ description: "E.g. 'PO', 'IM', 'ORL'" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  route?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;

  @ApiPropertyOptional({
    description: "True = prescribed; false = only suggested (e.g. AI/protocol).",
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isPrescribed?: boolean;
}

export class UpdatePrescriptionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('all')
  medicineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('all')
  pvAssessmentConditionId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  indication?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(250)
  dose?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(250)
  period?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99)
  frequency?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  frequencyUnit?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  quantityNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  quantityForm?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  route?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrescribed?: boolean;
}
