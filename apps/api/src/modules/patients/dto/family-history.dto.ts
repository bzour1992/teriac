import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export interface FamilyHistoryItem {
  pfiHereditaryDiseasesId: string;
  medicalConditionId: string;
  conditionName: string;
  description: string | null;
}

export class CreateFamilyHistoryDto {
  @IsUUID('all')
  medicalConditionId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(250)
  description?: string | null;
}
