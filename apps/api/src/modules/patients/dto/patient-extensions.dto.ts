import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

// ── Arabic info ───────────────────────────────────────────────────────────────

export interface ArabicInfoDto {
  firstNameAr: string | null;
  secondNameAr: string | null;
  thirdNameAr: string | null;
  lastNameAr: string | null;
}

export class UpdateArabicInfoDto {
  @IsString() @MaxLength(50) @IsOptional() firstNameAr?: string | null;
  @IsString() @MaxLength(50) @IsOptional() secondNameAr?: string | null;
  @IsString() @MaxLength(50) @IsOptional() thirdNameAr?: string | null;
  @IsString() @MaxLength(50) @IsOptional() lastNameAr?: string | null;
}

// ── Additional info ───────────────────────────────────────────────────────────

export interface AdditionalInfoDto {
  occupation: string | null;
  organization: string | null;
  dailyRoutine: string | null;
  dietaryPatterns: string | null;
  sleepPatterns: string | null;
  exercisePatterns: string | null;
  poBox: string | null;
  zipCode: string | null;
  homeEnvironment: string | null;
}

export class UpdateAdditionalInfoDto {
  @IsString() @MaxLength(250) @IsOptional() occupation?: string | null;
  @IsString() @MaxLength(250) @IsOptional() organization?: string | null;
  @IsString() @IsOptional() dailyRoutine?: string | null;
  @IsString() @IsOptional() dietaryPatterns?: string | null;
  @IsString() @IsOptional() sleepPatterns?: string | null;
  @IsString() @IsOptional() exercisePatterns?: string | null;
  @IsString() @MaxLength(15) @IsOptional() poBox?: string | null;
  @IsString() @MaxLength(10) @IsOptional() zipCode?: string | null;
  @IsString() @MaxLength(400) @IsOptional() homeEnvironment?: string | null;
}

// ── Substance use ─────────────────────────────────────────────────────────────

export interface SubstanceUseDto {
  liveWithSmokers: boolean;
  parentsWereSmokers: boolean;
  smokedBefore: boolean;
  stillSmoking: boolean;
  cigarettesNumber: number | null;
  cigarettesStartYear: number | null;
  cigarettesStopYear: number | null;
  sheeshaHeadNumber: number | null;
  sheeshaStartYear: number | null;
  sheeshaStopYear: number | null;
  totalPackYear: number | null;
  smokingComments: string | null;
  alcoholic: boolean;
  pastAlcoholic: boolean;
  excessiveAlcoholUse: boolean;
  beerNumber: number | null;
  wineNumber: number | null;
  liquorNumber: number | null;
  drinkingComments: string | null;
  drugUser: boolean;
  drugComments: string | null;
}

export class UpdateSubstanceUseDto {
  @IsBoolean() @IsOptional() liveWithSmokers?: boolean;
  @IsBoolean() @IsOptional() parentsWereSmokers?: boolean;
  @IsBoolean() @IsOptional() smokedBefore?: boolean;
  @IsBoolean() @IsOptional() stillSmoking?: boolean;
  @IsNumber() @IsOptional() cigarettesNumber?: number | null;
  @IsNumber() @IsOptional() cigarettesStartYear?: number | null;
  @IsNumber() @IsOptional() cigarettesStopYear?: number | null;
  @IsNumber() @IsOptional() sheeshaHeadNumber?: number | null;
  @IsNumber() @IsOptional() sheeshaStartYear?: number | null;
  @IsNumber() @IsOptional() sheeshaStopYear?: number | null;
  @IsNumber() @IsOptional() totalPackYear?: number | null;
  @IsString() @MaxLength(500) @IsOptional() smokingComments?: string | null;
  @IsBoolean() @IsOptional() alcoholic?: boolean;
  @IsBoolean() @IsOptional() pastAlcoholic?: boolean;
  @IsBoolean() @IsOptional() excessiveAlcoholUse?: boolean;
  @IsNumber() @IsOptional() beerNumber?: number | null;
  @IsNumber() @IsOptional() wineNumber?: number | null;
  @IsNumber() @IsOptional() liquorNumber?: number | null;
  @IsString() @MaxLength(500) @IsOptional() drinkingComments?: string | null;
  @IsBoolean() @IsOptional() drugUser?: boolean;
  @IsString() @MaxLength(500) @IsOptional() drugComments?: string | null;
}

// ── Insurance ─────────────────────────────────────────────────────────────────

export interface InsuranceItemDto {
  patientInsuranceDetailId: string;
  insuranceCompany: string;
  insuranceLevel: string | null;
  coveragePercentage: number | null;
  insuranceCardNumber: string | null;
  isActive: boolean;
  participantName: string | null;
  participantCompany: string | null;
  relationToParticipant: string | null;
  formNumber: string | null;
  notes: string | null;
}

export class CreateInsuranceDto {
  @IsString() @IsNotEmpty() insuranceCompany!: string;
  @IsString() @MaxLength(250) @IsOptional() insuranceLevel?: string | null;
  @IsNumber() @Min(0) @Max(100) @IsOptional() coveragePercentage?: number | null;
  @IsString() @MaxLength(50) @IsOptional() insuranceCardNumber?: string | null;
  @IsBoolean() @IsOptional() isActive?: boolean;
  @IsString() @MaxLength(400) @IsOptional() participantName?: string | null;
  @IsString() @MaxLength(250) @IsOptional() participantCompany?: string | null;
  @IsString() @MaxLength(250) @IsOptional() relationToParticipant?: string | null;
  @IsString() @MaxLength(250) @IsOptional() formNumber?: string | null;
  @IsString() @IsOptional() notes?: string | null;
}

export class UpdateInsuranceDto {
  @IsString() @IsNotEmpty() @IsOptional() insuranceCompany?: string;
  @IsString() @MaxLength(250) @IsOptional() insuranceLevel?: string | null;
  @IsNumber() @Min(0) @Max(100) @IsOptional() coveragePercentage?: number | null;
  @IsString() @MaxLength(50) @IsOptional() insuranceCardNumber?: string | null;
  @IsBoolean() @IsOptional() isActive?: boolean;
  @IsString() @MaxLength(400) @IsOptional() participantName?: string | null;
  @IsString() @MaxLength(250) @IsOptional() participantCompany?: string | null;
  @IsString() @MaxLength(250) @IsOptional() relationToParticipant?: string | null;
  @IsString() @MaxLength(250) @IsOptional() formNumber?: string | null;
  @IsString() @IsOptional() notes?: string | null;
}

// ── Special notes ─────────────────────────────────────────────────────────────

export interface PatientNoteDto {
  patientSpecialNoteId: string;
  note: string;
}

export class CreateNoteDto {
  @IsString() @IsNotEmpty() note!: string;
}
