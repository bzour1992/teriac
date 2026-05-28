import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";

export interface EchoListItem {
  patientEchoCardiogramTestId: string;
  testDate: string;
  patientVisitId: string | null;
  requestedBy: string | null;
  ppd: string | null;
  lvedd: number | null;
  lvesd: number | null;
  ivs: number | null;
  plvw: number | null;
  aorticRoot: number | null;
  la: number | null;
  rv: number | null;
  dmModeFindings: string | null;
  dopplerFindings: string | null;
  conclusion: string | null;
}

export class CreateEchoDto {
  @IsString() testDate!: string;
  @IsUUID('all') @IsOptional() patientVisitId?: string | null;
  @IsString() @MaxLength(250) @IsOptional() requestedBy?: string | null;
  @IsString() @MaxLength(550) @IsOptional() ppd?: string | null;

  // Measurements (mm)
  @IsNumber() @Min(0) @IsOptional() lvedd?: number | null;
  @IsNumber() @Min(0) @IsOptional() lvesd?: number | null;
  @IsNumber() @Min(0) @IsOptional() ivs?: number | null;
  @IsNumber() @Min(0) @IsOptional() plvw?: number | null;
  @IsNumber() @Min(0) @IsOptional() aorticRoot?: number | null;
  @IsNumber() @Min(0) @IsOptional() la?: number | null;
  @IsNumber() @Min(0) @IsOptional() rv?: number | null;

  // Narrative
  @IsString() @IsOptional() dmModeFindings?: string | null;
  @IsString() @IsOptional() dopplerFindings?: string | null;
  @IsString() @IsOptional() conclusion?: string | null;
}

export class UpdateEchoDto {
  @IsString() @IsOptional() testDate?: string;
  @IsString() @MaxLength(250) @IsOptional() requestedBy?: string | null;
  @IsString() @MaxLength(550) @IsOptional() ppd?: string | null;
  @IsNumber() @Min(0) @IsOptional() lvedd?: number | null;
  @IsNumber() @Min(0) @IsOptional() lvesd?: number | null;
  @IsNumber() @Min(0) @IsOptional() ivs?: number | null;
  @IsNumber() @Min(0) @IsOptional() plvw?: number | null;
  @IsNumber() @Min(0) @IsOptional() aorticRoot?: number | null;
  @IsNumber() @Min(0) @IsOptional() la?: number | null;
  @IsNumber() @Min(0) @IsOptional() rv?: number | null;
  @IsString() @IsOptional() dmModeFindings?: string | null;
  @IsString() @IsOptional() dopplerFindings?: string | null;
  @IsString() @IsOptional() conclusion?: string | null;
}
