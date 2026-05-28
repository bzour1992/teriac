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
import { ChronicDiseasesService } from "./chronic-diseases.service";
import {
  CreateChronicDiseaseDto,
  UpdateChronicDiseaseDto,
  type ChronicDiseaseListItem,
} from "./dto/chronic-disease.dto";

@ApiTags("patients")
@ApiBearerAuth()
@Controller("patients/:patientId/chronic-diseases")
export class ChronicDiseasesController {
  constructor(private readonly chronic: ChronicDiseasesService) {}

  @Get()
  list(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
  ): Promise<ChronicDiseaseListItem[]> {
    return this.chronic.list(patientId);
  }

  @Post()
  create(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
    @Body() body: CreateChronicDiseaseDto,
  ): Promise<{ chronicDiseaseId: string }> {
    return this.chronic.create(patientId, body);
  }

  @Patch(":chronicId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async update(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
    @Param("chronicId", new ParseUUIDPipe()) chronicId: string,
    @Body() body: UpdateChronicDiseaseDto,
  ): Promise<void> {
    await this.chronic.update(patientId, chronicId, body);
  }

  @Delete(":chronicId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
    @Param("chronicId", new ParseUUIDPipe()) chronicId: string,
  ): Promise<void> {
    await this.chronic.delete(patientId, chronicId);
  }
}
