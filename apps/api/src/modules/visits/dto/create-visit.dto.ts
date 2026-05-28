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

export class CreateVisitDto {
  @ApiProperty()
  @IsUUID('all')
  patientId!: string;

  @ApiProperty({ enum: [1, 2, 3, 4, 5], description: "1=New 2=Follow-up 3=Emergency 4=Routine 5=Walk-in" })
  @IsInt()
  @Min(1)
  @Max(5)
  visitType!: number;

  @ApiPropertyOptional({ description: "Defaults to now if omitted" })
  @IsOptional()
  @IsDateString()
  visitDate?: string;

  @ApiPropertyOptional({ description: "Override the attending doctor; defaults to the authenticated user." })
  @IsOptional()
  @IsUUID('all')
  doctorUserId?: string;

  @ApiPropertyOptional({ enum: [0, 1, 2, 3] })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  intensity?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  painLevel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  chiefComplaint?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  historyOfPresentIllness?: string | null;
}
