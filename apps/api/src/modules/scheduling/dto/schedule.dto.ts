import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export const SCHEDULE_STATUSES = [
  { id: 1, label: "Scheduled" },
  { id: 2, label: "Confirmed" },
  { id: 3, label: "Arrived" },
  { id: 4, label: "InProgress" },
  { id: 5, label: "Completed" },
  { id: 6, label: "NoShow" },
  { id: 7, label: "Cancelled" },
] as const;

export class ListScheduleQueryDto {
  @ApiProperty({ description: "ISO date or datetime — inclusive lower bound" })
  @IsDateString()
  from!: string;

  @ApiProperty({ description: "ISO date or datetime — exclusive upper bound" })
  @IsDateString()
  to!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('all')
  doctorId?: string;

  @ApiPropertyOptional({ enum: [1, 2, 3, 4, 5, 6, 7] })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  status?: number;
}

export class CreateScheduleDto {
  @ApiProperty()
  @IsUUID('all')
  doctorId!: string;

  @ApiProperty({ description: "ISO datetime" })
  @IsDateString()
  scheduledInDate!: string;

  @ApiProperty({ description: "ISO datetime; must be > scheduledInDate" })
  @IsDateString()
  scheduledToDate!: string;

  @ApiPropertyOptional({ description: "Required if notForPatient is false" })
  @IsOptional()
  @IsUUID('all')
  patientId?: string | null;

  @ApiPropertyOptional({ description: "Label / patient name override" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  name?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(250)
  contactEmail?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(250)
  location?: string | null;

  @ApiPropertyOptional({ enum: [1, 2, 3, 4, 5, 6, 7], default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  statusId?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  labelId?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isSurgery?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: "True for internal blocked slots (lunch, meeting). Skips patient FK check.",
  })
  @IsOptional()
  @IsBoolean()
  notForPatient?: boolean;
}

export class UpdateScheduleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('all')
  doctorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledInDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledToDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('all')
  patientId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  name?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(250)
  contactEmail?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(250)
  location?: string | null;

  @ApiPropertyOptional({ enum: [1, 2, 3, 4, 5, 6, 7] })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  statusId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  labelId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSurgery?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notForPatient?: boolean;

  @ApiPropertyOptional({ description: "Mark as confirmed/done by the receptionist." })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDone?: boolean;
}

export interface ScheduleListItem {
  scheduleItemId: string;
  scheduledInDate: string;
  scheduledToDate: string;
  statusId: number;
  labelId: number;
  isVerified: boolean;
  isDone: boolean;
  isSurgery: boolean;
  notForPatient: boolean;
  location: string | null;
  name: string | null;
  notes: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  doctor: {
    userId: string;
    fullName: string;
  } | null;
  patient: {
    patientId: string;
    fullName: string;
    fullNameAr: string | null;
    nationalId: string;
    mobileNumber: string | null;
  } | null;
  patientVisitId: string | null;
}
