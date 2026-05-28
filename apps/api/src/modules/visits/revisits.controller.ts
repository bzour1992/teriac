import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RevisitsService } from "./revisits.service";
import { CreateRevisitDto, type RevisitItem } from "./dto/revisit.dto";

@ApiTags("visits")
@ApiBearerAuth()
@Controller("visits/:visitId/revisits")
export class RevisitsController {
  constructor(private readonly revisits: RevisitsService) {}

  @Get()
  list(@Param("visitId", new ParseUUIDPipe()) visitId: string): Promise<RevisitItem[]> {
    return this.revisits.list(visitId);
  }

  @Post()
  create(
    @Param("visitId", new ParseUUIDPipe()) visitId: string,
    @Body() body: CreateRevisitDto,
  ): Promise<{ pvRevisitId: string }> {
    return this.revisits.create(visitId, body);
  }

  @Delete(":revisitId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("visitId", new ParseUUIDPipe()) visitId: string,
    @Param("revisitId", new ParseUUIDPipe()) revisitId: string,
  ): Promise<void> {
    await this.revisits.delete(visitId, revisitId);
  }
}
