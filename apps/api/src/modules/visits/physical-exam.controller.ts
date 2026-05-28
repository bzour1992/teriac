import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PhysicalExamService } from "./physical-exam.service";
import { SaveBodySystemDto, type BodySystemEntry } from "./dto/body-system.dto";

@ApiTags("visits")
@ApiBearerAuth()
@Controller("visits/:visitId/physical-exam")
export class PhysicalExamController {
  constructor(private readonly pe: PhysicalExamService) {}

  @Get()
  get(@Param("visitId", new ParseUUIDPipe()) visitId: string): Promise<BodySystemEntry[]> {
    return this.pe.get(visitId);
  }

  @Post()
  save(
    @Param("visitId", new ParseUUIDPipe()) visitId: string,
    @Body() body: SaveBodySystemDto,
  ): Promise<{ lotGuid: string }> {
    return this.pe.save(visitId, body);
  }
}
