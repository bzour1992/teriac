import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { VitalsService } from "./vitals.service";
import { SaveVitalsDto, type VitalsRecord } from "./dto/vitals.dto";

@ApiTags("visits")
@ApiBearerAuth()
@Controller("visits/:visitId/vitals")
export class VitalsController {
  constructor(private readonly vitals: VitalsService) {}

  @Get()
  list(@Param("visitId", new ParseUUIDPipe()) visitId: string): Promise<VitalsRecord[]> {
    return this.vitals.list(visitId);
  }

  @Post()
  record(
    @Param("visitId", new ParseUUIDPipe()) visitId: string,
    @Body() body: SaveVitalsDto,
  ): Promise<{ pvVitalsId: string }> {
    return this.vitals.record(visitId, body);
  }
}
