import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export class ListVisitsQueryDto {
  @IsString()
  @IsOptional()
  from?: string;

  @IsString()
  @IsOptional()
  to?: string;

  @IsUUID('all')
  @IsOptional()
  patientId?: string;

  @IsUUID('all')
  @IsOptional()
  doctorId?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  visitType?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  outcome?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  pageSize?: number;

  /** Sort key — whitelist to avoid SQL injection via column name. */
  @IsIn(["visitDate", "patient", "doctor"])
  @IsOptional()
  sortBy?: "visitDate" | "patient" | "doctor";

  @IsIn(["asc", "desc"])
  @IsOptional()
  sortDir?: "asc" | "desc";
}

export interface VisitListItem {
  patientVisitId: string;
  visitDate: string;
  visitType: number;
  outcome: number;
  intensity: number;
  chiefComplaint: string | null;
  patient: {
    patientId: string;
    fullName: string;
    fullNameAr: string | null;
    nationalId: string;
  };
  doctor: { userId: string; fullName: string } | null;
  /** Top diagnosis name (most recently added), or null. */
  topDiagnosis: string | null;
  /** Count of diagnoses linked to this visit. */
  diagnosisCount: number;
  /** Count of prescribed medications on this visit. */
  prescriptionCount: number;
}

export interface VisitListResponse {
  data: VisitListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface VisitStats {
  total: number;
  open: number;
  resolved: number;
  noShow: number;
  today: number;
  /** Counts by outcome key (0..5). */
  byOutcome: Record<number, number>;
}
