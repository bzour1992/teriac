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
import { ImmunizationsService } from "./immunizations.service";
import { CreateImmunizationDto, type ImmunizationListItem } from "./dto/immunization.dto";

@ApiTags("patients")
@ApiBearerAuth()
@Controller("patients/:patientId/immunizations")
export class ImmunizationsController {
  constructor(private readonly immunizations: ImmunizationsService) {}

  @Get()
  list(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
  ): Promise<ImmunizationListItem[]> {
    return this.immunizations.list(patientId);
  }

  @Post()
  create(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
    @Body() body: CreateImmunizationDto,
  ): Promise<{ patientImmunizationId: string }> {
    return this.immunizations.create(patientId, body);
  }

  @Delete(":immunizationId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
    @Param("immunizationId", new ParseUUIDPipe()) immunizationId: string,
  ): Promise<void> {
    await this.immunizations.delete(patientId, immunizationId);
  }
}
