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
import { PrescriptionsService } from "./prescriptions.service";
import {
  CreatePrescriptionDto,
  UpdatePrescriptionDto,
} from "./dto/prescription.dto";

@ApiTags("visits")
@ApiBearerAuth()
@Controller("visits/:visitId/prescriptions")
export class PrescriptionsController {
  constructor(private readonly rx: PrescriptionsService) {}

  @Post()
  create(
    @Param("visitId", new ParseUUIDPipe()) visitId: string,
    @Body() body: CreatePrescriptionDto,
  ): Promise<{ pvPlanMedicationId: string }> {
    return this.rx.create(visitId, body);
  }

  @Patch(":rxId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async update(
    @Param("visitId", new ParseUUIDPipe()) visitId: string,
    @Param("rxId", new ParseUUIDPipe()) rxId: string,
    @Body() body: UpdatePrescriptionDto,
  ): Promise<void> {
    await this.rx.update(visitId, rxId, body);
  }

  @Delete(":rxId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("visitId", new ParseUUIDPipe()) visitId: string,
    @Param("rxId", new ParseUUIDPipe()) rxId: string,
  ): Promise<void> {
    await this.rx.delete(visitId, rxId);
  }
}
