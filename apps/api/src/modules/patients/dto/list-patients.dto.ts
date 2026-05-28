import { IsInt, IsOptional, IsString, Max, Min, MaxLength } from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class ListPatientsQueryDto {
  @ApiPropertyOptional({ description: "Free-text search across English + Arabic names + NationalID + phone" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}

export interface PatientListItem {
  patientId: string;
  nationalId: string;
  fullName: string;
  fullNameAr: string | null;
  sex: number;
  dateOfBirth: string | null;
  mobileNumber: string | null;
  email: string | null;
  photoUrl: string | null;
}

export interface PatientListResponse {
  data: PatientListItem[];
  total: number;
  page: number;
  pageSize: number;
}
