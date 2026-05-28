import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseUUIDPipe, Patch, Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequiresModule } from "../../common/modules/requires-module.decorator";
import { EchoService } from "./echo.service";
import { CreateEchoDto, UpdateEchoDto, type EchoListItem } from "./dto/echo.dto";

@ApiTags("patients")
@ApiBearerAuth()
@RequiresModule("cardiology")
@Controller("patients/:patientId/echocardiogram")
export class EchoController {
  constructor(private readonly echo: EchoService) {}

  @Get()
  list(@Param("patientId", new ParseUUIDPipe()) patientId: string): Promise<EchoListItem[]> {
    return this.echo.list(patientId);
  }

  @Post()
  create(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
    @Body() body: CreateEchoDto,
  ): Promise<{ patientEchoCardiogramTestId: string }> {
    return this.echo.create(patientId, body);
  }

  @Patch(":echoId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async update(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
    @Param("echoId", new ParseUUIDPipe()) echoId: string,
    @Body() body: UpdateEchoDto,
  ): Promise<void> {
    await this.echo.update(patientId, echoId, body);
  }

  @Delete(":echoId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
    @Param("echoId", new ParseUUIDPipe()) echoId: string,
  ): Promise<void> {
    await this.echo.delete(patientId, echoId);
  }
}
