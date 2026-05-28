import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export interface ImmunizationListItem {
  patientImmunizationId: string;
  immunizationsVaccineId: string;
  vaccineName: string;
  vaccineType: string | null;
  dose: string | null;
  ageAdministered: string | null;
  dateAdministered: string | null;
  lotNumber: string | null;
  physician: string | null;
}

export class CreateImmunizationDto {
  @IsUUID('all')
  immunizationsVaccineId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  vaccineType?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  dose?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  ageAdministered?: string | null;

  @IsString()
  @IsOptional()
  dateAdministered?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  lotNumber?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  physician?: string | null;
}
