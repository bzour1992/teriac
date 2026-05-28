import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RecommendationsService } from "./recommendations.service";
import { CreateRecommendationDto, type RecommendationItem } from "./dto/recommendation.dto";

@ApiTags("visits")
@ApiBearerAuth()
@Controller("visits/:visitId/recommendations")
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationsService) {}

  @Get()
  list(@Param("visitId", new ParseUUIDPipe()) visitId: string): Promise<RecommendationItem[]> {
    return this.recommendations.list(visitId);
  }

  @Post()
  create(
    @Param("visitId", new ParseUUIDPipe()) visitId: string,
    @Body() body: CreateRecommendationDto,
  ): Promise<{ afterVisitRecommendationId: string }> {
    return this.recommendations.create(visitId, body);
  }

  @Patch(":recId/process")
  @HttpCode(HttpStatus.NO_CONTENT)
  async process(
    @Param("visitId", new ParseUUIDPipe()) visitId: string,
    @Param("recId", new ParseUUIDPipe()) recId: string,
  ): Promise<void> {
    await this.recommendations.process(visitId, recId);
  }

  @Delete(":recId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("visitId", new ParseUUIDPipe()) visitId: string,
    @Param("recId", new ParseUUIDPipe()) recId: string,
  ): Promise<void> {
    await this.recommendations.delete(visitId, recId);
  }
}
