import { IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export interface VitalsRecord {
  pvVitalsId: string;
  recordedAt: string;
  recordedBy: string | null;
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  sbp: number | null;
  dbp: number | null;
  pulseRate: number | null;
  temperatureC: number | null;
  respiratoryRate: number | null;
  spo2: number | null;
  notes: string | null;
}

/** Per-patient vitals row — includes the source visit so the UI can link back. */
export interface PatientVitalsRecord extends VitalsRecord {
  patientVisitId: string;
  visitDate: string;
}

export class SaveVitalsDto {
  @IsNumber() @Min(50) @Max(250) @IsOptional() heightCm?: number | null;
  @IsNumber() @Min(1)  @Max(500) @IsOptional() weightKg?: number | null;
  @IsNumber() @Min(40) @Max(300) @IsOptional() sbp?: number | null;
  @IsNumber() @Min(20) @Max(200) @IsOptional() dbp?: number | null;
  @IsNumber() @Min(20) @Max(300) @IsOptional() pulseRate?: number | null;
  @IsNumber() @Min(30) @Max(45)  @IsOptional() temperatureC?: number | null;
  @IsNumber() @Min(1)  @Max(60)  @IsOptional() respiratoryRate?: number | null;
  @IsNumber() @Min(50) @Max(100) @IsOptional() spo2?: number | null;
  @IsString()                    @IsOptional() notes?: string | null;
}
