import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateLongTermMedicationDto {
  @ApiProperty()
  @IsUUID('all')
  medicineId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  indication?: string | null;

  @ApiPropertyOptional({ example: "10 mg" })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  dose?: string | null;

  @ApiPropertyOptional({ example: "for 6 months" })
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

  @ApiPropertyOptional({ example: "per day" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  frequencyUnit?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  quantityNumber?: string | null;

  @ApiPropertyOptional({ example: "tablet" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  quantityForm?: string | null;

  @ApiPropertyOptional({ example: "PO" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  route?: string | null;

  @ApiPropertyOptional({ description: "Prescribing doctor name (free text in the legacy schema)" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  prescribedBy?: string | null;

  @ApiPropertyOptional({ description: "When the prescription was written" })
  @IsOptional()
  @IsDateString()
  prescriptionDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}

export class UpdateLongTermMedicationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('all')
  medicineId?: string;

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
  @MaxLength(50)
  prescribedBy?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  prescriptionDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}

export interface LongTermMedicationListItem {
  patientLongTermMedicineId: string;
  medicineId: string;
  medicineName: string;
  scientificName: string | null;
  indication: string | null;
  dose: string | null;
  period: string | null;
  frequency: number | null;
  frequencyUnit: string | null;
  quantityNumber: string | null;
  quantityForm: string | null;
  route: string | null;
  prescribedBy: string | null;
  prescriptionDate: string | null;
  notes: string | null;
}
