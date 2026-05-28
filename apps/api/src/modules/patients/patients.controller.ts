import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PatientsService } from "./patients.service";
import { ListPatientsQueryDto, type PatientListResponse } from "./dto/list-patients.dto";
import type { PatientDetail } from "./dto/patient-detail.dto";
import { UpdatePatientDto } from "./dto/update-patient.dto";
import { CreatePatientDto } from "./dto/create-patient.dto";
import { VitalsService } from "../visits/vitals.service";
import type { PatientVitalsRecord } from "../visits/dto/vitals.dto";

@ApiTags("patients")
@ApiBearerAuth()
@Controller("patients")
export class PatientsController {
  constructor(
    private readonly patients: PatientsService,
    private readonly vitals: VitalsService,
  ) {}

  @Get()
  list(@Query() query: ListPatientsQueryDto): Promise<PatientListResponse> {
    return this.patients.list(query);
  }

  @Get(":id")
  getById(@Param("id", new ParseUUIDPipe()) id: string): Promise<PatientDetail> {
    return this.patients.getById(id);
  }

  @Post()
  create(@Body() body: CreatePatientDto): Promise<{ patientId: string }> {
    return this.patients.create(body);
  }

  @Patch(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdatePatientDto,
  ): Promise<void> {
    await this.patients.update(id, body);
  }

  /** Chronological vitals across all visits — feeds the trend charts. */
  @Get(":id/vitals")
  listVitals(@Param("id", new ParseUUIDPipe()) id: string): Promise<PatientVitalsRecord[]> {
    return this.vitals.listForPatient(id);
  }
}
