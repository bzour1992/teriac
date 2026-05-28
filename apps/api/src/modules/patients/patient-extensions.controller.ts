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
  Put,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PatientExtensionsService } from "./patient-extensions.service";
import {
  CreateInsuranceDto,
  CreateNoteDto,
  UpdateAdditionalInfoDto,
  UpdateArabicInfoDto,
  UpdateInsuranceDto,
  UpdateSubstanceUseDto,
  type AdditionalInfoDto,
  type ArabicInfoDto,
  type InsuranceItemDto,
  type PatientNoteDto,
  type SubstanceUseDto,
} from "./dto/patient-extensions.dto";

// ── Arabic info ───────────────────────────────────────────────────────────────

@ApiTags("patients")
@ApiBearerAuth()
@Controller("patients/:patientId/arabic-info")
export class ArabicInfoController {
  constructor(private readonly svc: PatientExtensionsService) {}

  @Get()
  get(@Param("patientId", new ParseUUIDPipe()) id: string): Promise<ArabicInfoDto> {
    return this.svc.getArabicInfo(id);
  }

  @Put()
  @HttpCode(HttpStatus.NO_CONTENT)
  async put(
    @Param("patientId", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateArabicInfoDto,
  ): Promise<void> {
    await this.svc.upsertArabicInfo(id, body);
  }
}

// ── Additional info ───────────────────────────────────────────────────────────

@ApiTags("patients")
@ApiBearerAuth()
@Controller("patients/:patientId/additional-info")
export class AdditionalInfoController {
  constructor(private readonly svc: PatientExtensionsService) {}

  @Get()
  get(@Param("patientId", new ParseUUIDPipe()) id: string): Promise<AdditionalInfoDto | null> {
    return this.svc.getAdditionalInfo(id);
  }

  @Put()
  @HttpCode(HttpStatus.NO_CONTENT)
  async put(
    @Param("patientId", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateAdditionalInfoDto,
  ): Promise<void> {
    await this.svc.upsertAdditionalInfo(id, body);
  }
}

// ── Substance use ─────────────────────────────────────────────────────────────

@ApiTags("patients")
@ApiBearerAuth()
@Controller("patients/:patientId/substance-use")
export class SubstanceUseController {
  constructor(private readonly svc: PatientExtensionsService) {}

  @Get()
  get(@Param("patientId", new ParseUUIDPipe()) id: string): Promise<SubstanceUseDto | null> {
    return this.svc.getSubstanceUse(id);
  }

  @Put()
  @HttpCode(HttpStatus.NO_CONTENT)
  async put(
    @Param("patientId", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateSubstanceUseDto,
  ): Promise<void> {
    await this.svc.upsertSubstanceUse(id, body);
  }
}

// ── Insurance ─────────────────────────────────────────────────────────────────

@ApiTags("patients")
@ApiBearerAuth()
@Controller("patients/:patientId/insurance")
export class InsuranceController {
  constructor(private readonly svc: PatientExtensionsService) {}

  @Get()
  list(@Param("patientId", new ParseUUIDPipe()) id: string): Promise<InsuranceItemDto[]> {
    return this.svc.listInsurance(id);
  }

  @Post()
  create(
    @Param("patientId", new ParseUUIDPipe()) id: string,
    @Body() body: CreateInsuranceDto,
  ): Promise<{ patientInsuranceDetailId: string }> {
    return this.svc.createInsurance(id, body);
  }

  @Patch(":iid")
  @HttpCode(HttpStatus.NO_CONTENT)
  async update(
    @Param("patientId", new ParseUUIDPipe()) id: string,
    @Param("iid", new ParseUUIDPipe()) iid: string,
    @Body() body: UpdateInsuranceDto,
  ): Promise<void> {
    await this.svc.updateInsurance(id, iid, body);
  }

  @Delete(":iid")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("patientId", new ParseUUIDPipe()) id: string,
    @Param("iid", new ParseUUIDPipe()) iid: string,
  ): Promise<void> {
    await this.svc.deleteInsurance(id, iid);
  }
}

// ── Special notes ─────────────────────────────────────────────────────────────

@ApiTags("patients")
@ApiBearerAuth()
@Controller("patients/:patientId/notes")
export class PatientNotesController {
  constructor(private readonly svc: PatientExtensionsService) {}

  @Get()
  list(@Param("patientId", new ParseUUIDPipe()) id: string): Promise<PatientNoteDto[]> {
    return this.svc.listNotes(id);
  }

  @Post()
  create(
    @Param("patientId", new ParseUUIDPipe()) id: string,
    @Body() body: CreateNoteDto,
  ): Promise<{ patientSpecialNoteId: string }> {
    return this.svc.createNote(id, body);
  }

  @Delete(":noteId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("patientId", new ParseUUIDPipe()) id: string,
    @Param("noteId", new ParseUUIDPipe()) noteId: string,
  ): Promise<void> {
    await this.svc.deleteNote(id, noteId);
  }
}
