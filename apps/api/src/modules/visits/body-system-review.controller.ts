import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { BodySystemReviewService } from "./body-system-review.service";
import { SaveBodySystemDto, type BodySystemEntry } from "./dto/body-system.dto";

@ApiTags("visits")
@ApiBearerAuth()
@Controller("visits/:visitId/body-system-review")
export class BodySystemReviewController {
  constructor(private readonly ros: BodySystemReviewService) {}

  @Get()
  get(@Param("visitId", new ParseUUIDPipe()) visitId: string): Promise<BodySystemEntry[]> {
    return this.ros.get(visitId);
  }

  @Post()
  save(
    @Param("visitId", new ParseUUIDPipe()) visitId: string,
    @Body() body: SaveBodySystemDto,
  ): Promise<{ lotGuid: string }> {
    return this.ros.save(visitId, body);
  }
}
