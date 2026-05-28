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
import { LongTermMedicationsService } from "./long-term-medications.service";
import {
  CreateLongTermMedicationDto,
  UpdateLongTermMedicationDto,
  type LongTermMedicationListItem,
} from "./dto/long-term-medication.dto";

@ApiTags("patients")
@ApiBearerAuth()
@Controller("patients/:patientId/long-term-medications")
export class LongTermMedicationsController {
  constructor(private readonly meds: LongTermMedicationsService) {}

  @Get()
  list(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
  ): Promise<LongTermMedicationListItem[]> {
    return this.meds.list(patientId);
  }

  @Post()
  create(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
    @Body() body: CreateLongTermMedicationDto,
  ): Promise<{ patientLongTermMedicineId: string }> {
    return this.meds.create(patientId, body);
  }

  @Patch(":medicationId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async update(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
    @Param("medicationId", new ParseUUIDPipe()) medicationId: string,
    @Body() body: UpdateLongTermMedicationDto,
  ): Promise<void> {
    await this.meds.update(patientId, medicationId, body);
  }

  @Delete(":medicationId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
    @Param("medicationId", new ParseUUIDPipe()) medicationId: string,
  ): Promise<void> {
    await this.meds.delete(patientId, medicationId);
  }
}
