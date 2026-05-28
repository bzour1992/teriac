import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export interface ProblemListItem {
  patientProblemId: string;
  problemText: string;
  problemCategory: number;
  onsetDate: string | null;
  lastOccurenceDate: string | null;
  isActive: boolean;
}

export class CreateProblemDto {
  @IsString()
  @IsNotEmpty()
  problemText!: string;

  @IsInt()
  @Min(1)
  @Max(4)
  @IsOptional()
  problemCategory?: number;

  @IsString()
  @IsOptional()
  onsetDate?: string | null;

  @IsString()
  @IsOptional()
  lastOccurenceDate?: string | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateProblemDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  problemText?: string;

  @IsInt()
  @Min(1)
  @Max(4)
  @IsOptional()
  problemCategory?: number;

  @IsString()
  @IsOptional()
  onsetDate?: string | null;

  @IsString()
  @IsOptional()
  lastOccurenceDate?: string | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
