import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class UpdatePatientDto {
  // ---- Names (English) ----
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  prefix?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  secondName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  thirdName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string | null;

  // ---- Names (Arabic — patientarabicinfo) ----
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstNameAr?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  secondNameAr?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  thirdNameAr?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastNameAr?: string | null;

  // ---- Demographics ----
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nationalId?: string;

  @ApiPropertyOptional({ enum: [0, 1, 2], description: "0=Unknown, 1=Male, 2=Female" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  sex?: number;

  @ApiPropertyOptional({ description: "ISO date or datetime" })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  passportNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  religion?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('all')
  nationality?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('all')
  humanRaceId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('all')
  maritalStatusId?: string | null;

  // ---- Contact ----
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  mobileNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(250)
  email?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  address?: string | null;

  // ---- Emergency contact ----
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(250)
  contactPersonName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(250)
  contactRelation?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(250)
  contactPhoneNumber?: string | null;

  // ---- Vitals baseline ----
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(300)
  height?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(700)
  weight?: number | null;

  @ApiPropertyOptional({ description: "metric | imperial" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  whUnit?: string | null;
}
