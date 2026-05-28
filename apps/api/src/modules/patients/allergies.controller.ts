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
import { AllergiesService } from "./allergies.service";
import {
  CreateAllergyDto,
  UpdateAllergyDto,
  type AllergyListItem,
} from "./dto/allergy.dto";

@ApiTags("patients")
@ApiBearerAuth()
@Controller("patients/:patientId/allergies")
export class AllergiesController {
  constructor(private readonly allergies: AllergiesService) {}

  @Get()
  list(@Param("patientId", new ParseUUIDPipe()) patientId: string): Promise<AllergyListItem[]> {
    return this.allergies.list(patientId);
  }

  @Post()
  create(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
    @Body() body: CreateAllergyDto,
  ): Promise<{ allergyId: string }> {
    return this.allergies.create(patientId, body);
  }

  @Patch(":allergyId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async update(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
    @Param("allergyId", new ParseUUIDPipe()) allergyId: string,
    @Body() body: UpdateAllergyDto,
  ): Promise<void> {
    await this.allergies.update(patientId, allergyId, body);
  }

  @Delete(":allergyId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
    @Param("allergyId", new ParseUUIDPipe()) allergyId: string,
  ): Promise<void> {
    await this.allergies.delete(patientId, allergyId);
  }
}
