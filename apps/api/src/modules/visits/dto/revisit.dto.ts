import { IsOptional, IsString } from "class-validator";

export interface RevisitItem {
  pvRevisitId: string;
  revisitDate: string;
  notes: string | null;
  comments: string | null;
}

export class CreateRevisitDto {
  @IsString()
  revisitDate!: string;

  @IsString()
  @IsOptional()
  notes?: string | null;

  @IsString()
  @IsOptional()
  comments?: string | null;
}
