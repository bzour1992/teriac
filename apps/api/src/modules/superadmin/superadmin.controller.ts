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
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import { SuperAdminGuard } from "./super-admin.guard";
import { ClinicsService } from "./clinics.service";
import { SpecialtiesService } from "./specialties.service";
import { ClinicModulesService } from "./modules.service";
import { FieldRulesService } from "./field-rules.service";
import { SuperadminUsersService } from "./users.service";
import { SuperadminAuditService, type ClinicAuditSummary } from "./audit.service";
import {
  ActivateClinicDto,
  AddClinicSpecialtyDto,
  CreateClinicDto,
  CreateMasterSpecialtyDto,
  CreateUserInClinicDto,
  ListClinicsQueryDto,
  ListUsersQueryDto,
  SetFieldRuleDto,
  SetModuleDto,
  UpdateClinicDto,
  UpdateClinicSettingsDto,
  UpdateMasterSpecialtyDto,
  type ClinicDetail,
  type ClinicListResponse,
  type ClinicModule,
  type ClinicSpecialty,
  type CrossClinicUserListResponse,
  type FieldRule,
  type MasterSpecialty,
  type SuperadminStats,
} from "./dto/superadmin.dto";

@ApiTags("superadmin")
@ApiBearerAuth()
@UseGuards(SuperAdminGuard)
@Controller("superadmin")
export class SuperadminController {
  constructor(
    private readonly clinics: ClinicsService,
    private readonly specialties: SpecialtiesService,
    private readonly modules: ClinicModulesService,
    private readonly fieldRules: FieldRulesService,
    private readonly users: SuperadminUsersService,
    private readonly auditSummary: SuperadminAuditService,
  ) {}

  // ── Stats ─────────────────────────────────────────────────────────────────

  @Get("stats")
  getStats(): Promise<SuperadminStats> {
    return this.clinics.getStats();
  }

  // ── Clinics ───────────────────────────────────────────────────────────────

  @Get("clinics")
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "active", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  listClinics(@Query() query: ListClinicsQueryDto): Promise<ClinicListResponse> {
    return this.clinics.list(query);
  }

  @Post("clinics")
  createClinic(@Body() body: CreateClinicDto): Promise<{ hcenterId: string }> {
    return this.clinics.create(body);
  }

  @Get("clinics/:id")
  getClinic(@Param("id", new ParseUUIDPipe()) id: string): Promise<ClinicDetail> {
    return this.clinics.get(id);
  }

  @Put("clinics/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateClinic(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateClinicDto,
  ): Promise<void> {
    await this.clinics.update(id, body);
  }

  @Patch("clinics/:id/activate")
  @HttpCode(HttpStatus.NO_CONTENT)
  async activate(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: ActivateClinicDto,
  ): Promise<void> {
    await this.clinics.activate(id, body);
  }

  // ── Clinic settings ───────────────────────────────────────────────────────

  @Get("clinics/:id/settings")
  getSettings(@Param("id", new ParseUUIDPipe()) id: string): Promise<Record<string, unknown>> {
    return this.clinics.getSettings(id);
  }

  @Put("clinics/:id/settings")
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateSettings(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateClinicSettingsDto,
  ): Promise<void> {
    await this.clinics.updateSettings(id, body);
  }

  // ── Clinic specialties ────────────────────────────────────────────────────

  @Get("clinics/:id/specialties")
  listClinicSpecialties(
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<ClinicSpecialty[]> {
    return this.specialties.listForClinic(id);
  }

  @Post("clinics/:id/specialties")
  addClinicSpecialty(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: AddClinicSpecialtyDto,
  ): Promise<{ hcenterSpecialityId: string }> {
    return this.specialties.addToClinic(id, body);
  }

  @Delete("clinics/:id/specialties/:spId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeClinicSpecialty(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("spId", new ParseUUIDPipe()) spId: string,
  ): Promise<void> {
    await this.specialties.removeFromClinic(id, spId);
  }

  // ── Master specialties ────────────────────────────────────────────────────

  @Get("specialties")
  listMasterSpecialties(): Promise<MasterSpecialty[]> {
    return this.specialties.listMaster();
  }

  @Post("specialties")
  createMasterSpecialty(@Body() body: CreateMasterSpecialtyDto): Promise<{ specialityId: string }> {
    return this.specialties.createMaster(body);
  }

  @Patch("specialties/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateMasterSpecialty(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateMasterSpecialtyDto,
  ): Promise<void> {
    await this.specialties.updateMaster(id, body);
  }

  // ── Clinic modules ────────────────────────────────────────────────────────

  @Get("clinics/:id/modules")
  listModules(@Param("id", new ParseUUIDPipe()) id: string): Promise<ClinicModule[]> {
    return this.modules.listForClinic(id);
  }

  @Put("clinics/:id/modules/:moduleKey")
  @HttpCode(HttpStatus.NO_CONTENT)
  async setModule(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("moduleKey") moduleKey: string,
    @Body() body: SetModuleDto,
  ): Promise<void> {
    await this.modules.setForClinic(id, moduleKey, body);
  }

  // ── Field rules ───────────────────────────────────────────────────────────

  @Get("clinics/:id/field-rules")
  @ApiQuery({ name: "entity", required: false })
  listFieldRules(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query("entity") entity?: string,
  ): Promise<FieldRule[]> {
    return this.fieldRules.listForClinic(id, entity);
  }

  @Put("clinics/:id/field-rules/:entity/:field")
  @HttpCode(HttpStatus.NO_CONTENT)
  async setFieldRule(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("entity") entity: string,
    @Param("field") field: string,
    @Body() body: SetFieldRuleDto,
  ): Promise<void> {
    await this.fieldRules.setForClinic(id, entity, field, body);
  }

  // ── Clinic users (create) ─────────────────────────────────────────────────

  @Post("clinics/:id/users")
  createClinicUser(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: CreateUserInClinicDto,
  ): Promise<{ userId: string }> {
    return this.users.createInClinic(id, body);
  }

  @Get("clinics/:id/users")
  listClinicUsers(@Param("id", new ParseUUIDPipe()) id: string): Promise<CrossClinicUserListResponse> {
    return this.users.list({ clinicId: id, page: 1, pageSize: 200 });
  }

  // ── Cross-tenant users ────────────────────────────────────────────────────

  @Get("users")
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "clinicId", required: false })
  @ApiQuery({ name: "active", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  listAllUsers(@Query() query: ListUsersQueryDto): Promise<CrossClinicUserListResponse> {
    return this.users.list(query);
  }

  // ── Audit log (per-clinic summary + purge) ────────────────────────────────

  @Get("clinics/:id/audit-summary")
  getClinicAuditSummary(
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<ClinicAuditSummary> {
    return this.auditSummary.summary(id);
  }

  /**
   * Permanently delete audit_log rows older than N months for one clinic.
   * Allowed values for `olderThanMonths`: 1, 2, 3.
   */
  @Delete("clinics/:id/audit-log")
  @ApiQuery({ name: "olderThanMonths", required: true, enum: [1, 2, 3] })
  @HttpCode(HttpStatus.OK)
  purgeClinicAuditLog(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query("olderThanMonths") olderThanMonths: string,
  ): Promise<{ deleted: number; cutoff: string }> {
    const n = Number(olderThanMonths);
    if (n !== 1 && n !== 2 && n !== 3) {
      // Re-throw via the service to keep validation in one place.
      return this.auditSummary.purgeOlderThan(id, n as 1);
    }
    return this.auditSummary.purgeOlderThan(id, n as 1 | 2 | 3);
  }
}
