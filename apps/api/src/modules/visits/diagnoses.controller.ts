import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { DiagnosesService } from "./diagnoses.service";
import { CreateDiagnosisDto, UpdateDiagnosisDto } from "./dto/diagnosis.dto";

@ApiTags("visits")
@ApiBearerAuth()
@Controller("visits/:visitId/diagnoses")
export class DiagnosesController {
  constructor(private readonly dx: DiagnosesService) {}

  @Post()
  create(
    @Param("visitId", new ParseUUIDPipe()) visitId: string,
    @Body() body: CreateDiagnosisDto,
  ): Promise<{ pvAssessmentConditionId: string }> {
    return this.dx.create(visitId, body);
  }

  @Patch(":dxId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async update(
    @Param("visitId", new ParseUUIDPipe()) visitId: string,
    @Param("dxId", new ParseUUIDPipe()) dxId: string,
    @Body() body: UpdateDiagnosisDto,
  ): Promise<void> {
    await this.dx.update(visitId, dxId, body);
  }

  @Delete(":dxId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("visitId", new ParseUUIDPipe()) visitId: string,
    @Param("dxId", new ParseUUIDPipe()) dxId: string,
  ): Promise<void> {
    await this.dx.delete(visitId, dxId);
  }
}
