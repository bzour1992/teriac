import { IsNotEmpty, IsString } from "class-validator";

export interface RecommendationItem {
  afterVisitRecommendationId: string;
  recommended: string;
  isDone: boolean;
  requestDate: string;
  processedDate: string | null;
}

export class CreateRecommendationDto {
  @IsString()
  @IsNotEmpty()
  recommended!: string;
}
