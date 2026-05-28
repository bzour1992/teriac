import { Module } from "@nestjs/common";
import { SuperadminController } from "./superadmin.controller";
import { SuperAdminGuard } from "./super-admin.guard";
import { ClinicsService } from "./clinics.service";
import { SpecialtiesService } from "./specialties.service";
import { ClinicModulesService } from "./modules.service";
import { FieldRulesService } from "./field-rules.service";
import { SuperadminUsersService } from "./users.service";
import { SuperadminAuditService } from "./audit.service";
import { FieldRulesModule } from "../field-rules/field-rules.module";

@Module({
  imports: [FieldRulesModule],
  controllers: [SuperadminController],
  providers: [
    SuperAdminGuard,
    ClinicsService,
    SpecialtiesService,
    ClinicModulesService,
    FieldRulesService,
    SuperadminUsersService,
    SuperadminAuditService,
  ],
})
export class SuperadminModule {}
